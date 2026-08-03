# AI Agent 全栈工程师训练营：逐课讲义

这不是课程大纲，而是一套需要照着操作的教材。学习者从第一课开始，在本地持续维护同一个 `agent-platform` 项目；每一课只增加少量能力，并给出完整的文件内容、命令、预期结果和排错方式。

## 使用方法

一节课完成前，不要提前复制下一节的代码。每节都有四个检查点：

1. 命令能运行；
2. 浏览器或终端出现预期结果；
3. 测试通过；
4. 主动制造的失败能被正确处理。

如果任何一个检查点没通过，先处理当前课的问题。Agent 系统的问题会在后续章节叠加，跳过基础错误会让后面无法判断问题来自模型、工具、状态还是前端。

## 课程主项目

```text
agent-platform/
├── apps/
│   ├── api/                         # FastAPI 后端
│   └── web/                         # Next.js 前端
├── packages/
│   └── evals/                       # Golden Tasks 和评测脚本
├── infra/                           # Docker Compose 和初始化脚本
├── docs/                            # 架构图、复盘、Runbook
└── README.md
```

主项目会逐章演进：

| 章节 | 章节完成后的可运行能力 | 主要前端页面 |
|------|------------------------|--------------|
| 第 1 章 | LLM Gateway、结构化输出、流式响应 | 对话页 |
| 第 2 章 | Tool Registry、权限、审计、MCP 接入 | 工具管理页 |
| 第 3 章 | Agent Loop、Checkpoint、Sandbox、代码任务 | 任务工作台 |
| 第 4 章 | Context Builder、RAG、Project Memory | 代码知识页 |
| 第 5 章 | Supervisor、Subagent、Skill、A2A 选修 | 协作任务页 |
| 第 6 章 | Golden Dataset、评测、回归、Trace Analysis | Eval Dashboard |
| 第 7 章 | Docker Compose、可观测性、FinOps、灰度 | 运维治理台 |
| 第 8 章 | 身份、审批、审计、Kill Switch | 合规与审计页 |
| 第 9 章 | 可展示的全栈 Agent 产品 | 业务工作台 |

## 每课固定结构

- 你将完成什么；
- 先理解什么；
- 从上节课开始，新增或替换哪些文件；
- 必须执行的命令；
- 预期结果；
- 故意制造的失败；
- 本课验收；
- 进入下一课前的提交建议。

## 讲义目录

每章目录页保留本章目标和课程清单；每个“第 X 课”都有独立文件，可直接打开学习。

| 章节 | 课程数 | 入口 |
|------|--------|------|
| 第 1 章：LLM Gateway | 7 | [进入本章](./第01章-LLM-Gateway/README.md) |
| 第 2 章：Tool Runtime 与 MCP | 7 | [进入本章](./第02章-Tool-Runtime与MCP/README.md) |
| 第 3 章：Agent Loop 与 Codebase Agent | 7 | [进入本章](./第03章-Agent-Loop与Codebase-Agent/README.md) |
| 第 4 章：Context、Memory 与 Codebase RAG | 6 | [进入本章](./第04章-Context-Memory与Codebase-RAG/README.md) |
| 第 5 章：Multi-Agent、Skill 与 A2A | 7 | [进入本章](./第05章-Multi-Agent与A2A/README.md) |
| 第 6 章：Agent Eval | 6 | [进入本章](./第06章-Agent-Eval/README.md) |
| 第 7 章：生产工程与 FinOps | 6 | [进入本章](./第07章-生产工程与FinOps/README.md) |
| 第 8 章：合规与治理 | 6 | [进入本章](./第08章-合规与治理/README.md) |
| 第 9 章：综合项目与作品集 | 5 | [进入本章](./第09章-综合项目与作品集/README.md) |

后续章节将沿用第一章的目录、命名和事件协议；不要自行改动 `run_id`、事件名和 API 路径，除非讲义明确要求。
