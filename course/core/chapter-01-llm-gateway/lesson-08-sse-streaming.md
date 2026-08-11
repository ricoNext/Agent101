# 第 8 课：实现可取消的 SSE 流式接口

> 所属章节：[第一章：LLM API、Prompt、Structured Output 与 Gateway](./index.md)  
> 上一课：[第 7 课：实现可靠性策略与模型路由](./lesson-07-reliability-routing.md)  
> 下一课：[第 9 课：创建 Gateway 前端控制台](./lesson-09-frontend-gateway-console.md)  
> [参考代码基线](https://github.com/ricoNext/agent-platform/tree/chapter-05)

## 一、前言

上一课，我们已经把普通调用的超时、重试、fallback 和错误映射做成统一策略。现在继续处理流式调用的交互与资源边界。

事情到这里，聊天接口还缺一块体验：整段文本一次性返回。用户要干等，前端也没法逐字显示。

**流式输出，就是为了解决这个问题。**

所谓 **SSE（Server-Sent Events）**，字面上讲，就是服务器持续往客户端推事件。

但是，更准确的说法是：你先定义一套自己的事件协议，再把 Provider 的字符流翻译成这套协议。

前端只认识你的事件，不直接认识任何 Provider 的原始 SSE 格式。

所以今天接着往下讲：把字符流转成统一事件流。

这一课只做六件事：

1. 定义事件编码函数
2. 在 `ChatService` 里加流式方法
3. 新增 `/v1/chat/stream` 接口并用 `curl` 验证
4. 在结束事件中记录耗时和输出规模
5. 故意制造失败，确认能收到 `run.failed`
6. 取消客户端请求，确认 Provider 流和服务端生成器被关闭

建议先跟着例子做一遍，再读文字说明。

## 二、第一步：定义事件编码函数

先把「一条 SSE 事件长什么样」定下来。后面无论接 Mock 还是真实模型，都走同一套编码。

创建 `app/events.py`：

```python
import json
from datetime import UTC, datetime
from typing import Any


def sse_event(
    *,
    event: str,
    run_id: str,
    sequence: int,
    data: dict[str, Any],
) -> str:
    payload = {
        "event": event,
        "run_id": run_id,
        "sequence": sequence,
        "data": data,
        "created_at": datetime.now(UTC).isoformat(),
    }
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"
```

解释一下上面代码的关键点。

**（1）`event` / `run_id` / `sequence`**

`event` 标明事件类型，比如开始、增量、完成、失败。`run_id` 把同一次调用串起来。`sequence` 保证事件有序，前端按序号拼接即可。

**（2）`data`**

真正的业务载荷放在这里。增量文本、错误码、模型名，都走这个字段。

**（3）`data: ...\n\n`**

这是 SSE 的最小帧格式：一行 `data:`，后面跟 JSON，再以空行结束。前端按这个边界切包。

必须牢记的是：统一事件协议属于你的 Gateway，不属于某一家模型厂商。换 Provider，不应换前端解析逻辑。

## 三、第二步：在聊天服务中添加流式方法

有了编码函数，就可以在服务层把 Provider 的字符流翻译成事件流。

在 `app/services.py` 中加入：

```python
import asyncio
import logging
import time
import uuid
from collections.abc import AsyncIterator
from datetime import UTC, datetime

from app.events import sse_event
from app.observability import CallContext, ModelCallRecord, write_model_call
from app.providers.base import ModelProvider, ProviderError

logger = logging.getLogger(__name__)


async def observed_stream(
    *,
    provider: ModelProvider,
    messages: list[ChatMessage],
    model: str | None,
    context: CallContext,
    price_version: str,
) -> AsyncIterator[str]:
    call_id = str(uuid.uuid4())
    started_at = time.perf_counter()
    status = "completed"
    error_code: str | None = None
    try:
        async for text in provider.stream(
            messages=messages,
            model=model,
            generation=context.generation,
        ):
            yield text
    except asyncio.CancelledError:
        status = "cancelled"
        raise
    except ProviderError as error:
        status = "failed"
        error_code = error.code
        raise
    except Exception:
        status = "failed"
        error_code = "unexpected_model_call_error"
        raise
    finally:
        write_model_call(
            ModelCallRecord(
                occurred_at=datetime.now(UTC).isoformat(),
                run_id=context.run_id,
                call_id=call_id,
                tenant_id=context.tenant_id,
                request_kind="stream",
                route=model or "default",
                model=None,
                prompt_id=context.prompt_id,
                prompt_version=context.prompt_version,
                schema_version=None,
                temperature=context.generation.temperature,
                top_p=context.generation.top_p,
                max_output_tokens=context.generation.max_output_tokens,
                input_tokens=None,
                output_tokens=None,
                latency_ms=int((time.perf_counter() - started_at) * 1000),
                estimated_cost_usd=None,
                price_version=price_version,
                attempt_count=1,
                retry_count=0,
                status=status,
                error_code=error_code,
            )
        )


class ChatService:
    # 保留前面已有的 __init__ 和 chat 方法

    async def stream(
        self,
        request: ChatRequest,
        *,
        run_id: str | None = None,
        tenant_id: str = "local-dev",
    ) -> AsyncIterator[str]:
        run_id = run_id or str(uuid.uuid4())
        started_at = time.perf_counter()
        output_characters = 0
        yield sse_event(
            event="run.started",
            run_id=run_id,
            sequence=1,
            data={"model": request.model},
        )
        sequence = 2
        try:
            async for text in observed_stream(
                provider=self.provider,
                messages=request.messages,
                model=request.model,
                context=CallContext(
                    run_id=run_id,
                    tenant_id=tenant_id,
                    request_kind="stream",
                    prompt_id=None,
                    prompt_version=None,
                    schema_version=None,
                    generation=request.generation,
                ),
                price_version=self.price_snapshot.version,
            ):
                output_characters += len(text)
                yield sse_event(
                    event="message.delta",
                    run_id=run_id,
                    sequence=sequence,
                    data={"text": text},
                )
                sequence += 1
            yield sse_event(
                event="run.completed",
                run_id=run_id,
                sequence=sequence,
                data={
                    "latency_ms": int((time.perf_counter() - started_at) * 1000),
                    "output_characters": output_characters,
                },
            )
        except asyncio.CancelledError:
            logger.info("stream cancelled", extra={"run_id": run_id})
            raise
        except Exception:
            logger.exception("stream model call failed", extra={"run_id": run_id})
            yield sse_event(
                event="run.failed",
                run_id=run_id,
                sequence=sequence,
                data={
                    "code": "model_call_failed",
                    "message": "模型调用失败，请稍后重试",
                    "latency_ms": int((time.perf_counter() - started_at) * 1000),
                },
            )
        finally:
            logger.info("stream closed", extra={"run_id": run_id})
```

上面代码中，事件顺序很固定。

**（1）先发 `run.started`**

告诉前端：这次调用开始了，并带上模型信息。

**（2）再循环发 `message.delta`**

Provider 每吐出一段文本，就包装成一条增量事件。`sequence` 递增。

**（3）正常结束发 `run.completed`，异常发 `run.failed`**

不要让连接默默断开，而要主动给前端一个可处理的结束事件。

结束事件记录本次流式调用的耗时和输出字符数。当前最小 Provider 协议只产出文本，没有可靠的流式 usage，因此这里不把字符数冒充 Token；以后扩展 Provider 事件协议时，再接入服务商返回的真实 usage。

服务端使用 `logger.exception()` 保存完整异常，浏览器只收到稳定错误码和脱敏文案。不能把 Provider 的响应体、URL 或鉴权信息直接返回给前端。

## 四、第三步：新增接口

服务层有了流，HTTP 层还要把它暴露出去。

在 `app/main.py` 增加导入：

```python
from collections.abc import AsyncIterator

from fastapi import Request
from fastapi.responses import StreamingResponse
```

再增加路由：

```python
@app.post("/v1/chat/stream")
async def stream_chat(
    payload: ChatRequest,
    http_request: Request,
) -> StreamingResponse:
    async def event_stream() -> AsyncIterator[str]:
        stream = chat_service.stream(
            payload,
            run_id=http_request.state.run_id,
            tenant_id=http_request.state.tenant.tenant_id,
        )
        try:
            async for event in stream:
                if await http_request.is_disconnected():
                    return
                yield event
        finally:
            await stream.aclose()

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
```

解释一下上面代码的关键点。

**（1）`StreamingResponse`**

所谓 **StreamingResponse**，就是 FastAPI 用来返回流式响应的类型。它不会等生成器跑完再一次性写出，而是边生成边推送。

**（2）`media_type="text/event-stream"`**

声明这是 SSE。浏览器和很多客户端会按事件流去读。

**（3）客户端断开与资源释放**

浏览器使用 `AbortController` 取消请求，或用户关闭页面后，ASGI 服务器会取消响应任务。路由同时使用 `is_disconnected()` 主动检查连接，并在 `finally` 中关闭服务层异步生成器。

`ChatService.stream()` 必须单独捕获 `asyncio.CancelledError`、记录取消并继续抛出。不能把取消包装成 `run.failed` 后继续写网络，因为客户端已经离开；继续抛出才能让 HTTPX 的流式上下文退出并关闭上游连接。

**（4）禁止缓存和代理缓冲**

`Cache-Control: no-cache` 避免缓存事件流，`X-Accel-Buffering: no` 提示常见反向代理不要攒够一批数据再返回。生产部署时仍要核对实际网关的流式配置。

下面用 `curl` 测一下：

```bash
curl -N -X POST http://127.0.0.1:8000/v1/chat/stream \
  -H 'content-type: application/json' \
  -d '{"messages":[{"role":"user","content":"请用一句话解释流式输出"}]}'
```

上面命令加了 `-N`，意思是关闭缓冲，边收边显示。预期会连续看到多行 `data: {...}`，最后一条事件为 `run.completed`。

## 五、第四步：验证取消

先使用 `curl -N` 发起一个较长的流式请求，在内容仍在输出时按 `Ctrl+C`。然后检查：

- 服务端出现 `stream cancelled` 和 `stream closed` 日志
- 上游 HTTP 连接被关闭
- 没有后台任务继续消耗 Token
- 取消不会触发新的 fallback 模型调用

浏览器端会在下一课使用 `AbortController.abort()` 做同样的验证。取消是预期交互，不应作为服务错误告警。

## 六、第五步：故意制造流式失败

成功路径跑通以后，还要验证失败路径。

把 `.env` 的 Provider 改成错误地址，或临时在 `MockProvider.stream` 中抛出异常。

你应该收到 `run.failed`，而不是浏览器一直等待。

需要强调一下：流式接口最怕「半路静默」。前端如果收不到结束事件，就会一直转圈。把失败也编码成事件，是这条链路能上线的前提之一。

## 七、本课验收

完成本课后，请逐项确认：

- `/v1/chat/stream` 返回 SSE
- 事件顺序从 `run.started` 开始，以 `run.completed` 或 `run.failed` 结束
- 每个事件有同一个 `run_id` 和递增 `sequence`
- `run.completed` 包含 `latency_ms` 和 `output_characters`
- 失败也会发送一个可处理事件
- 客户端取消后，异步生成器和上游连接会关闭
- 取消不会被包装为普通 Provider 失败或触发 fallback

## 八、小结

今天就讲到这里。这一课我们完成了六项工程增量：

- 定义统一事件编码
- 在服务层翻译 Provider 字符流
- 暴露 `/v1/chat/stream`
- 在结束事件记录耗时和输出规模
- 验证失败也会发 `run.failed`
- 验证取消会释放服务端和 Provider 资源

前端只认你的协议，不认某一家 Provider 的原始格式——换模型时，页面逻辑才站得住。下一课会创建能够选择逻辑模型路由、展示 Run ID 并取消生成的 Gateway 控制台。

如果你看到了结尾，说明你已经把「流式事件协议」这一环接上了。下一课见。
---
