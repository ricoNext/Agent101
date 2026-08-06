import { defineConfig } from "vitepress";

const chapters = [
  {
    text: "第 1 章 · LLM Gateway",
    link: "/course/chapter-01-llm-gateway/",
    lessons: [
      ["第 1 课：建立一个可测试的后端", "lesson-01-build-testable-backend"],
      [
        "第 2 课：先接 Mock Provider，再接真实模型",
        "lesson-02-mock-provider-real-model",
      ],
      [
        "第 3 课：接入 OpenAI-compatible 模型服务",
        "lesson-03-openai-compatible-provider",
      ],
      [
        "第 4 课：结构化输出和错误边界",
        "lesson-04-structured-output-error-boundary",
      ],
      ["第 5 课：实现 SSE 流式接口", "lesson-05-sse-streaming-api"],
      ["第 6 课：创建前端流式对话页", "lesson-06-frontend-streaming-chat"],
      [
        "第 7 课：为第一章补齐测试和 Golden Tasks",
        "lesson-07-tests-and-golden-tasks",
      ],
    ],
  },
  {
    text: "第 2 章 · Tool Runtime 与 MCP",
    link: "/course/chapter-02-tool-runtime-mcp/",
    lessons: [
      ["第 8 课：理解工具调用的边界", "lesson-08-tool-call-boundaries"],
      [
        "第 9 课：定义工具、调用和审计协议",
        "lesson-09-tool-call-audit-protocol",
      ],
      ["第 10 课：实现 Tool Registry", "lesson-10-tool-registry"],
      [
        "第 11 课：实现权限、审批、超时和审计",
        "lesson-11-permission-approval-timeout-audit",
      ],
      ["第 12 课：测试 Tool Runtime", "lesson-12-test-tool-runtime"],
      [
        "第 13 课：创建工具管理和审批页面",
        "lesson-13-tool-management-approval-page",
      ],
      ["第 14 课：最小 MCP Server 选修实验", "lesson-14-mcp-server-experiment"],
    ],
  },
  {
    text: "第 3 章 · Agent Loop 与 Codebase Agent",
    link: "/course/chapter-03-agent-loop-codebase-agent/",
    lessons: [
      [
        "第 15 课：把「对话」变成「任务」",
        "lesson-15-turn-conversation-into-tasks",
      ],
      ["第 16 课：保存任务和 Checkpoint", "lesson-16-save-tasks-checkpoint"],
      [
        "第 17 课：定义 Agent Decision 并实现 Scripted Decider",
        "lesson-17-agent-decision-scripted-decider",
      ],
      ["第 18 课：实现最小 Agent Loop", "lesson-18-minimal-agent-loop"],
      ["第 19 课：审批、取消和恢复", "lesson-19-approval-cancel-resume"],
      [
        "第 20 课：构建受限 Codebase 工具和 Sandbox",
        "lesson-20-codebase-tools-sandbox",
      ],
      [
        "第 21 课：接入真实模型决策和任务工作台",
        "lesson-21-real-model-decision-workbench",
      ],
    ],
  },
  {
    text: "第 4 章 · Context、Memory 与 Codebase RAG",
    link: "/course/chapter-04-context-memory-codebase-rag/",
    lessons: [
      [
        "第 22 课：先量化 Context，而不是盲目压缩",
        "lesson-22-context-quantification",
      ],
      [
        "第 23 课：把代码和文档解析成可引用的 Chunk",
        "lesson-23-code-doc-chunk",
      ],
      [
        "第 24 课：先实现可解释的关键词检索",
        "lesson-24-explainable-keyword-search",
      ],
      [
        "第 25 课：接入 Embedding、Hybrid Search 和 Rerank",
        "lesson-25-embedding-hybrid-search-rerank",
      ],
      [
        "第 26 课：项目记忆与 Context Builder 集成",
        "lesson-26-project-memory-context-builder",
      ],
      [
        "第 27 课：创建代码知识页面和 RAG 对照实验",
        "lesson-27-code-knowledge-rag-experiment",
      ],
    ],
  },
  {
    text: "第 5 章 · Multi-Agent、Skill 与 A2A",
    link: "/course/chapter-05-multi-agent-a2a/",
    lessons: [
      [
        "第 28 课：判断是否需要 Multi-Agent",
        "lesson-28-determine-need-multi-agent",
      ],
      [
        "第 29 课：定义 Subtask 和结果协议",
        "lesson-29-subtask-result-protocol",
      ],
      ["第 30 课：实现并行 Supervisor", "lesson-30-parallel-supervisor"],
      [
        "第 31 课：结果聚合、冲突和 Reviewer",
        "lesson-31-result-aggregation-conflict-reviewer",
      ],
      ["第 32 课：把重复任务封装为 Skill", "lesson-32-skill-encapsulation"],
      ["第 33 课：A2A 选修实验", "lesson-33-a2a-experiment"],
      [
        "第 34 课：创建协作任务页并完成验收",
        "lesson-34-collaboration-page-acceptance",
      ],
    ],
  },
  {
    text: "第 6 章 · Agent Eval",
    link: "/course/chapter-06-agent-eval/",
    lessons: [
      ["第 35 课：建立 Golden Dataset", "lesson-35-golden-dataset"],
      ["第 36 课：实现规则评测器", "lesson-36-rule-evaluator"],
      [
        "第 37 课：保存 Trace 并定位失败步骤",
        "lesson-37-trace-failure-location",
      ],
      ["第 38 课：谨慎使用 LLM-as-Judge", "lesson-38-llm-as-judge"],
      [
        "第 39 课：回归测试和版本对比",
        "lesson-39-regression-test-version-compare",
      ],
      [
        "第 40 课：创建 Eval Dashboard 和自动化入口",
        "lesson-40-eval-dashboard-automation",
      ],
    ],
  },
  {
    text: "第 7 章 · 生产工程与 FinOps",
    link: "/course/chapter-07-production-finops/",
    lessons: [
      [
        "第 41 课：把本地依赖写成 Docker Compose",
        "lesson-41-docker-compose-deps",
      ],
      [
        "第 42 课：配置、密钥和健康检查",
        "lesson-42-config-secrets-healthcheck",
      ],
      [
        "第 43 课：结构化日志、Trace 和 Replay",
        "lesson-43-structured-logs-trace-replay",
      ],
      [
        "第 44 课：建立 Token 预算和 FinOps 报表",
        "lesson-44-token-budget-finops-report",
      ],
      ["第 45 课：版本、灰度和回滚", "lesson-45-version-canary-rollback"],
      ["第 46 课：运维治理台和本章验收", "lesson-46-ops-governance-acceptance"],
    ],
  },
  {
    text: "第 8 章 · 合规与治理",
    link: "/course/chapter-08-compliance-governance/",
    lessons: [
      [
        "第 47 课：从风险矩阵开始，而不是从法规名词开始",
        "lesson-47-risk-matrix",
      ],
      ["第 48 课：分开用户、Agent 和工具身份", "lesson-48-identity-separation"],
      ["第 49 课：实现持久化审批单", "lesson-49-persistent-approval"],
      [
        "第 50 课：数据脱敏、隔离和审计",
        "lesson-50-data-masking-isolation-audit",
      ],
      [
        "第 51 课：Human-in-the-loop 和 Kill Switch",
        "lesson-51-human-in-loop-kill-switch",
      ],
      [
        "第 52 课：合规与审计页面、本章验收",
        "lesson-52-compliance-audit-page-acceptance",
      ],
    ],
  },
  {
    text: "第 9 章 · 综合项目与作品集",
    link: "/course/chapter-09-comprehensive-project-portfolio/",
    lessons: [
      ["第 53 课：写一页产品需求", "lesson-53-product-requirements"],
      ["第 54 课：冻结架构和核心任务", "lesson-54-architecture-core-tasks"],
      ["第 55 课：完成全栈用户流程", "lesson-55-fullstack-user-flow"],
      ["第 56 课：做一次真实的质量改进", "lesson-56-quality-improvement"],
      ["第 57 课：部署、演示与答辩", "lesson-57-deploy-demo-defense"],
    ],
  },
];

const sidebar = chapters.map((chapter) => ({
  text: chapter.text,
  link: chapter.link,
  collapsed: true,
  items: chapter.lessons.map(([text, link]) => ({
    text,
    link: `${chapter.link}${link}`,
  })),
}));

export default defineConfig({
  lang: "zh-CN",
  title: "AI Agent 101",
  description:
    "AI Agent 全栈工程师训练营：从模型调用到可部署、可评测、可治理的平台工程实践。",
  head: [
    ["link", { rel: "icon", type: "image/x-icon", href: "/favicon.ico" }],
    ["link", { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" }],
  ],
  cleanUrls: true,
  rewrites: (id) => (id.startsWith("chapter-") ? `course/${id}` : id),
  lastUpdated: true,
  metaChunk: true,
  themeConfig: {
    logo: "/logo.svg",
    siteTitle: "AI Agent 101",
    nav: [
      { text: "首页", link: "/" },
      {
        text: "课程",
        link: "/course/chapter-01-llm-gateway/lesson-01-build-testable-backend",
        activeMatch: "^/course(?:/|$)",
      },
      { text: "课件仓库", link: "https://github.com/ricoNext/Agent101" },
      { text: "项目仓库", link: "https://github.com/ricoNext/agent-platform" },
    ],
    sidebar,
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
