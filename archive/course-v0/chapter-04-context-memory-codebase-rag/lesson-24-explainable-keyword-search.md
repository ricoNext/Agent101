# 第 3 课：先实现可解释的关键词检索

> 所属章节：[第 4 章：Context、Memory 与 Codebase RAG](./index.md)  
> 上一课：[第 2 课：把代码和文档解析成可引用的 Chunk](./lesson-23-code-doc-chunk.md)  
> 下一课：[第 4 课：接入 Embedding、Hybrid Search 和 Rerank](./lesson-25-embedding-hybrid-search-rerank.md)

### 你将完成什么

实现不依赖向量模型的基线检索。先确保“登录”“add”“test_add”这类精确标识符能找到正确文件。

### 第一步：实现简单词项检索

创建 `app/retrieval/lexical.py`：

```python
import re

from app.retrieval.schemas import DocumentChunk, RetrievalHit


def tokenize(text: str) -> set[str]:
    return set(re.findall(r"[A-Za-z_][A-Za-z0-9_]*|[\u4e00-\u9fff]+", text.lower()))


class LexicalIndex:
    def __init__(self, chunks: list[DocumentChunk]) -> None:
        self.chunks = chunks

    def search(self, query: str, limit: int = 5, tenant_id: str = "course") -> list[RetrievalHit]:
        query_tokens = tokenize(query)
        hits: list[RetrievalHit] = []

        for chunk in self.chunks:
            if chunk.tenant_id != tenant_id:
                continue
            overlap = query_tokens & tokenize(chunk.content)
            if not overlap:
                continue
            score = len(overlap) / max(1, len(query_tokens))
            hits.append(
                RetrievalHit(
                    chunk=chunk,
                    score=score,
                    reason=f"关键词命中：{', '.join(sorted(overlap))}",
                )
            )

        return sorted(hits, key=lambda hit: hit.score, reverse=True)[:limit]
```

### 第二步：写检索测试

创建 `tests/test_lexical_retrieval.py`：

```python
from app.retrieval.lexical import LexicalIndex
from app.retrieval.schemas import DocumentChunk


def test_lexical_search_returns_matching_chunk() -> None:
    index = LexicalIndex(
        [
            DocumentChunk(
                chunk_id="a",
                document_id="src/auth.py",
                path="src/auth.py",
                start_line=1,
                end_line=3,
                content="def login(username: str, password: str): return True",
                language="py",
            ),
            DocumentChunk(
                chunk_id="b",
                document_id="src/orders.py",
                path="src/orders.py",
                start_line=1,
                end_line=3,
                content="def create_order(): return None",
                language="py",
            ),
        ]
    )

    hits = index.search("查找 login 逻辑")

    assert hits[0].chunk.path == "src/auth.py"
```

### 第三步：为什么关键词检索还不够

“用户认证流程”可能和代码里的 `login` 没有同一个词。向量检索用于补充语义相似，但也可能因为词义相近却命中无关代码。正确策略是保留关键词作为基线，再增加向量召回和重排。

### 本课验收

- 检索结果包含分数和命中原因；
- 不同租户的 Chunk 不会互相返回；
- 函数名、错误码和路径能被精确找到；
- 你知道关键词检索和语义检索各自的优势。

---
