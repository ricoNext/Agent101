# 第 6 课：实现幂等、并发控制与故障隔离

> 章节导航：[第二章：Function Calling、Tool Runtime 与 MCP](./index.md)  
> 上一课：[第 5 课：实现超时、取消与有限重试](./lesson-05-tool-timeout-retry.md)<br>
> 下一课：[第 7 课：建立工具风险与权限模型](./lesson-07-tool-risk-permission-model.md)

## 一、你将完成什么

本课处理可靠性执行器中与副作用和共享资源相关的部分：

1. 为可重试写操作建立可信幂等键和结果复用规则。
2. 按工具、租户或资源设置并发上限与隔离策略。
3. 区分必需依赖、可选依赖与不能伪装成功的降级。
4. 组合可靠性执行器，并用确定性故障测试验证行为。

完成本课后，你应能说明本课能力在 Tool Runtime 中的位置，并用测试或可查询证据证明它确实生效。

## 二、幂等：重试有副作用工具的前提

### 9.1 幂等和去重不是一回事

幂等表示同一个逻辑操作提交多次，最终外部状态与提交一次相同。去重是服务端识别重复请求的一种实现手段。`POST /payments` 本身通常不是幂等的，但增加服务端持久化的 `Idempotency-Key` 后，可以得到幂等语义。

幂等键必须来自可信入口，并在所有重试中保持不变：

```python
idempotency_key = f"{context.request_id}:{call.call_id}"
```

不要让模型在参数里提供 `idempotency_key`，也不要用每次尝试生成的新 UUID；前者可被伪造，后者无法去重。

### 9.2 幂等记录的状态机

一个最小的幂等存储需要记录键、工具版本、参数指纹和最终结果：

```text
ABSENT -> IN_PROGRESS -> SUCCEEDED
                    \-> FAILED
```

如果同一个键再次出现：

- `SUCCEEDED`：返回保存的原结果，不再次执行；
- `IN_PROGRESS`：等待、查询或返回 `idempotency_in_progress`，不能并发执行第二份；
- `FAILED`：只有明确允许重试且参数指纹相同才可继续；
- 参数指纹或工具版本不同：返回 `idempotency_key_conflict`。

示例接口：

```python
from dataclasses import dataclass


@dataclass(frozen=True)
class IdempotencyRecord:
    key: str
    tool_name: str
    tool_version: str
    arguments_hash: str
    state: str
    result: ToolResult | None = None


class IdempotencyStore(Protocol):
    def begin(self, record: IdempotencyRecord) -> IdempotencyRecord:
        """原子地创建记录；已存在时返回现有记录。"""

    def finish(self, key: str, result: ToolResult) -> None:
        ...
```

`begin()` 必须是数据库唯一键或 Redis `SET NX` 之类的原子操作。只用进程内字典无法跨副本防重，也无法在进程重启后识别悬挂的 `IN_PROGRESS`。生产实现还需要租约和过期时间，避免持有者崩溃后永久阻塞后续调用。

### 9.3 “恰好一次”通常是误解

网络系统很难保证端到端的 exactly-once 执行。更现实的目标是：

```text
调用方至少发送一次
+ 服务端通过幂等键把重复提交折叠
+ 业务存储在同一事务边界内保存结果
= 对外呈现一次逻辑效果
```

如果下游不支持幂等，也不能靠 Runtime 猜测“请求大概没发出去”。对于写操作，未知结果应停止自动重试，返回可追踪的 `tool_outcome_unknown`，并提供查询或人工恢复路径。

## 三、并发控制与隔离

重试会放大并发；多个模型并行提出工具调用时，单一依赖更容易被打满。至少设置四层限制：

| 限制 | 作用 | 例子 |
| --- | --- | --- |
| 全局并发 | 保护进程和连接池 | 同时最多 200 个工具尝试 |
| 每工具并发 | 保护特定下游 | `search` 100，`charge` 20 |
| 每租户并发 | 防止一个租户独占容量 | 租户最多 20 个尝试 |
| 每调用者并发 | 防止单个 Agent 任务失控 | actor 最多 5 个尝试 |

应限制的是“正在执行的尝试”，还是“包含退避的逻辑调用”，要在指标中明确。通常信号量只覆盖实际依赖调用，退避时释放信号量，让其他请求有机会运行。

一个简化的异步闸门：

```python
from contextlib import asynccontextmanager
import asyncio


class ConcurrencyLimit:
    def __init__(self, limit: int) -> None:
        self._semaphore = asyncio.Semaphore(limit)

    @asynccontextmanager
    async def acquire(self, deadline: Deadline):
        remaining = deadline.remaining_ms()
        if remaining <= 0:
            raise ToolTimeout("deadline exceeded while waiting for capacity")
        try:
            async with asyncio.timeout(remaining / 1000):
                await self._semaphore.acquire()
        except TimeoutError as error:
            raise ToolBusy("tool concurrency limit reached") from error
        try:
            yield
        finally:
            self._semaphore.release()
```

生产实现通常需要按工具、租户和调用者组合多个闸门，并保证获取顺序固定，否则不同请求以不同顺序获取锁会形成死锁。排队时间要单独记录，不能把它算成下游响应时间。

### 10.1 不要无条件并行工具调用

同一轮模型响应可能带来多个 `ToolCall`。只有在调用之间没有数据依赖、没有共享写冲突且各自预算充足时才可并行。以下调用不能简单并行：

```text
创建订单 -> 读取刚创建的订单
扣款 -> 发货
更新配置 -> 读取配置并生成缓存
```

并行调度要尊重 `call_id`、幂等键和资源锁。第 14 课会通过验收场景检查并发调用是否产生超出预期的副作用。

## 四、依赖失败与安全降级

降级不是“任何异常都返回缓存”。一个降级结果必须说明来源、新鲜度和限制，且不能违反工具的输出 Schema。

### 11.1 可以降级的例子

- 只读查询依赖暂时不可用时，返回带 `stale=true` 和 `fetched_at` 的已验证缓存；
- 搜索建议失败时返回空建议，但不能声称“没有匹配结果”；
- 非关键的埋点发送失败时，将事件放入本地可靠队列，不阻塞主业务结果；
- 物流预计到达时间不可用时返回 `estimate_status=unavailable`，而不是伪造日期。

### 11.2 不应静默降级的例子

- 扣款、退款、删除、发货等写操作；
- 权限检查或审批检查；
- 依赖当前状态才能判断的风控决策；
- 无法确认新鲜度的库存、余额和额度。

可降级结果应在契约中显式建模：

```json
{
  "type": "object",
  "required": ["items", "source", "stale"],
  "properties": {
    "items": {"type": "array"},
    "source": {"enum": ["live", "cache"]},
    "stale": {"type": "boolean"},
    "fetched_at": {"type": ["string", "null"]}
  },
  "additionalProperties": false
}
```

Runtime 仍会校验这个输出。降级只能改变业务数据的来源，不能跳过输出 Schema、权限和审计。

### 11.3 熔断与恢复

当依赖连续失败时，熔断器可以暂时拒绝新请求，避免把健康线程全部耗在必败调用上。最小状态机为：

```text
CLOSED --连续失败达到阈值--> OPEN
OPEN --冷却时间结束--> HALF_OPEN
HALF_OPEN --探测成功--> CLOSED
HALF_OPEN --探测失败--> OPEN
```

熔断器是保护依赖和本地资源的机制，不是权限边界。打开熔断器后的错误应稳定为 `dependency_unavailable`，并附带 `retryable=true` 或明确的重试时间；不要让调用方看到内部主机名和熔断计数。

## 五、组合成可靠性执行器

下面是一个刻意简化的异步骨架，展示策略顺序。它假设第 4 课提供 `runtime.invoke()` 的一次调用能力，并假设输入 `call` 已经通过统一契约校验。生产代码还要接入结构化日志、分布式幂等存储和真正的依赖错误映射。

```python
from collections.abc import Awaitable, Callable
from dataclasses import dataclass


@dataclass(frozen=True)
class ReliabilityLimits:
    max_tool_timeout_ms: int = 10_000
    max_attempts: int = 3
    initial_backoff_ms: int = 100
    max_backoff_ms: int = 2_000


class ReliableToolExecutor:
    def __init__(
        self,
        *,
        runtime: ToolRuntime,
        limits: ReliabilityLimits,
        sleeper: Callable[[float], Awaitable[None]],
    ) -> None:
        self._runtime = runtime
        self._limits = limits
        self._sleeper = sleeper

    async def invoke(
        self,
        *,
        call: ToolCall,
        context: ToolExecutionContext,
        spec: ToolSpec,
        cancellation: Cancellation,
        invoke_once: Callable[[ToolCall, ToolExecutionContext, Deadline], Awaitable[ToolResult]],
    ) -> ToolResult:
        deadline = Deadline.after_ms(
            min(spec.execution.timeout_ms, self._limits.max_tool_timeout_ms)
        )
        attempts = min(spec.execution.max_attempts, self._limits.max_attempts)

        for attempt in range(1, attempts + 1):
            cancellation.raise_if_cancelled()
            remaining = deadline.remaining_ms()
            if remaining <= 0:
                return timeout_result(call)

            try:
                result = await invoke_once(call, context, deadline)
            except ToolCancelled:
                return cancelled_result(call)
            except ToolTimeout:
                kind = FailureKind.TIMEOUT
                result = timeout_result(call)
            except DependencyFailure as error:
                kind = error.kind
                result = dependency_result(call, error)
            else:
                if result.status == "success":
                    return result
                kind = classify_tool_result(result)

            if not should_retry(
                spec=spec,
                kind=kind,
                attempt=attempt,
                attempts=attempts,
                deadline=deadline,
                has_idempotency_key=has_idempotency_key(call, context),
            ):
                return result

            delay_ms = retry_delay_ms(
                attempt=attempt,
                initial_ms=self._limits.initial_backoff_ms,
                max_ms=self._limits.max_backoff_ms,
            )
            if delay_ms >= deadline.remaining_ms():
                return result
            await self._sleeper(delay_ms / 1000)

        return timeout_result(call)
```

这段骨架故意把 `invoke_once` 作为依赖注入点，实际实现可以是：获取并发闸门、调用第 4 课 Runtime、把底层错误映射为 `ToolResult`。几个不可省略的细节：

- 截止时间在循环外创建，重试共享同一个总预算；
- 取消检查在每次尝试和退避前进行；
- `should_retry()` 同时读取错误类别、Schema 策略、尝试次数、剩余时间和幂等状态；
- 退避期间不占用下游并发槽位；
- 第 4 课的 `ToolResult` 仍是唯一对外结果格式。

不要把这段示例直接复制到同步 Web Handler 中。同步入口应使用框架提供的异步生命周期、请求断开信号和连接池；否则“返回超时”可能只是断开了客户端，后台任务仍然没有被取消。

## 六、错误矩阵与对外结果

可靠性层可以增加错误信息，但不能改变第 4 课已经稳定的工具错误码。建议使用以下映射：

| 场景 | 对外错误码 | `retryable` | 备注 |
| --- | --- | ---: | --- |
| 等待并发容量超时 | `tool_busy` | 是 | 尚未进入工具实现 |
| 工具尝试超时且读操作 | `tool_timeout` | 视幂等和结果状态 | 不能承诺下游未执行 |
| 用户主动取消 | `tool_cancelled` | 否 | 不启动下一次尝试 |
| 明确瞬时依赖故障耗尽预算 | `dependency_unavailable` | 是 | 返回尝试次数和 Trace |
| 写操作响应丢失 | `tool_outcome_unknown` | 否 | 需要查询或人工恢复 |
| 幂等键正在执行 | `idempotency_in_progress` | 是 | 不并发执行第二份 |
| 幂等键参数或版本冲突 | `idempotency_key_conflict` | 否 | 调用方生成了错误复用 |
| 允许的缓存降级 | `success` | 否 | 数据中必须标记 `source=cache` |

对于模型，消息应简短且可行动，例如“依赖暂时不可用，请稍后重试”。对于 Trace 和指标，要保存 `failure_kind`、`attempt`、`queue_wait_ms`、`dependency_duration_ms`、`outcome` 和 `idempotency_state`，但不要记录令牌、完整参数和敏感响应。

## 七、测试可靠性而不是测试运气

可靠性测试不能依赖真实网络等待 10 秒，也不能用随机睡眠证明退避。把时钟、睡眠器、依赖客户端、幂等存储和并发闸门都做成可注入组件。

### 14.1 必测场景

```python
async def test_invalid_argument_is_never_retried(executor, runtime):
    result = await executor.invoke(...)
    assert result.error.code == "invalid_tool_arguments"
    assert runtime.invoke_once.call_count == 1


async def test_transient_failure_retries_within_attempt_limit(executor, fake_tool):
    fake_tool.side_effect = [temporary_503(), temporary_503(), success_result()]
    result = await executor.invoke(...)
    assert result.status == "success"
    assert fake_tool.call_count == 3
    assert executor.sleeper.delays == [0.0, 0.1]  # 使用固定随机源


async def test_non_idempotent_write_does_not_retry_unknown_outcome(executor):
    result = await executor.invoke(...)
    assert result.error.code == "tool_outcome_unknown"
    assert runtime.invoke_once.call_count == 1


async def test_duplicate_idempotency_key_returns_saved_result(executor, store):
    first = await executor.invoke(...)
    second = await executor.invoke(...)
    assert first == second
    assert store.business_handler.call_count == 1


async def test_cancel_during_backoff_stops_next_attempt(executor, cancellation):
    cancellation.event.set()
    result = await executor.invoke(...)
    assert result.error.code == "tool_cancelled"


async def test_concurrency_limit_is_released_after_timeout(executor):
    first = await executor.invoke(...)
    assert first.error.code == "tool_timeout"
    second = await executor.invoke(...)
    assert second is not None
```

还应测试：

- 超时发生在排队阶段时，不会调用 handler；
- `Retry-After` 大于剩余预算时，不会开始下一次尝试；
- 同一个幂等键使用不同参数或工具版本时返回冲突；
- `IN_PROGRESS` 记录不会并发执行第二个写请求；
- 缓存降级通过输出 Schema，并携带明确的新鲜度字段；
- 取消和异常路径都会释放所有信号量和连接；
- 熔断器从 `OPEN` 进入 `HALF_OPEN` 后只允许有限探测请求。

测试要断言调用次数、退避时长上限、最终错误码和状态，而不是只断言“没有抛异常”。一次没有抛异常但重复扣款的测试仍然是失败的测试。

## 八、观测与故障排查

每次逻辑调用至少记录一条开始事件和一条结束事件；每次尝试单独记录尝试号。建议字段如下：

```json
{
  "event": "tool_attempt_finished",
  "request_id": "req-20260818-0001",
  "call_id": "call-01",
  "tool_name": "create_issue",
  "tool_version": "1.0.0",
  "attempt": 2,
  "max_attempts": 3,
  "failure_kind": "transient",
  "outcome": "retrying",
  "queue_wait_ms": 12,
  "dependency_duration_ms": 430,
  "remaining_budget_ms": 1550,
  "idempotency_state": "in_progress"
}
```

这些字段能回答：失败发生在排队、连接、下游执行还是结果校验？重试是否真的改善了成功率？哪个租户占满了容量？超时后是否存在未知结果？

指标至少包括：

- 按工具版本和错误类别统计的成功率、超时率、未知结果率；
- 每次尝试数、重试放大倍数和退避时间；
- 全局/工具/租户并发使用量与拒绝数；
- 幂等命中率、冲突数和悬挂 `IN_PROGRESS` 数；
- 降级命中率、缓存年龄和熔断器状态。

不要只看平均耗时。P95/P99、排队时间和“客户端已超时但后台仍在运行”的任务数量，往往比平均值更能说明可靠性问题。

## 九、常见错误

### 16.1 所有异常都重试

权限错误、Schema 错误和业务状态错误重试没有收益，还会增加下游负担。必须先分类，再结合 ToolSpec 和幂等策略判断。

### 16.2 每次重试重新生成幂等键

新键会让服务端把重试当成新操作。幂等键应在逻辑调用开始时生成，并与 `request_id`、`call_id` 和工具版本关联。

### 16.3 用 `wait_for` 返回就认为下游没执行

本地超时只停止本地等待。写请求一旦可能已经到达下游，结果就是未知，必须查询状态或阻止自动重试。

### 16.4 退避时继续占用并发槽位

这会把“等待重试”的请求也算进正在执行的依赖请求，导致健康请求被饥饿。退避前释放槽位，下一次真正执行时重新获取。

### 16.5 fallback 返回普通成功对象

如果模型无法知道数据来自缓存、是否过期，它可能据此做出错误决策。降级协议必须在输出中显式标出来源、新鲜度和限制。

### 16.6 只限制入口并发，不限制重试并发

一个逻辑调用最多 3 次尝试，实际可能把依赖负载放大三倍。并发指标和容量预算必须以尝试为单位，同时监控重试放大因子。

### 16.7 把取消吞掉后返回成功

捕获所有异常并返回空数据，会让用户以为动作已完成。取消、未知结果和确定成功必须保持不同语义。

## 十、课堂练习

请为以下工具设计可靠性策略，并写出预期结果：

1. `get_order` 是只读查询，超时 800ms，最多 2 次尝试，下游返回 503；
2. `create_payment` 是不可逆写操作，客户端在请求发送后断开连接，下游没有响应；
3. `search_products` 的实时搜索服务不可用，但 30 秒内的缓存仍然存在；
4. 同一个租户同时提交 100 个 `create_issue` 调用，而该工具的下游并发上限为 10；
5. 一个 `ToolCall` 在第一次尝试返回 429 后，`Retry-After` 为 5 秒，但整次调用只剩 2 秒。

建议答案方向：

- 第 1 项可在总预算内有限重试，重试必须重新进入 Runtime；
- 第 2 项返回 `tool_outcome_unknown`，不能因为客户端断开就声称支付失败，也不能无幂等地自动再扣一次；
- 第 3 项可以返回通过 Schema 校验的缓存结果，标记 `source=cache`、`stale=true` 和抓取时间；
- 第 4 项使用每工具和每租户并发闸门，其余调用排队或返回 `tool_busy`，不能无限创建后台任务；
- 第 5 项不等待 5 秒，返回 `dependency_unavailable` 或限流错误，并说明需要稍后重试。

再为 `IN_PROGRESS -> SUCCEEDED`、`IN_PROGRESS -> FAILED` 和持有者崩溃三个场景画出幂等状态图，标注哪些转移需要租约过期或人工恢复。

## 十一、完成标准

- 写操作重试前具备稳定幂等语义，未知结果不会被当作失败后直接重放。
- 并发限制不会让一个租户或慢工具耗尽全部执行资源。
- 依赖降级不会改变业务语义，也不会把占位结果伪装成真实成功。
- 可靠性测试可确定地覆盖重复请求、并发争用、部分失败和恢复路径。

## 十二、本课小结

可靠性层现在既能约束时间，也能控制副作用和资源竞争。下一课将进一步回答“谁可以对什么资源执行什么工具”，把权限判断放回可信的平台边界。
