# 第 10 课：建立调用观测与成本治理

> 所属章节：[第一章：LLM API、Prompt、Structured Output 与 Gateway](./index.md)  
> 上一课：[第 9 课：实现调用可靠性与模型路由](./lesson-09-reliability-routing.md)  
> 下一课：[第 11 课：实现可取消的 SSE 流式接口](./lesson-11-sse-streaming.md)

## 一、本课要解决的问题

第 9 课让 Gateway 能够重试和 fallback，但“最终成功”不足以说明系统可靠。一次请求可能经历多次模型尝试，使用了不同模型，花费远超预算，或者由 fallback 返回了质量较低的结果。

本课建立最小可观测闭环：让每次逻辑调用、每次 Provider 尝试和最终结果都能通过同一个 `run_id` 关联，并形成第 14 课可重复对比的基线数据。

## 二、区分 Run、Attempt 与 Event

| 对象 | 表达什么 | 数量关系 |
| --- | --- | --- |
| Run | 上层发起的一次逻辑模型调用 | 一个请求通常对应一个 Run |
| Attempt | Run 内对某个 Provider 模型的一次尝试 | 重试与 fallback 会产生多个 Attempt |
| Event | Run 生命周期中的状态变化 | 一个 Run 可产生多个 Event |

如果只记录最终响应，就无法回答“成功前失败了几次”“哪个模型触发限流”“fallback 增加了多少成本”。

## 三、定义最小调用记录

```python
from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class ModelAttemptRecord(BaseModel):
    run_id: str
    attempt: int
    logical_model: str
    provider: str
    provider_model: str
    status: Literal["succeeded", "failed", "cancelled"]
    started_at: datetime
    duration_ms: int
    input_tokens: int | None
    output_tokens: int | None
    estimated_cost: str | None
    price_version: str | None
    error_code: str | None
    retryable: bool | None
    provider_request_id: str | None


class ModelRunRecord(BaseModel):
    run_id: str
    trace_id: str
    tenant_id: str
    prompt_id: str
    prompt_version: str
    schema_id: str | None
    schema_version: str | None
    generation_options_hash: str
    status: Literal["completed", "failed", "cancelled"]
    selected_model: str | None
    attempt_count: int
    total_duration_ms: int
    total_input_tokens: int | None
    total_output_tokens: int | None
    total_estimated_cost: str | None
```

不要在默认记录中保存完整 Prompt、用户原文、模型原文或 API Key。需要调试样本时，应使用受控采样、脱敏、访问控制与保留期限。

## 四、让观测覆盖完整生命周期

建议使用以下顺序：

```text
run.started
  attempt.started
  attempt.failed / attempt.succeeded
  attempt.started             # 可选：重试或 fallback
  attempt.succeeded
run.completed / run.failed / run.cancelled
```

关键原则：

- `run_id` 由 Gateway 入口生成，不由 Provider 返回；
- 每个 Attempt 都有递增序号；
- 失败也要落记录，不能只记录成功路径；
- 取消是独立终态，不能混成普通失败；
- Run 汇总值应从 Attempt 聚合，避免两套数据相互矛盾。

## 五、记录成本时保留不确定性

成本记录至少包含：

1. 输入和输出 Token；
2. 单价配置版本；
3. 币种；
4. 估算时间；
5. 数据来源是 Provider Usage 还是本地估算。

当 Usage 缺失时：

- Token 字段保持 `null`，或另存明确标记的估算值；
- 成本不能标记为精确账单；
- 基线报告应统计缺失率；
- 不要用字符数直接冒充 Token 数。

重试和 fallback 的每次尝试都可能计费，因此 Run 总成本必须汇总所有 Attempt，而不只是最终成功结果。

## 六、选择第一批指标

第一章不需要建设完整监控平台，但至少要能按模型、Prompt 版本和时间窗口计算：

| 指标 | 用途 |
| --- | --- |
| 调用成功率 | 观察 Gateway 是否可用 |
| P50 / P95 延迟 | 观察典型体验和尾延迟 |
| 平均 Attempt 数 | 发现重试或 fallback 是否过多 |
| 限流与超时占比 | 判断容量和路由问题 |
| Token 与估算成本 | 观察资源消耗 |
| Usage 缺失率 | 判断成本数据可信度 |
| Structured Output 通过率 | 观察业务协议稳定性 |
| fallback 使用率 | 判断主路由质量与可用性 |

指标必须能下钻到失败样本和 `run_id`，否则只能看到曲线，无法定位原因。

## 七、实现按 Run 查询

提供一个仅用于受控调试的查询入口：

```text
GET /internal/model-runs/{run_id}
```

返回内容应包括 Run 摘要和 Attempt 列表，但需要：

- 校验租户和操作者权限；
- 对 Prompt、错误详情和 Provider 响应脱敏；
- 不返回密钥、认证头或完整请求体；
- 对内部接口本身记录访问审计。

## 八、故障演练

使用 Mock Provider 构造一次“主模型限流、fallback 成功”的调用，检查：

1. Run 只有一个，Attempt 有两个；
2. 第一次失败包含稳定错误码与 `retryable=true`；
3. 第二次记录实际使用的 Provider 模型；
4. Run 的模型、Token、延迟和成本由两次 Attempt 汇总；
5. 最终响应能通过 `run_id` 查询完整链路；
6. 日志中没有 API Key 和未经脱敏的用户原文。

## 九、本课验收

- [ ] Run、Attempt 与 Event 的职责明确。
- [ ] 重试、fallback、失败和取消都会进入观测记录。
- [ ] Prompt、Schema、模型与价格配置都带版本。
- [ ] Token 和成本缺失时不会伪造精确值。
- [ ] 至少能计算成功率、P95 延迟、fallback 使用率和估算成本。
- [ ] 指标可以下钻到 `run_id` 和具体 Attempt。
- [ ] 调试查询经过鉴权、脱敏和审计。

## 十、小结

可观测性的目标不是“多打日志”，而是把一次逻辑调用的选择、尝试、结果和代价连接成可验证事实。下一课会把这套 Run 与 Event 语义延伸到 SSE，让流式调用在完成、失败和取消时仍有明确终态。
