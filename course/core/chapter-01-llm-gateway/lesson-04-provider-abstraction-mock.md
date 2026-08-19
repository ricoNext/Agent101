# 第 4 课：用 Provider 抽象隔离模型服务

> 所属章节：[第一章：LLM API、Prompt、Structured Output 与 Gateway](./index.md)  
> 上一课：[第 3 课：理解 LLM API 与模型调用边界](./lesson-03-llm-api-model-boundaries.md)  
> 下一课：[第 5 课：接入 OpenAI-compatible 模型服务](./lesson-05-openai-compatible-provider.md)  
> [参考代码基线](https://github.com/ricoNext/agent-platform/tree/chapter-02)

## 一、前言

上一课我们搭好了 FastAPI 骨架——`GET /health` 能跑通，项目结构就绪，测试框架也装好了。但一个只有健康检查的服务，显然还什么都做不了。

今天接着往下讲：让这个服务真正「接入 LLM」。

不过这里有一个常见的坑。很多人上来就直接接真实模型，结果开发时频繁被限流、欠费、网络波动打断。更麻烦的是，模型输出天生带有随机性，写测试根本无法得到确定性结果。

所以我们决定：**先不接任何真实模型。**

这一课只做两件事：

1. 定义一套你自己的 Provider 接口，把「调用模型」从业务代码里抽出来
2. 实现一个**完全确定的 Mock Provider**——输入相同，输出永远相同

做完以后，你就可以在不依赖任何外部 API、不消耗一分钱的情况下，完成后续大多数后端和前端的开发与测试。等接口和流程都跑稳了，下一课再接真实模型。

建议先跟着例子做一遍，再读文字说明。

## 二、第一步：定义数据协议

为了兼容不同模型，我们需要先定义一套通用的数据协议。

所谓**数据协议**，就是前后端、服务与 Provider 之间约定好的数据结构。简单说，前端永远按这套结构发请求；Provider 内部才转换成某个模型服务的 JSON。

创建 `app/schemas.py`：

```python
from typing import Literal

from pydantic import BaseModel, Field


# 对话信息类型
class ChatMessage(BaseModel):
    # 对话角色
    role: Literal["system", "user", "assistant"]
    # 对话内容
    content: str = Field(min_length=1)


# 对话请求返回结构
class ChatRequest(BaseModel):
    # 对话内容
    messages: list[ChatMessage] = Field(min_length=1)
    # 模型名称
    model: str | None = None


# 对话响应返回结构
class ChatResponse(BaseModel):
    # 对话 ID
    run_id: str
    # 对话文本
    text: str
    # 模型名称
    model: str
    # 输入 token 数量
    input_tokens: int | None = None
    # 输出 token 数量
    output_tokens: int | None = None
    # 延迟时间
    latency_ms: int


# 错误响应返回结构
class ErrorResponse(BaseModel):
    # 错误码
    code: str
    # 错误消息
    message: str
    run_id: str | None = None
```

下面解释一下上面代码的关键点。

**（1）`ChatMessage` / `ChatRequest` / `ChatResponse`**

这三组类型分别描述「一条消息」「一次请求」「一次响应」。需要强调一下：这里的 `ChatRequest` 是**你的 API 协议**，不是某个模型服务的协议。前端永远调用它；Provider 内部才转换为特定服务的 JSON。

**（2）类型注解**

本章代码大量使用了 Python 3.10+ 的现代类型语法。常见写法如下：

| 语法 | 含义 | 示例 |
|------|------|------|
| `name: str` | 声明 name 是字符串类型 | `run_id: str` |
| `name: int` | 声明 name 是整数类型 | `latency_ms: int` |
| `name: int \| None = None` | 可以是 int 也可以是 None，默认 None | `input_tokens: int \| None = None` |
| `name: list[ChatMessage]` | 元素类型为 ChatMessage 的列表 | `messages: list[ChatMessage]` |
| `name: dict[str, str]` | 键和值都是字符串的字典 | `-> dict[str, str]` |
| `Literal["a", "b", "c"]` | 只能是这几个字面值之一 | `role: Literal["system", "user", "assistant"]` |

**（3）Pydantic 的 `BaseModel`**

这是本章最重要的基础设施。继承了 `BaseModel` 的类会自动获得：

- **数据校验**：传入的数据类型不对，或缺少必填字段，直接抛出验证错误（FastAPI 中表现为 422 响应）
- **序列化**：`.model_dump()` 将对象转为字典，`.model_validate()` 从字典构建对象
- **JSON Schema 生成**：FastAPI 用它自动生成 `/docs` 接口文档

`Field(min_length=1)` 是 Pydantic 的字段约束，告诉校验器这个字段至少要有 1 个字符。

## 三、第二步：定义 Provider 接口

有了通用的数据协议，这一节就来看看如何定义 Provider 接口。

所谓 **Provider（模型提供者）**，字面上讲就是「提供模型能力的一方」；但更准确的说法是：它是一层抽象，把「调用模型」这件事从业务代码里隔离出去。接口里通常包含两个方法：

- `complete`：完成一次对话，返回完整结果
- `stream`：流式对话，逐段产出文本

先创建目录和文件：

```bash
mkdir -p app/providers
touch app/providers/__init__.py
```

再创建 `app/providers/base.py`：

```python
from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Protocol

from app.schemas import ChatMessage


# ProviderResult 是模型提供者的返回结果，包括：文本、模型、输入和输出 token 数量
@dataclass
class ProviderResult:
    text: str
    model: str
    input_tokens: int | None
    output_tokens: int | None

# ProviderError 是模型提供者的错误，包括：错误码和错误消息
class ProviderError(Exception):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


# ModelProvider 是模型提供者的协议，包括：
# - complete 方法，用于完成对话
# - stream 方法，用于流式对话
class ModelProvider(Protocol):
    # complete 方法，用于完成对话
    async def complete(
        self,
        *,
        messages: list[ChatMessage],
        model: str | None = None,
    ) -> ProviderResult:
        ...

    # stream 方法，用于流式对话
    def stream(
        self,
        *,
        messages: list[ChatMessage],
        model: str | None = None,
    ) -> AsyncIterator[str]:
        ...
```

下面看一个例子，逐段讲解上面的代码。

**（1）`@dataclass`**

`@dataclass` 装饰器会自动为类生成 `__init__`、`__repr__` 等方法。原来需要写一堆样板代码的纯数据类，现在只需声明字段即可。对比一下：

```python
# 没有 dataclass
class ProviderResult:
    def __init__(self, text: str, model: str, ...):
        self.text = text
        ...

# 有 dataclass —— 一行 @dataclass 搞定上面所有
```

`ProviderError` 是 Provider 层对外暴露的稳定错误。具体实现可以使用 HTTPX、某家 SDK 或本地推理引擎，但业务层只接收脱敏后的 `code` 和 `message`，不直接依赖底层异常类型。

**（2）`class ModelProvider(Protocol)`**

这定义了一个**协议类（Protocol）**。Protocol 是 Python 的「结构化类型」——它不要求继承，只要求实现类「拥有这些方法签名」。任何类只要实现了 `complete()` 和 `stream()`，就被视为满足 `ModelProvider` 协议，无需显式写成 `class Xxx(ModelProvider)`。这比抽象基类更灵活。

**必须牢记的是：`Protocol` 不会自动生成实现。** 它只是告诉类型检查器：「实现类必须有这些方法」。

**（3）方法体中的 `...`**

这是 Python 的省略号字面量（Ellipsis），这里用作占位符，表示「这个方法只是声明接口，没有具体实现」。

注意 `stream()` 在 Protocol 中使用普通 `def`，因为调用它会立即得到 `AsyncIterator`；具体 Provider 仍然使用 `async def + yield` 实现异步生成器。如果在 Protocol 中写成不含 `yield` 的 `async def`，类型检查器会把它理解为“需要先 await 的协程”，与后面的 `async for` 不匹配。

## 四、第三步：实现 Mock Provider

接下来实现一个 Mock Provider。这个实现非常简单，只是按固定规则返回文本。

创建 `app/providers/mock.py`：

```python
import asyncio
from collections.abc import AsyncIterator

from app.providers.base import ModelProvider, ProviderResult
from app.schemas import ChatMessage


# MockProvider 是模型提供者的实现，继承了 ModelProvider 协议
class MockProvider(ModelProvider):
    # complete 方法，用于完成对话
    async def complete(
        self,
        *,
        messages: list[ChatMessage],
        model: str | None = None,
    ) -> ProviderResult:
        last_user_message = next(
            (message.content for message in reversed(messages) if message.role == "user"),
            "",
        )
        text = f"Mock 回复：我收到了『{last_user_message}』"
        return ProviderResult(
            text=text,
            model=model or "mock-1",
            input_tokens=len(last_user_message),
            output_tokens=len(text),
        )

    # stream 方法，用于流式对话
    async def stream(
        self,
        *,
        messages: list[ChatMessage],
        model: str | None = None,
    ) -> AsyncIterator[str]:
        result = await self.complete(messages=messages, model=model)
        for character in result.text:
            await asyncio.sleep(0.03)
            yield character
```

上面代码中，`complete()` 会找出最后一条用户消息，拼出固定格式的回复；`stream()` 则先拿到完整结果，再逐个字符往外抛。

**（1）`async def` / `await` / `yield`**

本章大量使用了 Python 的异步编程。核心概念可以对照下表：

| 关键字 | 作用 | 所在位置 |
|--------|------|----------|
| `async def` | 定义协程函数 | `async def complete(...)` |
| `await` | 等待一个协程执行完毕，期间让出控制权 | `result = await self.provider.complete(...)` |
| `async for` | 异步迭代，每次迭代都可以让出控制权 | `async for text in self.provider.stream(...)` |
| `yield` | 生成器——函数不一次性返回，而是「产出」一个值后暂停，下次调用时从暂停处继续 | `yield character` |

组合 `async def` + `yield`，就得到**异步生成器**：既能异步等待，又能逐个产出值。`MockProvider.stream()` 就是这样一个异步生成器——它先 `await` 获取完整结果，然后逐个字符 `yield` 出去，每个字符之间停顿 30ms，用来模拟流式效果。

**（2）为什么用异步？**

FastAPI 是异步框架。如果路由函数是同步的，它会在线程池中运行；如果是异步的，它在事件循环中运行，性能更高。对于 I/O 密集型操作（比如调用外部 API），异步可以同时处理多个请求而不阻塞。

`MockProvider` 每次返回相同规则的结果。这样一来，测试不会受模型随机性、网络或余额影响。

注意：Mock 不等于无用代码。它是测试 Agent 系统时最重要的稳定依赖。

## 五、第四步：创建聊天服务

下面演示如何创建一个聊天服务。这个服务负责把请求转发给 Provider，并组装成对外响应。

创建 `app/services.py`：

```python
import time
import uuid

from app.providers.base import ModelProvider
from app.schemas import ChatRequest, ChatResponse


class ChatService:
    def __init__(self, provider: ModelProvider) -> None:
        self.provider = provider

    async def chat(self, request: ChatRequest) -> ChatResponse:
        started_at = time.perf_counter()
        result = await self.provider.complete(
            messages=request.messages,
            model=request.model,
        )
        latency_ms = int((time.perf_counter() - started_at) * 1000)
        return ChatResponse(
            run_id=str(uuid.uuid4()),
            text=result.text,
            model=result.model,
            input_tokens=result.input_tokens,
            output_tokens=result.output_tokens,
            latency_ms=latency_ms,
        )
```

下面解释一下关键点。

**（1）依赖注入 Provider**

`ChatService` 不直接创建某个具体的模型客户端，而是在构造时接收一个 `ModelProvider`。今天传 `MockProvider`，下一课换成真实 Provider，业务层几乎不用改。

**（2）`run_id` 与 `latency_ms`**

`run_id` 不是可有可无的 UUID。后续它用于查询任务状态、Trace、审批和 Replay。`latency_ms` 则记录这次调用耗时，方便后面做观测。

需要说明的是：Token 数字在 Mock Provider 中只是演示；真实 Provider 的 usage 才能用于计费。

## 六、第五步：暴露聊天接口

我们需要新增一个路由来暴露聊天接口。这个路由负责把请求转发给聊天服务，并返回响应。在这个服务里，先传入创建好的 Mock Provider 实例。

最后，`app/main.py` 写成这样：

```python
from fastapi import FastAPI

from app.providers.mock import MockProvider
from app.schemas import ChatRequest, ChatResponse
from app.services import ChatService

app = FastAPI(title="Agent Platform API", version="0.1.0")
# 创建聊天服务，传入 mock provider 实例
chat_service = ChatService(provider=MockProvider())


# 健康检查接口
@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


# 聊天接口
@app.post("/v1/chat", response_model=ChatResponse)
async def chat(request: ChatRequest) -> ChatResponse:
    return await chat_service.chat(request)
```

上面代码中，`POST /v1/chat` 接收 `ChatRequest`，交给 `chat_service.chat()` 处理，再按 `ChatResponse` 返回。

### 6.1 启动服务

启动前，先在 `apps/api` 目录下激活虚拟环境：

```bash
source .venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

重启 `uvicorn` 后，可以在 `/docs` 里调用 `POST /v1/chat`。

### 6.2 用 curl 验证

请求体格式如下：

```json
{
  "messages": [
    {"role": "user", "content": "你好"}
  ]
}
```

也可以直接用 curl：

```bash
curl -X POST http://localhost:8000/v1/chat -H "Content-Type: application/json" -d '{"messages": [{"role": "user", "content": "你好"}]}'
```

预期响应会包含动态 `run_id`，以及类似下面的文本：

```json
{
    "run_id": "b2cef04d-9748-4501-a182-bb433bf7b1fe",
    "text": "Mock 回复：我收到了『你好』",
    "model": "mock-1",
    "input_tokens": 2,
    "output_tokens": 16,
    "latency_ms": 0
}
```

## 七、本课验收

完成本课后，请确认以下四项：

- `POST /v1/chat` 能返回 Mock 回复
- 请求没有 `messages` 时返回 422
- 响应包含 `run_id`、模型和延迟
- 不需要 API Key 就能运行

## 八、小结

这一课我们定义了一套通用的模型提供者接口，并实现了一个 Mock Provider。

通过这个 Mock Provider，你可以在不依赖任何外部 API、不消耗一分钱的情况下，完成后续大多数后端和前端的开发与测试。等接口和流程都跑稳了，下一篇教程将讲解如何接入 OpenAI-compatible 模型服务。

如果你看到了结尾，说明你已经有了一条可测试、可替换的模型调用链路。下一课见。

---
