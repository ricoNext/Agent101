# 第 1 课：先量化 Context，而不是盲目压缩

> 所属章节：[第 4 章：Context、Memory 与 Codebase RAG](./README.md)  
> 下一课：[第 2 课：把代码和文档解析成可引用的 Chunk](./第02课-把代码和文档解析成可引用的 Chunk.md)

### 你将完成什么

实现 Context Budget 报告。每次模型调用前，系统能告诉你系统指令、任务、工具、历史和检索证据各占多少字符和估算 Token。

### 为什么字符数也有价值

不同模型 Tokenizer 不同，精确 Token 计数应使用实际 Provider 的用量或对应 Tokenizer。但在第一版中，字符数和简单估算足以暴露“某个工具结果占了 80% 上下文”这类问题。

### 第一步：创建 Context 模型

创建 `app/context`：

```bash
mkdir -p app/context
touch app/context/__init__.py
```

创建 `app/context/schemas.py`：

```python
from typing import Literal

from pydantic import BaseModel, Field


ContextPartKind = Literal["system", "task", "state", "history", "tool_result", "retrieval"]


class ContextPart(BaseModel):
    kind: ContextPartKind
    priority: int = Field(ge=1, le=100)
    content: str
    source: str


class ContextReportItem(BaseModel):
    kind: ContextPartKind
    source: str
    characters: int
    estimated_tokens: int
    included: bool
    reason: str


class ContextBuildResult(BaseModel):
    text: str
    report: list[ContextReportItem]
```

### 第二步：写可解释的 Builder

创建 `app/context/builder.py`：

```python
from app.context.schemas import ContextBuildResult, ContextPart, ContextReportItem


class ContextBuilder:
    def __init__(self, max_estimated_tokens: int = 4_000) -> None:
        self.max_estimated_tokens = max_estimated_tokens

    @staticmethod
    def estimate_tokens(content: str) -> int:
        # 教学用粗略估算。生产环境使用实际模型 tokenizer 或 Provider usage。
        return max(1, len(content) // 3)

    def build(self, parts: list[ContextPart]) -> ContextBuildResult:
        remaining = self.max_estimated_tokens
        selected: list[str] = []
        report: list[ContextReportItem] = []

        for part in sorted(parts, key=lambda item: item.priority, reverse=True):
            estimated_tokens = self.estimate_tokens(part.content)
            included = estimated_tokens <= remaining
            if included:
                selected.append(f"## {part.kind}: {part.source}\\n{part.content}")
                remaining -= estimated_tokens

            report.append(
                ContextReportItem(
                    kind=part.kind,
                    source=part.source,
                    characters=len(part.content),
                    estimated_tokens=estimated_tokens,
                    included=included,
                    reason="within budget" if included else "budget exceeded",
                )
            )

        return ContextBuildResult(text="\\n\\n".join(selected), report=report)
```

### 第三步：写测试

创建 `tests/test_context_builder.py`：

```python
from app.context.builder import ContextBuilder
from app.context.schemas import ContextPart


def test_context_builder_keeps_higher_priority_parts() -> None:
    builder = ContextBuilder(max_estimated_tokens=10)
    result = builder.build(
        [
            ContextPart(kind="history", priority=10, source="old", content="x" * 60),
            ContextPart(kind="task", priority=100, source="user", content="读取登录逻辑"),
        ]
    )

    assert "读取登录逻辑" in result.text
    assert any(not item.included for item in result.report)
```

### 故意制造失败

把历史对话的 priority 改成 100，任务改成 10。你会发现系统可能丢掉当前任务。恢复优先级后理解：上下文选择是产品和工程策略，不是单纯“截断字符串”。

### 本课验收

- 每次 Context Build 都能生成报告；
- 当前任务优先于旧历史；
- 超预算内容不会静默进入 Prompt；
- 你能指出后续哪些模块会提供 `ContextPart`。

---
