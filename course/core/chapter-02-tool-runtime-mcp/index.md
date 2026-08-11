# 第二章：Function Calling、Tool Runtime 与 MCP

> 建议课时：14 课时  
> 项目里程碑：M2 · Agent Tool Runtime

## 章节定位

本章让模型从“生成内容”升级为“调用受控工具完成任务”，重点建设工具协议、注册中心、执行链、安全边界与 MCP 接入。Agent Loop、任务状态机和长程任务编排留到第三章处理。

十课始终扩展同一个 `agent-platform`。本章直接复用第一章的 LLM Gateway，并在其上增加一套可发现、可校验、可授权、可执行和可追踪的 Tool Runtime。

## 学习目标

完成本章后，你应该能够：

1. 解释 Function Calling、Tool Runtime、MCP 与 Agent Loop 的职责边界。
2. 定义包含输入、输出、错误、权限、风险和执行策略的统一 Tool Schema。
3. 实现支持发现、启停、版本管理和可见性过滤的 Tool Registry。
4. 在工具执行前完成参数校验、类型转换、身份透传和权限检查。
5. 处理工具依赖、并发、超时、有限重试、幂等与失败降级。
6. 对只读、写入和高风险工具应用不同的安全策略。
7. 实现 Human-in-the-loop 审批，并记录完整风险决策与审计信息。
8. 理解 MCP Client、Server、Transport、Tools、Resources 与 Prompts。
9. 接入并开发一个自定义 MCP Server。
10. 通过 CLI、Tool Call Trace 和验收场景验证工具运行时。

## 课程目录

| 课次 | 主题 | 主要工程增量 |
| ---: | --- | --- |
| 11 | [理解 Function Calling 与 Tool Use](./lesson-11-function-calling-tool-use.md) | 工具选择、参数生成、结果回传与边界判断 |
| 12 | [定义统一 Tool Schema](./lesson-12-unified-tool-schema.md) | 输入、输出、错误、风险与执行策略契约 |
| 13 | [实现 Tool Registry](./lesson-13-tool-registry.md) | 注册、发现、启停、版本和可见性过滤 |
| 14 | [建立 Tool Runtime 执行链](./lesson-14-tool-runtime-execution.md) | 校验、身份透传、执行与结果标准化 |
| 15 | [处理工具调用的可靠性问题](./lesson-15-tool-call-reliability.md) | 依赖、并发、超时、重试、幂等与降级 |
| 16 | [建立权限模型与工具安全边界](./lesson-16-permission-security-boundary.md) | 风险分级、最小权限、白名单和作用域约束 |
| 17 | [实现 Human-in-the-loop 审批与审计](./lesson-17-approval-audit.md) | 审批状态、拒绝、取消、脱敏和风险回放 |
| 18 | [理解 MCP 协议并接入 MCP Client](./lesson-18-mcp-protocol-client.md) | 能力发现、Transport、连接生命周期和错误处理 |
| 19 | [开发自定义 MCP Server](./lesson-19-custom-mcp-server.md) | 自定义服务、工具暴露、认证和运行时接入 |
| 20 | [建立调试入口并完成 M2 验收](./lesson-20-debugging-and-acceptance.md) | CLI、Tool Call Trace、故障演练和里程碑验收 |

## 建议学习节奏

第 11-14 课先建立统一协议和最小执行链，第 15-17 课补齐可靠性、安全、审批与审计，第 18-19 课完成 MCP 接入，最后通过第 20 课集中验证 M2。

其中第 14、15、17、18 课建议各安排 2 课时，其余课程各安排 1 课时，共 14 课时。

## M2 交付内容

- Tool Registry 与统一 Tool Schema
- 至少三个不同风险等级的工具
- 权限、确认、超时、重试和审计机制
- 一个自定义 MCP Server
- MCP Client 接入和工具发现
- CLI 调试入口与 Tool Call Trace

## M2 验收标准

- 非法参数在执行前被拦截。
- 未授权和高风险操作不能静默执行。
- 工具超时不会导致整个服务永久阻塞。
- 每次调用可追踪到用户、工具版本、参数、结果和风险决策。

## 最终产物

本章完成后，`agent-platform` 将拥有一套独立于具体模型和工具实现的 Agent Tool Runtime。第三章会在这套受控执行能力之上加入任务状态、Checkpoint 和 Agent Loop。
