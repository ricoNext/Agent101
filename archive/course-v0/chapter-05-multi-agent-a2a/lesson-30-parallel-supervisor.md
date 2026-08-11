# 第 3 课：实现并行 Supervisor

> 所属章节：[第 5 章：Multi-Agent、Skill 与 A2A](./index.md)  
> 上一课：[第 2 课：定义 Subtask 和结果协议](./lesson-29-subtask-result-protocol.md)  
> 下一课：[第 4 课：结果聚合、冲突和 Reviewer](./lesson-31-result-aggregation-conflict-reviewer.md)

### 你将完成什么

实现一个能并行运行只读 Specialist 的 Supervisor。当前使用 Scripted Specialist，确保并行/超时/聚合逻辑可测试。

创建 `app/multi_agent/supervisor.py`：

```python
import asyncio
import time
from typing import Protocol

from app.multi_agent.schemas import Subtask, SubtaskResult


class Specialist(Protocol):
    async def execute(self, task: Subtask) -> SubtaskResult:
        ...


class Supervisor:
    def __init__(self, specialists: dict[str, Specialist], max_parallel: int = 3) -> None:
        self.specialists = specialists
        self.max_parallel = max_parallel

    async def run(self, tasks: list[Subtask]) -> list[SubtaskResult]:
        semaphore = asyncio.Semaphore(self.max_parallel)

        async def execute_one(task: Subtask) -> SubtaskResult:
            specialist = self.specialists.get(task.role)
            if specialist is None:
                return SubtaskResult(
                    subtask_id=task.subtask_id,
                    role=task.role,
                    status="failed",
                    error=f"unknown role: {task.role}",
                )

            async with semaphore:
                started_at = time.perf_counter()
                try:
                    result = await asyncio.wait_for(
                        specialist.execute(task), timeout=task.timeout_seconds
                    )
                    result.latency_ms = int((time.perf_counter() - started_at) * 1000)
                    return result
                except asyncio.TimeoutError:
                    return SubtaskResult(
                        subtask_id=task.subtask_id,
                        role=task.role,
                        status="failed",
                        error="subtask timed out",
                    )

        return await asyncio.gather(*(execute_one(task) for task in tasks))
```

### 为什么需要 `max_parallel`

并行不是免费午餐。并行会同时增加模型调用数、工具调用数、数据库压力和成本。必须限制最大并发，并为每个子任务设置自己的超时和调用预算。

### 测试要求

写一个 `FakeSpecialist`：返回固定 `SubtaskResult`；再写一个慢 Specialist：`await asyncio.sleep(2)`。把 timeout 设置为 1 秒，预期返回 `failed`。

### 本课验收

- 三个只读任务可并行；
- 未注册角色明确失败；
- 超时任务不会卡住整个 Supervisor；
- 你知道并行任务为什么不能共享可写工作目录。

---
