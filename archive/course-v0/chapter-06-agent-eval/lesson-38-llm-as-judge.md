# 第 4 课：谨慎使用 LLM-as-Judge

> 所属章节：[第 6 章：Agent Eval、回归测试与质量改进](./index.md)  
> 上一课：[第 3 课：保存 Trace 并定位失败步骤](./lesson-37-trace-failure-location.md)  
> 下一课：[第 5 课：回归测试和版本对比](./lesson-39-regression-test-version-compare.md)

### 你将完成什么

让一个模型按 Rubric 评估开放答案，同时保留规则评测和人工抽样。

Judge Prompt 必须包括：任务、答案、证据、Rubric 和 JSON 输出格式。例如：

```text
任务：说明登录逻辑，并给出代码证据。
答案：{answer}
证据：{citations}

按 0-2 分评估：
1. 是否回答任务；
2. 是否每个关键结论都有证据；
3. 是否编造输入中不存在的文件或函数。

只返回 JSON：
{"score": 0, "reasons": [], "unsupported_claims": []}
```

校准步骤：人工标注 10 个任务 -> 运行 Judge -> 找出分歧 -> 修改 Rubric -> 再抽样。Judge 分数不是事实，而是一个需要验证的测量工具。

### 本课验收

- Judge 输出经过 Schema 校验；
- 评分理由包含证据；
- 至少有一次人工与 Judge 的分歧分析；
- 规则测试仍是质量门禁的一部分。

---
