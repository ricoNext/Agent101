# 第 1 课：理解工具调用的边界

> 所属章节：[第 2 章：构建 Tool Runtime 与 MCP 接入](./index.md)  
> 下一课：[第 2 课：定义工具、调用和审计协议](./lesson-09-tool-call-audit-protocol.md)

### 你将完成什么

画出并实现工具调用的真实执行路径，理解模型、Tool Runtime、工具函数和用户审批分别负责什么。

### 必须先理解

下面两句话必须区分开：

- 模型说：“我建议调用 `write_note`，参数是 `{"path":"notes/a.md","content":"..."}`”。
- 系统说：“当前用户没有 `notes:write` Scope，因此不执行”。

模型只能提出请求，不能获得授权。真正执行工具的是你的后端 Runtime。

完整流程：

```text
前端或 Agent 产生 Tool Invocation
  -> Registry 找到工具
  -> 校验输入参数
  -> 检查工具是否启用
  -> 检查身份和 Scope
  -> 判断风险等级
  -> 必要时等待人工审批
  -> 设置超时并执行
  -> 校验输出
  -> 写审计记录和 Trace
  -> 返回结构化结果
```

### 本课练习

在 `docs/chapter-02-tool-flow.md` 画出上面的流程，并为每一步写一句“失败时系统应返回什么”。例如：

| 步骤 | 失败示例 | 正确处理 |
|------|----------|----------|
| 参数校验 | `path` 缺失 | 返回 `invalid_arguments` |
| Scope 检查 | 只有 `repo:read` | 返回 `permission_denied` |
| 审批 | 用户未确认写文件 | 返回 `approval_required` |
| 执行 | 外部服务超时 | 返回 `tool_timeout` |

这张表后面会变成测试用例，不是形式作业。

---
