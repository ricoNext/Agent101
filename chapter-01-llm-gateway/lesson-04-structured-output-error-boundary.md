# 第 4 课：结构化输出和错误边界

> 所属章节：[第 1 章：从零构建 LLM Gateway](./index.md)  
> 上一课：[第 3 课：接入 OpenAI-compatible 模型服务](./lesson-03-openai-compatible-provider.md)  
> 下一课：[第 5 课：实现 SSE 流式接口](./lesson-05-sse-streaming-api.md)

### 你将完成什么

新增一个 `/v1/summaries` 接口。它要求模型返回严格 JSON，并用 Pydantic 校验。即使你暂时使用 Mock Provider，也要完成校验和错误处理。

### 第一步：定义业务 Schema

在 `app/schemas.py` 末尾加入：

```python
class SummaryRequest(BaseModel):
    text: str = Field(min_length=10, max_length=10_000)


class SummaryResult(BaseModel):
    title: str = Field(min_length=1)
    summary: str = Field(min_length=1)
    keywords: list[str] = Field(min_length=1, max_length=5)


class SummaryResponse(BaseModel):
    run_id: str
    result: SummaryResult
    model: str
    latency_ms: int
```

### 第二步：先实现不依赖模型的校验函数

创建 `app/structured.py`：

```python
import json

from pydantic import ValidationError

from app.schemas import SummaryResult


class StructuredOutputError(Exception):
    pass


def parse_summary(raw_text: str) -> SummaryResult:
    try:
        payload = json.loads(raw_text)
    except json.JSONDecodeError as error:
        raise StructuredOutputError("model did not return valid JSON") from error

    try:
        return SummaryResult.model_validate(payload)
    except ValidationError as error:
        raise StructuredOutputError("model JSON does not match SummaryResult") from error
```

先为它写测试 `tests/test_structured.py`：

```python
import pytest

from app.structured import StructuredOutputError, parse_summary


def test_parse_summary_accepts_valid_json() -> None:
    result = parse_summary(
        '{"title":"测试","summary":"这是一个有效摘要","keywords":["测试"]}'
    )

    assert result.title == "测试"


def test_parse_summary_rejects_invalid_json() -> None:
    with pytest.raises(StructuredOutputError):
        parse_summary("not json")


def test_parse_summary_rejects_wrong_shape() -> None:
    with pytest.raises(StructuredOutputError):
        parse_summary('{"title":"只有标题"}')
```

运行：

```bash
pytest -q
```

### 第三步：理解重试边界

当模型输出不是合法 JSON 时，可以进行有限重试：把“校验失败原因”和“只返回 JSON”的约束再次发送给模型。最多重试 1-2 次；一直失败时，返回业务错误，不要把不完整 JSON 悄悄当成成功。

本章先不实现自动重试，因为你还没有稳定的真实模型测试数据。先把“校验失败”作为明确错误，等第六章用 Golden Tasks 验证重试策略。

### 本课验收

- 有 Schema；
- 合法 JSON 能转成 `SummaryResult`；
- 非 JSON、缺字段和错类型都会失败；
- 测试通过；
- 你能解释“JSON 合法”和“业务结构合法”的区别。

---
