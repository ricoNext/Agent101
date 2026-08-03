# 第 2 课：实现规则评测器

> 所属章节：[第 6 章：Agent Eval、回归测试与质量改进](./README.md)  
> 上一课：[第 1 课：建立 Golden Dataset](./第01课-建立 Golden Dataset.md)  
> 下一课：[第 3 课：保存 Trace 并定位失败步骤](./第03课-保存 Trace 并定位失败步骤.md)

### 你将完成什么

先实现确定性评测。它不会评估语言优雅，但能稳定检查状态、工具、引用、成本和延迟。

创建 `packages/evals/rules.py`：

```python
from dataclasses import dataclass
from typing import Any


@dataclass
class RuleEvaluation:
    passed: bool
    reasons: list[str]


def evaluate_properties(task: dict[str, Any], artifact: dict[str, Any]) -> RuleEvaluation:
    text = str(artifact)
    reasons: list[str] = []

    for expected in task.get("must_have", []):
        if expected not in text:
            reasons.append(f"missing required property: {expected}")
    for forbidden in task.get("must_not_have", []):
        if forbidden in text:
            reasons.append(f"contains forbidden property: {forbidden}")
    if artifact.get("latency_ms", 0) > task.get("max_latency_ms", float("inf")):
        reasons.append("latency budget exceeded")
    if artifact.get("cost", 0.0) > task.get("max_cost", float("inf")):
        reasons.append("cost budget exceeded")

    return RuleEvaluation(passed=not reasons, reasons=reasons)
```

规则评测适合检查：任务状态、工具是否被正确阻止、输出字段、引用路径、最大成本和最大延迟。

### 本课验收

- 每个失败都有明确原因；
- 规则评测不依赖模型；
- 你能区分“规则没通过”和“答案语言质量不好”。

---
