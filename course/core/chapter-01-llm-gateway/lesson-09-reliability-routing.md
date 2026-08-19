# 第 9 课：实现调用可靠性与模型路由

> 所属章节：[第一章：LLM API、Prompt、Structured Output 与 Gateway](./index.md)  
> 上一课：[第 8 课：处理 Structured Output 失败与 Schema 演进](./lesson-08-structured-output-recovery.md)  
> 下一课：[第 10 课：建立调用观测与成本治理](./lesson-10-observability-cost.md)  
> [参考代码基线](https://github.com/ricoNext/agent-platform/tree/chapter-06)

## 一、前言

上一课，我们已经能拒绝非法结构，也能对摘要做一次有边界的纠错。

系统现在可以接入真实模型，也能拦住不合格的 Structured Output。事情到这里，好像已经能用了。
但只要遇到一次超时、限流或模型不可用，请求就直接失败。

调用方还得知道具体模型名称。这样的 Gateway，还称不上稳定服务。

**真正的问题不是“模型会不会挂”，而是挂了以后，调用方要不要跟着一起挂。**

这一课就来补齐 Gateway 的可靠性控制面。简单说，会做五件事：

1. 把失败分成可重试与不可重试
2. 对瞬时错误执行有限重试和退避
3. 用逻辑模型别名隔离具体模型名称
4. 在候选模型之间 fallback
5. 明确稳定错误协议，以及普通调用与 Streaming 的重试边界

建议先跟着例子做一遍，再读文字说明。

## 二、第一步：先给失败分类

重试不是默认答案。

字面上讲，失败了再试一次，好像总能提高成功率。但是，更准确的说法是：只有错误有较大概率在短时间内自行恢复，并且重复请求不会造成不可接受的副作用时，重试才有意义。

| 失败 | 是否重试 | 处理方式 |
| --- | --- | --- |
| 连接超时、读取超时 | 是，有限次数 | 退避后重试，必要时 fallback |
| HTTP 429 | 是，尊重 `Retry-After` | 限流等待或切换候选模型 |
| HTTP 5xx | 通常可以 | 有上限地重试 |
| HTTP 401 / 403 | 否 | 立即失败并告警配置问题 |
| HTTP 400 | 否 | 修正请求或适配器 |
| Provider 响应协议异常 | 谨慎 | 通常切换 Provider，不重复轰炸同一服务 |
| Structured Output 不合法 | 有条件 | 最多纠错一次，否则降级或转人工 |
| 内容质量不合格 | 不能盲目重试 | 调整 Prompt、模型或任务设计 |

必须牢记的是：重试次数必须计入总时间和成本预算。三次各 30 秒的超时，不是“更可靠”，而是让用户等 90 秒后才看到失败。

## 三、第二步：让 ProviderError 表达重试语义

错误发生以后，上层怎么决定“再试一次”还是“立刻失败”？

不能靠猜 HTTP 状态，也不能把所有失败都折叠成一句 `provider_http_error`。
这一节就来看看，如何让 `ProviderError` 自己说出重试语义。

首先，更新 `app/providers/base.py` 中的错误类型：

```python
class ProviderError(Exception):
    def __init__(
        self,
        code: str,
        message: str,
        *,
        # 是否可以重试
        retryable: bool = False,
        # 是否可以 fallback
        fallback_allowed: bool = False,
        # HTTP 状态码
        status_code: int | None = None,
        retry_after_seconds: float | None = None,
        route: str | None = None,
        model: str | None = None,
        attempt_count: int = 1,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.retryable = retryable
        self.fallback_allowed = fallback_allowed
        self.status_code = status_code
        self.retry_after_seconds = retry_after_seconds
        self.route = route
        self.model = model
        self.attempt_count = attempt_count
```

上面代码中，关键字段有三个。

**（1）`retryable`**

当前目标能不能再试一次。超时、429、5xx 通常可以；401、403、400 不行。

**（2）`fallback_allowed`**

能不能换下一个候选模型。协议异常可以换 Provider，但不能反复轰炸同一服务。鉴权失败则两边都不允许。

**（3）`retry_after_seconds`**

上游要求等待多久。有就尊重它，没有再走本地退避。

接着，打开第 5 课创建的 `app/providers/openai_compatible.py`。

`complete()` 和 `stream()` 都会碰到同一类 httpx 异常，错误码也必须一致。
但不必把映射逻辑各写一遍。抽出一个方法，两处都调用它。

需要说明的是：这里只统一错误码。
第八课会单独讲流式重试边界，不表示 `stream()` 也要重试。

错误码必须在 Adapter 中确定，不能把所有 HTTP 状态都折叠成 `provider_http_error`。

先在 `OpenAICompatibleProvider` 中加入 `_raise_httpx_error()`：

```python
    def _raise_httpx_error(self, error: httpx.HTTPError) -> None:
        if isinstance(error, httpx.TimeoutException):
            raise ProviderError(
                "provider_timeout",
                "模型服务响应超时",
                retryable=True,
                fallback_allowed=True,
            ) from error
        if isinstance(error, httpx.HTTPStatusError):
            status_code = error.response.status_code
            retry_after = error.response.headers.get("Retry-After")
            retry_after_seconds = (
                min(float(retry_after), 10.0)
                if retry_after is not None and retry_after.isdigit()
                else None
            )

            if status_code == 429:
                code = "provider_rate_limited"
                retryable = True
                fallback_allowed = True
            elif status_code in {401, 403}:
                code = "provider_auth_failed"
                retryable = False
                fallback_allowed = False
            elif status_code in {400, 404, 422}:
                code = "provider_bad_request"
                retryable = False
                fallback_allowed = False
            elif status_code == 408 or status_code >= 500:
                code = "provider_unavailable"
                retryable = True
                fallback_allowed = True
            else:
                code = "provider_http_error"
                retryable = False
                fallback_allowed = False

            raise ProviderError(
                code,
                f"模型服务返回 HTTP {status_code}",
                retryable=retryable,
                fallback_allowed=fallback_allowed,
                status_code=status_code,
                retry_after_seconds=retry_after_seconds,
            ) from error

        raise ProviderError(
            "provider_network_error",
            "无法连接模型服务",
            retryable=True,
            fallback_allowed=True,
        ) from error
```

然后，把 `complete()` 和 `stream()` 里原来的三组 `except` 都换成：

```python
        except (httpx.RequestError, httpx.HTTPStatusError) as error:
            self._raise_httpx_error(error)
```

`invalid_provider_response` 那一组不用动。

注意：`TimeoutException` 是 `RequestError` 的子类，所以辅助方法里必须先判断超时。
`HTTPStatusError` 不是 `RequestError`，所以 `except` 里两个类型都要写上。

上面代码中，映射规则可以记成四类。

**（1）超时和网络错误：**
`provider_timeout`、`provider_network_error`。可重试，也允许 fallback。

**（2）429：**
`provider_rate_limited`。可重试，也允许换候选模型。如果响应头带了 `Retry-After`，先读它。

**（3）401 / 403 / 400 / 404 / 422：**
凭据或请求本身有问题。立即失败，不重试，也不 fallback。

**（4）408 或 5xx：**
`provider_unavailable`。通常可以有上限地重试。

需要说明的是：`Retry-After` 既可能是秒数，也可能是 HTTP 日期。第一章实现秒数形式，并设置 10 秒上限；生产版本可以补充日期解析。

错误消息对外保持稳定，不返回 Provider 原始响应体。原始响应可能包含内部地址、请求片段或敏感信息，只能进入受控日志。

### 3.1 区分两种限流

同样是 HTTP 429，责任方却不一样。

所谓 `provider_rate_limited`，就是上游 Provider 没有容量。
所谓 `gateway_rate_limited`，就是当前租户在进入模型调用前，已经超过了 Gateway 配额。

两者都使用 HTTP 429，但错误码、重试时间和责任方不同。

Gateway 限流至少使用“租户 + 接口”作为 Key，不能只按来源 IP。解析请求后，还可以叠加逻辑模型路由和 Token 配额。

API Key 只用于鉴权。日志和限流存储中保存 Key ID 或哈希，不保存原文。

接着，打开 `app/main.py`。
先加入租户上下文 `TenantContext`，再注册限流中间件。
这个中间件要挂在模型调用之前：先鉴权、再限流，通过后才进入业务路由。

```python
import uuid
from dataclasses import dataclass


@dataclass(frozen=True)
class TenantContext:
    tenant_id: str
    api_key_id: str


@app.middleware("http")
async def enforce_gateway_rate_limit(request: Request, call_next):
    if not hasattr(request.state, "run_id"):
        request.state.run_id = str(uuid.uuid4())
    tenant = await authenticate_api_key(request)
    request.state.tenant = tenant
    decision = await rate_limiter.consume(
        key=f"{tenant.tenant_id}:{request.url.path}",
        requests=1,
    )
    if not decision.allowed:
        payload = ErrorResponse(
            code="gateway_rate_limited",
            message="当前租户请求过于频繁，请稍后重试",
            run_id=request.state.run_id,
        )
        return JSONResponse(
            status_code=429,
            content=payload.model_dump(),
            headers={
                "Retry-After": str(decision.retry_after_seconds),
                "X-RateLimit-Limit": str(decision.limit),
                "X-RateLimit-Remaining": "0",
            },
        )
    return await call_next(request)
```

上面代码中，限流发生在调用模型之前。一旦 `decision.allowed` 为假，请求直接返回，模型一层根本不会被碰到。

本地单进程可以使用内存 Token Bucket。多进程或多实例部署必须使用 Redis、API Gateway 等共享限流器，否则每个进程都有一份独立计数。

健康检查可以不鉴权。模型调用、摘要和 Streaming 必须经过相同租户边界。

`authenticate_api_key()` 从 `Authorization: Bearer ...` 读取调用方 Key，
计算哈希后查找 `api_key_id`、`tenant_id`、状态和到期时间。
比较使用常量时间函数；数据库不保存可还原的 Key 原文。

这里有两类鉴权错误，不要混在一起：

- 调用方 Key 无效：返回 `gateway_auth_failed / 401`
- Gateway 自己的上游 Provider Key 失效：返回 `provider_auth_failed / 502`

Key 必须支持创建、轮换、撤销和最后使用时间审计。模型 Provider Key 则只保存在服务端密钥管理中，不能下发给租户或浏览器。

## 四、第三步：使用逻辑模型别名

调用方不应该写死 `vendor-model-2026-08-01`。它应该表达任务需要的能力，例如：

- `fast`：低延迟、低成本任务
- `balanced`：默认质量与成本平衡
- `reasoning`：复杂推理任务
- `dev`：本地 Mock

所谓**逻辑模型别名**，就是给任务能力起一个稳定名字。Gateway 再把这个名字映射到具体 Provider 和模型。

这样替换模型、灰度和回滚，都不需要修改前端协议。

在 `ChatRequest` 中把 `model` 理解为逻辑别名，并限制长度：

```python
class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1)
    model: str | None = Field(default=None, min_length=1, max_length=64)
    generation: GenerationConfig = Field(default_factory=GenerationConfig)
```

生产系统可以进一步使用 `Literal` 或配置生成的允许列表，拒绝调用方任意指定底层模型。

## 五、第四步：实现 RoutingProvider

别名有了，接下来要有人负责“选哪个模型、失败了怎么办”。

这一节就来实现 `RoutingProvider`。

先在 `app/providers/base.py` 的 `ProviderResult` 中增加路由元数据。
普通 Provider 使用默认值，RoutingProvider 在返回前补齐真实数据：

```python
@dataclass
class ProviderResult:
    text: str
    model: str
    input_tokens: int | None
    output_tokens: int | None
    route: str | None = None
    attempt_count: int = 1
```

然后创建 `app/providers/router.py`：

```python
import asyncio
from collections.abc import AsyncIterator
from dataclasses import dataclass, replace

from app.providers.base import ModelProvider, ProviderError, ProviderResult
from app.schemas import ChatMessage, GenerationConfig


@dataclass(frozen=True)
class RouteTarget:
    provider: ModelProvider
    model: str


class RoutingProvider:
    def __init__(
        self,
        *,
        routes: dict[str, list[RouteTarget]],
        default_route: str,
        max_attempts_per_target: int = 2,
    ) -> None:
        if default_route not in routes:
            raise ValueError("default route is not configured")
        if max_attempts_per_target < 1:
            raise ValueError("max attempts must be at least 1")

        self.routes = routes
        self.default_route = default_route
        self.max_attempts_per_target = max_attempts_per_target

    def _targets(self, route_name: str | None) -> list[RouteTarget]:
        selected = route_name or self.default_route
        targets = self.routes.get(selected)
        if not targets:
            raise ProviderError(
                "model_route_not_found",
                f"模型路由不存在：{selected}",
            )
        return targets

    async def complete(
        self,
        *,
        messages: list[ChatMessage],
        model: str | None = None,
        generation: GenerationConfig | None = None,
    ) -> ProviderResult:
        last_error: ProviderError | None = None
        selected_route = model or self.default_route
        attempt_count = 0

        for target in self._targets(model):
            for attempt in range(1, self.max_attempts_per_target + 1):
                attempt_count += 1
                try:
                    result = await target.provider.complete(
                        messages=messages,
                        model=target.model,
                        generation=generation,
                    )
                    return replace(
                        result,
                        route=selected_route,
                        attempt_count=attempt_count,
                    )
                except ProviderError as error:
                    last_error = error
                    error.route = selected_route
                    error.model = target.model
                    error.attempt_count = attempt_count
                    if not error.fallback_allowed:
                        raise
                    if not error.retryable:
                        break
                    if attempt < self.max_attempts_per_target:
                        delay = error.retry_after_seconds
                        if delay is None:
                            delay = min(0.2 * 2 ** (attempt - 1), 2.0)
                        await asyncio.sleep(delay)

        if last_error and last_error.code == "provider_rate_limited":
            last_error.attempt_count = attempt_count
            raise last_error

        raise ProviderError(
            "all_model_routes_failed",
            "所有候选模型均不可用",
            route=selected_route,
            model=last_error.model if last_error else None,
            attempt_count=attempt_count,
        ) from last_error

    async def stream(
        self,
        *,
        messages: list[ChatMessage],
        model: str | None = None,
        generation: GenerationConfig | None = None,
    ) -> AsyncIterator[str]:
        target = self._targets(model)[0]
        async for chunk in target.provider.stream(
            messages=messages,
            model=target.model,
            generation=generation,
        ):
            yield chunk
```

上面代码中，可以分成四段来看。

**（1）`RouteTarget`**

一个候选目标就是「哪一个 Provider + 哪一个具体模型」。逻辑路由名对应的是目标列表，不是单个字符串。

**（2）`complete()` 的双层循环**

外层遍历候选目标，内层对当前目标做有限重试。成功就补上 `route` 和 `attempt_count` 后返回。

**（3）失败时怎么走：**
`fallback_allowed=False` 立即抛出，例如 401、403 和请求参数错误。
`retryable=False` 则停止当前目标，改试下一个。
需要等待时，优先用 `Retry-After`；没有就用短指数退避，上限 2 秒。

**（4）`stream()`**

这个最小实现对 Streaming 只选择第一个目标。原因很直接：
流已经向用户输出后，再切换模型会产生重复或不连贯内容。
第八课会为流式调用单独建立事件和取消边界。

注意：协议异常可以设置为“当前目标不重试，但允许切换 Provider”。普通调用可以 fallback；Streaming 先不要照搬。

## 六、第五步：配置路由与 fallback

下面演示如何把路由装配起来。

假设当前 OpenAI-compatible Provider 支持两个模型，可以这样写：

```python
routing_provider = RoutingProvider(
    routes={
        "fast": [
            RouteTarget(provider=openai_provider, model=settings.fast_model_name),
        ],
        "balanced": [
            RouteTarget(provider=openai_provider, model=settings.model_name),
            RouteTarget(
                provider=openai_provider,
                model=settings.fallback_model_name,
            ),
        ],
        "dev": [
            RouteTarget(provider=MockProvider(), model="mock-1"),
        ],
    },
    default_route="dev" if settings.model_provider == "mock" else "balanced",
)
```

配置中增加：

```python
fast_model_name: str = "replace-fast-model"
fallback_model_name: str = "replace-fallback-model"
```

上面配置中，`balanced` 有两个候选：主模型和备用模型。`dev` 指向 Mock，只给离线开发和确定性测试用。

必须牢记的是：Mock 不应该在生产环境悄悄作为真实回答的 fallback。否则系统看似成功，实际返回了测试文本。

生产 fallback 应使用经过评测的备用模型，或者明确返回降级状态。

## 七、第六步：给重试和 fallback 设定预算

为一次请求定义总预算，而不是让每层各自无限重试：

```text
总时间预算：20 秒
每目标最多尝试：2 次
候选目标：2 个
最大模型调用次数：3 次
```

为什么不是 `2 × 2 = 4`？因为总预算可能在第四次调用前已经耗尽。

可靠性策略必须同时检查：

- 已用时间
- 已调用次数
- 已消耗 Token 和估算成本
- 用户是否已经取消

第一章先实现次数上限和短退避，第七章再加入完整预算护栏。

## 八、实现预览：记录每次模型调用

> 本节用于展示可靠性数据如何进入观测层，不计入本课核心验收。第 10 课会正式建立 Run、Attempt、Event、Token、成本与 Trace 的完整记录。

只定义日志结构，还不算完成观测。

必须保证普通调用、Structured Output 的每次尝试和失败路径，都经过同一个记录入口。创建 `app/observability.py`：

```python
import time
import uuid
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
import json
import logging

from app.providers.base import ModelProvider, ProviderError, ProviderResult
from app.schemas import ChatMessage, GenerationConfig


logger = logging.getLogger("gateway.model_call")


@dataclass(frozen=True)
class PriceSnapshot:
    version: str
    input_usd_per_million: float
    output_usd_per_million: float


@dataclass(frozen=True)
class CallContext:
    run_id: str
    tenant_id: str
    request_kind: str
    prompt_id: str | None
    prompt_version: str | None
    schema_version: str | None
    generation: GenerationConfig


@dataclass(frozen=True)
class ModelCallRecord:
    occurred_at: str
    run_id: str
    call_id: str
    tenant_id: str
    request_kind: str
    route: str
    model: str | None
    prompt_id: str | None
    prompt_version: str | None
    schema_version: str | None
    temperature: float
    top_p: float
    max_output_tokens: int
    input_tokens: int | None
    output_tokens: int | None
    latency_ms: int
    estimated_cost_usd: float | None
    price_version: str
    attempt_count: int
    retry_count: int
    status: str
    error_code: str | None = None


def write_model_call(record: ModelCallRecord) -> None:
    logger.info(json.dumps({"event": "model_call", **asdict(record)}, ensure_ascii=False))


def estimate_cost(
    *,
    input_tokens: int | None,
    output_tokens: int | None,
    price: PriceSnapshot,
) -> float | None:
    if input_tokens is None or output_tokens is None:
        return None
    return round(
        (
            input_tokens * price.input_usd_per_million
            + output_tokens * price.output_usd_per_million
        )
        / 1_000_000,
        8,
    )


async def observed_complete(
    *,
    provider: ModelProvider,
    messages: list[ChatMessage],
    model: str | None,
    context: CallContext,
    price: PriceSnapshot,
) -> ProviderResult:
    call_id = str(uuid.uuid4())
    started_at = time.perf_counter()
    result: ProviderResult | None = None
    error: ProviderError | None = None

    try:
        result = await provider.complete(
            messages=messages,
            model=model,
            generation=context.generation,
        )
        return result
    except ProviderError as caught:
        error = caught
        raise
    finally:
        input_tokens = result.input_tokens if result else None
        output_tokens = result.output_tokens if result else None
        attempt_count = (
            result.attempt_count
            if result
            else (error.attempt_count if error else 1)
        )
        route = (
            result.route
            if result and result.route
            else (error.route if error and error.route else model or "default")
        )
        write_model_call(
            ModelCallRecord(
                occurred_at=datetime.now(UTC).isoformat(),
                run_id=context.run_id,
                call_id=call_id,
                tenant_id=context.tenant_id,
                request_kind=context.request_kind,
                route=route,
                model=result.model if result else (error.model if error else None),
                prompt_id=context.prompt_id,
                prompt_version=context.prompt_version,
                schema_version=context.schema_version,
                temperature=context.generation.temperature,
                top_p=context.generation.top_p,
                max_output_tokens=context.generation.max_output_tokens,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                latency_ms=int((time.perf_counter() - started_at) * 1000),
                estimated_cost_usd=estimate_cost(
                    input_tokens=input_tokens,
                    output_tokens=output_tokens,
                    price=price,
                ),
                price_version=price.version,
                attempt_count=attempt_count,
                retry_count=max(attempt_count - 1, 0),
                status="failed" if error else "completed",
                error_code=error.code if error else None,
            )
        )
```

上面代码中，有三个 ID 必须分清。

**（1）`run_id`**

关联一次 Gateway 请求。一次请求应在调用模型前创建它，成功与失败日志都使用同一个值，不能在异常处理器中临时换一个新 ID。

**（2）`call_id`**

标识其中的一次模型调用。Structured Output 纠错会产生多个 `call_id`，但它们共享同一个 `run_id`。

**（3）`observed_complete()`**

真正的记录入口。无论最终成功还是失败，`finally` 都会写出一条 `ModelCallRecord`。

普通聊天不再直接调用 `self.provider.complete()`，而是调用 `observed_complete()`。
摘要生成的每次纠错尝试也使用这个包装器，
`request_kind="structured-output"`、`schema_version="summary.v1"`。
这样无论最终成功还是失败，每次实际产生 Token 和延迟的调用都有记录。

应用启动时配置价格快照，并把它注入服务层：

```python
price_snapshot = PriceSnapshot(
    version="2026-08-usd",
    input_usd_per_million=settings.input_usd_per_million,
    output_usd_per_million=settings.output_usd_per_million,
)
```

成本只能基于一个带版本的价格快照估算：

```text
estimated_cost = input_tokens × input_price
               + output_tokens × output_price
```

模型价格会变化，不能把某个厂商当前价格长期写死在业务代码里。
若 Provider 不返回 usage，成本应记录为 `null`，不能用字符数伪造 Token。
基线报告必须同时保存 `price_version`，否则历史成本无法复算。

日志中不要记录 API Key，也不要默认记录完整 Prompt 和用户输入。优先记录 ID、版本、长度、哈希或受控存储引用。

本地可以让日志采集器把 `gateway.model_call` 输出保存为 JSONL；
生产环境应发送到日志平台或 Trace 后端。
无论使用哪种存储，都要能够按 `run_id` 找到全部 `call_id`，
并按 `tenant_id` 控制查询权限。

## 九、第八步：统一对外错误协议

Gateway 对外至少稳定提供以下错误码：

| 错误码 | HTTP 状态 | 含义 |
| --- | ---: | --- |
| `model_route_not_found` | 400 | 请求了未开放的逻辑路由 |
| `provider_bad_request` | 400 | Adapter 请求与 Provider 能力不匹配 |
| `provider_auth_failed` | 502 | Gateway 的上游凭据无效，不向调用方暴露细节 |
| `provider_timeout` | 504 | 模型服务在预算内未响应 |
| `provider_rate_limited` | 429 | 当前没有可用容量 |
| `provider_unavailable` | 503 | Provider 暂时不可用 |
| `gateway_auth_failed` | 401 | 调用方 API Key 无效、过期或已撤销 |
| `gateway_rate_limited` | 429 | 当前租户超过 Gateway 配额 |
| `all_model_routes_failed` | 503 | 所有候选目标失败 |
| `invalid_provider_response` | 502 | Provider 响应协议异常 |
| `invalid_structured_output` | 502 | 内容不满足业务 Schema |

HTTP 状态告诉调用方失败属于哪一类，业务错误码用于稳定处理。不要把 Provider 的英文错误文本直接当作 API 协议。

在 `app/main.py` 中集中映射状态：

```python
PROVIDER_ERROR_STATUS = {
    "model_route_not_found": 400,
    "provider_bad_request": 400,
    "provider_auth_failed": 502,
    "provider_rate_limited": 429,
    "provider_timeout": 504,
    "provider_unavailable": 503,
    "all_model_routes_failed": 503,
    "invalid_provider_response": 502,
}


@app.middleware("http")
async def attach_run_id(request: Request, call_next):
    request.state.run_id = str(uuid.uuid4())
    response = await call_next(request)
    response.headers["X-Run-ID"] = request.state.run_id
    return response


@app.exception_handler(ProviderError)
async def handle_provider_error(
    request: Request,
    error: ProviderError,
) -> JSONResponse:
    payload = ErrorResponse(
        code=error.code,
        message=error.message,
        run_id=request.state.run_id,
    )
    headers = {}
    if error.retry_after_seconds is not None:
        headers["Retry-After"] = str(error.retry_after_seconds)
    return JSONResponse(
        status_code=PROVIDER_ERROR_STATUS.get(error.code, 502),
        content=payload.model_dump(),
        headers=headers,
    )
```

上面代码中，上游 401/403 返回 `provider_auth_failed / 502`，而不是把 401 原样传给用户。

调用方已经通过 Gateway 鉴权，上游凭据失效是 Gateway 配置问题。
原样返回 401，会让调用方误以为自己的 Key 有问题。
`gateway_rate_limited` 则由前面的租户限流中间件直接返回。

同时让 `ChatService.chat()` 接受入口创建的 `run_id` 和租户信息，成功响应、限流响应与模型调用记录都使用同一个值：

```python
async def chat(
    self,
    request: ChatRequest,
    *,
    run_id: str,
    tenant_id: str,
) -> ChatResponse:
    result = await observed_complete(
        provider=self.provider,
        messages=request.messages,
        model=request.model,
        context=CallContext(
            run_id=run_id,
            tenant_id=tenant_id,
            request_kind="chat",
            prompt_id=None,
            prompt_version=None,
            schema_version=None,
            generation=request.generation,
        ),
        price=self.price_snapshot,
    )
    # 使用同一个 run_id 组装 ChatResponse
```

HTTP 路由把同一个 ID 传给服务层：

```python
@app.post("/v1/chat", response_model=ChatResponse)
async def chat(payload: ChatRequest, request: Request) -> ChatResponse:
    return await chat_service.chat(
        payload,
        run_id=request.state.run_id,
        tenant_id=request.state.tenant.tenant_id,
    )
```

摘要与 Streaming 接口使用同样方式传入 `request.state.run_id`。
如果未来允许外部系统提供请求 ID，必须先限制长度和字符集，
不能把任意 Header 原样写入日志。

HTTP 请求 ID 和模型 Run ID 在第一章可以使用同一个值。
未来一次 Agent Run 包含多次模型调用时，再拆分 Trace、Span 和 Model Call ID。

## 十、第九步：故障演练

至少完成六组演练并记录结果：

1. 把超时设为极小值，确认发生有限重试并返回 `provider_timeout`。
2. 使用不存在的逻辑路由，确认请求在调用 Provider 前失败。
3. 让主模型返回 500，确认可以切到备用模型。
4. 让 Provider 返回 401，确认不会重复重试无效凭据。
5. 让 Provider 返回 429 和 `Retry-After: 2`，确认错误码为
   `provider_rate_limited`，并在预算允许时等待后重试。
6. 用同一租户超过 Gateway 配额，确认模型没有被调用，
   响应为 `gateway_rate_limited` 且包含限流响应头。

每次演练都检查 `run_id`、重试次数、最终模型、耗时和错误码是否进入结构化日志。

## 十一、本课验收

完成本课后，请确认：

- 调用方使用逻辑模型别名，不感知具体厂商模型名
- 只有瞬时错误会进入有限重试
- 每个目标和整个请求都有明确预算
- 主目标失败后可以切换到经过配置的备用目标
- Gateway 租户限流与 Provider 429 使用不同错误码
- Provider 429 不会被折叠成普通 502，并能在预算内尊重 `Retry-After`
- Mock 只用于开发和测试，不伪装成生产回答
- Streaming 在首个事件发送后不会静默切换模型并拼接两段输出

## 十二、小结

今天就讲到这里。这一课把失败分类、有限重试、逻辑路由和 fallback 接到了同一条链路上。

调用方看到的是稳定别名和稳定错误码，看不到厂商模型名，也看不到上游原始响应。

下一课会建立调用观测与成本治理，让每次重试和 fallback 都留下可聚合、可查询的 Run 与 Attempt 记录。

如果你看到了结尾，说明你已经把 Gateway 的可靠性控制面接上了。下一课见。
