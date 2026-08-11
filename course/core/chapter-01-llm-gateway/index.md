# 第一章：LLM API、Prompt、Structured Output 与 Gateway

> 建议课时：10 课时  
> 项目里程碑：M1 · LLM Gateway

## 章节定位

本章完成从传统 HTTP API 调用到可治理 LLM 服务的迁移，只解决“如何稳定、统一、可观测地调用模型”。Function Calling、MCP 和 Agent Loop 从第二、三章开始，本章不提前混入。

十课始终建设同一个 `agent-platform`。每课都在上一课的代码基础上增加一项能力，最终形成后续所有 Agent 功能共同依赖的 Gateway。

## 学习目标

完成本章后，你应该能够：

1. 区分 LLM 应用、RAG、Workflow 与 Agent。
2. 设计不依赖具体厂商协议的 Provider 接口。
3. 接入 OpenAI-compatible 模型并处理超时、限流和异常响应。
4. 理解 Chat Completions、Responses 类 API、生成参数、Context Window 与模型能力矩阵。
5. 将 Prompt 管理为有 ID、有版本、有变量契约的工程资产。
6. 使用 Pydantic 校验 Structured Output，并建立纠错、降级和 Schema 演进边界。
7. 使用逻辑模型别名实现路由、有限重试和 fallback。
8. 区分 Gateway 租户限流与 Provider 限流，并提供稳定错误协议。
9. 设计带明确终态、顺序和取消传播的 SSE 事件流。
10. 记录模型、Prompt、Schema、Token、Cost、Latency 和 Trace ID。
11. 使用 Mock、Golden Tasks、Runner 和基线报告验证 Gateway。

## 课程目录

| 课次 | 主题 | 主要工程增量 |
| ---: | --- | --- |
| 1 | [认识 Agent 工程与课程平台](./lesson-01-agent-engineering-map.md) | 明确能力边界、平台结构和七章演进路线 |
| 2 | [建立一个可测试的后端](./lesson-02-testable-backend.md) | FastAPI 骨架、健康检查和稳定 HTTP 基线 |
| 3 | [用 Provider 抽象隔离模型服务](./lesson-03-provider-abstraction-mock.md) | 通用协议、Provider 接口和 Mock Provider |
| 4 | [接入 OpenAI-compatible 模型服务](./lesson-04-openai-compatible-provider.md) | 真实模型配置、适配器和 Provider 工厂 |
| 5 | [管理 Prompt 模板与版本](./lesson-05-prompt-management.md) | Prompt Registry、变量校验和版本字段 |
| 6 | [建立 Structured Output 错误边界](./lesson-06-structured-output.md) | 业务 Schema、解析校验和结构化摘要 |
| 7 | [实现可靠性策略与模型路由](./lesson-07-reliability-routing.md) | 重试、退避、fallback、逻辑路由和调用记录 |
| 8 | [实现可取消的 SSE 流式接口](./lesson-08-sse-streaming.md) | 统一事件协议、异常终态和取消传播 |
| 9 | [创建 Gateway 前端控制台](./lesson-09-frontend-gateway-console.md) | 流式 UI、模型路由、Run ID 和停止操作 |
| 10 | [建立模型基线并完成 M1 验收](./lesson-10-baseline-and-acceptance.md) | Golden Tasks、接口矩阵、基线报告和复盘 |

## 建议学习节奏

每课建议使用一个标准课时。课堂按下面的闭环推进：

1. 解释原理、适用边界和常见失败。
2. 完成一个可运行的最小实现。
3. 主动制造错误并观察系统行为。
4. 按本课验收清单检查工程结果。
5. 记录设计选择、失败样本和未解决问题。

第 2-10 课需要在配套项目仓库中持续实践。旧版参考分支仍可用于查看相关代码基线，但应以本章新版讲义的接口、Prompt、路由和验收要求为准。

## M1 交付内容

- 一个 OpenAI-compatible 的 FastAPI 模型服务
- 至少一个真实 Provider 与一个 Mock Provider
- 普通调用和可取消的 Streaming 调用
- Prompt Registry、模板变量校验与版本字段
- Structured Output 解析、Schema 校验、有限纠错与明确恢复协议
- 逻辑模型路由、有限重试和 fallback
- Gateway 租户限流与 Provider 限流错误协议
- Token、Cost、Latency、生成参数、Prompt、Schema 版本和 Trace ID 记录
- 一个可操作的 Gateway 前端控制台
- 第一批 Golden Tasks、最小 Runner 与模型调用基线报告

## M1 验收标准

### 协议与抽象

- 上层调用方不感知具体厂商请求格式和底层模型名称。
- Mock 与真实 Provider 通过配置切换，不修改业务路由。
- Prompt 和业务输出都有明确版本或 Schema。

### 可靠性

- 限流、超时、鉴权和格式错误使用稳定错误协议。
- 只有可恢复的瞬时错误会重试，次数与总预算有上限。
- fallback 不会把 Mock 结果伪装成生产回答。

### Streaming

- 每条事件都有相同 `run_id` 和递增 `sequence`。
- 正常流以 `run.completed` 结束，失败流以 `run.failed` 结束。
- 用户取消后，服务端生成器和 Provider 连接能够释放。

### 可观测与验证

- 普通调用记录真实 Token usage；无 usage 时明确为 `null`。
- 模型、Prompt 版本、延迟、估算成本和重试次数可以按 `run_id` 查询。
- 基线报告至少覆盖成功率、延迟、Token、成本和错误分布。
- Golden Tasks 可以复现普通调用、结构化输出、Streaming 和失败路径。

## 最终产物

本章完成后，`agent-platform` 不只是“能调用模型”，而是拥有一条可替换、可验证、可追踪、可取消的模型调用链。第二章会直接复用这条链路，让模型开始调用受控工具。
