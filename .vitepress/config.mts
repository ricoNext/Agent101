import { defineConfig } from "vitepress";

const coreChapters = [
  {
    text: "第 1 章 · LLM Gateway",
    link: "/course/core/chapter-01-llm-gateway/",
    collapsed: false,
    items: [
      {
        text: "第 1 课 · Agent 工程与课程平台",
        link: "/course/core/chapter-01-llm-gateway/lesson-01-agent-engineering-map",
      },
      {
        text: "第 2 课 · 可测试后端",
        link: "/course/core/chapter-01-llm-gateway/lesson-02-testable-backend",
      },
      {
        text: "第 3 课 · LLM API 与调用边界",
        link: "/course/core/chapter-01-llm-gateway/lesson-03-llm-api-model-boundaries",
      },
      {
        text: "第 4 课 · Provider 抽象与 Mock",
        link: "/course/core/chapter-01-llm-gateway/lesson-04-provider-abstraction-mock",
      },
      {
        text: "第 5 课 · OpenAI-compatible",
        link: "/course/core/chapter-01-llm-gateway/lesson-05-openai-compatible-provider",
      },
      {
        text: "第 6 课 · Prompt 管理",
        link: "/course/core/chapter-01-llm-gateway/lesson-06-prompt-management",
      },
      {
        text: "第 7 课 · Structured Output 契约",
        link: "/course/core/chapter-01-llm-gateway/lesson-07-structured-output-contract",
      },
      {
        text: "第 8 课 · 输出失败与 Schema 演进",
        link: "/course/core/chapter-01-llm-gateway/lesson-08-structured-output-recovery",
      },
      {
        text: "第 9 课 · 可靠性与模型路由",
        link: "/course/core/chapter-01-llm-gateway/lesson-09-reliability-routing",
      },
      {
        text: "第 10 课 · 调用观测与成本",
        link: "/course/core/chapter-01-llm-gateway/lesson-10-observability-cost",
      },
      {
        text: "第 11 课 · 可取消 SSE",
        link: "/course/core/chapter-01-llm-gateway/lesson-11-sse-streaming",
      },
      {
        text: "第 12 课 · Gateway 控制台",
        link: "/course/core/chapter-01-llm-gateway/lesson-12-gateway-console",
      },
      {
        text: "第 13 课 · Gateway 验收任务集",
        link: "/course/core/chapter-01-llm-gateway/lesson-13-gateway-acceptance-tasks",
      },
      {
        text: "第 14 课 · 基线 Runner 与报告",
        link: "/course/core/chapter-01-llm-gateway/lesson-14-baseline-runner-report",
      },
      {
        text: "第 15 课 · M1 联调验收",
        link: "/course/core/chapter-01-llm-gateway/lesson-15-m1-integration-acceptance",
      },
    ],
  },
  {
    text: "第 2 章 · Tool Runtime 与 MCP",
    link: "/course/core/chapter-02-tool-runtime-mcp/",
    collapsed: false,
    items: [
      {
        text: "第 1 课 · Function Calling 与 Tool Use",
        link: "/course/core/chapter-02-tool-runtime-mcp/lesson-01-function-calling-tool-use",
      },
      {
        text: "第 2 课 · 统一 Tool Schema",
        link: "/course/core/chapter-02-tool-runtime-mcp/lesson-02-unified-tool-schema",
      },
      {
        text: "第 3 课 · Tool Registry",
        link: "/course/core/chapter-02-tool-runtime-mcp/lesson-03-tool-registry",
      },
      {
        text: "第 4 课 · Tool Runtime 执行链",
        link: "/course/core/chapter-02-tool-runtime-mcp/lesson-04-tool-runtime-execution",
      },
      {
        text: "第 5 课 · 超时、取消与有限重试",
        link: "/course/core/chapter-02-tool-runtime-mcp/lesson-05-tool-timeout-retry",
      },
      {
        text: "第 6 课 · 幂等、并发与故障隔离",
        link: "/course/core/chapter-02-tool-runtime-mcp/lesson-06-tool-idempotency-concurrency",
      },
      {
        text: "第 7 课 · 工具风险与权限模型",
        link: "/course/core/chapter-02-tool-runtime-mcp/lesson-07-tool-risk-permission-model",
      },
      {
        text: "第 8 课 · 租户、资源与作用域授权",
        link: "/course/core/chapter-02-tool-runtime-mcp/lesson-08-tenant-resource-scope-authorization",
      },
      {
        text: "第 9 课 · HITL 审批状态机",
        link: "/course/core/chapter-02-tool-runtime-mcp/lesson-09-hitl-approval",
      },
      {
        text: "第 10 课 · 审计、Trace 与风险回放",
        link: "/course/core/chapter-02-tool-runtime-mcp/lesson-10-tool-audit-recovery",
      },
      {
        text: "第 11 课 · MCP 协议与 Transport",
        link: "/course/core/chapter-02-tool-runtime-mcp/lesson-11-mcp-protocol-transport",
      },
      {
        text: "第 12 课 · MCP Client 与 Runtime",
        link: "/course/core/chapter-02-tool-runtime-mcp/lesson-12-mcp-client-runtime-integration",
      },
      {
        text: "第 13 课 · 自定义 MCP Server",
        link: "/course/core/chapter-02-tool-runtime-mcp/lesson-13-custom-mcp-server",
      },
      {
        text: "第 14 课 · 调试入口与 M2 验收",
        link: "/course/core/chapter-02-tool-runtime-mcp/lesson-14-debugging-and-acceptance",
      },
    ],
  },
  {
    text: "第 3 章 · Agent Loop 与 Codebase Agent",
    link: "/course/core/chapter-03-agent-loop-codebase-agent/",
    collapsed: false,
    items: [
      {
        text: "第 1 课 · Agent Loop 与终止边界",
        link: "/course/core/chapter-03-agent-loop-codebase-agent/lesson-01-agent-loop-boundaries",
      },
      {
        text: "第 2 课 · Agent 任务模型与输入约束",
        link: "/course/core/chapter-03-agent-loop-codebase-agent/lesson-02-agent-task-model",
      },
      {
        text: "第 3 课 · 任务状态机与迁移规则",
        link: "/course/core/chapter-03-agent-loop-codebase-agent/lesson-03-task-state-machine",
      },
      {
        text: "第 4 课 · 计划、观察与执行契约",
        link: "/course/core/chapter-03-agent-loop-codebase-agent/lesson-04-plan-observe-act",
      },
      {
        text: "第 5 课 · 任务持久化与事件记录",
        link: "/course/core/chapter-03-agent-loop-codebase-agent/lesson-05-task-persistence-events",
      },
      {
        text: "第 6 课 · Checkpoint 与重启恢复",
        link: "/course/core/chapter-03-agent-loop-codebase-agent/lesson-06-checkpoint-recovery",
      },
      {
        text: "第 7 课 · 动态重规划与步骤依赖",
        link: "/course/core/chapter-03-agent-loop-codebase-agent/lesson-07-replanning-dependencies",
      },
      {
        text: "第 8 课 · 预算、重复检测与收敛终止",
        link: "/course/core/chapter-03-agent-loop-codebase-agent/lesson-08-budget-convergence",
      },
      {
        text: "第 9 课 · Sandbox 文件与工作区边界",
        link: "/course/core/chapter-03-agent-loop-codebase-agent/lesson-09-sandbox-workspace-boundary",
      },
      {
        text: "第 10 课 · Sandbox 命令、进程与资源",
        link: "/course/core/chapter-03-agent-loop-codebase-agent/lesson-10-sandbox-command-resource-boundary",
      },
      {
        text: "第 11 课 · 网络、密钥与 Sandbox 生命周期",
        link: "/course/core/chapter-03-agent-loop-codebase-agent/lesson-11-sandbox-network-lifecycle",
      },
      {
        text: "第 12 课 · Agent Harness 核心接口",
        link: "/course/core/chapter-03-agent-loop-codebase-agent/lesson-12-harness-core-interfaces",
      },
      {
        text: "第 13 课 · Harness 事件、Hook 与生命周期",
        link: "/course/core/chapter-03-agent-loop-codebase-agent/lesson-13-harness-events-lifecycle",
      },
      {
        text: "第 14 课 · 图编排原理与执行语义",
        link: "/course/core/chapter-03-agent-loop-codebase-agent/lesson-14-orchestration-principles",
      },
      {
        text: "第 15 课 · LangGraph 与 Harness 集成",
        link: "/course/core/chapter-03-agent-loop-codebase-agent/lesson-15-langgraph-harness-integration",
      },
      {
        text: "第 16 课 · 代码库探索与证据收集",
        link: "/course/core/chapter-03-agent-loop-codebase-agent/lesson-16-codebase-exploration-evidence",
      },
      {
        text: "第 17 课 · 变更计划与补丁生成",
        link: "/course/core/chapter-03-agent-loop-codebase-agent/lesson-17-change-plan-patch-generation",
      },
      {
        text: "第 18 课 · 受控应用补丁与冲突处理",
        link: "/course/core/chapter-03-agent-loop-codebase-agent/lesson-18-controlled-patch-application",
      },
      {
        text: "第 19 课 · 验证流程与交付摘要",
        link: "/course/core/chapter-03-agent-loop-codebase-agent/lesson-19-validation-delivery",
      },
      {
        text: "第 20 课 · 任务工作台、Trace 与回放",
        link: "/course/core/chapter-03-agent-loop-codebase-agent/lesson-20-task-workbench-trace-replay",
      },
      {
        text: "第 21 课 · 审批、取消、恢复与人工接管",
        link: "/course/core/chapter-03-agent-loop-codebase-agent/lesson-21-human-recovery-takeover",
      },
      {
        text: "第 22 课 · Codebase Agent 端到端联调",
        link: "/course/core/chapter-03-agent-loop-codebase-agent/lesson-22-codebase-agent-integration",
      },
      {
        text: "第 23 课 · M3 Codebase Agent 验收",
        link: "/course/core/chapter-03-agent-loop-codebase-agent/lesson-23-m3-codebase-agent-acceptance",
      },
      {
        text: "第 24 课（选修）· AI Coding Agent 工作坊",
        link: "/course/core/chapter-03-agent-loop-codebase-agent/lesson-24-ai-coding-agent-workshop",
      },
    ],
  },
  {
    text: "第 4 章 · Context、Memory 与 RAG",
    link: "/course/core/chapter-04-context-memory-codebase-rag/",
  },
  {
    text: "第 5 章 · Multi-Agent 与 Skill",
    link: "/course/core/chapter-05-multi-agent-skills/",
  },
  {
    text: "第 6 章 · Agent Eval",
    link: "/course/core/chapter-06-agent-eval/",
  },
  {
    text: "第 7 章 · 生产工程与治理",
    link: "/course/core/chapter-07-production-governance/",
  },
];

const courseSidebar = [
  {
    text: "课程导读",
    items: [{ text: "课程总览", link: "/course/" }],
  },
  {
    text: "核心课程",
    items: coreChapters,
  },
  {
    text: "综合交付",
    items: [{ text: "综合项目与作品集", link: "/course/capstone/" }],
  },
];

const foundationSidebar = [
  {
    text: "Agent 全栈基础知识",
    items: [
      { text: "专栏目录", link: "/foundations/" },
      { text: "AI 协议", link: "/foundations/ai-protocols" },
    ],
  },
];

export default defineConfig({
  lang: "zh-CN",
  title: "AI Agent 101",
  description:
    "AI Agent 全栈工程师训练营：从模型调用到可部署、可评测、可治理的平台工程实践。",
  srcExclude: [
    "archive/**",
    "cover-image/**",
    "goal.md",
    "goal_v0.md",
    "README.md",
  ],
  head: [
    ["link", { rel: "icon", type: "image/x-icon", href: "/favicon.ico" }],
    ["link", { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" }],
  ],
  cleanUrls: true,
  lastUpdated: true,
  metaChunk: true,
  themeConfig: {
    logo: "/logo.svg",
    siteTitle: "AI Agent 101",
    nav: [
      { text: "课程说明", link: "/about" },
      { text: "核心课程", link: "/course/" },
      { text: "基础知识点", link: "/foundations/" },
      {
        text: "仓库代码",
        items: [
          {
            text: "课件仓库",
            link: "https://github.com/ricoNext/Agent101",
          },
          {
            text: "项目仓库",
            link: "https://github.com/ricoNext/agent-platform",
          },
        ],
      },
    ],
    sidebar: {
      "/course/": courseSidebar,
      "/foundations/": foundationSidebar,
    },
    search: {
      provider: "local",
      options: {
        locales: {
          root: {
            translations: {
              button: {
                buttonText: "搜索课程",
                buttonAriaLabel: "搜索课程",
              },
              modal: {
                noResultsText: "没有找到相关内容",
                resetButtonTitle: "清除搜索",
                footer: {
                  selectText: "选择",
                  navigateText: "切换",
                  closeText: "关闭",
                },
              },
            },
          },
        },
      },
    },
    socialLinks: [
      { icon: "github", link: "https://github.com/ricoNext/Agent101" },
    ],
    footer: {
      message: "持续学习，持续交付。",
      copyright: "© 2026 AI Agent 101",
    },
  },
});
