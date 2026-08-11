# 第 10 课：建立模型基线并完成 M1 验收

> 所属章节：[第一章：LLM API、Prompt、Structured Output 与 Gateway](./index.md)  
> 上一课：[第 9 课：创建 Gateway 前端控制台](./lesson-09-frontend-gateway-console.md)  
> 下一章：[第二章：Function Calling、Tool Runtime 与 MCP](../chapter-02-tool-runtime-mcp/)  
> [参考代码基线](https://github.com/ricoNext/agent-platform/tree/chapter-07)

## 一、你将完成什么

把“手动点一下能跑”变成可复现的 M1 验收。你会统一检查接口契约、Prompt 版本、模型路由、Structured Output、Streaming、调用观测和失败路径，并输出第一份模型调用基线报告。后续每章都会继续往这份任务集增加案例。

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
    assert response.prompt_id == "summary.basic"
    assert response.prompt_version == "1.0.0"


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
    "must_have": [
      "run_id",
      "schema_version",
      "result.title",
      "result.summary",
      "result.keywords",
      "prompt_id",
      "prompt_version"
    ],
    "must_not_have": ["detail"]
  },
  {
    "id": "gateway-route-invalid-001",
    "category": "routing",
    "request": {
      "method": "POST",
      "path": "/v1/chat",
      "json": {
        "model": "not-configured",
        "messages": [{"role": "user", "content": "你好"}]
      }
    },
    "expected_status": 400,
    "must_have": ["code", "message", "run_id"]
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
  },
  {
    "id": "gateway-structured-repair-001",
    "category": "structured-output",
    "scenario": "structured-repair-once",
    "environments": ["mock"],
    "request": {
      "method": "POST",
      "path": "/v1/summaries",
      "json": {"text": "第一次生成非法 JSON，纠错后应返回符合 summary.v1 的摘要结果。"}
    },
    "expected_status": 200,
    "must_have": ["run_id", "schema_version", "result.summary"]
  },
  {
    "id": "gateway-structured-exhausted-001",
    "category": "structured-output",
    "scenario": "structured-always-invalid",
    "environments": ["mock"],
    "request": {
      "method": "POST",
      "path": "/v1/summaries",
      "json": {"text": "两次生成都不符合业务 Schema，接口必须明确失败。"}
    },
    "expected_status": 502,
    "must_have": ["run_id", "code", "message"]
  },
  {
    "id": "gateway-provider-429-001",
    "category": "reliability",
    "scenario": "provider-429",
    "environments": ["mock"],
    "request": {
      "method": "POST",
      "path": "/v1/chat",
      "json": {"messages": [{"role": "user", "content": "触发限流"}]}
    },
    "expected_status": 429,
    "must_have": ["run_id", "code", "message"]
  },
  {
    "id": "gateway-provider-401-001",
    "category": "reliability",
    "scenario": "provider-401",
    "environments": ["mock"],
    "request": {
      "method": "POST",
      "path": "/v1/chat",
      "json": {"messages": [{"role": "user", "content": "触发上游鉴权失败"}]}
    },
    "expected_status": 502,
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
      "json": {"messages": [{"role": "user", "content": "取消流"}]}
    },
    "expected_status": 200,
    "expected_events": ["run.started", "message.delta"],
    "must_have": ["run_id", "sequence"]
  }
]
```

每条任务现在都有稳定 ID、分类、完整 HTTP 请求、预期状态码和机器可检查属性。第一章实现最小 Runner，负责重复执行请求、校验协议并保存原始结果；第六章再沿用同一结构增加质量评分和回归门禁。

Golden Task 不是单元测试的另一种写法。单元测试验证局部代码契约；Golden Task 保存跨接口、跨模型版本都需要长期观察的用户任务。

### 3.1 增加可靠性场景

基线不能只包含成功请求。为可控 Mock Provider 增加 `scenario` 配置，并在任务集中补充：

| 任务 ID | 场景 | 期望结果 |
| --- | --- | --- |
| `gateway-structured-repair-001` | 第一次返回非法 JSON，第二次合法 | 成功，`retry_count=1` |
| `gateway-structured-exhausted-001` | 两次都返回非法 JSON | `invalid_structured_output / 502` |
| `gateway-provider-429-001` | Provider 返回 429 与 `Retry-After` | 有限重试，最终错误码保持 `provider_rate_limited` |
| `gateway-provider-401-001` | Provider 返回 401 | 不重试，返回 `provider_auth_failed` |
| `gateway-stream-cancel-001` | 首个增量后取消 | 上游关闭，没有遗留任务 |

这些场景只能在 Mock 或专用测试 Provider 中开启，生产请求不能接受客户端传入的 `scenario`。任务文件可以保存场景名，Runner 通过受控 Header 发送给基线环境。

可靠性任务增加 `"environments": ["mock"]`；普通聊天、摘要和 Streaming 任务使用 `"environments": ["mock", "real-model"]`。真实模型基线不伪造 401、429 等上游状态，只运行能够在相同输入条件下公平比较的任务。取消任务再增加 `"cancel_after_event": "message.delta"`，Runner 读到首个增量后主动关闭响应流。

为了让这些场景可以复现，创建仅在 `BASELINE_MODE=true` 时启用的 `ScenarioProvider`。使用 `ContextVar` 保存当前请求场景，避免并发请求互相覆盖：

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
        if state and (
            state.name == "structured-always-invalid"
            or (state.name == "structured-repair-once" and state.call_count == 1)
        ):
            return replace(result, text="not valid json")
        return result

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

入口中间件只在基线模式读取 Header，并在请求结束后恢复上下文：

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
        return JSONResponse(status_code=400, content={"code": "invalid_scenario"})
    token = scenario_state.set(ScenarioState(name=name))
    try:
        return await call_next(request)
    finally:
        scenario_state.reset(token)
```

`ScenarioProvider` 只能包装 Mock Provider。启动真实 Provider 或 `BASELINE_MODE=false` 时不得装配它，这可以防止调试 Header 进入生产控制面。

在 `Settings` 中增加 `baseline_mode: bool = False`。应用启动时只有 `settings.baseline_mode and settings.model_provider == "mock"` 同时成立，才用 `ScenarioProvider(MockProvider())`；其他组合直接拒绝启动，避免错误配置。

### 3.2 实现最小 Runner

创建 `packages/evals/run_chapter_01.py`：

```python
import asyncio
import json
import os
import time
from pathlib import Path
from typing import Any

import httpx


BASE_URL = os.getenv("GATEWAY_BASE_URL", "http://localhost:8000")
API_KEY = os.getenv("GATEWAY_API_KEY", "local-dev-key")
BASELINE_LABEL = os.getenv("BASELINE_LABEL", "mock")
REPEATS = int(os.getenv("BASELINE_REPEATS", "5"))
TASKS_PATH = Path(__file__).with_name("chapter_01_golden_tasks.json")
OUTPUT_PATH = Path(f"artifacts/chapter-01-runs-{BASELINE_LABEL}.jsonl")


def has_path(value: Any, path: str) -> bool:
    current = value
    for part in path.split("."):
        if not isinstance(current, dict) or part not in current:
            return False
        current = current[part]
    return True


def is_ordered_subsequence(expected: list[str], actual: list[str]) -> bool:
    position = 0
    for event_name in actual:
        if position < len(expected) and event_name == expected[position]:
            position += 1
    return position == len(expected)


async def execute_task(
    client: httpx.AsyncClient,
    task: dict[str, Any],
    repeat: int,
) -> dict[str, Any]:
    request = task["request"]
    started_at = time.perf_counter()
    events: list[dict[str, Any]] = []
    body: dict[str, Any] = {}

    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "X-Baseline-Scenario": task.get("scenario", "default"),
    }
    if "expected_events" in task:
        async with client.stream(
            request["method"],
            request["path"],
            json=request.get("json"),
            headers=headers,
        ) as response:
            async for line in response.aiter_lines():
                if line.startswith("data: "):
                    event = json.loads(line.removeprefix("data: "))
                    events.append(event)
                    if event.get("event") == task.get("cancel_after_event"):
                        break
        status_code = response.status_code
        run_id = events[0].get("run_id") if events else None
        actual_events = [event.get("event") for event in events]
        fields_ok = all(
            any(has_path(event, field) for event in events)
            for field in task.get("must_have", [])
        )
        fields_ok = fields_ok and not any(
            any(has_path(event, field) for event in events)
            for field in task.get("must_not_have", [])
        )
        events_ok = is_ordered_subsequence(task["expected_events"], actual_events)
    else:
        response = await client.request(
            request["method"],
            request["path"],
            json=request.get("json"),
            headers=headers,
        )
        status_code = response.status_code
        body = response.json()
        run_id = body.get("run_id") or response.headers.get("X-Run-ID")
        fields_ok = all(
            has_path(body, field) for field in task.get("must_have", [])
        ) and not any(
            has_path(body, field) for field in task.get("must_not_have", [])
        )
        events_ok = True

    latency_ms = int((time.perf_counter() - started_at) * 1000)
    contract_passed = (
        status_code == task["expected_status"] and fields_ok and events_ok
    )
    return {
        "label": BASELINE_LABEL,
        "task_id": task["id"],
        "category": task["category"],
        "repeat": repeat,
        "run_id": run_id,
        "expected_status": task["expected_status"],
        "status_code": status_code,
        "latency_ms": latency_ms,
        "contract_passed": contract_passed,
        "terminal_event": events[-1].get("event") if events else None,
        "error_code": body.get("code"),
    }


async def main() -> None:
    tasks = json.loads(TASKS_PATH.read_text(encoding="utf-8"))
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    results: list[dict[str, Any]] = []
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=30) as client:
        for repeat in range(1, REPEATS + 1):
            for task in tasks:
                if BASELINE_LABEL not in task.get(
                    "environments", ["mock", "real-model"]
                ):
                    continue
                results.append(await execute_task(client, task, repeat))
    OUTPUT_PATH.write_text(
        "".join(json.dumps(item, ensure_ascii=False) + "\n" for item in results),
        encoding="utf-8",
    )


if __name__ == "__main__":
    asyncio.run(main())
```

Runner 保存的是事实结果，不在执行阶段计算 P95 或生成结论。Mock 与真实模型分别运行一次，并使用不同 `BASELINE_LABEL`；不要把两组不同实验条件的数据混成一组。

## 四、第三步：手工检查接口矩阵

启动 API 后，逐项确认：

| 接口 | 成功路径 | 失败路径 |
|------|----------|----------|
| `GET /health` | 返回当前 Provider | 服务无法启动时先检查配置 |
| `POST /v1/chat` | 返回文本、usage 和耗时 | 空消息返回 `422` |
| `POST /v1/summaries` | 返回经过 Schema 校验的摘要 | 非法模型结构返回 `502` |
| `POST /v1/chat/stream` | 事件有序并正常结束 | Provider 异常时返回 `run.failed` |
| 逻辑模型路由 | `dev`、`fast`、`balanced` 按配置选择模型 | 未开放路由返回 `400` |

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
│   │   │   ├── observability.py
│   │   │   ├── prompts.py
│   │   │   ├── schemas.py
│   │   │   ├── services.py
│   │   │   ├── structured.py
│   │   │   └── providers/
│   │   │       ├── __init__.py
│   │   │       ├── base.py
│   │   │       ├── factory.py
│   │   │       ├── mock.py
│   │   │       ├── openai_compatible.py
│   │   │       └── router.py
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

## 六、第五步：输出模型调用基线报告

在固定环境下分别运行 Mock 和一个真实模型，创建 `docs/chapter-01-baseline.md`。报告不能靠回忆填写，必须由 Runner 结果和第七、八课的 `ModelCallRecord` 汇总得到。

### 6.0 保存模型调用记录

本地基线实验可以为 `gateway.model_call` 单独配置 JSONL 文件 Handler，Formatter 只输出日志消息：

```python
from pathlib import Path
import logging


def configure_baseline_log() -> None:
    path = Path("artifacts/model-calls.jsonl")
    path.parent.mkdir(parents=True, exist_ok=True)
    handler = logging.FileHandler(path, encoding="utf-8")
    handler.setFormatter(logging.Formatter("%(message)s"))
    model_logger = logging.getLogger("gateway.model_call")
    model_logger.setLevel(logging.INFO)
    model_logger.addHandler(handler)
    model_logger.propagate = False
```

只在基线模式调用这个函数，避免开发服务器热重载时重复添加 Handler。生产环境继续输出到标准日志采集链路，不直接让多个进程追加同一个本地文件。

### 6.1 实验条件

记录可复现条件：

```text
日期：
Gateway 版本或 Git Commit：
Provider：
底层模型：
逻辑模型路由：
Prompt ID 与版本：
请求参数：temperature / top_p / max output tokens
Golden Tasks 版本：
样本数：
价格快照日期与币种：
```

模型名称和价格会变化，报告必须记录当时快照，不能只写“使用默认模型”。

### 6.2 核心指标

| 指标 | Mock | 真实模型 | 说明 |
| --- | ---: | ---: | --- |
| 请求成功率 |  |  | HTTP 与终态成功 |
| Structured Output 通过率 |  |  | 首次通过与重试后通过分开统计 |
| P50 / P95 延迟 |  |  | 普通调用与 Streaming 分开 |
| 平均输入 / 输出 Token |  |  | 只使用 Provider 的真实 usage |
| 单次平均估算成本 |  |  | 注明价格快照 |
| 超时 / 限流 / 协议错误数 |  |  | 按错误码分类 |
| 平均重试次数 |  |  | 包含无重试请求 |
| 取消后仍运行的任务数 |  |  | 目标为 0 |

### 6.3 失败样本

每类失败至少保留一条：任务 ID、`run_id`、错误码、路由、模型、Prompt 版本、Trace 摘要和处理结论。敏感输入只保留脱敏片段或受控引用。

### 6.4 基线结论

报告最后回答：

1. 当前默认路由为什么选择这个模型？
2. 哪类任务最容易产生结构化输出失败？
3. 重试是否真正提高成功率，代价是多少？
4. P95 延迟和单次成本是否满足当前目标？
5. 进入第二章前还有哪些已知限制？

### 6.5 自动生成报告

创建 `packages/evals/report_chapter_01.py`，从两个 JSONL 文件计算指标并生成 Markdown：

```python
import json
import math
import os
from collections import Counter, defaultdict
from pathlib import Path
from statistics import mean
from typing import Any


RUNS_GLOB = "chapter-01-runs-*.jsonl"
CALLS_PATH = Path("artifacts/model-calls.jsonl")
REPORT_PATH = Path("docs/chapter-01-baseline.md")


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        raise FileNotFoundError(f"missing baseline artifact: {path}")
    values = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.strip():
            value = json.loads(line)
            if value.get("event") in {None, "model_call"}:
                values.append(value)
    return values


def percentile(values: list[int], ratio: float) -> int | None:
    if not values:
        return None
    ordered = sorted(values)
    index = max(math.ceil(len(ordered) * ratio) - 1, 0)
    return ordered[index]


def display(value: float | int | None, suffix: str = "") -> str:
    return "N/A" if value is None else f"{value}{suffix}"


def main() -> None:
    run_paths = sorted(Path("artifacts").glob(RUNS_GLOB))
    if not run_paths:
        raise FileNotFoundError(f"missing baseline artifacts: artifacts/{RUNS_GLOB}")
    runs = [item for path in run_paths for item in read_jsonl(path)]
    calls = read_jsonl(CALLS_PATH)
    calls_by_run: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for call in calls:
        calls_by_run[call["run_id"]].append(call)

    labels = sorted({run["label"] for run in runs})
    table_rows = []
    failure_lines = []

    for label in labels:
        selected_runs = [run for run in runs if run["label"] == label]
        run_ids = {run["run_id"] for run in selected_runs if run.get("run_id")}
        selected_calls = [
            call for run_id in run_ids for call in calls_by_run.get(run_id, [])
        ]
        stream_runs = [
            run for run in selected_runs if run["task_id"].startswith("gateway-stream")
        ]
        regular_runs = [run for run in selected_runs if run not in stream_runs]
        regular_latencies = [run["latency_ms"] for run in regular_runs]
        stream_latencies = [run["latency_ms"] for run in stream_runs]
        contract_rate = 100 * mean(
            1 if run["contract_passed"] else 0 for run in selected_runs
        )
        positive_runs = [
            run
            for run in selected_runs
            if run["expected_status"] < 400
        ]
        successful_runs = [
            run
            for run in positive_runs
            if run["status_code"] < 400
            and run.get("terminal_event") != "run.failed"
        ]
        success_rate = 100 * len(successful_runs) / len(positive_runs)
        structured_expected = [
            run for run in positive_runs if run["category"] == "structured-output"
        ]
        structured_runs = [
            run
            for run in successful_runs
            if run["category"] == "structured-output"
        ]
        first_passed = 0
        recovered = 0
        for run in structured_runs:
            structured_calls = [
                call
                for call in calls_by_run.get(run["run_id"], [])
                if call.get("request_kind") == "structured-output"
            ]
            if len(structured_calls) == 1:
                first_passed += 1
            elif len(structured_calls) > 1:
                recovered += 1
        structured_total = len(structured_expected)
        first_pass_rate = (
            100 * first_passed / structured_total if structured_total else None
        )
        recovery_rate = 100 * recovered / structured_total if structured_total else None
        token_pairs = [
            (call["input_tokens"], call["output_tokens"])
            for call in selected_calls
            if call.get("input_tokens") is not None
            and call.get("output_tokens") is not None
        ]
        costs = [
            call["estimated_cost_usd"]
            for call in selected_calls
            if call.get("estimated_cost_usd") is not None
        ]
        retry_counts = [call.get("retry_count", 0) for call in selected_calls]
        missing_call_records = sum(
            not calls_by_run.get(run["run_id"])
            for run in successful_runs
            if run.get("run_id")
        )
        cancelled_run_ids = {
            run["run_id"]
            for run in selected_runs
            if run["task_id"] == "gateway-stream-cancel-001"
            and run.get("run_id")
        }
        cancellation_leaks = sum(
            not any(
                call.get("status") == "cancelled"
                for call in calls_by_run.get(run_id, [])
            )
            for run_id in cancelled_run_ids
        )

        avg_input = mean(pair[0] for pair in token_pairs) if token_pairs else None
        avg_output = mean(pair[1] for pair in token_pairs) if token_pairs else None
        table_rows.append(
            "| "
            + " | ".join(
                [
                    label,
                    f"{contract_rate:.1f}%",
                    f"{success_rate:.1f}%",
                    display(round(first_pass_rate, 1) if first_pass_rate is not None else None, "%"),
                    display(round(recovery_rate, 1) if recovery_rate is not None else None, "%"),
                    display(percentile(regular_latencies, 0.50), " ms"),
                    display(percentile(regular_latencies, 0.95), " ms"),
                    display(percentile(stream_latencies, 0.50), " ms"),
                    display(percentile(stream_latencies, 0.95), " ms"),
                    display(round(avg_input, 1) if avg_input is not None else None),
                    display(round(avg_output, 1) if avg_output is not None else None),
                    display(round(mean(costs), 8) if costs else None),
                    display(round(mean(retry_counts), 2) if retry_counts else None),
                    str(missing_call_records),
                    str(cancellation_leaks),
                ]
            )
            + " |"
        )

        error_codes = [
            call["error_code"]
            for call in selected_calls
            if call.get("error_code")
        ]
        for run in selected_runs:
            call_has_error = any(
                call.get("error_code")
                for call in calls_by_run.get(run.get("run_id"), [])
            )
            if run.get("error_code") and not call_has_error:
                error_codes.append(run["error_code"])
        errors = Counter(error_codes)
        failed_runs = [
            run
            for run in selected_runs
            if not run["contract_passed"]
            or run["status_code"] >= 400
            or run.get("terminal_event") == "run.failed"
        ]
        failure_lines.append(f"### {label}")
        failure_lines.append(f"错误分布：`{dict(errors)}`")
        for run in failed_runs[:10]:
            failure_lines.append(
                f"- `{run['task_id']}` / `{run['run_id']}` / "
                f"HTTP {run['status_code']} / `{run.get('error_code')}`"
            )

    report = f"""# 第一章模型调用基线报告

生成日期：{os.getenv("BASELINE_DATE", "请填写")}  
Gateway Commit：{os.getenv("GATEWAY_COMMIT", "请填写")}  
Golden Tasks：chapter_01_golden_tasks.json  
价格快照：{os.getenv("PRICE_VERSION", "请填写")}

## 核心指标

| 环境 | 契约通过率 | 请求成功率 | Structured 首次通过 | Structured 恢复成功 | 普通 P50 | 普通 P95 | Streaming P50 | Streaming P95 | 平均输入 Token | 平均输出 Token | 平均成本 USD | 平均 Provider 重试 | 缺失调用记录 | 取消泄漏 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
{chr(10).join(table_rows)}

## 失败样本与错误分布

{chr(10).join(failure_lines)}

## 结论

1. 默认路由选择：请结合质量、P95 和成本填写。
2. Structured Output：请比较首次通过与纠错后通过情况。
3. 重试收益：请说明成功率提升及延迟、Token、成本代价。
4. 当前限制：请记录进入第二章前仍未解决的问题。
"""
    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text(report, encoding="utf-8")


if __name__ == "__main__":
    main()
```

报告脚本只计算能够从事实数据推导的指标，不自动编造质量结论。至少重复运行 5 次；比较 P95 时应增加样本量，并保证两组实验使用相同任务、参数、Prompt、网络区域和并发条件。

完整执行顺序如下：

```bash
BASELINE_LABEL=mock BASELINE_REPEATS=5 python packages/evals/run_chapter_01.py
BASELINE_LABEL=real-model BASELINE_REPEATS=5 python packages/evals/run_chapter_01.py
BASELINE_DATE=2026-08-11 GATEWAY_COMMIT=当前提交 PRICE_VERSION=价格快照版本 \
  python packages/evals/report_chapter_01.py
```

执行完成后保留 Golden Tasks、两份 Runner JSONL、模型调用 JSONL 和生成的 Markdown 报告。报告中的人工结论必须能够回指任务 ID、`run_id` 和 `call_id`。

## 七、第一章最终验收

- Mock Provider 模式可以完全离线运行
- 真实 Provider 模式只通过环境变量切换，不修改业务代码
- 调用方使用逻辑模型路由，不感知底层模型名称
- Chat Completions 参数进入统一契约，模型能力矩阵记录 Context、结构化输出、延迟和成本
- 普通聊天返回 `run_id`、模型、usage 和耗时
- 结构化摘要接口只返回经过 Schema 校验的结果，并声明 `schema_version`
- Structured Output 纠错次数有上限，耗尽后只会明确失败、降级或转人工
- Prompt 有稳定 ID、版本和变量校验
- 可恢复错误会有限重试，主模型失败时能按配置 fallback
- Gateway 租户限流与 Provider 429 有不同错误码和 `Retry-After` 语义
- SSE 事件有统一结构、递增序号、终态和耗时
- 浏览器能处理成功、失败、停止和异常断流，停止后上游连接释放
- 普通、结构化、失败和流式调用都写入模型调用记录
- 模型调用记录包含租户、参数、Prompt、Schema、Token、Cost、Latency、价格版本、重试和错误分类
- 后端核心调用链有稳定 Mock 测试
- Golden Tasks 包含成功、结构化恢复、限流、鉴权、Streaming 和取消场景
- Runner 能重复执行任务并保存带 `run_id` 的 JSONL 结果
- 报告脚本能从 Runner 与模型调用记录生成核心指标和失败样本
- `.env`、API Key 和 Provider 原始错误没有泄露到 Git 或浏览器

## 八、进入第二章前的复盘

回答以下问题，并写入 `docs/chapter-01-retrospective.md`：

1. 你的前端为什么不能保存模型 API Key？
2. Mock Provider 解决了什么问题？
3. 为什么要把 Provider 原始 SSE 转成自己的事件协议？
4. 如果模型返回了合法 JSON，但缺少业务字段，系统应该怎样处理？
5. `run_id` 在后续 Agent 系统中将用于什么？
6. 为什么流式输出字符数不能直接当作 Token usage？
7. 单元测试和 Golden Task 分别防止哪类回归？
8. 为什么调用方应该使用逻辑模型路由，而不是具体模型名称？
9. 哪些错误可以重试，哪些错误必须立即失败？
10. 如何证明用户取消后没有遗留模型调用？

下一章开始时，不要删除这一章的 Gateway、事件和 Golden Tasks。Tool Runtime 会直接建立在这些能力之上。
