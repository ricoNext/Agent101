# AI Agent 101

这是一个关于 AI Agent 工程教程，记录了我学习 Agent 的全过程。课程完全开源。

这个名字来源于国内之前很火的腾讯出品的**创造101**选秀节目， 在节目里所有的观众都是“制作人”, 这有点像当前的 AI 时代，每个人都可以成为 AI 的“制作人”。 “101” 代表了从零开始，逐步掌握 AI Agent 工程的各个方面。

Agent 工程虽然是新的概念，但是他并没有脱离传统的软件工程的范畴，需要大量的软件工程的实践和经验。这个教程会尽量从最基础的软件工程知识开始，用通俗的描述逐步引导你掌握 AI Agent 工程的各个方面。 

课程围绕同一个 **Agent Engineering Platform** 项目持续演进，最终完成一套可运行、可评测、可治理、可部署的 Agent 工程平台。其中会涉及到下面这些内容：

- 稳定调用和治理不同大模型
- 设计工具协议、执行运行时与安全边界
- 构建可持续执行、可中断恢复的 Agent Loop
- 管理上下文、记忆与知识检索
- 设计多 Agent 协作与可复用 Skill
- 建立可量化、可回归的 Agent Eval 体系
- 完成可观测、可灰度、可回滚、可治理的生产部署

## 建议前置能力

- 熟悉 Python 基础语法、类型标注、异步编程和常见工程结构
- 能使用 FastAPI 或类似 Web 框架开发 HTTP API
- 了解关系型数据库、Redis、Git、Docker 和基本 Linux 命令
- 能阅读 JSON Schema、HTTP 请求和日志


## 课程架构

因为我想尽可能的把 Agent 相关的知识都覆盖到，所以课程会涉及到很多内容，有些是课程本身的内容，有些是和课程强相关的基础知识， 所以课程会分为两个部分：

- **课程内容**：Agent 工程搭建的详细讲义， 每个章节都有详细的讲解和示例代码。
- **基础知识**：补充课程中反复出现的软件工程概念， 强依赖的编程知识， 以及一些和 Agent 工程强相关的概念。 这些知识是课程的基石， 也是后续学习的基础。

课程内容以**核心课程**为主线：七章按能力依赖顺序学习，包含 LLM 应用工程、Tool Runtime、Agent Loop、Context、Memory、RAG、Multi-Agent、Eval、Trace、Replay、生产治理等。

课程关注的是应用层的知识，不会涉及到模型训练、算法研究或 GPU 调优等知识， 而且我也不会。

下面是课程的详细内容：

### 第一章：LLM API、Prompt、Structured Output 与 Gateway 

> 完成基础的 LLM 应用工程搭建

#### 1. AI Agent 工程师能力模型

- LLM 应用、RAG、Workflow 与 Agent 的区别
- 模型、工具、状态、上下文、评测和运行环境的关系

#### 2. LLM API 与模型调用

- Chat Completions / Responses 类 API 的请求与返回结构
- OpenAI Compatible 协议与厂商差异
- Provider 抽象、请求标准化和响应标准化
- temperature、top_p、max output tokens 等参数
- Token、Context Window、Latency 与 Cost
- 超时、限流、服务异常和内容错误
- 多模型能力矩阵与基础路由

#### 3. Prompt Engineering

- System Prompt 的职责与边界
- 角色、任务、约束、上下文和输出格式
- Few-shot 示例与任务拆解
- Prompt 模板、变量校验和版本管理
- Prompt 注入基础风险
- Prompt 变更为什么需要回归评测
- 了解 Chain-of-Thought、Self-Consistency 

#### 4. Structured Output

- 为什么工程系统不能依赖自然语言解析
- JSON Schema 与 Pydantic 数据模型
- Input、Output 与 Error Schema
- 模型原生结构化输出和工具强制结构化
- Schema 校验、纠错和有限重试
- 多次失败后的降级、人工处理或缓存回退
- Schema 演进和业务协议兼容性

#### 5. Streaming 与交互控制

- SSE 与流式响应机制
- FastAPI StreamingResponse
- CLI / Web 客户端逐块消费
- 流式事件结构：token、status、usage、error、done
- 用户取消、服务端中止和资源释放
- 流式异常、断线和不完整结果处理
- WebSocket 协议对比 SSE

#### 6. LLM Gateway

- 统一模型调用入口
- Provider Adapter 与模型配置
- 模型路由、fallback、限流和重试
- Prompt 模板管理
- Structured Output 统一封装
- Token、Cost、Latency 和错误日志
- API Key、租户和基础密钥管理
- 同步与 Streaming 接口

#### M1：LLM Gateway

交付内容：

- 一个 OpenAI Compatible 的 FastAPI 模型服务
- 至少两个 Provider 或一个 Provider + Mock Provider
- 普通调用和 Streaming 调用
- Structured Output 校验与失败处理
- Prompt 模板与版本字段
- Token、Cost、Latency 和 Trace ID 记录

验收标准：

- 上层调用方不需要感知厂商请求格式
- 限流、超时和格式错误有明确错误协议
- Streaming 可取消且不会遗留运行任务
- 能输出一份模型调用基线报告

### 第二章：Function Calling、Tool Runtime 与 MCP

> 让模型从“生成内容”升级为“调用受控工具完成任务”，构建包含注册、发现、校验、权限、审计、超时和失败恢复的工具运行时。

#### 1. Function Calling 与 Tool Use

- 模型如何选择工具和生成参数
- 工具描述对选择准确率的影响
- 一次调用、多工具调用和依赖调用
- 工具结果如何返回模型
- 工具不存在、参数不合法和调用失败
- Function Calling 与 Agent Loop 的边界

#### 2. Tool Schema 与 Tool Registry

每个工具至少定义：

- 名称、说明和版本
- Input Schema、Output Schema、Error Schema
- 只读 / 写入属性
- 权限级别和风险等级
- 超时、重试和幂等策略
- 依赖资源和密钥
- 审计字段和敏感字段

Registry 能力：

- 工具注册、查询、发现、启停和版本管理
- 工具分类与能力标签
- 工具依赖检查
- 兼容旧版本和灰度切换
- 根据身份、任务和环境过滤可见工具

#### 3. Tool Runtime

- Schema 校验和类型转换
- 权限检查和用户身份透传
- 执行队列、依赖顺序和并发控制
- 超时、有限重试、降级和失败返回
- 幂等键和重复调用保护
- Tool Call Trace
- 输入输出截断与敏感字段脱敏
- 工具执行结果标准化

#### 4. 工具安全边界

- 只读、写操作、高风险操作分级
- 默认拒绝与最小权限
- SQL、Shell、文件系统和外部请求风险
- 白名单、参数约束和作用域约束
- Human-in-the-loop 确认
- 审批超时、拒绝和取消
- 审计日志与风险回放

#### 5. MCP

- MCP Client、Server 与 Transport
- Tools、Resources 与 Prompts 的职责
- Function Calling 与 MCP 的分工
- stdio 与 Streamable HTTP
- 历史 SSE Transport 的兼容背景
- MCP 能力发现、连接生命周期和错误处理
- 文件系统、数据库、Git 和内部 API 接入
- MCP 认证、权限、审计和内网部署
- 自定义 MCP Server 开发

#### M2：Agent Tool Runtime

交付内容：

- Tool Registry 与统一 Tool Schema
- 至少三个不同风险等级的工具
- 权限、确认、超时、重试和审计机制
- 一个自定义 MCP Server
- MCP Client 接入和工具发现
- CLI 调试入口与 Tool Call Trace

验收标准：

- 非法参数在执行前被拦截
- 未授权和高风险操作不能静默执行
- 工具超时不会导致整个服务永久阻塞
- 每次调用可追踪到用户、工具版本、参数、结果和风险决策

### 第三章：Agent Loop、State、Harness 与 Codebase Agent

> 从单轮 Tool Calling 升级为可规划、执行、观察、纠错、暂停和恢复的长程任务 Agent。

#### 1. Agent Loop

- 单轮 Tool Calling 的局限
- ReAct 与 Plan-and-Execute
- observe -> plan -> act -> observe -> finalize
- 一次性计划与动态计划
- Plan Revision 与步骤依赖
- 最大步数、Token 预算和时间预算
- 终止条件、重复行为和死循环识别
- Agent、固定 Workflow 和普通脚本的选择边界

#### 2. State Machine 与 Checkpoint

任务状态至少包括：

- created、planning、running
- waiting_tool、waiting_approval
- tool_failed、paused
- completed、failed、cancelled

状态记录至少包括：

- 当前目标、计划和步骤
- 工具名称、参数、输出和错误
- 重试记录和下一步决策
- 用户约束、风险和人工确认结果
- 最终结果与结束原因

核心能力：

- 状态持久化和恢复
- Checkpoint 与断点续跑
- 失败任务复现
- 人工接管后继续执行
- 状态迁移校验和幂等恢复

#### 3. Sandbox 与执行边界

- 可读、可写和禁止访问目录
- Shell 命令、参数和工作目录限制
- 网络访问、域名和端口限制
- CPU、内存、磁盘、时间和进程限制
- 本地 Sandbox 与 Docker Sandbox
- 密钥和环境变量隔离
- 文件变更、命令执行和网络请求审计
- 失败后的清理与环境回收

Firecracker、E2B 等方案作为选修对比，不作为核心项目依赖。

#### 4. Agent Harness

- 模型、工具、状态、上下文和执行环境的统一组织
- Agent 配置与工具集装配
- Run、Step、Event 和 Hook
- Checkpoint、Trace 和 Replay 的接口边界
- Human-in-the-loop 中断
- 取消、暂停、恢复和终止
- 运行时错误分类
- Harness 与业务 Agent 的分层

#### 5. Agent 编排框架

- 图、节点、边和共享状态
- 条件分支、循环、Interrupt 和 Tool Node
- LangGraph 状态图实战
- LangGraph 与固定 Workflow 的关系
- 框架抽象与业务代码解耦
- OpenAI Agents SDK、AgentScope 等方案的定位对比

课程要求理解编排原理，不要求同时掌握多个框架。

#### 6. Codebase Agent

支持工具：

- list_files、search_code、read_file、read_directory
- write_file、apply_patch
- run_command、run_test
- git_diff、git_status

典型任务：

- 定位登录或鉴权调用链并生成带文件引用的说明
- 分析一个需求可能影响的模块
- 完成受限的多文件修改
- 读取测试失败日志并尝试修复
- 输出变更说明、风险和未验证项

#### 7. AI Coding Agent 进阶工作坊

本节不替代自建 Codebase Agent，而是对照成熟产品理解工程设计：

- Claude Code、Cursor 等工具的上下文、工具和权限设计
- `AGENTS.md` / `CLAUDE.md` 类项目指令文件
- Git Worktree 与并行任务隔离
- 计划、编辑、审查和验证工作流
- 团队级使用规范和风险边界
- 自建 Agent 与现成 Coding Agent 的选型

ACP 不进入本章核心验收。

#### M3：Codebase Agent

交付内容：

- 可持续运行的 Agent Loop
- 明确的 State Schema 和状态迁移
- Checkpoint、暂停、恢复和取消
- Docker 或等价 Sandbox
- 代码搜索、读取、修改和命令执行工具
- Human-in-the-loop 与完整 Trace

验收标准：

- 能完成一个代码理解任务和一个受限修改任务
- Agent 在失败、超时或用户拒绝后能正确结束或恢复
- 循环不会因重复工具调用无限运行
- 文件修改可通过 diff 审查，写操作不会越过授权范围

### 第四章：Context Engineering、Memory 与 Codebase RAG

> 解决 Agent 在长程任务中“看到什么、保留什么、检索什么、遗忘什么”的问题。

#### 1. Context Engineering

- Prompt 与 Context 的区别
- Context Window、Token 成本和延迟
- Context Packing 与优先级
- System、Tools、History、User、Retrieval 的预算分配
- 长文件、历史对话和工具结果压缩
- 截断、摘要、选择性保留和外部状态
- Context Pollution 和无关信息过滤
- KV Cache 对成本和延迟的影响
- Context Debug Report

#### 2. Working Memory 与 Agent State

- 当前目标、已完成步骤和未解决问题
- 工具结果、临时事实、用户约束和风险
- Scratchpad 与可持久化状态
- Working Memory 的生命周期
- Working Memory、对话历史、Checkpoint 和长期记忆的边界
- 上下文被截断后的任务摘要与恢复

#### 3. 长期记忆与项目记忆

- 用户偏好、历史任务和个性化配置
- 项目结构、技术栈、构建命令和编码规范
- 常见故障、历史修复和项目约定
- 记忆写入、检索、更新、删除和过期
- 记忆可信度、来源和冲突处理
- 避免把临时错误结论写入长期记忆

#### 4. 现代 RAG

文档处理：

- PDF、Markdown、HTML、表格和结构化文档
- 清洗、元数据、版本和来源

Chunking：

- 固定长度、标题、段落、语义和代码 AST 分块
- Chunk Overlap 与 Chunk Metadata

Retrieval：

- Embedding 与向量数据库
- BM25 / Elasticsearch
- Hybrid Search 与 Metadata Filter
- Query Rewrite、Decomposition 和 Clarification

检索后处理：

- Cross Encoder / LLM Rerank
- 上下文压缩和证据筛选
- Citation 与答案证据一致性

基础评估：

- Recall、Hit Rate、Answer Correctness、Citation Accuracy、Hallucination Rate

#### 5. 知识资产治理

- LLM Wiki 与传统知识库的区别
- 文档版本、来源、作者和更新时间
- 重复、过期、冲突和低质量知识处理
- 用户、部门、租户和 Agent 的知识权限
- 敏感数据和检索结果过滤
- 知识完整性、可信度、时效性和可检索性

#### M4：Context Manager & Codebase RAG

交付内容：

- Context Builder 与预算配置
- 长文件和工具结果压缩
- Working Memory 与 Project Memory
- 代码和文档增量索引
- Hybrid Search、Rerank 和 Citation
- Context Debug Report

验收标准：

- 回答必须给出可核对的文件或文档引用
- 长任务在上下文压缩后仍能恢复目标和进度
- 不同检索策略有统一数据集和指标对比
- 无权限知识不会进入检索结果和模型上下文

### 第五章：Multi-Agent、Subagent、Skill 与 A2A

> 理解单 Agent 与多 Agent 的边界，掌握任务委托、隔离、结果聚合和冲突处理。

#### 1. 何时使用 Multi-Agent

- 单 Agent 的适用场景
- 固定 Workflow 的适用场景
- Multi-Agent 的适用场景
- 多 Agent 带来的上下文、协调、延迟和成本问题
- 用 Eval 判断拆分是否产生真实收益

#### 2. 协作模式

- Supervisor
- Planner / Executor
- Reviewer
- Router / Specialist
- 并行、串行和依赖调度
- 动态工作流与固定角色团队
- 嵌套 Subagent 的收益与风险

#### 3. Task Delegation Contract

每个子任务必须明确：

- 任务目标和完成条件
- 输入上下文和可见范围
- 可调用工具和权限边界
- 时间、调用次数和 Token 预算
- 预期输出、Schema 和证据要求
- 是否允许写操作和外部副作用
- 失败、取消和升级处理

#### 4. Result Aggregation

- 结果合并、去重和排序
- 证据与引用保留
- 冲突识别和仲裁
- 不完整结果与部分成功
- 主 Agent 最终复核
- 并行写操作的冲突与隔离

#### 5. Skill 系统

- Skill 的定义和适用场景
- 输入输出、工具依赖、Prompt 和质量标准
- Skill 注册、发现、匹配、执行和评估
- Skill 版本、兼容、下线和复用
- Skill 组合、条件分支和人工确认
- Skill 的权限边界与供应链风险

#### 6. A2A 进阶实战

核心课要求理解：

- Agent 与 Agent 互操作的业务价值
- MCP 与 A2A 的职责差异
- 能力发现、Agent Card 和 Task 生命周期
- 身份、委托权限、状态更新和结果回传
- 跨组织协作的安全与审计问题

进阶作业可实现：

- 两个不同运行时 Agent 的能力发现
- 任务提交、状态查询、取消和结果返回
- 流式状态更新
- A2A + MCP 联合调用

完整跨组织协议栈不作为核心项目毕业条件。

#### M5：Agent Collaboration

交付内容：

- Supervisor + 至少两个 Specialist Subagent
- 结构化 Task Delegation Contract
- 上下文、工具和权限隔离
- 并行调度、结果聚合和冲突处理
- Skill 注册与匹配
- 子 Agent 成本、超时和 Trace

验收标准：

- 与单 Agent 使用同一任务集进行效果、成本和延迟对比
- 子 Agent 无法访问未委托的上下文和工具
- 部分子任务失败时能输出可解释的部分结果
- 多 Agent 结论冲突有明确仲裁流程


### 第六章：Agent Eval 工程

> 建立可量化、可复现、可回归的 Agent 质量体系，让 Prompt、Model、Tool、RAG 和 Workflow 的改动都有数据依据。

#### 1. Eval 设计

- 从业务目标定义评测目标
- Golden Dataset 的构建、版本和覆盖范围
- 正常、边界、失败和对抗样本
- 离线 Eval、在线 Eval 和人工评估
- 基线版本与实验版本
- 数据泄漏和过度拟合

#### 2. 指标体系

- Task Success Rate
- Tool Call / Parameter Accuracy
- Answer Correctness
- Citation Accuracy 与 Retrieval Recall
- Hallucination Rate
- Failure Recovery Rate
- Human Handoff Rate
- Latency、Token Cost、Tool Call Count
- 安全拦截率和误拦截率

不同任务应选择不同主指标，不使用一个总分掩盖具体退化。

#### 3. Eval 方法

- Rule-based 与 Schema-based Eval
- Golden Answer 与 Snapshot
- Pairwise Comparison
- Human Eval
- LLM-as-Judge 的 Rubric、校准和偏差
- 多 Judge 与人工抽检
- 回归测试和 A/B Test

#### 4. Trace Analysis 与失败分类

- Prompt 不清晰或约束冲突
- 上下文缺失、过载或污染
- 检索召回、排序和引用错误
- 工具选择、参数、权限和执行错误
- Agent Loop 重复、死循环或错误终止
- 子 Agent 委托、隔离和聚合错误
- 模型能力不足
- 最终答案幻觉
- Eval 规则或 Judge 误判

#### 5. 自动化 Eval Pipeline

- Benchmark 任务集管理
- Agent 批量运行
- Prompt / Model / Tool / RAG 版本对比
- Trace 与中间步骤保存
- 失败样本聚类和根因标签
- 退化阈值与质量门禁
- CI 中的抽样回归与定期全量回归
- 评测成本控制

#### 6. 在线评估

- 用户反馈与人工接管记录
- 线上质量、延迟和成本指标
- 线上与离线指标相关性
- 失败样本回流
- 数据漂移和质量告警
- 隐私、脱敏和样本使用授权

#### M6：Agent Eval Platform

交付内容：

- Golden Dataset 管理
- 批量 Eval Runner
- Rule、Schema、LLM-as-Judge 和人工评测接口
- 版本对比与回归报告
- Trace 查看和失败样本分类
- 成功率、成本和延迟 Dashboard

验收标准：

- 能对 M3-M5 的 Agent 版本运行同一 Benchmark
- 能定位失败发生在 Prompt、Context、Retrieval、Tool 还是 Loop
- Judge 结果有抽样校准，不能把模型评分直接当事实
- 不达质量阈值的版本不能进入后续发布流程


### 第七章：生产工程、FinOps、安全治理与部署

> 将前六章的平台从“能运行”升级为“可部署、可监控、可灰度、可回滚、可审计”。

#### 1. 部署形态

- 云 API、私有模型和混合部署
- Docker Compose 本地与单机部署
- API、PostgreSQL、Redis、Vector DB 和 Worker
- MCP Server 的独立部署
- 配置中心、环境隔离和密钥管理
- 健康检查、优雅关闭和任务恢复
- Kubernetes 作为选修部署方案

#### 2. 私有化推理概览

- vLLM、TGI、Triton 的定位和选型
- OpenAI Compatible 推理接口
- Continuous Batching 与 GPU 利用率
- 并发、排队、超时和负载保护
- 量化、Prefix Cache 等优化手段的适用边界

本节目标是让应用工程师能做方案选择和服务接入，
不要求掌握底层推理内核开发。

#### 3. 可观测性

日志：

- 模型、Prompt、Token、Cost、Latency 和错误
- 工具、参数、权限、耗时、结果和重试

Trace：

- 用户请求、计划、Context Build、Retrieval
- 模型调用、工具调用、子 Agent 和人工确认
- 策略拦截、最终输出和结束原因

Metrics：

- 任务成功率、人工接管率和处理时长
- P50 / P95 / P99 延迟
- 模型和工具失败率
- 检索、引用和 Loop 指标
- 成本趋势与异常

Replay：

- 保存输入、上下文、工具结果和 Agent State
- 复现失败并验证修复
- 对敏感数据做脱敏或受控引用

#### 4. 版本、灰度与回滚

版本对象：

- Model、Prompt、Tool、Skill
- RAG 策略和 Knowledge Base
- Workflow、Agent 配置和服务镜像

发布能力：

- Feature Flag
- 按用户、租户、任务和风险等级灰度
- A/B Test、金丝雀和蓝绿发布
- 质量、成本和安全门禁
- Prompt、模型、工具、知识库、Workflow 和镜像回滚

#### 5. Agent FinOps

- 每次 Run 和子任务的 Token / Cost Budget
- 按任务复杂度进行模型分层路由
- 小模型、强模型和人工处理的边界
- Prompt、Semantic、Embedding 和 Tool Result Cache
- 缓存命中率、失效和一致性
- Batch、并发、队列和任务优先级
- 按租户、部门和任务类型归因成本
- 预算超限后的中止、降级或人工确认
- 用质量、延迟和成本共同评价优化结果

课程不固定使用某个模型名称或价格作为长期策略。

#### 6. 安全与治理

- Agent Identity 与用户身份透传
- RBAC、最小权限和临时授权
- 租户、部门和知识权限隔离
- API Key、凭据和敏感字段管理
- 审计日志：谁让哪个 Agent 在何时执行了什么
- 数据保留、删除和驻留要求
- Human Oversight 与紧急停止
- 风险评估清单和上线审批

法规专题用于建立风险意识，具体法律判断应由专业角色完成。
Governance Agent 可作为选修原型，不作为治理控制的唯一依据。

#### 7. Runbook 与运营

- 启动、停止、升级和回滚步骤
- 模型不可用、工具异常和队列积压
- 成本激增、延迟异常和质量退化
- 权限异常和敏感数据事件
- 告警分级、负责人和人工接管
- 故障复盘和 Benchmark 回补

#### M7：Production Ready Agent Engineering Platform

交付内容：

- Docker Compose 部署
- 结构化日志、Trace、Metrics 和 Replay
- Prompt / Model / Tool / RAG / Agent 版本管理
- Feature Flag、灰度和回滚
- FinOps 报表和预算护栏
- 权限、审计、租户隔离和脱敏
- 上线检查清单与 Runbook

验收标准：

- 服务重启后未完成任务能恢复或明确失败
- 任一失败任务可通过 Trace 定位并在受控条件下 Replay
- 新版本必须通过 Eval 质量门禁后才能灰度
- 成本异常、权限异常和服务异常有告警及处理流程
- 部署文档能够让其他人独立启动和检查系统


## 课程最终目标

完成课程后，应能独立回答并用代码证明以下问题：

- 模型为什么这样选，失败后如何降级？
- Agent 为什么需要这个工具，谁允许它调用？
- 长任务中断后如何恢复，死循环如何终止？
- 上下文为什么包含这些信息，检索证据来自哪里？
- 为什么需要多 Agent，它是否真的比单 Agent 更好？
- 如何证明新 Prompt、新模型或新 RAG 策略没有退化？
- 一次任务花费多少，如何控制预算并归因成本？
- 线上问题如何定位、复现、灰度、回滚和审计？


我也不知道这个课程能否完结，但是我会尽量坚持下去。

