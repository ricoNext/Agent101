# 第 2 课：定义 Subtask 和结果协议

> 所属章节：[第 5 章：Multi-Agent、Skill 与 A2A](./index.md)  
> 上一课：[第 1 课：判断是否需要 Multi-Agent](./lesson-28-determine-need-multi-agent.md)  
> 下一课：[第 3 课：实现并行 Supervisor](./lesson-30-parallel-supervisor.md)

### 你将完成什么

创建多 Agent 协作中最重要的接口。每个 Specialist 只能返回结构化发现和证据。

创建 `app/multi_agent/schemas.py`：

```python
from typing import Any, Literal

from pydantic import BaseModel, Field


class Subtask(BaseModel):
    subtask_id: str
    role: str
    goal: str
    context: list[str] = Field(default_factory=list)
    allowed_tools: list[str] = Field(default_factory=list)
    scopes: set[str] = Field(default_factory=set)
    max_tool_calls: int = Field(default=10, ge=1, le=50)
    timeout_seconds: int = Field(default=120, ge=1, le=600)


class Finding(BaseModel):
    title: str
    severity: Literal["low", "medium", "high"]
    summary: str
    evidence: list[str] = Field(min_length=1)
    recommendation: str


class SubtaskResult(BaseModel):
    subtask_id: str
    role: str
    status: Literal["completed", "failed", "cancelled"]
    findings: list[Finding] = Field(default_factory=list)
    error: str | None = None
    tool_calls: int = 0
    latency_ms: int = 0
```

不要把 `findings: list[str]` 写得过于宽松。没有 severity、证据和建议，后续无法排序、合并或审查。

### 本课练习

创建三个 `Subtask`：Architecture、Test、Security。它们都只能读仓库；每个 `goal` 必须说明输出什么证据。

---
