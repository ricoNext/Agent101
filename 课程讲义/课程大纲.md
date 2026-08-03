AI Agent 全栈⼯程师训练营 课程⼤纲
课程定位
本课程⾯向希望转型为 AI Agent 开发⼯程师 / ⼤模型应⽤开发⼯程师 / RAG & Agent ⼯程师 的传统后
端、全栈或平台⼯程师。
课程不以低代码平台操作或抽象⾏业概念为核⼼，⽽以“如何构建⽣产级 Agent 系统”为主线，系统
训练：
- LLM API 调⽤、Prompt、结构化输出与模型治理；
- Function Calling、Tool Runtime、MCP ⼯具协议与⼯具安全边界；
- Agent Loop、状态机、⻓程任务执⾏、Sandbox 与失败恢复；
- Context Engineering、Memory、RAG 与知识库治理；
- Multi-Agent、Skill、Agent Eval、Benchmark 与回归测试；
- Trace、Replay、灰度发布、成本治理、⽣产部署与 Runbook；
- 企业级深度研究平台、软件⼯⼚等⾼阶 Agent 应⽤架构。
课程最终⽬标不是让学员“会调⽤模型”或“能搭 Demo”，⽽是让学员具备独⽴构建、评测、部署
和持续迭代 Agent 系统的⼯程能⼒。
Agent 开发⼯程师必备核⼼能⼒
AI Agent⼯程师岗位汇总
懂后端系统稳定性，能把模型能⼒封装成稳定服务。
懂⼯具调⽤和权限边界，能避免 Agent 误⽤⼯具或越权执⾏。
能做⻓程任务 Agent，⽽不是只调⽤⼀次模型。
能优化上下⽂、记忆和任务状态管理。
能建⽴评测体系，⽤ benchmark 和数据证明 Agent 变好。
能把模型能⼒产品化，⽽不是停留在 Demo。
课程核⼼价值
岗位导向：课程⾯向 AI Agent 开发⼯程师、⼤模 型应⽤开发⼯程师、RAG / Agent ⼯程师岗位中最核
⼼的硬技能要求。

⼯程导向：重点训练⼯程视⻆下的 Agent 开发能⼒，包括⼯具注册、参数校验、权限控制、Trace、失
败恢复、测试评估。
作品集导向：课程围绕 Agent Tool Runtime、Codebase Agent、Agent Eval Platform 三个作品集项
⽬展开，让学员有真实可展⽰的⼯程成果。
可迭代导向：强调 Eval 是 Agent 的核⼼护城河，要求学员能够构造 benchmark、记录成功率、分析
失败样本，并基于数据迭代 Agent。
真实使⽤导向：要求学员⽤⾃⼰的 Agent 辅助真实开发、代码理解、测试⽣成、失败修复和⽂档输
出，让 Agent 成为⽇常开发⼯具。
学习收益
核⼼能⼒模型认知建⽴：能够了解⽬前企业中 AI Agent 开发岗位所需的技能需求，依据能⼒模型进⾏
特定知识点的提升，构建⾃⾝学习路径。
LLM ⼯程基础：掌握 LLM API、Prompt、Function Calling、Structured Output、Streaming、
Token / Context Window、Cost / Latency 等基础能⼒。
Agent Tool Runtime：能够设计⼯具注册中⼼、JSON Schema 参数校验、权限控制、调⽤审计、超
时重试、Streaming 返回和 Trace 可视化。
⻓程任务 Agent：能够实现 observe -> think / plan -> act -> observe -> finalize 的 Agent Loop，掌
握从 ReACT 到 Loop 的主流 Agent 进化路径。
上下⽂与记忆管理：掌握 Context Manager，完成⻓⽂件摘要、历史⼯具结果压缩、任务状态持久
化、⻓期记忆和项⽬级记忆。
多 Agent 与评测体系：能够设计 Subagent 协作、结果聚合、冲突处理、Agent benchmark、⾃动化
评测、Trace Analysis 和回归测试。
期望⽤⼾学完以后可以拥有⼀个统⼀、完整、可展⽰的 Agent Engineering Platform
平台⾄少包括：
- LLM Gateway；
- Prompt 与 Structured Output；
- Tool Runtime；
- MCP Tool 接⼊；
- Codebase Agent；
- Agent Loop；

- State Machine；
- Sandbox；
- Context Manager；
- Project Memory；
- Codebase RAG；
- Multi-Agent；
- Skill System；
- Agent Eval Platform；
- Trace；
- Replay；
- 成本统计；
- 灰度发布；
- Docker Compose 部署；
- 上线 Runbook。
最终可围绕该平台沉淀三类求职作品集成果：
1. Agent Tool Runtime：体现⼯具治理、权限、安全与后端⼯程能⼒；
2. Codebase Agent：体现⻓程任务、代码理解、测试修复、RAG 与 Context Engineering 能⼒；
3. Agent Eval & Production Platform：体现评测、可观测性、版本管理、成本治理与⽣产化能⼒
4. 深度研究以及软件⼯⼚Agent项⽬
第⼀章：LLM API、Prompt 与结构化输出
本章⽬标：建⽴⼤模型应⽤开发的基础认知，完成从传统 HTTP API 调⽤到 LLM API 调⽤的迁移。本章
只解决“如何稳定调⽤模型”的问题。
1. AI Agent 开发⼯程师能⼒模型
- 岗位能⼒拆解
◦ 后端⼯程基础
◦ Python ⼯程能⼒
◦ LLM API 与 Prompt
◦ RAG 与知识库
◦ Agent Loop 与 Tool Use

◦ Context / Memory
◦ Agent Eval
◦ ⼯程化、部署与可观测性
- 转型路径
传统后端⼯程师的已有优势：
◦ API 服务开发
◦ 数据库与缓存
◦ 异步任务
◦ 权限认证
◦ ⽇志监控
◦ 限流、重试、熔断
◦ Docker 与部署
需要重点补⻬的 Agent 能⼒：
◦ 模型调⽤
◦ Prompt 与结构化输出
◦ ⼯具协议
◦ 上下⽂管理
◦ Agent 状态机
◦ Eval 与 Agent 质量治理
2. LLM API 与模型调⽤基础
- Chat Completions / Responses API：理解主流模型 API 的请求结构、消息格式、模型参数和返回
结果
- 模型参数：temperature、top_p、max_tokens
- Token 与 Context Window
- Structured Output：使⽤ JSON Schema、Pydantic 或模型原⽣结构化输出能⼒，让模型返回可
解析、可校验的数据
- 错误类型与异常处理：处理模型调⽤失败、超时、限流、输出格式错误和重试策略
- 多模型调⽤基础

3. Streaming 流式输出
- 为什么 LLM 应⽤需要 Streaming：模型推理延迟⾼，串⾏等待降低⽤⼾体验
- Server-Sent Events：基于 HTTP ⻓连接的流式传输协议，实现打字机效果
- FastAPI 流式接⼝：使⽤  保持低延迟转发
StreamingResponse
- 前端 / CLI 消费流式输出：EventSource / ReadableStream 逐块消费
- 中断与取消：⽤⼾可随时取消⽣成，避免浪费 Token
- 流式输出异常处理：⽹络抖动或限流导致中断时的捕获与重试
- ⻓⽂本输出的状态保存：超出 Context Window 或会话断开时持久化断点
4. Prompt Engineering
- System Prompt 的职责：设定全局⾏为基调，相当于模型的"岗位说明书"
- ⻆⾊定义与⾏为约束：明确告诉模型扮演什么⻆⾊（代码审查助⼿ / 分析师等）
- 输出⻛格控制：控制详细程度、语⽓、结构，确保⻛格符合场景
- Few-shot ⽰例：给 2-3 个"输⼊→输出"范例，对格式敏感任务更有效
- 任务拆解：将复杂任务拆成多步执⾏，降低幻觉率和逻辑跳跃
- Prompt 模板：将可变参数嵌⼊固定模板，使 Prompt 可复⽤、可版本管理
- Prompt 注⼊⻛险：⽤⼾输⼊篡改指令的⻛险及防护措施
- Prompt 版本管理的基本思想
5. Structured Output 结构化输出
- 为什么 Agent 系统不能依赖⾃然语⾔解析
- JSON Schema：定义输出结构的标准规范（字段名、类型、是否必填等）
- Pydantic Model：定义输出结构 + Schema 校验 + 反序列化为 Python 对象
- 模型原⽣结构化输出：API 层直接传⼊ Schema，模型保证输出合规
- Schema 校验：模型返回后校验 JSON 是否符合预期结构
- 输出纠错与重试：校验失败时把错误反喂给模型⾃⾏修正
- 结构化输出失败处理：多次重试失败后降级或回退到缓存结果
- 输出格式与业务协议设计
6. LLM Gateway

打造⼀个 Agent Engineering Platform ，在平台中完成：
- FastAPI LLM 服务：统⼀ HTTP ⼊⼝，各组件⽆需各⾃维护 API 密钥
- 模型调⽤接⼝：封装 OpenAI Compatible 协议，统⼀多⼚商格式差异
- Streaming 输出：Gateway 层代理流式响应，逐块转发
- Structured Output：集成 Schema 传⼊机制，屏蔽底层实现差异
- Pydantic 数据校验：请求⼊⼝和响应出⼝各做⼀次校验拦截
- Prompt 模板：Gateway 层管理模板库，上层只需传⼊变量
- 错误处理与重试：统⼀处理限流、超时，⾃动 fallback 到备⽤模型
- Token / Cost / Latency ⽇志：每次调⽤留痕，为成本治理提供数据
7. 项⽬演进路线 阶段⼀：LLM 统⼀模型调⽤服务
- 项⽬背景：从传统 HTTP API 调⽤到 LLM API 调⽤的迁移，掌握了 Prompt Engineering、
Structured Output、Streaming 等基础能⼒后，需要构建⼀个统⼀的模型调⽤服务作为 Agent
Engineering Platform 的⼊⼝层。
- 核⼼要点：
◦ 构建 OpenAI Compatible API 接⼝
◦ 多模型调⽤与模型路由
◦ Streaming 流式输出
◦ Structured Output 结构化输出
◦ Prompt 模板管理
◦ Token、Cost、Latency 记录
◦ 基础错误处理、重试与限流
第⼆章：Function Calling、Tool Runtime 与 MCP
本章⽬标：理解 Agent Tool Use 原理，掌握⼀套包含⼯具注册、参数校验、权限控制、审计、超时、
失败恢复和可观测性的运⾏时基础设施。
1. Function Calling 与 Tool Use
- Function Calling ⼯作机制
- ⼯具定义：名称、描述、参数 Schema、返回 Schema、错误 Schema、权限等级和⻛险等级
- Input Schema、Output Schema、Error Schema

- ⼯具选择：模型根据⽤⼾请求⾃动选择⼯具，并⽣成符合 Schema 的参数
- ⼯具治理：参数校验、权限控制、调⽤审计、超时、重试、失败恢复和 Trace 记录
2. Tool Runtime 设计
- Tool Registry
◦ ⼯具注册：⽀持注册查询天⽓、查数据库、调⽤内部 HTTP API、⽂件处理等⼯具。
◦ ⼯具发现：让 Agent 能根据任务找到可⽤⼯具
◦ ⼯具元数据：记录⼯具说明、参数、返回值、权限、⻛险等级等信息
◦ ⼯具分类：按业务类型、读写属性、⻛险级别管理⼯具
◦ ⼯具版本：⽀持⼯具升级、兼容旧版本和灰度切换
◦ ⼯具依赖：声明⼯具运⾏所需的服务、密钥、数据库或外部资源
◦ ⼯具启停管理：⽀持临时下线⾼⻛险或异常⼯具
- Tool Schema
◦ 每个⼯具⾄少应包含：⼯具名称、⼯具说明、输⼊参数、输出结构、错误结构、权限级别、⻛
险级别、超时配置、重试策略、审计字段
3. ⼯具治理与安全边界
- 参数校验；
- 权限隔离：区分只读⼯具、写操作⼯具、⾼⻛险⼯具和需要确认的⼯具
- RBAC / ⽤⼾⾝份透传
- 只读⼯具与写操作⼯具
- ⾼⻛险⼯具
- ⼯具⽩名单
- SQL / Shell ⻛险控制
- ⼈⼯确认机制
- ⼯具调⽤队列：管理多个⼯具调⽤的顺序、依赖和结果
- ⼯具调⽤审计
- 敏感数据脱敏
- 超时与失败恢复：⼯具失败后进⾏重试、参数修正、降级或⼈⼯兜底

4. MCP：Model Context Protocol
- MCP 基础
MCP 是连接模型与外部⼯具 / 资源的标准协议。Agent 通过 MCP Client 发现并调⽤ MCP Server
暴露的⼯具、资源和 Prompt，例如⽂件系统、数据库、GitHub 或内部 API。Function Calling 负
责“模型如何选择⼯具”，MCP 负责“⼯具如何标准化接⼊”。相⽐传统 HTTP API，MCP 更适
合 Agent 的⼯具发现、资源读取和多⼯具组合场景。
- MCP ⼯具接⼊
◦ 接⼊⽂件系统 MCP
◦ 接⼊数据库 MCP
◦ 接⼊ GitHub MCP
◦ 接⼊内部 HTTP 服务
◦ MCP ⼯具权限控制
◦ MCP ⼯具审计
◦ MCP 连接管理
5. Agent Tool Runtime
打造⼀个 Agent Engineering Platform ，在平台中完成：
- Tool Registry：统⼀注册和管理所有⼯具
- Function Calling：让模型根据⽤⼾任务选择合适⼯具
- JSON Schema 参数校验：确保模型⽣成的⼯具参数可解析、可执⾏
- Pydantic ⼯具参数模型：⽤代码模型承接⼯具输⼊输出结构
- ⼯具权限控制：限制 Agent 在不同⾝份和场景下的可调⽤范围
- ⻛险等级：按只读、写操作、⾼⻛险操作划分⼯具安全级别
- ⼯具调⽤审计：记录每次⼯具调⽤的输⼊、输出、状态和 Trace
- 超时、重试、失败返回：保证⼯具异常时系统不会卡死
- MCP Tool 接⼊：将外部⼯具和数据源通过 MCP 统⼀接⼊
- Tool Call Trace：追踪⼯具从选择、参数⽣成、执⾏到返回的完整链路
- CLI ⼯具调⽤⼊⼝：提供命令⾏⽅式测试和调试⼯具调⽤能⼒
6. 项⽬演进路线  阶段⼆：Agent ⼯具调⽤基础设施

- 项⽬背景： 学员掌握了 Function Calling 机制、⼯具注册与 Schema 定义、MCP 协议等核⼼概念
后，需要构建⼀套⽣产级的⼯具调⽤运⾏时基础设施。
- 核⼼要点：
◦ ToolRegistry ⼯具注册中⼼
◦ ToolSchema ⼯具元数据定义
◦ JSON Schema / Pydantic 参数校验
◦ Function Calling 集成
◦ 权限校验与⻛险分级
◦ ⼯具调⽤审计
◦ 超时、重试、降级机制
◦ MCP Client 接⼊
◦ ⼯具调⽤ Trace 记录
第三章：Agent Loop、State Machine 与 Codebase Agent
本章⽬标：从“单轮模型调⽤ + 单次⼯具执⾏”升级为可连续思考、执⾏、观察、纠错和结束的⻓程
任务 Agent。本章聚焦任务执⾏过程、状态机、执⾏环境与失败恢复能⼒。
1. 从 Tool Agent 到 Agent Loop
- 单轮 Tool Calling 的局限
- 为什么复杂任务需要多步执⾏
- ReAct 模式
- Plan-and-Execute
- Observe → Think / Plan → Act → Observe → Finalize
- 最⼤循环次数
- 循环终⽌条件
- 死循环识别
- 任务中断与恢复
2. Planning 与任务拆解
- ⼀次性计划：适合⽬标明确、步骤稳定的任务
- 动态计划：适合执⾏过程中信息不断变化的⻓程任务

- Plan Revision
- ⼦⽬标拆解
- 步骤依赖
- 并⾮所有任务都需要 Planner
- 何时适合固定 Workflow
- 何时适合 Agent Loop
- 计划与实际执⾏偏差处理：根据⼯具结果、测试失败或上下⽂变化调整下⼀步动作
3. State Machine 与 Checkpoint
- 任务状态：created、planning、running、tool_failed、waiting_tool、waiting_approval、
completed、failed、cancelled
- 步骤状态：当前步骤、⼯具名称、输⼊参数、⼯具输出、失败原因、重试记录、下⼀步决策、任务
最终结果
- Checkpoint：为什么 Agent 需要 Checkpoint、任务中断恢复、状态持久化、失败任务复现、⼈⼯
接管后继续执⾏
4. Sandbox 与执⾏边界
Agent ⼀旦具备⽂件读写、Shell 执⾏、⽹络访问等能⼒，就必须被限制在安全边界内。本节重点解决
“Agent 能做什么、不能做什么、出了问题如何追踪”的问题，让 Codebase Agent 可以安全地执⾏
真实开发任务。
- ⽂件系统边界：区分可读⽬录、可写⽬录和禁⽌访问⽬录
- Shell 命令控制：通过命令⽩名单、超时限制和⾼⻛险命令拦截，避免误删⽂件或执⾏危险操作
- ⽹络访问控制：限制 Agent 是否可以访问外⽹、内⽹服务或第三⽅ API
- 本地 Sandbox：适合教学、调试和轻量任务执⾏
- Docker Sandbox：适合隔离执⾏环境，避免 Agent 影响宿主机
- 本地与容器边界差异：理解⽂件、⽹络、权限和环境变量在两种 Sandbox 中的不同
- ⼯具审计与⻛险回放：记录每次命令、⽂件操作和执⾏结果，⽅便复盘与定位问题
5. Agent Harness
Agent Harness 是把模型、⼯具、状态、上下⽂和执⾏环境组织在⼀起的运⾏框架。它让 Agent 不再
只是“⼀次模型调⽤ + ⼀次⼯具执⾏”，⽽是⼀个可配置、可追踪、可恢复的任务执⾏系统。

- Harness 的定义
- 模型、⼯具、状态、上下⽂和执⾏环境的统⼀组织
- 从单次 Tool Use 到 Agent Runtime
- Agent ⽣命周期管理
- Agent 配置
- ⼯具集装配
- 上下⽂输⼊
- Checkpoint+Trace
- Human-in-the-loop：在⾼⻛险动作前请求⽤⼾确认，例如修改⽂件、删除数据、发起外部请求
- Harness 化的⼯程意义
6. LangGraph 与 Agent 编排
- LangGraph：对象（图（节点、边、状态））
- StateGraph
- 条件分⽀与循环
- Checkpoint
- Interrupt
- Tool Node
- 调试与可视化
- LangGraph 与传统 Workflow 的关系
- LangGraph、OpenAI Agents SDK、AgentScope 的定位对⽐
- 通过 Dify 理解流程节点和条件分⽀、状态管理、⼈机协同、⾃动化业务流程，LangGraph 状态图
7. Codebase Agent
学会拆解业务流程
- 从业务 SOP 拆 Agent Loop
- 从岗位任务拆 Tool / Memory / Workflow
- 从⽤⼾旅程设计⼈机协同节点
在此基础上构建第⼀版可执⾏代码仓库任务的 Agent。

⽀持⼯具
- list_files、search_code、read_file、read_directory、write_file、apply_patch、run_test、
run_command、git_diff、git_status
典型任务
任务⼀：代码理解
“帮我找出该项⽬的登录逻辑，并⽣成 Markdown 说明⽂档。”
Agent 能够：
- 搜索认证相关代码
- 阅读路由、中间件、Service、数据库逻辑
- 梳理调⽤链
- 输出模块说明
- 给出相关⽂件路径
任务⼆：测试⽣成与修复
“给指定函数补充测试，并根据测试失败⽇志进⾏修复。”
Agent 能够：
- 定位函数
- 分析已有测试、编写测试、执⾏测试
- 读取失败⽇志
- 修正测试或代码
- 输出变更说明
8. 项⽬演进路线  阶段三：Codebase Agent
项⽬背景： 从"单轮模型调⽤+单次⼯具执⾏"升级到可连续思考、执⾏、观察、纠错的⻓程任务
Agent，需要构建⼀个能在代码仓库中完成复杂任务的 Agent 系统。
核⼼要点：
- Agent Loop 循环执⾏框架
- Planning 任务规划
- 搜索、读取、修改⽂件能⼒
- 执⾏测试与读取失败⽇志
- ⾃动修复错误

- Human-in-the-loop ⼈⼯确认机制
- Sandbox 安全执⾏环境
- 任务状态管理与 Checkpoint
第四章：Context Engineering、Memory 与 Codebase RAG
本章⽬标：理解 Agent 的能⼒上限不只由模型决定，也取决于它在每轮任务中“看到了什么信息、遗
漏了什么信息、如何压缩信息、如何检索知识”。本章主要解决上下⽂、知识和记忆问题。
1. Context Engineering
- Prompt Engineering 与 Context Engineering 的区别
- 上下⽂⻓度：理解模型上下⽂窗⼝限制，以及⻓上下⽂带来的成本和延迟问题
- Context Packing：判断哪些信息应该进⼊上下⽂，哪些信息应该留在外部状态
- Context Prioritization
- Context Budget
- Context Compression：⻓⽂件截断与摘要、⼯具结果压缩、历史对话压缩、⽆关信息过滤
- 上下⽂污染
- Token 预算
- 成本与延迟：通过缓存、并发、限流、重试和模型路由控制成本与响应时间
- Context Debug Report
- Retrieval Context：从⽂档、代码、历史记录中找相关信息
- KV Cache：不⽤深⼊训练层，但要理解它如何影响⻓上下⽂推理成本和延迟
- LiteLLM：通过 LiteLLM 演⽰模型路由、fallback、调⽤⽇志和成本追踪
2. Working Memory 与任务上下⽂
- Working Memory：保存当前任务相关信息，例如⽬标、已完成步骤、⼯具结果和未解决问题
- 当前⻛险与⽤⼾约束
- 临时事实记录
- Scratchpad：保存 Agent 中间推理、执⾏状态和下⼀步计划
- ⼯作记忆的⽣命周期
- ⼯作记忆与 Agent State 的边界

3. Memory 体系
- 短期记忆：当前会话与当前任务状态
- ⻓期记忆：⽤⼾偏好、历史任务、常⽤⼯具、个性化配置、记忆写⼊、记忆检索、记忆更新、记忆
删除、记忆可信度、项⽬约定和常⽤策略
- 项⽬级记忆：
◦ 项⽬⽬录结构：技术栈、模块边界、构建命令、测试命令、部署⽅式、编码规范、常⻅故障、
历史修复经验、项⽬约定、和开发约定
- 任务摘要与状态恢复：让 Agent 能在上下⽂被截断后继续执⾏任务
- Memory 策略对⽐：⽐较不同记忆策略对任务成功率、成本和延迟的影响
4. 现代 RAG 系统
⽂档解析：PDF、Markdown、HTML、表格与结构化⽂档、⽂档清洗、元数据提取。
- Chunking：
◦ 固定⻓度分块、按段落分块、按标题分块、语义分块、代码 AST 分块、Chunk Overlap、
Chunk Metadata
- 检索
◦ Embedding：向量化模型选择、维度、召回质量
◦ Vector Database：FAISS、Milvus、Chroma ⾄少熟悉⼀种
◦ BM25
◦ Elasticsearch
◦ Hybrid Search：向量检索 + BM25 / Elasticsearch
◦ Metadata Filter
◦ Query Rewrite：把⽤⼾问题改写成更适合检索的问题（查询重写、分解、澄清）
◦ Query Decomposition
◦ 查询澄清
- 检索后处理
◦ Rerank: Cross Encoder / LLM Rerank
◦ 上下⽂压缩
◦ 证据筛选

◦ Citation：回答必须引⽤来源
◦ 回答与证据⼀致性校验
◦ 检索后处理：重排、压缩、校正
- RAG 评估基础
◦ 召回率、命中率、答案正确率、幻觉率
5. LLM Wiki 与知识资产治理
- LLM Wiki 的定义
- LLM Wiki 与传统知识库的差异
- LLM Wiki 与 RAG 的关系
- 知识分类：按制度、产品、技术、调研资料、项⽬⽂档等⽅式组织知识
- ⽂档版本：记录知识更新历史，避免 Agent 使⽤过期内容
- 来源追踪：保留⽂档来源、作者、时间和引⽤路径
- 知识维护：定期清理重复、过期、低质量或冲突内容
- 知识权限：控制不同⽤⼾、部⻔或 Agent 可访问的知识范围
- 知识质量：评估知识完整性、可信度、时效性和可检索性
- 企业制度、产品⽂档、技术⽂档、调研资料的组织⽅式
6. Codebase RAG & Memory
为 Codebase Agent 增加代码库检索、上下⽂管理和项⽬记忆。

- 实现能⼒
◦ 代码库索引+⽂档索引
◦ 代码 AST / ⽂件级 Chunk
◦ 向量检索+BM25 检索
◦ Hybrid Search
◦ Rerank
◦ ⽂件引⽤+⾏号引⽤
◦ ⻓⽂件摘要
◦ ⼯具结果压缩
◦ 项⽬级记忆

◦ Context Debug Report
◦ 可恢复任务摘要
- 典型任务
◦ “该项⽬的鉴权链路是怎样的？”
◦ “如果新增⼀个⽀付渠道，需要改哪些模块？”
◦ “找出与订单状态流转相关的全部代码和⽂档。”
◦ “该接⼝可能存在哪些性能瓶颈？”
◦ “解释这个异常的根因，并给出相关代码证据。”
7. 项⽬演进路线 阶段四：Codebase RAG & Memory
项⽬背景： 理解了 Agent 的能⼒上限取决于它能"看到什么信息、遗忘什么信息"后，需要为
Codebase Agent 增加上下⽂管理、记忆和检索增强能⼒。
核⼼要点：
- 代码库索引与⽂档解析分块
- 向量检索、关键词检索、混合检索
- Rerank 重排序
- 项⽬级记忆（⽬录结构、技术栈、构建命令等）
- ⻓⽂件压缩与⼯具结果压缩
- 任务摘要与恢复
- 引⽤来源追溯
- Context Debug Report
第五章：Multi-Agent、Skill 与 Agent Eval
本章⽬标：理解单 Agent 与多 Agent 的边界，掌握复杂任务拆解、⼦ Agent 协作、结果聚合和冲突处
理；同时建⽴可量化、可回归、可持续优化的 Agent Eval 体系。
1. Multi-Agent 与 Subagent
- 为什么不是所有任务都需要 Multi-Agent
- 单 Agent 的适⽤场景：⽬标明确、步骤较短、上下⽂集中、⼯具调⽤链路简单的任务
- Multi-Agent 的适⽤场景：代码审查、研究分析、安全扫描、性能诊断、复杂报告⽣成等多视⻆任
务

- Subagent：主 Agent 将复杂任务拆成⼦任务，并为每个⼦ Agent 分配⽬标、上下⽂和⼯具
- Supervisor Pattern：⼀个主控 Agent 负责任务拆解、调度、结果收集和最终决策
- Planner / Executor Pattern：Planner 负责制定计划，Executor 负责具体执⾏，适合⻓程任务
- Reviewer Pattern：引⼊审查 Agent 对结果进⾏复核，降低幻觉、遗漏和错误结论
- 并⾏与串⾏执⾏：独⽴⼦任务可并⾏执⾏，有依赖关系的任务需要串⾏执⾏
- 隔离机制：不同⼦ Agent 之间需要上下⽂隔离、⼯具隔离和权限隔离，避免互相污染或越权
- 成本与超时控制：对⼦ Agent 设置最⼤执⾏时间、最⼤调⽤次数和 Token 预算
- 冲突处理：当多个⼦ Agent 结论不⼀致时，由主 Agent 基于证据、优先级或⼈⼯确认进⾏仲裁
2. Subagent 任务委托
- Task Delegation
⼦任务应明确：
◦ 任务⽬标：这个⼦ Agent 要解决什么问题
◦ 输⼊上下⽂：它能看到哪些代码、⽂档、⽤⼾需求或历史结果
◦ 可调⽤⼯具：限制它能使⽤搜索、读⽂件、测试、扫描等哪些⼯具
◦ 权限边界：明确是否允许写⽂件、执⾏命令、访问外部服务
◦ 预期输出：要求输出结论、证据、⻛险等级或建议
◦ 输出格式：统⼀使⽤ JSON、Markdown 或结构化字段，⽅便主 Agent 汇总
◦ 超时限制：避免⼦任务⽆限执⾏或消耗过多成本
◦ 评价标准：定义什么算完成、什么算⾼质量结果
◦ 写操作限制：默认优先只读，涉及修改时必须单独授权
- Result Aggregation
◦ ⼦任务结果合并：将不同 Agent 的发现统⼀整理成完整结论
◦ 证据合并与引⽤保留：保留代码位置、⽂档来源、测试结果等依据
◦ 去重与排序：合并重复发现，并按严重程度、影响范围或优先级排序
◦ 结论汇总：将分散信息转化为⽤⼾可理解、可执⾏的最终建议
◦ 冲突识别与仲裁：发现⼦ Agent 结论不⼀致时，由主 Agent 复核证据后裁决
◦ 主 Agent 复核：最终输出前检查是否遗漏任务⽬标、是否存在⽆证据结论
3. Skill 系统

- Skill 定义：将某类任务的执⾏⽅法、输⼊输出规范、⼯具依赖、Prompt 模板和质量标准封装为可
复⽤能⼒包
- Skill ⽣命周期: Skill 注册、Skill 检索、Skill 匹配、Skill 执⾏、Skill 评估、Skill 版本管理、Skill 下
线、Skill 复⽤
- Skill 注册：定义 Skill 名称、适⽤场景、输⼊参数、输出格式、依赖⼯具、权限边界和评价标准
- Skill 检索：根据⽤⼾任务、上下⽂、业务场景和历史经验，⾃动匹配最合适的 Skill
- Skill 编排：将多个 Skill 组合成复杂任务流程，⽀持顺序执⾏、并⾏执⾏、条件分⽀和⼈⼯确认
- Skill 复⽤：在不同 Agent、不同业务场景和不同项⽬中复⽤成熟 Skill，减少重复 Prompt 和重复流
程设计
4. Agent Eval：Agent 的核⼼护城河
- 为什么需要 Eval
◦ Agent 能运⾏不代表 Agent 可靠
◦ Demo 成功不代表真实任务成功
◦ 修改 Prompt 可能导致旧任务退化
◦ 更换模型可能导致⼯具调⽤⾏为变化
◦ RAG 策略变化可能降低引⽤准确率
◦ 需要⽤数据证明 Agent 是否变好
- Golden Dataset
◦ ⽬标：让你的 Agent 不只是能跑，⽽是能被评测、能迭代、能证明变好
◦ Golden Dataset：构造标准任务集，覆盖代码理解、代码修改、⽂档检索和⻓程任务
- 核⼼指标
◦ Task Success Rate：任务是否完成
◦ Tool Call Accuracy：⼯具选得对不对，参数对不对
◦ Tool Parameter Accuracy
◦ Answer Correctness：答案是否事实正确
◦ Citation Accuracy：引⽤是否⽀持结论
◦ Regression Test：新版本 Agent 有没有退化
◦ Retrieval Recall
◦ Hallucination Rate
◦ Human Handoff Rate

◦ Human Eval：⼈⼯标注标准和评价规范
◦ Latency
◦ Token Cost
◦ Tool Call Count
◦ Failure Recovery Rate
- Eval ⽅法
◦ Rule-based Eval
◦ Schema-based Eval
◦ Snapshot Test
◦ Golden Answer
◦ LLM-as-Judge：什么时候能⽤，什么时候不可靠
◦ Human Eval
◦ Pairwise Comparison
◦ Regression Test与A/B Test
◦ Trace Analysis：失败发⽣在哪⼀步
5. Trace Analysis 与失败诊断
- Prompt 问题：指令不清晰、约束冲突、输出格式不稳定
- 上下⽂问题：关键信息缺失、⽆关信息过多、上下⽂污染
- 检索问题：召回不到关键⽂档、排序错误、引⽤来源不可靠
- ⼯具选择错误：模型选错⼯具或在错误时机调⽤⼯具
- 参数错误：字段缺失、类型错误、值不合法
- 权限拦截：Agent 尝试执⾏超出权限范围的操作
- ⼯具执⾏失败：超时、接⼝异常、外部服务不可⽤
- Agent Loop 死循环：重复计划、重复调⽤⼯具、⽆法进⼊终⽌状态
- ⼦ Agent 委托错误：任务⽬标不清、上下⽂不⾜或权限配置错误
- 模型能⼒不⾜：推理、代码理解或⻓上下⽂处理能⼒不⾜
- 最终答案幻觉：结论没有证据⽀撑
- 引⽤不准确：引⽤内容⽆法⽀持回答
- 评测误判：Eval 规则或 Judge 模型判断错误
6. Multi-Agent & Agent Eval Platform

- Multi-Agent 能⼒
◦ 构建以下⻆⾊：
▪ Supervisor Agent：负责任务拆解、调度和最终决策
▪ Architecture Agent：分析⽬录结构、模块边界、依赖⽅向和架构问题
▪ Test Agent：分析测试覆盖率、测试质量和缺失测试
▪ Security Agent：检查鉴权、注⼊、敏感信息和权限边界
▪ Performance Agent：发现慢查询、循环、缓存和性能隐患
▪ Documentation Agent：整理⽂档、注释和知识库内容
▪ Report Agent：合并结果、处理冲突并⽣成最终报告
- 典型任务
- “请分析该项⽬的可维护性，并给出可执⾏的重构建议。”
◦ 主 Agent 将任务拆解为：
▪ Architecture Agent：⽬录结构、模块边界、依赖⽅向
▪ Test Agent：测试覆盖率、测试质量、缺失测试
▪ Performance Agent：慢查询、循环、缓存、性能隐患
▪ Security Agent：鉴权、注⼊、敏感信息、权限边界
▪ Report Agent：合并结果、处理冲突、⽣成最终报告
- Eval 平台能⼒
◦ Benchmark 任务集管理
◦ Agent 批量运⾏
◦ Prompt / Model / RAG 策略对⽐
◦ Trace 记录
◦ LLM-as-Judge与⼈⼯评测
◦ 成功率统计、成本统计、耗时统计、⼯具调⽤统计
◦ 失败样本聚类
◦ 改进前后效果对⽐
◦ 回归测试报告
7. 项⽬演进路线 阶段五：Multi-Agent & Eval

项⽬背景： 掌握了单 Agent 构建能⼒后，需要将其升级为可协作、可评测、可迭代的多 Agent 平台，
建⽴ Agent 质量保障体系。
核⼼要点：
- Supervisor Agent 监督协作
- Architecture / Test / Security / Performance / Report Agent 多⻆⾊分⼯
- Skill 注册与检索机制
- Benchmark 管理与⾃动化评测
- LLM-as-Judge 评估
- ⼈⼯评测流程
- Trace Analysis 分析
- 回归测试与 Agent 版本对⽐
第六章：⼯程化、⽣产部署与可观测性
本章⽬标：让学员从“Agent 项⽬能运⾏”升级为“Agent 系统可部署、可监控、可灰度、可回滚、可
治理”。
1. 模型服务与推理部署
- 云 API、私有化与混合部署：模型部署需根据业务场景选择云 API、私有化、专有云或混合调⽤⽅
案，在模型能⼒、数据敏感性、成本、延迟、可运维性与合规要求之间取得平衡，保障 Agent 系统
稳定、安全、可控地运⾏。
- 推理服务
◦ vLLM：⾼吞吐推理服务、PagedAttention、连续批处理、OpenAI 兼容接⼝、并发请求处理、
显存利⽤率优化。
◦ PagedAttention；
◦ Continuous Batching；
◦ OpenAI Compatible API；
◦ TGI：Text Generation Inference 的部署⽅式、流式输出、批处理、模型加载、推理参数配置和
监控指标。
◦ Triton：多模型推理服务、GPU 资源管理、模型并发、动态批处理、推理性能监控。
◦ 多模型推理；
◦ GPU 资源利⽤；
◦ 并发控制；

◦ 推理服务指标。
2. 性能与成本优化
- 缓存体系：Prompt Cache、Semantic Cache、Embedding Cache、RAG Cache、Tool Result
Cache、缓存命中率、缓存失效策略
- 批处理与并发：Embedding Batch、批量 Rerank、Eval Batch、批量摘要、并发队列、任务优先
级、排队等待、超时处理
- 模型路由与降级：强模型与弱模型分层、模型路由、Fallback、Token Budget、⼩模型优先、缓存
优先、⼈⼯兜底、限流、熔断、降级策略
3. Agent 可观测性
- ⽇志：
◦ 模型调⽤⽇志：记录模型名称、模型版本、Prompt 版本、输⼊ Token、输出 Token、Cost、
Latency、请求状态和错误原因
◦ ⼯具调⽤⽇志：记录⼯具名称、版本、参数、权限校验结果、执⾏耗时、返回结果、失败原
因、重试次数和审计信息
- Agent Trace：记录⽤⼾请求、任务规划、Context Build、检索结果、⼯具选择、⼯具执⾏、模型
调⽤、⼦ Agent 调⽤、⼈⼯确认、策略拦截和最终输出
- Replay机制：保存失败任务、保存输⼊、保存上下⽂、保存⼯具结果、保存 Agent 状态、复现问
题、验证修复、⽀撑回归测试
4. 监控与告警
- 业务指标：任务成功率、⾃动化完成率、⼈⼯接管率、⽤⼾满意度、⼯单处理时⻓、平均任务处理
时⻓、⾃动化完成率
- 模型指标：Token 消耗、平均延迟、成本趋势、调⽤失败率、模型 fallback 率、P95 / P99 延迟、
Fallback 率
- Agent 指标：⼯具调⽤准确率、⼯具失败率、检索命中率、引⽤准确率、Loop 中断次数数、失败
恢复成功率、⼦ Agent 成功率
- 安全指标：⾼⻛险⼯具调⽤次数、越权⼯具调⽤拦截率、敏感字段访问次数、危险 SQL 拦截率、⼈
⼯确认触发率
- 异常告警：对模型失败率升⾼、⼯具失败率升⾼、成本异常、延迟异常、权限异常、SQL 拦截异常
和⼈⼯接管率异常进⾏告警

5. 版本管理、灰度与回滚
- 版本对象
◦ 模型版本：记录不同模型、不同供应商、不同参数配置的效果差异
◦ Prompt 版本：记录提⽰词变更、适⽤场景、评测结果和回滚点
◦ ⼯具版本：记录⼯具 Schema、参数、权限、返回结构和业务逻辑变更
◦ Skill Version
◦ RAG 策略版本：记录切块策略、Embedding 模型、检索参数、Rerank 策略和知识库版本
◦ Knowledge Base Version
◦ Version：记录Workflow 版本的流程节点、条件分⽀、⼈审策略和失败恢复策略与Agent
Version
- 灰度发布
◦ 灰度发布：按⽤⼾灰度、按部⻔灰度、按租⼾灰度、按任务类型灰度、按⻛险等级灰度、A/B
Test、指标观察
◦ 通过 Feature Flag 控制 Prompt、模型、RAG 策略、Agent Planner 和⼯具版本
- 回滚策略
◦ 回滚策略：⽀持 Prompt 回滚、模型回滚、⼯具版本回滚、知识库版本回滚、Workflow 回滚和
服务镜像回滚
6. MCP Server 与私有化部署
本节统⼀处理 MCP 服务在⽣产环境中的问题包括：MCP Server 的部署、鉴权、⽹络隔离、⼯具⽩名
单、⽇志与审计以及内⽹⼯具接⼊、密钥管理、多租⼾隔离、API Key 不⼊库、配置中⼼、敏感字段脱
敏、数据权限过滤。
7. Production Ready Agent Engineering Platform
完成平台⽣产化⽅案：
- 部署形态
◦ 本地开发环境：Docker Compose 启动 API、数据库、Redis、向量库和模型⽹关
◦ 企业内⽹环境：模型服务、业务 API、知识库、⽇志系统和权限系统部署在企业内⽹
◦ 混合部署：敏感数据和⼯具在内⽹，通⽤模型能⼒通过云 API 或专有云调⽤

◦ 安全与合规：API Key 不⼊库，密钥通过环境变量、密钥管理服务或配置中⼼管理。Trace 与⽇
志需要脱敏，避免记录完整⾝份证、⼿机号、地址、合同⾦额等敏感字段。知识库、向量库和
业务数据需要做租⼾隔离、部⻔隔离和权限过滤
- 平台化封装
◦ SDK：将 Model Gateway、Context Build、Tool Call、Agent Run、Eval Runner 封装为内部
SDK，⽅便业务系统接⼊
◦ 服务化：将 Agent 能⼒拆成可复⽤服务，例如模型服务、上下⽂服务、⼯具服务、⼯作流服
务、评测服务和⽇志服务
◦ 平台治理：统⼀鉴权、限流、审计、版本管理、成本分摊、质量⻔禁和上线审批
- 涉及⼯具和服务
◦ FastAPI 服务；
◦ Redis、PostgreSQL、Vector DB
◦ MCP Server
◦ Trace 服务、⽇志服务
◦ Metrics 与监控、评测服务、多环境配置
◦ Prompt / Tool / RAG / Model 版本管理
◦ 灰度发布、Replay
◦ 成本报表、上线 Runbook
8. 项⽬演进路线 阶段六：Production Ready
项⽬背景： 从"Agent 项⽬能运⾏"升级到"Agent 系统可部署、可监控、可灰度、可回滚、可审计"，
需要让整个平台满⾜企业部署与运营要求。
核⼼要点：
- Docker Compose 部署⽅案
- Model Gateway 模型⽹关
- Redis、PostgreSQL、VectorDB 基础设施
- Trace、Metrics、Monitoring 可观测性
- Replay 回放调试
- Prompt / Model / RAG / Tool 版本管理
- Feature Flag 功能开关
- 灰度发布与回滚

- 成本治理
- 上线 Runbook
第七章：企业级综合项⽬与产品化落地
本章⽬标：通过企业级 Agent 平台案例理解成熟 Agent 系统的架构设计，并将前六章的⼯程能⼒转化
为可展⽰、可交付、可⾯试表达的业务项⽬成果。
第⼀部分：DeerFlow 企业级 Agent 平台架构解析
⽬标：
通过九条核⼼架构线深度剖析 DeerFlow 源码，帮助开发者全⾯掌握企业级智能体平台的运⾏机制与设
计精髓。学员将深⼊理解 DeerFlow 如何平衡安全性、性能与可维护性 —— 如沙箱隔离机制如何保障
系统安全、中间件管道如何实现灵活的上下⽂控制、⼦代理系统如何⽀持复杂任务分解。更重要的
是，课程将培养⼆次开发能⼒，让学员能够根据实际业务诉求定制专属 Agent、扩展⼯具⽣态、优化
持久化策略，真正将 DeerFlow 转化为贴合⾃⾝场景的⽣产级智能体平台。
1. 请求⼊⼝ ― Gateway 如何把⽤⼾输⼊托管成可观察，可控制的 run
2. 主智能体⼯⼚ ― 运⾏时配置如何变为可运⾏的智能体图
3. ⼯具组装 ― ⼯具注册了，不代表这次 agent 就能⽤
4. 中间件管道 I ― DeerFlow 如何在模型调⽤前准备上下⽂
5. 中间件管道 II ― 如何裁决、⻔控和清理模型输出
6. 沙箱系统 ― ⼯具执⾏的位置，以及为什么本地和容器沙箱不是同⼀边界
7. ⼦代理系统 ― 如何将复杂的⼦任务委托给受限的完整代理
8. 技能系统 ― 经验如何变成可安装、可审查、可重⽤的代理能⼒
9. 持久化、存储和检查点 ― 什么可以恢复、什么可以查询、什么可以审计
第⼆部分：⾼阶案例⼀：企业级深度研究平台
⽬标：
基于 DeerFlow 搭建企业级深度研究平台，让 Agent ⾃动完成资料搜集、交叉验证、结构化分析和报
告⽣成。通过 Skill 沉淀竞品分析、⾏业调研、投资尽调等研究⽅法论，通过 Tool 接⼊外部数据源和
内部知识系统，提升研究效率与结果可信度。

知识点：
DeerFlow 主导 Agent：负责接收研究问题、拆解任务、编排执⾏流程
Skill 机制：将研究⽅法论封装为可复⽤、可审查、可传承的技能包，同时针对Skill执⾏结果进⾏评估
Tool ⼯具体系：接⼊搜索引擎、⾏业数据库、专利平台、Wiki、⽂档库、专家知识图谱等数据源
任务编排：完成信息搜集、交叉验证、结构化分析、报告⽣成
可追溯与审计：记录数据来源、引⽤依据、⼯具调⽤和执⾏ Trace
报告⽣成：⽀持 Markdown、HTML、可交互⽂档等多种输出形式
实现步骤：
1. 明确研究场景：确定平台⽀持的任务，例如竞品分析、⾏业调研、投资尽调、技术选型分析
2. 封装研究 Skill：将成熟研究流程沉淀为 Skill，定义输⼊、执⾏步骤、输出格式和质量标准
3. 接⼊数据源 Tool：接⼊外部数据源与内部知识系统，让 Agent 能⾃动获取研究所需资料
4. 构建研究⼯作流：由主导 Agent 拆解任务，完成资料搜集、事实核验、结构化分析和报告⽣成
5. 建⽴证据链：记录引⽤来源、⼯具调⽤、分析过程和执⾏ Trace，保证结果可追溯、可审计
6. 输出研究报告：⽣成 Markdown、HTML 或可交互⽂档，适配技术团队、管理层和移动端使⽤场景
7. 优化效率与质量：通过 Skill 复⽤、模板化报告和⼈⼯反馈，让研究报告从数天产出缩短到数⼩时
第三部分：⾼阶案例⼆：新⼀代软件⼯⼚
⽬标：
基于 DeerFlow 搭建新⼀代软件⼯⼚，让 Agent ⾃动完成需求分析、任务拆解、代码开发、代码审
查、测试验收和持续集成。通过 GitHub Channel、⾃定义 Agent 和 ACP 本地⼯具集成，构建端到端
⾃动化开发流⽔线，提升软件交付效率与流程可控性。
知识点：
- DeerFlow Agent 编排：负责组织需求分析、任务分解、代码开发、测试和交付流程
- GitHub Channel：实现分⽀创建、代码提交、PR 发起、CI 检查等 DevOps 集成
- ⾃定义 Agent：定义产品经理 Agent、架构师 Agent、开发 Agent、QA Agent 等不同⻆⾊
- 多 Agent 协作：让不同⻆⾊ Agent 按职责分⼯完成复杂软件开发任务
- ACP 本地⼯具集成：连接本地构建、环境配置、命令执⾏等特殊任务
- 可追溯与审计：记录需求、代码变更、测试结果、PR 流程和 Agent 执⾏ Trace
步骤：

1. 明确软件⼯⼚场景：确定平台⽀持的开发任务，例如需求分析、功能开发、Bug 修复、代码审查、
测试⽣成、CI 检查
2. 定义多⻆⾊ Agent：设计产品经理 Agent、架构师 Agent、开发 Agent、QA Agent 的职责、输⼊输
出和协作边界
3. 接⼊ GitHub Channel：让系统能够与代码仓库交互，⾃动创建分⽀、提交代码、发起 PR 并运⾏
CI 检查
4. 构建⾃动化开发⼯作流：由主导 Agent 拆解任务，协调不同⻆⾊ Agent 完成⽅案设计、代码⽣成、
代码审查和测试验收
5. 集成 ACP 本地⼯具：通过 ACP 调⽤本地构建、环境配置、测试命令和项⽬脚本，实现跨平台任务
编排。
6. 建⽴流程追踪机制：记录任务拆解、代码变更、⼯具调⽤、测试结果、PR 状态和执⾏ Trace，保证
过程可审计
7. 优化交付效率与质量：通过⻆⾊分⼯、⾃动化流⽔线、⼈⼯确认和失败恢复机制，让软件开发从⼿
⼯流程升级为智能⼯⼚
第四部分：Agent 产品化与业务场景落地
Agent 场景判断
适合 Agent 的场景：
- 信息检索、⽂档分析、研究分析、代码理解、代码⽣成、客服辅助、销售运营、⼯单处理、流程⾃
动化、企业知识问答
不适合 Agent 的场景：
- 极强确定性任务
- ⾼⻛险且不允许容错的任务
- 规则明确且脚本即可完成的任务
- 不允许⼈⼯审核的资⾦、医疗、法律决策
- 成本远⾼于⼈⼯的低价值任务
Agent、Workflow、RAG、Chatbot 与脚本的边界
- 何时使⽤ Chatbot
- 何时使⽤ RAG
- 何时使⽤ Workflow
- 何时使⽤ Agent

- 何时只需要⾃动化脚本
- 如何避免过度 Agent 化
业务流程拆解
- 从业务 SOP 拆 Agent Loop
- 从岗位任务拆 Tool
- 从知识资产拆 RAG
- 从经验⽅法论拆 Skill
- 从⻛险节点设计 Human-in-the-loop
- 从失败场景设计回滚
- 从业务⽬标定义 Eval
产品交付指标
- 任务完成率、⼈⼯接管率
- 平均处理时⻓
- 单任务成本、成本节省
- ⾃动化覆盖率
- ⽤⼾满意度、业务转化率
- 错误率、⻛险事件数
作品集与⾯试表达
- 如何将 Agent Engineering Platform 写⼊简历
- 如何描述 Tool Runtime
- 如何描述 Codebase Agent
- 如何描述 RAG 与 Context Engineering
- 如何描述 Benchmark 与 Eval
- 如何展⽰ Trace、Replay、灰度与成本治理
- AI Agent 开发⼯程师常⻅⾯试题
- 如何⽤项⽬数据证明⼯程能⼒
- 如何将技术项⽬表达为业务价值
