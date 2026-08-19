# 第 4 课：设计计划、观察与执行契约

> 章节导航：[第三章：Agent Loop、State、Harness 与 Codebase Agent](./index.md)  
> 上一课：[第 3 课：设计任务状态机与迁移规则](./lesson-03-task-state-machine.md)  
> 下一课：[第 5 课：实现任务持久化与事件记录](./lesson-05-task-persistence-events.md)

## 一、你将完成什么

第 3 课已经规定任务可以处于 `planning`、`running`、`waiting_tool` 和 `completed` 等状态，也规定了状态只能通过受控命令迁移。但状态机只回答“任务现在处于哪里”，还没有回答每个回合到底观察到了什么、准备执行什么，以及工具返回的结果是否足以支持下一步。

本课为 Agent Loop 定义一组最小的回合契约，并把模型提案与平台事实分开。完成本课后，你应该能够：

1. 区分 `Plan`、`PlanStep`、`Observation`、`Action` 和 `ExecutionResult` 的职责；
2. 设计 `observe -> plan -> act -> observe` 的回合边界；
3. 表达“准备执行”“已经发出”“执行成功”“结果未知”等不同事实；
4. 让计划步骤与第 3 课的任务状态机保持一致，而不是各自维护一套生命周期；
5. 用确定性合同测试拒绝过期计划、越权动作和虚假的完成结论。

## 二、本课内容边界

本课只解决一个问题：**Agent 回合中的计划、观察和执行对象，如何形成可验证的事实链。**

本课会完成：

- 计划与计划步骤的数据结构；
- 观察快照与证据引用；
- 动作提案和执行结果的边界；
- 一次回合的输入、输出与状态变化；
- 计划失效、执行失败和结果未知的表达；
- 回合契约的纯函数测试。

本课不会展开：

- 任务、步骤、消息和事件的数据库表设计；
- Checkpoint、租约和进程重启恢复；
- 根据新证据自动修改计划的算法；
- 步数、Token、时间和工具预算的扣减；
- Sandbox 的路径解析、命令隔离和资源限制；
- Codebase Agent 的补丁格式、代码检索和测试交付。

第 5 课负责把本课产生的事实持久化，第 6 课负责恢复，第 7 课再讨论动态重规划，第 9–11 课讨论 Sandbox。

## 三、为什么不能把回合写成一个大字典

早期原型经常把所有信息放在一个可变对象中：

```python
context = {
    "plan": "先搜索，再读取文件",
    "last_tool": "rg",
    "tool_result": "...",
    "done": False,
}
```

这种结构有三个问题：

1. 模型提出的计划和平台确认的执行结果没有可信度区分；
2. `last_tool` 不能说明动作是“准备执行”“已发出”还是“已经返回”；
3. 下一次回合无法判断当前计划是否仍然针对同一个任务版本。

Agent 需要的是一条可审计的事实链：

```text
任务契约
  -> 观察快照
  -> 计划提案
  -> 平台校验后的动作
  -> 执行结果
  -> 新观察快照
```

模型可以提出计划和动作，但不能伪造执行结果；工具可以返回结果，但不能决定任务是否满足完成标准；Loop Controller 负责把这些对象连接起来，并调用第 3 课的状态机。

## 四、五个核心对象

### 4.1 Plan：本轮希望达成的方案

`Plan` 是对后续工作的结构化提案，不是执行历史。它可以由模型提出，也可以由固定策略生成。计划至少要说明：它服务于哪个任务、基于哪个观察版本、准备完成什么，以及包含哪些步骤。

### 4.2 PlanStep：一个可观察的工作单元

`PlanStep` 表达“要完成的一件事”，例如搜索登录入口、读取鉴权实现或运行一个只读测试。它不直接等于一次 ToolCall：一个步骤可能需要多次尝试，也可能在执行前等待审批。

### 4.3 Observation：平台在某一时刻确认的事实

观察快照不是模型的总结，而是 Controller 从任务状态、工具结果、文件内容、审批和环境检查中装配的事实视图。每个观察都应带版本号或序号，避免旧回合覆盖新事实。

### 4.4 Action：准备执行的动作提案

`Action` 描述下一步想做什么，例如调用 `search_code`、请求用户补充信息或提交完成提案。它仍然不是授权。只有通过 Tool Schema、权限、审批和当前任务状态检查后，才可以交给第二章的 Tool Runtime。

### 4.5 ExecutionResult：受控执行器返回的事实

执行结果必须区分成功、明确失败和未知。网络断开不等于写操作没有发生；只有执行器或幂等查询能够确认没有副作用时，平台才可以把它标记为失败或未执行。

| 对象 | 产生者 | 是否代表已发生事实 | 典型内容 |
| --- | --- | --- | --- |
| `Plan` | Planner | 否 | 步骤、依赖、计划版本 |
| `Observation` | Controller / 可信适配器 | 是 | 状态、证据、可用能力 |
| `Action` | Planner 或策略 | 否 | 工具名、参数、动作意图 |
| `ExecutionResult` | Tool Runtime / Sandbox | 是 | 成功、失败、未知、输出引用 |

## 五、定义不可变回合契约

下面的示例放在 `apps/api/app/agents/turn_contracts.py`。它使用不可变数据类表达教学所需的最小字段；生产实现可以映射到 Pydantic 或数据库模型，但不应改变这些职责边界。

```python
from dataclasses import dataclass
from enum import StrEnum
from typing import Any


class StepStatus(StrEnum):
    PENDING = "pending"
    READY = "ready"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    BLOCKED = "blocked"
    SKIPPED = "skipped"


class ActionKind(StrEnum):
    TOOL_CALL = "tool_call"
    REQUEST_INPUT = "request_input"
    REQUEST_APPROVAL = "request_approval"
    COMPLETE = "complete"
    FAIL = "fail"


class ResultKind(StrEnum):
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    UNKNOWN = "unknown"
    NOT_STARTED = "not_started"


@dataclass(frozen=True)
class PlanStep:
    step_id: str
    objective: str
    depends_on: tuple[str, ...] = ()
    status: StepStatus = StepStatus.PENDING


@dataclass(frozen=True)
class Plan:
    plan_id: str
    task_id: str
    observation_version: int
    steps: tuple[PlanStep, ...]
    rationale: str | None = None


@dataclass(frozen=True)
class Observation:
    task_id: str
    version: int
    task_status: str
    evidence_refs: tuple[str, ...] = ()
    pending_action_id: str | None = None
    facts: tuple[tuple[str, Any], ...] = ()


@dataclass(frozen=True)
class Action:
    action_id: str
    task_id: str
    plan_id: str
    step_id: str | None
    kind: ActionKind
    tool_name: str | None = None
    arguments: tuple[tuple[str, Any], ...] = ()


@dataclass(frozen=True)
class ExecutionResult:
    action_id: str
    kind: ResultKind
    output_ref: str | None = None
    error_code: str | None = None
    side_effects_confirmed: bool = False
```

这里有两个有意的取舍：

- `Observation.version` 是回合的事实版本，不是数据库自增 ID；它用于拒绝基于旧观察产生的计划。
- `ExecutionResult.output_ref` 只保存结果引用，不把任意大段输出塞进任务状态。结果内容的存储与事件记录属于第 5 课。

## 六、计划步骤与任务状态的关系

任务状态机和步骤状态机解决不同层级的问题：

| 层级 | 关注点 | 示例 |
| --- | --- | --- |
| 任务级 | 整个任务是否允许继续 | `running`、`waiting_approval`、`completed` |
| 步骤级 | 当前计划中的一项工作进展 | `pending`、`running`、`succeeded` |
| 动作级 | 一次具体调用的发送与返回 | `tool_call`、`unknown` |

三者不能互相替代。例如，工具调用失败后，动作结果可以是 `FAILED`，步骤可以暂时保持 `BLOCKED`，任务仍然处于 `running`，等待 Controller 选择重试或下一步。反过来，任务进入 `waiting_approval` 时，当前步骤可以仍然是 `READY`，因为动作还没有执行。

建议使用以下不变量：

1. 任务进入 `waiting_tool` 前，必须已经存在一个已接受的 `Action`；
2. 任务进入 `waiting_approval` 前，必须存在绑定当前 `plan_id` 和 `step_id` 的审批动作；
3. 步骤标记 `SUCCEEDED` 前，必须存在对应的成功执行结果或可信验证证据；
4. 任务进入 `completed` 前，不能只检查最后一个步骤，而要检查 `TaskSpec.completion`；
5. 计划不能修改已经确认的执行结果，只能生成新的计划版本。

## 七、定义 observe -> plan -> act -> observe 回合

### 7.1 回合输入与输出

一个回合从当前观察和任务契约开始，输出的是“下一步平台动作”或“结束提案”：

```text
输入：TaskSpec + TaskRuntimeState + Observation
  -> Planner 提出 Plan / Action
  -> Controller 校验计划与动作
  -> Tool Runtime 或人工节点执行
  -> 生成 ExecutionResult
输出：新的 Observation + 状态迁移命令
```

模型未返回有效结构时，不能把自然语言直接当成 `Action`。Controller 应记录解析失败，并根据策略重试、暂停或失败。

### 7.2 `observe`：只装配已经确认的事实

观察阶段至少应包括：

- `TaskSpec` 的目标、约束和完成标准摘要；
- 第 3 课状态机中的当前任务状态；
- 当前计划版本与可执行步骤；
- 已确认的执行结果和证据引用；
- 已消耗的边界摘要（具体预算算法后置）；
- 当前可用工具、审批和环境事实。

观察阶段不应把“模型上轮说应该已经完成”当成事实。它只能引用平台确认的 `ExecutionResult`、文件快照、测试输出或审批记录。

### 7.3 `plan`：产生提案，不改变任务事实

Planner 可以提出一份完整计划，也可以只提出当前动作。无论采用哪种形式，都必须记录：

- 计划属于哪个 `task_id`；
- 它基于哪个 `observation_version`；
- 步骤之间的依赖关系；
- 每一步的目标和预期证据；
- 计划是否需要审批或额外输入。

计划生成成功不等于任务从 `planning` 进入 `running`。只有 Controller 确认存在合法、可执行的下一步，才执行第 3 课的 `PLAN_READY` 迁移。

### 7.4 `act`：先校验，再交给 Runtime

动作校验顺序建议固定为：

```text
检查任务状态
-> 检查计划版本
-> 检查步骤依赖
-> 检查 Action Schema
-> 检查任务作用域与工具权限
-> 判断是否需要审批
-> 交给 Tool Runtime
```

任何一项失败，都不能直接调用工具。策略拒绝、需要审批和参数错误应分别产生不同结果，方便工作台解释原因。

### 7.5 第二次 `observe`：把结果转换成新事实

工具返回后，Controller 不能只把文本拼到下一次提示词中。它应该：

1. 保存 `ExecutionResult` 或引用；
2. 更新对应步骤的可见状态；
3. 根据结果执行任务状态迁移；
4. 增加观察版本；
5. 生成下一轮观察快照。

例如搜索工具成功，只能说明“搜索结果已获得”，不能直接说明“已经理解调用链”。后者还需要读取文件并形成足够证据。

## 八、区分计划提案、验证结果与完成提案

这三种对象经常被混在模型输出里，但它们的可信来源不同：

| 对象 | 作用 | 能否直接改变状态 |
| --- | --- | --- |
| 计划提案 | 说明准备怎样工作 | 不能，需 Controller 接受 |
| 验证结果 | 说明某项事实是否被证据支持 | 可以作为状态机守卫输入，但必须来自可信验证器 |
| 完成提案 | 请求任务结束 | 不能，必须对照完成契约验证 |

例如模型可能输出：

```json
{
  "kind": "complete",
  "summary": "已修复并通过测试"
}
```

这只能解析为 `Action(kind=COMPLETE)`。平台仍需检查：补丁是否实际应用、测试是否真的执行、退出码是否为 0、产物和引用是否齐全。任何一项缺失，都不能调用第 3 课的 `COMPLETE` 命令。

## 九、实现一个纯函数回合校验器

先实现不依赖模型、数据库和网络的合同校验：

```python
from dataclasses import replace


class InvalidTurn(ValueError):
    pass


def next_ready_step(plan: Plan) -> PlanStep | None:
    completed = {
        step.step_id
        for step in plan.steps
        if step.status is StepStatus.SUCCEEDED
    }
    for step in plan.steps:
        if step.status is not StepStatus.PENDING:
            continue
        if all(dependency in completed for dependency in step.depends_on):
            return replace(step, status=StepStatus.READY)
    return None


def validate_action(
    observation: Observation,
    plan: Plan,
    action: Action,
) -> None:
    if action.task_id != observation.task_id or action.task_id != plan.task_id:
        raise InvalidTurn("task_id does not match the current turn")
    if plan.observation_version != observation.version:
        raise InvalidTurn("plan was created from a stale observation")
    if action.plan_id != plan.plan_id:
        raise InvalidTurn("action does not belong to the current plan")

    if action.kind is ActionKind.TOOL_CALL and not action.tool_name:
        raise InvalidTurn("tool_call requires tool_name")
    if action.kind is not ActionKind.TOOL_CALL and action.tool_name:
        raise InvalidTurn("only tool_call may specify tool_name")

    if action.step_id is not None:
        step_ids = {step.step_id for step in plan.steps}
        if action.step_id not in step_ids:
            raise InvalidTurn("action references an unknown step")


def accept_execution_result(
    action: Action,
    result: ExecutionResult,
) -> None:
    if result.action_id != action.action_id:
        raise InvalidTurn("execution result does not match action")
    if result.kind is ResultKind.FAILED and not result.error_code:
        raise InvalidTurn("failed result requires error_code")
    if result.kind is ResultKind.UNKNOWN and result.side_effects_confirmed:
        raise InvalidTurn("unknown result cannot confirm side effects")
```

`next_ready_step()` 只根据计划依赖计算候选步骤，不会自行执行动作；`validate_action()` 只验证回合内的一致性，不授予工具权限；`accept_execution_result()` 只检查结果与动作的对应关系，不把失败自动转换为任务终态。它们分别保留了 Planner、Controller 和 Tool Runtime 的职责边界。

## 十、把回合校验接入第 3 课状态机

Controller 的主流程可以先写成下面的伪代码：

```python
def run_turn(task_spec, runtime_state, observation, planner, runtime):
    if runtime_state.status == TaskStatus.PAUSED:
        raise InvalidTurn("paused task must be resumed before a turn")

    plan = planner.create_plan(task_spec, observation)
    validate_plan(task_spec, observation, plan)

    step = next_ready_step(plan)
    if step is None:
        proposal = planner.propose_finish(task_spec, observation)
        return verify_completion_or_stop(runtime_state, proposal, observation)

    action = planner.create_action(task_spec, observation, plan, step)
    validate_action(observation, plan, action)

    if action.kind is ActionKind.REQUEST_APPROVAL:
        next_state = transition(
            runtime_state,
            TaskCommand.REQUEST_APPROVAL,
            TransitionFacts(reason="approval_required"),
        )
        return next_state, observation, action

    result = runtime.execute(action)
    accept_execution_result(action, result)
    next_observation = observe_result(observation, action, result)
    return apply_result_transition(runtime_state, action, result, next_observation)
```

这里的 `validate_plan`、`verify_completion_or_stop`、`observe_result` 和 `apply_result_transition` 是边界清晰的适配器，而不是本课要实现的完整编排器：

- `validate_plan` 检查任务 ID、观察版本、步骤依赖和任务范围；
- `verify_completion_or_stop` 对照 `TaskSpec.completion`，决定是否可以提交完成；
- `observe_result` 把受控结果转换成新的事实快照；
- `apply_result_transition` 将结果映射为第 3 课允许的状态命令。

注意，真实代码中 `runtime.execute()` 还要接入第二章的 Tool Runtime，不能直接调用工具函数。第 12–15 课会把这些接口抽象进 Agent Harness 和图编排器。

## 十一、执行结果的三种重要语义

### 11.1 成功

`SUCCEEDED` 表示执行器确认动作完成，并可以提供输出或产物引用。它不代表整个任务完成。例如搜索成功后，任务仍可能需要读取文件。

### 11.2 明确失败

`FAILED` 表示执行器确认动作没有完成。Controller 可以依据错误类型选择重试、替代动作、暂停或失败。一次动作失败不应自动覆盖任务级状态。

### 11.3 未知

`UNKNOWN` 表示无法确认动作是否产生副作用，常见于请求超时、连接断开或进程被回收。对于写入动作，未知结果必须阻止自动重复执行，直到通过幂等查询、审计或人工确认得到结论。

```text
明确成功 -> 记录结果，继续观察
明确失败 -> 记录原因，选择重试/替代/停止
结果未知 -> 停止发起同一动作，进入查询或人工处理
```

`NOT_STARTED` 只表示动作尚未交给执行器，例如审批拒绝或策略拦截；它与执行失败不同。

## 十二、编写回合合同测试

可以在 `apps/api/tests/agents/test_turn_contracts.py` 中覆盖对象之间的关键不变量：

```python
import pytest


def make_turn() -> tuple[Observation, Plan, Action]:
    observation = Observation(
        task_id="task-1",
        version=3,
        task_status="running",
    )
    plan = Plan(
        plan_id="plan-2",
        task_id="task-1",
        observation_version=3,
        steps=(PlanStep(step_id="s1", objective="搜索入口"),),
    )
    action = Action(
        action_id="action-1",
        task_id="task-1",
        plan_id="plan-2",
        step_id="s1",
        kind=ActionKind.TOOL_CALL,
        tool_name="search_code",
    )
    return observation, plan, action


def test_action_must_use_current_observation() -> None:
    observation, plan, action = make_turn()
    stale_plan = Plan(
        plan_id=plan.plan_id,
        task_id=plan.task_id,
        observation_version=2,
        steps=plan.steps,
    )

    with pytest.raises(InvalidTurn, match="stale"):
        validate_action(observation, stale_plan, action)


def test_result_must_belong_to_action() -> None:
    _, _, action = make_turn()
    result = ExecutionResult(
        action_id="other-action",
        kind=ResultKind.SUCCEEDED,
    )

    with pytest.raises(InvalidTurn, match="does not match"):
        accept_execution_result(action, result)


def test_unknown_result_cannot_be_treated_as_confirmed_write() -> None:
    _, _, action = make_turn()
    result = ExecutionResult(
        action_id=action.action_id,
        kind=ResultKind.UNKNOWN,
        side_effects_confirmed=True,
    )

    with pytest.raises(InvalidTurn, match="unknown"):
        accept_execution_result(action, result)
```

还应补充以下测试：

- 计划引用错误任务时被拒绝；
- 计划基于旧 `Observation.version` 时被拒绝；
- 未满足依赖的步骤不能成为 `READY`；
- `tool_call` 缺少工具名时被拒绝；
- 非工具动作不能携带工具名；
- 失败结果没有错误码时被拒绝；
- `NOT_STARTED` 不会被记录为工具失败；
- 成功的单个步骤不会绕过任务完成契约。

这些测试不需要启动模型或真实工具。模型输出解析、Runtime 调用和数据库写入应分别在各自适配器测试中验证。

## 十三、串联一次代码调查回合

以“解释登录请求的权限校验链”为例：

```text
Observation(v=0)
  当前：任务 running，无代码证据
  -> Plan(p1)：搜索登录路由
  -> Action(a1)：调用 search_code
  -> ExecutionResult(a1, succeeded, ref=tool-result-1)
Observation(v=1)
  当前：发现 /login 路由，尚未找到权限实现
  -> Plan(p2)：读取路由和 authenticate() 定义
  -> Action(a2)：调用 read_file
  -> ExecutionResult(a2, succeeded, ref=tool-result-2)
Observation(v=2)
  当前：确认中间件与权限策略文件
  -> Action(a3)：读取策略测试
  -> ExecutionResult(a3, succeeded, ref=tool-result-3)
Observation(v=3)
  当前：完成标准要求的入口、策略、测试证据均已存在
  -> Action(a4)：提交完成提案
  -> 平台验证完成契约
```

每个 `Plan` 都基于当时的观察版本。后续观察发现路径不存在时，不是修改旧计划对象，而是生成新的计划版本。旧计划和旧结果仍然保留，便于第 5 课记录事件和第 20 课回放。

## 十四、常见错误

| 错误 | 正确处理 |
| --- | --- |
| 用一个 `dict` 同时保存计划、状态和工具输出 | 分离 `Plan`、`Observation`、`Action` 与 `ExecutionResult` |
| 计划生成后就认为动作已经执行 | 只有 Runtime 返回结果后才能记录执行事实 |
| 把搜索成功当成任务完成 | 对照完成契约检查全部证据 |
| 计划对象原地修改 | 生成新的计划版本，保留旧版本引用 |
| 允许旧观察产生的动作继续执行 | 校验 `observation_version`，过期则重新规划 |
| 工具超时就自动重复写操作 | 先按 `UNKNOWN` 处理并查询副作用 |
| 步骤状态代替任务状态 | 任务、步骤、动作分层维护 |
| 让动作直接调用 Python 工具函数 | 所有工具动作都经过第二章 Tool Runtime |
| 用模型摘要覆盖原始工具输出 | 保存证据引用，摘要只是展示层内容 |
| 把审批请求当成已批准动作 | 审批动作与实际工具动作分开建模 |

## 十五、课堂练习

### 练习一：补全回合对象

为“定位测试失败原因”设计一个 `Plan`，至少包含三个步骤，并写出每个步骤的依赖关系、预期证据和可能的 `ActionKind`。

### 练习二：判断结果语义

判断以下结果应使用哪一种 `ResultKind`，并说明下一步：

1. `search_code` 返回退出码 0 和匹配文件列表；
2. 只读测试命令明确返回退出码 1；
3. 应用补丁的远程请求超时，服务端没有返回请求 ID；
4. 高风险工具在审批阶段被策略拦截，根本没有发出调用。

参考判断：

- 场景 1 是 `SUCCEEDED`，生成包含结果引用的新观察；
- 场景 2 是 `FAILED`，记录测试失败原因，由 Controller 决定是否重规划；
- 场景 3 是 `UNKNOWN`，禁止直接重发写动作；
- 场景 4 是 `NOT_STARTED`，记录策略或审批结果，不伪装成工具执行失败。

### 练习三：评审一个错误接口

下面的接口同时接受计划和执行结果，请指出至少三处问题并改写其边界：

```python
def run_step(task_id: str, step: dict, result: dict | None = None) -> None:
    step["status"] = "succeeded"
    if result:
        step["output"] = result
```

应至少指出：调用方可以伪造成功；没有动作 ID 绑定；没有计划版本检查；原地修改会覆盖历史；没有表达未知结果。改写后应让 Planner 只提交 `Action`，由 Runtime 生成 `ExecutionResult`，再由 Controller 更新不可变快照。

## 十六、本课小结

本课建立了 Agent 回合的最小事实协议：

```text
Observation(vN)
  -> Plan(plan_id, based_on=vN)
  -> Action(action_id, plan_id)
  -> ExecutionResult(action_id)
  -> Observation(vN+1)
```

计划是提案，观察是事实，动作是待执行意图，执行结果是受控执行器返回的事实。它们通过任务 ID、计划 ID、动作 ID 和观察版本关联，避免模型摘要、旧计划和未知结果混在一起。

下一课会把这些对象写入任务、步骤、消息、工具结果和事件记录，回答“进程退出后，平台如何知道刚才发生了什么”。
