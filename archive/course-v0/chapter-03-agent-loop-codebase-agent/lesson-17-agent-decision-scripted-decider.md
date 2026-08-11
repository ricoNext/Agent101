# 第 3 课：定义 Agent Decision 并实现 Scripted Decider

> 所属章节：[第 3 章：实现可恢复的 Agent Loop 与 Codebase Agent](./index.md)  
> 上一课：[第 2 课：保存任务和 Checkpoint](./lesson-16-save-tasks-checkpoint.md)  
> 下一课：[第 4 课：实现最小 Agent Loop](./lesson-18-minimal-agent-loop.md)

### 你将完成什么

让决策层只返回两种可验证结果：工具调用或最终答案。不要让模型直接返回一段模糊自然语言后由代码猜测意图。

在 `app/agents/schemas.py` 末尾加入：

```python
DecisionKind = Literal["tool_call", "final"]


class AgentDecision(BaseModel):
    kind: DecisionKind
    tool_name: str | None = None
    arguments: dict[str, Any] = Field(default_factory=dict)
    answer: str | None = None

    def validate_for_kind(self) -> None:
        if self.kind == "tool_call" and not self.tool_name:
            raise ValueError("tool_call requires tool_name")
        if self.kind == "final" and not self.answer:
            raise ValueError("final requires answer")
```

创建 `app/agents/decider.py`：

```python
from collections.abc import Awaitable, Callable
from typing import Protocol

from app.agents.schemas import AgentDecision, AgentRun


class AgentDecider(Protocol):
    async def decide(self, run: AgentRun) -> AgentDecision:
        ...


class ScriptedDecider:
    def __init__(self, decisions: list[AgentDecision]) -> None:
        self._decisions = decisions
        self._index = 0

    async def decide(self, run: AgentRun) -> AgentDecision:
        if self._index >= len(self._decisions):
            return AgentDecision(kind="final", answer="脚本决策已完成")
        decision = self._decisions[self._index]
        self._index += 1
        decision.validate_for_kind()
        return decision
```

`ScriptedDecider` 让你用固定序列模拟模型：“先读文件，再给答案”。在没有这个稳定基线前，直接让真实模型参与循环，很难知道失败到底来自模型还是 Runner。

### 本课练习

写一个序列：

```python
[
    AgentDecision(
        kind="tool_call",
        tool_name="read_course_file",
        arguments={"path": "readme.txt"},
    ),
    AgentDecision(kind="final", answer="课程文件已经读取完成"),
]
```

你应该能预测每一步，不需要猜模型。

---
