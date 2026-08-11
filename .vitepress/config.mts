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
        text: "第 3 课 · Provider 抽象与 Mock",
        link: "/course/core/chapter-01-llm-gateway/lesson-03-provider-abstraction-mock",
      },
      {
        text: "第 4 课 · OpenAI-compatible",
        link: "/course/core/chapter-01-llm-gateway/lesson-04-openai-compatible-provider",
      },
      {
        text: "第 5 课 · Prompt 管理",
        link: "/course/core/chapter-01-llm-gateway/lesson-05-prompt-management",
      },
      {
        text: "第 6 课 · Structured Output",
        link: "/course/core/chapter-01-llm-gateway/lesson-06-structured-output",
      },
      {
        text: "第 7 课 · 可靠性与路由",
        link: "/course/core/chapter-01-llm-gateway/lesson-07-reliability-routing",
      },
      {
        text: "第 8 课 · SSE Streaming",
        link: "/course/core/chapter-01-llm-gateway/lesson-08-sse-streaming",
      },
      {
        text: "第 9 课 · Gateway 控制台",
        link: "/course/core/chapter-01-llm-gateway/lesson-09-frontend-gateway-console",
      },
      {
        text: "第 10 课 · 基线与 M1 验收",
        link: "/course/core/chapter-01-llm-gateway/lesson-10-baseline-and-acceptance",
      },
    ],
  },
  {
    text: "第 2 章 · Tool Runtime 与 MCP",
    link: "/course/core/chapter-02-tool-runtime-mcp/",
    collapsed: false,
    items: [
      {
        text: "第 11 课 · Function Calling 与 Tool Use",
        link: "/course/core/chapter-02-tool-runtime-mcp/lesson-11-function-calling-tool-use",
      },
      {
        text: "第 12 课 · 统一 Tool Schema",
        link: "/course/core/chapter-02-tool-runtime-mcp/lesson-12-unified-tool-schema",
      },
      {
        text: "第 13 课 · Tool Registry",
        link: "/course/core/chapter-02-tool-runtime-mcp/lesson-13-tool-registry",
      },
      {
        text: "第 14 课 · Tool Runtime 执行链",
        link: "/course/core/chapter-02-tool-runtime-mcp/lesson-14-tool-runtime-execution",
      },
      {
        text: "第 15 课 · 工具调用可靠性",
        link: "/course/core/chapter-02-tool-runtime-mcp/lesson-15-tool-call-reliability",
      },
      {
        text: "第 16 课 · 权限与安全边界",
        link: "/course/core/chapter-02-tool-runtime-mcp/lesson-16-permission-security-boundary",
      },
      {
        text: "第 17 课 · 审批与审计",
        link: "/course/core/chapter-02-tool-runtime-mcp/lesson-17-approval-audit",
      },
      {
        text: "第 18 课 · MCP 协议与 Client",
        link: "/course/core/chapter-02-tool-runtime-mcp/lesson-18-mcp-protocol-client",
      },
      {
        text: "第 19 课 · 自定义 MCP Server",
        link: "/course/core/chapter-02-tool-runtime-mcp/lesson-19-custom-mcp-server",
      },
      {
        text: "第 20 课 · 调试入口与 M2 验收",
        link: "/course/core/chapter-02-tool-runtime-mcp/lesson-20-debugging-and-acceptance",
      },
    ],
  },
  {
    text: "第 3 章 · Agent Loop 与 Codebase Agent",
    link: "/course/core/chapter-03-agent-loop-codebase-agent/",
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
  {
    text: "扩展学习",
    collapsed: true,
    items: [
      { text: "进阶专题", link: "/course/advanced/" },
      { text: "选修专题", link: "/course/electives/" },
    ],
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

const advancedSidebar = [
  {
    text: "进阶课程",
    items: [{ text: "课程目录", link: "/course/advanced/" }],
  },
];

const electivesSidebar = [
  {
    text: "选修课程",
    items: [{ text: "课程目录", link: "/course/electives/" }],
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
      { text: "核心课程", link: "/course/" },
      { text: "进阶课程", link: "/course/advanced/" },
      { text: "选修课程", link: "/course/electives/" },
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
      "/course/advanced/": advancedSidebar,
      "/course/electives/": electivesSidebar,
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
