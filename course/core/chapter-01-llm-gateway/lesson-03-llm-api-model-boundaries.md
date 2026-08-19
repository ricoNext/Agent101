# 第 3 课：理解 LLM API 与模型调用边界

> 所属章节：[第一章：LLM API、Prompt、Structured Output 与 Gateway](./index.md)  
> 上一课：[第 2 课：建立一个可测试的后端](./lesson-02-testable-backend.md)  
> 下一课：[第 4 课：用 Provider 抽象隔离模型服务](./lesson-04-provider-abstraction-mock.md)

## 一、本课要解决的问题

第 2 课已经建立了可启动、可测试的 FastAPI 服务，但它还不知道一次模型调用究竟包含什么。直接照抄某家厂商的请求体，会让路由、业务代码和厂商协议绑在一起，也会把 Token、延迟、成本和错误边界隐藏起来。

本课先不接真实模型，而是建立后续 Provider 层共同遵守的模型调用认知。完成后，你应该能够：

1. 识别一次 LLM 调用的输入、输出和元数据。
2. 解释 Chat Completions 类 API 与 Responses 类 API 的共同点和差异。
3. 说明 `temperature`、`top_p`、输出上限和停止条件的工程影响。
4. 估算 Context Window、Token、延迟与成本之间的关系。
5. 区分传输错误、协议错误、内容错误和业务错误。
6. 用能力矩阵选择模型，而不是在业务代码中写死模型名称。

## 二、把模型调用看成一份协议

模型调用不是“向一个 URL 发送 Prompt”这么简单。平台至少要处理四类信息：

| 类别 | 典型字段 | 平台为什么要关心 |
| --- | --- | --- |
| 输入 | 消息、指令、上下文、生成参数 | 决定模型看到了什么，以及是否超出预算 |
| 输出 | 文本、结构化内容、停止原因 | 决定下游能否安全消费 |
| 用量 | 输入 Token、输出 Token | 用于容量规划、成本和回归对比 |
| 追踪 | 请求 ID、模型、延迟、错误 | 用于排障、审计和性能分析 |

先在项目中定义不依赖厂商名称的内部对象：

```python
from typing import Literal

from pydantic import BaseModel, Field


class Message(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str = Field(min_length=1)


class GenerationOptions(BaseModel):
    temperature: float = Field(default=0.2, ge=0, le=2)
    top_p: float = Field(default=1, gt=0, le=1)
    max_output_tokens: int = Field(default=512, ge=1, le=8192)


class ModelUsage(BaseModel):
    input_tokens: int | None = None
    output_tokens: int | None = None


class ModelResult(BaseModel):
    text: str
    finish_reason: str | None = None
    usage: ModelUsage
    provider_request_id: str | None = None
```

这里故意没有加入具体厂商的 `deployment_id`、响应对象或 SDK 类型。第 4 课会让 Provider Adapter 负责内部协议与厂商协议之间的转换。

## 三、Chat Completions 与 Responses 类 API

不同厂商和不同代际 API 的字段并不完全相同，但核心流程相似：

1. 提交指令、消息或输入项；
2. 指定模型和生成参数；
3. 接收文本、结构化内容或流式事件；
4. 读取停止原因、用量和请求标识。

Gateway 不应假设所有服务都支持相同能力。例如：

- 有的服务只支持消息数组，有的允许多种输入项；
- 有的服务原生支持 JSON Schema，有的只能依靠 Prompt；
- 有的服务在流结束时返回 Usage，有的不会返回；
- 有的服务支持取消传播，有的只允许客户端断开连接；
- 相同字段名在不同服务中的限制范围可能不同。

因此，OpenAI-compatible 只表示协议大体兼容，不表示行为完全一致。平台必须通过适配器和能力声明消化差异。

## 四、生成参数不是装饰项

### 4.1 `temperature` 与 `top_p`

二者都影响采样，不应在缺少评测的情况下同时大幅调整。确定性较强的提取、分类和结构化任务通常使用较低随机性；创意任务可以提高随机性，但仍要通过任务集验证结果。

### 4.2 输出 Token 上限

输出上限既是体验参数，也是资源边界。设置过小会导致内容被截断；设置过大则会增加尾延迟和成本，并给异常 Prompt 留出更大的消耗空间。

### 4.3 停止原因

返回了文本不代表调用完整成功。平台至少要区分：

- 正常完成；
- 达到输出上限；
- 被内容策略拦截；
- 用户取消；
- Provider 异常终止。

达到输出上限的 JSON 很可能是不完整结果，不能当作业务成功。

## 五、Context Window、Token、延迟与成本

一次调用的上下文预算可以先用下面的关系理解：

```text
系统指令 + 对话历史 + 业务上下文 + 检索内容 + 预留输出 <= 模型上下文窗口
```

第一章不实现复杂 Context Manager，但 Gateway 必须从一开始记录输入与输出用量。建议把成本估算统一放在模型目录中，而不是散落在业务代码里：

```python
from decimal import Decimal


def estimate_cost(
    input_tokens: int,
    output_tokens: int,
    input_price_per_million: Decimal,
    output_price_per_million: Decimal,
) -> Decimal:
    unit = Decimal(1_000_000)
    return (
        Decimal(input_tokens) * input_price_per_million / unit
        + Decimal(output_tokens) * output_price_per_million / unit
    )
```

估算值必须标记价格版本和币种。Provider 没有返回 Usage 时，应记录 `null` 或“估算”，不能伪装成精确值。

## 六、先建立错误分层

| 错误层 | 示例 | 是否说明模型不可用 |
| --- | --- | --- |
| 传输错误 | 连接失败、超时、断流 | 可能，需结合重试策略判断 |
| Provider 协议错误 | 状态码异常、响应字段缺失 | 可能，也可能是适配器不兼容 |
| 内容错误 | 非法 JSON、字段缺失、内容被截断 | 不一定，调用本身可能成功 |
| 业务错误 | 摘要为空、分类不满足规则 | 不一定，需要业务验收判断 |

这四层不能全部映射成 HTTP 500。第 7、8 课会处理结构化内容错误，第 9 课再处理超时、限流、重试和 fallback。

## 七、建立最小模型能力矩阵

在 `agent-platform` 中，为每个可用模型维护至少以下信息：

| 字段 | 示例含义 |
| --- | --- |
| `logical_model` | 上层使用的稳定别名，如 `general-chat` |
| `provider` | 由哪个 Provider Adapter 调用 |
| `context_window` | 最大上下文窗口 |
| `supports_streaming` | 是否支持流式响应 |
| `supports_structured_output` | 是否支持原生结构化输出 |
| `max_output_tokens` | 平台允许的输出上限 |
| `price_version` | 当前价格配置版本 |
| `enabled` | 是否允许被路由选择 |

能力矩阵描述事实，路由策略负责做选择。业务路由不应直接判断具体模型字符串。

## 八、课堂练习

选择两个准备接入的模型服务，完成一张能力对照表，并回答：

1. 哪些字段只是名称不同，哪些行为确实不同？
2. 哪些差异应由 Provider Adapter 处理？
3. 哪些差异必须暴露给路由策略？
4. Usage 缺失时，基线报告应如何表达？
5. 输出被截断时，HTTP 请求成功是否等于业务成功？

## 九、本课验收

- [ ] 能画出请求、Provider、模型和响应之间的边界。
- [ ] 内部请求与结果对象不依赖具体厂商 SDK。
- [ ] 能解释主要生成参数对质量、延迟和成本的影响。
- [ ] 能区分四类错误，不把内容错误混入传输错误。
- [ ] 已建立至少两个模型条目的能力矩阵草案。
- [ ] Usage 不可用时不会生成虚假的精确 Token 或成本数据。

## 十、小结

这一课没有急着发送真实请求，而是先明确了 Gateway 要稳定承载的协议、预算和错误边界。下一课会在这些内部对象之上建立 Provider 抽象，并用 Mock Provider 获得可重复测试的第一条模型调用链。
