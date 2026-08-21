# 第一章：LLM API、Prompt、Structured Output 与 Gateway

## 章节定位

本章的目标是搭建一个可治理的 LLM 服务，实现“如何稳定、统一、可观测地调用模型”。

## 学习目标

完成本章后，你应该能够：

1. 区分 LLM 应用、RAG、Workflow 与 Agent。
2. 设计不依赖具体厂商协议的 Provider 接口。
3. 接入 OpenAI-compatible 模型并处理超时、限流和异常响应。
4. 理解 Chat Completions、Responses 类 API、生成参数、Context Window 与模型能力矩阵。
5. 将 Prompt 管理为有 ID、有版本、有变量契约的工程资产，并说明 Few-shot、Chain-of-Thought 与 Self-Consistency 的适用边界。
6. 使用 Pydantic 定义并校验 Structured Output 契约。
7. 为结构化输出建立有限纠错、明确降级和 Schema 演进边界。
8. 区分内容错误、Provider 错误与 Gateway 限流，并提供稳定错误协议。
9. 使用逻辑模型别名实现有限重试、fallback 和路由预算。
10. 用 Run、Attempt 与 Event 记录模型、Prompt、Schema、Token、Cost、Latency 和 Trace ID。
11. 设计带明确终态、顺序、取消传播和 `usage` 字段的 SSE 事件流，并能对比 WebSocket 的适用场景。
12. 使用前端控制台验证流式消费、模型路由、Run ID 与停止操作。
13. 使用单元测试、Golden Tasks 和受控故障场景定义 Gateway 验收任务。
14. 使用 Runner 重复执行任务，并根据事实数据生成模型调用基线报告。
15. 完成前后端联调、M1 验收判定和章节复盘。

## 课程目录

| 课次 | 主题 | 主要工程增量 |
| ---: | --- | --- |
| 1 | [认识 Agent 工程与课程平台](./lesson-01-agent-engineering-map.md) | 明确能力边界、平台结构和七章演进路线 |
| 2 | [建立一个可测试的后端](./lesson-02-testable-backend.md) | FastAPI 骨架、健康检查和稳定 HTTP 基线 |
| 3 | [理解 LLM API 与模型调用边界](./lesson-03-llm-api-model-boundaries.md) | 内部调用协议、生成参数、Token、成本、错误分层和能力矩阵 |
| 4 | [用 Provider 抽象隔离模型服务](./lesson-04-provider-abstraction-mock.md) | Provider 接口、请求响应标准化和 Mock Provider |
| 5 | [接入 OpenAI-compatible 模型服务](./lesson-05-openai-compatible-provider.md) | 真实模型配置、适配器、Provider 工厂和能力差异 |
| 6 | [管理 Prompt 模板与版本](./lesson-06-prompt-management.md) | Prompt Registry、变量校验、Few-shot、CoT 边界和版本字段 |
| 7 | [定义 Structured Output 契约](./lesson-07-structured-output-contract.md) | 业务 Schema、解析校验、结构化摘要和契约测试 |
| 8 | [处理 Structured Output 失败与 Schema 演进](./lesson-08-structured-output-recovery.md) | 错误分类、有限纠错、恢复协议、兼容规则和失败样本 |
| 9 | [实现调用可靠性与模型路由](./lesson-09-reliability-routing.md) | 错误语义、限流、重试、退避、逻辑模型和 fallback |
| 10 | [建立调用观测与成本治理](./lesson-10-observability-cost.md) | Run/Attempt/Event、Token、成本、延迟、版本和 Trace |
| 11 | [实现可取消的 SSE 流式接口](./lesson-11-sse-streaming.md) | 统一事件协议、`usage` 字段、WebSocket 对比、取消传播和资源释放 |
| 12 | [创建 Gateway 前端控制台](./lesson-12-gateway-console.md) | 流式 UI、模型路由、Run ID 和停止操作 |
| 13 | [构建 Gateway 验收任务集](./lesson-13-gateway-acceptance-tasks.md) | 核心调用链测试、Golden Tasks 和受控故障场景 |
| 14 | [实现基线 Runner 与评测报告](./lesson-14-baseline-runner-report.md) | 重复执行、JSONL 事实记录、指标统计和基线报告 |
| 15 | [完成 M1 联调验收与复盘](./lesson-15-m1-integration-acceptance.md) | 接口矩阵、前端状态、里程碑判定和章节复盘 |

## 内容分组

| 阶段 | 课次 | 核心问题 | 阶段产物 |
| --- | --- | --- | --- |
| 工程起点 | 1–2 | Agent 工程边界是什么，后端基线如何保持可测试 | 平台地图与 FastAPI 骨架 |
| 模型接入 | 3–5 | 如何理解并隔离不同模型协议 | 内部调用协议、Mock 与真实 Provider |
| Prompt 与输出协议 | 6–8 | 如何管理输入，并让输出可校验、可恢复、可演进 | Prompt Registry 与 Structured Output 契约 |
| 可靠性与观测 | 9–10 | 模型故障时如何恢复，调用代价如何追踪 | 路由控制面与模型调用记录 |
| Streaming 与交互 | 11–12 | 流式任务如何正确结束，用户如何观察和停止运行 | SSE 接口与 Gateway 前端控制台 |
| 验收任务设计 | 13 | M1 应该验证哪些成功、失败与恢复路径 | Golden Tasks 与受控故障场景 |
| 基线执行 | 14 | 如何重复执行任务并形成可比较数据 | Runner、JSONL 记录与基线报告 |
| 联调与验收 | 15 | 如何依据证据判断 M1 是否完成 | 接口矩阵、验收结论与章节复盘 |


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
- `run.completed` 必须包含 `usage`；无真实 Token 时该字段为 `null`，不用字符数冒充。
- 用户取消后，服务端生成器和 Provider 连接能够释放。

### 可观测与验证

- 普通调用和流式终态都记录真实 Token usage；无 usage 时明确为 `null`。
- 模型、Prompt 版本、延迟、估算成本和重试次数可以按 `run_id` 查询。
- 基线报告至少覆盖成功率、延迟、Token、成本和错误分布。
- Golden Tasks 可以复现普通调用、结构化输出、Streaming 和失败路径。

## 最终产物

本章完成后，`agent-platform` 不只是“能调用模型”，而是拥有一条可替换、可验证、可追踪、可取消的模型调用链。第二章会直接复用这条链路，让模型开始调用受控工具。
