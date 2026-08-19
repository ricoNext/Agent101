# 第二章：Function Calling、Tool Runtime 与 MCP

> 课时：14 课时（14 节课，每节 1 课时）<br>
> 项目里程碑：M2 · Agent Tool Runtime

## 章节定位

本章让模型从“生成内容”升级为“调用受控工具完成任务”，重点建设工具协议、注册中心、执行链、可靠性、安全授权、人工审批、审计与 MCP 接入。Agent Loop、任务状态机和长程任务编排留到第三章处理。

十四节课始终扩展同一个 `agent-platform`。本章直接复用第一章的 LLM Gateway，并在其上增加一套可发现、可校验、可授权、可执行和可追踪的 Tool Runtime。

## 学习目标

完成本章后，你应该能够：

1. 解释 Function Calling、Tool Runtime、MCP 与 Agent Loop 的职责边界。
2. 定义包含输入、输出、错误、权限、风险和执行策略的统一 Tool Schema。
3. 实现支持发现、启停、版本管理和可见性过滤的 Tool Registry。
4. 在工具执行前完成参数校验、类型转换、身份透传和结果标准化。
5. 处理工具依赖、并发、超时、有限重试、幂等与失败降级。
6. 为只读、写入和高风险工具建立不同的权限、确认和审计策略。
7. 对租户、资源、工作区路径和字段应用最小权限与作用域授权。
8. 实现 Human-in-the-loop 审批状态机，并记录可核查的 Trace 与风险回放事实。
9. 理解 MCP Client、Server、Transport、Tools、Resources 与 Prompts。
10. 接入并开发一个自定义 MCP Server。
11. 通过 CLI、故障演练和验收场景验证工具运行时。

## 课程目录

| 课次 | 主题 | 主要工程增量 |
| ---: | --- | --- |
| 1 | [理解 Function Calling 与 Tool Use](./lesson-01-function-calling-tool-use.md) | 工具选择、参数生成、结果回传与边界判断 |
| 2 | [定义统一 Tool Schema](./lesson-02-unified-tool-schema.md) | 输入、输出、错误、风险与执行策略契约 |
| 3 | [实现 Tool Registry](./lesson-03-tool-registry.md) | 注册、发现、启停、版本和可见性过滤 |
| 4 | [建立 Tool Runtime 执行链](./lesson-04-tool-runtime-execution.md) | 校验、身份透传、授权入口、执行、结果标准化与 Trace |
| 5 | [实现超时、取消与有限重试](./lesson-05-tool-timeout-retry.md) | Deadline、取消传播、错误分类、退避和重试预算 |
| 6 | [实现幂等、并发控制与故障隔离](./lesson-06-tool-idempotency-concurrency.md) | 幂等键、结果复用、并发闸门、依赖失败与安全降级 |
| 7 | [建立工具风险与权限模型](./lesson-07-tool-risk-permission-model.md) | 三层授权、RBAC/ABAC 与低、中、高风险工具 |
| 8 | [实现租户、资源与作用域授权](./lesson-08-tenant-resource-scope-authorization.md) | 资源加载、PEP/PDP、租户隔离、路径和字段约束 |
| 9 | [实现 Human-in-the-loop 审批状态机](./lesson-09-hitl-approval.md) | 不可变提案、状态迁移、批准凭证和原子消费 |
| 10 | [建立审计、Trace 与风险回放](./lesson-10-tool-audit-recovery.md) | 审计事件、脱敏、未知结果、风险回放和恢复 |
| 11 | [理解 MCP 协议与 Transport](./lesson-11-mcp-protocol-transport.md) | Tools/Resources/Prompts、Transport、会话与能力发现 |
| 12 | [将 MCP Client 接入 Tool Runtime](./lesson-12-mcp-client-runtime-integration.md) | 本地契约映射、Runtime 接入、安全、可靠性与观测 |
| 13 | [开发自定义 MCP Server](./lesson-13-custom-mcp-server.md) | 工具暴露、认证、租户隔离、部署和版本演进 |
| 14 | [建立调试入口并完成 M2 验收](./lesson-14-debugging-and-acceptance.md) | CLI、Tool Call Trace、故障演练和里程碑验收 |

## 内容分组

| 阶段 | 课次 | 核心问题 | 阶段产物 |
| --- | --- | --- | --- |
| 工具协议 | 1–3 | 模型如何提出稳定、可发现的工具调用 | Tool Schema 与 Registry |
| 执行与可靠性 | 4–6 | 调用如何正确执行并控制时间、副作用和资源竞争 | Tool Runtime 与可靠性执行器 |
| 权限与风险 | 7–8 | 谁能对什么资源执行什么动作 | 三类风险工具与资源级授权层 |
| 审批与审计 | 9–10 | 高风险动作如何获得确认并留下可恢复证据 | HITL 状态机、审计 Trace 与风险回放 |
| MCP 互操作 | 11–13 | 远程能力如何在本地边界内被发现、调用和提供 | MCP Client、Runtime Adapter 与自定义 Server |
| 调试与验收 | 14 | 如何证明 M2 的成功、失败与恢复路径 | 受控 CLI、故障演练与验收报告 |

## 建议学习节奏

每节课使用一个标准课时，课堂按“原理与边界 → 最小实现 → 失败测试 → 完成清单”的闭环推进。第 1–4 课建立协议和最小执行链，第 5–6 课补齐可靠性，第 7–10 课完成权限、审批和审计，第 11–13 课完成 MCP 互操作，最后通过第 14 课集中验证 M2。

## M2 交付内容

- Tool Registry 与统一 Tool Schema
- 低风险只读工具 `get_order_status`
- 中风险写入工具 `update_order_note`
- 高风险操作工具 `cancel_order`
- 租户、资源、路径和字段级授权机制
- 超时、取消、有限重试、幂等、并发和依赖降级机制
- Human-in-the-loop 审批状态机与一次性批准凭证
- 审计 Trace、风险回放和未知结果恢复路径
- 一个自定义 MCP Server 与受控 MCP Client 接入
- CLI 调试入口与 Tool Call Trace

## M2 验收标准

- 非法参数在执行前被拦截。
- 未授权和高风险操作不能静默执行。
- 低风险工具仍受租户和资源边界约束，中风险工具不能修改白名单外字段。
- 高风险工具只有在资源授权和有效审批同时成立时才能执行。
- 工具超时不会导致整个服务永久阻塞，未知结果不会被盲目重试。
- 并发和重复请求不会制造超出预期的副作用。
- MCP 工具不能绕过本地 Registry、授权、审批、预算和审计。
- 每次调用可追踪到用户、工具版本、资源范围、结果和风险决策。

## 最终产物

本章完成后，`agent-platform` 将拥有一套独立于具体模型和工具实现的 Agent Tool Runtime。第三章会在这套受控执行能力之上加入任务状态、Checkpoint 和 Agent Loop。
