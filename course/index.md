# 课程总览

这是一个关于 AI Agent 工程搭建的教程，同时也记录了我学习 Agent 的全过程。课程完全开源，欢迎大家一起学习。

**Agent 101** 这个名字来源于国内之前很火的腾讯出品的**创造101**选秀节目， 在节目里所有的观众都是“制作人”, 这有点像当前的 AI 时代，每个人都可以成为 AI 的“制作人”。 “101” 代表了从零开始，逐步掌握 AI Agent 工程的各个方面。

Agent 工程虽然是新的概念，但是他并没有脱离传统的软件工程的范畴，需要大量的软件工程的实践和经验。这个教程会尽量从最基础的软件工程知识开始，用通俗的描述逐步引导你掌握 AI Agent 工程的各个方面。

课程围绕同一个 **Agent Engineering Platform** 项目持续演进，最终完成一套可运行、可评测、可治理、可部署的 Agent 工程平台。

精力有限，暂时计划只做文字版的教程，后续可能会考虑视频版的教程。

## 更新进度

状态说明：`已完成` 表示课次讲义已可阅读；`进行中` 表示目录已定、部分课次已写；`仅大纲` 表示只有章节总览。

| 板块 | 状态 | 进度说明 |
| --- | --- | --- |
| [第一章 · LLM Gateway](./core/chapter-01-llm-gateway/) | 已完成 | 已重构为 15 节课，讲义已完成 |
| [第二章 · Tool Runtime / MCP](./core/chapter-02-tool-runtime-mcp/) | 已完成 | 已重构为 14 节课，讲义已完成 |
| [第三章 · Agent Loop / Codebase Agent](./core/chapter-03-agent-loop-codebase-agent/) | 进行中 | 23 节核心课与 1 节选修课已设计，第 1–12 课讲义已完成 |
| [第四章 · Context / Memory / RAG](./core/chapter-04-context-memory-codebase-rag/) | 课程已规划 | 10 节课已设计，讲义内容待编写 |
| [第五章 · Multi-Agent / Skill](./core/chapter-05-multi-agent-skills/) | 课程已规划 | 12 节课已设计，讲义内容待编写 |
| [第六章 · Agent Eval](./core/chapter-06-agent-eval/) | 仅大纲 | 章节目标与模块已定，课次待设计 |
| [第七章 · 生产治理](./core/chapter-07-production-governance/) | 仅大纲 | 章节目标与模块已定，课次待设计 |
| [综合项目](./capstone/) | 仅大纲 | 方向与作品集要求已定，项目讲义待写 |
| [基础知识专栏](../foundations/) | 进行中 | 已发布 2 篇（AI 协议、项目中的 Python 知识） |

## 核心课程

| 章节 | 主题 | 建议课时 | 项目里程碑 | 讲义状态 |
| --- | --- | ---: | --- | --- |
| [第一章](./core/chapter-01-llm-gateway/) | LLM API、Prompt、Structured Output 与 Gateway | 15 | M1：LLM Gateway | 已完成 |
| [第二章](./core/chapter-02-tool-runtime-mcp/) | Function Calling、Tool Runtime 与 MCP | 14 | M2：Agent Tool Runtime | 已完成 |
| [第三章](./core/chapter-03-agent-loop-codebase-agent/) | Agent Loop、State、Harness 与 Codebase Agent | 23（另 1 选修） | M3：Codebase Agent | 课程已规划 |
| [第四章](./core/chapter-04-context-memory-codebase-rag/) | Context Engineering、Memory 与 Codebase RAG | 14 | M4：Context & RAG | 课程已规划 |
| [第五章](./core/chapter-05-multi-agent-skills/) | Multi-Agent、Subagent 与 Skill | 12 | M5：Agent Collaboration | 课程已规划 |
| [第六章](./core/chapter-06-agent-eval/) | Agent Eval 工程 | 12 | M6：Agent Eval Platform | 仅大纲 |
| [第七章](./core/chapter-07-production-governance/) | 生产工程、FinOps、安全治理与部署 | 12 | M7：Production Ready | 仅大纲 |
| 综合复盘 | 架构评审、作品集整理与答辩 | 4 | 最终项目答辩 | 待编写 |

按当前章节规划，核心课程共 **106 课时**。每节课对应 1 课时；课次在各章内独立编号，每章都从第 1 课开始；

## 课程分层

- [核心课程](./core/)：建立完整能力链，需按顺序学习。
- [综合项目与作品集](./capstone/)：选择真实业务方向，完成最终交付。
- [基础知识专栏](../foundations/)：补充会在主线中反复使用的概念，不占核心课时。

## 统一完成标准

每个里程碑都应做到可运行、可验证、可追踪、可恢复、有边界、可说明。Eval、安全与治理不是最后一章才补的内容，而是从第一章开始逐步加入平台。
