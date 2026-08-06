# 第 3 课：接入 OpenAI-compatible 模型服务

> 所属章节：[第 1 章：从零构建 LLM Gateway](./index.md)  
> 上一课：[第 2 课：先接 Mock Provider，再接真实模型](./lesson-02-mock-provider-real-model.md)  
> 下一课：[第 4 课：结构化输出和错误边界](./lesson-04-structured-output-error-boundary.md)

### 你将完成什么

通过环境变量接入一个兼容 Chat Completions 协议的模型服务。没有 API Key 的同学可继续使用 Mock Provider，课程不被阻塞。

### 第一步：加入配置

创建 `app/config.py`：

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

> **Python 基础：`@lru_cache` 与 pydantic-settings**
>
> `@lru_cache` 是 `functools` 提供的装饰器，表示"最近最少使用缓存"。用在 `get_settings()` 上意味着：第一次调用时创建 `Settings` 对象并缓存，后续调用直接返回缓存的结果。好处是整个应用共享同一份配置，不会反复读取 `.env` 文件。
>
> `pydantic-settings` 的 `BaseSettings` 自动从环境变量和 `.env` 文件读取配置。命名规则：类属性 `model_provider` 对应环境变量 `MODEL_PROVIDER`（自动转大写）。`SettingsConfigDict(env_file=".env", extra="ignore")` 指定从 `.env` 文件加载，并忽略未定义的额外环境变量。

创建 `.env.example`：

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

复制配置文件：

```bash
cp .env.example .env
```

### 第二步：实现 Provider

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

这段代码特意只支持最小的 Chat Completions 流式格式。真实服务可能有不同字段，因此切换 Provider 时先用一条普通请求检查响应，再扩展适配器。

### 第三步：根据配置创建 Provider

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

### 切换到真实服务

修改 `.env`：

```text
MODEL_PROVIDER=openai_compatible
MODEL_BASE_URL=https://你的服务地址/v1
MODEL_API_KEY=你的密钥
MODEL_NAME=你的模型名
```

重启 `uvicorn`。如果失败，按顺序检查：

1. URL 是否已经包含或不应包含 `/v1`；
2. API Key 是否有多余空格；
3. 模型名称是否存在；
4. Provider 是否真的兼容 `/chat/completions`；
5. 返回体是否包含 `choices[0].message.content`。

不要把真实 Key 粘贴到截图、代码或 Git 提交中。

---
