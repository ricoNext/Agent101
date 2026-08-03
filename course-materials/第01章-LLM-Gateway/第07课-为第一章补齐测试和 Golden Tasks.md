# 第 7 课：为第一章补齐测试和 Golden Tasks

> 所属章节：[第 1 章：从零构建 LLM Gateway](./README.md)  
> 上一课：[第 6 课：创建前端流式对话页](./第06课-创建前端流式对话页.md)

### 你将完成什么

把“手动点一下能跑”变成最小可回归验证。后续每章都会继续往这份任务集增加案例。

### 第一步：测试聊天服务

创建 `tests/test_chat_service.py`：

```python
import pytest

from app.providers.mock import MockProvider
from app.schemas import ChatMessage, ChatRequest
from app.services import ChatService


@pytest.mark.asyncio
async def test_chat_service_returns_run_id_and_mock_text() -> None:
    service = ChatService(provider=MockProvider())
    response = await service.chat(
        ChatRequest(messages=[ChatMessage(role="user", content="测试消息")])
    )

    assert response.run_id
    assert response.text == "Mock 回复：我收到了『测试消息』"
    assert response.model == "mock-1"
    assert response.latency_ms >= 0
```

### 第二步：创建第一批 Golden Tasks

创建 `../../packages/evals/chapter_01_golden_tasks.json`：

```json
[
  {
    "id": "chat-001",
    "input": "你好",
    "expected": "服务返回非空文本和 run_id"
  },
  {
    "id": "chat-002",
    "input": "解释什么是 Token",
    "expected": "服务可完成请求，后续由真实模型人工检查内容"
  },
  {
    "id": "chat-003",
    "input": "",
    "expected": "请求被 Pydantic 拒绝"
  },
  {
    "id": "stream-001",
    "input": "流式测试",
    "expected": "事件从 run.started 开始，并以 run.completed 结束"
  }
]
```

这里的 JSON 先作为任务资产保存，不要求你立刻写完整评测框架。第六章会读取它们并批量运行。

### 第三步：本章最终检查

后端：

```bash
cd agent-platform/apps/api
source .venv/bin/activate
pytest -q
uvicorn app.main:app --reload --port 8000
```

前端：

```bash
cd agent-platform/apps/web
npm run dev
```

最终目录应至少包含：

```text
agent-platform/
├── apps/
│   ├── api/
│   │   ├── app/
│   │   │   ├── config.py
│   │   │   ├── events.py
│   │   │   ├── main.py
│   │   │   ├── schemas.py
│   │   │   ├── services.py
│   │   │   └── providers/
│   │   └── tests/
│   └── web/
│       └── src/app/page.tsx
└── packages/evals/chapter_01_golden_tasks.json
```

### 第一章最终验收

- Mock Provider 模式可以完全离线运行；
- 真实 Provider 模式通过环境变量切换；
- 普通聊天和 SSE 流式聊天可运行；
- 浏览器可停止请求并显示错误；
- 结构化输出校验有测试；
- 任务集文件已创建；
- 密钥未提交到 Git。

### 进入第二章前的复盘

回答以下问题，并写入 `docs/chapter-01-retrospective.md`：

1. 你的前端为什么不能保存模型 API Key？
2. Mock Provider 解决了什么问题？
3. 为什么要把 Provider 原始 SSE 转成自己的事件协议？
4. 如果模型返回了合法 JSON，但缺少业务字段，系统应该怎样处理？
5. `run_id` 在后续 Agent 系统中将用于什么？

下一章开始时，不要删除这一章的 Gateway、事件和 Golden Tasks。Tool Runtime 会直接建立在这些能力之上。
