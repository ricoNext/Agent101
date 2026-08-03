# 第 5 课：项目记忆与 Context Builder 集成

> 所属章节：[第 4 章：Context、Memory 与 Codebase RAG](./README.md)  
> 上一课：[第 4 课：接入 Embedding、Hybrid Search 和 Rerank](./第04课-接入 Embedding、Hybrid Search 和 Rerank.md)  
> 下一课：[第 6 课：创建代码知识页面和 RAG 对照实验](./第06课-创建代码知识页面和 RAG 对照实验.md)

### 你将完成什么

保存项目级事实，并把检索结果、任务状态和项目记忆以受预算控制的方式送入 Agent。

### 第一步：定义 Project Memory

创建 `app/context/memory.py`：

```python
from datetime import UTC, datetime

from pydantic import BaseModel


class ProjectMemory(BaseModel):
    key: str
    value: str
    source: str
    confidence: float
    updated_at: datetime = datetime.now(UTC)


class InMemoryProjectMemoryStore:
    def __init__(self) -> None:
        self._items: dict[str, ProjectMemory] = {}

    def upsert(self, item: ProjectMemory) -> None:
        self._items[item.key] = item

    def list(self) -> list[ProjectMemory]:
        return list(self._items.values())

    def delete(self, key: str) -> None:
        self._items.pop(key, None)
```

写入三个初始项目记忆：

```text
test_command = pytest -q
source_root = src/
language = Python
```

### 第二步：把检索结果转为 ContextPart

创建 `app/context/adapters.py`：

```python
from app.context.schemas import ContextPart
from app.retrieval.schemas import RetrievalHit


def retrieval_hit_to_context_part(hit: RetrievalHit) -> ContextPart:
    chunk = hit.chunk
    citation = f"来源：{chunk.path}:{chunk.start_line}-{chunk.end_line}"
    return ContextPart(
        kind="retrieval",
        priority=70,
        source=citation,
        content=f"{citation}\\n{chunk.content}",
    )
```

让 Agent Prompt 明确要求：最终结论必须引用这些来源；没有来源时必须说“未找到证据”。

### 第三步：做 Context Debug Report

为每个 Run 保存：

- 选入的 Chunk ID；
- 被预算排除的 Chunk；
- 每块估算 Token；
- 选择原因；
- RAG 和 Memory 的版本。

这份报告在模型回答错误时非常重要。不要只保存“最后 Prompt 字符串”，否则你无法知道为什么某个证据没有被选中。

### 本课验收

- 项目记忆可查看、更新和删除；
- 检索命中可转换为带行号的上下文；
- Context Report 能解释取舍；
- 最终回答可以引用 `path:line`。

---
