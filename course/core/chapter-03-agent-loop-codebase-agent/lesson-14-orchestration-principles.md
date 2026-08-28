# 第 14 课：理解图编排原理与执行语义

> 章节导航：[第三章：Agent Loop、State、Harness 与 Codebase Agent](./index.md)
>
> 上一课：[第 13 课：实现 Harness 事件、Hook 与生命周期](./lesson-13-harness-events-lifecycle.md)
>
> 下一课：[第 15 课：使用 LangGraph 接入 Agent Harness](./lesson-15-langgraph-harness-integration.md)

## 一、你将完成什么

第 13 课已经把一次 Agent 执行拆成 Run、Step 和 Event，并定义了暂停、
取消、恢复与 Hook 的边界。但当任务包含计划、工具、验证、重规划和人工审批时，
只靠一个不断增长的 `if/elif` 或 `while True` 很难回答以下问题：

1. 当前应该执行哪个阶段，为什么可以到达这个阶段；
2. 节点读取的是已提交事实，还是进程内临时变量；
3. 条件分支由谁决定，能否在恢复时得到相同结果；
4. 循环如何受预算、终止条件和无进展检测约束；
5. 中断后从哪里恢复，哪些节点不能重复执行；
6. 并行分支如何合并，冲突时谁拥有最终解释权。

本课用框架无关的状态图解释这些执行语义。完成后，你应该能够：

- 区分图编排器、Agent Harness、任务状态机和工具运行时的职责；
- 用节点、边、共享状态和路由结果表达一次受控推进；
- 让节点围绕 Harness 边界工作，而不是直接制造外部副作用；
- 设计可验证、可重放的条件边和受预算约束的循环；
- 将 Interrupt 映射为明确的暂停、等待或恢复状态；
- 只在一致边界创建 Checkpoint，并从已提交事实恢复；
- 为并行分支定义写集合、Reducer、冲突和提交规则；
- 用执行轨迹和合同测试证明图不会越权、失控或重复执行。

## 二、本课内容边界

本课只解决一个问题：**如何用状态图表达 Agent Harness 的推进顺序，并为分支、循环、中断、并行和恢复建立明确执行语义。**

本课会讨论：

- 图、节点、边、共享状态和路由结果；
- 节点的输入、输出、失败与提交契约；
- 条件分支、循环、Interrupt 和 Checkpoint；
- 并行分支的隔离、合并与确定性；
- 一个不依赖具体框架的最小执行器；
- 图结构和运行轨迹的合同测试。

本课不会：

- 使用 LangGraph 的 `StateGraph`、`Command`、Checkpointer 等具体 API；
- 实现代码检索、补丁生成、应用补丁或测试业务；
- 把多个 Agent、消息队列或分布式工作流引擎引入当前系统；
- 重新定义第 2 至 13 课已经确定的任务状态、预算、Sandbox、Harness 和事件语义。

第 15 课会把本课的概念映射到 LangGraph，但框架只能承载这些语义，不能替代业务状态、权限和副作用边界。

## 三、为什么使用图，而不是扩大 `while` 循环

简单 Agent Loop 可以写成：

```python
while not task.done:
    proposal = await model.propose(task)
    result = await execute(proposal)
    task = observe(task, result)
```

这段代码隐藏了多个关键事实：

- `task.done` 的依据和版本不清楚；
- 模型提案是否经过 Policy 授权不可见；
- `execute()` 超时后结果是否未知不可见；
- 暂停和恢复只能依赖函数调用栈；
- 失败后回到规划、等待人工还是终止，需要继续堆叠分支；
- 新增验证、重规划和交付阶段时，控制逻辑与业务逻辑会纠缠。

状态图把“可能经过哪些阶段”和“满足什么条件才能迁移”显式化：

```text
START
  -> load_snapshot
  -> decide_next
       ├── propose
       ├── reconcile_action
       ├── wait_for_approval
       └── finalize
  -> authorize
       ├── execute
       ├── interrupt
       └── reject
  -> observe
       ├── verify
       ├── replan
       └── stop
  -> END
```

图的价值不是把函数画成方框，而是让以下内容成为可检查契约：

1. 有限的节点集合；
2. 每个节点允许读取和写入的状态；
3. 每种路由结果对应的合法后继；
4. 循环回边上的预算与收敛条件；
5. Interrupt 和 Checkpoint 的恢复位置；
6. 任意时刻能够解释“为什么执行到这里”。

图描述控制流，任务状态机描述业务生命周期。两者相关，但不是同一个对象。

## 四、四个层次不能混为一谈

| 层次 | 回答的问题 | 典型内容 |
| --- | --- | --- |
| 任务状态机 | 任务现在处于什么业务状态 | running、waiting_approval、completed |
| 图编排器 | 下一段控制流应该去哪里 | 节点调度、条件边、循环、Interrupt |
| Agent Harness | 本次如何安全推进一个 Step | 读取快照、提案、授权、执行、提交 |
| Tool/Sandbox Runtime | 已授权动作如何实际执行 | 调用工具、运行命令、限制资源 |

必须遵守以下边界：

- 图节点不能因为“下一节点是 execute”就绕过 Policy；
- 图结束不等于任务完成，仍要满足任务完成标准；
- 任务处于 `completed` 时，图不能通过一条回边重新激活它；
- Harness 返回 `recovery_required` 时，路由器不能把它改写成普通重试；
- Runtime 只报告动作结果，不能选择图的业务后继；
- Checkpoint 保存图的恢复游标，但不能覆盖 TaskStore 的权威事实。

可以把调用关系约束为：

```text
图编排器选择节点
  -> 节点调用 Harness 用例
  -> Harness 校验任务事实与授权
  -> Harness 调用端口
  -> TaskStore 原子提交结果与事件
  -> 节点返回有限路由结果
  -> 图编排器选择合法后继
```

图编排器是控制流驱动器，不是第二套领域系统。

## 五、图、节点、边和共享状态

### 5.1 图是允许执行路径的声明

一个图至少包含：

- 唯一图版本；
- 起点和终点；
- 节点目录；
- 普通边；
- 条件边；
- 允许形成循环的回边；
- Interrupt 位置；
- Checkpoint 策略；
- 并行分支的合并规则。

图结构应该在运行前完成校验。运行期间不能让模型动态注入任意节点名或下一跳。

### 5.2 节点是一个受控推进单元

节点应接收已验证的图状态，调用一个明确用例，并返回有限结果。它不应同时承担模型提案、工具执行、状态提交和路由判断等全部职责。

一个框架无关的节点契约可以写成：

```python
from dataclasses import dataclass
from enum import StrEnum
from typing import Mapping, Protocol


class Route(StrEnum):
    PROPOSE = "propose"
    AUTHORIZE = "authorize"
    EXECUTE = "execute"
    OBSERVE = "observe"
    VERIFY = "verify"
    REPLAN = "replan"
    WAIT = "wait"
    RECOVER = "recover"
    COMPLETE = "complete"
    FAIL = "fail"


@dataclass(frozen=True)
class NodeResult:
    route: Route
    task_version: int
    checkpoint_required: bool
    updates: Mapping[str, object]
    reason_code: str


class GraphNode(Protocol):
    name: str

    async def run(self, state: "GraphState") -> NodeResult: ...
```

`Route` 使用封闭枚举，而不是模型生成的自由文本。`reason_code` 使用稳定代码，供事件、指标和测试断言；面向用户的说明可以单独生成。

### 5.3 边只表达合法后继

普通边表示节点完成后唯一可达的下一节点：

```text
load_snapshot -> decide_next
```

条件边根据有限路由结果选择后继：

```text
authorize --allowed--> execute
authorize --approval_required--> interrupt
authorize --rejected--> fail_step
```

边不应：

- 调用模型或工具；
- 修改任务状态；
- 隐式扣减预算；
- 查询未声明的外部服务；
- 根据当前时间、随机数或进程内缓存产生不可解释路由。

如果选择后继需要外部查询，应把查询建模成节点，先提交结果，再由条件边读取。

### 5.4 共享状态是图的控制投影

图状态只保存调度下一节点所需的最小控制信息：

```python
from dataclasses import dataclass


@dataclass(frozen=True)
class GraphState:
    graph_version: str
    task_id: str
    run_id: str
    task_version: int
    current_node: str
    last_route: Route | None
    active_step_id: str | None
    active_action_id: str | None
    checkpoint_id: str | None
    iteration: int
    no_progress_count: int
```

它不应复制完整 Prompt、工具输出、代码文件、授权凭证或整份任务记录。
较大的内容应使用 `ArtifactRef`、`EvidenceRef` 或稳定 ID 引用。

更重要的是，`GraphState` 不是任务真相。每个可能产生副作用或完成任务的节点，
都必须重新读取 TaskStore 并检查 `task_version`、租约和 fencing token。

## 六、节点执行语义

### 6.1 节点开始前

执行器在调用节点前至少检查：

1. 当前节点属于本次运行固定的 `graph_version`；
2. 前一节点的 Route 确实允许到达当前节点；
3. Run 没有进入 completed、failed 或 cancelled；
4. Worker 租约与 fencing token 有效；
5. 图状态中的 `task_version` 没有落后于 TaskStore；
6. 当前没有必须先对账的 active Action；
7. 预算和取消信号允许继续。

任一检查失败，都不能“尽量继续”。版本冲突应重新装载事实；租约失效应停止旧 Worker；active Action 未决应路由到恢复节点。

### 6.2 节点运行中

节点分为三类：

| 类型 | 允许行为 | 示例 |
| --- | --- | --- |
| 纯计算节点 | 根据已提交输入计算有限结果 | 路由、完成条件判断、合并验证 |
| 查询节点 | 读取受控系统，不产生业务副作用 | 读取快照、查询 Action 状态 |
| 命令节点 | 通过 Harness 发起并提交受控变化 | 提案、授权、执行、提交观察 |

命令节点必须通过 Harness，不得直接操作数据库、模型客户端、Tool Runtime 或 Sandbox。否则图层会绕过第 12、13 课的授权、事件和生命周期契约。

### 6.3 节点完成后

节点完成不等于函数正常返回。执行器只接受满足以下条件的结果：

- Route 属于节点声明的结果集合；
- 对应任务变化已经提交；
- 返回的 `task_version` 与提交后的版本一致；
- 需要恢复的边界已有 Checkpoint；
- 事件序列中存在节点开始和结果事实；
- 结果未携带不允许写入共享状态的字段。

推荐把节点提交与图游标更新放在同一个一致性协议中。若底层无法跨存储事务，应使用 Outbox、幂等键和恢复对账，而不是假设两次写入总能同时成功。

### 6.4 异常不是隐藏路由

节点抛出的异常应先归一化：

| 异常类别 | 图层结果 |
| --- | --- |
| 输入或不变量错误 | 明确失败，不重试 |
| 乐观锁冲突 | 重新读取快照后重新路由 |
| 临时查询错误 | 在预算内退避重试查询节点 |
| 外部动作结果未知 | `recovery_required` |
| 取消信号 | 到安全边界后 cancelled 或 recovery |
| 编程错误 | 记录失败并停止当前 Run |

不能使用 `except Exception: return "retry"`。这种写法会把副作用未知、权限拒绝和代码缺陷都变成重复执行。

## 七、条件边必须基于已提交事实

条件边看起来只是一个函数，但它决定了系统接下来可能产生什么副作用。因此它必须满足：

- 输入字段有明确来源和 Schema；
- 输出属于有限 Route 集合；
- 对同一份已提交输入返回同一结果；
- 不产生副作用；
- 路由原因可记录、可测试；
- 遇到未知值时拒绝猜测。

例如：

```python
def route_after_advance(outcome: "AdvanceOutcome") -> Route:
    match outcome.kind:
        case "proposal_ready":
            return Route.AUTHORIZE
        case "action_authorized":
            return Route.EXECUTE
        case "progressed":
            return Route.OBSERVE
        case "waiting":
            return Route.WAIT
        case "recovery_required":
            return Route.RECOVER
        case "completed":
            return Route.COMPLETE
        case "failed":
            return Route.FAIL
        case _:
            raise ValueError(f"unsupported outcome: {outcome.kind}")
```

这里没有 `else -> continue`。新增 Harness 结果时，路由函数必须显式处理，否则测试应失败。

### 7.1 不要让模型直接选择节点

模型可以提出 `ActionIntent` 或计划建议，但不能返回
`"next_node": "execute_shell"` 并直接控制图。平台应先校验提案，
再将领域结果映射为有限 Route。

正确链路是：

```text
模型输出 ActionIntent
  -> Harness 校验结构与任务范围
  -> Policy 返回 allow / approval / reject
  -> 提交领域事实
  -> 纯路由函数映射到后继节点
```

### 7.2 路由读取版本化事实

路由输入应包含 `task_version` 或等价版本。若另一个 Worker 已推进任务，旧路由结果必须失效，不能继续执行原后继。

例如，旧 Worker 在 `authorize -> execute` 之间暂停，新 Worker 已处理取消请求。
旧 Worker 恢复后必须重新读取状态，不能仅凭内存中的 `Route.EXECUTE`
调用工具。

## 八、循环不是无限自主

图允许回边：

```text
observe -> propose
verify -> replan
replan -> propose
```

但每条回边都必须有守卫。至少检查：

- 最大图步数；
- 最大模型回合；
- 工具和 Sandbox 调用预算；
- Token、成本与总时间预算；
- 取消和暂停请求；
- 重复 Action 或重复证据；
- `no_progress_count`；
- 计划修订次数；
- 完成条件和失败条件。

可以把循环判断写成纯函数：

```python
def decide_loop(snapshot: "TaskSnapshot") -> Route:
    if snapshot.cancellation_requested:
        return Route.WAIT
    if snapshot.completion_satisfied:
        return Route.COMPLETE
    if snapshot.budget.exhausted:
        return Route.FAIL
    if snapshot.no_progress_count >= 3:
        return Route.FAIL
    if snapshot.needs_replan:
        return Route.REPLAN
    return Route.PROPOSE
```

实际系统还应返回稳定的 `reason_code`，例如 `budget_exhausted`、
`no_progress` 或 `completion_satisfied`。同一个 Route 可能有不同原因，
运维和人工接管需要区分。

### 8.1 一次图步和一个业务 Step 不一定相同

一个业务 Step 可能经过多个图节点：

```text
propose -> authorize -> execute -> observe -> commit_step
```

也可能一个图节点只调用一次 `Harness.advance()`，由 Harness 在内部完成一个安全推进边界。选择哪种粒度取决于需要观察和中断的位置，但必须满足：

1. 外部 Action 有唯一身份；
2. Checkpoint 不落在无法解释的半状态；
3. 节点重试不会重复副作用；
4. 图结构不复制 Harness 内部已经稳定的状态机。

本课程推荐“粗粒度控制节点 + Harness 细粒度领域边界”。图负责选择提案、恢复、等待或结束等阶段，Harness 负责一个 Step 内的授权和一致提交。

### 8.2 循环退出要区分结束原因

图停止至少要区分：

- 任务完成；
- 明确失败；
- 用户取消；
- 等待审批或外部事件；
- 预算耗尽；
- 无进展；
- 恢复所需；
- 编排器故障。

这些状态不能都映射为 `END` 后再让调用者猜测。`END` 只是“本次图运行不再调度节点”，不是统一业务结论。

## 九、Interrupt 的真实含义

Interrupt 表示图在一致边界停止自动推进，并把继续执行所需条件持久化。它不是线程休眠，也不是在内存里等待用户输入。

常见 Interrupt 原因包括：

- 等待人工审批；
- 等待用户补充必要输入；
- 等待外部回调；
- 风险策略要求人工确认；
- 预算或冲突需要人工接管；
- 未知外部结果需要恢复操作。

### 9.1 Interrupt 必须映射到领域状态

| 场景 | Run/Step 状态 | 恢复前置条件 |
| --- | --- | --- |
| 等待审批 | paused 或 waiting | 有效审批决定已提交 |
| 等待用户输入 | paused 或 waiting | 输入通过 Schema 和权限校验 |
| 等待外部回调 | waiting | 回调身份、版本和签名有效 |
| 外部结果未知 | recovery_required / unknown | 查询、对账或人工确认完成 |
| 用户请求取消 | cancelling | 未决 Action 已确认状态 |

不能把所有 Interrupt 都写成 `paused`。特别是外部结果未知时，系统缺少的是事实，不是简单的“继续”按钮。

### 9.2 Interrupt 前的提交顺序

正确顺序是：

```text
创建等待对象或恢复项
  -> 提交任务、Step 和 Run 状态
  -> 追加 interruption_requested / run_paused 等事件
  -> 创建 Checkpoint
  -> 释放 Worker 租约
  -> 向调用方返回等待句柄
```

若先向用户显示“等待审批”，再提交等待对象，用户可能操作一个不存在或尚未生效的审批项。

### 9.3 恢复不是跳过中断节点

恢复请求至少携带：

- `task_id`、`run_id` 和 `checkpoint_id`；
- 中断原因与等待对象 ID；
- 恢复命令的幂等键；
- 用户或系统主体身份；
- 期望的任务版本；
- 审批、输入或回调的受控 payload。

恢复器先验证这些事实，再重新计算后继。它不能接受调用方直接指定 `resume_at="execute"`。

审批可能在等待期间过期，任务范围可能被修改，Sandbox generation 也可能变化。
因此恢复时必须重新校验 Policy 和运行环境，不能把旧 Checkpoint 当作永久授权。

## 十、Checkpoint 保存什么

图 Checkpoint 的目标是恢复控制游标，而不是复制整套业务数据库。最小结构可以包含：

```python
from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True)
class GraphCheckpoint:
    checkpoint_id: str
    graph_version: str
    task_id: str
    run_id: str
    task_version: int
    event_sequence: int
    next_node: str
    last_route: str
    active_step_id: str | None
    active_action_id: str | None
    iteration: int
    state_hash: str
    created_at: datetime
```

它应与第 6 课的任务 Checkpoint 对齐：

- `task_version` 证明图游标对应哪一版业务事实；
- `event_sequence` 用于检查事件缺口；
- `graph_version` 固定恢复时使用的图定义；
- `active_action_id` 阻止恢复时盲目重复派发；
- `state_hash` 检查关键游标是否被篡改或损坏。

### 10.1 适合创建 Checkpoint 的位置

- 节点结果和任务状态已原子提交后；
- 进入等待审批、暂停或恢复所需状态后；
- 外部 Action 身份和幂等键已经持久化后；
- 外部 Action 结果已对账并提交后；
- 并行分支全部完成且合并结果已提交后。

### 10.2 不适合创建 Checkpoint 的位置

- 模型流式输出到一半；
- Action 尚未持久化但请求即将发出；
- 工具已经派发但本地仍把状态写成“未开始”；
- 并行分支只完成一部分却保存为全部完成；
- 任务提交成功但图游标指向旧版本；
- 节点持有只能在当前进程使用的客户端或对象引用。

### 10.3 图升级与旧 Checkpoint

运行中的任务应固定 `graph_version`。发布新图后，不能让旧 Checkpoint 自动落到同名但语义已经变化的节点。

可选择：

1. 让旧 Run 继续使用旧图版本；
2. 编写显式迁移，将旧节点、状态 Schema 和 Route 映射到新版本；
3. 无法安全迁移时进入人工恢复。

不能只修改节点名称或边，然后假设所有暂停任务都能继续。

## 十一、并行分支与合并语义

图中的并行不是把两个协程同时启动就结束了。并行分支必须先证明：

- 分支之间没有未声明的副作用冲突；
- 每个分支拥有独立 `step_id`、`action_id` 和幂等键；
- 写入字段集合可合并；
- 预算能够原子预留；
- 任一分支失败、取消或未知时有明确策略；
- 合并节点能识别重复和迟到结果。

例如，只读检索可以并行：

```text
             ┌-> search_tests ----┐
explore_code ┤                     ├-> merge_evidence
             └-> search_config ---┘
```

但两个同时修改同一工作区的分支通常不应并行：

```text
apply_patch_a -X- apply_patch_b
```

除非系统使用隔离 Worktree、独立基线和显式三方合并，否则“最后写入者获胜”会破坏证据和可恢复性。

### 11.1 Reducer 必须满足明确代数性质

多个分支写入同一共享字段时，需要 Reducer。对证据引用集合，可使用去重并集：

```python
def merge_evidence(
    left: tuple[str, ...],
    right: tuple[str, ...],
) -> tuple[str, ...]:
    return tuple(sorted(set(left) | set(right)))
```

为了让重试和不同完成顺序得到相同结果，Reducer 最好满足：

- 结合律：分组方式不改变结果；
- 交换律：分支完成顺序不改变结果；
- 幂等性：同一分支结果重复投递不改变结果。

并非所有字段都能使用 Reducer。`active_action_id`、任务状态、预算余额和工作区版本需要所有权或事务约束，不能简单拼接。

### 11.2 Join 是一致性屏障

合并节点在以下条件满足前不能继续：

1. 所有必需分支都有终态结果；
2. 每个结果属于当前 fan-out 版本；
3. 没有未决或 unknown Action；
4. 重复结果已按分支幂等键去重；
5. 合并后的任务版本已成功提交；
6. 失败策略允许继续。

可选分支、首个成功和全部成功是不同 Join 策略，必须在图定义中声明，不能由完成时序决定。

### 11.3 并行失败策略

| 策略 | 适用场景 | 注意事项 |
| --- | --- | --- |
| all_success | 所有证据都必需 | 任一失败则停止合并 |
| best_effort | 可选只读数据源 | 保留失败证据，不能伪装完整 |
| first_success | 等价冗余查询 | 取消其他分支时确认无副作用 |
| quorum | 多来源确认 | 明确定义数量、版本与冲突规则 |

如果任一分支产生未知副作用，整个 Join 不能把任务标记为成功。必须先恢复或人工处理。

## 十二、一个框架无关的最小执行器

下面的伪代码用于展示执行语义，不是生产级工作流引擎：

```python
class GraphExecutor:
    async def run_until_boundary(
        self,
        checkpoint: GraphCheckpoint,
    ) -> "GraphRunResult":
        state = await self.restore_and_validate(checkpoint)

        while True:
            snapshot = await self.task_store.get_snapshot(state.task_id)
            self.ensure_versions_match(state, snapshot)
            self.ensure_run_can_advance(snapshot)

            if snapshot.cancellation_requested:
                return await self.harness.cancel_at_boundary(snapshot)

            node = self.graph.node(state.current_node)
            self.graph.ensure_reachable(
                previous_route=state.last_route,
                current_node=node.name,
            )

            started = await self.events.node_started(
                state=state,
                expected_sequence=snapshot.event_sequence,
            )

            try:
                result = await node.run(state)
            except VersionConflict:
                state = await self.reload_and_route(state.task_id)
                continue
            except ExternalResultUnknown as error:
                return await self.harness.require_recovery(
                    snapshot=snapshot,
                    reason_code=error.code,
                )

            self.graph.validate_result(node.name, result)
            next_node = self.graph.next_node(node.name, result.route)
            committed = await self.commit_node_result(
                state=state,
                started_event=started,
                result=result,
                next_node=next_node,
            )

            if result.route in {
                Route.WAIT,
                Route.RECOVER,
                Route.COMPLETE,
                Route.FAIL,
            }:
                return self.to_run_result(committed)

            state = committed.state
```

实现时还需要补齐：

- Worker 租约、fencing token 和心跳；
- 节点与 Run 的取消令牌；
- 预算预留和结算；
- Interrupt 等待对象；
- Checkpoint 与事件的事务或 Outbox；
- 并行分支调度与 Join；
- 节点超时、重试策略和退避；
- 图版本迁移。

最重要的不是循环代码，而是 `restore_and_validate()`、`validate_result()`
和 `commit_node_result()` 的不变量。

## 十三、执行轨迹与可观测性

图结构说明“可能怎么走”，执行轨迹说明“这次为什么这样走”。至少记录：

- `graph_version`、`node_name` 和节点尝试次数；
- 节点开始、完成、失败和耗时；
- 输入 `task_version` 与输出 `task_version`；
- Route 与 `reason_code`；
- 前驱节点和后继节点；
- Interrupt 原因、等待对象和 Checkpoint；
- 循环次数、无进展计数和预算变化；
- fan-out 身份、分支身份和 Join 结果；
- task_id、run_id、step_id、action_id 与 event_id。

建议的事件类型包括：

```text
graph_run_started
node_started
node_completed
node_failed
route_selected
loop_guard_triggered
graph_interrupted
graph_resumed
branch_started
branch_completed
join_completed
graph_run_stopped
```

这些编排事件不能代替第 13 课的领域事件。`node_completed` 不等于
`action_completed`，`graph_run_stopped` 也不等于 `run_completed`。

### 13.1 重放只重建轨迹

图重放可以：

- 还原节点访问顺序；
- 解释每次路由原因；
- 重建 Timeline；
- 计算节点耗时和循环次数；
- 检查轨迹是否符合图版本。

图重放不能：

- 再次运行节点；
- 再次调用 Harness、模型或工具；
- 重新消费审批；
- 以当前图定义解释旧版本轨迹；
- 用重放结果覆盖当前任务状态。

## 十四、测试图的结构和执行语义

图测试至少分为三层。

### 14.1 结构测试

无需运行模型或工具，直接检查图定义：

```python
def test_graph_has_no_unreachable_nodes() -> None:
    graph = build_graph()
    assert graph.unreachable_nodes() == set()


def test_every_cycle_has_a_guard() -> None:
    graph = build_graph()
    assert graph.cycles_without_guard() == []


def test_execute_is_only_reached_after_authorize() -> None:
    graph = build_graph()
    assert graph.all_paths("START", "execute").contain("authorize")
```

还应检查：

- 每个 Route 都有后继；
- 终止节点没有外出边；
- Interrupt 节点配置了 Checkpoint；
- 恢复节点不能直接进入写操作；
- 图版本和状态 Schema 版本存在；
- 并行写冲突在构建阶段被拒绝。

### 14.2 节点合同测试

使用 Fake Harness 验证节点：

```python
async def test_authorize_node_never_executes_tool() -> None:
    harness = FakeHarness(authorization="allowed")
    result = await AuthorizeNode(harness).run(make_state())

    assert result.route == Route.EXECUTE
    assert harness.authorize_calls == 1
    assert harness.execute_calls == 0


async def test_unknown_action_routes_to_recovery() -> None:
    harness = FakeHarness(active_action="unknown")
    result = await ReconcileNode(harness).run(make_state())

    assert result.route == Route.RECOVER
    assert harness.execute_calls == 0
```

节点测试不仅断言返回值，还要断言禁止发生的调用。

### 14.3 轨迹测试

对固定 Fake 结果执行整张图，检查完整路径：

| 场景 | 期望轨迹 |
| --- | --- |
| 正常完成 | load -> propose -> authorize -> execute -> verify -> complete |
| 等待审批 | load -> propose -> authorize -> interrupt |
| 审批后恢复 | resume -> revalidate -> execute |
| 工具结果未知 | execute -> recover，不得再次 execute |
| 验证失败后重规划 | verify -> replan -> propose |
| 预算耗尽 | loop_guard -> fail |
| 取消发生在派发后 | cancel_boundary -> recover 或 cancelled |
| 并行只读检索 | fan_out -> branches -> join -> observe |

### 14.4 属性测试与故障注入

可以生成不同 Route 序列，验证以下不变量：

- 未授权 Action 永远不能到达执行节点；
- 终态任务永远不能重新进入运行节点；
- 相同幂等键最多产生一次可见副作用；
- 任意循环都在有限预算内退出或 Interrupt；
- 恢复后不会跳过 active Action 对账；
- Reducer 对重复、乱序分支结果保持稳定；
- 任意节点崩溃后，都能从最近一致 Checkpoint 得到明确决策。

故障注入应覆盖节点提交前、任务提交后但图游标提交前、Action 派发后、Join 部分完成时和 Interrupt 创建过程中。

## 十五、与第 13、15 课的衔接

第 13 课提供图节点必须遵守的运行时事实：

| 第 13 课契约 | 本课中的使用方式 |
| --- | --- |
| Run | 一次图运行必须绑定一个明确 Run |
| Step | 节点围绕可恢复 Step 推进，不制造匿名动作 |
| Event | 节点路由读取已提交事实，并追加编排事件 |
| Hook | 仍由 Harness 调度，图节点不能用 Hook 代替边 |
| pause/cancel | 映射为 Interrupt 或停止结果 |
| recovery_required | 必须进入恢复节点，不能映射为普通循环 |
| Checkpoint | 图游标与任务版本、事件序列保持一致 |

第 15 课接入 LangGraph 时，需要验证：

1. 框架 State 只是 `GraphState` 的承载形式；
2. Node 只调用 Harness 用例；
3. Conditional Edge 只映射有限 Route；
4. Checkpointer 不取代 TaskStore；
5. Interrupt 不取代审批和恢复领域对象；
6. Reducer 不合并不可交换的业务字段；
7. 框架重试不会重复外部 Action；
8. Callback 不能绕过第 13 课的 EventStore 和 Hook 契约。

如果某个框架要求牺牲这些边界，应该编写 Adapter 或减少使用范围，而不是让业务语义迁就框架默认行为。

## 十六、常见错误

### 16.1 把图状态当作唯一数据库

框架 Checkpoint 可能保存一份 State，但任务、Action、授权、预算和结果仍要由 TaskStore 以领域约束管理。只恢复图 State 会丢失版本和副作用真相。

### 16.2 一个节点完成所有事情

将提案、授权、执行、观察和完成判断塞进 `agent_node`，只是把原来的 `while True` 搬进方框，无法独立中断、测试和恢复。

### 16.3 让模型返回任意下一节点

模型输出不可信，也不了解最新任务版本和授权。它可以提出意图，平台必须将已校验结果映射到有限 Route。

### 16.4 条件边查询外部系统

这会让路由不可重放，并隐藏失败和延迟。把查询建模成节点，提交查询结果后再路由。

### 16.5 所有异常都回到上一节点

权限拒绝、确定失败和外部结果未知具有不同语义。无条件回退会重复工具调用，甚至重复写入。

### 16.6 Interrupt 只保存节点名称

只有 `current_node="approval"` 不足以恢复。还需要等待对象、任务版本、审批身份、Checkpoint 和恢复幂等键。

### 16.7 用列表追加合并并行结果

分支重试会产生重复元素，完成顺序也会改变结果。应使用满足幂等性和顺序无关性的 Reducer，或显式拒绝自动合并。

### 16.8 图结束就把任务标记完成

图可能因为等待、预算、取消或恢复所需而停止。只有完成标准验证通过且任务状态迁移成功，才能写 `completed`。

### 16.9 发布新图后直接恢复旧任务

同名节点不代表相同语义。运行中的任务应固定图版本，升级需要显式迁移。

## 十七、课堂练习

1. 为“提出代码检索动作 -> 授权 -> 并行读取测试与配置 -> 合并证据 -> 决定继续或结束”画出状态图，标出普通边、条件边、Join 和循环守卫。
2. 设计一个 `RouteDecision` 类型，使每次路由都包含稳定原因、任务版本和允许后继；说明为什么不能只返回字符串。
3. 为等待审批的 Interrupt 设计 Checkpoint 和恢复命令，列出恢复时必须重新校验的字段。
4. 假设工具调用已经派发，但 Worker 在保存结果前崩溃。写出恢复轨迹，并指出图中哪些路径必须禁止。
5. 为并行检索的 `EvidenceRef` 设计 Reducer，用测试证明它满足结合律、交换律和幂等性。
6. 给 `verify -> replan -> propose` 循环增加预算、无进展和取消守卫，并设计三条必然终止的测试。
7. 评审一个把完整 Prompt、工具输出、数据库连接和用户 Token 都放进 Graph State 的实现，说明每个字段应该移到哪里。

## 十八、完成标准

完成本课后，你应该能够：

- 用状态图表达 Harness 的可达阶段，而不是用无限循环隐藏控制流；
- 区分任务状态机、图编排器、Harness 与 Tool/Sandbox Runtime；
- 定义输入、输出、写集合、失败和提交边界清晰的节点；
- 让条件边只读取已提交、版本化事实并返回有限 Route；
- 为每条循环回边配置预算、取消、完成和无进展守卫；
- 将 Interrupt 映射为 paused、waiting 或 recovery_required；
- 创建与任务版本、事件序列和图版本一致的 Checkpoint；
- 从 Checkpoint 恢复时先对账 active Action，不重复派发；
- 为并行分支设计独立身份、预算、Reducer 和 Join 屏障；
- 通过结构、节点、轨迹和故障注入测试证明关键不变量；
- 在第 15 课接入 LangGraph 时保留框架无关的领域语义。

## 十九、本课小结

图编排的核心不是节点数量，而是可解释的执行语义。图声明允许经过哪些阶段，
节点在受控边界调用 Harness，条件边根据已提交事实选择有限后继，
循环受预算和收敛规则限制，Interrupt 在一致边界停止推进，
Checkpoint 保存可验证的恢复游标。

图状态只是控制投影，不能取代 TaskStore；图节点也不能越过 Harness 直接调用模型、工具或 Sandbox。外部结果未知必须进入恢复，旧版本路由必须失效，图结束也不能自动等同于任务完成。

并行分支只有在副作用隔离、身份独立、预算明确且结果可安全合并时才成立。Reducer 应尽量满足结合律、交换律和幂等性，Join 则承担一致性屏障，不能让未决或未知分支悄悄通过。

下一课将使用 LangGraph 承载这些原则，把共享状态、节点、条件边、Interrupt 和 Checkpoint 接入现有 Agent Harness，同时保持任务状态、权限、事件和副作用边界独立于框架。
