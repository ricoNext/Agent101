# 第 5 课：回归测试和版本对比

> 所属章节：[第 6 章：Agent Eval、回归测试与质量改进](./README.md)  
> 上一课：[第 4 课：谨慎使用 LLM-as-Judge](./第04课-谨慎使用 LLM-as-Judge.md)  
> 下一课：[第 6 课：创建 Eval Dashboard 和自动化入口](./第06课-创建 Eval Dashboard 和自动化入口.md)

### 你将完成什么

在改 Prompt、模型、工具 Schema 或检索策略后比较新旧版本。

比较至少四项：

| 指标 | 为什么不能省略 |
|------|----------------|
| Task Success Rate | 主目标是否完成 |
| Citation Accuracy | RAG 是否真的可信 |
| P95 Latency | 用户是否被变慢 |
| Cost per Run | 改进是否代价过高 |

创建 `packages/evals/compare.py`，输出如下报告：

```text
baseline: prompt-v1
candidate: prompt-v2
success_rate: 0.75 -> 0.85 (+0.10)
citation_accuracy: 0.90 -> 0.86 (-0.04)
p95_latency_ms: 1800 -> 2100 (+300)
cost_per_run: 0.03 -> 0.05 (+0.02)
decision: review required
```

不要只因成功率提升就自动发布。这里引用下降且成本上升，应该人工复核。

### 本课验收

- 任务结果按版本保存；
- 基线和候选在相同任务集、相同仓库快照上比较；
- 报告同时展示收益和代价；
- 出现明显退化时不允许静默合并。

---
