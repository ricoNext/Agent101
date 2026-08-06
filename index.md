---
layout: home
title: AI Agent 全栈工程师训练营
titleTemplate: false
description: 从模型调用到可部署、可评测、可治理的 Agent 平台工程实践
hero:
  name: AI Agent 101
  text: 全栈工程师训练营
  tagline: 从一个可测试的模型调用开始，逐步构建真正可运行、可恢复、可评测、可治理的 Agent 平台。
  actions:
    - theme: brand
      text: 开始第一章
      link: /course/chapter-01-llm-gateway/
features:
  - icon:
      src: /icons/path.svg
      alt: 学习路径图标
    title: 一条主线，持续演进
    details: 围绕同一个 Agent Engineering Platform，每章只增加少量能力，避免学完只剩零散 Demo。
  - icon:
      src: /icons/curriculum.svg
      alt: 课程内容图标
    title: 57 节可执行课程
    details: 每节课都有目标、实现步骤、预期结果、故障演练和验收标准，适合边学边做。
  - icon:
      src: /icons/engineering.svg
      alt: 工程实践图标
    title: 从 Demo 到工程
    details: 把上下文、权限、审计、评测、成本、部署和治理纳入同一条交付链路。
---

<section class="home-overview">
  <div class="home-overview__intro">
    <p class="eyebrow">学习路径</p>
    <h2>先把系统做出来，再把系统做可靠</h2>
    <p>
      这套课程面向已经具备基础开发能力的后端、全栈和平台工程师。你会从 LLM Gateway 起步，沿着工具运行时、Agent Loop、RAG、多 Agent、评测、生产和治理一路推进，最后完成一个可展示的全栈 Agent 产品。
    </p>
  </div>
  <div class="home-overview__stats">
    <div>
      <strong>9</strong>
      <span>个工程阶段</span>
    </div>
    <div>
      <strong>57</strong>
      <span>节逐课讲义</span>
    </div>
    <div>
      <strong>1</strong>
      <span>条项目主线</span>
    </div>
  </div>
</section>

<section class="home-chapters">
  <div class="section-heading">
    <p class="eyebrow">课程导航</p>
    <h2>从基础调用到完整产品</h2>
  </div>
  <div class="chapter-grid">
    <a class="chapter-card" href="/course/chapter-01-llm-gateway/">
      <span>01</span>
      <strong>LLM Gateway</strong>
      <small>模型接入、结构化输出与流式对话</small>
    </a>
    <a class="chapter-card" href="/course/chapter-02-tool-runtime-mcp/">
      <span>02</span>
      <strong>Tool Runtime 与 MCP</strong>
      <small>工具注册、权限、审批与审计</small>
    </a>
    <a class="chapter-card" href="/course/chapter-03-agent-loop-codebase-agent/">
      <span>03</span>
      <strong>Agent Loop</strong>
      <small>任务、Checkpoint、Sandbox 与代码 Agent</small>
    </a>
    <a class="chapter-card" href="/course/chapter-04-context-memory-codebase-rag/">
      <span>04</span>
      <strong>Context、Memory 与 RAG</strong>
      <small>让 Agent 找到支持结论的代码证据</small>
    </a>
    <a class="chapter-card" href="/course/chapter-05-multi-agent-a2a/">
      <span>05</span>
      <strong>Multi-Agent 与 A2A</strong>
      <small>任务拆分、协作协议与结果聚合</small>
    </a>
    <a class="chapter-card" href="/course/chapter-06-agent-eval/">
      <span>06</span>
      <strong>Agent Eval</strong>
      <small>Golden Dataset、Trace 与回归评测</small>
    </a>
    <a class="chapter-card" href="/course/chapter-07-production-finops/">
      <span>07</span>
      <strong>生产工程与 FinOps</strong>
      <small>部署、可观测性、成本与回滚</small>
    </a>
    <a class="chapter-card" href="/course/chapter-08-compliance-governance/">
      <span>08</span>
      <strong>合规与治理</strong>
      <small>身份、脱敏、人工监督与 Kill Switch</small>
    </a>
    <a class="chapter-card" href="/course/chapter-09-comprehensive-project-portfolio/">
      <span>09</span>
      <strong>综合项目与作品集</strong>
      <small>冻结范围、交付产品、部署与答辩</small>
    </a>
  </div>
</section>

<section class="home-reading">
  <div>
    <p class="eyebrow">建议阅读顺序</p>
    <h2>今天就可以开始的三步</h2>
  </div>
  <ol>
    <li><a href="/course">先看课程总览</a>，了解每章和每节课的学习顺序。</li>
    <li><a href="/course/chapter-01-llm-gateway/">进入第一章</a>，从一个可测试的后端开始搭建主项目。</li>
    <li>遇到概念疑问时回到<a href="/course">课程总览</a>，确认它在整条主线中的位置。</li>
  </ol>
</section>

<style>
.home-overview,
.home-reading {
  display: grid;
  gap: 2rem;
  grid-template-columns: minmax(0, 1.5fr) minmax(240px, 0.8fr);
  max-width: 1152px;
  margin: 0 auto;
  padding: 4.5rem 1.5rem;
  border-top: 1px solid var(--vp-c-divider);
}

.home-overview__intro,
.home-reading > div {
  max-width: 680px;
}

.eyebrow {
  margin: 0 0 0.75rem;
  color: var(--vp-c-brand-1);
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.home-overview h2,
.home-reading h2,
.home-chapters h2 {
  margin: 0;
  color: var(--vp-c-text-1);
  font-size: clamp(1.8rem, 3vw, 2.5rem);
  line-height: 1.2;
}

.home-overview p:not(.eyebrow) {
  margin: 1.25rem 0 0;
  color: var(--vp-c-text-2);
  font-size: 1.05rem;
  line-height: 1.9;
}

.home-overview__stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  align-self: center;
  gap: 1rem;
}

.home-overview__stats div {
  display: grid;
  gap: 0.3rem;
  padding-left: 1rem;
  border-left: 2px solid var(--vp-c-brand-2);
}

.home-overview__stats strong {
  color: var(--vp-c-text-1);
  font-size: 2rem;
  line-height: 1;
}

.home-overview__stats span {
  color: var(--vp-c-text-2);
  font-size: 0.8rem;
}

.home-chapters {
  max-width: 1152px;
  margin: 0 auto;
  padding: 4.5rem 1.5rem;
  border-top: 1px solid var(--vp-c-divider);
}

.section-heading {
  margin-bottom: 2rem;
}

.chapter-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.85rem;
}

.chapter-card {
  display: grid;
  gap: 0.55rem;
  min-height: 142px;
  padding: 1.25rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  color: var(--vp-c-text-1);
  text-decoration: none;
  transition: border-color 160ms ease, transform 160ms ease;
}

.chapter-card:hover {
  border-color: var(--vp-c-brand-2);
  transform: translateY(-2px);
}

.chapter-card span {
  color: var(--vp-c-brand-1);
  font-size: 0.8rem;
  font-weight: 700;
}

.chapter-card strong {
  font-size: 1.05rem;
}

.chapter-card small {
  color: var(--vp-c-text-2);
  line-height: 1.6;
}

.home-reading {
  align-items: start;
  padding-bottom: 6rem;
}

.home-reading ol {
  display: grid;
  gap: 1rem;
  margin: 0;
  padding-left: 1.4rem;
  color: var(--vp-c-text-2);
  line-height: 1.8;
}

.home-reading a {
  color: var(--vp-c-brand-1);
  font-weight: 650;
}

@media (max-width: 760px) {
  .home-overview,
  .home-reading {
    grid-template-columns: 1fr;
    padding: 3.5rem 1.25rem;
  }

  .home-overview__stats {
    max-width: 420px;
  }

  .chapter-grid {
    grid-template-columns: 1fr;
  }
}
</style>
