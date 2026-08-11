# 第 3 课：接入 OpenAI-compatible 模型服务

> 所属章节：[第 1 章：从零构建 LLM Gateway](./index.md)  
> 上一课：[第 2 课：先接 Mock Provider，再接真实模型](./lesson-02-mock-provider-real-model.md)  
> 下一课：[第 4 课：结构化输出和错误边界](./lesson-04-structured-output-error-boundary.md)  
> [课程代码](https://github.com/ricoNext/agent-platform/tree/chapter-03)

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
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


# 配置类
class Settings(BaseSettings):
    # 获取配置字段
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    model_provider: Literal["mock", "openai_compatible"] = "mock"
    model_base_url: str = ""
    model_api_key: str = ""
    model_name: str = "mock-1"
    model_timeout_seconds: float = 30.0


# 缓存配置
@lru_cache
def get_settings() -> Settings:
    return Settings()
```

解释一下上面代码的关键点。

**（1）`pydantic-settings` 的 `BaseSettings`**

所谓 **pydantic-settings**，就是专门用来管理应用配置的库。它会自动从环境变量和 `.env` 文件读取配置。命名规则很简单：类属性 `model_provider` 对应环境变量 `MODEL_PROVIDER`（自动转大写）。

`SettingsConfigDict(env_file=".env", extra="ignore")` 指定从 `.env` 文件加载，并忽略未定义的额外环境变量。

**（2）`@lru_cache`**

`@lru_cache` 是 `functools` 提供的装饰器，意思是「最近最少使用缓存」。用在 `get_settings()` 上，表示第一次调用时创建 `Settings` 对象并缓存，后续调用直接返回缓存结果。好处是整个应用共享同一份配置，不会反复读取 `.env` 文件。

接着，在 `apps/api` 根目录创建 `.env.example`，让它和 `requirements.txt`、`pytest.ini` 同级。不要把它放进 `app/`，因为课程中的启动命令会从 `apps/api` 读取 `.env`：

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

创建 `app/providers/openai_compatible.py`。为了便于理解，我们按功能逐段实现。

### 1. 导入依赖

先导入类型、HTTP 客户端，以及项目中已经定义好的 Provider 结果和消息模型：

```python
import json
from collections.abc import AsyncIterator
from typing import Any

import httpx

# 导入基础Provider
from app.providers.base import ProviderError, ProviderResult
# 导入消息模型
from app.schemas import ChatMessage
```

### 2. 定义 Provider 和初始化配置

Provider 需要知道模型服务的地址、API Key、默认模型和请求超时时间：

```python
# 定义OpenAICompatible 协议类型的Provider
class OpenAICompatibleProvider:
    # 初始化配置
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
```

这里用 `rstrip("/")` 去掉基础地址末尾可能存在的 `/`，避免拼接接口路径时出现双斜杠。

### 3. 构造请求体和请求头

非流式请求和流式请求的请求体结构基本一致，只有 `stream` 字段不同。因此可以抽出一个 `_payload()` 方法统一构造：

```python
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
```

再单独封装请求头：

```python
    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
```

### 4. 实现非流式调用

`complete()` 发送一次普通请求，读取响应中的 `choices[0].message.content`，再转换成项目内部统一的 `ProviderResult`：

```python
   # 非流式请求
    async def complete(
        self,
        *,
        messages: list[ChatMessage],
        model: str | None = None,
    ) -> ProviderResult:
        try:
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
            usage = body.get("usage") or {}
            if not isinstance(usage, dict):
                usage = {}

            returned_model = body.get("model")
            if not isinstance(returned_model, str):
                returned_model = model or self.default_model

            return ProviderResult(
                text=text,
                model=returned_model,
                input_tokens=usage.get("prompt_tokens"),
                output_tokens=usage.get("completion_tokens"),
            )
        except httpx.TimeoutException as error:
            raise ProviderError("provider_timeout", "模型服务响应超时") from error
        except httpx.RequestError as error:
            raise ProviderError(
                "provider_network_error",
                "无法连接模型服务",
            ) from error
        except httpx.HTTPStatusError as error:
            raise ProviderError(
                "provider_http_error",
                f"模型服务返回 HTTP {error.response.status_code}",
            ) from error
        except (AttributeError, IndexError, TypeError, ValueError) as error:
            raise ProviderError(
                "invalid_provider_response",
                "模型服务返回了无法识别的数据",
            ) from error
```

这里的两个校验很重要：如果服务没有返回 `choices`，或者消息内容不是字符串，就主动抛出异常，而不是让错误数据继续传到业务层。

### 5. 实现流式调用

`stream()` 使用 HTTPX 的流式接口读取 SSE 响应。每一行以 `data: ` 开头时，解析其中的 JSON，并逐段返回文本：

```python
    # 流式请求
    async def stream(
        self,
        *,
        messages: list[ChatMessage],
        model: str | None = None,
    ) -> AsyncIterator[str]:
        try:
            async with (
                httpx.AsyncClient(timeout=self.timeout_seconds) as client,
                client.stream(
                    "POST",
                    f"{self.base_url}/chat/completions",
                    headers=self._headers(),
                    json=self._payload(messages, model, stream=True),
                ) as response,
            ):
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line.startswith("data: "):
                        continue
                    data = line.removeprefix("data: ")
                    if data == "[DONE]":
                        return
                    chunk = json.loads(data)
                    choices = chunk.get("choices") or []
                    if not choices:
                        continue
                    delta = choices[0].get("delta", {})
                    text = delta.get("content")
                    if isinstance(text, str) and text:
                        yield text
        except httpx.TimeoutException as error:
            raise ProviderError("provider_timeout", "模型服务响应超时") from error
        except httpx.RequestError as error:
            raise ProviderError(
                "provider_network_error",
                "无法连接模型服务",
            ) from error
        except httpx.HTTPStatusError as error:
            raise ProviderError(
                "provider_http_error",
                f"模型服务返回 HTTP {error.response.status_code}",
            ) from error
        except (AttributeError, IndexError, TypeError, ValueError) as error:
            raise ProviderError(
                "invalid_provider_response",
                "模型服务返回了无法识别的数据",
            ) from error
```

这一部分的核心是识别 `[DONE]` 结束标记，并从每个数据块的 `choices[0].delta.content` 中取出新增文本。

**（1）为什么叫 OpenAI-compatible？**

简单说，很多模型服务都提供与 OpenAI 类似的 `/v1/chat/completions` 接口。你写一套适配代码，就能对接多家服务，而不必为每家单独写一个 Provider。

**（2）这段实现只支持最小流式格式**

真实服务可能有不同字段。所以切换 Provider 时，建议先用一条普通请求检查响应，再按需扩展适配器。

流式响应偶尔会出现不含 `choices` 的统计或控制事件，因此先检查列表是否为空，再读取第一个增量。JSON 解析失败、超时和 HTTP 错误都不应该在 Provider 中伪装成正常文本；它们会继续抛给上层，由第四、第五课的错误边界转换为明确失败。

## 五、第三步：根据配置创建 Provider

配置和 Provider 都有了，下面演示如何把它们串起来。

创建 `app/providers/factory.py`：

```python
from app.config import Settings
from app.providers.base import ModelProvider
from app.providers.mock import MockProvider
from app.providers.openai_compatible import OpenAICompatibleProvider


def create_provider(settings: Settings) -> ModelProvider:
    # 如果模型提供者为 mock，则返回 MockProvider
    if settings.model_provider == "mock":
        return MockProvider()

    # 如果模型提供者为 openai_compatible，则返回 OpenAICompatibleProvider
    if settings.model_provider == "openai_compatible":
        # 如果模型基础URL或API密钥为空，则抛出异常
        if not settings.model_base_url or not settings.model_api_key:
            raise ValueError("MODEL_BASE_URL and MODEL_API_KEY are required")
        # 返回 OpenAICompatibleProvider
        return OpenAICompatibleProvider(
            base_url=settings.model_base_url,
            api_key=settings.model_api_key,
            default_model=settings.model_name,
            timeout_seconds=settings.model_timeout_seconds,
        )
    # 如果模型提供者为其他值，则抛出异常
    raise ValueError(f"unsupported MODEL_PROVIDER: {settings.model_provider}")
```

所谓**工厂函数（factory）**，就是根据配置决定「创建哪一个实现」。业务层只认 `ModelProvider`，不关心背后是 Mock 还是真实服务。

把 `app/main.py` 改为：

```python
import logging
import uuid

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.providers.base import ProviderError
from app.providers.factory import create_provider
from app.schemas import ChatRequest, ChatResponse, ErrorResponse
from app.services import ChatService

logger = logging.getLogger(__name__)

app = FastAPI(title="Agent Platform API", version="0.1.0")
settings = get_settings()
chat_service = ChatService(provider=create_provider(settings))


@app.exception_handler(ProviderError)
async def handle_provider_error(
    _request: Request,
    error: ProviderError,
) -> JSONResponse:
    run_id = str(uuid.uuid4())
    logger.error(
        "provider call failed",
        extra={"run_id": run_id, "error_code": error.code},
        exc_info=(type(error), error, error.__traceback__),
    )
    payload = ErrorResponse(
        code=error.code,
        message=error.message,
        run_id=run_id,
    )
    return JSONResponse(status_code=502, content=payload.model_dump())


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "provider": settings.model_provider}


@app.post("/v1/chat", response_model=ChatResponse)
async def chat(request: ChatRequest) -> ChatResponse:
    return await chat_service.chat(request)
```

上面代码中，启动时通过 `create_provider(settings)` 注入 Provider；`/health` 还会返回当前使用的 `provider`，方便确认到底切没切过去。

`ProviderError` 统一映射为 `502` 和 `ErrorResponse`。返回给客户端的 `run_id` 同时写入服务端日志，用于关联本次失败；底层异常只进入服务端日志，不把响应体或密钥信息暴露给调用方。

## 六、第四步：同步更新 health 测试

第 1 课写的 `tests/test_health.py`，断言的是：

```python
assert response.json() == {"status": "ok"}
```

现在 `/health` 多返回了 `provider` 字段。若不改测试，直接跑
`pytest` 会失败——这正是测试该做的事：接口契约变了，旧断言立刻报警。

把 `tests/test_health.py` 改成：

```python
from fastapi.testclient import TestClient

from app.main import app


def test_health_returns_ok() -> None:
    client = TestClient(app)

    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "provider": "mock"}
```

这里断言 `provider` 为 `"mock"`，是因为默认配置（以及本课推荐的本地
`.env`）使用 `MODEL_PROVIDER=mock`。测试不依赖真实 API Key，也不该去连外部
模型服务。

改完后运行：

```bash
pytest -q
```

预期结果至少包含 health 这条通过。若你本地 `.env` 已经改成
`openai_compatible`，先改回 `mock` 再跑测试，或临时用环境变量覆盖：

```bash
MODEL_PROVIDER=mock pytest -q
```

注意：`get_settings()` 用了 `@lru_cache`。若同一次 Python 进程里先读过别的
配置，缓存可能还在。用 `pytest` 时通常是新进程，一般没问题；若在交互环境里改
`.env` 后测不准，重启进程即可。

## 七、切换到真实服务

至此，代码部分就完成了。要切换到真实模型，只需修改 `.env`：

```text
MODEL_PROVIDER=openai_compatible
MODEL_BASE_URL=https://你的服务地址/v1
MODEL_API_KEY=你的密钥
MODEL_NAME=你的模型名
```

然后重启 `uvicorn`。如果失败，按下面顺序排查：

> 还记得如何启动服务吗？

```bash
# 每次新开一个终端、要跑这个项目时执行一次   用来激活虚拟环境
source .venv/bin/activate
# 启动服务
uvicorn app.main:app --reload --port 8000
```

1. URL 是否已经包含或不应包含 `/v1`
2. API Key 是否有多余空格
3. 模型名称是否存在
4. Provider 是否真的兼容 `/chat/completions`
5. 返回体是否包含 `choices[0].message.content`

需要强调一下：不要把真实 Key 粘贴到截图、代码或 Git 提交中。

## 八、验证 `/v1/chat`

服务启动后，先确认 `/health` 正常：

```bash
curl http://localhost:8000/health
```

使用 Mock Provider 时，预期返回：

```json
{
  "status": "ok",
  "provider": "mock"
}
```

接着发送一条聊天请求：

```bash
curl --fail-with-body \
  -X POST http://localhost:8000/v1/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {
        "role": "user",
        "content": "请用一句话介绍自己"
      }
    ]
  }'
```

预期响应至少包含以下字段：

```json
{
  "run_id": "动态生成的 UUID",
  "text": "Mock 回复：我收到了『请用一句话介绍自己』",
  "model": "mock-1",
  "input_tokens": 9,
  "output_tokens": 16,
  "latency_ms": 0
}
```

其中 `run_id`、Token 数量和延迟可能因实现不同而变化，重点检查：

- HTTP 状态码为 `200`
- `run_id` 不为空
- `text` 不为空
- `model` 与当前配置一致
- `latency_ms` 大于或等于 `0`

如果要验证真实模型，只需要修改 `.env` 并重启服务：

```text
MODEL_PROVIDER=openai_compatible
MODEL_BASE_URL=https://你的服务地址/v1
MODEL_API_KEY=你的密钥
MODEL_NAME=你的模型名
```

再次执行同一条 `curl` 命令。此时 `/health` 中的 `provider` 应变为
`openai_compatible`，响应中的 `text` 也应来自真实模型。

最后，验证请求校验是否生效。缺少必填的 `messages` 字段时，应返回
`422 Unprocessable Entity`：

```bash
curl -i \
  -X POST http://localhost:8000/v1/chat \
  -H "Content-Type: application/json" \
  -d '{}'
```

## 九、本课验收

完成本课后，请确认以下六项：

- `.env` 已加入 `.gitignore`，本地可用 `MODEL_PROVIDER=mock` 继续开发
- `create_provider` 能按配置返回 Mock 或 OpenAI-compatible Provider
- `/health` 能返回当前 `provider`
- Provider 超时、HTTP 错误和非法响应会返回脱敏的 `502`
- `tests/test_health.py` 已同步断言 `provider`，`pytest -q` 通过
- 有 Key 时，改环境变量即可切到真实模型，无需改业务代码

## 十、小结

今天就讲到这里。这一课我们做了四件事：用 `.env` 管理模型配置，实现
OpenAI-compatible 的 Provider，用工厂函数按配置选择 Mock 或真实服务，并同步
更新了 `/health` 的自动化测试。

改环境变量就能切换 Provider，业务代码一行不用动。下一篇教程将讲解结构化输出和错误边界。

如果你看到了结尾，说明你已经把「可替换的真实模型接入」这一环接上了。下一课见。

---
