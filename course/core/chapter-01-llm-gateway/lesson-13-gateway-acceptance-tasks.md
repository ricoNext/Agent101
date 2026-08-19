# 第 13 课：构建 Gateway 验收任务集

> 所属章节：[第一章：LLM API、Prompt、Structured Output 与 Gateway](./index.md)  
> 上一课：[第 12 课：创建 Gateway 前端控制台](./lesson-12-gateway-console.md)  
> 下一课：[第 14 课：实现基线 Runner 与评测报告](./lesson-14-baseline-runner-report.md)  
> [参考代码基线](https://github.com/ricoNext/agent-platform/tree/chapter-07)

## 一、你将完成什么

本课先回答“Gateway 应该测什么”，暂不生成最终基线报告。你会把普通调用、Structured Output、Streaming 和故障恢复整理成可长期复用的验收任务，并为 Mock Provider 增加受控故障场景。

完成后应得到三类产物：

- `tests/test_chat_service.py`：验证服务内部的稳定契约。
- `packages/evals/chapter_01_golden_tasks.json`：保存跨接口验收任务。
- `ScenarioProvider`：稳定复现纠错、限流、鉴权和慢流场景。

单元测试负责快速定位局部回归，Golden Task 负责保存用户任务和跨版本基线。两者不能互相替代。

## 二、先定义验收边界

第一章只验证 Gateway，不提前评测 Tool Runtime 或 Agent Loop。任务集至少覆盖：

| 能力 | 成功路径 | 失败或恢复路径 |
| --- | --- | --- |
| 普通调用 | 返回文本、模型和 `run_id` | 空消息、未知逻辑路由 |
| Structured Output | 返回符合业务 Schema 的摘要 | 首次非法后纠错、纠错耗尽 |
| 模型可靠性 | 正常完成或按配置 fallback | Provider 429、Provider 401 |
| Streaming | 事件有序且存在明确终态 | 首个增量后取消、异常终态 |
| 可观测性 | 调用记录可以按 `run_id` 关联 | Token 缺失时保持 `null` |

任务只断言稳定协议，不断言真实模型必须逐字返回某段文本。

## 三、覆盖三条核心调用链

创建 `apps/api/tests/test_chat_service.py`，使用 Mock Provider 验证普通聊天、结构化摘要和流式事件：

```python
import json

import pytest

from app.providers.mock import MockProvider
from app.schemas import ChatMessage, ChatRequest, SummaryRequest
from app.services import ChatService


@pytest.mark.asyncio
async def test_chat_service_returns_stable_contract() -> None:
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
        SummaryRequest(text="结构化结果必须通过业务 Schema 校验。")
    )

    assert response.run_id
    assert response.result.title == "Mock 摘要"
    assert response.result.keywords
    assert response.prompt_id == "summary.basic"
    assert response.prompt_version == "1.0.0"


@pytest.mark.asyncio
async def test_stream_has_ordered_terminal_event() -> None:
    service = ChatService(provider=MockProvider())
    request = ChatRequest(
        messages=[ChatMessage(role="user", content="流式测试")]
    )

    events = [
        json.loads(raw.removeprefix("data: ").strip())
        async for raw in service.stream(request)
    ]

    assert events[0]["event"] == "run.started"
    assert events[-1]["event"] == "run.completed"
    assert events[-1]["data"]["usage"] is None
    assert {item["run_id"] for item in events} == {events[0]["run_id"]}
    assert [item["sequence"] for item in events] == list(
        range(1, len(events) + 1)
    )
```

真实模型输出具有随机性，不应进入基础单元测试。真实 Provider 的对比留到第 14 课交给 Runner 重复执行。

## 四、设计 Golden Task 契约

创建 `packages/evals/chapter_01_golden_tasks.json`。每条任务使用稳定 ID，并明确运行环境、请求、预期状态和机器可检查字段：

```json
[
  {
    "id": "gateway-chat-001",
    "category": "chat",
    "environments": ["mock", "real-model"],
    "request": {
      "method": "POST",
      "path": "/v1/chat",
      "json": {
        "generation": {
          "temperature": 0.2,
          "top_p": 1.0,
          "max_output_tokens": 256
        },
        "messages": [{"role": "user", "content": "你好"}]
      }
    },
    "expected_status": 200,
    "must_have": ["run_id", "text", "model", "latency_ms"],
    "must_not_have": ["error"]
  },
  {
    "id": "gateway-summary-001",
    "category": "structured-output",
    "environments": ["mock", "real-model"],
    "request": {
      "method": "POST",
      "path": "/v1/summaries",
      "json": {
        "text": "结构化输出必须经过 JSON 解析和业务 Schema 校验。"
      }
    },
    "expected_status": 200,
    "must_have": [
      "run_id",
      "schema_version",
      "result.title",
      "result.summary",
      "result.keywords",
      "prompt_id",
      "prompt_version"
    ]
  },
  {
    "id": "gateway-stream-001",
    "category": "streaming",
    "environments": ["mock", "real-model"],
    "request": {
      "method": "POST",
      "path": "/v1/chat/stream",
      "json": {
        "messages": [{"role": "user", "content": "流式测试"}]
      }
    },
    "expected_status": 200,
    "expected_events": ["run.started", "message.delta", "run.completed"],
    "must_have": ["run_id", "sequence", "data.usage"]
  },
  {
    "id": "gateway-structured-repair-001",
    "category": "structured-output",
    "scenario": "structured-repair-once",
    "environments": ["mock"],
    "request": {
      "method": "POST",
      "path": "/v1/summaries",
      "json": {"text": "第一次非法，纠错后应符合 summary.v1。"}
    },
    "expected_status": 200,
    "must_have": ["run_id", "schema_version", "result.summary"]
  },
  {
    "id": "gateway-provider-429-001",
    "category": "reliability",
    "scenario": "provider-429",
    "environments": ["mock"],
    "request": {
      "method": "POST",
      "path": "/v1/chat",
      "json": {
        "messages": [{"role": "user", "content": "触发限流"}]
      }
    },
    "expected_status": 429,
    "must_have": ["run_id", "code", "message"]
  },
  {
    "id": "gateway-stream-cancel-001",
    "category": "streaming",
    "scenario": "slow-stream",
    "environments": ["mock"],
    "cancel_after_event": "message.delta",
    "request": {
      "method": "POST",
      "path": "/v1/chat/stream",
      "json": {
        "messages": [{"role": "user", "content": "取消流"}]
      }
    },
    "expected_status": 200,
    "expected_events": ["run.started", "message.delta"],
    "must_have": ["run_id", "sequence"]
  }
]
```

继续补充下面四条任务，保持同一字段结构：

| 任务 ID | 场景 | 期望结果 |
| --- | --- | --- |
| `gateway-chat-invalid-001` | 空消息 | HTTP `422`，包含 `detail` |
| `gateway-route-invalid-001` | 未配置逻辑路由 | HTTP `400`，包含稳定错误码 |
| `gateway-structured-exhausted-001` | 两次输出均非法 | HTTP `502`，明确失败 |
| `gateway-provider-401-001` | 上游鉴权失败 | 不重试，转换为 Gateway 错误 |

真实模型环境不伪造 401、429 或非法 JSON，只执行能在相同输入下公平比较的任务。

## 五、实现受控故障 Provider

测试场景不得由生产客户端直接选择。创建 `app/providers/scenario.py`，只在基线模式下包装 Mock Provider：

```python
import asyncio
from collections.abc import AsyncIterator
from contextvars import ContextVar
from dataclasses import dataclass, replace

from app.providers.base import ModelProvider, ProviderError, ProviderResult
from app.schemas import ChatMessage, GenerationConfig


@dataclass
class ScenarioState:
    name: str
    call_count: int = 0


scenario_state: ContextVar[ScenarioState | None] = ContextVar(
    "baseline_scenario",
    default=None,
)


class ScenarioProvider:
    def __init__(self, delegate: ModelProvider) -> None:
        self.delegate = delegate

    async def complete(
        self,
        *,
        messages: list[ChatMessage],
        model: str | None = None,
        generation: GenerationConfig | None = None,
    ) -> ProviderResult:
        state = scenario_state.get()
        if state:
            state.call_count += 1
            if state.name == "provider-429":
                raise ProviderError(
                    "provider_rate_limited",
                    "基线场景：Provider 限流",
                    retryable=True,
                    fallback_allowed=True,
                    status_code=429,
                    retry_after_seconds=1,
                )
            if state.name == "provider-401":
                raise ProviderError(
                    "provider_auth_failed",
                    "基线场景：Provider 鉴权失败",
                    status_code=401,
                )

        result = await self.delegate.complete(
            messages=messages,
            model=model,
            generation=generation,
        )
        should_corrupt = state and (
            state.name == "structured-always-invalid"
            or (
                state.name == "structured-repair-once"
                and state.call_count == 1
            )
        )
        return replace(result, text="not valid json") if should_corrupt else result

    async def stream(
        self,
        *,
        messages: list[ChatMessage],
        model: str | None = None,
        generation: GenerationConfig | None = None,
    ) -> AsyncIterator[str]:
        state = scenario_state.get()
        async for text in self.delegate.stream(
            messages=messages,
            model=model,
            generation=generation,
        ):
            if state and state.name == "slow-stream":
                await asyncio.sleep(0.2)
            yield text
```

在 `Settings` 中增加 `baseline_mode: bool = False`。只有 `BASELINE_MODE=true` 且 `MODEL_PROVIDER=mock` 时才能装配 `ScenarioProvider`，其他组合应拒绝启动。

中间件只在基线模式读取 `X-Baseline-Scenario`，并使用 `ContextVar` 隔离并发请求：

```python
ALLOWED_SCENARIOS = {
    "default",
    "structured-repair-once",
    "structured-always-invalid",
    "provider-429",
    "provider-401",
    "slow-stream",
}


@app.middleware("http")
async def attach_baseline_scenario(request: Request, call_next):
    if not settings.baseline_mode:
        return await call_next(request)

    name = request.headers.get("X-Baseline-Scenario", "default")
    if name not in ALLOWED_SCENARIOS:
        return JSONResponse(
            status_code=400,
            content={"code": "invalid_scenario"},
        )

    token = scenario_state.set(ScenarioState(name=name))
    try:
        return await call_next(request)
    finally:
        scenario_state.reset(token)
```

## 六、本课验收

- 三条核心调用链可以完全离线执行。
- Golden Task 同时覆盖成功、校验失败、结构化恢复、限流、鉴权、Streaming 和取消。
- 每条任务都有稳定 ID、分类、运行环境和机器可检查断言。
- 故障场景只能在 Mock 基线环境开启。
- 并发请求的故障状态不会互相污染。
- 任务集不依赖真实模型的固定措辞。

本课只完成“定义任务”。下一课会实现 Runner，重复执行这些任务并生成可比较的事实数据和基线报告。

