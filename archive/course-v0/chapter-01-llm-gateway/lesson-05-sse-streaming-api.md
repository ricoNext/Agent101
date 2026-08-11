# 第 5 课：实现 SSE 流式接口

> 所属章节：[第 1 章：从零构建 LLM Gateway](./index.md)  
> 上一课：[第 4 课：结构化输出和错误边界](./lesson-04-structured-output-error-boundary.md)  
> 下一课：[第 6 课：创建前端流式对话页](./lesson-06-frontend-streaming-chat.md)  
> [课程代码](https://github.com/ricoNext/agent-platform/tree/chapter-05)

## 一、前言

上一课，我们已经把结构化输出的校验边界立住了。合法 JSON 能进业务结构，非法输出会明确失败。

事情到这里，聊天接口还缺一块体验：整段文本一次性返回。用户要干等，前端也没法逐字显示。

**流式输出，就是为了解决这个问题。**

所谓 **SSE（Server-Sent Events）**，字面上讲，就是服务器持续往客户端推事件。

但是，更准确的说法是：你先定义一套自己的事件协议，再把 Provider 的字符流翻译成这套协议。

前端只认识你的事件，不直接认识任何 Provider 的原始 SSE 格式。

所以今天接着往下讲：把字符流转成统一事件流。

这一课只做五件事：

1. 定义事件编码函数
2. 在 `ChatService` 里加流式方法
3. 新增 `/v1/chat/stream` 接口并用 `curl` 验证
4. 在结束事件中记录耗时和输出规模
5. 故意制造失败，确认能收到 `run.failed`

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
import logging
import time
import uuid
from collections.abc import AsyncIterator

from app.events import sse_event

logger = logging.getLogger(__name__)


class ChatService:
    # 保留前面已有的 __init__ 和 chat 方法

    async def stream(self, request: ChatRequest) -> AsyncIterator[str]:
        run_id = str(uuid.uuid4())
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
            async for text in self.provider.stream(
                messages=request.messages,
                model=request.model,
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
```

上面代码中，事件顺序很固定。

**（1）先发 `run.started`**

告诉前端：这次调用开始了，并带上模型信息。

**（2）再循环发 `message.delta`**

Provider 每吐出一段文本，就包装成一条增量事件。`sequence` 递增。

**（3）正常结束发 `run.completed`，异常发 `run.failed`**

不是……让连接默默断开；而是……主动给前端一个可处理的结束事件。

结束事件记录本次流式调用的耗时和输出字符数。当前最小 Provider 协议只产出文本，没有可靠的流式 usage，因此这里不把字符数冒充 Token；以后扩展 Provider 事件协议时，再接入服务商返回的真实 usage。

服务端使用 `logger.exception()` 保存完整异常，浏览器只收到稳定错误码和脱敏文案。不能把 Provider 的响应体、URL 或鉴权信息直接返回给前端。

## 四、第三步：新增接口

服务层有了流，HTTP 层还要把它暴露出去。

在 `app/main.py` 增加导入：

```python
from fastapi.responses import StreamingResponse
```

再增加路由：

```python
@app.post("/v1/chat/stream")
async def stream_chat(request: ChatRequest) -> StreamingResponse:
    return StreamingResponse(
        chat_service.stream(request),
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

**（3）禁止缓存和代理缓冲**

`Cache-Control: no-cache` 避免缓存事件流，`X-Accel-Buffering: no` 提示常见反向代理不要攒够一批数据再返回。生产部署时仍要核对实际网关的流式配置。

下面用 `curl` 测一下：

```bash
curl -N -X POST http://127.0.0.1:8000/v1/chat/stream \
  -H 'content-type: application/json' \
  -d '{"messages":[{"role":"user","content":"请用一句话解释流式输出"}]}'
```

上面命令加了 `-N`，意思是关闭缓冲，边收边显示。预期会连续看到多行 `data: {...}`，最后一条事件为 `run.completed`。

## 五、第四步：故意制造流式失败

成功路径跑通以后，还要验证失败路径。

把 `.env` 的 Provider 改成错误地址，或临时在 `MockProvider.stream` 中抛出异常。

你应该收到 `run.failed`，而不是浏览器一直等待。

需要强调一下：流式接口最怕「半路静默」。前端如果收不到结束事件，就会一直转圈。把失败也编码成事件，是这条链路能上线的前提之一。

## 六、本课验收

完成本课后，请确认以下四项：

- `/v1/chat/stream` 返回 SSE
- 事件顺序从 `run.started` 开始，以 `run.completed` 或 `run.failed` 结束
- 每个事件有同一个 `run_id` 和递增 `sequence`
- `run.completed` 包含 `latency_ms` 和 `output_characters`
- 失败也会发送一个可处理事件

## 七、小结

今天就讲到这里。这一课我们做了四件事：

- 定义统一事件编码
- 在服务层翻译 Provider 字符流
- 暴露 `/v1/chat/stream`
- 在结束事件记录耗时和输出规模
- 验证失败也会发 `run.failed`

前端只认你的协议，不认某一家 Provider 的原始格式——换模型时，页面逻辑才站得住。下一篇教程将讲解如何创建前端流式对话页。

如果你看到了结尾，说明你已经把「流式事件协议」这一环接上了。下一课见。
---
