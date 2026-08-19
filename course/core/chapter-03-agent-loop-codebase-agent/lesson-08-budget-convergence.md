# 第 8 课：实现预算、重复检测与收敛终止

> 章节导航：[第三章：Agent Loop、State、Harness 与 Codebase Agent](./index.md)  
> 上一课：[第 7 课：实现动态重规划与步骤依赖](./lesson-07-replanning-dependencies.md)  
> 下一课：[第 9 课：建立 Sandbox 文件与工作区边界](./lesson-09-sandbox-workspace-boundary.md)

## 一、你将完成什么

第 7 课让计划可以在新证据出现后生成版本化的 DAG，但“计划能变化”不等于“系统可以无限尝试”。一个搜索结果不断为空、一个测试反复失败、一个 Planner 不断提出等价步骤的任务，如果没有明确边界，就会持续消耗 Token、工具配额和运行时间，最后还可能重复执行有副作用的动作。

本课为 Agent Loop 加入预算、重复检测、无进展识别和安全终止。完成后，你应该能够：

1. 为任务、计划、步骤和单次 Action 建立层级预算，并解释预留、结算和释放的区别；
2. 在真正派发工具前做原子预算检查，避免并发 Worker 超卖配额；
3. 用稳定的动作指纹和结果指纹识别重复尝试，同时保留合法重试的空间；
4. 区分“动作重复”“证据没有新增”“状态没有向完成标准靠近”三类无进展；
5. 设计有优先级的终止决策，让取消、未知副作用、完成和预算耗尽都可解释；
6. 在 Checkpoint 和重启恢复后正确恢复预算预留、重复历史和收敛窗口；
7. 通过合同测试证明任务不会无限循环，也不会因为检测逻辑而重放未经确认的写操作。

## 二、本课内容边界

本课只解决一个核心问题：**在计划可重排、工具结果可能失败且执行进程可重启的前提下，平台如何用有限资源推动任务收敛，并在不安全或无进展时停止。**

本课会完成：

- 预算维度、层级和扣减协议；
- 预算预留、结算、过期预留和并发竞争；
- Action、参数和结果的重复指纹；
- 进展信号、停滞窗口和重规划上限；
- 终止原因、可恢复暂停和安全终态；
- 与第 6、7 课的 Checkpoint、重规划、租约和未知工具结果协作；
- 面向预算、重复、无进展和恢复优先级的测试。

本课不会展开：

- Sandbox 中 CPU、内存、磁盘和进程的硬隔离；
- Token 计费供应商的账单对账和跨组织结算；
- 复杂的语义相似度模型、向量数据库和长期记忆；
- 多 Agent 之间的预算分配和跨任务全局调度；
- 如何取消已经启动的进程或回收网络资源；
- Codebase Agent 的代码检索、补丁生成和测试交付。

第 9 至 11 课会把本课的时间、资源和终止意图落实到 Sandbox；第 12 课再把预算策略接入可替换的 Harness。今天先建立与模型、工具实现无关的控制契约。

## 三、没有预算的 Loop 为什么一定会失控

一个原型 Loop 往往长这样：

```python
while not state.done:
    action = await planner.next_action(state)
    result = await runtime.execute(action)
    state = state.apply(result)
```

它遗漏了至少五个问题：

1. `planner.next_action()` 可能每次都返回相同动作；
2. 并发 Worker 可能同时认为剩余预算足够，并各自派发一次调用；
3. 工具超时后，系统无法区分“可安全重试”和“副作用未知”；
4. 计划修订可能重置步骤计数，让总尝试次数被隐形绕过；
5. Loop 只知道 `done`，没有办法解释是完成、取消、预算耗尽还是需要人工恢复。

因此，终止不是在循环末尾追加一个 `if count > 10`，而是贯穿一次回合的控制流程：

```text
读取当前事实与预算
  -> 判断是否已满足终止条件
  -> 为候选 Action 计算成本并原子预留
  -> 派发或进入审批/恢复边界
  -> 确认结果并结算预留
  -> 更新观察、进展信号和重复历史
  -> 决定继续、重规划、暂停或结束
```

平台要保证的是：**任何一次可计费、可消耗资源或可能产生副作用的动作，都不能绕过“允许执行”的控制点。**

## 四、预算是任务不变量，不是 Planner 建议

### 4.1 预算维度

第一版实现不需要覆盖所有供应商指标，但应把常见消耗拆成可以单独观察和拒绝的维度：

| 维度 | 计量单位 | 典型限制 | 超限后的默认处理 |
| --- | --- | --- | --- |
| `turns` | 次 | 模型观察-决策回合数 | 暂停或终止，不再调用模型 |
| `wall_time_ms` | 毫秒 | 任务从开始到现在的总时长 | 进入 `budget_exhausted` |
| `model_input_tokens` | token | 输入上下文累计量 | 压缩上下文或暂停 |
| `model_output_tokens` | token | 模型输出累计量 | 停止生成下一步 |
| `tool_calls` | 次 | 所有 ToolCall 尝试次数 | 拒绝新 Action |
| `tool_cost_micros` | 微单位货币 | 工具供应商或 Sandbox 费用 | 暂停并提示预算不足 |
| `replans` | 次 | 计划版本数量或重规划次数 | 要求人工确认或失败 |
| `same_action_repeats` | 次 | 同一动作在窗口内的重复次数 | 阻断动作，进入收敛处理 |

这些维度不能只由模型输出的 JSON 控制。模型可以请求“再搜索一次”，但不能把 `tool_calls` 设回零，也不能声称本次调用成本为零。消耗应由 Gateway、Tool Runtime、Sandbox 或 Controller 根据可信执行结果记录。

### 4.2 硬预算和软预算

预算可以分成两类：

- **硬预算**：超过后绝不允许发起新动作，例如最大工具调用次数、最大总时长和最大费用；
- **软预算**：达到后先改变策略，例如上下文 Token 接近上限时压缩历史，剩余费用较少时只允许只读工具。

软预算也必须有硬上限。所谓“模型自己判断差不多了”不能替代平台拒绝条件。策略输出可以缩减候选集合，但最终是否允许执行仍由 Controller 决定。

### 4.3 层级预算

预算应沿任务谱系向下分配，而不是每个计划重新获得一份完整配额：

```text
Task Budget
  ├── Plan reservation (P1, P2, ...)
  │     ├── Step reservation
  │     │     └── Action reservation
  │     └── Replan allowance
  └── Shared global guard (租户/队列级)
```

`P2` 替代 `P1` 时，已消耗的 `P1` 工具次数仍属于同一个任务；未使用的预留可以按协议释放回任务余额，但不能把历史消耗抹掉。计划版本是执行语义的版本，不是预算账本的重置按钮。

## 五、定义可持久化的预算模型

下面的示例放在 `apps/api/app/agents/budget/models.py`。教学实现用整数表示 token、毫秒和微单位货币，避免浮点数比较造成边界错误。

```python
from dataclasses import dataclass
from enum import StrEnum


class BudgetDimension(StrEnum):
    TURNS = "turns"
    WALL_TIME_MS = "wall_time_ms"
    MODEL_INPUT_TOKENS = "model_input_tokens"
    MODEL_OUTPUT_TOKENS = "model_output_tokens"
    TOOL_CALLS = "tool_calls"
    TOOL_COST_MICROS = "tool_cost_micros"
    REPLANS = "replans"


@dataclass(frozen=True)
class BudgetLimit:
    turns: int
    wall_time_ms: int
    model_input_tokens: int
    model_output_tokens: int
    tool_calls: int
    tool_cost_micros: int
    replans: int


@dataclass(frozen=True)
class BudgetUsage:
    turns: int = 0
    wall_time_ms: int = 0
    model_input_tokens: int = 0
    model_output_tokens: int = 0
    tool_calls: int = 0
    tool_cost_micros: int = 0
    replans: int = 0

    def add(self, delta: "BudgetUsage") -> "BudgetUsage":
        return BudgetUsage(
            turns=self.turns + delta.turns,
            wall_time_ms=self.wall_time_ms + delta.wall_time_ms,
            model_input_tokens=self.model_input_tokens + delta.model_input_tokens,
            model_output_tokens=self.model_output_tokens + delta.model_output_tokens,
            tool_calls=self.tool_calls + delta.tool_calls,
            tool_cost_micros=self.tool_cost_micros + delta.tool_cost_micros,
            replans=self.replans + delta.replans,
        )


@dataclass(frozen=True)
class BudgetSnapshot:
    task_id: str
    limit: BudgetLimit
    committed: BudgetUsage
    reserved: BudgetUsage
    version: int

    def remaining(self) -> BudgetUsage:
        return BudgetUsage(
            turns=self.limit.turns - self.committed.turns - self.reserved.turns,
            wall_time_ms=self.limit.wall_time_ms
            - self.committed.wall_time_ms
            - self.reserved.wall_time_ms,
            model_input_tokens=self.limit.model_input_tokens
            - self.committed.model_input_tokens
            - self.reserved.model_input_tokens,
            model_output_tokens=self.limit.model_output_tokens
            - self.committed.model_output_tokens
            - self.reserved.model_output_tokens,
            tool_calls=self.limit.tool_calls
            - self.committed.tool_calls
            - self.reserved.tool_calls,
            tool_cost_micros=self.limit.tool_cost_micros
            - self.committed.tool_cost_micros
            - self.reserved.tool_cost_micros,
            replans=self.limit.replans - self.committed.replans - self.reserved.replans,
        )
```

生产数据库至少需要保存：

| 表/字段 | 作用 |
| --- | --- |
| `task_budgets` | 每个任务的限制、已结算使用量、版本和状态 |
| `budget_reservations` | 尚未结算的 Action/回合预留，带唯一 `reservation_id` |
| `budget_ledger` | 每次结算、释放和修正的追加账本 |
| `budget_dimension` | 账本记录对应的维度 |
| `source_id` | 关联 `turn_id`、`action_id`、`invocation_id` 或 `plan_id` |
| `idempotency_key` | 防止重复结算同一结果 |

账本是审计事实，快照是快速查询投影。不能只更新 `task_budgets.used` 而不保留来源；否则无法解释一次预算耗尽是由哪一批工具调用造成的，也无法在恢复时判断预留是否已经处理。

## 六、预算预留、结算与释放

### 6.1 为什么要预留

如果两个 Worker 同时读取“还剩一次工具调用”，然后各自执行一次，就会超出任务上限。正确协议是先在数据库中原子预留：

```text
读取任务版本、租约和当前预算
  -> 计算候选 Action 的上界成本
  -> UPDATE ... WHERE remaining >= reservation
  -> 创建唯一 reservation
  -> COMMIT
  -> 才允许派发工具
```

预留成功代表“平台已经为这次动作留出额度”，不代表工具已经执行。网络调用成功后，Controller 以相同 `reservation_id` 结算实际成本；调用未发生或被策略拒绝时，释放尚未消耗的部分。

### 6.2 成本上界和实际成本

在派发之前通常只知道上界：模型最大输出 Token、工具可能的最大费用、Sandbox 最大运行时间。预留应使用不会被低估的上界：

```python
estimate = CostEstimate(
    model_input_tokens=prompt_tokens,
    model_output_tokens=provider.max_output_tokens,
    tool_calls=1,
    tool_cost_micros=tool_policy.max_cost_micros,
)
```

结果返回后再用可信计量结算。若实际成本高于预留上界，不能悄悄把余额变成负数，应记录 `budget_overrun`，阻止后续动作，并保留供应商计量、请求 ID 和审计事件。

### 6.3 预留状态机

```text
reserved -> committed
       \-> released
       \-> expired -> recovery_required
```

- `reserved`：事务已提交，但对应 Action 尚未有最终计量；
- `committed`：使用量已写入账本，不能再次结算；
- `released`：确认动作没有发生，额度归还；
- `expired`：Worker 租约或预留 TTL 到期，不能自动当作未执行；
- `recovery_required`：外部调用状态未知，先对账再决定结算或释放。

`expired` 与 `released` 不能混为一谈。租约过期只说明当前 Worker 不再拥有写入权，不说明网络调用没有发生。

### 6.4 原子预留接口

```python
async def reserve_action(
    session, *, task_id: str, action_id: str,
    estimate: BudgetUsage, expected_task_version: int, fence: int,
) -> str:
    async with lock_task_budget(session, task_id):
        await assert_lease(session, task_id, fence)
        await assert_task_version(session, task_id, expected_task_version)
        snapshot = await read_budget_snapshot(session, task_id)
        if exceeds(estimate, snapshot.remaining()):
            raise BudgetExceeded(exceeded_dimensions(estimate, snapshot.remaining()))
        reservation_id = new_id("res")
        await insert_reservation(
            session, reservation_id=reservation_id, task_id=task_id,
            action_id=action_id, estimate=estimate, fence=fence,
        )
        await append_event(session, task_id, "budget.reserved", {
            "reservation_id": reservation_id, "action_id": action_id,
        })
        return reservation_id
```

`lock_task_budget()` 可以使用行锁或等价的条件更新。无论采用哪种数据库，必须让“检查剩余量”和“增加 reserved”处于同一个并发控制边界。只在 Python 内存中加锁无法保护多个进程。

## 七、预算检查应放在哪些边界

预算不是一个单一的 `before_loop()` 检查。至少需要在以下位置检查：

| 边界 | 检查内容 | 失败后的动作 |
| --- | --- | --- |
| 接受新计划 | `replans`、候选步骤上界、任务版本 | 拒绝候选或暂停 |
| 开始模型回合 | `turns`、输入 Token 上界、总时长 | 不调用模型，写终止事件 |
| 接受 Action | 工具次数、工具成本上界、重复阈值 | 拒绝 Action 或转人工 |
| 派发外部调用 | 预留存在、租约和 fence 有效 | 不派发，进入恢复/重试 |
| 结果结算 | 实际 Token、时间、费用与预留一致性 | 结算并可能立即终止 |
| 重启恢复 | 未结算预留、任务开始时间、租约 | 对账后恢复或暂停 |

这几个检查不是重复劳动：计划接受时看的是潜在消耗，动作派发时看的是当前并发事实，结果结算时看的是实际消耗，恢复时看的是预留与外部副作用的对应关系。

## 八、重复检测：识别相同尝试，而不是禁止所有重试

### 8.1 三种重复

应至少区分三种信号：

1. **精确动作重复**：相同计划版本、步骤、工具和规范化参数再次出现；
2. **等价观察重复**：工具返回的状态或错误指纹与最近若干次相同，没有新增证据；
3. **失败模式重复**：不同参数或步骤最终落入同一个不可恢复的错误分类。

它们的严重程度不同。精确的只读搜索可以允许一次短暂重试；已发出的写操作不能因为“看起来重复”就再次发送；失败模式重复通常应该触发重规划、缩小范围或人工接管。

### 8.2 动作指纹

指纹必须由平台生成，并在执行前固定。不要把整个 Prompt 或包含时间戳的原始 JSON 直接哈希，否则同一动作会因为字段顺序或无关元数据不同而无法识别。

```python
import hashlib
import json

VOLATILE_ARGUMENTS = {"request_id", "timestamp", "trace_id"}


def canonicalize(value):
    if isinstance(value, dict):
        return {
            key: canonicalize(item)
            for key, item in sorted(value.items())
            if key not in VOLATILE_ARGUMENTS
        }
    if isinstance(value, list):
        return [canonicalize(item) for item in value]
    return value


def action_fingerprint(action: Action) -> str:
    payload = {
        "task_id": action.task_id,
        "plan_id": action.plan_id,
        "step_id": action.step_id,
        "kind": action.kind,
        "tool_name": action.tool_name,
        "arguments": canonicalize(dict(action.arguments)),
        "authorization_scope_hash": action.authorization_scope_hash,
    }
    encoded = json.dumps(payload, ensure_ascii=False, sort_keys=True).encode()
    return hashlib.sha256(encoded).hexdigest()
```

建议同时保存 `plan_action_fingerprint` 和不含 `plan_id` 的 `semantic_action_fingerprint`：前者限制步骤内重复，后者发现跨计划等价动作。新计划中的相同只读检查可能合法，但相同写动作必须经过更严格的幂等和审批检查。

### 8.3 结果指纹与证据新颖度

结果指纹只对可比较的稳定部分做哈希。完整输出应存为受控 Artifact，指纹用于比较而不是替代内容：

```python
def observation_fingerprint(observation: Observation) -> str:
    payload = {
        "status": observation.task_status,
        "facts": sorted(observation.normalized_facts.items()),
        "evidence_refs": sorted(observation.evidence_refs),
        "failure_class": observation.failure_class,
    }
    return sha256_json(payload)
```

日志中的时间戳、随机 ID 和临时目录名应该在归一化阶段去除。相反，文件行号、测试失败集合、Artifact 版本、状态迁移和完成标准中的已确认字段，通常是有意义的新证据。

### 8.4 重复检测的决策表

| 信号 | 动作性质 | 默认决策 |
| --- | --- | --- |
| 第一次相同只读动作，短暂超时 | 无副作用 | 允许一次受控重试 |
| 相同动作已成功且结果仍有效 | 只读 | 复用 Artifact，不再调用 |
| 相同写动作已有 `resolved=succeeded` | 有副作用 | 读取原结果，禁止重发 |
| 相同写动作只有 `dispatched` | 有副作用未知 | 先按幂等键对账 |
| 相同失败指纹连续出现 | 任意 | 触发重规划或暂停 |
| 不同动作但观察指纹不变 | 任意 | 计入无进展窗口 |
| 同一计划被重复提出 | 计划层 | 消耗重规划预算并拒绝等价候选 |

重复检测的结果必须写入事件和账本。只在内存中计数会在重启后丢失，导致恢复器再次尝试已经达到重复阈值的动作。

## 九、无进展识别：任务没有靠近完成标准

重复是“做了相同的事”，无进展是“做了事但任务事实没有向完成标准靠近”。二者相关但不等价：Agent 可能每次调用不同工具，却始终读取同一个错误目录；也可能生成不同计划，却没有产出新 Artifact。

### 9.1 进展向量

把完成标准拆成可观察的字段，形成单调或可比较的进展向量：

```python
from dataclasses import dataclass


@dataclass(frozen=True)
class ProgressVector:
    completed_requirements: frozenset[str]
    evidence_refs: frozenset[str]
    succeeded_steps: frozenset[str]
    unresolved_failures: frozenset[str]
    pending_questions: frozenset[str]
    verification_level: int

    def score(self) -> tuple[int, int, int, int, int, int]:
        return (
            len(self.completed_requirements),
            len(self.evidence_refs),
            len(self.succeeded_steps),
            -len(self.unresolved_failures),
            -len(self.pending_questions),
            self.verification_level,
        )
```

`score()` 不是为了制造神秘的总分，而是为了比较两个观察快照是否至少有一项可靠信号改善，且没有撤销已确认事实。生产实现可以使用布尔条件和集合变化，不必强行把所有任务压成单个数字。

### 9.2 什么算进展

通常算进展：

- 新的、与任务相关的 Artifact 被确认；
- 未完成步骤变为 `succeeded`，或新的步骤进入可解释的 `blocked`；
- 完成标准中的一个条件被验证；
- 失败分类从“未知”变为具体且可处理的类别；
- 观察范围缩小，并排除了一个候选路径；
- 新计划明确改变了已失效的前置假设。

通常不算进展：

- 只有 Trace ID、时间戳、Token 计数变化；
- 模型措辞变化但没有新平台事实；
- 重复读取同一个 Artifact 且没有新的选择器或范围；
- 同一失败分类、同一文件集合和同一测试集合持续出现；
- 计划版本增加，但图结构、输入证据和可执行动作完全等价。

### 9.3 停滞窗口

不能因为单个回合没有新 Artifact 就马上终止。为每个任务保存一个停滞窗口：

```json
{
  "baseline_observation_version": 18,
  "last_progress_observation_version": 18,
  "unchanged_observations": 0,
  "unchanged_action_fingerprints": 0,
  "unchanged_failure_fingerprints": 0,
  "threshold": 3
}
```

建议按状态采用不同阈值：

| 当前状态 | 默认处理 |
| --- | --- |
| `waiting_tool` | 不计入无进展，直到超时或收到结果 |
| `waiting_approval` | 不计入无进展，等待审批策略处理 |
| `planning` | 连续等价计划达到阈值后拒绝候选 |
| `running` | 连续无新证据达到阈值后暂停或重规划 |
| `recovering` | 先完成未知调用对账，不依赖停滞阈值 |

停滞阈值属于任务级事实，重规划不能把它清零。最多允许一次“纠偏重规划”，新计划仍无可信进展时应暂停或人工接管。

## 十、收敛不是单纯“达到最大步数就停”

### 10.1 三组终止条件

任务至少需要三组终止条件：

```text
完成条件：用户要求的事实或交付产物已被验证
失败条件：在当前权限和资源范围内无法完成，原因已分类
安全停止条件：继续执行可能重复副作用、超出预算或无法判断外部状态
```

安全停止不是把任务伪装成失败。建议使用明确的终止原因：

```python
class StopReason(StrEnum):
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    BUDGET_EXHAUSTED = "budget_exhausted"
    REPEATED_ACTION = "repeated_action"
    NO_PROGRESS = "no_progress"
    MAX_REPLANS = "max_replans"
    UNKNOWN_SIDE_EFFECT = "unknown_side_effect"
    NEEDS_APPROVAL = "needs_approval"
    NEEDS_INPUT = "needs_input"
    LEASE_LOST = "lease_lost"
```

`needs_approval`、`needs_input` 和部分 `unknown_side_effect` 更适合映射到可恢复暂停态；其余原因通常是任务终态或需要人工重新打开的终态。第 3 课的状态机应定义这种映射，不能让每个策略自行写字符串。

### 10.2 终止决策的优先级

推荐顺序如下：

```text
1. 取消已确认                 -> cancelled
2. 未知副作用                 -> recovering / paused_unknown_side_effect
3. 已满足完成标准             -> completed
4. 需要用户输入或审批         -> waiting_*
5. 硬预算耗尽                 -> budget_exhausted
6. 租约失效或版本过期         -> 交给恢复器，不写执行结果
7. 重复动作阈值               -> paused_needs_review 或 failed
8. 无进展阈值                 -> replan_once 或 paused_needs_review
9. 没有 ready 步骤             -> 依赖分类、重规划或 failed
10. 仍有可执行步骤             -> 继续下一回合
```

安全优先于效率，已确认完成优先于“为了更漂亮而继续跑”。如果用户已经取消，即使还有剩余预算，也不能再调用工具；如果有未决写调用，即使 Planner 提出更好的方案，也必须先完成恢复对账。

### 10.3 只读动作与写动作

- 只读搜索、读取文件、静态分析通常可以短暂重试，但必须受工具次数和时间限制；
- 生成补丁、写文件、创建工单、发布消息等动作必须使用唯一 Action 和幂等键，结果未知时暂停而不是重发；
- 删除、发布、迁移等高风险动作在重复或无进展时应直接进入审批或人工恢复，不应自动换参数继续试。

## 十一、实现收敛控制器

### 11.1 纯函数决策接口

```python
from dataclasses import dataclass
from enum import StrEnum


class DecisionKind(StrEnum):
    CONTINUE = "continue"
    REPLAN = "replan"
    PAUSE = "pause"
    STOP = "stop"
    RECOVER = "recover"


@dataclass(frozen=True)
class ConvergenceState:
    completion_satisfied: bool
    cancel_requested: bool
    unknown_side_effect: bool
    waiting_for_approval: bool
    waiting_for_input: bool
    budget_exhausted_dimensions: tuple[str, ...]
    repeated_action_count: int
    repeated_action_limit: int
    unchanged_observations: int
    no_progress_limit: int
    ready_step_ids: tuple[str, ...]
    replans_used: int
    replan_limit: int
    lease_valid: bool


@dataclass(frozen=True)
class ConvergenceDecision:
    kind: DecisionKind
    reason: StopReason | None = None
    step_ids: tuple[str, ...] = ()


def decide_next(state: ConvergenceState) -> ConvergenceDecision:
    if state.cancel_requested:
        return ConvergenceDecision(DecisionKind.STOP, StopReason.CANCELLED)
    if state.unknown_side_effect:
        return ConvergenceDecision(DecisionKind.RECOVER, StopReason.UNKNOWN_SIDE_EFFECT)
    if state.completion_satisfied:
        return ConvergenceDecision(DecisionKind.STOP, StopReason.COMPLETED)
    if state.waiting_for_approval:
        return ConvergenceDecision(DecisionKind.PAUSE, StopReason.NEEDS_APPROVAL)
    if state.waiting_for_input:
        return ConvergenceDecision(DecisionKind.PAUSE, StopReason.NEEDS_INPUT)
    if state.budget_exhausted_dimensions:
        return ConvergenceDecision(DecisionKind.STOP, StopReason.BUDGET_EXHAUSTED)
    if not state.lease_valid:
        return ConvergenceDecision(DecisionKind.RECOVER, StopReason.LEASE_LOST)
    if state.repeated_action_count >= state.repeated_action_limit:
        return ConvergenceDecision(DecisionKind.PAUSE, StopReason.REPEATED_ACTION)
    if state.unchanged_observations >= state.no_progress_limit:
        if state.replans_used < state.replan_limit:
            return ConvergenceDecision(DecisionKind.REPLAN, StopReason.NO_PROGRESS)
        return ConvergenceDecision(DecisionKind.PAUSE, StopReason.NO_PROGRESS)
    if not state.ready_step_ids:
        return ConvergenceDecision(DecisionKind.STOP, StopReason.FAILED)
    return ConvergenceDecision(DecisionKind.CONTINUE, step_ids=state.ready_step_ids)
```

这里的 `not ready_step_ids` 只是保守兜底。生产实现还应区分“所有步骤成功”“被依赖失败阻塞”“等待未知结果”和“计划图非法”，而不是一律标成 `failed`。

### 11.2 一次回合的 Controller 伪代码

```python
async def run_turn(task_id: str, worker: WorkerIdentity) -> None:
    snapshot = await repository.load_control_snapshot(task_id)
    decision = decide_next(snapshot.convergence)

    if decision.kind is DecisionKind.RECOVER:
        await recovery.resume_or_pause(task_id, decision.reason)
        return
    if decision.kind is DecisionKind.STOP:
        await lifecycle.finish(task_id, decision.reason)
        return
    if decision.kind is DecisionKind.PAUSE:
        await lifecycle.pause(task_id, decision.reason)
        return
    if decision.kind is DecisionKind.REPLAN:
        await replanning.request_from_stagnation(task_id, snapshot)
        return

    action = await planner.propose_action(snapshot, decision.step_ids)
    await controller.validate_action(action, snapshot)
    estimate = await cost_policy.estimate(action, snapshot)

    async with repository.transaction() as tx:
        reservation_id = await reserve_action(
            tx, task_id=task_id, action_id=action.action_id,
            estimate=estimate, expected_task_version=snapshot.task_version,
            fence=worker.fence,
        )
        invocation = await invocations.accept(
            tx, action=action, reservation_id=reservation_id,
            expected_task_version=snapshot.task_version,
        )
        await checkpoints.append_ready_to_dispatch(tx, invocation)

    try:
        result = await runtime.dispatch(invocation)
    except UnknownDelivery:
        await recovery.mark_unknown(task_id, invocation.invocation_id)
        return

    async with repository.transaction() as tx:
        await budgets.settle(tx, invocation, result)
        await observations.record_result(tx, invocation, result)
        await convergence.record(tx, invocation, result)
        await checkpoints.append_after_result(tx, invocation)
```

模型生成期间，另一个 Worker 可能已经取消任务、激活 P2 或消耗最后一份预算。Action 校验和预算预留必须针对最新快照，不能相信调用模型前的旧内存对象。

### 11.3 预算耗尽的写入协议

预算耗尽本身也是任务事实，至少要原子写入：

```text
task.status = paused 或 failed
task.stop_reason = budget_exhausted
task.budget_version += 1
TaskEvent(kind=budget.exhausted, dimensions=[...])
Checkpoint(kind=budget_exhausted, resume_cursor=人工恢复入口)
```

如果当前存在已 `dispatched` 但未解决的调用，不能直接把任务标为“安全完成”。应保留 `waiting_tool` 或进入 `paused_unknown_side_effect`，预算可以冻结，但恢复器仍要对账。预算耗尽阻止新动作，不会取消已经发生的外部副作用。

## 十二、把预算和收敛状态接入 Checkpoint

第 6 课的 Checkpoint 需要扩展最小恢复游标：

```json
{
  "phase": "after_tool_result",
  "plan_id": "plan-02",
  "observation_version": 21,
  "budget_version": 14,
  "committed_usage": {
    "turns": 7,
    "tool_calls": 5,
    "tool_cost_micros": 1800
  },
  "open_reservation_ids": [],
  "last_action_fingerprint": "sha256:...",
  "unchanged_observations": 1,
  "last_progress_observation_version": 20,
  "resume_strategy": "evaluate_convergence"
}
```

恢复时依次：

1. 校验 `task_version`、`budget_version` 和 `state_hash`；
2. 查找所有 `reserved`、`expired` 和 `recovery_required` 预留；
3. 对关联 Invocation 按第 6 课协议查询或对账；
4. 只对已确认结果结算预算，不能因为 Worker 崩溃就自动释放；
5. 装载重复历史和停滞窗口，重新调用纯函数 `decide_next()`；
6. 若任务已取消、超时或预算耗尽，不恢复模型回合；
7. 若仍可继续，获得新租约和 fence 后再预留下一次 Action。

| 崩溃位置 | 预算状态 | 恢复动作 |
| --- | --- | --- |
| 预留事务前 | 无预留 | 重新计算并尝试预留 |
| 预留已提交、Invocation 未派发 | `reserved` | 校验无外部调用后释放或继续派发 |
| `tool.dispatched` 已提交、结果未知 | `reserved`/`expired` | 查询幂等键，禁止盲目重发 |
| 结果与结算已提交 | `committed` | 使用结果更新观察，不重跑调用 |
| 预算耗尽事件已提交 | 无新动作权限 | 只允许人工恢复或规格变更 |

## 十三、重规划与预算必须共同受限

第 7 课规定重规划创建新版本但继承任务历史。本课再加三条不变量：

1. 每接受一个新计划，至少消耗一次 `replans` 配额；
2. 新计划的候选步骤成本上界不能超过剩余预算；
3. 重规划不能通过复制步骤、重置停滞窗口或新建任务来绕过任务预算。

### 13.1 无进展重规划

可以采用“最多一次纠偏，再观察”的策略：

```text
第一次停滞窗口达到阈值
  -> 生成 trigger=no_progress 的候选计划
  -> 只允许改变已证明无效的假设或动作路径
  -> 消耗一次 replan 预算

新计划仍没有可信进展
  -> 不再自动重规划
  -> paused(no_progress) 或 failed
```

候选计划必须引用导致停滞的 Observation 和动作指纹。如果新计划与旧计划的规范化图、证据和动作集合等价，应在接受前拒绝为 `equivalent_plan`。

### 13.2 候选成本上界

Planner 可以提供成本估计，但 Controller 应做独立上界计算：

```python
def upper_bound(candidate: PlanCandidate) -> BudgetUsage:
    return BudgetUsage(
        turns=max(1, candidate.expected_turns),
        tool_calls=sum(step.max_tool_attempts for step in candidate.steps),
        replans=1,
        tool_cost_micros=sum(step.max_cost_micros for step in candidate.steps),
    )
```

教学阶段优先选择保守上界，并把“预算不足，需要人工增加额度或缩小范围”作为可解释结果。

## 十四、一次完整的收敛时间线

继续使用“定位登录测试失败”的任务，假设任务预算为 12 个回合、8 次工具调用、2 次重规划：

```text
v01  接受 P1，预留规划回合
v02  读取路由成功，新增 route-source Artifact
v03  运行 login 测试失败，得到 config-load-error
v04  P1 的 S3 前置假设失效，接受 P2，replans=1
v05  读取 fixture，新增 fixture-source Artifact
v06  修正配置被审批拒绝，任务进入 waiting_approval
v07  用户批准后，创建新的 Action，不能复用旧审批 Action
v08  重跑测试仍得到同一个 config-load-error
v09  归一化观察指纹与 v03 相同，unchanged=1
v10  P2 提出替代诊断，检查环境变量，得到 environment-missing
v11  新失败分类算作进展，停滞窗口清零
v12  工具调用预算耗尽，任务暂停，写 budget.exhausted
```

最终状态不是“修复成功”，而是：

```text
status = paused
stop_reason = budget_exhausted
verified = false
evidence = [config-load-error, environment-missing]
resume = 人工增加预算或修改任务范围后重新进入 planning
```

如果 v08 之后 Planner 直接再次运行同一个测试十次，系统应在重复阈值处暂停，而不是等到回合预算全部耗尽。预算是最后一道硬边界，重复和无进展是更早、更有诊断价值的收敛信号。

## 十五、合同测试

### 15.1 预算预留的并发测试

```python
async def test_only_one_worker_can_reserve_last_tool_call(db):
    await seed_budget(db, task_id="t1", tool_calls=1)
    barrier = asyncio.Barrier(2)

    async def reserve_from_worker(worker_id: str):
        async with db.transaction() as tx:
            await barrier.wait()
            return await reserve_action(
                tx, task_id="t1", action_id=f"a-{worker_id}",
                estimate=BudgetUsage(tool_calls=1),
                expected_task_version=4, fence=7,
            )

    results = await asyncio.gather(
        reserve_from_worker("a"), reserve_from_worker("b"),
        return_exceptions=True,
    )
    assert sum(isinstance(item, str) for item in results) == 1
    assert sum(isinstance(item, BudgetExceeded) for item in results) == 1
```

测试还应断言只有一个 `budget.reserved` 事件和一条 `budget_reservations` 记录，不能只依赖异常数量。

### 15.2 结算幂等测试

```python
async def test_settlement_is_idempotent(db):
    reservation = await seed_reservation(db, action_id="a1")
    result = ToolResult(invocation_id="i1", usage=BudgetUsage(tool_calls=1))

    await budgets.settle(db, reservation, result)
    await budgets.settle(db, reservation, result)

    usage = await get_usage(db, reservation.task_id)
    assert usage.tool_calls == 1
    assert await count_ledger_rows(db, source_id="i1") == 1
    assert await get_reservation_status(db, reservation.id) == "committed"
```

第二次结算应返回已有结果或明确的幂等成功；若传入不同成本，则应拒绝并记录数据不一致事件。

### 15.3 重复与无进展测试

```python
def test_new_trace_id_does_not_count_as_progress():
    before = observation(
        evidence_refs=("artifact://config-v1",),
        facts={"failure_class": "config_missing"}, trace_id="trace-1",
    )
    after = observation(
        evidence_refs=("artifact://config-v1",),
        facts={"failure_class": "config_missing"}, trace_id="trace-2",
    )
    assert progress_delta(before, after).is_progress is False
```

还应测试：

1. 新 Artifact 会清零停滞计数；
2. `waiting_tool` 不会因为时间流逝自动计入无进展；
3. 同一失败指纹达到阈值后最多触发一次自动重规划；
4. 新计划不能把任务级停滞历史清零；
5. 已满足完成标准时，即使预算剩余也直接完成，不继续“优化”；
6. 取消与未知副作用优先于预算耗尽；
7. 重启后重复计数、预算使用量和开放预留与崩溃前一致。

### 15.4 终止优先级测试

```python
def test_cancel_wins_over_budget_and_ready_steps():
    state = convergence_state(
        cancel_requested=True,
        budget_exhausted_dimensions=("tool_calls",),
        ready_step_ids=("s3",),
    )
    decision = decide_next(state)
    assert decision.reason == StopReason.CANCELLED
```

同样需要测试 `unknown_side_effect` 优先于 `completion_satisfied`，因为工具结果尚未确认时，不能仅凭模型或旧观察宣称完成；而一旦完成标准已经由可信结果满足，则应优先于继续动作和无进展阈值。

## 十六、与取消、审批和租约协作

### 16.1 取消冻结预算，不取消历史

取消请求被接受后：

- 禁止新的模型回合、计划修订和工具预留；
- 已提交的预算使用量保留在账本中；
- 尚未派发且能证明未发生的预留可以释放；
- `tool.dispatched` 的未知调用仍按恢复协议查询；
- 已开始的 Sandbox 进程交给第 10 课的取消协议处理。

取消不是删除任务，也不是把使用量改回零。任务工作台应能看到取消发生前的所有动作和费用。

### 16.2 审批等待不消耗重复动作预算

一个 Action 因审批暂停时，不应每次轮询都增加 `turns` 或 `same_action_repeats`。轮询本身可以有低成本的系统预算，但等待中的业务 Action 仍是同一个身份。审批拒绝后，替代 Action 必须通过新的授权判断，并使用新的指纹与预算预留。

### 16.3 租约失效不代表预算释放

Worker A 的租约过期后，Worker B 可以接管任务，但不能直接释放 A 的所有预留。B 必须依据 Invocation 状态判断：

```text
没有 accepted/dispatched 事实且执行器可确认未收到 -> released
存在 dispatched 或执行器状态未知               -> recovery_required
结果已确认                                      -> committed
```

fencing token 只保护数据库写入权，不会撤销已经发到远端的网络请求；因此预算和副作用恢复必须同时设计。

## 十七、常见错误

| 错误 | 正确处理 |
| --- | --- |
| 每个计划都有一份全新的完整预算 | 预算属于任务谱系，计划只能消耗或分配剩余额度 |
| 只在回合结束后统计工具次数 | 派发前原子预留，结果后结算 |
| 使用 Python 浮点数累计费用 | 使用整数微单位或 Decimal，并保留供应商计量 |
| 预留过期就自动释放 | 先确认外部调用未发生，否则进入恢复对账 |
| 把动作 JSON 原文直接哈希 | 规范化字段并去除无关随机值，保存稳定版本 |
| 看到重复就禁止所有重试 | 区分安全只读重试、成功结果复用和未知写副作用 |
| 每次新计划都把重复计数清零 | 重复和停滞历史属于任务级事实 |
| 只看工具名判断重复 | 至少包含步骤、参数、授权范围和语义版本 |
| 只有 Trace ID 变化就算有进展 | 比较 Artifact、失败分类、步骤状态和完成条件 |
| `waiting_tool` 超过一个回合就判无进展 | 等待状态需要超时和恢复策略，不直接套停滞窗口 |
| 达到最大步数就标记 completed | 写明确 `budget_exhausted`，并保留 `verified=false` |
| 预算耗尽后仍执行清理之外的新业务动作 | 只允许恢复未知副作用、取消或人工接管所需的受控动作 |
| 终止原因只写在日志里 | 持久化 `stop_reason`、事件和 Checkpoint |
| 模型输出“已完成”就结束 | 只有可信工具结果和完成标准校验能进入 `completed` |

## 十八、课堂练习

### 练习一：制定预算

为“解释一个模块并运行相关测试”的任务设计预算，至少包含回合、模型 Token、工具次数、总时间和费用。说明：

1. 哪些是硬预算，哪些是软预算；
2. 搜索、读取文件、测试和生成摘要分别怎样预留；
3. 为什么重规划不能获得一份新工具预算；
4. 预算耗尽时哪些恢复动作仍然允许执行；
5. 如何向用户展示已用量、预留量和剩余量，而不暴露内部供应商密钥。

### 练习二：判断重复和重试

对以下情况给出“复用结果”“安全重试”“重规划”“先恢复”“人工接管”之一，并说明依据：

1. 相同的 `read_file` 已成功，文件内容哈希未变化；
2. `apply_patch` 只有 `tool.dispatched`，客户端超时；
3. `pytest` 连续三次同一测试集合失败，但每次日志时间戳不同；
4. 两个不同目录的搜索结果都为空，但索引工具报告已完成；
5. Planner 在 P2 中再次提出 P1 已成功的只读检查；
6. 写入工具返回明确的 `already_exists`，幂等查询确认首次调用已成功。

要求同时说明动作指纹、结果指纹和副作用状态分别提供了什么证据。

### 练习三：补齐终止优先级

给定以下事实，写出 `decide_next()` 的返回值和原因：

1. 任务已取消，工具预算也恰好耗尽；
2. 完成标准已由测试结果满足，但仍有两个 ready 只读步骤；
3. 有未决写调用，模型提出一个更快的替代计划；
4. 连续三次无进展，仍有一次重规划配额；
5. 重规划配额已用完，当前没有 ready 步骤，前驱是 `requires_success` 失败；
6. Worker 租约过期，但没有任何外部调用结果。

说明为什么终止优先级必须稳定，并指出哪些情况是暂停而不是失败。

### 练习四：评审错误实现

指出下面代码至少八个问题，并给出修正方向：

```python
async def run_forever(task):
    while True:
        response = await llm.complete(task.prompt)
        for call in response.tool_calls:
            await runtime.execute(call.name, call.args)
        if response.done:
            break
```

至少应指出：没有任务版本和租约；没有预算预留与结算；没有 Action/Invocation 幂等身份；没有处理 `unknown` 结果；没有检查重复和无进展；没有验证计划和授权；没有持久化事件/Checkpoint；模型 `done` 不是完成标准；取消、审批和重启都无法恢复。

## 十九、完成标准

完成本课后，你应该能够：

- 为任务定义回合、时间、Token、工具、费用和重规划预算；
- 解释为什么预算检查必须在预留、派发和结算三个阶段分别出现；
- 用持久化预留和账本防止并发 Worker 超卖配额；
- 用动作指纹、结果指纹和失败分类识别重复，而不是粗暴禁止重试；
- 用进展向量和停滞窗口判断任务是否真正靠近完成标准；
- 把完成、失败、取消、预算耗尽、重复、无进展和未知副作用映射到清晰状态；
- 按固定优先级处理取消、未知副作用、完成、审批、预算和租约失效；
- 让重规划继承任务预算，不能通过新计划或新步骤绕过历史消耗；
- 在 Checkpoint 恢复预算预留、重复历史和无进展窗口；
- 用并发预留、结算幂等、重复动作、停滞窗口和终止优先级测试证明 Loop 有界。

## 二十、本课小结

一个可靠的 Agent Loop 不只是“有一个最大步数”：

```text
预算：还允许消耗多少资源？
重复：这次是否已经做过同一件事？
进展：任务事实是否更接近完成标准？
收敛：继续尝试是否仍比停止更安全、更有价值？
```

预算把资源边界变成任务事实；预留和账本保证并发与恢复不会超卖；动作和结果指纹让系统知道何时复用证据、何时先对账；进展向量和停滞窗口避免“换一句话继续试”被误认为工作；终止优先级则把取消、未知副作用、完成和预算耗尽放在正确的位置。

因此，Controller 的职责不是让 Agent 尽可能多做动作，而是让每个动作都能回答三句话：

1. **这次动作有足够且可追溯的预算吗？**
2. **它与过去的尝试有什么不同，能带来什么新证据？**
3. **如果不能安全继续，系统会以什么可解释状态停下来？**

下一课将把这些原则带入 Sandbox，开始处理文件路径、工作区、产物和宿主机边界。预算会限制“能运行多久”，而 Sandbox 会进一步限制“能触碰什么”。
