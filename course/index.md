# 课程总览

AI Agent 101 以一个持续演进的 **Agent Engineering Platform** 为工程主线。按能力依赖组织为“七章核心课程 + 综合项目”。

## 学习路径

1. 依次完成七章核心课程，每章交付一个可验收的项目里程碑。
2. 在企业级深度研究平台与软件工程 Agent / 软件工厂中选择一个综合项目。
3. 整理平台、业务项目、评测报告与工程文档，完成作品集和答辩。

## 更新进度

状态说明：`已完成` 表示课次讲义已可阅读；`进行中` 表示目录已定、部分课次已写；`仅大纲` 表示只有章节总览，课次正文待写。

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
| [基础知识专栏](../foundations/) | 进行中 | 已发布 1 篇（AI 协议） |

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
