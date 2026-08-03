# 第 6 课：A2A 选修实验

> 所属章节：[第 5 章：Multi-Agent、Skill 与 A2A](./README.md)  
> 上一课：[第 5 课：把重复任务封装为 Skill](./第05课-把重复任务封装为 Skill.md)  
> 下一课：[第 7 课：创建协作任务页并完成验收](./第07课-创建协作任务页并完成验收.md)

### 你将完成什么

理解 A2A 的最小范围：一个 Agent 如何声明能力并接收另一个 Agent 的任务。它不是本章核心交付，也不替代内部权限系统。

### Agent Card 最小示例

创建 `docs/a2a-agent-card.json`：

```json
{
  "name": "security-review-agent",
  "description": "只读安全审查 Agent",
  "capabilities": ["code-security-review"],
  "input_schema": {"type": "object"},
  "output_schema": {"type": "object"},
  "authentication": "bearer-token-required",
  "limits": {"max_task_seconds": 120, "max_tool_calls": 20}
}
```

定义 Task 生命周期：

```text
created -> submitted -> working -> completed
                            -> failed
                            -> cancelled
```

最小 API：

```text
GET  /.well-known/agent-card.json
POST /a2a/tasks
GET  /a2a/tasks/{task_id}
GET  /a2a/tasks/{task_id}/events
```

### 必须保留的安全边界

- 外部 Agent 的 Agent Card 是声明，不是信任凭证；
- 每次委托都要验证调用方身份和 Scope；
- 不把内部全部 Context 转发给外部 Agent；
- 不把外部 Agent 返回的文本直接当作事实；
- 成本、超时和取消同样需要记录。

### 本课验收

- 能解释 A2A 与 MCP 的区别；
- 有 Agent Card 和 Task 状态定义；
- 知道跨组织委托需要额外认证、审计和数据最小化；
- 不要求把 A2A 用于主项目核心路径。

---
