# 同一个模型，为什么有多种 API？

在对接大模型 API 时，填写 `base_url` 往往不只有一种选择。

以 DeepSeek API 为例，它同时提供 OpenAI-compatible 和 Anthropic-compatible 两种入口：

- OpenAI：<https://api.deepseek.com>
- Anthropic：<https://api.deepseek.com/anthropic>

![DeepSeek API 的接口选择](https://neptune-ipc.oss-cn-shenzhen.aliyuncs.com/img/20260808105842459.png)

为什么同一个模型服务，会提供两种不同的 `base_url`？

事情是这样的：这里的 OpenAI-compatible 和 Anthropic-compatible，都是**模型调用协议**，区别在于协议的请求、响应格式不同。

## 一、什么是模型调用协议

字面上讲，模型调用协议就是“让应用和模型服务彼此通信的规则”。

但是，更准确的说法是，它规定了应用怎样向模型发送消息、工具定义和多模态内容，以及怎样接收模型回复。

不同模型服务的请求和响应格式并不完全相同。即使它们都支持文本生成，也可能使用不同的字段、不同的流式事件，以及不同的工具调用格式。

因此，不同协议之间不能只看名称判断是否兼容，还要比较它们的请求字段、响应结构和流式事件。

下面先看几种主流的模型调用协议。

## 二、主流的模型调用协议

### 1. **OpenAI Chat Completions**

这是目前兼容服务中最常见的一套接口。它的典型入口是：

```text
POST /v1/chat/completions
```

请求通常包含 `model`、`messages`、`stream` 等字段。

非流式响应一般从 `choices[0].message.content` 取文本；流式响应则经常使用 SSE（Server-Sent Events，服务器发送事件）返回增量内容。

很多服务都提供 OpenAI-compatible 接口，包括各类云模型平台、中转服务，以及本地部署的 vLLM、Ollama 等。这样一来，应用可以使用相近的请求方式接入多个服务。

需要说明的是，所谓 OpenAI-compatible，只是“接口行为接近 OpenAI”，并不意味着每个细节都完全相同。模型名称、鉴权方式、工具调用格式和流式事件，都可能存在差异。

### 2. **OpenAI Responses API**

Responses API 是 OpenAI 推出的较新模型调用接口。它试图用一个统一的响应模型，覆盖文本、多模态、工具调用和多轮交互等场景。

它和 Chat Completions 的请求、响应字段并不完全相同。注意，不能简单地把请求路径改成 `/responses`，就认为两者已经兼容。

如果一个应用需要同时支持两套接口，应该分别处理它们的请求和响应结构。不要只根据接口名称或 URL 判断兼容性。

### 3. **Anthropic Messages API**

Anthropic 的 Claude 模型主要使用 `Messages API`。它同样支持消息、系统提示词、工具调用和流式输出，但请求字段、响应事件名称以及工具调用格式，都和 OpenAI 体系不同。

因此，Anthropic 原生 API 与 OpenAI-compatible API 是两套协议。某些平台虽然提供 Anthropic-compatible 或 OpenAI-compatible 的兼容入口，但实际使用时，仍应以服务商的接口文档为准。

### 4. Google Gemini API

Google Gemini 原生 API 使用自己的 `generateContent` 和 `streamGenerateContent` 接口。消息内容通常组织为 `contents` 与 `parts`，多模态输入也采用自己的数据结构。

Gemini 原生 API 不是 OpenAI-compatible 协议。如果直接调用 Google 原生接口，就需要按照 Gemini 的接口规范组织请求。Google 也提供了 OpenAI-compatible 入口，使用该入口时，则应按照 Google 的兼容性文档配置 `base_url` 和请求参数。

## 三、最后再看 Agent 与工具协议

前面介绍的 OpenAI、Anthropic 和 Gemini，解决的是“应用怎样调用模型”的问题。接下来再看另一类协议：它们解决的是“Agent 怎样发现工具、调用外部能力，以及多个 Agent 怎样协作”的问题。

### 1. MCP：模型上下文协议

MCP 是 Model Context Protocol 的缩写，中文通常译作“模型上下文协议”。

MCP 解决的不是“怎样调用某个模型”，而是“模型应用怎样连接工具、资源和提示模板”。例如，一个 MCP Server 可以向客户端暴露数据库查询、文件操作或业务 API。

可以用一个简单的对照来理解：

- OpenAI-compatible、Anthropic Messages、Gemini API：应用和模型服务之间的调用协议。
- MCP：模型应用和外部工具、数据源之间的连接协议。

MCP Client 负责把外部工具和资源接入应用，但不应该被当作另一种模型 API。

### 2. A2A：Agent 间通信协议

A2A 是 Agent2Agent 的缩写，面向多个 Agent 之间的发现、任务委派和结果交互。

MCP 和 A2A 的区别，可以这样记：

- MCP 更关注 Agent 怎样使用工具。
- A2A 更关注 Agent 怎样与另一个 Agent 协作。

这两个协议都很重要，但它们解决的问题，与前面介绍的模型调用协议不同。

## 四、这些协议有什么不同

协议名称相近，不代表它们解决的是同一个问题。可以用下面的结构理解它们之间的关系：

```text
应用 / Agent
        │
        ├── 模型服务
        │     ├── OpenAI-compatible
        │     ├── Anthropic Messages
        │     └── Gemini API
        │
        ├── 工具与资源
        │     └── MCP
        │
        └── 其他 Agent
              └── A2A
```

上面的结构中，OpenAI-compatible、Anthropic Messages 和 Gemini API，解决的是应用与模型服务之间的通信问题。

MCP 解决的是应用与工具、资源之间的连接问题；A2A 解决的是一个 Agent 与另一个 Agent 之间的协作问题。

## 五、最容易混淆的几个问题

### 1. OpenAI-compatible 是不是 OpenAI 协议？

不一定。

OpenAI-compatible 的意思是“某个服务提供了与 OpenAI 接口相近的访问方式”，并不表示它就是 OpenAI 官方服务。

因此，使用兼容接口时，仍然需要查看具体服务商的文档，确认模型名称、鉴权方式、工具调用格式和流式事件是否完全一致。

### 2. MCP 是不是一种模型 API？

不是。

模型 API 负责向模型发送请求并接收回复；MCP 负责让应用连接工具、资源和提示模板。一个应用可以同时使用模型 API 和 MCP，但两者承担的职责不同。

### 3. A2A 能不能替代 MCP？

也不能。

MCP 解决的是 Agent 与工具、资源之间的连接问题，A2A 解决的是 Agent 与 Agent 之间的协作问题。它们可以同时存在，不能相互替代。
