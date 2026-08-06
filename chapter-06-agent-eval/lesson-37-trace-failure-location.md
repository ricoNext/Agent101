# 第 3 课：保存 Trace 并定位失败步骤

> 所属章节：[第 6 章：Agent Eval、回归测试与质量改进](./index.md)  
> 上一课：[第 2 课：实现规则评测器](./lesson-36-rule-evaluator.md)  
> 下一课：[第 4 课：谨慎使用 LLM-as-Judge](./lesson-38-llm-as-judge.md)

### 你将完成什么

为每个 Run 输出一致的 Trace。第七章会把它持久化并可视化，本章先定义结构和分析方法。

创建 `packages/evals/trace_schema.json`：

```json
{
  "run_id": "run-001",
  "version": {
    "prompt": "v1",
    "model": "mock-1",
    "tools": "v1",
    "retrieval": "v1"
  },
  "spans": [
    {"name": "context.build", "status": "ok", "latency_ms": 12},
    {"name": "model.call", "status": "ok", "latency_ms": 430},
    {"name": "tool.execute", "status": "failed", "error_code": "permission_denied"}
  ]
}
```

排查顺序：

1. 任务输入是否正确；
2. Context 是否包含关键证据；
3. 模型是否选择正确工具；
4. 参数、权限和审批是否正确；
5. 工具是否超时或返回错误；
6. 最终答案是否引用了真实证据。

不要从最终答案倒推“模型不行”。Trace 才是定位依据。

---
