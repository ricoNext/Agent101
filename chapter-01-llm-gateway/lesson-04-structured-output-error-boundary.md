# 第 4 课：结构化输出和错误边界

> 所属章节：[第 1 章：从零构建 LLM Gateway](./index.md)  
> 上一课：[第 3 课：接入 OpenAI-compatible 模型服务](./lesson-03-openai-compatible-provider.md)  
> 下一课：[第 5 课：实现 SSE 流式接口](./lesson-05-sse-streaming-api.md)  
> [课程代码](https://github.com/ricoNext/agent-platform/tree/chapter-01)

## 一、前言

上一课，我们已经把 OpenAI-compatible Provider 接上了。

改一下环境变量，就能在 Mock 和真实模型之间切换；`POST /v1/chat` 接口也能返回一段普通文本。

事情到这里，好像已经够用了。但做业务时，问题马上会来：

**模型返回的是自然语言，程序需要的是结构化数据。**

举例来说，你希望得到标题、摘要和关键词。

模型可能写得很漂亮，也可能漏字段、多字段，甚至根本不是 JSON。

这时，如果直接把原文塞进下游逻辑，后面每一层都会变得不可靠。

所以今天接着往下讲：先把「结构化输出」这件事做对。

这一课只做三件事：

1. 用 Pydantic 定义摘要业务的 Schema
2. 写一个不依赖模型的校验函数，把原始文本解析成 `SummaryResult`
3. 先理解重试边界，但本课不实现自动重试

即使你暂时还在用 Mock Provider，也要把校验和错误处理做完整。建议先跟着例子做一遍，再读文字说明。

## 二、第一步：定义业务 Schema

所谓**结构化输出**，就是要求模型按约定格式返回数据，再用 Schema 校验。

字面上讲，它好像只是「让模型输出 JSON」；但是，更准确的说法是：先约定业务结构，再把模型输出约束进这个结构。

在 `app/schemas.py` 末尾加入：

```python
# 摘要请求
class SummaryRequest(BaseModel):
    text: str = Field(min_length=10, max_length=10_000)


# 摘要响应
class SummaryResult(BaseModel):
    title: str = Field(min_length=1)
    summary: str = Field(min_length=1)
    keywords: list[str] = Field(min_length=1, max_length=5)


# 摘要响应
class SummaryResponse(BaseModel):
    run_id: str
    result: SummaryResult
    model: str
    latency_ms: int
```

解释一下上面代码的关键点。

**（1）`SummaryRequest`**

这是接口入参。`text` 最短 10 个字符、最长 10000 个字符，避免空串和超长输入直接打到模型层。

**（2）`SummaryResult`**

这是业务真正关心的结果：标题、摘要、关键词。关键词至少 1 个、最多 5 个。缺字段、空字符串、类型不对，都应判定失败。

**（3）`SummaryResponse`**

这是对外返回的完整响应。除了 `result`，还带上 `run_id`、`model` 和 `latency_ms`，方便排查和观测。

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

需要说明的是：这里故意不依赖真实模型。好处很直接——测试稳定、失败原因清晰，后面接 `/v1/summaries` 时也能复用同一套校验。

## 四、第三步：先为校验函数写测试

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
```

运行：

```bash
pytest -q
```

这三条测试分别对应三种情况：合法结构通过、非 JSON 失败、缺字段失败。

简单说，「JSON 合法」只说明语法过关；「业务结构合法」才说明它能进入下游逻辑。两者不是一回事。

## 五、第四步：理解重试边界

当模型输出不是合法 JSON，或结构对不上 Schema 时，可以进行有限重试：把「校验失败原因」和「只返回 JSON」的约束，再次发送给模型。

最多重试 1 到 2 次。一直失败时，返回业务错误，不要把不完整 JSON 悄悄当成成功。

本节先不实现自动重试，因为还没有稳定的真实模型测试数据。先把「校验失败」作为明确错误，等后面用 Golden Tasks 验证重试策略。

注意：重试是补救，不是默许。如果把坏数据放行，后面的前端展示、数据库写入、工具调用都会一起跟着错。

## 六、本课验收

完成本课后，请确认以下五项：

- 有 Schema
- 合法 JSON 能转成 `SummaryResult`
- 非 JSON、缺字段和错类型都会失败
- 测试通过
- 你能解释「JSON 合法」和「业务结构合法」的区别

## 七、小结

今天就讲到这里。这一课我们做了三件事：定义摘要业务的 Schema，实现不依赖模型的结构化校验，并先把重试边界想清楚。

模型会说话，不代表它会按契约交付。先把校验边界立住，后面接 `/v1/summaries` 和自动重试才会稳。下一篇教程将讲解如何实现 SSE 流式接口。

如果你看到了结尾，说明你已经把「结构化输出」的错误边界立住了。下一课见。

本节代码仓库地址：[第四课代码](https://github.com/ricoNext/agent-platform/tree/chapter-04)

---
