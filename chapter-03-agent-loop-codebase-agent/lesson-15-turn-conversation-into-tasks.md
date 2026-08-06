# 第 1 课：把“对话”变成“任务”

> 所属章节：[第 3 章：实现可恢复的 Agent Loop 与 Codebase Agent](./index.md)  
> 下一课：[第 2 课：保存任务和 Checkpoint](./lesson-16-save-tasks-checkpoint.md)

### 你将完成什么

定义 Agent Run、状态和步骤。先让系统能说清“任务现在进行到哪里”，再写循环。

### 为什么聊天记录不够

聊天记录只能看到文本，无法表达：等待审批、工具失败、已取消、重试次数、当前预算和恢复位置。Agent 需要独立的任务状态。

### 第一步：定义任务模型

创建 `app/agents`：

```bash
mkdir -p app/agents
touch app/agents/__init__.py
```

创建 `app/agents/schemas.py`：

```python
from datetime import UTC, datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

RunStatus = Literal[
    "created",
    "running",
    "waiting_approval",
    "completed",
    "failed",
    "cancelled",
]
StepKind = Literal["model", "tool", "system"]


class AgentStep(BaseModel):
    index: int
    kind: StepKind
    name: str
    input: dict[str, Any] = Field(default_factory=dict)
    output: dict[str, Any] = Field(default_factory=dict)
    status: Literal["started", "completed", "failed"]
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class AgentRun(BaseModel):
    run_id: str
    task: str = Field(min_length=1)
    user_id: str
    tenant_id: str
    status: RunStatus = "created"
    current_step: int = 0
    max_steps: int = Field(default=8, ge=1, le=30)
    cancel_requested: bool = False
    steps: list[AgentStep] = Field(default_factory=list)
    final_answer: str | None = None
    error_code: str | None = None
    error_message: str | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
```

### 状态转移规则

先写在 `docs/chapter-03-state-machine.md`：

```text
created -> running
running -> waiting_approval
waiting_approval -> running
running -> completed
running -> failed
created/running/waiting_approval -> cancelled
```

任何不在图中的跳转都应被拒绝。例如 `completed -> running` 不允许，否则历史任务会被错误地再次执行。

### 本课验收

- 能解释 Run、Step 和 Trace 的区别；
- 任务状态有明确枚举；
- 每个步骤有输入、输出和状态；
- 你已画出状态转移图。

---
