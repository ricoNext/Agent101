# 第 3 课：接入 OpenAI-compatible 模型服务

> 所属章节：[第 1 章：从零构建 LLM Gateway](./index.md)  
> 上一课：[第 2 课：先接 Mock Provider，再接真实模型](./lesson-02-mock-provider-real-model.md)  
> 下一课：[第 4 课：结构化输出和错误边界](./lesson-04-structured-output-error-boundary.md)  
> [课程代码](https://github.com/ricoNext/agent-platform/tree/chapter-01)

## 一、前言

上一课，我们已经把 `ModelProvider` 接口、`MockProvider` 和 `ChatService` 跑通了。`POST /v1/chat` 能稳定返回 Mock 回复，测试也不依赖任何外部 API。

今天接着往下讲：把 Mock 换成真实模型服务。

## 二、明确本课的协议边界

如果你想了解 OpenAI、Anthropic、Gemini、MCP 和 A2A 的区别，先阅读基础知识专栏：

- [同一个模型，为什么有多种 API？](/foundations/ai-protocols)

本课只关注 OpenAI-compatible Chat Completions 的工程实现。它在当前模型服务生态中兼容面较广，足以演示 Provider 抽象、流式响应和配置切换。

后续接入其他原生协议时，可以沿用同一个 `ModelProvider` 接口，为每种协议增加独立实现。

不过，在接入之前，有三件事需要先想清楚。

**（1）配置不能写死在代码里。**

本地、测试、生产环境的模型地址和密钥各不相同，API Key 更不能提交到 Git。

**（2）各家协议大同小异。**

OpenAI、DeepSeek、各类中转、本地 vLLM / Ollama 等，大多兼容同一套 Chat Completions 协议。没必要为每家单独写一个 Provider。

**（3）切换 Provider 不应改业务代码。**

`ChatService` 和路由层只依赖 `ModelProvider` 接口。换模型，应该是改配置，而不是改代码。

下面，我们就按这个思路来做：用 `pydantic-settings` 从 `.env` 读取配置，实现一个通用的 `OpenAICompatibleProvider`，再用工厂函数按 `MODEL_PROVIDER` 选择 Mock 或真实服务。

需要说明的是：没有 API Key 的同学，可以继续用 `MODEL_PROVIDER=mock`，课程不会被阻塞。有 Key 的同学，改几个环境变量、重启服务，就能从 Mock 切到真实模型。

建议先跟着例子做一遍，再读文字说明。

## 三、第一步：加入配置

首先，创建 `app/config.py`：

```python
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    model_provider: str = "mock"
    model_base_url: str = ""
    model_api_key: str = ""
    model_name: str = "mock-1"
    model_timeout_seconds: float = 30.0


@lru_cache
def get_settings() -> Settings:
    return Settings()
```

下面解释一下上面代码的关键点。

**（1）`pydantic-settings` 的 `BaseSettings`**

所谓 **pydantic-settings**，就是专门用来管理应用配置的库。它会自动从环境变量和 `.env` 文件读取配置。命名规则很简单：类属性 `model_provider` 对应环境变量 `MODEL_PROVIDER`（自动转大写）。

`SettingsConfigDict(env_file=".env", extra="ignore")` 指定从 `.env` 文件加载，并忽略未定义的额外环境变量。

**（2）`@lru_cache`**

`@lru_cache` 是 `functools` 提供的装饰器，意思是「最近最少使用缓存」。用在 `get_settings()` 上，表示第一次调用时创建 `Settings` 对象并缓存，后续调用直接返回缓存结果。好处是整个应用共享同一份配置，不会反复读取 `.env` 文件。

接着，创建 `.env.example`：

```text
MODEL_PROVIDER=mock
MODEL_BASE_URL=https://your-provider.example/v1
MODEL_API_KEY=replace-me
MODEL_NAME=replace-me
MODEL_TIMEOUT_SECONDS=30
```

把 `.env` 加入 `.gitignore`：

```text
.venv/
__pycache__/
.pytest_cache/
.env
```

**必须牢记的是：真实 API Key 绝不能提交到 Git。** `.env` 只留在本机；仓库里只保留 `.env.example` 作为模板。

最后，复制一份配置文件：

```bash
cp .env.example .env
```

## 四、第二步：实现 Provider

这一节就来看看，如何实现真正调用模型服务的 Provider。

创建 `app/providers/openai_compatible.py`：

```python
from typing import Any, AsyncIterator

import httpx

from app.providers.base import ProviderResult
from app.schemas import ChatMessage


class OpenAICompatibleProvider:
    def __init__(
        self,
        *,
        base_url: str,
        api_key: str,
        default_model: str,
        timeout_seconds: float,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.default_model = default_model
        self.timeout_seconds = timeout_seconds

    def _payload(
        self,
        messages: list[ChatMessage],
        model: str | None,
        stream: bool,
    ) -> dict[str, Any]:
        return {
            "model": model or self.default_model,
            "messages": [message.model_dump() for message in messages],
            "stream": stream,
        }

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    async def complete(
        self,
        *,
        messages: list[ChatMessage],
        model: str | None = None,
    ) -> ProviderResult:
        async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
            response = await client.post(
                f"{self.base_url}/chat/completions",
                headers=self._headers(),
                json=self._payload(messages, model, stream=False),
            )
            response.raise_for_status()
            body = response.json()

        choices = body.get("choices", [])
        if not choices:
            raise ValueError("provider response does not contain choices")
        text = choices[0].get("message", {}).get("content")
        if not isinstance(text, str):
            raise ValueError("provider response does not contain message content")

        usage = body.get("usage", {})
        return ProviderResult(
            text=text,
            model=body.get("model", model or self.default_model),
            input_tokens=usage.get("prompt_tokens"),
            output_tokens=usage.get("completion_tokens"),
        )

    async def stream(
        self,
        *,
        messages: list[ChatMessage],
        model: str | None = None,
    ) -> AsyncIterator[str]:
        async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
            async with client.stream(
                "POST",
                f"{self.base_url}/chat/completions",
                headers=self._headers(),
                json=self._payload(messages, model, stream=True),
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line.startswith("data: "):
                        continue
                    data = line.removeprefix("data: ")
                    if data == "[DONE]":
                        return
                    chunk = __import__("json").loads(data)
                    delta = chunk.get("choices", [{}])[0].get("delta", {})
                    text = delta.get("content")
                    if isinstance(text, str) and text:
                        yield text
```

上面代码中，`complete()` 发一次非流式请求，取出 `choices[0].message.content`；`stream()` 则按 SSE 行解析，逐段 `yield` 文本。

**（1）为什么叫 OpenAI-compatible？**

简单说，很多模型服务都提供与 OpenAI 类似的 `/v1/chat/completions` 接口。你写一套适配代码，就能对接多家服务，而不必为每家单独写一个 Provider。

**（2）这段实现只支持最小流式格式**

真实服务可能有不同字段。所以切换 Provider 时，建议先用一条普通请求检查响应，再按需扩展适配器。

注意：`stream()` 里用 `__import__("json").loads(data)` 是为了少写一行 import；实际项目里更常见的写法是文件顶部 `import json`。两种都可以，关键是解析逻辑要对。

## 五、第三步：根据配置创建 Provider

配置和 Provider 都有了，下面演示如何把它们串起来。

创建 `app/providers/factory.py`：

```python
from app.config import Settings
from app.providers.base import ModelProvider
from app.providers.mock import MockProvider
from app.providers.openai_compatible import OpenAICompatibleProvider


def create_provider(settings: Settings) -> ModelProvider:
    if settings.model_provider == "mock":
        return MockProvider()

    if settings.model_provider == "openai_compatible":
        if not settings.model_base_url or not settings.model_api_key:
            raise ValueError("MODEL_BASE_URL and MODEL_API_KEY are required")
        return OpenAICompatibleProvider(
            base_url=settings.model_base_url,
            api_key=settings.model_api_key,
            default_model=settings.model_name,
            timeout_seconds=settings.model_timeout_seconds,
        )

    raise ValueError(f"unsupported MODEL_PROVIDER: {settings.model_provider}")
```

所谓**工厂函数（factory）**，就是根据配置决定「创建哪一个实现」。业务层只认 `ModelProvider`，不关心背后是 Mock 还是真实服务。

把 `app/main.py` 改为：

```python
from fastapi import FastAPI

from app.config import get_settings
from app.providers.factory import create_provider
from app.schemas import ChatRequest, ChatResponse
from app.services import ChatService

app = FastAPI(title="Agent Platform API", version="0.1.0")
settings = get_settings()
chat_service = ChatService(provider=create_provider(settings))


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "provider": settings.model_provider}


@app.post("/v1/chat", response_model=ChatResponse)
async def chat(request: ChatRequest) -> ChatResponse:
    return await chat_service.chat(request)
```

上面代码中，启动时通过 `create_provider(settings)` 注入 Provider；`/health` 还会返回当前使用的 `provider`，方便确认到底切没切过去。

## 六、切换到真实服务

至此，代码部分就完成了。要切换到真实模型，只需修改 `.env`：

```text
MODEL_PROVIDER=openai_compatible
MODEL_BASE_URL=https://你的服务地址/v1
MODEL_API_KEY=你的密钥
MODEL_NAME=你的模型名
```

然后重启 `uvicorn`。如果失败，按下面顺序排查：

1. URL 是否已经包含或不应包含 `/v1`
2. API Key 是否有多余空格
3. 模型名称是否存在
4. Provider 是否真的兼容 `/chat/completions`
5. 返回体是否包含 `choices[0].message.content`

需要强调一下：不要把真实 Key 粘贴到截图、代码或 Git 提交中。

## 七、本课验收

完成本课后，请确认以下四项：

- `.env` 已加入 `.gitignore`，本地可用 `MODEL_PROVIDER=mock` 继续开发
- `create_provider` 能按配置返回 Mock 或 OpenAI-compatible Provider
- `/health` 能返回当前 `provider`
- 有 Key 时，改环境变量即可切到真实模型，无需改业务代码

## 八、小结

今天就讲到这里。这一课我们做了三件事：用 `.env` 管理模型配置，实现 OpenAI-compatible 的 Provider，再用工厂函数按配置选择 Mock 或真实服务。

改环境变量就能切换 Provider，业务代码一行不用动。下一篇教程将讲解结构化输出和错误边界。

如果你看到了结尾，说明你已经把「可替换的真实模型接入」这一环接上了。下一课见。

---
