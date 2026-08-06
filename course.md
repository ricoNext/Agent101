---
sidebar: false
title: 课程总览
description: AI Agent 全栈工程师训练营的完整课程目录。
---

# 课程总览

这套课程沿着一条 Agent Engineering Platform 主线展开，共 9 个工程阶段、57 节课程。请按章节顺序阅读，每节课都在前一节的基础上继续演进项目。

## 第 1 章：从零构建 LLM Gateway

1. [第 1 课：建立一个可测试的后端](/course/chapter-01-llm-gateway/lesson-01-build-testable-backend)
2. [第 2 课：先接 Mock Provider，再接真实模型](/course/chapter-01-llm-gateway/lesson-02-mock-provider-real-model)
3. [第 3 课：接入 OpenAI-compatible 模型服务](/course/chapter-01-llm-gateway/lesson-03-openai-compatible-provider)
4. [第 4 课：结构化输出和错误边界](/course/chapter-01-llm-gateway/lesson-04-structured-output-error-boundary)
5. [第 5 课：实现 SSE 流式接口](/course/chapter-01-llm-gateway/lesson-05-sse-streaming-api)
6. [第 6 课：创建前端流式对话页](/course/chapter-01-llm-gateway/lesson-06-frontend-streaming-chat)
7. [第 7 课：为第一章补齐测试和 Golden Tasks](/course/chapter-01-llm-gateway/lesson-07-tests-and-golden-tasks)

## 第 2 章：构建 Tool Runtime 与 MCP 接入

1. [第 8 课：理解工具调用的边界](/course/chapter-02-tool-runtime-mcp/lesson-08-tool-call-boundaries)
2. [第 9 课：定义工具、调用和审计协议](/course/chapter-02-tool-runtime-mcp/lesson-09-tool-call-audit-protocol)
3. [第 10 课：实现 Tool Registry](/course/chapter-02-tool-runtime-mcp/lesson-10-tool-registry)
4. [第 11 课：实现权限、审批、超时和审计](/course/chapter-02-tool-runtime-mcp/lesson-11-permission-approval-timeout-audit)
5. [第 12 课：测试 Tool Runtime](/course/chapter-02-tool-runtime-mcp/lesson-12-test-tool-runtime)
6. [第 13 课：创建工具管理和审批页面](/course/chapter-02-tool-runtime-mcp/lesson-13-tool-management-approval-page)
7. [第 14 课：最小 MCP Server 选修实验](/course/chapter-02-tool-runtime-mcp/lesson-14-mcp-server-experiment)

## 第 3 章：实现可恢复的 Agent Loop 与 Codebase Agent

1. [第 15 课：把“对话”变成“任务”](/course/chapter-03-agent-loop-codebase-agent/lesson-15-turn-conversation-into-tasks)
2. [第 16 课：保存任务和 Checkpoint](/course/chapter-03-agent-loop-codebase-agent/lesson-16-save-tasks-checkpoint)
3. [第 17 课：定义 Agent Decision 并实现 Scripted Decider](/course/chapter-03-agent-loop-codebase-agent/lesson-17-agent-decision-scripted-decider)
4. [第 18 课：实现最小 Agent Loop](/course/chapter-03-agent-loop-codebase-agent/lesson-18-minimal-agent-loop)
5. [第 19 课：审批、取消和恢复](/course/chapter-03-agent-loop-codebase-agent/lesson-19-approval-cancel-resume)
6. [第 20 课：构建受限 Codebase 工具和 Sandbox](/course/chapter-03-agent-loop-codebase-agent/lesson-20-codebase-tools-sandbox)
7. [第 21 课：接入真实模型决策和任务工作台](/course/chapter-03-agent-loop-codebase-agent/lesson-21-real-model-decision-workbench)

## 第 4 章：Context、Memory 与 Codebase RAG

1. [第 22 课：先量化 Context，而不是盲目压缩](/course/chapter-04-context-memory-codebase-rag/lesson-22-context-quantification)
2. [第 23 课：把代码和文档解析成可引用的 Chunk](/course/chapter-04-context-memory-codebase-rag/lesson-23-code-doc-chunk)
3. [第 24 课：先实现可解释的关键词检索](/course/chapter-04-context-memory-codebase-rag/lesson-24-explainable-keyword-search)
4. [第 25 课：接入 Embedding、Hybrid Search 和 Rerank](/course/chapter-04-context-memory-codebase-rag/lesson-25-embedding-hybrid-search-rerank)
5. [第 26 课：项目记忆与 Context Builder 集成](/course/chapter-04-context-memory-codebase-rag/lesson-26-project-memory-context-builder)
6. [第 27 课：创建代码知识页面和 RAG 对照实验](/course/chapter-04-context-memory-codebase-rag/lesson-27-code-knowledge-rag-experiment)

## 第 5 章：Multi-Agent、Skill 与 A2A

1. [第 28 课：判断是否需要 Multi-Agent](/course/chapter-05-multi-agent-a2a/lesson-28-determine-need-multi-agent)
2. [第 29 课：定义 Subtask 和结果协议](/course/chapter-05-multi-agent-a2a/lesson-29-subtask-result-protocol)
3. [第 30 课：实现并行 Supervisor](/course/chapter-05-multi-agent-a2a/lesson-30-parallel-supervisor)
4. [第 31 课：结果聚合、冲突和 Reviewer](/course/chapter-05-multi-agent-a2a/lesson-31-result-aggregation-conflict-reviewer)
5. [第 32 课：把重复任务封装为 Skill](/course/chapter-05-multi-agent-a2a/lesson-32-skill-encapsulation)
6. [第 33 课：A2A 选修实验](/course/chapter-05-multi-agent-a2a/lesson-33-a2a-experiment)
7. [第 34 课：创建协作任务页并完成验收](/course/chapter-05-multi-agent-a2a/lesson-34-collaboration-page-acceptance)

## 第 6 章：Agent Eval、回归测试与质量改进

1. [第 35 课：建立 Golden Dataset](/course/chapter-06-agent-eval/lesson-35-golden-dataset)
2. [第 36 课：实现规则评测器](/course/chapter-06-agent-eval/lesson-36-rule-evaluator)
3. [第 37 课：保存 Trace 并定位失败步骤](/course/chapter-06-agent-eval/lesson-37-trace-failure-location)
4. [第 38 课：谨慎使用 LLM-as-Judge](/course/chapter-06-agent-eval/lesson-38-llm-as-judge)
5. [第 39 课：回归测试和版本对比](/course/chapter-06-agent-eval/lesson-39-regression-test-version-compare)
6. [第 40 课：创建 Eval Dashboard 和自动化入口](/course/chapter-06-agent-eval/lesson-40-eval-dashboard-automation)

## 第 7 章：生产工程、可观测性与 FinOps

1. [第 41 课：把本地依赖写成 Docker Compose](/course/chapter-07-production-finops/lesson-41-docker-compose-deps)
2. [第 42 课：配置、密钥和健康检查](/course/chapter-07-production-finops/lesson-42-config-secrets-healthcheck)
3. [第 43 课：结构化日志、Trace 和 Replay](/course/chapter-07-production-finops/lesson-43-structured-logs-trace-replay)
4. [第 44 课：建立 Token 预算和 FinOps 报表](/course/chapter-07-production-finops/lesson-44-token-budget-finops-report)
5. [第 45 课：版本、灰度和回滚](/course/chapter-07-production-finops/lesson-45-version-canary-rollback)
6. [第 46 课：运维治理台和本章验收](/course/chapter-07-production-finops/lesson-46-ops-governance-acceptance)

## 第 8 章：身份、审批、审计与治理

1. [第 47 课：从风险矩阵开始，而不是从法规名词开始](/course/chapter-08-compliance-governance/lesson-47-risk-matrix)
2. [第 48 课：分开用户、Agent 和工具身份](/course/chapter-08-compliance-governance/lesson-48-identity-separation)
3. [第 49 课：实现持久化审批单](/course/chapter-08-compliance-governance/lesson-49-persistent-approval)
4. [第 50 课：数据脱敏、隔离和审计](/course/chapter-08-compliance-governance/lesson-50-data-masking-isolation-audit)
5. [第 51 课：Human-in-the-loop 和 Kill Switch](/course/chapter-08-compliance-governance/lesson-51-human-in-loop-kill-switch)
6. [第 52 课：合规与审计页面、本章验收](/course/chapter-08-compliance-governance/lesson-52-compliance-audit-page-acceptance)

## 第 9 章：完成一个可展示的全栈 Agent 产品

1. [第 53 课：写一页产品需求](/course/chapter-09-comprehensive-project-portfolio/lesson-53-product-requirements)
2. [第 54 课：冻结架构和核心任务](/course/chapter-09-comprehensive-project-portfolio/lesson-54-architecture-core-tasks)
3. [第 55 课：完成全栈用户流程](/course/chapter-09-comprehensive-project-portfolio/lesson-55-fullstack-user-flow)
4. [第 56 课：做一次真实的质量改进](/course/chapter-09-comprehensive-project-portfolio/lesson-56-quality-improvement)
5. [第 57 课：部署、演示与答辩](/course/chapter-09-comprehensive-project-portfolio/lesson-57-deploy-demo-defense)
