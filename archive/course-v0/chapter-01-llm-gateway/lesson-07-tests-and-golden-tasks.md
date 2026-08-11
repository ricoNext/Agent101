# 第 7 课：为第一章补齐测试和 Golden Tasks

> 所属章节：[第 1 章：从零构建 LLM Gateway](./index.md)  
> 上一课：[第 6 课：创建前端流式对话页](./lesson-06-frontend-streaming-chat.md)
> [课程代码](https://github.com/ricoNext/agent-platform/tree/chapter-07)

## 一、你将完成什么

把“手动点一下能跑”变成最小可回归验证。后续每章都会继续往这份任务集增加案例。

## 二、第一步：覆盖三条核心调用链

创建 `tests/test_chat_service.py`。同一个文件覆盖普通聊天、结构化摘要和流式事件，不依赖真实模型：

```python
import json

import pytest

from app.providers.mock import MockProvider
from app.schemas import ChatMessage, ChatRequest, SummaryRequest
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


@pytest.mark.asyncio
async def test_summary_returns_validated_result() -> None:
    service = ChatService(provider=MockProvider())

    response = await service.summarize(
        SummaryRequest(text="结构化摘要必须经过业务 Schema 校验后才能返回给调用方。")
    )

    assert response.run_id
    assert response.result.title == "Mock 摘要"
    assert response.result.keywords
    assert response.model == "mock-1"


@pytest.mark.asyncio
async def test_stream_has_ordered_terminal_event() -> None:
    service = ChatService(provider=MockProvider())
    request = ChatRequest(
        messages=[ChatMessage(role="user", content="流式测试")]
    )

    events = [
        json.loads(raw_event.removeprefix("data: ").strip())
        async for raw_event in service.stream(request)
    ]

    assert events[0]["event"] == "run.started"
    assert events[-1]["event"] == "run.completed"
    assert {event["run_id"] for event in events} == {events[0]["run_id"]}
    assert [event["sequence"] for event in events] == list(
        range(1, len(events) + 1)
    )
    assert events[-1]["data"]["latency_ms"] >= 0
    assert events[-1]["data"]["output_characters"] > 0
```

这三条测试验证的是稳定契约，不是模型答案质量。真实 Provider 的内容具有随机性，不应直接写进基础单元测试。

## 三、第二步：创建第一批 Golden Tasks

创建 `../../packages/evals/chapter_01_golden_tasks.json`：

```json
[
  {
    "id": "gateway-chat-001",
    "category": "chat",
    "request": {
      "method": "POST",
      "path": "/v1/chat",
      "json": {
        "messages": [{"role": "user", "content": "你好"}]
      }
    },
    "expected_status": 200,
    "must_have": ["run_id", "text", "model", "latency_ms"],
    "must_not_have": ["error"]
  },
  {
    "id": "gateway-chat-invalid-001",
    "category": "validation",
    "request": {
      "method": "POST",
      "path": "/v1/chat",
      "json": {"messages": [{"role": "user", "content": ""}]}
    },
    "expected_status": 422,
    "must_have": ["detail"]
  },
  {
    "id": "gateway-summary-001",
    "category": "structured-output",
    "request": {
      "method": "POST",
      "path": "/v1/summaries",
      "json": {
        "text": "结构化输出必须先经过 JSON 解析和业务 Schema 校验，才能进入后续流程。"
      }
    },
    "expected_status": 200,
    "must_have": ["run_id", "result.title", "result.summary", "result.keywords"],
    "must_not_have": ["detail"]
  },
  {
    "id": "gateway-stream-001",
    "category": "streaming",
    "request": {
      "method": "POST",
      "path": "/v1/chat/stream",
      "json": {
        "messages": [{"role": "user", "content": "流式测试"}]
      }
    },
    "expected_status": 200,
    "expected_events": ["run.started", "message.delta", "run.completed"],
    "must_have": ["run_id", "sequence", "data.latency_ms"]
  }
]
```

每条任务现在都有稳定 ID、分类、完整 HTTP 请求、预期状态码和机器可检查属性。第一章先保存这份资产，不要求立刻实现批量 Runner；第六章会读取同一结构，继续增加成本、引用和质量评分。

Golden Task 不是单元测试的另一种写法。单元测试验证局部代码契约；Golden Task 保存跨接口、跨模型版本都需要长期观察的用户任务。

## 四、第三步：手工检查接口矩阵

启动 API 后，逐项确认：

| 接口 | 成功路径 | 失败路径 |
|------|----------|----------|
| `GET /health` | 返回当前 Provider | 服务无法启动时先检查配置 |
| `POST /v1/chat` | 返回文本、usage 和耗时 | 空消息返回 `422` |
| `POST /v1/summaries` | 返回经过 Schema 校验的摘要 | 非法模型结构返回 `502` |
| `POST /v1/chat/stream` | 事件有序并正常结束 | Provider 异常时返回 `run.failed` |

前端还要确认成功、停止、后端离线和异常断流四种状态。不能只验证“页面能打开”。

## 五、第四步：本章最终检查

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
│   │   │   ├── __init__.py
│   │   │   ├── config.py
│   │   │   ├── events.py
│   │   │   ├── main.py
│   │   │   ├── schemas.py
│   │   │   ├── services.py
│   │   │   ├── structured.py
│   │   │   └── providers/
│   │   │       ├── __init__.py
│   │   │       ├── base.py
│   │   │       ├── factory.py
│   │   │       ├── mock.py
│   │   │       └── openai_compatible.py
│   │   ├── tests/
│   │   │   ├── test_chat_service.py
│   │   │   ├── test_health.py
│   │   │   └── test_structured.py
│   │   ├── .env.example
│   │   ├── pytest.ini
│   │   └── requirements.txt
│   └── web/
│       ├── src/app/page.tsx
│       ├── .env.local
│       ├── package.json
│       └── package-lock.json
└── packages/evals/chapter_01_golden_tasks.json
```

## 六、第一章最终验收

- Mock Provider 模式可以完全离线运行
- 真实 Provider 模式只通过环境变量切换，不修改业务代码
- 普通聊天返回 `run_id`、模型、usage 和耗时
- 结构化摘要接口只返回经过 Schema 校验的结果
- SSE 事件有统一结构、递增序号、终态和耗时
- 浏览器能处理成功、失败、停止和异常断流
- 后端核心调用链有稳定 Mock 测试
- Golden Tasks 包含可执行请求和机器可检查断言
- `.env`、API Key 和 Provider 原始错误没有泄露到 Git 或浏览器

## 七、进入第二章前的复盘

回答以下问题，并写入 `docs/chapter-01-retrospective.md`：

1. 你的前端为什么不能保存模型 API Key？
2. Mock Provider 解决了什么问题？
3. 为什么要把 Provider 原始 SSE 转成自己的事件协议？
4. 如果模型返回了合法 JSON，但缺少业务字段，系统应该怎样处理？
5. `run_id` 在后续 Agent 系统中将用于什么？
6. 为什么流式输出字符数不能直接当作 Token usage？
7. 单元测试和 Golden Task 分别防止哪类回归？

下一章开始时，不要删除这一章的 Gateway、事件和 Golden Tasks。Tool Runtime 会直接建立在这些能力之上。
