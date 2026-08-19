# 第 6 课：实现 Checkpoint 与重启恢复

> 章节导航：[第三章：Agent Loop、State、Harness 与 Codebase Agent](./index.md)  
> 上一课：[第 5 课：实现任务持久化与事件记录](./lesson-05-task-persistence-events.md)  
> 下一课：[第 7 课：实现动态重规划与步骤依赖](./lesson-07-replanning-dependencies.md)

## 一、你将完成什么

第 5 课已经把任务当前状态、计划步骤、工具调用、工具结果和事件写入数据库。它解决了“服务退出后，事实是否还在”的问题；但事实还在，不等于另一个 Worker 知道应该从哪里继续，更不等于它可以放心地把上一条工具调用再发一次。

例如，任务在调用远程的 `apply_patch` 后进程退出。数据库只保留一条 `tool.dispatched`，没有 `tool.resolved`。此时直接重跑可能把补丁应用两遍；直接标记失败又丢失了一个原本可以查询确认的任务。

本课在持久化事实之上建立 Checkpoint、租约和恢复决策。完成后，你应该能够：

1. 区分事件、当前状态和可恢复 Checkpoint 的职责；
2. 选择只能在一致边界写入的 Checkpoint 内容；
3. 用短期 Worker 租约和 fencing token 限制同一任务的并发推进；
4. 在重启后先核对调用状态和幂等键，再决定继续、查询、暂停或人工介入；
5. 用合同测试证明过期 Worker、重复恢复和未知副作用不会导致重复写入。

## 二、本课内容边界

本课只解决一个核心问题：**执行进程在任意时刻退出后，平台如何从已提交的事实安全恢复，而不是把任务从头重跑。**

本课会完成：

- Checkpoint 的定义、结构和一致性边界；
- Checkpoint 与任务投影、事件、工具调用的事务关系；
- Worker 租约、心跳、过期接管与 fencing token；
- 启动扫描、恢复分类和恢复决策表；
- `waiting_tool` 下的幂等查询、结果对账和未知副作用处理；
- 优雅退出和恢复合同测试。

本课不会展开：

- 因新证据修改计划、拆分步骤或处理依赖图；
- 步数、Token、时间和工具预算的扣减策略；
- Sandbox 的命令取消、容器快照和资源回收；
- 审批单的完整 UI、人工接管工作台和取消协议；
- Kafka、分布式工作流引擎或跨地域主从复制；
- Event Sourcing 的全量事件回放实现。

第 7 课会讨论恢复后发现原计划不再适用时如何重规划；第 8 课再加入恢复也必须遵守的预算和收敛规则；第 9–11 课才定义 Sandbox 如何真正取消进程和隔离副作用。

## 三、恢复不是“重新执行 run(task_id)”

一个天真的恢复器通常只有下面几行：

```python
async def recover_task(task_id: str) -> None:
    task = await repository.get_task(task_id)
    await agent.run(task.spec_json)
```

它会同时破坏多个已经建立的边界：

1. `agent.run()` 不知道上一次计划、观察版本和已完成步骤；
2. 它可能再次发出已经发出的写工具调用；
3. 多个新 Worker 可以同时恢复同一任务；
4. 旧 Worker 在网络短暂断开后恢复，也可能继续提交过期结果；
5. 它把“工具响应丢失”误判为“工具从未执行”。

恢复应当是一次受控决策，而不是一次新的任务创建：

```text
读取当前投影与最新 Checkpoint
  -> 获得该任务的有效租约
  -> 校验快照是否仍对应当前事实版本
  -> 检查取消、审批、计划和未决调用
  -> 对未决外部动作先查询或对账
  -> 仅在安全时生成下一条受控命令
```

其中最重要的规则是：**没有证据证明某个有副作用的调用未发生，就不能为了“恢复进度”自动再发一次。**

## 四、Checkpoint、事件和当前状态各自回答什么

第 5 课已经定义了三类持久化对象。Checkpoint 不是第四份任意复制的数据，也不是把所有事件重新命名。

| 对象 | 回答的问题 | 写入方式 | 是否直接驱动恢复 |
| --- | --- | --- | --- |
| 当前任务投影 | 任务现在处于什么状态 | 原地更新，带版本 | 是，作为权威当前事实 |
| 领域记录 | 有哪些步骤、调用、结果和产物 | 受控更新或追加 | 是，补足具体对象 |
| TaskEvent | 这些事实按什么顺序发生 | 只追加 | 用于审计、诊断和校验 |
| Checkpoint | 在哪个一致边界可从哪一阶段继续 | 只在安全边界追加 | 是，提供恢复游标 |

可以把它们理解为：

```text
Task / Step / Invocation / Result     当前可查询事实
                +
TaskEvent                             事实如何演变
                +
Checkpoint                            恢复时可相信的停靠点
```

Checkpoint 不取代当前投影。恢复器仍然必须读取 `agent_tasks`、`tool_invocations` 和 `tool_results`；Checkpoint 只说明哪些字段共同构成一次已经提交、可重新装配的运行边界。

同样，事件也不自动构成 Checkpoint。`tool.dispatched` 是“已尝试把调用送出”的历史事实，不表示调用结果已知；把它当作“下一步可以继续规划”的快照，会跳过结果对账并造成重复执行。

## 五、选择一致边界

### 5.1 什么是可恢复的一致边界

当且仅当以下事实在同一个数据库事务中已经提交时，才可以写入 Checkpoint：

- 任务状态与任务版本；
- 当前计划和步骤的可见状态；
- 已确认的工具调用和工具结果；
- 本次状态变化对应的任务事件；
- 恢复器下一步需要的最小游标。

下面这些位置通常适合创建 Checkpoint：

| 边界 | Checkpoint 能表达的事实 | 恢复时的第一动作 |
| --- | --- | --- |
| 计划被接受后 | 计划、步骤和首个可执行步骤已确定 | 重新校验后准备调度动作 |
| 调用已接受但尚未发出 | 调用身份和幂等键已固定 | 可以受控地调度该调用 |
| 调用已标记 `dispatched` | 外部动作可能已发生，结果尚未确认 | 查询、等待或暂停，不能盲目重发 |
| 工具结果已提交后 | 结果、步骤、任务状态和观察版本一致 | 进入下一轮观察或规划 |
| 任务进入等待审批或暂停后 | 没有活跃执行，等待条件明确 | 检查审批或恢复前置条件 |

不适合写 Checkpoint 的位置包括：模型流式输出到一半、远程调用在内存中刚准备发出、数据库事务尚未提交，或同一事务中还有结果记录未写完。此时保存“半个状态”只会让恢复器获得错误的确定性。

### 5.2 发送外部调用前后的双重记录

调用外部工具时，不存在一个可以用单个数据库事务包住网络调用的魔法顺序。可采用如下协议：

```text
事务 A：接受 Action，创建 Invocation 和 idempotency_key
         -> Checkpoint(kind=ready_to_dispatch)
         -> COMMIT

事务 B：确认租约和 fencing token，记录 tool.dispatched
         -> Checkpoint(kind=awaiting_tool_result)
         -> COMMIT

网络调用：携带 invocation_id、idempotency_key 和 fencing token

事务 C：保存权威 ToolResult，推进 Step / Task / Observation
         -> Checkpoint(kind=after_tool_result)
         -> COMMIT
```

如果进程在事务 A 后退出，调用尚未送出，恢复器可以在重新获得租约后继续调度；如果它在事务 B 或网络调用后退出，调用可能已经到达下游，恢复器必须先对账。事务 C 已提交时，工具结果与任务投影共同成为下一次恢复的起点。

不要把“调用已写入本地数据库”误解成“下游一定没收到”。网络请求可能在客户端超时前已由服务端执行，也可能因重试中间件被重复传送；`idempotency_key` 是让下游识别同一业务调用的稳定身份，而不是本地重试次数。

## 六、定义 Checkpoint 数据模型

Checkpoint 应保存恢复游标和完整性信息，而不是复制整段 Prompt、工具输出或事件 payload。下面示例放在 `apps/api/app/agents/recovery/models.py`：

```python
from datetime import datetime
from typing import Any

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    JSON,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.agents.persistence.models import Base


class TaskCheckpointRow(Base):
    __tablename__ = "task_checkpoints"
    __table_args__ = (
        UniqueConstraint(
            "task_id", "task_version", name="uq_checkpoint_task_version"
        ),
        CheckConstraint(
            "task_version >= 0", name="ck_checkpoint_task_version"
        ),
        CheckConstraint(
            "event_sequence >= 0", name="ck_checkpoint_event_sequence"
        ),
    )

    checkpoint_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    task_id: Mapped[str] = mapped_column(
        ForeignKey("agent_tasks.task_id"), index=True
    )
    task_version: Mapped[int] = mapped_column(Integer)
    event_sequence: Mapped[int] = mapped_column(Integer)
    checkpoint_kind: Mapped[str] = mapped_column(String(64))
    task_status: Mapped[str] = mapped_column(String(32))
    plan_id: Mapped[str | None] = mapped_column(String(64))
    observation_version: Mapped[int] = mapped_column(Integer)
    resume_cursor: Mapped[dict[str, Any]] = mapped_column(JSON)
    state_schema_version: Mapped[int] = mapped_column(Integer, default=1)
    state_hash: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
```

`resume_cursor` 只包含驱动器继续执行所需的稳定 ID，例如：

```json
{
  "phase": "awaiting_tool_result",
  "step_id": "step-01J...",
  "action_id": "action-01J...",
  "invocation_id": "inv-01J...",
  "idempotency_key": "tool:inv-01J...",
  "recovery_strategy": "query_by_idempotency_key"
}
```

它不应包含模型原始上下文、完整命令输出、数据库连接信息或用户可提交的 URL。完整内容仍由受控的消息表、产物存储和工具结果引用保存。

### 6.1 为什么同时保存版本、事件序号和哈希

- `task_version` 用于确认 Checkpoint 是否对应当前投影；
- `event_sequence` 用于定位它对应的任务内事实顺序；
- `state_hash` 用于发现序列化、迁移或人工修复造成的快照不一致。

本章第 5 课的简化规则是每个改变任务聚合的事务只追加一条主事件，因此正常情况下 `event_sequence == task_version`。生产系统如果允许一个事务追加多条事件，应保留两者的独立含义，不能把它们强行复用。

哈希应由规范化后的、明确允许的字段计算，例如 `task_id`、版本、状态、计划 ID 和恢复游标。它不是密码学授权机制，也不能替代数据库约束；它主要用于检测“看起来能读取、实际字段组合不属于同一提交”的数据问题。

### 6.2 给工具调用补充恢复元数据

第 5 课的 `ToolInvocation` 需要能回答“这次调用是否可以被查询或安全重试”。建议补充以下字段：

| 字段 | 用途 |
| --- | --- |
| `idempotency_key` | 下游去重和恢复查询的稳定键 |
| `delivery_state` | `accepted`、`dispatched`、`reconciling` 等本地投递事实 |
| `recovery_strategy` | `query_by_key`、`retry_idempotent`、`manual` |
| `fencing_token` | 发起该次调度的租约代次 |
| `dispatched_at` | 用于诊断和超时策略，不能单独判断是否执行 |

是否可重试由工具契约决定，而不是由 HTTP 方法或工具名字猜测。一个 `POST` 也可能支持幂等键，一个看似只读的命令也可能刷新缓存、创建临时资源或消耗配额。

## 七、把任务变化与 Checkpoint 放进同一事务

Checkpoint 不能在任务事务提交后“异步补写”。否则进程可能看到新的 `waiting_tool`，却只能读取旧的 `ready_to_dispatch` 快照，并错误地再次调度调用。

Repository 应提供以聚合命令为单位的方法：

```python
from dataclasses import dataclass
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


class StaleCheckpoint(RuntimeError):
    pass


@dataclass(frozen=True)
class CheckpointDraft:
    kind: str
    plan_id: str | None
    task_status: str
    observation_version: int
    resume_cursor: dict[str, Any]


class SqlAlchemyCheckpointRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def append_for_current_task(
        self,
        *,
        task: AgentTaskRow,
        draft: CheckpointDraft,
    ) -> TaskCheckpointRow:
        event = await self._session.scalar(
            select(TaskEventRow)
            .where(TaskEventRow.task_id == task.task_id)
            .order_by(TaskEventRow.sequence.desc())
            .limit(1)
        )
        if event is None or event.sequence != task.version:
            raise StaleCheckpoint(
                "task projection and latest event are not one committed boundary"
            )

        row = TaskCheckpointRow(
            checkpoint_id=new_id("checkpoint"),
            task_id=task.task_id,
            task_version=task.version,
            event_sequence=event.sequence,
            checkpoint_kind=draft.kind,
            task_status=draft.task_status,
            plan_id=draft.plan_id,
            observation_version=draft.observation_version,
            resume_cursor=draft.resume_cursor,
            state_schema_version=1,
            state_hash=checkpoint_hash(task, draft),
        )
        self._session.add(row)
        await self._session.flush()
        return row
```

实际调用必须位于修改任务、步骤、调用或结果的同一个 `session.begin()` 内：

```python
async with session.begin():
    task = await task_repository.mark_tool_dispatched(
        task_id=task_id,
        expected_version=current.version,
        invocation_id=invocation_id,
        fencing_token=lease.fencing_token,
    )
    await checkpoint_repository.append_for_current_task(
        task=task,
        draft=CheckpointDraft(
            kind="awaiting_tool_result",
            plan_id=current_plan.plan_id,
            task_status=task.status,
            observation_version=task.observation_version,
            resume_cursor={
                "phase": "awaiting_tool_result",
                "invocation_id": invocation_id,
                "idempotency_key": invocation.idempotency_key,
                "recovery_strategy": invocation.recovery_strategy,
            },
        ),
    )
```

如果 Checkpoint 插入失败，状态更新和 `tool.dispatched` 事件也必须回滚。不要用“下一次扫描时补一个”修复，因为在补写前恢复器无法证明应该相信哪一组事实。

### 7.1 Checkpoint 不必为每条低价值事件创建副本

不是每条消息追加或调试事件都需要独立 Checkpoint。判断标准不是事件的重要性，而是：**如果此刻进程退出，恢复器是否需要额外游标才能安全地决定下一步。**

例如，记录一条不参与控制决策的模型文本摘要可以不创建新 Checkpoint；接受计划、改变任务状态、准备外部调用、确认工具结果和进入等待态则需要。实现上可以把这些受控命令集中在少数 Repository 方法中，避免调用方忘记同步写入快照。

## 八、用租约保证谁有资格推进任务

Checkpoint 解决“从哪里继续”，租约解决“现在谁可以继续”。分布式服务中，进程仍可能因为暂停、网络分区或重复队列投递而同时看见同一任务。数据库行锁只能覆盖一个短事务，不能覆盖模型和工具调用的整个执行时间。

为任务维护一条短期租约：

```python
class TaskLeaseRow(Base):
    __tablename__ = "task_leases"

    task_id: Mapped[str] = mapped_column(
        ForeignKey("agent_tasks.task_id"), primary_key=True
    )
    owner_id: Mapped[str] = mapped_column(String(128), index=True)
    fencing_token: Mapped[int] = mapped_column(Integer)
    lease_expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), index=True
    )
    heartbeat_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
```

租约的基本规则如下：

1. 只有取得未持有或已过期租约的 Worker 才能推进任务；
2. Worker 定期续约，续约必须同时匹配 `owner_id` 和 `fencing_token`；
3. 租约过期后，新 Worker 可以接管，并得到更大的 `fencing_token`；
4. 旧 Worker 即使随后恢复，也不能再提交状态更新或调用外部副作用；
5. 租约只是推进权，不改变任务状态，也不代表工具进程已经停止。

租约时间应使用数据库时钟或统一的可信时钟。不同应用实例的本地时间存在偏差，用本地 `datetime.now()` 竞争过期条件会造成双重持有或错误接管。

### 8.1 原子取得与续约租约

以 PostgreSQL 为例，取得已过期租约时可以使用条件更新，并让数据库返回新的代次：

```sql
UPDATE task_leases
SET owner_id = :owner_id,
    fencing_token = fencing_token + 1,
    heartbeat_at = CURRENT_TIMESTAMP,
    lease_expires_at = CURRENT_TIMESTAMP + (:lease_seconds * INTERVAL '1 second')
WHERE task_id = :task_id
  AND lease_expires_at < CURRENT_TIMESTAMP
RETURNING task_id, owner_id, fencing_token, lease_expires_at;
```

首次取得时插入记录；插入与并发插入发生唯一约束冲突时，重新读取后按同样的过期条件尝试接管。不要先读 `lease_expires_at` 再无条件写入，这会让两个 Worker 都认为自己获得了租约。

续约则必须更严格：

```sql
UPDATE task_leases
SET heartbeat_at = CURRENT_TIMESTAMP,
    lease_expires_at = CURRENT_TIMESTAMP + (:lease_seconds * INTERVAL '1 second')
WHERE task_id = :task_id
  AND owner_id = :owner_id
  AND fencing_token = :fencing_token
  AND lease_expires_at >= CURRENT_TIMESTAMP
RETURNING fencing_token, lease_expires_at;
```

返回零行表示 Worker 已经失去推进权。它必须立即停止发送新动作，并丢弃尚未提交的本地计算结果；不能继续“尽量提交”。

## 九、fencing token 阻止迟到的 Worker

单独使用租约仍然不够。考虑下面的时间线：

```text
Worker A 获得 lease，fence=41
Worker A 因 GC 暂停，未能续约
Worker B 接管 lease，fence=42，并继续任务
Worker A 恢复，仍以为自己可以调用工具
```

如果只检查 A 在开始时是否持有过租约，它可能在 B 已经产生新事实后提交一个迟到结果。fencing token 为每次持有分配单调递增的代次，所有关键写入和外部调用都携带这个代次。

本地写入至少应带以下条件：

```sql
UPDATE agent_tasks AS task
SET status = :new_status,
    version = version + 1
FROM task_leases AS lease
WHERE task.task_id = :task_id
  AND lease.task_id = task.task_id
  AND lease.owner_id = :owner_id
  AND lease.fencing_token = :fencing_token
  AND lease.lease_expires_at >= CURRENT_TIMESTAMP
  AND task.version = :expected_version;
```

外部 Tool Runtime 也应验证 token，或将其映射到可比较的执行代次。仅把 token 写进日志没有防护效果。若下游无法验证 token，至少要让它严格支持 `idempotency_key` 和结果查询；对于不可查询、不可幂等的写操作，恢复策略应是 `manual`，而不是自动重试。

| 机制 | 防止的问题 | 不能解决的问题 |
| --- | --- | --- |
| 任务版本 | 过期状态覆盖 | 两个 Worker 同时发出外部请求 |
| 租约 | 多个 Worker 正常同时推进 | 过期 Worker 延迟恢复后继续动作 |
| fencing token | 迟到 Worker 写入或发起新一代动作 | 下游本身不支持去重或对账 |
| 幂等键 | 同一业务调用被下游重复处理 | 不知道调用是否已经到达下游 |
| 结果查询 | 不确定调用的真实结果 | 下游没有查询接口时的自动判断 |

这些机制互补，任何一个都不能替代其余机制。

## 十、定义恢复决策

恢复器先收集事实，再选择命令。它不应根据“重启原因”猜测，也不应把失败的 Worker 内存当成可靠输入。

### 10.1 启动扫描流程

服务启动或定时调度时，扫描非终态任务。扫描只负责发现候选任务，真正恢复前仍需竞争租约：

```text
查询非终态任务
  -> 跳过持有且尚未过期的租约
  -> 原子取得或接管任务租约
  -> 读取当前投影、最新 Checkpoint、Invocation、Result
  -> 校验 Checkpoint 的版本、事件序号和状态哈希
  -> 执行恢复决策
  -> 续约、提交下一事实，或条件释放租约
```

可以使用队列延迟投递、周期扫描或两者结合；它们只是唤醒机制。无论消息被投递多少次，Repository 的租约、版本、唯一约束和幂等键都必须让恢复过程本身可重入。

### 10.2 首先校验 Checkpoint

恢复器读取到 Checkpoint 后，需要验证：

1. `checkpoint.task_version == task.version`；
2. `checkpoint.event_sequence` 对应同一任务的已提交事件；
3. `checkpoint.task_status == task.status`；
4. `checkpoint.state_hash` 可由当前允许字段重新计算；
5. 游标引用的计划、步骤和调用仍属于该任务和租户。

失败时不能直接信任旧快照。对于仅缺少 Checkpoint、但当前投影和事件仍完整的任务，可在不调用外部系统的事务中重新装配一个新的 Checkpoint，并记录 `checkpoint.rebuilt` 事件；对于版本、状态或关联关系互相矛盾的数据，应停止自动恢复，进入 `paused` 或故障隔离，并发出高优先级告警。

“重建 Checkpoint”不是根据模型文本猜测进度，而是完全从第 5 课的权威当前投影、领域记录和已提交事件中确定性生成。若无法确定性生成，就说明不存在安全恢复前提。

### 10.3 按状态与调用事实分类

| 当前事实 | 恢复器动作 | 是否可以自动发起原调用 |
| --- | --- | --- |
| 任务已终态 | 不取得或立即释放租约 | 不可以 |
| `planning` / `running`，无未决调用 | 从一致 Checkpoint 回到受控的 observe / plan | 不直接重放旧模型输出 |
| `waiting_approval` | 校验审批仍有效，继续等待或进入受控恢复 | 不可以绕过审批 |
| Invocation 为 `accepted`，无 `tool.dispatched` | 校验授权、计划版本和租约后调度 | 可以，尚无发出事实 |
| Invocation 为 `dispatched`，已有权威结果 | 通过幂等提交补齐后续状态或重建快照 | 不重复调用 |
| Invocation 为 `dispatched`，无结果且可查询 | 按幂等键查询下游状态 | 不先重发 |
| Invocation 为 `dispatched`，结果仍执行中 | 保持等待，安排稍后检查 | 不可以 |
| Invocation 为 `dispatched`，无法查询且可能有副作用 | `paused(unknown_side_effect)` 并请求人工处理 | 不可以 |
| 取消已请求且有未决调用 | 停止新动作，先对账未决调用 | 不可以 |

这里的“可以自动发起”只表示恢复层面不存在已发出事实，仍必须再次通过第 2 课授权范围、第 3 课状态机守卫和第 4 课动作校验。恢复不能扩大任务权限或跳过审批。

## 十一、处理未知工具结果

`waiting_tool` 是恢复风险最高的状态。它不是“再等一会儿”的同义词，而是需要用调用身份、下游能力和已保存事实完成判定。

### 11.1 可查询工具：先查询再写入结果

对于支持 `get_operation(idempotency_key)` 的工具，恢复流程可以是：

```python
async def reconcile_dispatched_invocation(
    *,
    lease: TaskLease,
    invocation: ToolInvocationRow,
    tool_client: RecoverableToolClient,
) -> RecoveryOutcome:
    status = await tool_client.get_operation(
        idempotency_key=invocation.idempotency_key,
        fencing_token=lease.fencing_token,
    )

    if status.kind is RemoteOperationKind.SUCCEEDED:
        await record_tool_result_idempotently(
            invocation_id=invocation.invocation_id,
            result=status.to_execution_result(),
            lease=lease,
        )
        return RecoveryOutcome.RESULT_RECORDED

    if status.kind is RemoteOperationKind.RUNNING:
        return RecoveryOutcome.STILL_RUNNING

    if status.kind is RemoteOperationKind.NOT_FOUND:
        return RecoveryOutcome.NO_REMOTE_RECORD

    return RecoveryOutcome.UNKNOWN
```

`NOT_FOUND` 也不能立即等同于“从未执行”。只有工具契约明确保证：同一幂等键在保留窗口内必定可查询，且未找到代表请求从未被接受，恢复器才可以回到 `accepted` 并重新调度。保留窗口已经过期、下游数据被清理或查询范围不足时，应按未知处理。

### 11.2 可幂等重试不等于任意重试

某些工具允许使用同一个幂等键再次提交。正确语义是“下游返回同一业务调用的既有或唯一结果”，而不是“多试几次直到成功”。只有同时满足以下条件，才可以自动重送：

- Tool Schema 明确声明该操作支持幂等键；
- 同一键在下游有足够长的保留期；
- 下游会把相同键映射到同一效果和同一查询对象；
- 该次调用仍位于任务授权、审批和未取消范围内；
- 当前 Worker 的租约和 fencing token 仍有效。

恢复时必须复用原 `idempotency_key`，不能生成新键。新键会把“恢复同一次调用”变成“创建第二次调用”。

### 11.3 无法判断副作用时暂停

对于不支持幂等键、结果查询或可靠审计的外部写入，系统无法从技术上证明调用是否发生。正确行为是保留事实并停止自动推进：

```text
tool.dispatched(invocation=i1)
  + 无 ToolResult
  + 下游不可查询
  -> task.paused(reason=unknown_side_effect)
  -> task.recovery_blocked(invocation=i1, required_action=manual_reconcile)
```

不要删除调用记录、把步骤改回 `pending`，或将异常包装成普通 `failed`。人工处理需要看到调用参数摘要、幂等键、最近的 fence、下游请求 ID、时间窗口和可能影响的资源；敏感参数仍应遵循第 5 课的脱敏与访问控制规则。

## 十二、实现一个受控恢复器

恢复器应是显式的服务，而不是散落在 HTTP 启动钩子里的补丁代码。下面是省略具体 ORM 查询后的骨架：

```python
class TaskRecoveryService:
    def __init__(self, repository, lease_repository, tool_runtime) -> None:
        self._repository = repository
        self._leases = lease_repository
        self._tool_runtime = tool_runtime

    async def recover(self, *, task_id: str, worker_id: str) -> None:
        lease = await self._leases.try_acquire(
            task_id=task_id,
            owner_id=worker_id,
        )
        if lease is None:
            return

        try:
            snapshot = await self._repository.load_recovery_snapshot(
                task_id=task_id,
                lease=lease,
            )
            if snapshot.task.is_terminal:
                return

            await self._repository.verify_or_rebuild_checkpoint(
                snapshot=snapshot,
                lease=lease,
            )

            decision = decide_recovery(snapshot)
            if decision.kind is RecoveryDecision.RECONCILE_INVOCATION:
                await self._reconcile(snapshot, lease)
            elif decision.kind is RecoveryDecision.RESUME_CONTROLLER:
                await self._resume_controller(snapshot, lease)
            elif decision.kind is RecoveryDecision.PAUSE:
                await self._repository.pause_for_recovery(
                    task_id=task_id,
                    reason=decision.reason,
                    lease=lease,
                )
        finally:
            await self._leases.release_if_owner(lease)
```

`decide_recovery()` 应是纯函数或接近纯函数：输入为已加载的任务、Checkpoint、调用、结果、审批与取消事实，输出为受限的恢复决策。下游查询和数据库写入放在明确分支中，使测试可以覆盖每一种组合。

恢复器每次调用 Tool Runtime 或尝试提交数据库前都应检查租约。长时间模型调用、工具等待或大量文件处理不应持有一个永不验证的“本地布尔锁”。

### 12.1 恢复后从哪里进入 Loop

恢复不会把任务直接赋值为 `running`。第 3 课规定 `paused -> planning`，原因是恢复后仍需重新检查输入版本、授权、审批、环境和观察事实。

因此，对于没有未决副作用、且恢复条件满足的任务，恢复器提交受控的 `resume` 命令，使状态进入 `planning`，再由第 4 课的 Controller 装配新 Observation。它可以引用保存的计划和结果，但不能把旧模型的下一句自然语言当作当前行动指令。

## 十三、优雅退出不是可选优化

进程重启是常态：部署滚动升级、实例被驱逐、依赖故障和运维操作都会发生。优雅退出应尽量把活跃任务推进到下一条一致边界，而不是依赖操作系统“等一会儿”。

一个 Worker 收到终止信号后应：

1. 停止领取新的任务和新的队列消息；
2. 标记本地驱动器进入 draining，停止产生新的 Action；
3. 对正在等待的外部调用，先持久化已知 `dispatched` 或结果事实；
4. 在限定时间内完成当前短事务，不能为了完成模型回合无限延迟退出；
5. 使用 `owner_id + fencing_token` 条件释放租约，或让其自然过期；
6. 退出后由其他 Worker 按同样的恢复决策接管。

条件释放很重要。A 的退出钩子不能删除已经被 B 接管的租约：

```sql
DELETE FROM task_leases
WHERE task_id = :task_id
  AND owner_id = :owner_id
  AND fencing_token = :fencing_token;
```

优雅退出降低恢复成本，但不是正确性的唯一来源。进程可能被强制终止，任何安全性结论都必须仍然由事务、租约、fence、幂等键和恢复对账保证。

## 十四、编写恢复合同测试

恢复测试不能只模拟“重启后任务最终完成”。它需要在每个持久化边界注入退出，并断言不会出现重复副作用或错误状态。

### 14.1 Checkpoint 与任务事实原子提交

```python
async def test_dispatched_state_and_checkpoint_commit_together(session) -> None:
    task, invocation = await create_ready_invocation(session)

    async with session.begin():
        updated = await repository(session).mark_tool_dispatched(
            task_id=task.task_id,
            expected_version=task.version,
            invocation_id=invocation.invocation_id,
            fencing_token=7,
        )
        await checkpoints(session).append_for_current_task(
            task=updated,
            draft=awaiting_result_draft(invocation),
        )

    saved = await repository(session).get_task(task.task_id)
    checkpoint = await checkpoints(session).latest(task.task_id)
    assert saved.status == "waiting_tool"
    assert checkpoint.task_version == saved.version
    assert checkpoint.resume_cursor["invocation_id"] == invocation.invocation_id
```

再让 `append_for_current_task()` 抛出数据库错误，断言任务仍处于原状态、调用未标记 `dispatched`，任务事件也没有新增。只有失败路径也回滚，才证明 Checkpoint 属于一致边界。

### 14.2 过期 Checkpoint 不会驱动恢复

```python
async def test_recovery_rejects_checkpoint_behind_task_version(session) -> None:
    task = await create_task(session, status="running", version=9)
    await create_checkpoint(session, task_id=task.task_id, task_version=8)

    with pytest.raises(StaleCheckpoint):
        await recovery(session).load_verified_snapshot(task.task_id)
```

在真实恢复服务中，可以将这一异常转换为“从当前投影确定性重建 Checkpoint”；但测试必须断言它不会使用版本 8 的游标重发版本 9 中已经处理过的调用。

### 14.3 两个 Worker 只能有一个有效代次

至少覆盖：

- 两个 Worker 同时尝试取得过期租约，只有一个获得成功；
- A 的心跳在 B 接管后返回零行；
- A 使用旧 fence 提交状态更新时被拒绝；
- A 的退出钩子不能删除 B 的租约；
- 任务版本冲突时，即使租约仍有效也不能覆盖新状态。

可用一个固定的数据库时钟或可注入的 `Clock` 控制过期时间，避免测试依赖真实睡眠。SQLite 适合检查大部分 Repository 契约，但与生产 PostgreSQL 不同的并发和锁语义仍应通过集成环境覆盖。

### 14.4 未知结果绝不自动复制副作用

为一个“创建远程变更请求”的工具准备以下场景：

1. 本地只有 `accepted` 调用，恢复后可以使用原键首次调度；
2. 已有 `dispatched` 事件，下游查询返回成功，恢复器只写入一次权威结果；
3. 查询返回运行中，恢复器不发起第二个请求；
4. 查询在保证保留期内返回未找到，工具契约允许时才用同一键重送；
5. 下游不可查询或保留期不确定，任务进入 `paused(unknown_side_effect)`；
6. 同一回调重复到达，结果唯一约束保证只保留一份事实。

测试断言不应只看 API 返回码，还要检查：外部 fake 收到的幂等键集合、`ToolResult` 数量、任务事件序号、任务版本、Checkpoint 游标和最终暂停原因。

## 十五、串联一次重启时间线

以“在授权目录中应用小修复并运行测试”为例：

```text
seq=12  action.accepted(invocation=i7, key=tool:i7)
        Checkpoint v12: ready_to_dispatch(i7)

seq=13  tool.dispatched(invocation=i7, fence=22)
        task.status = waiting_tool
        Checkpoint v13: awaiting_tool_result(i7)

        远程 apply_patch 已接收请求，Worker 崩溃

Worker B 取得 lease，fence=23
        读取 Checkpoint v13 和 invocation i7
        以 key=tool:i7 查询 apply_patch

远程返回 succeeded(change_id=c9)

seq=14  tool.resolved(invocation=i7, result=succeeded)
        step.status = succeeded
        task.status = running
        Checkpoint v14: after_tool_result(step=s3)

seq=15  action.accepted(invocation=i8, tool=run_test)
        Checkpoint v15: ready_to_dispatch(i8)
```

注意 B 没有重新执行 `apply_patch`，即使它没有看到 A 的内存。它只相信已经提交的 `tool.dispatched`、稳定幂等键和远程查询结果。若远程系统无法返回 `c9`，本次任务应停在人工可解释的暂停状态，而不是虚构“补丁未应用”。

## 十六、常见错误

| 错误 | 正确处理 |
| --- | --- |
| 重启后直接从头执行 Agent Loop | 读取当前投影、Checkpoint 和未决调用，先做恢复决策 |
| 把每条事件都当作可恢复快照 | 只在一致、安全边界创建 Checkpoint |
| 提交任务状态后异步补写 Checkpoint | 将相关状态、事件和 Checkpoint 放进同一事务 |
| `tool.dispatched` 后直接重发请求 | 先按幂等键查询或对账，未知则暂停 |
| 用内存 mutex 防止双 Worker | 使用数据库租约、条件写入和任务版本 |
| 租约过期就认为旧 Worker 已停止 | 使用 fencing token 拒绝迟到的写入和动作 |
| 生成新的幂等键来“恢复”调用 | 必须复用原键，新的键代表新的业务动作 |
| 用本机时间判断租约过期 | 使用数据库时钟或统一可信时钟 |
| 退出时无条件删除租约 | 按 owner 和 fence 条件释放，或自然过期 |
| 结果未知就把步骤改回 `pending` | 保留调用事实，查询、补偿或进入人工处理 |
| Checkpoint 保存完整 Prompt 和工具输出 | 保存稳定游标与引用，内容留在受控存储 |
| 把恢复理解成绕过审批的捷径 | 恢复时重新校验授权、审批、取消和状态机守卫 |

## 十七、课堂练习

### 练习一：划分 Checkpoint 边界

对下面每个时刻判断“是否应提交 Checkpoint”，并写出其中的恢复游标：

1. 模型正在流式生成计划文本；
2. Controller 已接受计划并写入三个步骤；
3. 调用已通过权限校验，但 Invocation 还没有写入数据库；
4. `tool.dispatched` 已提交，远程调用尚未返回；
5. 工具结果已经写入对象存储，但数据库事务还未提交结果引用；
6. 任务因审批等待进入 `waiting_approval`。

参考判断：场景 2、4 和 6 应提交；场景 1、3 和 5 不是一致边界。场景 5 需要先让对象引用稳定，再与结果、状态、事件和 Checkpoint 一起提交数据库事实。

### 练习二：设计恢复矩阵

为以下工具补齐 `recovery_strategy`，并说明为什么：

| 工具 | 能力 | 建议策略 |
| --- | --- | --- |
| `search_code` | 只读、可重新执行 |  |
| `create_issue` | 支持客户端幂等键和按键查询 |  |
| `deploy_release` | 有外部发布 ID，可按 ID 查询 |  |
| `send_email` | 不支持幂等键，只有最终投递日志 |  |

一种合理答案是：`search_code` 可标记为受预算约束的 `retry_idempotent`；`create_issue` 使用 `query_by_key`；`deploy_release` 先查询发布 ID；`send_email` 在结果未知时需要 `manual`，除非邮件服务新增可验证的幂等发送契约。

### 练习三：评审错误的租约实现

指出下面代码至少四个问题：

```python
lease = await db.get(Lease, task_id)
if lease is None or lease.expires_at < datetime.now():
    lease.owner_id = worker_id
    lease.expires_at = datetime.now() + timedelta(minutes=5)
    await db.commit()
    await run_task(task_id)
```

应至少指出：先读后写存在竞态；使用本机时钟；没有 fence；没有条件续约；租约时间过长且没有心跳；没有任务版本校验；`run_task` 没有检查未决调用；退出后可能由旧 Worker 继续写入。

### 练习四：补全故障注入测试

为一次支持幂等键的写工具设计故障注入点：

- 事务 A 提交前；
- 事务 B 提交后、网络请求前；
- 请求已到达下游、响应返回前；
- 事务 C 插入结果前；
- Worker A 租约过期、Worker B 接管后；
- 优雅退出释放租约时。

每个点都写出预期：是否允许重新调度、是否必须查询、是否应暂停，以及需要断言哪些任务事件、结果和 fence。

## 十八、完成标准

完成本课后，你应该能够：

- 解释当前投影、事件、领域记录和 Checkpoint 的不同职责；
- 只在任务事实一致、可安全恢复的边界创建 Checkpoint；
- 在一个事务中提交状态变化、事件和对应 Checkpoint；
- 为恢复游标保存计划、步骤、调用和幂等键的稳定身份；
- 用租约防止多个正常 Worker 同时推进同一任务；
- 用 fencing token 阻止过期 Worker 继续提交或发起新动作；
- 在 `tool.dispatched` 无结果时先查询、等待或暂停，而不是盲目重试；
- 让恢复重新经过授权、审批、取消和状态机守卫；
- 通过事务回滚、过期租约、重复恢复和未知副作用测试证明恢复协议成立。

## 十九、本课小结

可恢复的 Agent 不是“数据库里有一条未完成任务”，而是一套明确的恢复协议：

```text
一致的 Task / Step / Invocation / Result / Event
  + 可验证的 Checkpoint 游标
  + 有时效的 Worker 租约与 fencing token
  + 幂等键、结果查询和未知副作用暂停策略
  = 进程退出后仍可安全继续的 Agent Loop
```

Checkpoint 让恢复器知道可以相信哪一个已提交边界，租约和 fence 让它知道谁有资格推进，幂等键与结果查询让它在外部调用不确定时不重复制造副作用。恢复的目标不是尽快让任务继续，而是在事实不足时明确停下。

下一课会讨论当恢复得到新证据、原计划已经不再合适时，如何创建新计划版本、处理步骤依赖，并保留旧计划与已确认执行事实。
