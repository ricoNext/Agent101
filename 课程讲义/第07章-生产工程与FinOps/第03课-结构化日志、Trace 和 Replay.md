# 第 3 课：结构化日志、Trace 和 Replay

> 所属章节：[第 7 章：生产工程、可观测性与 FinOps](./README.md)  
> 上一课：[第 2 课：配置、密钥和健康检查](./第02课-配置、密钥和健康检查.md)  
> 下一课：[第 4 课：建立 Token 预算和 FinOps 报表](./第04课-建立 Token 预算和 FinOps 报表.md)

### 你将完成什么

让一个 `run_id` 能串起请求、模型、工具、审批、子 Agent 和最终结果。

统一日志字段：

```json
{
  "timestamp": "2026-07-30T00:00:00Z",
  "level": "INFO",
  "service": "api",
  "run_id": "run-001",
  "trace_id": "trace-001",
  "tenant_id": "tenant-hash",
  "event": "tool.completed",
  "tool_name": "read_file",
  "latency_ms": 42
}
```

Trace 最少包含：`context.build`、`model.call`、`tool.validate`、`tool.execute`、`approval.wait`、`state.change`、`final.answer`。每个 Span 都带组件版本。

Replay 分两类：

- 模拟重放：复用历史工具结果，只验证决策；
- 真实重放：再次调用外部服务，可能有副作用。

默认只能模拟重放。真实重放必须重新走审批和权限检查。

验收：找到一个失败 Golden Task，使用 Trace 说明它失败在 Context、模型、工具或权限的哪一层。

---
