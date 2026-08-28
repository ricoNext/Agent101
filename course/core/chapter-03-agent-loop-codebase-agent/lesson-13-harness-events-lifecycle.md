# 第 13 课：实现 Harness 事件、Hook 与生命周期

> 章节导航：[第三章：Agent Loop、State、Harness 与 Codebase Agent](./index.md)<br>
> 上一课：[第 12 课：搭建 Agent Harness 核心接口](./lesson-12-harness-core-interfaces.md)<br>
> 下一课：[第 14 课：理解图编排原理与执行语义](./lesson-14-orchestration-principles.md)

## 一、你将完成什么

第 12 课已经把模型、工具、任务存储、策略和 Sandbox 抽象成端口，但 Harness 还必须解决三个运行时问题：

1. 一次任务运行从哪里开始，在哪些一致性边界上暂停，怎样结束；
2. 如何把模型回合、策略判断、工具调用和持久化提交记录成可审计事件；
3. 如何在不污染领域逻辑的情况下接入日志、指标、审批、取消和恢复等横切能力。

本课把一次长期任务拆成 Run、Step、Event 三个层次，并实现 Hook 的受控管道。完成后，你应该能够：

- 区分 Run、Step、Action 和 Event 的身份、生命周期与持久化边界；
- 定义开始、暂停、取消、恢复、完成、失败和未知结果的状态迁移；
- 设计不可变、可排序、可去重的事件信封；
- 让 Hook 只观察或提出控制决定，不能绕过 Harness 修改任务真相；
- 将取消和暂停传播到模型、工具、Sandbox 以及等待审批的边界；
- 处理 Hook 超时、异常、重复投递和监听器隔离；
- 通过事件重放重建 Timeline，但不重复执行副作用；
- 为下一课的图节点、Interrupt 和 Checkpoint 编排提供稳定契约。

## 二、本课内容边界

本课只解决一个问题：**Harness 如何用可审计事件和受控 Hook 驱动一次可暂停、可取消、可恢复的任务运行。**

本课覆盖 Run、Step、Event 的职责，事件信封和 EventStore，Hook 阶段和失败策略，Run/Step 状态机，暂停、取消、恢复和未知结果，以及最小 Harness 骨架和合同测试。

本课不展开图节点、条件边、并行分支、循环、Codebase Agent 业务策略或真实基础设施部署；这些内容分别留给第 14、15、16 课及第六章。

## 三、三个时间尺度

### 3.1 Run 是一次可恢复的执行会话

Run 表示某个任务在一个执行尝试中的生命周期。同一个任务因为重启、租约失效或人工恢复，可能拥有多个 Run；Run 不能替代任务本身，也不能成为唯一事实来源。

一个 Run 至少需要：

| 字段 | 含义 |
| --- | --- |
| run_id | 一次执行会话的稳定身份 |
| task_id | 所属任务 |
| attempt | 任务的第几次执行尝试 |
| status | running、paused、cancelling 等生命周期状态 |
| task_version | 开始时读取的任务版本 |
| fencing_token | 拒绝旧 Worker 写入的租约令牌 |
| cancellation_id | 取消请求的关联身份 |
| started_at / ended_at | 运行边界时间 |

Run 的终态只表达这次运行的结论。任务是否完成，还要由 Harness 根据任务完成标准和任务状态机判断。

### 3.2 Step 是一个可恢复边界

Step 是 Run 内可观察、可重试、可恢复的最小推进单元。一次 Step 可以包含模型提案、策略判断和一个已授权 Action，但不得把多个无法区分的外部副作用塞进同一个黑盒。

每个 Step 都要有 step_id、sequence、input_version、action_id、idempotency_key、status、evidence_refs 和 checkpoint_id。工具已经发出但结果未知时，Step 不能被标记为失败后直接重试，必须进入 unknown 或 recovery_required。

### 3.3 Event 是事实的追加记录

Event 记录已经发生或已被平台确认的事实，例如 run_started、model_proposed、action_authorized、action_completed、run_paused。它不是命令，不是当前状态的替代品，也不是模型自由文本日志。

    Task
     └── Run
          ├── Step 1: model_requested -> action_authorized -> step_succeeded
          └── Step 2: action_dispatched -> external_result_unknown

事件可以重建展示用 Timeline，但不能用“最后一条日志”推导授权或完成状态。可信状态仍来自任务存储和 Checkpoint。

## 四、生命周期状态机

### 4.1 Run 状态和合法迁移

    created -> running
    running -> paused | cancelling | completed | failed | recovery_required
    paused -> running | cancelling
    cancelling -> cancelled | recovery_required
    recovery_required -> running | failed

以下迁移必须拒绝：

- completed、failed、cancelled 重新进入 running；
- 未收到 pause_requested 就从 paused 自动恢复；
- 外部结果未知时直接迁移到 completed；
- cancelling 状态又派发新的模型或工具动作；
- 旧 fencing_token 提交任意终态。

迁移应该是纯函数，持久化层只负责按版本条件提交：

    from enum import StrEnum

    class RunStatus(StrEnum):
        CREATED = "created"
        RUNNING = "running"
        PAUSED = "paused"
        CANCELLING = "cancelling"
        COMPLETED = "completed"
        FAILED = "failed"
        CANCELLED = "cancelled"
        RECOVERY_REQUIRED = "recovery_required"

    ALLOWED_RUN_TRANSITIONS = {
        RunStatus.CREATED: {RunStatus.RUNNING},
        RunStatus.RUNNING: {
            RunStatus.PAUSED,
            RunStatus.CANCELLING,
            RunStatus.COMPLETED,
            RunStatus.FAILED,
            RunStatus.RECOVERY_REQUIRED,
        },
        RunStatus.PAUSED: {RunStatus.RUNNING, RunStatus.CANCELLING},
        RunStatus.CANCELLING: {
            RunStatus.CANCELLED,
            RunStatus.RECOVERY_REQUIRED,
        },
        RunStatus.RECOVERY_REQUIRED: {
            RunStatus.RUNNING,
            RunStatus.FAILED,
        },
        RunStatus.COMPLETED: set(),
        RunStatus.FAILED: set(),
        RunStatus.CANCELLED: set(),
    }

    def transition_run(current: RunStatus, target: RunStatus) -> RunStatus:
        if target not in ALLOWED_RUN_TRANSITIONS[current]:
            raise ValueError(f"invalid run transition: {current} -> {target}")
        return target

### 4.2 Step 状态不能隐藏外部不确定性

| Step 状态 | 允许的下一步 | 说明 |
| --- | --- | --- |
| created | started、cancelled | 尚未取得执行租约 |
| started | waiting、dispatched、succeeded、failed、unknown | 已读取快照并开始推进 |
| waiting | started、cancelled、unknown | 等审批、外部回调或恢复查询 |
| dispatched | succeeded、failed、unknown | 已向外部系统发出动作 |
| unknown | waiting、succeeded、failed | 必须先查询、补偿或人工确认 |
| succeeded | 无 | 一致边界已提交 |
| failed | 无 | 已确定失败且不可在本 Step 内继续 |
| cancelled | 无 | 未发生可见副作用或已确认取消 |

unknown 是重要领域事实。HTTP 超时、Worker 被杀、Sandbox 断连都不能自动映射为 failed，因为远端可能已经执行了写操作。

## 五、事件信封与 EventStore

### 5.1 稳定结构

事件写入应该使用平台自己的结构，而不是直接序列化供应商 Response、完整 Prompt 或 Python Exception：

    from dataclasses import dataclass
    from datetime import datetime
    from typing import Mapping

    @dataclass(frozen=True)
    class EventEnvelope:
        event_id: str
        event_type: str
        occurred_at: datetime
        task_id: str
        run_id: str
        step_id: str | None
        sequence: int
        task_version: int
        fencing_token: int
        correlation_id: str
        causation_id: str | None
        idempotency_key: str
        payload: Mapping[str, object]
        schema_version: int = 1

字段约束：

1. sequence 只在同一个 Run 内递增，并发 Worker 写入时由 EventStore 分配或校验；
2. causation_id 指向触发本事件的事件；
3. correlation_id 贯穿同一次用户请求、恢复或取消操作；
4. idempotency_key 用于重复投递去重，不能用随机时间替代；
5. payload 不保存 API Key、Cookie、完整身份信息、宿主机绝对路径或未经清洗的 Prompt；
6. schema_version 升级时要兼容读取或显式迁移，不能静默改变旧事件含义。

### 5.2 事件类型要表达边界

| 阶段 | 事件示例 |
| --- | --- |
| Run | run_created、run_started、run_paused、run_resumed、run_cancel_requested、run_cancelled、run_completed、run_failed |
| Step | step_started、step_waiting、step_succeeded、step_failed、step_unknown |
| 模型 | model_requested、model_proposed、model_rejected |
| 策略 | policy_checked、action_authorized、action_rejected、approval_requested |
| 外部动作 | action_dispatched、action_completed、action_failed、external_result_unknown |
| 恢复 | recovery_started、recovery_query_completed、manual_intervention_required |

不要把准备调用工具、工具调用成功、任务已完成合并为一个事件。它们的重试、审计和恢复含义不同。

### 5.3 EventStore 的最小端口

    from collections.abc import Iterable, Sequence
    from typing import Protocol

    class EventStore(Protocol):
        async def append(
            self,
            events: Sequence[EventEnvelope],
            *,
            expected_sequence: int,
        ) -> None: ...

        async def list_for_run(
            self,
            *,
            run_id: str,
            after_sequence: int = 0,
        ) -> Iterable[EventEnvelope]: ...

        async def has_idempotency_key(
            self,
            *,
            run_id: str,
            idempotency_key: str,
        ) -> bool: ...

append 必须是原子操作：要么整批事件都写入，要么一条也不写入。expected_sequence 不匹配时返回并发冲突，让 Harness 重新读取快照，而不是覆盖其他 Worker 的事件。

## 六、Hook 不是隐藏的第二个编排器

### 6.1 Hook 阶段和契约

Hook 用于观察或施加经过声明的控制，不应拥有任务存储的写权限。阶段固定为 before_run、before_step、before_action、after_action、after_step、after_run、on_error 和 on_cancel。

    from dataclasses import dataclass
    from enum import StrEnum
    from typing import Mapping, Protocol

    class HookDecisionKind(StrEnum):
        CONTINUE = "continue"
        PAUSE = "pause"
        CANCEL = "cancel"
        REQUIRE_RECOVERY = "require_recovery"

    @dataclass(frozen=True)
    class HookContext:
        phase: str
        task_id: str
        run_id: str
        step_id: str | None
        event: EventEnvelope | None
        task_version: int
        cancellation_requested: bool
        metadata: Mapping[str, str]

    @dataclass(frozen=True)
    class HookDecision:
        kind: HookDecisionKind
        reason: str = ""

    class HarnessHook(Protocol):
        name: str
        timeout_seconds: float
        failure_policy: str

        async def handle(self, context: HookContext) -> HookDecision: ...

### 6.2 Hook 的失败策略

| 策略 | 适用场景 | Hook 超时或异常时 |
| --- | --- | --- |
| observe | 指标、Timeline、非关键日志 | 记录 hook_failed，主流程继续 |
| gate | 合规、审批前置、租户隔离 | 阻止当前边界并进入 paused 或 failed |
| recover | 发现未知结果、租约失效 | 进入 recovery_required |
| cleanup | 释放临时资源 | 记录失败，按生命周期策略重试或人工介入 |

日志 Hook 不应因为埋点服务短暂不可用而阻止代码修复；审批 Hook 也不能因为超时而被当作 continue。

### 6.3 调度顺序和隔离

同一阶段的 Hook 使用显式 priority 排序。gate Hook 默认逐个执行，任何 pause、cancel 或 recovery 立即短路；observe Hook 可以并发，但只能得到事件副本，不能修改共享上下文。Hook 不能直接调用 ToolPort、SandboxPort、模型或 TaskStore。

需要派发动作时，应建模成受控 Step 或图节点，而不是塞进 Hook。

## 七、暂停、取消和恢复

### 7.1 暂停必须落在一致边界

暂停请求到达时，Harness 先记录 pause_requested，然后在安全边界处理：

1. 尚未派发外部 Action，Step 可以进入 waiting，Run 进入 paused；
2. 模型请求正在进行，使用取消令牌终止请求，未收到完整响应则不产生 model_proposed；
3. Action 已派发，先等待结果或进入 unknown，不能伪造取消成功；
4. 正在等待审批，保留 approval_requested，Run 进入 paused；
5. 写入 run_paused 和 Checkpoint，释放 Worker 租约。

安全边界的目标是“不再产生新的副作用”，不是保证所有外部系统立即停止。

### 7.2 取消请求不等于取消事实

cancel_requested 只表达用户或策略提出了取消意图。只有 Harness 确认没有未决外部动作，或下游已确认取消，才能写 run_cancelled。若 Action 结果未知，正确结果是 recovery_required。

取消传播链：

    CancelRequest
     -> Run cancellation token
     -> ModelPort / ToolPort / SandboxPort
     -> ApprovalPort
     -> safe boundary
     -> run_cancelled 或 recovery_required

Adapter 应区分 cancelled_before_dispatch、cancelled_in_flight 和 cancellation_unknown。

### 7.3 恢复永远从事实开始

Worker 重启或 Run 恢复时，顺序不能是重新把旧 Prompt 发给模型：

1. 读取最新 TaskSnapshot、Run 状态和 fencing token；
2. 检查未完成 Step、active_action_id 和 idempotency_key；
3. 对 unknown Action 调用查询端口，或创建人工恢复项；
4. 检查审批是否仍有效、预算是否过期、Sandbox generation 是否匹配；
5. 追加 recovery_started 与查询结果事件；
6. 只有得到确定事实后，才恢复到 running 或进入 failed。

若下游不支持查询，系统必须承认未知结果并进入人工处理，而不是通过重复写操作“试试看”。

## 八、最小 Harness 生命周期骨架

下面的骨架只展示控制边界。真实项目还需要接入第 5、6、8、9 至 11 课的版本、租约、预算和 Sandbox 实现。

    class Harness:
        async def advance(self, run_id: str) -> AdvanceResult:
            snapshot = await self.task_store.get_snapshot(run_id)
            token = self.tokens.setdefault(run_id, CancellationToken())

            if token.cancelled:
                return await self.cancel_at_boundary(snapshot)
            if snapshot.status in {"paused", "cancelling", "completed", "failed"}:
                return AdvanceResult("waiting", run_id, snapshot.version, snapshot.status)
            if snapshot.active_action_id:
                return AdvanceResult(
                    "recovery_required",
                    run_id,
                    snapshot.version,
                    "active action must be reconciled",
                )

            await self.run_hooks("before_run", snapshot, None, token)
            step = await self.task_store.start_next_step(
                run_id=run_id,
                expected_version=snapshot.version,
                fencing_token=snapshot.fencing_token,
            )
            await self.run_hooks("before_step", snapshot, step.started_event, token)

            proposal = await self.model_port.propose(
                self.task_store.build_model_request(snapshot, step),
                cancellation_token=token,
            )
            await self.emit_event(snapshot, step, "model_proposed", proposal)
            decision = await self.policy_port.check(proposal, snapshot)
            await self.emit_event(snapshot, step, "policy_checked", decision)

            if decision.kind == "pause":
                return await self.pause_at_boundary(snapshot, step.step_id)
            if decision.kind == "cancel":
                return await self.cancel_at_boundary(snapshot, step.step_id)
            if decision.kind == "require_recovery":
                return await self.recover(snapshot, step.step_id, decision.reason)
            if decision.kind != "allow":
                return await self.fail_step(snapshot, step.step_id, decision.reason)

            await self.run_hooks("before_action", snapshot, proposal, token)
            action = await self.task_store.authorize_action(
                snapshot=snapshot,
                step_id=step.step_id,
                proposal=proposal,
            )
            await self.emit_event(snapshot, step, "action_authorized", action)

            try:
                result = await self.tool_port.execute(
                    action,
                    cancellation_token=token,
                )
            except ExternalResultUnknown as error:
                await self.emit_event(
                    snapshot,
                    step,
                    "external_result_unknown",
                    {"error_code": error.code},
                )
                return await self.recover(snapshot, step.step_id, "unknown result")

            await self.emit_event(snapshot, step, "action_completed", result)
            await self.run_hooks("after_action", snapshot, result, token)
            committed = await self.task_store.commit_step(
                run_id=run_id,
                step_id=step.step_id,
                result=result,
                expected_version=snapshot.version,
                fencing_token=snapshot.fencing_token,
            )
            await self.run_hooks("after_step", snapshot, committed.event, token)
            return AdvanceResult(
                "progressed",
                run_id,
                committed.version,
                "step committed",
                step.step_id,
            )

实现时必须检查三条边界：

1. emit_event 必须以 Run sequence 和 expected_sequence 写入 EventStore，不能只发内存回调；
2. Hook 的控制决定必须编译成任务状态迁移，而不是直接修改对象；
3. 工具异常要在 Adapter 层区分确定失败、取消和 unknown，不能由一个异常处理器吞掉所有错误。

## 九、事件监听、重放与可观测性

### 9.1 先提交，再发布

EventStore 负责事实落盘，EventBus 负责通知 Timeline、指标和审计订阅者。正确顺序是：

    校验迁移
     -> 原子提交任务快照 + 事件
     -> 发布 committed event
     -> 监听器异步消费

监听器重复消费是正常情况，必须使用 event_id 或 idempotency_key 去重。发布失败由 Outbox 或重试机制处理。

### 9.2 重放不是重新执行

Timeline Replay 的输入是已提交事件，输出是展示状态、指标快照或诊断报告。重放禁止调用 ModelPort、ToolPort、SandboxPort 和会产生副作用的 live Hook。

建议区分 live Hook 和 projection Hook：前者只在真实生命周期运行，后者只能从 EventEnvelope 计算展示投影，可以安全重放。历史投影不能覆盖当前 TaskSnapshot。

### 9.3 指标绑定生命周期身份

至少记录 Run 总时长、Step 的等待/模型/策略/工具/提交耗时、Hook 超时和失败、暂停与恢复原因、unknown Action 数量、预算消耗和重试次数。日志使用 task_id、run_id、step_id、event_id、correlation_id 关联，不复制完整 Prompt 或敏感参数。

## 十、测试：把生命周期当作合同

    def test_terminal_run_cannot_resume() -> None:
        with pytest.raises(ValueError):
            transition_run(RunStatus.COMPLETED, RunStatus.RUNNING)

    async def test_unknown_action_requires_recovery() -> None:
        result = await run_harness_with_tool_error("timeout_after_dispatch")
        assert result.kind == "recovery_required"
        assert latest_event_type() == "external_result_unknown"

    async def test_observe_hook_failure_does_not_stop_step() -> None:
        harness = make_harness(hooks=(FailingObserveHook(),))
        result = await harness.advance("run-01")
        assert result.kind == "progressed"
        assert "hook_failed" in event_types(harness)

    async def test_gate_hook_pauses_before_action() -> None:
        harness = make_harness(hooks=(PauseOnProductionHook(),))
        result = await harness.advance("run-01")
        assert result.kind == "waiting"
        assert "action_dispatched" not in event_types(harness)
        assert latest_run_status(harness) == RunStatus.PAUSED

至少覆盖以下场景：

| 场景 | 必须断言 |
| --- | --- |
| 模型请求前取消 | 不产生 model_proposed 和 action_dispatched |
| 派发前取消 | Action 不进入 dispatched |
| 派发后确认取消 | Step 为 cancelled，Run 可进入 cancelled |
| 派发后结果未知 | Step 为 unknown，Run 为 recovery_required |
| Worker 重启 | 读取 active_action_id，先查询而不是重新派发 |
| Hook 重复投递 | event_id 去重，主流程只提交一次 |
| 旧租约提交 | 返回 fencing conflict，不覆盖新 Run |

测试不应只断言最终状态，还要检查事件顺序和禁止出现的事件。对取消流程来说，“没有写操作”本身就是重要断言。

## 十一、与第 12、14、15 课的衔接

| 第 12 课端口 | 本课增加的运行时要求 |
| --- | --- |
| ModelPort | 接收取消令牌，输出可关联的 request_id |
| ToolPort | 返回确定成功、确定失败、取消或 unknown 的归一化结果 |
| TaskStore | 按 version 和 fencing token 原子提交 Step、Run 和 Checkpoint |
| PolicyPort | 返回 allow、pause、cancel、require_recovery 控制决定 |
| SandboxPort | 传播取消并报告进程是否启动、完成或结果未知 |

第 14 课会把 advance 和 Hook 边界放入图编排语义：图节点调用 Harness，而不是绕过 Harness 直接调用工具；Interrupt 映射为 paused 或 waiting；条件边读取已提交事实；并行节点使用独立 Step、幂等键和可合并 Checkpoint。

第 15 课接入 LangGraph 时，框架 callback、checkpoint 和 interrupt 只能作为 Adapter，业务状态、权限和副作用边界仍由本课定义的 Harness 控制。

## 十二、常见错误

### 12.1 把 Event 当作状态

事件是历史事实，状态是当前可推进投影。直接用最后一条日志判断权限或完成，会导致并发和回放错误。

### 12.2 Hook 里偷偷执行业务动作

这会产生没有 Action 身份、预算预留和幂等键的副作用。需要动作时，把它建模成受控 Step 或图节点。

### 12.3 取消时无条件写 cancelled

如果远端已经收到写操作，取消只是意图而不是事实。必须查询、补偿或进入人工恢复。

### 12.4 监听器先于持久化收到事件

这会让 UI、指标和审计出现幽灵事件。先提交，再发布；发布失败由 Outbox 或重试机制处理。

### 12.5 重放执行 live Hook

重放会重复发通知、扣预算或调用工具。投影 Hook 必须纯函数，live Hook 永不参与 Replay。

## 十三、课堂练习

1. 设计 approval_requested -> run_paused -> run_resumed 的事件序列，标出每个事件的 causation_id、idempotency_key 和任务版本。
2. 为“命令已经发给 Sandbox，但 Worker 在收到 stdout 前崩溃”的场景设计恢复状态，并说明为什么不能直接重试。
3. 写一个只读的成本指标 Hook，说明它属于 observe 还是 gate，以及超时后主流程应如何处理。
4. 给同时监听 run_completed 的邮件 Hook 和 Timeline Hook 设计去重方案，保证事件重复投递不会重复发邮件。
5. 解释图编排中的 Interrupt 如何映射到 paused、waiting 和 recovery_required。

## 十四、完成标准

完成本课后，你应该能够做到：

- 用 Run、Step、Event 描述一次可恢复 Agent 执行；
- 定义合法状态迁移，并拒绝终态回退和旧租约写入；
- 追加带 sequence、因果关系和幂等键的事件；
- 让 Hook 按阶段、优先级和失败策略运行；
- 区分暂停请求、取消事实和外部结果未知；
- 在恢复时查询未决 Action，而不是重复派发副作用；
- 让 Event Replay 只产生投影，不执行 live Hook；
- 用自动化测试覆盖事件顺序、Hook 隔离、取消和恢复；
- 为下一课图编排的节点与 Interrupt 提供清晰边界。

## 十五、本课小结

Harness 的生命周期不是围绕一条无限循环编写的。Run 表示一次执行会话，Step 表示可恢复推进边界，Event 表示已经发生的事实。Harness 负责在这些边界上读取可信快照、调用端口、提交状态和追加事件；Hook 负责观察或提出受控决定，但不能成为隐藏的第二个编排器。

暂停和取消都首先是请求，只有在安全边界确认后才成为事实；外部结果未知必须显式保留，恢复必须从 active action、幂等键、审批和 Checkpoint 开始。事件先持久化再发布，重放只构造投影，不重复执行副作用。

下一课将把这些生命周期边界放入图编排模型，解释节点、边、共享状态、条件分支、循环和 Interrupt 如何组合成长程 Agent。
