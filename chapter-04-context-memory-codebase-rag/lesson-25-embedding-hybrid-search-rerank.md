# 第 4 课：接入 Embedding、Hybrid Search 和 Rerank

> 所属章节：[第 4 章：Context、Memory 与 Codebase RAG](./index.md)  
> 上一课：[第 3 课：先实现可解释的关键词检索](./lesson-24-explainable-keyword-search.md)  
> 下一课：[第 5 课：项目记忆与 Context Builder 集成](./lesson-26-project-memory-context-builder.md)

### 你将完成什么

在词项检索基线之上增加向量检索。这里不把任何一个向量数据库当作必需知识；你需要理解接口和评测方法。

### 第一步：定义向量接口

创建 `app/retrieval/vector.py`：

```python
from typing import Protocol

from app.retrieval.schemas import DocumentChunk, RetrievalHit


class EmbeddingProvider(Protocol):
    async def embed(self, texts: list[str]) -> list[list[float]]:
        ...


class VectorIndex(Protocol):
    async def upsert(self, chunks: list[DocumentChunk], vectors: list[list[float]]) -> None:
        ...

    async def search(self, query_vector: list[float], limit: int, tenant_id: str) -> list[RetrievalHit]:
        ...
```

这让你可以把 OpenAI-compatible Embedding、云向量库、pgvector 或 Qdrant 放在实现层，而不是污染 Agent 和 UI。

### 第二步：选择一个实现

建议路径：

1. 教学和本地实验：Qdrant Docker 或 pgvector；
2. 已有 PostgreSQL：优先 pgvector，减少运维组件；
3. 大规模、多索引场景：再评估专用向量库。

无论选哪个，都必须保存：Embedding 模型、维度、Chunk 版本、租户和索引时间。

### 第三步：Hybrid Search 合并策略

第一版不需要复杂公式：

```python
def merge_hits(lexical_hits, vector_hits, limit=8):
    merged = {}
    for hit in lexical_hits:
        merged[hit.chunk.chunk_id] = (hit, hit.score)
    for hit in vector_hits:
        existing = merged.get(hit.chunk.chunk_id)
        score = hit.score + (existing[1] if existing else 0)
        merged[hit.chunk.chunk_id] = (hit, score)
    return [pair[0] for pair in sorted(merged.values(), key=lambda pair: pair[1], reverse=True)[:limit]]
```

后续根据 Golden Questions 调整权重，而不是凭感觉说“向量更智能”。

### 第四步：Rerank 的正确位置

Rerank 只处理已经召回的少量候选，例如 20 个 Chunk 重排成 5 个；它不是用来扫描整个仓库。Rerank 后必须保留原始分数、重排分数和模型版本，以便第六章排查为什么证据消失。

### 本课验收

- 有独立的 Embedding 和 VectorIndex 接口；
- 能解释 Hybrid Search 的合并逻辑；
- 向量和关键词结果都经过租户过滤；
- 知道 Rerank 只能重排候选，不能召回未找到的文档。

---
