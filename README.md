# AI Agent 101 —— 全栈工程师训练营

> 你的 AI Agent 全栈起点班，从现在开始付出 101 分的努力。

## 为什么有这个项目

市面上的「AI Agent 全栈工程师训练营」广告铺天盖地，价格不菲，但课程内容大同小异，且对 2026 年最新 Agent 热点覆盖不足。

于是我把这些训练营的数据爬下来，结合 2026 年最新 AI 行业趋势——A2A 协议、Agent FinOps、合规治理、AI Coding Agent 等——重新规划了一份大纲，再联合 GLM 5.2、GPT-5.6 系列、Claude Opus 4.8、Claude Fable 5 等主流模型，一起围绕这份大纲输出了**循序渐进、可持续跟进学习的详细课程讲义**。每章节均配有完整的代码实现。

## 面向人群

本课程面向已具备基础开发能力的后端、全栈或平台工程师，应至少掌握：

- Python 基础、异步编程和面向对象设计
- HTTP API、FastAPI 或同类 Web 框架
- SQL、PostgreSQL 或同类关系型数据库
- Git、单元测试、Docker 和命令行开发
- 基础前端开发能力，能够阅读 TypeScript/React 代码

## 项目驱动

整套课程围绕同一个持续演进的项目 **Agent Engineering Platform**（`agent-platform/`）展开。每一章只增加少量能力，最终交付一个可部署、可评测、可治理的全栈 Agent 平台。

### [第一章：从零构建 LLM Gateway](./chapter-01-llm-gateway/README.md)

> 稳定调用模型，网页流式返回结果。先做 Mock Provider 再接真实模型，先跑通再优化。

1. [第 1 课：建立一个可测试的后端](./chapter-01-llm-gateway/lesson-01-build-testable-backend.md)
2. [第 2 课：先接 Mock Provider，再接真实模型](./chapter-01-llm-gateway/lesson-02-mock-provider-real-model.md)
3. [第 3 课：接入 OpenAI-compatible 模型服务](./chapter-01-llm-gateway/lesson-03-openai-compatible-provider.md)
4. [第 4 课：结构化输出和错误边界](./chapter-01-llm-gateway/lesson-04-structured-output-error-boundary.md)
5. [第 5 课：实现 SSE 流式接口](./chapter-01-llm-gateway/lesson-05-sse-streaming-api.md)
6. [第 6 课：创建前端流式对话页](./chapter-01-llm-gateway/lesson-06-frontend-streaming-chat.md)
7. [第 7 课：为第一章补齐测试和 Golden Tasks](./chapter-01-llm-gateway/lesson-07-tests-and-golden-tasks.md)

### [第二章：构建 Tool Runtime 与 MCP 接入](./chapter-02-tool-runtime-mcp/README.md)

> 安全发现和调用工具。先让工具能被安全执行，模型工具选择在第三章接入。

1. [第 1 课：理解工具调用的边界](./chapter-02-tool-runtime-mcp/lesson-01-tool-call-boundaries.md)
2. [第 2 课：定义工具、调用和审计协议](./chapter-02-tool-runtime-mcp/lesson-02-tool-call-audit-protocol.md)
3. [第 3 课：实现 Tool Registry](./chapter-02-tool-runtime-mcp/lesson-03-tool-registry.md)
4. [第 4 课：实现权限、审批、超时和审计](./chapter-02-tool-runtime-mcp/lesson-04-permission-approval-timeout-audit.md)
5. [第 5 课：测试 Tool Runtime](./chapter-02-tool-runtime-mcp/lesson-05-test-tool-runtime.md)
6. [第 6 课：创建工具管理和审批页面](./chapter-02-tool-runtime-mcp/lesson-06-tool-management-approval-page.md)
7. [第 7 课：最小 MCP Server 选修实验](./chapter-02-tool-runtime-mcp/lesson-07-mcp-server-experiment.md)

### [第三章：实现可恢复的 Agent Loop 与 Codebase Agent](./chapter-03-agent-loop-codebase-agent/README.md)

> 多步任务执行、暂停、恢复和代码修改。从 Scripted Decider 开始，最后才接入真实模型。

1. [第 1 课：把「对话」变成「任务」](./chapter-03-agent-loop-codebase-agent/lesson-01-turn-conversation-into-tasks.md)
2. [第 2 课：保存任务和 Checkpoint](./chapter-03-agent-loop-codebase-agent/lesson-02-save-tasks-checkpoint.md)
3. [第 3 课：定义 Agent Decision 并实现 Scripted Decider](./chapter-03-agent-loop-codebase-agent/lesson-03-agent-decision-scripted-decider.md)
4. [第 4 课：实现最小 Agent Loop](./chapter-03-agent-loop-codebase-agent/lesson-04-minimal-agent-loop.md)
5. [第 5 课：审批、取消和恢复](./chapter-03-agent-loop-codebase-agent/lesson-05-approval-cancel-resume.md)
6. [第 6 课：构建受限 Codebase 工具和 Sandbox](./chapter-03-agent-loop-codebase-agent/lesson-06-codebase-tools-sandbox.md)
7. [第 7 课：接入真实模型决策和任务工作台](./chapter-03-agent-loop-codebase-agent/lesson-07-real-model-decision-workbench.md)

### [第四章：Context、Memory 与 Codebase RAG](./chapter-04-context-memory-codebase-rag/README.md)

> 检索代码和文档，管理项目记忆。让 Agent 在有限上下文内找到能支持结论的代码证据。

1. [第 1 课：先量化 Context，而不是盲目压缩](./chapter-04-context-memory-codebase-rag/lesson-01-context-quantification.md)
2. [第 2 课：把代码和文档解析成可引用的 Chunk](./chapter-04-context-memory-codebase-rag/lesson-02-code-doc-chunk.md)
3. [第 3 课：先实现可解释的关键词检索](./chapter-04-context-memory-codebase-rag/lesson-03-explainable-keyword-search.md)
4. [第 4 课：接入 Embedding、Hybrid Search 和 Rerank](./chapter-04-context-memory-codebase-rag/lesson-04-embedding-hybrid-search-rerank.md)
5. [第 5 课：项目记忆与 Context Builder 集成](./chapter-04-context-memory-codebase-rag/lesson-05-project-memory-context-builder.md)
6. [第 6 课：创建代码知识页面和 RAG 对照实验](./chapter-04-context-memory-codebase-rag/lesson-06-code-knowledge-rag-experiment.md)

### [第五章：Multi-Agent、Skill 与 A2A](./chapter-05-multi-agent-a2a/README.md)

> 多个 Agent 分工协作。先问“是否应该多 Agent”，再写协作代码。

1. [第 1 课：判断是否需要 Multi-Agent](./chapter-05-multi-agent-a2a/lesson-01-determine-need-multi-agent.md)
2. [第 2 课：定义 Subtask 和结果协议](./chapter-05-multi-agent-a2a/lesson-02-subtask-result-protocol.md)
3. [第 3 课：实现并行 Supervisor](./chapter-05-multi-agent-a2a/lesson-03-parallel-supervisor.md)
4. [第 4 课：结果聚合、冲突和 Reviewer](./chapter-05-multi-agent-a2a/lesson-04-result-aggregation-conflict-reviewer.md)
5. [第 5 课：把重复任务封装为 Skill](./chapter-05-multi-agent-a2a/lesson-05-skill-encapsulation.md)
6. [第 6 课：A2A 选修实验](./chapter-05-multi-agent-a2a/lesson-06-a2a-experiment.md)
7. [第 7 课：创建协作任务页并完成验收](./chapter-05-multi-agent-a2a/lesson-07-collaboration-page-acceptance.md)

### [第六章：Agent Eval、回归测试与质量改进](./chapter-06-agent-eval/README.md)

> 用数据证明 Agent 是否变好了。不再只能说「这次 Demo 看起来不错」。

1. [第 1 课：建立 Golden Dataset](./chapter-06-agent-eval/lesson-01-golden-dataset.md)
2. [第 2 课：实现规则评测器](./chapter-06-agent-eval/lesson-02-rule-evaluator.md)
3. [第 3 课：保存 Trace 并定位失败步骤](./chapter-06-agent-eval/lesson-03-trace-failure-location.md)
4. [第 4 课：谨慎使用 LLM-as-Judge](./chapter-06-agent-eval/lesson-04-llm-as-judge.md)
5. [第 5 课：回归测试和版本对比](./chapter-06-agent-eval/lesson-05-regression-test-version-compare.md)
6. [第 6 课：创建 Eval Dashboard 和自动化入口](./chapter-06-agent-eval/lesson-06-eval-dashboard-automation.md)

### [第七章：生产工程、可观测性与 FinOps](./chapter-07-production-finops/README.md)

> 部署、监控、成本控制和回滚。把本机项目变成可重复部署的服务。

1. [第 1 课：把本地依赖写成 Docker Compose](./chapter-07-production-finops/lesson-01-docker-compose-deps.md)
2. [第 2 课：配置、密钥和健康检查](./chapter-07-production-finops/lesson-02-config-secrets-healthcheck.md)
3. [第 3 课：结构化日志、Trace 和 Replay](./chapter-07-production-finops/lesson-03-structured-logs-trace-replay.md)
4. [第 4 课：建立 Token 预算和 FinOps 报表](./chapter-07-production-finops/lesson-04-token-budget-finops-report.md)
5. [第 5 课：版本、灰度和回滚](./chapter-07-production-finops/lesson-05-version-canary-rollback.md)
6. [第 6 课：运维治理台和本章验收](./chapter-07-production-finops/lesson-06-ops-governance-acceptance.md)

### [第八章：身份、审批、审计与治理](./chapter-08-compliance-governance/README.md)

> 身份、权限、审计、脱敏和人工监督。把风险要求翻译成可实现的工程控制。

1. [第 1 课：从风险矩阵开始，而不是从法规名词开始](./chapter-08-compliance-governance/lesson-01-risk-matrix.md)
2. [第 2 课：分开用户、Agent 和工具身份](./chapter-08-compliance-governance/lesson-02-identity-separation.md)
3. [第 3 课：实现持久化审批单](./chapter-08-compliance-governance/lesson-03-persistent-approval.md)
4. [第 4 课：数据脱敏、隔离和审计](./chapter-08-compliance-governance/lesson-04-data-masking-isolation-audit.md)
5. [第 5 课：Human-in-the-loop 和 Kill Switch](./chapter-08-compliance-governance/lesson-05-human-in-loop-kill-switch.md)
6. [第 6 课：合规与审计页面、本章验收](./chapter-08-compliance-governance/lesson-06-compliance-audit-page-acceptance.md)

### [第九章：完成一个可展示的全栈 Agent 产品](./chapter-09-comprehensive-project-portfolio/README.md)

> 从已有能力中选一个真实场景，冻结范围、交付产品、部署演示和答辩。

1. [第 1 课：写一页产品需求](./chapter-09-comprehensive-project-portfolio/lesson-01-product-requirements.md)
2. [第 2 课：冻结架构和核心任务](./chapter-09-comprehensive-project-portfolio/lesson-02-architecture-core-tasks.md)
3. [第 3 课：完成全栈用户流程](./chapter-09-comprehensive-project-portfolio/lesson-03-fullstack-user-flow.md)
4. [第 4 课：做一次真实的质量改进](./chapter-09-comprehensive-project-portfolio/lesson-04-quality-improvement.md)
5. [第 5 课：部署、演示与答辩](./chapter-09-comprehensive-project-portfolio/lesson-05-deploy-demo-defense.md)

---

每章结束时，项目都应能运行；下一章不是推倒重来，而是在上一章的代码和数据上叠加能力。

## 你将学到

完成本课程后，你将具备以下能力：

**模型接入与工具调用**
- 结构化输出、流式响应、错误边界与重试策略
- Tool Registry、权限控制、调用审计与 MCP 协议

**长程任务与上下文管理**
- Agent Loop、Checkpoint、Sandbox 沙箱、Codebase Agent
- Context Budget 预算控制、Memory 记忆管理、Codebase RAG 检索

**多 Agent 协作与工程闭环**
- Supervisor 调度、Skill 技能编排，A2A 协议（选修）
- Golden Tasks 基准评测、Trace 追踪、FinOps 成本管控、合规治理

## 分支策略

本仓库使用分支分离课件与代码：

| 分支 | 内容 | 说明 |
|------|------|------|
| `main` | 课件文档 | 课程大纲、讲义等，不含项目代码 |
| `chapter-00-init` | 初始骨架 | 健康检查 + 项目结构，从零开始的起点 |
| `chapter-01` ~ `chapter-09` | 各章代码（完成态） | 切换到对应分支即可获得该阶段完整代码 |

> **学习建议**：切换到对应章节分支获取该阶段完整代码，`main` 分支专注阅读讲义。

```bash
# 查看所有分支
git branch -a

# 从初始骨架开始
git checkout chapter-00-init

# 查看第 1 章完整代码
git checkout chapter-01

# 回到课件
git checkout main
```

## 主线技术栈

一门主线，循序渐进。其他工具仅在对比或选修实验中涉及。

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

每次新引入工具，都会先解释：**解决什么问题、没有它会怎样、为什么现在引入**。

## 内容分层

| 层级 | 范围 | 要求 |
|------|------|------|
| 🔴 核心必修 | 第 1~4 章、第 6 章基础、第 7 章基础、第 9 章综合项目 | 提交代码、测试、评测报告和部署文档 |
| 🟡 进阶选修 | A2A、ACP、AG-UI、推理服务优化、Kubernetes、治理 Agent | 以专题实验或案例报告完成，不阻塞主线结业 |
| 🟢 案例阅读 | DeerFlow 源码、Claude Code / Cursor 架构、跨组织 Agent 协作 | 输出架构分析报告，不要求完整复刻 |

## 常见认知盲点

多数 Agent 课程默认学员已了解以下内容，导致初学时反复卡壳。本课程在相应章节明确补齐：

- **HTTP ≠ 模型调用**：模型调用也是网络请求，同样会超时、限流、断开和返回非法数据
- **模型输出 ≠ 程序结果**：自然语言必须经 Schema 校验才能进入业务代码
- **工具调用 ≠ 函数调用的语法糖**：工具有权限、风险、审计、超时和副作用
- **Agent ≠ 更长的 Prompt**：Agent 是模型、工具、状态、上下文和执行环境组成的循环系统
- **上下文 ≠ 越长越好**：无关信息会污染模型决策，同时增加延迟和成本
- **RAG ≠ 上传文件自动变聪明**：解析、切分、召回、重排、引用和评估，每一步都可能出错
- **多 Agent ≠ 多调几次模型**：协作需要任务边界、上下文边界、权限边界和结果协议
- **Demo 成功 ≠ 系统可靠**：必须保存任务集、轨迹、失败样本和版本对比结果
- **部署成功 ≠ 可以上线**：上线还需要密钥、租户、审计、告警、成本、灰度和回滚
- **前端 ≠ 最后加一层页面**：Agent 的暂停、审批、失败和恢复必须在 UI 中可理解、可操作

