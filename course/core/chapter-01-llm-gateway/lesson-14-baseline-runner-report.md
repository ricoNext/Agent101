# 第 14 课：实现基线 Runner 与评测报告

> 所属章节：[第一章：LLM API、Prompt、Structured Output 与 Gateway](./index.md)  
> 上一课：[第 13 课：构建 Gateway 验收任务集](./lesson-13-gateway-acceptance-tasks.md)  
> 下一课：[第 15 课：完成 M1 联调验收与复盘](./lesson-15-m1-integration-acceptance.md)  
> [参考代码基线](https://github.com/ricoNext/agent-platform/tree/chapter-07)

## 一、你将完成什么

本课回答“如何重复执行并比较”。你会实现最小 Runner，在 Mock 和真实模型环境分别运行第 13 课的 Golden Tasks，把响应、事件、耗时与 `run_id` 保存为 JSONL，再从 Runner 结果和模型调用记录生成第一份基线报告。

本课不对 M1 作最终通过判定。Runner 只记录事实，报告脚本只计算指标，人工结论和里程碑验收留到第 15 课。

## 二、定义 Runner 的输入与输出

Runner 的输入包括：

- Golden Tasks 文件。
- Gateway 地址和鉴权信息。
- 环境标签：`mock` 或 `real-model`。
- 重复次数和固定实验参数。

每次执行至少记录：

```json
{
  "label": "mock",
  "task_id": "gateway-chat-001",
  "category": "chat",
  "repeat": 1,
  "run_id": "run_123",
  "status_code": 200,
  "latency_ms": 48,
  "contract_passed": true,
  "terminal_event": null,
  "error_code": null
}
```

不要在单条记录中提前写“模型更好”之类的判断。原始事实与聚合结论必须分开保存。

## 三、实现最小 Runner

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
OUTPUT_PATH = Path(
    f"artifacts/chapter-01-runs-{BASELINE_LABEL}.jsonl"
)


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
                if not line.startswith("data: "):
                    continue
                event = json.loads(line.removeprefix("data: "))
                events.append(event)
                if event.get("event") == task.get("cancel_after_event"):
                    break

        status_code = response.status_code
        run_id = events[0].get("run_id") if events else None
        actual_events = [item.get("event") for item in events]
        fields_ok = all(
            any(has_path(item, field) for item in events)
            for field in task.get("must_have", [])
        )
        events_ok = is_ordered_subsequence(
            task["expected_events"],
            actual_events,
        )
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
            has_path(body, field)
            for field in task.get("must_not_have", [])
        )
        events_ok = True

    latency_ms = int((time.perf_counter() - started_at) * 1000)
    return {
        "label": BASELINE_LABEL,
        "task_id": task["id"],
        "category": task["category"],
        "repeat": repeat,
        "run_id": run_id,
        "expected_status": task["expected_status"],
        "status_code": status_code,
        "latency_ms": latency_ms,
        "contract_passed": (
            status_code == task["expected_status"]
            and fields_ok
            and events_ok
        ),
        "terminal_event": events[-1].get("event") if events else None,
        "error_code": body.get("code"),
    }


async def main() -> None:
    tasks = json.loads(TASKS_PATH.read_text(encoding="utf-8"))
    results: list[dict[str, Any]] = []
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=30) as client:
        for repeat in range(1, REPEATS + 1):
            for task in tasks:
                environments = task.get(
                    "environments",
                    ["mock", "real-model"],
                )
                if BASELINE_LABEL not in environments:
                    continue
                results.append(await execute_task(client, task, repeat))

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(
        "".join(
            json.dumps(item, ensure_ascii=False) + "\n"
            for item in results
        ),
        encoding="utf-8",
    )


if __name__ == "__main__":
    asyncio.run(main())
```

Mock 与真实模型必须使用不同的 `BASELINE_LABEL`。Runner 不能把不同实验条件的数据写进同一组记录。

## 四、保存模型调用事实

Runner 记录接口层事实，`ModelCallRecord` 记录 Provider 层事实。两组数据通过 `run_id` 关联。

本地基线实验可以给 `gateway.model_call` 增加 JSONL Handler：

```python
import logging
from pathlib import Path


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

只在基线模式调用该函数，并避免开发服务器热重载时重复增加 Handler。生产环境继续写标准日志采集链路，不让多个进程直接追加同一个本地文件。

## 五、定义报告指标

创建 `docs/chapter-01-baseline.md` 时，先记录实验条件：

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

报告至少计算：

| 指标 | 计算边界 |
| --- | --- |
| 契约通过率 | 状态码、字段和事件序列同时符合任务定义 |
| 请求成功率 | 只统计期望成功的任务，不把预期失败场景算成失败 |
| Structured Output 通过率 | 首次通过与纠错后通过分开 |
| P50 / P95 延迟 | 普通调用和 Streaming 分开 |
| 平均输入 / 输出 Token | 只使用 Provider 返回的真实 usage |
| 单次平均估算成本 | 必须绑定价格快照 |
| 错误分布 | 按 Gateway 稳定错误码聚合 |
| 平均重试次数 | 包含没有重试的请求 |
| 取消泄漏数 | 取消后仍在运行的任务，目标为 0 |

## 六、实现报告生成器

创建 `packages/evals/report_chapter_01.py`。下面保留核心计算骨架，具体表格字段可以随调用记录 Schema 扩展：

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
    return [
        json.loads(line)
        for line in path.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]


def percentile(values: list[int], ratio: float) -> int | None:
    if not values:
        return None
    ordered = sorted(values)
    index = max(math.ceil(len(ordered) * ratio) - 1, 0)
    return ordered[index]


def summarize(
    label: str,
    runs: list[dict[str, Any]],
    calls_by_run: dict[str, list[dict[str, Any]]],
) -> dict[str, Any]:
    selected = [item for item in runs if item["label"] == label]
    positive = [item for item in selected if item["expected_status"] < 400]
    successful = [
        item
        for item in positive
        if item["status_code"] < 400
        and item.get("terminal_event") != "run.failed"
    ]
    latencies = [item["latency_ms"] for item in selected]
    calls = [
        call
        for run in selected
        for call in calls_by_run.get(run.get("run_id"), [])
    ]
    costs = [
        call["estimated_cost_usd"]
        for call in calls
        if call.get("estimated_cost_usd") is not None
    ]
    errors = Counter(
        call["error_code"]
        for call in calls
        if call.get("error_code")
    )
    return {
        "label": label,
        "contract_rate": 100 * mean(
            1 if item["contract_passed"] else 0 for item in selected
        ),
        "success_rate": 100 * len(successful) / len(positive),
        "p50_ms": percentile(latencies, 0.50),
        "p95_ms": percentile(latencies, 0.95),
        "average_cost_usd": mean(costs) if costs else None,
        "errors": dict(errors),
    }


def main() -> None:
    run_paths = sorted(Path("artifacts").glob(RUNS_GLOB))
    if not run_paths:
        raise FileNotFoundError("missing chapter-01 runner artifacts")

    runs = [item for path in run_paths for item in read_jsonl(path)]
    calls = read_jsonl(CALLS_PATH)
    calls_by_run: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for call in calls:
        calls_by_run[call["run_id"]].append(call)

    summaries = [
        summarize(label, runs, calls_by_run)
        for label in sorted({item["label"] for item in runs})
    ]
    lines = [
        "# 第一章模型调用基线报告",
        "",
        f"生成日期：{os.getenv('BASELINE_DATE', '请填写')}",
        f"Gateway Commit：{os.getenv('GATEWAY_COMMIT', '请填写')}",
        f"价格快照：{os.getenv('PRICE_VERSION', '请填写')}",
        "",
        "## 指标事实",
        "",
        "```json",
        json.dumps(summaries, ensure_ascii=False, indent=2),
        "```",
        "",
        "## 人工结论",
        "",
        "1. 默认路由选择：待结合质量、P95 和成本填写。",
        "2. Structured Output：待比较首次通过和纠错恢复。",
        "3. 重试收益：待说明成功率提升及其代价。",
        "4. 当前限制：待记录进入第二章前的遗留问题。",
    ]
    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
```

真实项目中继续把 Structured Output 首次通过率、Streaming 延迟、Token、重试和取消泄漏加入 `summarize()`。报告脚本只能生成能够从事实数据推导的指标，不能自动编造质量结论。

## 七、运行两组基线

至少重复执行 5 次。比较 P95 时应增加样本量，并保持任务、Prompt、参数、网络区域和并发条件一致：

```bash
BASELINE_LABEL=mock BASELINE_REPEATS=5 \
  python packages/evals/run_chapter_01.py

BASELINE_LABEL=real-model BASELINE_REPEATS=5 \
  python packages/evals/run_chapter_01.py

BASELINE_DATE=2026-08-18 \
GATEWAY_COMMIT=当前提交 \
PRICE_VERSION=价格快照版本 \
  python packages/evals/report_chapter_01.py
```

执行后保留：

- Golden Tasks 原始文件。
- Mock 与真实模型两份 Runner JSONL。
- 模型调用 JSONL。
- 自动生成的 Markdown 报告。

## 八、本课验收

- Runner 能按环境筛选任务并重复执行。
- 普通响应和 SSE 响应使用不同解析路径。
- 取消任务会在指定事件出现后主动关闭响应流。
- 每条结果都保存任务 ID、`run_id`、状态、耗时和契约结论。
- Runner 记录与模型调用记录能通过 `run_id` 关联。
- Mock 与真实模型数据不会混为一组。
- 报告包含实验条件、核心指标、错误分布和待填写的人工结论。

下一课将使用这些事实完成接口联调、前端状态检查和 M1 最终判定。

