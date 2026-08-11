# 第 6 课：建立 Structured Output 错误边界

> 所属章节：[第一章：LLM API、Prompt、Structured Output 与 Gateway](./index.md)  
> 上一课：[第 5 课：管理 Prompt 模板与版本](./lesson-05-prompt-management.md)  
> 下一课：[第 7 课：实现可靠性策略与模型路由](./lesson-07-reliability-routing.md)  
> [参考代码基线](https://github.com/ricoNext/agent-platform/tree/chapter-04)

## 一、前言

前两课，我们已经接入 OpenAI-compatible Provider，并把 Prompt 从业务代码中独立出来。

改一下环境变量，就能在 Mock 和真实模型之间切换；`POST /v1/chat` 接口也能返回一段普通文本。

事情到这里，好像已经够用了。但做业务时，问题马上会来：

**模型返回的是自然语言，程序需要的是结构化数据。**

举例来说，你希望得到标题、摘要和关键词。

模型可能写得很漂亮，也可能漏字段、多字段，甚至根本不是 JSON。

这时，如果直接把原文塞进下游逻辑，后面每一层都会变得不可靠。

所以今天接着往下讲：先把「结构化输出」这件事做对。

这一课会完成九件事：

1. 用 Pydantic 定义摘要业务的 Schema
2. 写一个不依赖模型的校验函数，把原始文本解析成 `SummaryResult`
3. 让 Mock Provider 稳定返回结构化摘要
4. 在 `ChatService` 中调用 Provider 并解析结果
5. 暴露 `POST /v1/summaries` 接口
6. 比较 Prompt JSON、模型原生 Structured Output 与工具强制结构化
7. 对校验失败执行一次有边界的纠错重试
8. 重试耗尽后进入明确的降级、缓存或人工处理状态
9. 为 Schema 增加版本并定义兼容规则

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
    schema_version: str = "summary.v1"
    result: SummaryResult
    model: str
    prompt_id: str
    prompt_version: str
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

这是对外返回的完整响应。除了 `result`，还带上 `schema_version`、`run_id`、模型、Prompt ID、Prompt 版本、Token usage 和耗时。部分兼容服务不返回 usage，此时两个 Token 字段为 `null`，不能自行伪造计费数据。

必须牢记的是：Schema 定义的是「业务结构合法」，不是「看起来像 JSON 就行」。

### 2.1 三种结构化方式

| 方式 | 约束发生在哪里 | 优点 | 风险与边界 |
| --- | --- | --- | --- |
| Prompt 要求 JSON | 模型指令 | 兼容面最广 | 只能引导，仍可能输出非法 JSON |
| 原生 Structured Output | Provider 推理接口 | 模型生成阶段受 JSON Schema 约束 | 厂商字段不同，部分模型不支持 |
| 工具参数强制结构化 | Function Calling 参数 | 参数通常按 Schema 生成 | 属于工具调用语义，第二章再接入 Runtime |

支持原生 Structured Output 的 Adapter，应把 Pydantic Schema 转成 JSON Schema：

```python
summary_json_schema = SummaryResult.model_json_schema()
```

然后根据能力矩阵映射到厂商请求。例如部分 OpenAI-compatible 服务使用：

```python
payload["response_format"] = {
    "type": "json_schema",
    "json_schema": {
        "name": "summary_v1",
        "strict": True,
        "schema": summary_json_schema,
    },
}
```

这段字段不能无条件发送。Adapter 必须先检查当前模型是否声明 `structured_output=true`；不支持时回退到 Prompt JSON，但无论使用哪种生成方式，返回结果都必须再经过同一个 Pydantic 校验。模型原生约束降低失败率，不能替代业务校验。

工具参数也能强制模型生成结构，但第一章不为此引入 Tool Runtime。这里先理解职责边界：Structured Output 解决“模型返回什么业务数据”，Function Calling 解决“模型请求执行哪个工具”。不能为了得到 JSON，提前把普通业务响应伪装成工具执行。

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

同时从 `app.schemas` 导入 `GenerationConfig`，然后把 `complete()` 方法替换为：

```python
async def complete(
    self,
    *,
    messages: list[ChatMessage],
    model: str | None = None,
    generation: GenerationConfig | None = None,
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
from app.prompts import prompt_registry
from app.schemas import ChatRequest, ChatResponse, SummaryRequest, SummaryResponse
from app.structured import parse_summary
```

使用上一课建立的 Prompt Registry，在 `ChatService` 中增加 `summarize()`：

```python
async def summarize(self, request: SummaryRequest) -> SummaryResponse:
    started_at = time.perf_counter()
    rendered_prompt = prompt_registry.render(
        "summary.basic",
        "1.0.0",
        source_text=request.text,
    )
    provider_result = await self.provider.complete(
        messages=rendered_prompt.messages,
    )
    result = parse_summary(provider_result.text)
    latency_ms = int((time.perf_counter() - started_at) * 1000)

    return SummaryResponse(
        run_id=str(uuid.uuid4()),
        result=result,
        model=provider_result.model,
        prompt_id=rendered_prompt.prompt_id,
        prompt_version=rendered_prompt.version,
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
  "schema_version": "summary.v1",
  "result": {
    "title": "Mock 摘要",
    "summary": "结构化输出必须先经过 JSON 解析和业务 Schema 校验，才能进入后续业务流程。",
    "keywords": ["mock", "summary"]
  },
  "model": "mock-1",
  "prompt_id": "summary.basic",
  "prompt_version": "1.0.0",
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

## 八、第七步：实现有边界的纠错重试

只有 Structured Output 校验失败时才进入纠错；超时、429 和 5xx 由下一课的 Provider 可靠性策略处理。两层不能各自无限重试，否则一次请求会产生不可控的调用次数。

在 `app/services.py` 中增加一个结构化调用结果，并用下面的方法替换原来的单次生成逻辑：

```python
from dataclasses import dataclass

from app.schemas import ChatMessage, GenerationConfig, SummaryResult
from app.structured import StructuredOutputError, parse_summary


@dataclass(frozen=True)
class StructuredSummaryCall:
    result: SummaryResult
    model: str
    input_tokens: int | None
    output_tokens: int | None
    retry_count: int


async def generate_summary(
    self,
    messages: list[ChatMessage],
    *,
    max_attempts: int = 2,
) -> StructuredSummaryCall:
    if max_attempts < 1 or max_attempts > 2:
        raise ValueError("structured output attempts must be between 1 and 2")

    working_messages = list(messages)
    input_usages: list[int | None] = []
    output_usages: list[int | None] = []
    last_error: StructuredOutputError | None = None

    for attempt in range(1, max_attempts + 1):
        provider_result = await self.provider.complete(
            messages=working_messages,
            generation=GenerationConfig(
                temperature=0,
                top_p=1,
                max_output_tokens=512,
            ),
        )
        input_usages.append(provider_result.input_tokens)
        output_usages.append(provider_result.output_tokens)

        try:
            result = parse_summary(provider_result.text)
            return StructuredSummaryCall(
                result=result,
                model=provider_result.model,
                input_tokens=(
                    sum(input_usages) if all(v is not None for v in input_usages) else None
                ),
                output_tokens=(
                    sum(output_usages)
                    if all(v is not None for v in output_usages)
                    else None
                ),
                retry_count=attempt - 1,
            )
        except StructuredOutputError as error:
            last_error = error
            if attempt == max_attempts:
                break
            working_messages.append(
                ChatMessage(
                    role="user",
                    content=(
                        "上一次输出未通过 SummaryResult 校验："
                        f"{error}。只返回符合 summary.v1 的 JSON，"
                        "不要添加 Markdown 代码围栏或解释文字。"
                    ),
                )
            )

    raise StructuredOutputError(
        f"structured output failed after {max_attempts} attempts: {last_error}"
    )
```

这个实现刻意限制为“首次生成 + 一次纠错”。重试参数固定为低随机性；Token usage 统计包含全部尝试，只要任一次 usage 缺失，合计就保持 `null`。不能只记录最后一次成功调用，否则成本和延迟都会被低估。

把 `summarize()` 中原来的单次 `provider.complete()` 与 `parse_summary()` 替换为 `generate_summary()`，并把 `retry_count` 交给第七课的 `ModelCallRecord`。修复 Prompt 只包含校验错误摘要，不应把完整敏感输入或 Provider 原始错误写入日志。

## 九、第八步：定义重试耗尽后的状态

两次都失败时，不能把半截 JSON 当作成功，也不能悄悄换成 Mock。根据业务风险选择一种显式结果：

| 策略 | 适用场景 | 对外表现 |
| --- | --- | --- |
| 直接失败 | 实时接口、没有可靠替代结果 | 返回 `invalid_structured_output / 502` |
| 缓存回退 | 同一输入、模型、Prompt 和 Schema 曾有已验证结果 | 返回缓存结果，并标记 `source=cache`、`degraded=true` |
| 转人工 | 合同审核、发布审批等高价值任务 | 返回 `202` 与 `review_id`，进入人工队列 |
| 降级 Schema | 调用方明确接受较少字段 | 返回另一个显式 `schema_version`，不能伪装成 v1 |

缓存 Key 至少包含输入哈希、逻辑模型路由、Prompt 版本和 Schema 版本。缺少其中任意一项，都可能把旧协议结果当成新结果。是否允许缓存或转人工，应由业务接口配置决定，而不是在通用 Parser 中猜测。

## 十、第九步：管理 Schema 演进

`summary.v1` 是业务协议，不是 Python 类名。演进时遵守下面的兼容规则：

- 增加可选字段通常可以保持 v1，但旧客户端必须能忽略它；
- 新增必填字段、重命名字段或改变字段含义，应发布 `summary.v2`；
- Prompt 版本和 Schema 版本分别记录，二者不能共用一个版本号；
- Gateway 可以在边界层提供 `v2 -> v1` 的显式转换，但不能修改已保存的原始模型结果；
- Golden Tasks 同时声明期望的 `schema_version`，防止模型或 Prompt 升级造成静默协议漂移。

发布新版本时，至少经历“生成新 Schema -> 双版本验证 -> 更新调用方 -> 停止新流量写入旧版本 -> 保留历史读取”的过程。Pydantic 负责单次校验，版本策略负责跨时间兼容，两者缺一不可。

## 十一、本课验收

完成本课后，请确认：

- `SummaryResult` 可以导出 JSON Schema，并继续使用 Pydantic 做最终校验
- 能解释 Prompt JSON、模型原生 Structured Output 和工具参数结构化的边界
- 合法 JSON 能转成 `SummaryResult`，非 JSON、缺字段和错类型都会失败
- `/v1/summaries` 返回 `schema_version`、Prompt 版本和真实 Token usage
- Structured Output 最多进行一次纠错重试，并统计所有尝试的 usage
- 重试耗尽后只会明确失败、缓存降级或转人工，不会把非法结果伪装成成功
- 缓存 Key 包含输入、模型路由、Prompt 和 Schema 版本
- 能判断一次 Schema 变化是否需要发布新版本

## 十二、小结

这一课建立了从生成约束、Pydantic 校验、有限纠错到失败恢复的完整链路。模型原生 Structured Output 用于降低失败率，业务 Schema 用于守住最终边界；任何重试、缓存和人工处理都必须有明确预算与状态。

下一课会把这些尝试与 Provider 重试、模型路由和调用观测接到同一个 `run_id` 上。

---
