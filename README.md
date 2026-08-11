# AI Agent 101 —— 全栈工程师训练营

> 你的 AI Agent 全栈起点班。从现在开始，付出 101 分的努力。

## 为什么有这个项目

市面上的「AI Agent 全栈工程师训练营」广告很多，价格也不便宜。课程内容呢？大多差不多。更麻烦的是，对 2026 年的新热点覆盖不够：A2A 协议、Agent FinOps、合规治理、AI Coding Agent，往往一带而过。

事情是这样的。我把这些训练营的数据爬下来，对照今年的行业趋势，重新规划了一份大纲。然后联合 GLM 5.2、GPT-5.6 系列、Claude Opus 4.8、Claude Fable 5 等主流模型，围绕这份大纲写出了详细讲义。

**目标很明确：循序渐进，能跟着做完。**

每章都有完整代码实现。代码不在本仓库，而在独立仓库里。

## 面向人群

本课程面向已有基础开发能力的后端、全栈或平台工程师。你至少应掌握：

- Python 基础、异步编程和面向对象设计
- HTTP API、FastAPI 或同类 Web 框架
- SQL、PostgreSQL 或同类关系型数据库
- Git、单元测试、Docker 和命令行开发
- 基础前端开发能力，能阅读 TypeScript / React 代码

如果你还在补这些前置知识，建议先打好基础，再进来。

## 项目驱动

整套课程围绕同一个持续演进的项目展开：

所谓 **Agent Engineering Platform**，就是一套可部署、可评测、可治理的全栈 Agent 平台，代码目录是 `agent-platform/`。

每一章只增加少量能力。不是推倒重来，而是在上一章的代码和数据上继续叠加。

## Agent 全栈基础知识

主线课程里，有些概念、协议和工程方法会反复出现。这里单独开一个专栏解释它们。

需要说明的是，专栏文章不占用主线课程编号，可以独立阅读。

- [基础知识专栏目录](./foundations/index.md)
- [同一个模型，为什么有多种 API？](./foundations/ai-protocols.md)

### [第一章：从零构建 LLM Gateway](./chapter-01-llm-gateway/index.md)

> 先把模型调稳，再让网页流式返回结果。先做 Mock Provider，再接真实模型。先跑通，再优化。

1. [第 1 课：建立一个可测试的后端](./chapter-01-llm-gateway/lesson-01-build-testable-backend.md)
2. [第 2 课：先接 Mock Provider，再接真实模型](./chapter-01-llm-gateway/lesson-02-mock-provider-real-model.md)
3. [第 3 课：接入 OpenAI-compatible 模型服务](./chapter-01-llm-gateway/lesson-03-openai-compatible-provider.md)
4. [第 4 课：结构化输出和错误边界](./chapter-01-llm-gateway/lesson-04-structured-output-error-boundary.md)
5. [第 5 课：实现 SSE 流式接口](./chapter-01-llm-gateway/lesson-05-sse-streaming-api.md)
6. [第 6 课：创建前端流式对话页](./chapter-01-llm-gateway/lesson-06-frontend-streaming-chat.md)
7. [第 7 课：为第一章补齐测试和 Golden Tasks](./chapter-01-llm-gateway/lesson-07-tests-and-golden-tasks.md)

### [第二章：构建 Tool Runtime 与 MCP 接入](./chapter-02-tool-runtime-mcp/index.md)

> 工具要先能被安全发现和执行。模型怎么选工具，放到第三章再接。

1. [第 8 课：理解工具调用的边界](./chapter-02-tool-runtime-mcp/lesson-08-tool-call-boundaries.md)
2. [第 9 课：定义工具、调用和审计协议](./chapter-02-tool-runtime-mcp/lesson-09-tool-call-audit-protocol.md)
3. [第 10 课：实现 Tool Registry](./chapter-02-tool-runtime-mcp/lesson-10-tool-registry.md)
4. [第 11 课：实现权限、审批、超时和审计](./chapter-02-tool-runtime-mcp/lesson-11-permission-approval-timeout-audit.md)
5. [第 12 课：测试 Tool Runtime](./chapter-02-tool-runtime-mcp/lesson-12-test-tool-runtime.md)
6. [第 13 课：创建工具管理和审批页面](./chapter-02-tool-runtime-mcp/lesson-13-tool-management-approval-page.md)
7. [第 14 课：最小 MCP Server 选修实验](./chapter-02-tool-runtime-mcp/lesson-14-mcp-server-experiment.md)

### [第三章：实现可恢复的 Agent Loop 与 Codebase Agent](./chapter-03-agent-loop-codebase-agent/index.md)

> 多步任务要能执行、暂停、恢复，还要能改代码。从 Scripted Decider 起步，最后才接真实模型。

1. [第 15 课：把「对话」变成「任务」](./chapter-03-agent-loop-codebase-agent/lesson-15-turn-conversation-into-tasks.md)
2. [第 16 课：保存任务和 Checkpoint](./chapter-03-agent-loop-codebase-agent/lesson-16-save-tasks-checkpoint.md)
3. [第 17 课：定义 Agent Decision 并实现 Scripted Decider](./chapter-03-agent-loop-codebase-agent/lesson-17-agent-decision-scripted-decider.md)
4. [第 18 课：实现最小 Agent Loop](./chapter-03-agent-loop-codebase-agent/lesson-18-minimal-agent-loop.md)
5. [第 19 课：审批、取消和恢复](./chapter-03-agent-loop-codebase-agent/lesson-19-approval-cancel-resume.md)
6. [第 20 课：构建受限 Codebase 工具和 Sandbox](./chapter-03-agent-loop-codebase-agent/lesson-20-codebase-tools-sandbox.md)
7. [第 21 课：接入真实模型决策和任务工作台](./chapter-03-agent-loop-codebase-agent/lesson-21-real-model-decision-workbench.md)

### [第四章：Context、Memory 与 Codebase RAG](./chapter-04-context-memory-codebase-rag/index.md)

> 检索代码和文档，管理项目记忆。让 Agent 在有限上下文里，找到能支撑结论的代码证据。

1. [第 22 课：先量化 Context，而不是盲目压缩](./chapter-04-context-memory-codebase-rag/lesson-22-context-quantification.md)
2. [第 23 课：把代码和文档解析成可引用的 Chunk](./chapter-04-context-memory-codebase-rag/lesson-23-code-doc-chunk.md)
3. [第 24 课：先实现可解释的关键词检索](./chapter-04-context-memory-codebase-rag/lesson-24-explainable-keyword-search.md)
4. [第 25 课：接入 Embedding、Hybrid Search 和 Rerank](./chapter-04-context-memory-codebase-rag/lesson-25-embedding-hybrid-search-rerank.md)
5. [第 26 课：项目记忆与 Context Builder 集成](./chapter-04-context-memory-codebase-rag/lesson-26-project-memory-context-builder.md)
6. [第 27 课：创建代码知识页面和 RAG 对照实验](./chapter-04-context-memory-codebase-rag/lesson-27-code-knowledge-rag-experiment.md)

### [第五章：Multi-Agent、Skill 与 A2A](./chapter-05-multi-agent-a2a/index.md)

> 多个 Agent 可以分工协作。但先问一句：真的需要 Multi-Agent 吗？再写协作代码。

1. [第 28 课：判断是否需要 Multi-Agent](./chapter-05-multi-agent-a2a/lesson-28-determine-need-multi-agent.md)
2. [第 29 课：定义 Subtask 和结果协议](./chapter-05-multi-agent-a2a/lesson-29-subtask-result-protocol.md)
3. [第 30 课：实现并行 Supervisor](./chapter-05-multi-agent-a2a/lesson-30-parallel-supervisor.md)
4. [第 31 课：结果聚合、冲突和 Reviewer](./chapter-05-multi-agent-a2a/lesson-31-result-aggregation-conflict-reviewer.md)
5. [第 32 课：把重复任务封装为 Skill](./chapter-05-multi-agent-a2a/lesson-32-skill-encapsulation.md)
6. [第 33 课：A2A 选修实验](./chapter-05-multi-agent-a2a/lesson-33-a2a-experiment.md)
7. [第 34 课：创建协作任务页并完成验收](./chapter-05-multi-agent-a2a/lesson-34-collaboration-page-acceptance.md)

### [第六章：Agent Eval、回归测试与质量改进](./chapter-06-agent-eval/index.md)

> 用数据证明 Agent 有没有变好。不能只说「这次 Demo 看起来不错」。

1. [第 35 课：建立 Golden Dataset](./chapter-06-agent-eval/lesson-35-golden-dataset.md)
2. [第 36 课：实现规则评测器](./chapter-06-agent-eval/lesson-36-rule-evaluator.md)
3. [第 37 课：保存 Trace 并定位失败步骤](./chapter-06-agent-eval/lesson-37-trace-failure-location.md)
4. [第 38 课：谨慎使用 LLM-as-Judge](./chapter-06-agent-eval/lesson-38-llm-as-judge.md)
5. [第 39 课：回归测试和版本对比](./chapter-06-agent-eval/lesson-39-regression-test-version-compare.md)
6. [第 40 课：创建 Eval Dashboard 和自动化入口](./chapter-06-agent-eval/lesson-40-eval-dashboard-automation.md)

### [第七章：生产工程、可观测性与 FinOps](./chapter-07-production-finops/index.md)

> 部署、监控、成本控制和回滚。把本机项目，变成可重复部署的服务。

1. [第 41 课：把本地依赖写成 Docker Compose](./chapter-07-production-finops/lesson-41-docker-compose-deps.md)
2. [第 42 课：配置、密钥和健康检查](./chapter-07-production-finops/lesson-42-config-secrets-healthcheck.md)
3. [第 43 课：结构化日志、Trace 和 Replay](./chapter-07-production-finops/lesson-43-structured-logs-trace-replay.md)
4. [第 44 课：建立 Token 预算和 FinOps 报表](./chapter-07-production-finops/lesson-44-token-budget-finops-report.md)
5. [第 45 课：版本、灰度和回滚](./chapter-07-production-finops/lesson-45-version-canary-rollback.md)
6. [第 46 课：运维治理台和本章验收](./chapter-07-production-finops/lesson-46-ops-governance-acceptance.md)

### [第八章：身份、审批、审计与治理](./chapter-08-compliance-governance/index.md)

> 身份、权限、审计、脱敏和人工监督。把风险要求，翻译成能落地的工程控制。

1. [第 47 课：从风险矩阵开始，而不是从法规名词开始](./chapter-08-compliance-governance/lesson-47-risk-matrix.md)
2. [第 48 课：分开用户、Agent 和工具身份](./chapter-08-compliance-governance/lesson-48-identity-separation.md)
3. [第 49 课：实现持久化审批单](./chapter-08-compliance-governance/lesson-49-persistent-approval.md)
4. [第 50 课：数据脱敏、隔离和审计](./chapter-08-compliance-governance/lesson-50-data-masking-isolation-audit.md)
5. [第 51 课：Human-in-the-loop 和 Kill Switch](./chapter-08-compliance-governance/lesson-51-human-in-loop-kill-switch.md)
6. [第 52 课：合规与审计页面、本章验收](./chapter-08-compliance-governance/lesson-52-compliance-audit-page-acceptance.md)

### [第九章：完成一个可展示的全栈 Agent 产品](./chapter-09-comprehensive-project-portfolio/index.md)

> 从已有能力里选一个真实场景：冻结范围，交付产品，部署演示，完成答辩。

1. [第 53 课：写一页产品需求](./chapter-09-comprehensive-project-portfolio/lesson-53-product-requirements.md)
2. [第 54 课：冻结架构和核心任务](./chapter-09-comprehensive-project-portfolio/lesson-54-architecture-core-tasks.md)
3. [第 55 课：完成全栈用户流程](./chapter-09-comprehensive-project-portfolio/lesson-55-fullstack-user-flow.md)
4. [第 56 课：做一次真实的质量改进](./chapter-09-comprehensive-project-portfolio/lesson-56-quality-improvement.md)
5. [第 57 课：部署、演示与答辩](./chapter-09-comprehensive-project-portfolio/lesson-57-deploy-demo-defense.md)

---

必须牢记的是：每章结束时，项目都应能运行。下一章不是推倒重来，而是在上一章的代码和数据上叠加能力。

## 你将学到

做完这门课，你大致会具备下面这些能力。

**模型接入与工具调用**

- 结构化输出、流式响应、错误边界与重试策略
- Tool Registry、权限控制、调用审计与 MCP 协议

**长程任务与上下文管理**

- Agent Loop、Checkpoint、Sandbox 沙箱、Codebase Agent
- Context Budget 预算控制、Memory 记忆管理、Codebase RAG 检索

**多 Agent 协作与工程闭环**

- Supervisor 调度、Skill 技能编排，以及 A2A 协议（选修）
- Golden Tasks 基准评测、Trace 追踪、FinOps 成本管控、合规治理

## 代码仓库

本仓库只放课件文档。教程代码在另一个仓库，用分支区分各章进度。

> **[ricoNext/agent-platform](https://github.com/ricoNext/agent-platform)** —— 配套的 Agent Engineering Platform 全栈项目代码

| 分支 | 内容 | 说明 |
|------|------|------|
| `chapter-xx` | 各小节代码（完成态） | 切到对应分支，就能拿到该小节完整代码 |

```bash
# 克隆代码仓库
git clone https://github.com/ricoNext/agent-platform.git

# 从初始骨架开始

# 查看第 1 节课完整代码
git checkout chapter-01
```

上面命令执行完以后，你就进入了第一章对应的代码状态。

## 主线技术栈

一门主线，循序渐进。其他工具只在对比或选修实验里出现。

| 领域 | 主线选择 | 用途 |
|------|----------|------|
| 后端 | Python 3.12、FastAPI、Pydantic v2 | API、数据校验与服务编排 |
| 模型接入 | OpenAI-compatible Provider 抽象 | 统一接入云端或本地模型 |
| 数据库 | PostgreSQL | 用户、任务、工具、评测和审计 |
| 缓存/队列 | Redis | 会话、状态、事件与限流 |
| 向量检索 | PostgreSQL + pgvector 或 Qdrant | 向量检索与项目知识库 |
| Agent 编排 | 先手写最小 Loop，后 LangGraph 对照 | 先理解原理，再学框架 |
| 前端 | React / Next.js、TypeScript | 对话、任务、审批、Trace 与 Dashboard |
| 前端测试 | Playwright | 验证用户真实流程 |
| 后端测试 | pytest、httpx | 单元测试、接口测试和 Agent 回归测试 |
| 部署 | Docker Compose | 本地与教学环境一键启动 |

每次新引入工具，都会先解释三件事：**解决什么问题、没有它会怎样、为什么现在引入**。

## 内容分层

| 层级 | 范围 | 要求 |
|------|------|------|
| 🔴 核心必修 | 第 1~4 章、第 6 章基础、第 7 章基础、第 9 章综合项目 | 提交代码、测试、评测报告和部署文档 |
| 🟡 进阶选修 | A2A、ACP、AG-UI、推理服务优化、Kubernetes、治理 Agent | 以专题实验或案例报告完成，不阻塞主线结业 |
| 🟢 案例阅读 | DeerFlow 源码、Claude Code / Cursor 架构、跨组织 Agent 协作 | 输出架构分析报告，不要求完整复刻 |

## 常见认知盲点

多数 Agent 课程，默认学员已经懂下面这些事。结果呢？初学时反复卡壳。

本课程会在相应章节把它们补齐：

- **HTTP ≠ 模型调用**：模型调用也是网络请求，同样会超时、限流、断开，也会返回非法数据
- **模型输出 ≠ 程序结果**：自然语言必须经 Schema 校验，才能进入业务代码
- **工具调用 ≠ 函数调用的语法糖**：工具有权限、风险、审计、超时和副作用
- **Agent ≠ 更长的 Prompt**：Agent 是模型、工具、状态、上下文和执行环境组成的循环系统
- **上下文 ≠ 越长越好**：无关信息会污染决策，同时增加延迟和成本
- **RAG ≠ 上传文件自动变聪明**：解析、切分、召回、重排、引用和评估，每一步都可能出错
- **多 Agent ≠ 多调几次模型**：协作需要任务边界、上下文边界、权限边界和结果协议
- **Demo 成功 ≠ 系统可靠**：必须保存任务集、轨迹、失败样本和版本对比结果
- **部署成功 ≠ 可以上线**：上线还需要密钥、租户、审计、告警、成本、灰度和回滚
- **前端 ≠ 最后加一层页面**：Agent 的暂停、审批、失败和恢复，必须在 UI 里可理解、可操作
