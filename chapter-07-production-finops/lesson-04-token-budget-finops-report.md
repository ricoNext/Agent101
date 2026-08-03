# 第 4 课：建立 Token 预算和 FinOps 报表

> 所属章节：[第 7 章：生产工程、可观测性与 FinOps](./README.md)  
> 上一课：[第 3 课：结构化日志、Trace 和 Replay](./第03课-结构化日志、Trace 和 Replay.md)  
> 下一课：[第 5 课：版本、灰度和回滚](./第05课-版本、灰度和回滚.md)

### 你将完成什么

为每个 Run、Subagent 和租户设置预算，并让超限结果可见。

创建 `app/finops/budget.py`：

```python
from pydantic import BaseModel, Field


class RunBudget(BaseModel):
    max_input_tokens: int = Field(default=20_000, gt=0)
    max_output_tokens: int = Field(default=4_000, gt=0)
    max_tool_calls: int = Field(default=20, gt=0)
    max_cost_usd: float = Field(default=0.20, gt=0)


class RunUsage(BaseModel):
    input_tokens: int = 0
    output_tokens: int = 0
    tool_calls: int = 0
    cost_usd: float = 0.0


def exceeded(budget: RunBudget, usage: RunUsage) -> list[str]:
    reasons = []
    if usage.input_tokens > budget.max_input_tokens:
        reasons.append("input token budget exceeded")
    if usage.output_tokens > budget.max_output_tokens:
        reasons.append("output token budget exceeded")
    if usage.tool_calls > budget.max_tool_calls:
        reasons.append("tool call budget exceeded")
    if usage.cost_usd > budget.max_cost_usd:
        reasons.append("cost budget exceeded")
    return reasons
```

超预算处理顺序：停止无关检索 -> 压缩上下文 -> 使用较低成本模型 -> 请求人工确认 -> 终止。每次降级必须写入 Trace 和前端事件。

建立按租户、任务类型、模型、版本聚合的报表。成本不是只有模型 Token；还应记录重试、Embedding、Rerank、工具和基础设施成本。

---
