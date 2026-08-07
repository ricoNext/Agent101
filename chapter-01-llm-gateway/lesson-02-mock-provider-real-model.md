# 第 2 课：先接 Mock Provider，再接真实模型

> 所属章节：[第 1 章：从零构建 LLM Gateway](./index.md)  
> 上一课：[第 1 课：建立一个可测试的后端](./lesson-01-build-testable-backend.md)  
> 下一课：[第 3 课：接入 OpenAI-compatible 模型服务](./lesson-03-openai-compatible-provider.md)

上一节我们搭好了 FastAPI 骨架——`GET /health` 能跑通、项目结构就绪、测试框架也装好了。但一个只有健康检查的服务显然还什么都做不了。从本节起，我们要让这个服务真正"接入 LLM"。

不过这里有一个常见的坑：很多人上来就直接接真实模型，结果开发时频繁被限流、欠费、网络波动打断，更麻烦的是模型输出天生带有随机性，写测试根本无法得到确定性结果。所以我们决定**先不接任何真实模型**，而是：

1. 定义一套你自己的 Provider 接口，把"调用模型"这件事从业务代码里抽出来；
2. 实现一个**完全确定的 Mock Provider**——输入相同、输出永远相同。

做完本节后，你就可以在不依赖任何外部 API、不消耗一分钱的情况下，完成后续大多数后端和前端的开发与测试。等接口和流程都跑稳了，下一节再接真实模型。

### 第一步：定义数据协议

为了兼容不同模型，我们需要定义一个通用的数据协议类型

创建 `app/schemas.py`：

```python
from typing import Literal

from pydantic import BaseModel, Field

# 对话信息类型
class ChatMessage(BaseModel):
    # 对话角色
    role: Literal["system", "user", "assistant"]
    content: str = Field(min_length=1)

# 对话请求返回结构
class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1)
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

> **Python 基础：类型注解与 Pydantic**
>
> 本章代码大量使用了 Python 3.10+ 的现代类型语法：
>
> | 语法 | 含义 | 示例 |
> |------|------|------|
> | `name: str` | 声明 name 是字符串类型 | `run_id: str` |
> | `name: int` | 声明 name 是整数类型 | `latency_ms: int` |
> | `name: int \| None = None` | 可以是 int 也可以是 None，默认 None | `input_tokens: int \| None = None` |
> | `name: list[ChatMessage]` | 元素类型为 ChatMessage 的列表 | `messages: list[ChatMessage]` |
> | `name: dict[str, str]` | 键和值都是字符串的字典 | `-> dict[str, str]` |
> | `Literal["a", "b", "c"]` | 只能是这几个字面值之一 | `role: Literal["system", "user", "assistant"]` |
>
> **Pydantic 的 `BaseModel`** 是本章最重要的基础设施。继承了 `BaseModel` 的类会自动获得：
> - **数据校验**：如果传入的数据类型不对或缺少必填字段，直接抛出验证错误（FastAPI 中表现为 422 响应）
> - **序列化**：`.model_dump()` 将对象转为字典，`.model_validate()` 从字典构建对象
> - **JSON Schema 生成**：FastAPI 用它自动生成 `/docs` 接口文档
>
> `Field(min_length=1)` 是 Pydantic 的字段约束，告诉校验器这个字段至少要有 1 个字符。

这里的 `ChatRequest` 是"你的 API 协议"，不是某个模型服务的协议。前端永远调用它；Provider 内部才转换为特定服务的 JSON。

### 第二步：定义 Provider 接口

有了通用的模型之后我们创建一个 Provider 接口，这个接口定义了模型提供者的接口，包括：
- complete 方法，用于完成对话
- stream 方法，用于流式对话

创建目录和文件：

```bash
mkdir -p app/providers
touch app/providers/__init__.py
```

创建 `app/providers/base.py`：

```python
from dataclasses import dataclass
from typing import AsyncIterator, Protocol

from app.schemas import ChatMessage

# ProviderResult 是模型提供者的返回结果，包括：文本、模型、输入和输出 token 数量
@dataclass
class ProviderResult:
    text: str
    model: str
    input_tokens: int | None
    output_tokens: int | None

# ModelProvider 是模型提供者的协议，包括：
# - complete 方法，用于完成对话
# - stream 方法，用于流式对话
class ModelProvider(Protocol):
    async def complete(
        self,
        *,
        messages: list[ChatMessage],
        model: str | None = None,
    ) -> ProviderResult:
        ...

    async def stream(
        self,
        *,
        messages: list[ChatMessage],
        model: str | None = None,
    ) -> AsyncIterator[str]:
        ...
```

> **Python 基础：Protocol、dataclass 与省略号**
>
> `@dataclass` 装饰器自动为类生成 `__init__`、`__repr__` 等方法。原来需要写一堆样板代码的纯数据类，现在只需声明字段即可。对比：
> ```python
> # 没有 dataclass
> class ProviderResult:
>     def __init__(self, text: str, model: str, ...):
>         self.text = text
>         ...
>
> # 有 dataclass —— 一行 @dataclass 搞定上面所有
> ```
>
> `class ModelProvider(Protocol)` 定义了一个**协议类**。Protocol 是 Python 的"结构化类型"——它不要求继承，只要求实现类"拥有这些方法签名"。任何类只要实现了 `complete()` 和 `stream()` 方法，就被视为满足 `ModelProvider` 协议，无需显式 `class Xxx(ModelProvider)`。这比抽象基类更灵活。
>
> 方法体中的 `...` 是 Python 的省略号字面量（Ellipsis），这里用作占位符，表示"这个方法只是声明接口，没有具体实现"。

### 第三步：实现 Mock Provider

接下来我们实现一个 Mock Provider，这个 Provider 的实现非常简单，只是返回一个固定的文本。

创建 `app/providers/mock.py`：

```python
import asyncio
from typing import AsyncIterator

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

> **Python 基础：async/await 与 yield**
>
> 本章大量使用了 Python 的异步编程，核心概念：
>
> | 关键字 | 作用 | 所在位置 |
> |--------|------|----------|
> | `async def` | 定义协程函数 | `async def complete(...)` |
> | `await` | 等待一个协程执行完毕，期间让出控制权 | `result = await self.provider.complete(...)` |
> | `async for` | 异步迭代，每次迭代都可以让出控制权 | `async for text in self.provider.stream(...)` |
> | `yield` | 生成器——函数不一次性返回，而是"产出"一个值后暂停，下次调用时从暂停处继续 | `yield character` |
>
> 组合 `async def` + `yield` = **异步生成器**：既能异步等待，又能逐个产出值。`MockProvider.stream()` 就是一个异步生成器——它先 `await` 获取完整结果，然后逐个字符 `yield` 出去，每个字符之间停顿 30ms 模拟流式效果。
>
> 为什么用异步？FastAPI 是异步框架。如果路由函数是同步的，它会在线程池中运行；如果是异步的，它在事件循环中运行，性能更高。对于 I/O 密集型操作（调用外部 API），异步可以同时处理多个请求而不阻塞。

`MockProvider` 每次返回相同规则的结果。这样测试不会受模型随机性、网络或余额影响。

### 第四步：创建聊天服务

接下来我们创建一个聊天服务，这个服务负责将请求转发给 Provider，并返回响应。

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

### 第五步：暴露聊天接口

我们需要新增一个路由来暴露聊天接口，这个路由负责将请求转发给聊天服务，并返回响应。

在这个服务中我们需要传入创建的 mock provider 实例。

最后 `app/main.py` 的代码如下：

```python
from fastapi import FastAPI

from app.providers.mock import MockProvider
from app.schemas import ChatRequest, ChatResponse
from app.services import ChatService

app = FastAPI(title="Agent Platform API", version="0.1.0")
# 创建聊天服务， 传入 mock provider 实例
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

重启 `uvicorn`，在 `/docs` 调用 `POST /v1/chat`：


```json
{
  "messages": [
    {"role": "user", "content": "你好"}
  ]
}
```

可以直接使用 curl 来访问：
```bash
curl -X POST http://localhost:8000/v1/chat -H "Content-Type: application/json" -d '{"messages": [{"role": "user", "content": "你好"}]}'
```

预期响应会包含动态 `run_id` 和如下文本：

```json
{
    "run_id":"b2cef04d-9748-4501-a182-bb433bf7b1fe",
    "text":"Mock 回复：我收到了『你好』",
    "model":"mock-1",
    "input_tokens":2,
    "output_tokens":16,
    "latency_ms":0
}
```

- `run_id` 不是可有可无的 UUID。后续它用于查询任务状态、Trace、审批和 Replay。
- Token 数字在 Mock Provider 中只是演示，真实 Provider 的 usage 才能用于计费。
- `Protocol` 不会自动生成实现，它只是告诉类型检查器“实现类必须有这些方法”。
- Mock 不等于无用代码。它是测试 Agent 系统时最重要的稳定依赖。

### 本课验收

- `POST /v1/chat` 能返回 Mock 回复；
- 请求没有 `messages` 时返回 422；
- 响应包含 `run_id`、模型和延迟；
- 不需要 API Key 就能运行。


### 本章小结

本章我们学习了如何定义一个通用的模型提供者接口，并实现了一个 Mock Provider。通过这个 Mock Provider，我们可以在不依赖任何外部 API、不消耗一分钱的情况下，完成后续大多数后端和前端的开发与测试。等接口和流程都跑稳了，下一节再接真实模型。

---
