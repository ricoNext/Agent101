# 第 1 课：认识 Agent 工程与课程平台

> 所属章节：[第一章：LLM API、Prompt、Structured Output 与 Gateway](./index.md)  
> 下一课：[第 2 课：建立一个可测试的后端](./lesson-02-testable-backend.md)

## 一、本课要解决的问题

很多人第一次做 Agent 项目，会从“让模型回答一句话”开始，然后立即加入 RAG、工具调用、工作流和多个 Agent。Demo 很快出现，系统边界却越来越模糊：模型为什么这样回答、工具为什么能执行、任务失败后从哪里恢复，往往没人说得清楚。

第一章先收住范围，只解决一件事：

> 建立一个稳定、统一、可观测的模型调用入口。

这个入口就是 LLM Gateway。它是后续工具运行时、Agent Loop、Context、Eval 和生产治理共同依赖的基础设施。

完成本课后，你应该能够：

1. 区分 LLM 应用、RAG、Workflow 和 Agent。
2. 解释 Agent 系统的六类核心组成。
3. 说明传统后端能力如何迁移到 Agent 工程。
4. 画出课程平台的模块边界和七章演进路线。
5. 明确第一章做什么，以及刻意不做什么。

## 二、先区分四类系统

### 2.1 LLM 应用

LLM 应用把输入交给模型，再把输出交给用户或业务系统。典型例子包括对话、摘要、分类和信息抽取。

最小调用链是：

```text
用户输入 -> Prompt -> 模型 -> 输出
```

这类系统不一定是 Agent。只要一次模型调用就能完成任务，就没有必要强行加入 Agent Loop。

### 2.2 RAG

RAG 在模型调用前增加检索，把外部证据放入上下文：

```text
问题 -> 检索 -> 证据 -> Prompt -> 模型 -> 带证据的回答
```

RAG 解决的是“模型当前看到了什么信息”，不是“模型能不能自主执行多步任务”。第四章会单独建设 Context 与 Codebase RAG。

### 2.3 Workflow

Workflow 的步骤和分支由程序预先定义。例如：先分类，再检索，然后生成答案，失败时转人工。它适合规则明确、路径稳定的任务。

```text
输入 -> 固定步骤 A -> 条件分支 -> 固定步骤 B -> 输出
```

模型可以参与某些节点，但流程控制权仍然在程序手中。

### 2.4 Agent

Agent 会根据当前目标、状态和观察结果，动态决定下一步行动。它通常包含循环：

```text
观察 -> 计划 -> 行动 -> 再观察 -> 完成或继续
```

Agent 适合步骤无法完全预先确定的任务，同时也带来死循环、越权、成本失控和失败恢复等新问题。第三章才会正式实现 Agent Loop。

### 2.5 选择原则

| 任务特征 | 优先选择 |
| --- | --- |
| 一次生成即可完成 | 普通 LLM 应用 |
| 需要外部证据，但流程固定 | RAG + Workflow |
| 步骤明确、合规要求严格 | 固定 Workflow |
| 下一步依赖动态观察结果 | Agent |
| 任务可以稳定拆成独立角色 | 评估后再考虑 Multi-Agent |

工程目标不是让架构看起来更“智能”，而是用最简单、可验证的系统完成任务。

## 三、Agent 系统的六类组成

把具体框架名称拿掉，一个可工作的 Agent 系统通常由六类能力组成。

| 组成 | 核心问题 | 对应课程 |
| --- | --- | --- |
| 模型 | 调哪个模型，如何处理失败和成本 | 第一章 |
| 工具 | Agent 能做什么，谁允许它做 | 第二章 |
| 状态 | 当前执行到哪里，中断后如何恢复 | 第三章 |
| 上下文 | 这一步应该让模型看到什么 | 第四章 |
| 评测 | 如何证明新版本没有退化 | 第六章 |
| 运行环境 | 如何部署、观测、限权和回滚 | 第七章 |

Multi-Agent 和 Skill 是这些基础能力之上的协作形式，不是独立于平台的魔法层。

## 四、后端工程能力如何迁移

Agent 工程并没有抛弃传统软件工程。相反，模型的不确定性让原有工程能力更加重要。

### 4.1 API 契约仍然重要

模型输出可以变化，但你的 HTTP 接口、错误码和业务 Schema 必须稳定。上层系统不应该因为更换模型厂商就改请求格式。

### 4.2 依赖注入仍然重要

业务服务依赖 `ModelProvider` 接口，而不是直接依赖某个厂商 SDK。这样才能使用 Mock、切换 Provider，并让测试避开真实网络。

### 4.3 可观测性从请求扩展到模型调用

普通后端会记录状态码和耗时。LLM Gateway 还应记录：

- 模型与 Provider
- Prompt ID 和版本
- 输入、输出 Token
- 延迟和估算成本
- 错误分类与重试次数
- `run_id` 或 Trace ID

### 4.4 失败不再只有 HTTP 失败

模型调用可能出现四层失败：

1. 网络失败：连接错误、超时、断流。
2. 服务失败：限流、鉴权、5xx。
3. 协议失败：响应字段缺失、SSE 格式异常。
4. 内容失败：JSON 合法但不满足业务 Schema，或答案质量不合格。

不同失败需要不同策略，不能全部包装成一句“模型调用失败”。

## 五、课程平台的边界

七章课程始终建设同一个 `agent-platform`：

```text
agent-platform/
├── apps/
│   ├── api/              # FastAPI：Gateway、工具、Agent 与评测接口
│   ├── web/              # Next.js：对话、任务、审批与运营控制台
│   └── worker/           # 后续长任务执行进程
├── packages/
│   ├── evals/            # Golden Tasks、Benchmark 与评测结果
│   └── shared/           # 跨应用共享协议
├── infra/                # 数据库、缓存和部署配置
└── docs/                 # 架构、基线、Runbook 与复盘
```

第一章只创建 `apps/api`、`apps/web` 和 `packages/evals` 的最小部分。数据库、队列、向量检索和 Worker 会在真正需要时再引入。

## 六、七个里程碑如何叠加

```text
M1 LLM Gateway 大模型网关
  -> M2 Tool Runtime 工具运行时
  -> M3 Codebase Agent 代码基础Agent
  -> M4 Context & RAG 上下文与向量检索
  -> M5 Agent Collaboration 多Agent协作
  -> M6 Agent Eval Platform 多Agent评测平台
  -> M7 Production Ready Platform 生产就绪平台
```

每个里程碑都必须保持上一阶段可运行。下一章是在已有平台上增加能力，不是另起一个互不相关的示例仓库。

## 七、第一章的完成标准

完成第一章时，平台至少具备：

- 一个 OpenAI-compatible FastAPI 模型服务
- 一个真实 Provider 与一个 Mock Provider
- 普通调用和可取消的 Streaming 调用
- Prompt 模板与版本字段
- Structured Output 校验与失败处理
- 基础模型路由、重试与 fallback
- Token、Cost、Latency 和 Trace ID 记录
- 一份可以复现的模型调用基线报告

第一章明确不做 Function Calling、MCP、Agent Loop、RAG 和 Multi-Agent。

## 八、课堂练习：画出边界

选择“总结一篇技术文档”这个任务，回答下面的问题：

1. 如果文档内容已经随请求传入，是否需要 RAG？
2. 如果只调用一次模型，是否应该叫 Agent？
3. 哪些字段必须由 API Schema 保证，而不能交给 Prompt 保证？
4. 模型超时和模型返回非法 JSON，应该使用同一个错误码吗？
5. 更换 Provider 时，前端是否应该修改请求体？

## 九、本课验收

完成本课后，请确认：

- 能用一句话解释 LLM 应用、RAG、Workflow 与 Agent 的区别
- 能说出 Agent 系统的六类组成
- 能解释为什么第一章先建设 Gateway
- 已写出第一章范围内与范围外的能力清单
- 已画出 Agent Engineering Platform 的演进路线

下一课开始创建可测试的 FastAPI 后端，让平台先拥有一个稳定的 HTTP 基线。
