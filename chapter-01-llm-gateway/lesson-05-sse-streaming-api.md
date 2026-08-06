# 第 5 课：实现 SSE 流式接口

> 所属章节：[第 1 章：从零构建 LLM Gateway](./index.md)  
> 上一课：[第 4 课：结构化输出和错误边界](./lesson-04-structured-output-error-boundary.md)  
> 下一课：[第 6 课：创建前端流式对话页](./lesson-06-frontend-streaming-chat.md)

### 你将完成什么

把 Provider 的字符流转换为统一事件流。前端只认识你的事件协议，不直接认识任何 Provider 的原始 SSE 格式。

### 第一步：定义事件编码函数

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
    return f"data: {json.dumps(payload, ensure_ascii=False)}\\n\\n"
```

### 第二步：在聊天服务中添加流式方法

在 `app/services.py` 中加入：

```python
from collections.abc import AsyncIterator
import uuid

from app.events import sse_event


class ChatService:
    # 保留前面已有的 __init__ 和 chat 方法

    async def stream(self, request: ChatRequest) -> AsyncIterator[str]:
        run_id = str(uuid.uuid4())
        yield sse_event(
            event="run.started",
            run_id=run_id,
            sequence=1,
            data={"model": request.model or "default"},
        )
        sequence = 2
        try:
            async for text in self.provider.stream(
                messages=request.messages,
                model=request.model,
            ):
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
                data={},
            )
        except Exception as error:
            yield sse_event(
                event="run.failed",
                run_id=run_id,
                sequence=sequence,
                data={"code": "model_call_failed", "message": str(error)},
            )
```

注意：这是教学版。生产环境中错误信息要脱敏，不能把 Provider 返回的所有内容直接给浏览器。

### 第三步：新增接口

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
        headers={"Cache-Control": "no-cache"},
    )
```

使用 `curl` 测试：

```bash
curl -N -X POST http://127.0.0.1:8000/v1/chat/stream \
  -H 'content-type: application/json' \
  -d '{"messages":[{"role":"user","content":"请用一句话解释流式输出"}]}'
```

预期会连续看到多行 `data: {...}`，最后一条事件为 `run.completed`。

### 第四步：故意制造流式失败

把 `.env` 的 Provider 改成错误地址，或临时在 `MockProvider.stream` 中抛出异常。你应该收到 `run.failed`，而不是浏览器一直等待。

### 本课验收

- `/v1/chat/stream` 返回 SSE；
- 事件顺序从 `run.started` 开始，以 `run.completed` 或 `run.failed` 结束；
- 每个事件有同一个 `run_id` 和递增 `sequence`；
- 失败也会发送一个可处理事件。

---
