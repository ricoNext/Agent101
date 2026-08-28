# 第 15 课：使用 LangGraph 接入 Agent Harness

> 章节导航：[第三章：Agent Loop、State、Harness 与 Codebase Agent](./index.md)
>
> 上一课：[第 14 课：理解图编排原理与执行语义](./lesson-14-orchestration-principles.md)
>
> 下一课：[第 16 课：实现代码库探索与证据收集](./lesson-16-codebase-exploration-evidence.md)

## 一、你将完成什么

第 14 课已经定义了框架无关的图执行语义。本课不再重新发明图执行器，
而是使用 LangGraph 承载节点调度、条件边、Interrupt 和 Checkpoint。

接入框架并不意味着把任务状态、工具权限和恢复判断交给框架。
本课始终保持下面的调用方向：

```text
LangGraph 选择控制节点
  -> 节点调用 Agent Harness
  -> Harness 读取 TaskStore 权威快照
  -> Harness 完成授权、执行、提交和事件追加
  -> 节点返回最小图状态更新
  -> LangGraph 选择下一节点或停止
```

完成本课后，你应该能够：

- 使用 `StateGraph` 声明 Agent Harness 的控制图；
- 区分 State、Runtime Context、TaskStore 和 Checkpointer；
- 将 Harness 结果映射为有限条件边；
- 编写只接受已授权 Action 的 Tool Node；
- 使用 `interrupt()` 和 `Command(resume=...)` 实现人工等待；
- 使用稳定 `thread_id` 保存和恢复图线程；
- 理解节点重放、Pending Write 和 Checkpoint 的副作用风险；
- 让 LangGraph Callback 与第 13 课事件体系保持分离；
- 使用 Fake Harness 测试路由、中断、恢复和禁止行为；
- 在替换 LangGraph 时保留核心业务语义。

## 二、本课内容边界

本课只完成一个工程增量：
**用 LangGraph 适配第 12、13 课的 Agent Harness。**

本课会实现：

- 最小 LangGraph 依赖与 Composition Root；
- 图 State 与运行时 Context；
- Harness Node、条件边和循环；
- 受控 Tool Node；
- Interrupt、恢复命令和 Checkpointer；
- 图状态检查、流式事件和合同测试。

本课不会实现：

- 第 16 至 19 课的代码检索、补丁和验证业务；
- 以 `MessagesState` 取代任务状态模型；
- 让模型生成任意节点名称；
- 将裸工具函数直接注册给模型执行；
- LangGraph Platform、LangSmith 或分布式部署教程；
- 多 Agent、子图和跨服务工作流。

本课示例使用当前 LangGraph Python Graph API。
具体依赖版本应由项目锁文件固定，并在升级时运行本课的合同测试。

## 三、先确定框架与业务的边界

### 3.1 LangGraph 负责什么

LangGraph 在本项目中负责：

- 根据图定义调度节点；
- 在 Super-step 边界合并 State Update；
- 根据条件边选择下一节点；
- 保存图线程 Checkpoint；
- 暂停并恢复 Interrupt；
- 提供状态检查、流式输出和框架级错误信息。

### 3.2 LangGraph 不负责什么

LangGraph 不负责：

- 判断用户是否有权调用某项能力；
- 生成 `ExecutionGrant`；
- 决定工具超时是否可以重试；
- 管理任务预算和完成标准；
- 判定外部副作用是否发生；
- 维护 Task、Run、Step、Action 的权威状态；
- 代替第 13 课的 EventStore 和 Hook；
- 把图执行结束解释为任务完成。

因此，框架 Checkpoint 与 TaskStore 必须同时存在：

| 存储 | 保存内容 | 权威范围 |
| --- | --- | --- |
| TaskStore | Task、Run、Step、Action、预算、授权和结果 | 业务事实 |
| EventStore | 已提交领域事件和编排事件 | 审计事实 |
| Checkpointer | 图 State、下一节点、任务与中断信息 | 图线程恢复 |
| Artifact Store | 大模型输出、命令输出、证据和交付物 | 大对象内容 |

如果 Checkpointer 显示下一节点是 `execute`，
但 TaskStore 显示任务已经取消，必须服从 TaskStore。

## 四、安装与目录边界

最小依赖是 `langgraph`。本地教学可以使用内存 Checkpointer；
生产环境还要选择与现有数据库一致的持久化实现。

```bash
python -m pip install -U langgraph
```

若生产环境使用 PostgreSQL，可安装对应 Checkpoint 包：

```bash
python -m pip install -U langgraph-checkpoint-postgres
```

项目应将依赖加入正式依赖文件并锁定版本。
不要让课堂命令成为唯一的依赖记录。

建议把框架代码放在 Adapter 层：

```text
apps/api/app/agents/
├── domain/
│   ├── models.py
│   └── transitions.py
├── harness/
│   ├── ports.py
│   ├── service.py
│   └── results.py
├── orchestration/
│   ├── state.py
│   ├── context.py
│   ├── nodes.py
│   ├── routing.py
│   ├── graph.py
│   └── service.py
└── adapters/
    └── langgraph/
        ├── checkpointer.py
        └── observability.py
```

领域层和 Harness 层不能导入 `langgraph`。
只有 `orchestration` 和框架 Adapter 知道 LangGraph 类型。

## 五、State 只保存最小控制投影

### 5.1 不要从 `MessagesState` 开始

`MessagesState` 适合以消息历史为主要状态的对话 Agent，
但本章已经建立了 Task、Step、Action 和 Checkpoint。

若直接把消息列表当作唯一状态，会失去：

- 任务版本和 fencing token；
- active Action 与幂等键；
- 预算、审批和恢复状态；
- 工作区与 Sandbox generation；
- 完成标准和证据引用。

本课定义自己的 State，只保存图路由需要的字段：

```python
from typing import Annotated, NotRequired, TypedDict


def merge_refs(
    left: list[str],
    right: list[str],
) -> list[str]:
    return sorted(set(left) | set(right))


class AgentGraphState(TypedDict):
    task_id: str
    run_id: str
    task_version: int
    graph_version: str
    route: str
    reason_code: str
    iteration: int
    evidence_refs: Annotated[list[str], merge_refs]
    action_id: NotRequired[str | None]
    waiting_ref: NotRequired[str | None]
    checkpoint_id: NotRequired[str | None]
```

`Annotated` 上的 `merge_refs` 是 Reducer。
它只适用于可以交换、去重合并的证据引用。

以下字段不能用简单 Reducer 合并：

- `task_version`；
- `action_id`；
- 预算余额；
- 任务状态；
- workspace generation；
- fencing token。

这些字段存在并发写入时，应由 TaskStore 的事务和版本控制解决。

### 5.2 State 中只放稳定、可序列化的数据

允许放入 State：

- 字符串、数字、布尔值和有限枚举值；
- 稳定 ID；
- 小型 JSON 结构；
- Artifact 或 Evidence 引用；
- 与 TaskStore 对齐的版本号。

不要放入 State：

- 数据库 Session；
- Harness、模型客户端或 HTTP Client；
- Exception 对象；
- 文件句柄和异步任务；
- 完整 Prompt 和大型工具输出；
- API Key、Cookie、Token 或宿主绝对路径；
- 可执行函数和类实例。

Checkpointer 会序列化 State。
把运行时对象塞进去，会造成序列化失败、连接泄漏或敏感信息落盘。

## 六、使用 Runtime Context 注入依赖

LangGraph 的 `context_schema` 用来描述一次调用所需的运行时依赖。
这些依赖会传给节点，但不会成为图 State 的业务字段。

先定义一个面向图层的 Harness Adapter：

```python
from dataclasses import dataclass
from typing import Protocol


class GraphHarnessAdapter(Protocol):
    async def inspect(
        self,
        *,
        task_id: str,
        run_id: str,
    ) -> "GraphView": ...

    async def advance(
        self,
        *,
        task_id: str,
        run_id: str,
        expected_version: int,
    ) -> "AdvanceResult": ...

    async def reconcile(
        self,
        *,
        task_id: str,
        run_id: str,
        action_id: str,
        expected_version: int,
    ) -> "AdvanceResult": ...

    async def execute_authorized(
        self,
        *,
        task_id: str,
        run_id: str,
        action_id: str,
        expected_version: int,
    ) -> "AdvanceResult": ...

    async def resume_waiting(
        self,
        *,
        task_id: str,
        run_id: str,
        waiting_ref: str,
        resume_value: object,
        idempotency_key: str,
    ) -> "AdvanceResult": ...


class GraphThreadStore(Protocol):
    async def get_or_create(
        self,
        *,
        tenant_id: str,
        task_id: str,
        run_id: str,
    ) -> str: ...

    async def require_access(
        self,
        *,
        tenant_id: str,
        task_id: str,
        run_id: str,
        actor_id: str,
    ) -> str: ...


@dataclass(frozen=True)
class GraphRuntimeContext:
    harness: GraphHarnessAdapter
    tenant_id: str
    correlation_id: str
    actor_id: str
```

这里的 Adapter 不复制 Harness 业务逻辑。
它只把第 12、13 课的结果转换成图层需要的稳定结构。

创建 StateGraph 时声明 Context：

```python
from langgraph.graph import StateGraph


builder = StateGraph(
    AgentGraphState,
    context_schema=GraphRuntimeContext,
)
```

调用时再传入依赖：

```python
result = await graph.ainvoke(
    initial_state,
    config,
    context=GraphRuntimeContext(
        harness=harness_adapter,
        tenant_id=tenant_id,
        correlation_id=correlation_id,
        actor_id=actor_id,
    ),
)
```

这比全局 Service Locator 更容易测试，
也避免把不可序列化服务写进 Checkpoint。

## 七、把 Harness 包成节点

### 7.1 装载节点只建立控制投影

节点可以通过 `Runtime` 读取 Context：

```python
from langgraph.runtime import Runtime


async def load_snapshot(
    state: AgentGraphState,
    runtime: Runtime[GraphRuntimeContext],
) -> dict[str, object]:
    view = await runtime.context.harness.inspect(
        task_id=state["task_id"],
        run_id=state["run_id"],
    )
    return {
        "task_version": view.task_version,
        "route": view.route,
        "reason_code": view.reason_code,
        "action_id": view.action_id,
        "waiting_ref": view.waiting_ref,
        "checkpoint_id": view.checkpoint_id,
    }
```

它返回 State Update，而不是修改传入的 `state`。
LangGraph 会在 Super-step 边界应用更新。

### 7.2 推进节点只调用一次安全边界

```python
async def advance_harness(
    state: AgentGraphState,
    runtime: Runtime[GraphRuntimeContext],
) -> dict[str, object]:
    result = await runtime.context.harness.advance(
        task_id=state["task_id"],
        run_id=state["run_id"],
        expected_version=state["task_version"],
    )
    return {
        "task_version": result.task_version,
        "route": result.kind.value,
        "reason_code": result.reason_code,
        "action_id": result.action_id,
        "waiting_ref": result.waiting_ref,
        "checkpoint_id": result.checkpoint_id,
        "iteration": state["iteration"] + 1,
    }
```

本节点不直接调用模型、Tool Runtime 或 Sandbox。
这些调用仍由 Harness 依照授权、预算和生命周期执行。

一次节点执行只调用一次 `advance()`。
不要在节点内部写第二个 `while True`。

### 7.3 恢复节点先对账 active Action

```python
async def reconcile_action(
    state: AgentGraphState,
    runtime: Runtime[GraphRuntimeContext],
) -> dict[str, object]:
    action_id = state.get("action_id")
    if not action_id:
        raise ValueError("recovery route requires action_id")

    result = await runtime.context.harness.reconcile(
        task_id=state["task_id"],
        run_id=state["run_id"],
        action_id=action_id,
        expected_version=state["task_version"],
    )
    return {
        "task_version": result.task_version,
        "route": result.kind.value,
        "reason_code": result.reason_code,
        "action_id": result.action_id,
        "waiting_ref": result.waiting_ref,
    }
```

`reconcile()` 只能查询、确认或创建人工恢复项。
它不能在查询不到结果时偷偷再次调用工具。

## 八、条件边只映射有限结果

路由函数保持同步、纯函数和封闭输出：

```python
from typing import Literal


NextNode = Literal[
    "advance",
    "interrupt",
    "reconcile",
    "stop",
]


def route_from_snapshot(state: AgentGraphState) -> NextNode:
    route = state["route"]
    if route == "runnable":
        return "advance"
    if route == "waiting":
        return "interrupt"
    if route == "recovery_required":
        return "reconcile"
    if route == "terminal":
        return "stop"
    raise ValueError(f"unsupported snapshot route: {route}")


def route_after_advance(state: AgentGraphState) -> NextNode:
    route = state["route"]
    if route == "progressed":
        return "advance"
    if route == "waiting":
        return "interrupt"
    if route == "recovery_required":
        return "reconcile"
    if route == "terminal":
        return "stop"
    raise ValueError(f"unsupported advance route: {route}")
```

这里没有默认的“继续”路径。
Harness 新增结果类型后，路由测试会立即失败，迫使开发者补充语义。

需要注意：

- 条件边不能查询数据库；
- 条件边不能调用模型；
- 条件边不能生成审批；
- 条件边不能更新预算；
- 条件边不能根据随机数选择后继；
- 条件边不能信任模型提供的节点名。

## 九、声明并编译 StateGraph

下面把节点和边组装起来：

```python
from langgraph.graph import END, START, StateGraph


def build_agent_graph() -> StateGraph:
    builder = StateGraph(
        AgentGraphState,
        context_schema=GraphRuntimeContext,
    )

    builder.add_node("load", load_snapshot)
    builder.add_node("advance", advance_harness)
    builder.add_node("interrupt", interrupt_for_input)
    builder.add_node("reconcile", reconcile_action)

    builder.add_edge(START, "load")
    builder.add_conditional_edges(
        "load",
        route_from_snapshot,
        {
            "advance": "advance",
            "interrupt": "interrupt",
            "reconcile": "reconcile",
            "stop": END,
        },
    )
    builder.add_conditional_edges(
        "advance",
        route_after_advance,
        {
            "advance": "load",
            "interrupt": "interrupt",
            "reconcile": "reconcile",
            "stop": END,
        },
    )
    builder.add_edge("reconcile", "load")
    builder.add_edge("interrupt", "load")
    return builder
```

图中的循环是 `advance -> load -> advance`。
但真正的步数、时间、Token、成本和无进展限制仍由 Harness 检查。

LangGraph 的 recursion limit 可以作为最后一道框架保护，
不能代替第 8 课的领域预算。

调用配置示例：

```python
config = {
    "configurable": {
        "thread_id": graph_thread_id,
    },
    "recursion_limit": 100,
}
```

`100` 只是示例。
生产值应大于合法任务的最大图步数，同时有监控和压测依据。

## 十、Tool Node 必须接在授权之后

LangGraph 提供预构建的 `ToolNode`，
它适合执行模型消息中的 Tool Call。

但在本章架构中，如果直接把文件、Shell 或发布工具交给 `ToolNode`，
会绕过：

- `ActionIntent` 校验；
- Policy 和 `ExecutionGrant`；
- 预算预留；
- Action 身份和幂等键；
- Sandbox generation；
- 结果未知与恢复语义；
- TaskStore 原子提交。

因此，本项目默认不让预构建 `ToolNode`
直接执行裸业务工具。

### 10.1 自定义受控 Tool Node

如果希望在图上单独显示工具阶段，
节点只能接受已经持久化的 `action_id`：

```python
async def execute_authorized_action(
    state: AgentGraphState,
    runtime: Runtime[GraphRuntimeContext],
) -> dict[str, object]:
    action_id = state.get("action_id")
    if not action_id:
        raise ValueError("authorized action_id is required")

    result = await runtime.context.harness.execute_authorized(
        task_id=state["task_id"],
        run_id=state["run_id"],
        action_id=action_id,
        expected_version=state["task_version"],
    )
    return {
        "task_version": result.task_version,
        "route": result.kind.value,
        "reason_code": result.reason_code,
        "action_id": result.action_id,
    }
```

注意，`execute_authorized()` 的输入中没有：

- 任意工具名；
- 模型原始参数；
- Shell 字符串；
- 宿主机路径；
- 网络地址；
- 密钥值。

Harness 根据 `action_id` 重新读取已授权 Action 和 Grant。
若任务版本、租约或 Grant 已失效，执行必须被拒绝。

### 10.2 什么时候可以使用预构建 `ToolNode`

只有同时满足以下条件时，才考虑使用预构建 `ToolNode`：

1. 注册的每个 Tool 都只是 Harness Adapter；
2. Tool 输入只接受受控引用，不接受裸命令或路径；
3. Adapter 会重新校验任务版本、Grant 和幂等键；
4. Tool 结果被归一化为平台 `ActionOutcome`；
5. 超时不会被自动解释为可重试失败；
6. Tool Callback 不记录敏感参数；
7. 有合同测试证明模型无法绕过授权。

如果做不到这些条件，使用自定义 Node 更清晰。

## 十一、Interrupt 与恢复

### 11.1 Interrupt 需要 Checkpointer

LangGraph 的 `interrupt()` 会暂停当前图线程，
并向调用方暴露一个可序列化 payload。

恢复时必须：

- 使用同一个 `thread_id`；
- 向图传入 `Command(resume=...)`；
- 验证恢复值和业务等待对象；
- 重新检查任务版本、权限和运行环境。

一个等待节点可以写成：

```python
from langgraph.types import interrupt


async def interrupt_for_input(
    state: AgentGraphState,
    runtime: Runtime[GraphRuntimeContext],
) -> dict[str, object]:
    waiting_ref = state.get("waiting_ref")
    if not waiting_ref:
        raise ValueError("waiting route requires waiting_ref")

    resume_value = interrupt(
        {
            "kind": state["reason_code"],
            "waiting_ref": waiting_ref,
            "task_id": state["task_id"],
            "task_version": state["task_version"],
        }
    )

    result = await runtime.context.harness.resume_waiting(
        task_id=state["task_id"],
        run_id=state["run_id"],
        waiting_ref=waiting_ref,
        resume_value=resume_value,
        idempotency_key=f"resume:{waiting_ref}",
    )
    return {
        "task_version": result.task_version,
        "route": result.kind.value,
        "reason_code": result.reason_code,
        "waiting_ref": result.waiting_ref,
    }
```

Interrupt payload 不应包含：

- Harness 或数据库对象；
- 完整 Prompt；
- Secret；
- 未清洗工具参数；
- Exception；
- 任意可执行对象。

### 11.2 恢复使用 `Command(resume=...)`

```python
from langgraph.types import Command


result = await graph.ainvoke(
    Command(
        resume={
            "decision": "approve",
            "approval_id": approval_id,
            "expected_task_version": expected_version,
        }
    ),
    config,
    context=context,
)
```

不要用普通输入字典假装恢复 Interrupt。
普通输入代表新一轮图输入，不具有相同恢复语义。

`Command(update=...)` 和 `Command(goto=...)`
主要用于节点返回，不是恢复 Interrupt 的输入方式。

### 11.3 节点会从开头重新执行

这是本课最重要的 LangGraph 运行时事实：

**恢复 Interrupt 时，节点从函数开头重新执行，
而不是从 `interrupt()` 下一行继续恢复 Python 调用栈。**

因此：

- `interrupt()` 前只做纯计算或幂等操作；
- 非幂等副作用放到 Interrupt 后或独立节点；
- 不要在裸 `try/except` 中包住 `interrupt()`；
- 不要动态改变同一节点中多个 Interrupt 的顺序；
- 不要用 `while True + interrupt()` 做输入校验；
- 恢复后的提交仍要携带幂等键。

错误示例：

```python
async def unsafe_approval_node(state):
    await payment_api.charge(state["amount"])
    decision = interrupt({"question": "approve?"})
    return {"decision": decision}
```

恢复时 `charge()` 会再次执行。

正确方向是拆分节点：

```text
prepare_authorized_action
  -> interrupt_for_approval
  -> revalidate_approval
  -> execute_authorized_action
```

### 11.4 不要捕获 GraphInterrupt

`interrupt()` 通过框架控制异常暂停执行。
裸 `except Exception` 可能截获它，使图无法正确暂停。

错误示例：

```python
try:
    decision = interrupt(payload)
except Exception:
    decision = {"decision": "reject"}
```

应把可能失败的查询放在 Interrupt 之前的独立节点，
或只捕获明确的业务异常，不包围 `interrupt()`。

## 十二、Checkpointer 与线程身份

### 12.1 本地开发使用内存实现

```python
from langgraph.checkpoint.memory import InMemorySaver


builder = build_agent_graph()
graph = builder.compile(
    checkpointer=InMemorySaver(),
)
```

`InMemorySaver` 只适合单进程开发和测试：

- 进程退出后数据丢失；
- 多 Worker 之间不共享；
- 不能作为生产恢复证据；
- 不提供业务事务边界。

### 12.2 生产使用持久化实现

生产 Checkpointer 至少要满足：

- 与部署拓扑兼容；
- 支持异步并发；
- 持久化和备份策略明确；
- 连接池与生命周期受 Composition Root 管理；
- 数据按租户隔离；
- Checkpoint payload 加密或脱敏；
- 清理、保留和迁移策略明确；
- 与 LangGraph 版本升级兼容。

若选择 PostgreSQL Checkpointer，
应在部署迁移阶段创建所需表结构。
不要让每个请求临时执行初始化。

### 12.3 `thread_id` 不是用户输入

Checkpointer 通过 `thread_id` 查找线程。
本项目应由平台生成并保存映射：

```text
tenant_id + task_id + run_id
  -> graph_thread_id
```

推荐：

- 使用不可猜测的内部 ID；
- 在 TaskStore 保存 thread 映射；
- 每次调用校验 tenant 与 actor；
- 不允许用户指定其他任务的 thread；
- 日志中只记录必要摘要；
- 新 Run 是否复用 thread 要有明确策略。

同一个任务可以有多个 Run。
若每个 Run 需要独立轨迹，应该使用独立 `thread_id`。

### 12.4 Checkpointer 不取代 TaskStore Checkpoint

LangGraph Checkpoint 保存图 State 和待执行任务。
第 6 课的 Task Checkpoint 保存业务一致边界。

恢复顺序必须是：

```text
读取图 Checkpoint
  -> 读取 TaskStore 权威快照
  -> 比对 task_version、run_id 和 active_action_id
  -> 检查租约与 fencing token
  -> 重新计算合法 Route
  -> 安全时继续图线程
```

若两个 Checkpoint 不一致：

- 图落后：重新装载 TaskStore 并更新控制投影；
- 图超前：停止自动推进并调查提交边界；
- active Action 不一致：进入恢复；
- graph version 不兼容：迁移或人工接管。

## 十三、Pending Write、重试与 Replay

LangGraph 可以保存节点的中间写入，并在故障后恢复。
这对纯节点很有帮助，但不能自动保证外部副作用幂等。

### 13.1 节点重试策略

只对明确的临时、无副作用操作使用框架重试，例如：

- 读取只读配置；
- 查询可重复的状态；
- 调用具有稳定幂等键的读服务；
- 暂时失败的 Checkpointer 操作。

不要对以下节点配置无条件重试：

- 写文件；
- 应用补丁；
- 创建发布；
- 发送邮件；
- 扣款；
- 启动结果不可查询的命令。

这些操作必须由 Harness 根据 `ActionOutcome`
判断成功、失败或 unknown。

### 13.2 Time Travel 不是无副作用重放

从旧 Checkpoint Replay 时，
该 Checkpoint 之后的节点可能重新执行。

这意味着模型请求、API 调用、工具和 Interrupt 都可能再次发生。
因此本项目的工作台应把两种功能分开：

| 功能 | 是否执行节点 | 用途 |
| --- | --- | --- |
| Timeline Replay | 否 | 重建历史轨迹和展示 |
| LangGraph Time Travel | 是 | 调试或创建受控分支 |

生产环境不能把 Time Travel 当作普通“查看历史”按钮。
启用前应检查权限、成本、工作区隔离和副作用策略。

### 13.3 图恢复仍要对账 Action

即使框架保存了 Pending Write，
TaskStore 中存在 `dispatched` 或 `unknown` Action 时，
恢复节点仍要调用 `reconcile()`。

框架知道节点是否完成，
但未必知道远端系统是否已经执行。

## 十四、使用 Command 时保持单一路由来源

LangGraph 节点可以返回 `Command`，
同时更新 State 并跳转到下一节点：

```python
from typing import Literal

from langgraph.types import Command


async def guarded_route(
    state: AgentGraphState,
    runtime: Runtime[GraphRuntimeContext],
) -> Command[Literal["advance", "reconcile"]]:
    view = await runtime.context.harness.inspect(
        task_id=state["task_id"],
        run_id=state["run_id"],
    )
    if view.active_action_id:
        return Command(
            update={
                "action_id": view.active_action_id,
                "task_version": view.task_version,
            },
            goto="reconcile",
        )
    return Command(
        update={"task_version": view.task_version},
        goto="advance",
    )
```

`Command` 适合更新和路由必须来自同一业务判断的节点。

但要遵守：

- `goto` 只能来自平台枚举；
- 不允许模型自由生成节点名；
- 不要同时给该节点添加会重复执行的静态后继；
- Route 仍要记录原因和任务版本；
- 测试必须覆盖每个可能的 `goto`。

本课主图使用条件边，是为了让路由函数更容易独立测试。
不要在同一节点混用多个路由来源。

## 十五、图流式输出与可观测性

LangGraph 可以流式返回 State Update、消息或事件。
这些输出适合驱动调试界面，但不自动成为领域审计事实。

服务层可以消费更新：

```python
async for chunk in graph.astream(
    initial_state,
    config,
    context=context,
    stream_mode="updates",
):
    await graph_stream_publisher.publish(
        sanitize_graph_chunk(chunk)
    )
```

发布前必须：

- 删除 Prompt、Secret 和工具敏感参数；
- 将大型内容替换为 ArtifactRef；
- 绑定 task_id、run_id 和 correlation_id；
- 区分框架节点事件与领域事件；
- 为重复投递提供 event_id；
- 避免把内部 Exception 直接展示给用户。

### 15.1 Callback 不是 EventStore

LangGraph Callback 可以记录节点耗时和框架 Trace，
但它不能取代第 13 课的 EventStore。

正确顺序仍然是：

```text
Harness 原子提交任务事实与领域事件
  -> Node 返回 State Update
  -> LangGraph 写 Checkpoint
  -> Callback 发布框架观测
```

Callback 丢失不应使已提交 Action 失效。
Callback 也不能直接修改 TaskStore 或触发业务工具。

### 15.2 建议记录的映射

| LangGraph 字段 | 平台关联字段 |
| --- | --- |
| thread_id | graph_thread_id、run_id |
| checkpoint_id | graph_checkpoint_id |
| node name | orchestration_node |
| task ID | graph_task_id，不等于平台 task_id |
| interrupt ID | waiting_ref 或恢复关联 ID |
| step | Super-step 序号 |

不要假设框架内部 task ID 就是第 13 课的业务 Step ID。
两者必须分别保存和关联。

## 十六、封装 Orchestration Service

API 层不应直接到处调用 `graph.ainvoke()`。
用服务封装 thread、context、初始 State 和恢复校验：

```python
from dataclasses import dataclass

from langgraph.types import Command


@dataclass
class LangGraphOrchestrationService:
    graph: object
    harness: GraphHarnessAdapter
    threads: GraphThreadStore

    async def start(
        self,
        *,
        tenant_id: str,
        task_id: str,
        run_id: str,
        actor_id: str,
        correlation_id: str,
    ) -> object:
        thread_id = await self.threads.get_or_create(
            tenant_id=tenant_id,
            task_id=task_id,
            run_id=run_id,
        )
        context = GraphRuntimeContext(
            harness=self.harness,
            tenant_id=tenant_id,
            correlation_id=correlation_id,
            actor_id=actor_id,
        )
        return await self.graph.ainvoke(
            {
                "task_id": task_id,
                "run_id": run_id,
                "task_version": 0,
                "graph_version": "agent-harness-v1",
                "route": "reload",
                "reason_code": "start",
                "iteration": 0,
                "evidence_refs": [],
            },
            {
                "configurable": {
                    "thread_id": thread_id,
                }
            },
            context=context,
        )

    async def resume(
        self,
        *,
        tenant_id: str,
        task_id: str,
        run_id: str,
        actor_id: str,
        correlation_id: str,
        resume_value: object,
    ) -> object:
        thread_id = await self.threads.require_access(
            tenant_id=tenant_id,
            task_id=task_id,
            run_id=run_id,
            actor_id=actor_id,
        )
        return await self.graph.ainvoke(
            Command(resume=resume_value),
            {
                "configurable": {
                    "thread_id": thread_id,
                }
            },
            context=GraphRuntimeContext(
                harness=self.harness,
                tenant_id=tenant_id,
                correlation_id=correlation_id,
                actor_id=actor_id,
            ),
        )
```

真实实现还应：

- 校验恢复命令 Schema；
- 生成 correlation_id 和幂等键；
- 检查等待对象仍然有效；
- 限制同一 Run 的并发调用；
- 处理取消、超时和客户端断连；
- 将 Interrupt 转成稳定 API 响应；
- 隐藏 LangGraph 内部对象。

API 返回平台 DTO，
不能把 `StateSnapshot` 或 `GraphInterrupt` 直接暴露给客户端。

## 十七、测试接入而不是测试框架本身

### 17.1 路由单元测试

```python
def test_unknown_route_is_rejected() -> None:
    state = make_state(route="new_unhandled_route")

    with pytest.raises(ValueError):
        route_after_advance(state)


def test_recovery_route_never_goes_to_advance() -> None:
    state = make_state(route="recovery_required")

    assert route_after_advance(state) == "reconcile"
```

### 17.2 节点合同测试

```python
async def test_advance_node_calls_harness_once() -> None:
    harness = FakeGraphHarness(
        advance_result=progressed_result(version=8)
    )
    runtime = fake_runtime(harness)

    update = await advance_harness(
        make_state(task_version=7),
        runtime,
    )

    assert update["task_version"] == 8
    assert harness.advance_calls == 1
    assert harness.raw_tool_calls == 0
```

### 17.3 Interrupt 恢复测试

```python
async def test_waiting_run_resumes_with_same_thread() -> None:
    checkpointer = InMemorySaver()
    graph = build_agent_graph().compile(
        checkpointer=checkpointer
    )
    config = {
        "configurable": {
            "thread_id": "thread-test-01",
        }
    }

    first = await graph.ainvoke(
        waiting_state(),
        config,
        context=fake_context(),
    )
    assert first["__interrupt__"]

    resumed = await graph.ainvoke(
        Command(resume={"decision": "approve"}),
        config,
        context=fake_context(),
    )
    assert resumed["route"] != "waiting"
```

不同 LangGraph 版本的 Interrupt 返回展示可能变化。
测试应固定项目锁定版本，并优先断言业务等待对象和 Harness 调用。

### 17.4 必须覆盖的集成场景

| 场景 | 必须断言 |
| --- | --- |
| 正常推进 | 每次 Node 只调用一次 Harness |
| 等待审批 | Checkpoint 存在，工具没有执行 |
| 审批恢复 | 使用同一 thread，重新校验 Policy |
| 拒绝审批 | 任务进入明确状态，不到达 Tool Node |
| Action unknown | 只调用 reconcile，不再次 execute |
| 版本冲突 | 重新 load，不用旧版本继续 |
| Worker 重启 | 从持久化 Checkpointer 恢复 |
| Interrupt 前重放 | 不产生非幂等副作用 |
| 图达到 recursion limit | Run 不被伪装为 completed |
| Callback 失败 | 已提交领域事实保持有效 |
| 非法 thread | 租户和用户访问被拒绝 |
| 旧 graph version | 迁移或人工接管 |

### 17.5 故障注入

至少在以下位置注入进程退出：

1. Harness 提交前；
2. Harness 提交后、Node 返回前；
3. Node 返回后、图 Checkpoint 写入前；
4. Interrupt Checkpoint 写入后、API 响应前；
5. 恢复值验证后、业务提交前；
6. Tool Action 派发后、结果提交前；
7. reconcile 查询后、状态提交前。

每个场景都要证明：

- 已确认副作用不会重复；
- unknown 不会被改写成 failed；
- 旧 Worker 不能提交；
- 恢复从 TaskStore 事实开始；
- 图 State 不会覆盖新任务版本。

## 十八、常见错误

### 18.1 把 Harness 整个放进 State

Harness 不是可持久化业务数据。
应通过 `context_schema` 和 `Runtime` 注入。

### 18.2 直接使用模型 Tool Call 驱动 ToolNode

模型 Tool Call 是提案，不是授权。
必须先生成持久化 Action 和 `ExecutionGrant`。

### 18.3 认为 Checkpointer 已解决 Exactly Once

Checkpointer 只能保存图执行进度。
外部副作用仍需要 Action ID、幂等键、查询和对账。

### 18.4 在 Interrupt 前创建非幂等记录

恢复时节点会从开头重新执行。
应使用稳定 ID 的 upsert，或把写入拆到独立节点。

### 18.5 用 `try/except Exception` 包住 Interrupt

这可能捕获框架用于暂停的控制异常。
应将错误处理与 Interrupt 分开。

### 18.6 用普通字典恢复 Interrupt

恢复应使用同一 `thread_id` 和 `Command(resume=...)`。
普通字典是新输入，不是恢复命令。

### 18.7 把 graph END 当成 completed

图可能因为失败、等待、取消或 recursion limit 停止。
任务完成只能由 TaskStore 中已验证的领域迁移表示。

### 18.8 Callback 直接调用业务工具

Callback 是观测 Adapter，不是隐藏编排器。
业务动作必须进入 Harness Step。

### 18.9 允许客户端选择 thread_id

这会造成越权读取和恢复其他租户任务。
thread 映射必须由服务端生成并校验。

### 18.10 同时使用静态边和动态 goto

两套路由可能同时生效并执行意外节点。
每个节点应只有一个清晰的路由来源。

## 十九、课堂练习

1. 将本课主图增加一个 `budget_guard` 节点，
   并证明 recursion limit 不是业务预算。
2. 为 `GraphHarnessAdapter` 编写 Fake，
   模拟 progressed、waiting、terminal 和 recovery_required。
3. 实现一个等待用户补充测试命令的 Interrupt，
   但恢复值只能引用已登记命令模板。
4. 把裸 `ToolNode` 改成只接受 `action_id` 的受控节点，
   并写测试证明模型参数无法直接进入 Shell。
5. 模拟 Harness 已提交、图 Checkpoint 尚未写入时进程退出，
   设计恢复后的版本对齐流程。
6. 为 PostgreSQL Checkpointer 设计租户隔离、
   数据保留、加密、备份和迁移清单。
7. 解释 Timeline Replay 与 LangGraph Time Travel 的区别，
   并为后者设计权限和副作用警告。

## 二十、完成标准

完成本课后，你应该能够：

- 将 LangGraph 限制在 Orchestration Adapter 层；
- 用自定义 State 保存最小、可序列化控制投影；
- 通过 Runtime Context 注入 Harness 和调用上下文；
- 让节点只调用 Harness，不直接连接模型和工具；
- 使用有限条件边映射 Harness 结果；
- 让 Tool Node 只执行持久化、已授权 Action；
- 使用 Checkpointer、thread_id、Interrupt 和 Command 完成恢复；
- 解释为什么 Interrupt 恢复会重新执行节点开头；
- 区分图 Checkpoint 与 TaskStore 业务 Checkpoint；
- 对 unknown Action 先 reconcile，不自动重试；
- 区分 Timeline Replay 与会重新执行节点的 Time Travel；
- 用合同测试证明权限、幂等、版本和恢复边界没有被框架绕过。

## 二十一、本课小结

LangGraph 为 Agent Harness 提供了成熟的节点调度、
条件边、Checkpoint 和 Interrupt 机制。
它减少了自建图执行器的工作量，但不会自动解决业务授权、
外部副作用、任务版本和恢复对账。

本课将 Graph State 限制为控制投影，
将服务对象放进 Runtime Context，
让节点只调用 Harness，并将 Harness 的有限结果映射为条件边。
Tool Node 只能处理已持久化、已授权的 Action，
不能把模型 Tool Call 直接变成外部执行。

Interrupt 必须配合 Checkpointer 和稳定 thread_id。
恢复时节点会从开头重新执行，
所以 Interrupt 前的操作必须纯净或幂等。
图 Checkpoint 与 TaskStore Checkpoint 需要相互校验，
任何 active Action 都要先对账。

完成这一层适配后，领域代码不依赖 LangGraph。
第 16 课将开始实现 Codebase Agent 的第一个业务阶段：
构建仓库地图、执行受限代码检索，并保存可引用的证据。

## 延伸阅读

- [LangGraph Graph API](https://docs.langchain.com/oss/python/langgraph/graph-api)
- [LangGraph Interrupts](https://docs.langchain.com/oss/python/langgraph/interrupts)
- [LangGraph Persistence](https://docs.langchain.com/oss/python/langgraph/persistence)
- [LangGraph Checkpointers](https://docs.langchain.com/oss/python/langgraph/checkpointers)
