# 第 4 课：结构化输出和错误边界

> 所属章节：[第 1 章：从零构建 LLM Gateway](./index.md)  
> 上一课：[第 3 课：接入 OpenAI-compatible 模型服务](./lesson-03-openai-compatible-provider.md)  
> 下一课：[第 5 课：实现 SSE 流式接口](./lesson-05-sse-streaming-api.md)  
> [课程代码](https://github.com/ricoNext/agent-platform/tree/chapter-04)

## 一、前言

上一课，我们已经把 OpenAI-compatible Provider 接上了。

改一下环境变量，就能在 Mock 和真实模型之间切换；`POST /v1/chat` 接口也能返回一段普通文本。

事情到这里，好像已经够用了。但做业务时，问题马上会来：

**模型返回的是自然语言，程序需要的是结构化数据。**

举例来说，你希望得到标题、摘要和关键词。

模型可能写得很漂亮，也可能漏字段、多字段，甚至根本不是 JSON。

这时，如果直接把原文塞进下游逻辑，后面每一层都会变得不可靠。

所以今天接着往下讲：先把「结构化输出」这件事做对。

这一课会完成七件事：

1. 用 Pydantic 定义摘要业务的 Schema
2. 写一个不依赖模型的校验函数，把原始文本解析成 `SummaryResult`
3. 让 Mock Provider 稳定返回结构化摘要
4. 在 `ChatService` 中调用 Provider 并解析结果
5. 暴露 `POST /v1/summaries` 接口
6. 为结构化校验保留稳定测试
7. 理解重试边界，但本课不实现自动重试

即使你暂时还在用 Mock Provider，也要把校验和错误处理做完整。建议先跟着例子做一遍，再读文字说明。

## 二、第一步：定义业务 Schema

所谓**结构化输出**，就是要求模型按约定格式返回数据，再用 Schema 校验。

字面上讲，它好像只是「让模型输出 JSON」；但是，更准确的说法是：先约定业务结构，再把模型输出约束进这个结构。

先把 `app/schemas.py` 顶部的 Pydantic 导入改为：

```python
from pydantic import BaseModel, ConfigDict, Field
```

然后在文件末尾加入：

```python
# 摘要请求
class SummaryRequest(BaseModel):
    text: str = Field(min_length=10, max_length=10_000)


# 摘要响应
class SummaryResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1)
    summary: str = Field(min_length=1)
    keywords: list[str] = Field(min_length=1, max_length=5)


# 摘要响应
class SummaryResponse(BaseModel):
    run_id: str
    result: SummaryResult
    model: str
    input_tokens: int | None = None
    output_tokens: int | None = None
    latency_ms: int
```

解释一下上面代码的关键点。

**（1）`SummaryRequest`**

这是接口入参。`text` 最短 10 个字符、最长 10000 个字符，避免空串和超长输入直接打到模型层。

**（2）`SummaryResult`**

这是业务真正关心的结果：标题、摘要、关键词。关键词至少 1 个、最多 5 个。缺字段、空字符串、类型不对或出现协议外字段，都应判定失败。`extra="forbid"` 可以避免模型悄悄增加未经业务确认的数据。

**（3）`SummaryResponse`**

这是对外返回的完整响应。除了 `result`，还带上 `run_id`、模型、Token usage 和耗时。部分兼容服务不返回 usage，此时两个 Token 字段为 `null`，不能自行伪造计费数据。

必须牢记的是：Schema 定义的是「业务结构合法」，不是「看起来像 JSON 就行」。

## 三、第二步：先实现不依赖模型的校验函数

接下来，先不要急着接模型。把「模型返回的原始文本」解析成 `SummaryResult`，这件事可以单独做，也更容易写测试。

创建 `app/structured.py`：

```python
import json

from pydantic import ValidationError

from app.schemas import SummaryResult


# 结构化输出错误
class StructuredOutputError(Exception):
    pass

# 解析摘要
def parse_summary(raw_text: str) -> SummaryResult:
    try:
        payload = json.loads(raw_text)
    except json.JSONDecodeError as error:
        raise StructuredOutputError(
            "model did not return valid JSON"
        ) from error

    try:
        return SummaryResult.model_validate(payload)
    except ValidationError as error:
        raise StructuredOutputError(
            "model JSON does not match SummaryResult"
        ) from error
```

上面代码中，校验分两步。

**（1）`json.loads(raw_text)`**

先判断是不是合法 JSON。如果模型返回普通句子、半截括号、或夹杂解释文字，这里就会失败。

**（2）`SummaryResult.model_validate(payload)`**

再判断业务结构是否合法。即使 JSON 能解析，缺少 `summary`、`keywords` 类型不对，一样会失败。

这两种失败，都统一包装成 `StructuredOutputError`。

对调用方来说，不需要区分「解析挂了」还是「结构不对」的底层异常类型；它只需要知道：这次结构化输出不可用。

需要说明的是：这里故意不依赖真实模型。好处很直接——测试稳定、失败原因清晰，下一步接入 `/v1/summaries` 时可以直接复用同一套校验。

## 四、第三步：让 Mock Provider 返回结构化摘要

默认 Mock Provider 返回普通聊天文本，直接交给 `parse_summary()` 一定会失败。为了让没有 API Key 的同学也能完成本课，需要为摘要任务增加一个确定性 Mock 响应。

在 `app/providers/mock.py` 顶部增加导入：

```python
import json
```

然后把 `complete()` 方法替换为：

```python
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
    is_summary_request = any(
        message.role == "system" and "TASK: summarize_json" in message.content
        for message in messages
    )

    if is_summary_request:
        text = json.dumps(
            {
                "title": "Mock 摘要",
                "summary": last_user_message[:80],
                "keywords": ["mock", "summary"],
            },
            ensure_ascii=False,
        )
    else:
        text = f"Mock 回复：我收到了『{last_user_message}』"

    return ProviderResult(
        text=text,
        model=model or "mock-1",
        input_tokens=len(last_user_message),
        output_tokens=len(text),
    )
```

这里的 `TASK: summarize_json` 是测试夹具标记，只用于让 Mock Provider 识别任务类型。真实 Provider 会接收整段系统提示词，不依赖 Mock 的分支逻辑。

## 五、第四步：在服务层生成并解析摘要

在 `app/services.py` 中扩展 Schema 导入，并引入解析函数：

```python
from app.schemas import (
    ChatMessage,
    ChatRequest,
    ChatResponse,
    SummaryRequest,
    SummaryResponse,
)
from app.structured import parse_summary
```

在 `ChatService` 上方定义摘要提示词：

```python
SUMMARY_SYSTEM_PROMPT = """TASK: summarize_json
请把用户提供的文本总结为严格 JSON，格式如下：
{"title":"标题","summary":"摘要","keywords":["关键词"]}
不要输出 Markdown 代码块或 JSON 之外的解释。
"""
```

然后在 `ChatService` 中增加 `summarize()`：

```python
async def summarize(self, request: SummaryRequest) -> SummaryResponse:
    started_at = time.perf_counter()
    provider_result = await self.provider.complete(
        messages=[
            ChatMessage(role="system", content=SUMMARY_SYSTEM_PROMPT),
            ChatMessage(role="user", content=request.text),
        ],
    )
    result = parse_summary(provider_result.text)
    latency_ms = int((time.perf_counter() - started_at) * 1000)

    return SummaryResponse(
        run_id=str(uuid.uuid4()),
        result=result,
        model=provider_result.model,
        input_tokens=provider_result.input_tokens,
        output_tokens=provider_result.output_tokens,
        latency_ms=latency_ms,
    )
```

`ChatService` 仍然只依赖 `ModelProvider`。Mock 和真实模型走同一个调用入口，区别只在 Provider 返回的原始文本；进入业务层前，都必须经过 `parse_summary()`。

## 六、第五步：暴露摘要接口

更新 `app/main.py` 中的 FastAPI 和 Schema 导入：

```python
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.providers.base import ProviderError
from app.schemas import (
    ChatRequest,
    ChatResponse,
    ErrorResponse,
    SummaryRequest,
    SummaryResponse,
)
from app.structured import StructuredOutputError
```

先把结构化校验错误映射为统一的 `ErrorResponse`，再增加路由：

```python
@app.exception_handler(StructuredOutputError)
async def handle_structured_output_error(
    _request: Request,
    error: StructuredOutputError,
) -> JSONResponse:
    payload = ErrorResponse(
        code="invalid_structured_output",
        message=str(error),
        run_id=str(uuid.uuid4()),
    )
    return JSONResponse(status_code=502, content=payload.model_dump())


@app.post("/v1/summaries", response_model=SummaryResponse)
async def summarize(request: SummaryRequest) -> SummaryResponse:
    return await chat_service.summarize(request)
```

这里使用 `502 Bad Gateway`，因为请求本身已经通过校验，失败发生在上游模型没有按约定返回结构化数据。普通 Provider 错误和结构化校验错误现在都返回 `ErrorResponse`，调用方不需要解析两种错误外壳。

使用 Mock Provider 验证：

```bash
curl --fail-with-body \
  -X POST http://localhost:8000/v1/summaries \
  -H "Content-Type: application/json" \
  -d '{"text":"结构化输出必须先经过 JSON 解析和业务 Schema 校验，才能进入后续业务流程。"}'
```

预期响应结构如下：

```json
{
  "run_id": "动态生成的 UUID",
  "result": {
    "title": "Mock 摘要",
    "summary": "结构化输出必须先经过 JSON 解析和业务 Schema 校验，才能进入后续业务流程。",
    "keywords": ["mock", "summary"]
  },
  "model": "mock-1",
  "input_tokens": 43,
  "output_tokens": 111,
  "latency_ms": 0
}
```

切换到真实 Provider 后，接口调用链保持不变：Provider 生成文本，`parse_summary()` 校验文本，最后组装 `SummaryResponse`。

## 七、第六步：先为校验函数写测试

先为它写测试 `tests/test_structured.py`：

```python
import pytest

from app.structured import StructuredOutputError, parse_summary

# 测试解析摘要 - 接受合法 JSON
def test_parse_summary_accepts_valid_json() -> None:
    result = parse_summary(
        '{"title":"测试","summary":"这是一个有效摘要","keywords":["测试"]}'
    )

    assert result.title == "测试"

# 测试解析摘要 - 拒绝无效 JSON
def test_parse_summary_rejects_invalid_json() -> None:
    with pytest.raises(StructuredOutputError):
        parse_summary("not json")

# 测试解析摘要 - 拒绝错误的形状
def test_parse_summary_rejects_wrong_shape() -> None:
    with pytest.raises(StructuredOutputError):
        parse_summary('{"title":"只有标题"}')


def test_parse_summary_rejects_extra_fields() -> None:
    with pytest.raises(StructuredOutputError):
        parse_summary(
            '{"title":"标题","summary":"摘要","keywords":["测试"],"debug":true}'
        )
```

运行：

```bash
pytest -q
```

这四条测试分别对应四种情况：合法结构通过、非 JSON 失败、缺字段失败、协议外字段失败。

简单说，「JSON 合法」只说明语法过关；「业务结构合法」才说明它能进入下游逻辑。两者不是一回事。

## 八、第七步：理解重试边界

当模型输出不是合法 JSON，或结构对不上 Schema 时，可以进行有限重试：把「校验失败原因」和「只返回 JSON」的约束，再次发送给模型。

最多重试 1 到 2 次。一直失败时，返回业务错误，不要把不完整 JSON 悄悄当成成功。

本节先不实现自动重试，因为还没有稳定的真实模型测试数据。先把「校验失败」作为明确错误，等后面用 Golden Tasks 验证重试策略。

注意：重试是补救，不是默许。如果把坏数据放行，后面的前端展示、数据库写入、工具调用都会一起跟着错。

## 九、本课验收

完成本课后，请确认以下九项：

- 有 Schema
- 合法 JSON 能转成 `SummaryResult`
- 非 JSON、缺字段和错类型都会失败
- Mock Provider 能稳定返回摘要 JSON
- `/v1/summaries` 返回 `SummaryResponse`
- 摘要响应包含 Provider 返回的 Token usage
- 模型输出不符合 Schema 时，接口返回 `502`
- 测试通过
- 你能解释「JSON 合法」和「业务结构合法」的区别

## 十、小结

今天就讲到这里。这一课定义了摘要业务的 Schema，实现了独立的结构化校验，让 Mock Provider 支持确定性摘要，并把 Provider、`parse_summary()` 和 `/v1/summaries` 串成了完整调用链。

模型会说话，不代表它会按契约交付。只有通过业务 Schema 校验的结果，才能作为成功响应返回。自动重试仍然留待有稳定评测数据后再实现，下一篇教程将讲解如何实现 SSE 流式接口。

如果你看到了结尾，说明你已经把「结构化输出」的错误边界立住了。下一课见。

---
