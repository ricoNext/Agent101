# AI Agent 101 —— 全栈工程师训练营

> AI Agent 101 你的全栈 AI Agent 的起点班, 从现在开始付出 101 分的努力

经常在朋友圈看到各种 AI Agent 全栈工程师训练营 的广告， 打开看一下还都不便宜，看一下课程规划其实都差不多，而且新的 Agent 热点包含的也比较少，所以我就干脆把这些训练营的数据爬了下来， 结合 2026 年最新 AI 行业趋势（A2A 协议、Agent FinOps、合规治理、AI Coding Agent 等）重新规划了一个大纲， 然后使用 GLM 5.2、GPT-5.6系列、 claude-opus-4.8、claude-fable-5 这些主流模型一起就这份大纲输出了一个循序渐进、可以持续跟进学习的详细课程讲义， 并且讲义中每章节都配了完整的代码实现。

下面是课程的介绍：

这个课程面向有基础开发经验的后端、全栈与平台工程师，系统学习如何把 AI Agent 从 Demo 做成可上线的工程产品。

整套课程围绕同一个持续演进的项目
**Agent Engineering Platform**（`agent-platform/`）展开：每一章只增加少量能力，最终交付可部署、可评测、可治理的全栈 Agent 平台。

## 你将学到什么

- 稳定接入模型服务：结构化输出、流式响应、错误边界
- 安全调用工具：Tool Registry、权限、审计与 MCP
- 长程任务编排：Agent Loop、Checkpoint、Sandbox、Codebase Agent
- 上下文与检索：Context Budget、Memory、Codebase RAG
- 多 Agent 协作：Supervisor、Skill，以及 A2A 选修
- 工程闭环：Golden Tasks、Eval、Trace、FinOps、合规治理

## 分支管理策略

本仓库采用分支来分离课件与代码：

| 分支 | 内容 | 说明 |
| --- | --- | --- |
| `main` | 课件信息 | course-materials、课程大纲等文档，不含 agent-platform 代码 |
| `chapter-00-init` | 初始项目骨架 | 健康检查 + 项目结构，课程开始前的起点 |
| `chapter-01` | LLM Gateway 完成 | 结构化输出、SSE 流式对话 |
| `chapter-02` | Tool Runtime 与 MCP | 工具注册、权限、审计 |
| `chapter-03` | Agent Loop 与 Codebase Agent | 可恢复的多步代码任务 |
| `chapter-04` | Context、Memory 与 RAG | 代码知识检索与项目记忆 |
| `chapter-05` | Multi-Agent 与 A2A | 协作任务与委托 |
| `chapter-06` | Agent Eval | Golden Dataset、回归与 Trace |
| `chapter-07` | 生产工程与 FinOps | 部署、观测、成本与灰度 |
| `chapter-08` | 合规与治理 | 身份、审批、审计、Kill Switch |
| `chapter-09` | 综合项目与作品集 | 可展示的全栈 Agent 产品 |

> 每个章节分支都包含完整的 `agent-platform/` 代码（对应该章完成后的状态），以及课件文档。
> 学习时，切换到对应章节的分支即可获取该阶段的完整代码。

### 切换分支示例

```bash
# 查看所有章节分支
git branch -a

# 从初始骨架开始学习
git checkout chapter-00-init

# 学习第 1 章时，切换到第 1 章完成状态查看参考代码
git checkout chapter-01

# 回到课件分支阅读课程讲义
git checkout main
```

## 仓库结构（main 分支）

```text
.
├── course-materials/     # 可逐课执行的教材（命令、代码、排错）
├── 00.md                 # 优化版课程大纲与训练设计
├── 课程体系.md           # 完整学习地图与章节正文
└── LICENSE
```

| 路径 | 用途 |
| --- | --- |
| [00.md](./00.md) | 优化版课程大纲与训练设计 |
| [课程体系.md](./课程体系.md) | 完整学习地图与章节正文 |
| [course-materials/README.md](./course-materials/README.md) | 逐课操作入口 |

> `agent-platform/` 代码不在 `main` 分支中，请切换到对应的章节分支查看。

## 九章主线

| 章节 | 主题 | 完成后的可运行能力 |
| --- | --- | --- |
| 第 1 章 | LLM Gateway | 结构化输出、SSE 流式对话 |
| 第 2 章 | Tool Runtime 与 MCP | 工具注册、权限、审计 |
| 第 3 章 | Agent Loop 与 Codebase Agent | 可恢复的多步代码任务 |
| 第 4 章 | Context、Memory 与 RAG | 代码知识检索与项目记忆 |
| 第 5 章 | Multi-Agent 与 A2A | 协作任务与委托 |
| 第 6 章 | Agent Eval | Golden Dataset、回归与 Trace |
| 第 7 章 | 生产工程与 FinOps | 部署、观测、成本与灰度 |
| 第 8 章 | 合规与治理 | 身份、审批、审计、Kill Switch |
| 第 9 章 | 综合项目与作品集 | 可展示的全栈 Agent 产品 |

## 主线技术栈

| 领域 | 选择 |
| --- | --- |
| 后端 | Python、FastAPI、Pydantic |
| 前端 | React / Next.js、TypeScript |
| 数据 | PostgreSQL、Redis |
| 模型接入 | OpenAI-compatible Provider |
| 测试 | pytest、Playwright |
| 部署 | Docker Compose |

## 如何开始

1. 阅读 [00.md](./00.md)，确认课程目标与前置要求。
2. 打开 [course-materials/README.md](./course-materials/README.md)，从第 1 章第 1 课开始跟做。
3. 切换到 `chapter-00-init` 分支获取初始项目骨架：
   ```bash
   git checkout chapter-00-init
   ```
4. 在本地持续维护同一个 `agent-platform` 项目；
   一节课完成前，不要提前复制下一节代码。

每节课建议按四个检查点验收：

1. 命令能运行
2. 浏览器或终端出现预期结果
3. 测试通过
4. 主动制造的失败能被正确处理

## 适用对象

建议已具备：

- Python 基础与异步编程
- HTTP API / FastAPI 或同类 Web 框架
- SQL 与关系型数据库基础
- Git、单元测试、Docker 与命令行
- 能阅读 TypeScript / React 代码的前端基础

不具备前端基础也可以完成后端主线；
若要获得「全栈 Agent 工程师」项目认证，需补齐前端交付。

## License

见 [LICENSE](./LICENSE)。
