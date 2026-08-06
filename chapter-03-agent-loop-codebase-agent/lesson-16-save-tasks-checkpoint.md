# 第 2 课：保存任务和 Checkpoint

> 所属章节：[第 3 章：实现可恢复的 Agent Loop 与 Codebase Agent](./index.md)  
> 上一课：[第 1 课：把“对话”变成“任务”](./lesson-15-turn-conversation-into-tasks.md)  
> 下一课：[第 3 课：定义 Agent Decision 并实现 Scripted Decider](./lesson-17-agent-decision-scripted-decider.md)

### 你将完成什么

实现内存版 `RunStore`。它模拟后续 PostgreSQL 持久化接口，让你不会把状态散落在全局变量里。

创建 `app/agents/store.py`：

```python
from datetime import UTC, datetime

from app.agents.schemas import AgentRun


class InMemoryRunStore:
    def __init__(self) -> None:
        self._runs: dict[str, AgentRun] = {}

    def create(self, run: AgentRun) -> AgentRun:
        if run.run_id in self._runs:
            raise ValueError(f"run already exists: {run.run_id}")
        self._runs[run.run_id] = run
        return run

    def get(self, run_id: str) -> AgentRun | None:
        return self._runs.get(run_id)

    def save(self, run: AgentRun) -> AgentRun:
        run.updated_at = datetime.now(UTC)
        self._runs[run.run_id] = run
        return run
```

### Checkpoint 最小原则

Checkpoint 保存“恢复需要的信息”，不是保存一切：

- 保存：任务、状态、当前步骤、工具参数、工具结果摘要、审批状态和错误；
- 不保存：完整密钥、未脱敏 Prompt 原文、巨大的文件内容、运行中的 Python 对象；
- 原始大对象放在独立 Trace/对象存储，Checkpoint 只保存引用。

### 第一步测试

创建 `tests/test_run_store.py`：

```python
from app.agents.schemas import AgentRun
from app.agents.store import InMemoryRunStore


def test_run_store_round_trip() -> None:
    store = InMemoryRunStore()
    run = AgentRun(
        run_id="run-001",
        task="读取课程文件",
        user_id="student",
        tenant_id="course",
    )

    store.create(run)
    loaded = store.get("run-001")

    assert loaded is not None
    assert loaded.status == "created"
    assert loaded.task == "读取课程文件"
```

### 本课验收

- 创建、读取和保存 Run 可以通过测试；
- 你能解释为什么以后只需替换 Store 实现，而不必重写 Agent Runner；
- Checkpoint 里没有密钥和无限增长的原始内容。

---
