# AI Agent 101

这是一个关于 AI Agent 工程教程，记录了我学习 Agent 的全过程。课程完全开源。

这个名字来源于国内之前很火的腾讯出品的**创造101**选秀节目， 在节目里所有的观众都是“制作人”, 这有点像当前的 AI 时代，每个人都可以成为 AI 的“制作人”。 “101” 代表了从零开始，逐步掌握 AI Agent 工程的各个方面。

Agent 工程虽然是新的概念，但是他并没有脱离传统的软件工程的范畴，需要大量的软件工程的实践和经验。这个教程会尽量从最基础的软件工程知识开始，用通俗的描述逐步引导你掌握 AI Agent 工程的各个方面。 

课程围绕同一个 **Agent Engineering Platform** 项目持续演进，最终完成一套可运行、可评测、可治理、可部署的 Agent 工程平台。



## 课程结构

课程分为两个层级：

1. **核心课程**：七章主线，按能力依赖顺序学习。
2. **综合项目**：在两个业务方向中选择一个，完成最终产品与答辩。

基础知识专栏独立于主线，用于补充课程中反复出现的概念，不占核心课时。

## 更新进度

状态说明：`已完成` 表示课次讲义已可阅读；`进行中` 表示目录已定、部分课次已写；`仅大纲` 表示只有章节总览，课次正文待写。

| 板块 | 状态 | 进度说明 |
| --- | --- | --- |
| [第一章 · LLM Gateway](./course/core/chapter-01-llm-gateway/index.md) | 已完成 | 已重构为 15 节课，讲义已完成 |
| [第二章 · Tool Runtime / MCP](./course/core/chapter-02-tool-runtime-mcp/index.md) | 已完成 | 已重构为 14 节课，讲义已完成 |
| [第三章 · Agent Loop / Codebase Agent](./course/core/chapter-03-agent-loop-codebase-agent/index.md) | 进行中 | 23 节核心课与 1 节选修课已设计，第 1–12 课讲义已完成 |
| [第四章 · Context / Memory / RAG](./course/core/chapter-04-context-memory-codebase-rag/index.md) | 课程已规划 | 10 节课已设计，讲义内容待编写 |
| [第五章 · Multi-Agent / Skill](./course/core/chapter-05-multi-agent-skills/index.md) | 课程已规划 | 12 节课已设计，讲义内容待编写 |
| [第六章 · Agent Eval](./course/core/chapter-06-agent-eval/index.md) | 仅大纲 | 章节目标与模块已定，课次待设计 |
| [第七章 · 生产治理](./course/core/chapter-07-production-governance/index.md) | 仅大纲 | 章节目标与模块已定，课次待设计 |
| [综合项目](./course/capstone/index.md) | 仅大纲 | 方向与作品集要求已定，项目讲义待写 |
| [基础知识专栏](./foundations/index.md) | 进行中 | 已发布 1 篇（AI 协议） |

当前主线写作重点：按课程目录逐节补全第三至第五章讲义内容。

## 七章核心课程

按当前章节规划，核心课程共 **106 课时**，每节课对应 1 课时，每章完成一个项目里程碑。课次在各章内独立编号，每章都从第 1 课开始；第三章另设 1 个选修课时，不计入核心课时合计。

| 章节 | 主题 | 建议课时 | 里程碑 | 讲义状态 |
| --- | --- | ---: | --- | --- |
| [第一章](./course/core/chapter-01-llm-gateway/index.md) | LLM API、Prompt、Structured Output 与 Gateway | 15 | M1：LLM Gateway | 已完成 |
| [第二章](./course/core/chapter-02-tool-runtime-mcp/index.md) | Function Calling、Tool Runtime 与 MCP | 14 | M2：Agent Tool Runtime | 已完成 |
| [第三章](./course/core/chapter-03-agent-loop-codebase-agent/index.md) | Agent Loop、State、Harness 与 Codebase Agent | 23（另 1 选修） | M3：Codebase Agent | 课程已规划 |
| [第四章](./course/core/chapter-04-context-memory-codebase-rag/index.md) | Context Engineering、Memory 与 Codebase RAG | 14 | M4：Context & RAG | 课程已规划 |
| [第五章](./course/core/chapter-05-multi-agent-skills/index.md) | Multi-Agent、Subagent 与 Skill | 12 | M5：Agent Collaboration | 课程已规划 |
| [第六章](./course/core/chapter-06-agent-eval/index.md) | Agent Eval 工程 | 12 | M6：Agent Eval Platform | 仅大纲 |
| [第七章](./course/core/chapter-07-production-governance/index.md) | 生产工程、FinOps、安全治理与部署 | 12 | M7：Production Ready | 仅大纲 |
| 综合复盘 | 架构评审、作品集整理与答辩 | 4 | 最终项目答辩 | 待编写 |

Eval、安全与治理贯穿七章，不等到课程末尾再集中补齐。

## 综合项目与作品集

[综合项目](./course/capstone/index.md)从以下两个方向中选择一个：

- 企业级深度研究平台
- 软件工程 Agent / 软件工厂

最终形成四类作品成果：Agent Foundation Platform、Codebase Agent、Agent Eval & Operations Console，以及一个综合业务项目。

## 仓库目录

```text
.
├── course/
│   ├── index.md                    # 课程总览
│   ├── core/                       # 七章核心课程
│   │   ├── chapter-01-llm-gateway/
│   │   ├── chapter-02-tool-runtime-mcp/
│   │   ├── chapter-03-agent-loop-codebase-agent/
│   │   ├── chapter-04-context-memory-codebase-rag/
│   │   ├── chapter-05-multi-agent-skills/
│   │   ├── chapter-06-agent-eval/
│   │   └── chapter-07-production-governance/
│   └── capstone/                    # 综合项目与作品集
├── foundations/                     # Agent 全栈基础知识专栏
├── archive/course-v0/               # 旧版九章讲义，仅供迁移参考
├── .vitepress/                      # 课程站点配置与主题
├── goal.md                          # 当前课程规划
└── goal_v0.md                       # 最初课程目标参考
```

旧版讲义保存在 `archive/course-v0/`，不会进入 VitePress 导航、搜索和构建结果。后续编写新课时内容时，应直接放入 `course/` 对应章节，不在归档目录上继续扩展。

## 学习顺序

1. 阅读[课程总览](./course/index.md)。
2. 按顺序完成七章核心课程与 M1-M7。
3. 完成一个综合业务项目。
4. 整理架构、运行证据、评测结果、部署说明和失败复盘。

## 面向人群

建议学习者具备以下基础：

- Python、异步编程和面向对象设计
- HTTP API、FastAPI 或同类 Web 框架
- SQL 与关系型数据库
- Git、Docker 和命令行开发
- 能阅读 TypeScript / React 代码

## 配套项目仓库

课件与项目代码分开维护：

- 课件仓库：[ricoNext/Agent101](https://github.com/ricoNext/Agent101)
- 项目仓库：[ricoNext/agent-platform](https://github.com/ricoNext/agent-platform)

## 本地运行课程站点

```bash
npm install
npm run dev
```

默认访问地址为 `http://localhost:8082`。

仅检查代码格式：

```bash
npm run format:check
```

## 内容维护原则

- 章节按能力依赖组织，不按产品热点堆叠。
- 每章围绕一个可运行、可验收的项目里程碑收束。
- 核心内容讲稳定原理，变化较快的协议不阻塞主线学习。
- 原理、最小实现、工程增强、失败演练、Eval 对比和里程碑评审形成统一教学闭环。
