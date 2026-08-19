# 第 8 课：处理 Structured Output 失败与 Schema 演进

> 所属章节：[第一章：LLM API、Prompt、Structured Output 与 Gateway](./index.md)  
> 上一课：[第 7 课：定义 Structured Output 契约](./lesson-07-structured-output-contract.md)  
> 下一课：[第 9 课：实现调用可靠性与模型路由](./lesson-09-reliability-routing.md)

## 一、本课要解决的问题

第 7 课已经让模型输出进入 Pydantic Schema，但校验失败只是起点。生产系统还要回答：失败能否纠正、最多尝试几次、调用方收到什么状态、旧客户端如何继续工作，以及错误样本如何进入后续评测。

本课只处理“模型调用完成，但结构不符合业务契约”的情况。连接超时、限流和 Provider 故障留到第 9 课。

## 二、为失败建立稳定分类

不要只抛出一句 `invalid_json`。Structured Output 至少有以下失败形态：

| 错误码 | 含义 | 建议动作 |
| --- | --- | --- |
| `empty_output` | 模型没有返回内容 | 有限纠错或失败 |
| `invalid_json` | 不是合法 JSON | 提供精简错误后有限纠错 |
| `schema_validation_failed` | JSON 合法但字段不满足 Schema | 根据字段错误有限纠错 |
| `output_truncated` | 达到输出上限导致内容不完整 | 调整预算后重新发起新调用 |
| `content_rejected` | 内容策略拒绝 | 不自动绕过，返回明确状态 |
| `repair_exhausted` | 已用完纠错预算 | 降级、缓存、人工处理或失败 |

错误响应应保留 `run_id`、Schema ID 与版本，但不要默认返回模型原文，以免泄露敏感内容。

## 三、把解析与调用分开

解析函数应该是纯函数，便于用固定样本做回归测试：

```python
import json

from pydantic import BaseModel, ValidationError


class StructuredOutputError(Exception):
    def __init__(self, code: str, details: list[dict] | None = None):
        super().__init__(code)
        self.code = code
        self.details = details or []


def parse_output(raw: str, schema: type[BaseModel]) -> BaseModel:
    if not raw.strip():
        raise StructuredOutputError("empty_output")

    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise StructuredOutputError("invalid_json") from exc

    try:
        return schema.model_validate(payload)
    except ValidationError as exc:
        safe_details = [
            {"loc": list(item["loc"]), "type": item["type"]}
            for item in exc.errors()
        ]
        raise StructuredOutputError(
            "schema_validation_failed",
            details=safe_details,
        ) from exc
```

这里不把字段输入值写进 `details`，因为失败数据可能包含用户隐私或受保护内容。

## 四、实现有限纠错

纠错是一次新的模型调用，必须计入延迟、Token 和成本。建议遵循四条规则：

1. 只纠正结构，不让模型重新解释业务目标；
2. 只提供必要的 Schema 与脱敏错误摘要；
3. 默认最多一次，且受总调用预算限制；
4. 新结果必须重新走完整 Schema 校验。

```python
async def complete_structured(
    provider,
    request,
    schema: type[BaseModel],
    max_repairs: int = 1,
):
    attempts = []
    current_request = request

    for repair_index in range(max_repairs + 1):
        result = await provider.complete(current_request)
        attempts.append(result.usage)
        try:
            return parse_output(result.text, schema), attempts
        except StructuredOutputError as exc:
            if repair_index >= max_repairs:
                raise StructuredOutputError("repair_exhausted", exc.details) from exc
            current_request = build_repair_request(
                original=request,
                error_code=exc.code,
                safe_details=exc.details,
            )

    raise AssertionError("unreachable")
```

`build_repair_request()` 不应把完整系统 Prompt、密钥、隐藏上下文或未经脱敏的日志重新交给模型。

## 五、明确重试耗尽后的恢复协议

“返回一段尽可能接近的 JSON”不是可靠降级。系统应根据业务场景显式选择：

- 返回 `failed`，由调用方提示用户修改输入；
- 返回上一次已验证缓存，并标记 `source=cache` 与数据时间；
- 保存待处理任务，进入人工审核；
- 降级为自然语言，但使用不同响应类型，禁止伪装成结构化成功。

示例错误协议：

```json
{
  "error": {
    "code": "structured_output_repair_exhausted",
    "message": "模型输出未通过业务 Schema 校验",
    "retryable": false,
    "run_id": "run_123",
    "schema": {
      "id": "summary_result",
      "version": "1.0.0"
    }
  }
}
```

`retryable=false` 表示客户端不应原样重复请求，并不阻止用户修正输入后创建新任务。

## 六、管理 Schema 演进

Schema 是业务协议，不应随意修改同一版本。推荐使用语义化版本表达影响：

- Patch：说明、描述或非行为元数据变化；
- Minor：增加具有默认值或可选的新字段，旧客户端仍可工作；
- Major：删除字段、改变类型或收紧到破坏旧数据的约束。

每条调用记录至少保存：

```text
schema_id
schema_version
prompt_id
prompt_version
logical_model
provider_model
```

如果 Prompt 与 Schema 必须配套，应在 Registry 中声明兼容关系，并在发送请求前拒绝不兼容组合。

## 七、建立失败样本回归集

至少固定以下样本：

1. 合法结果；
2. Markdown 代码块包裹的 JSON；
3. 缺少必填字段；
4. 字段类型错误；
5. 多出禁止字段；
6. 内容被截断；
7. 第一次失败、纠错后成功；
8. 两次都失败并进入明确终态；
9. 旧版本结果在兼容策略下被接受或拒绝。

这些样本会在第 13 课进入 Golden Tasks 与受控故障验收任务集。

## 八、故障演练

让 Mock Provider 依次返回以下结果，记录系统状态与调用次数：

```text
第一次：{"title": "示例", "keywords": "not-an-array"}
第二次：{"title": "示例", "summary": "...", "keywords": ["gateway"]}
```

验收重点不是“第二次成功”，而是：第一次错误被正确分类、纠错只发生一次、两次用量都被记录、最终结果重新通过 Schema 校验。

## 九、本课验收

- [ ] 解析逻辑不依赖真实 Provider，可以单独测试。
- [ ] Structured Output 失败有稳定错误码和脱敏详情。
- [ ] 纠错次数、总耗时与 Token 成本均有上限。
- [ ] 纠错结果会重新经过完整 Schema 校验。
- [ ] 降级结果不会伪装成正常结构化成功。
- [ ] Schema 有稳定 ID、版本和兼容规则。
- [ ] 已保存至少九类结构化失败与恢复样本。

## 十、小结

Structured Output 的工程价值不只是“输出 JSON”，而是让模型输出进入一个可校验、可恢复、可演进的业务协议。下一课会把同样的边界思维扩展到 Provider 超时、限流、重试、fallback 与模型路由。
