# 第 2 课：把代码和文档解析成可引用的 Chunk

> 所属章节：[第 4 章：Context、Memory 与 Codebase RAG](./README.md)  
> 上一课：[第 1 课：先量化 Context，而不是盲目压缩](./第01课-先量化 Context，而不是盲目压缩.md)  
> 下一课：[第 3 课：先实现可解释的关键词检索](./第03课-先实现可解释的关键词检索.md)

### 你将完成什么

将文件转换为带路径、行号和内容的 Chunk。第一版不追求完美 AST，而要保证结果可读、可定位和可追踪。

### 第一步：定义 Document 和 Chunk

创建 `app/retrieval/schemas.py`：

```python
from datetime import UTC, datetime
from pydantic import BaseModel, Field


class DocumentChunk(BaseModel):
    chunk_id: str
    document_id: str
    path: str
    start_line: int = Field(ge=1)
    end_line: int = Field(ge=1)
    content: str
    language: str | None = None
    version: str = "working-tree"
    tenant_id: str = "course"

class RetrievalHit(BaseModel):
    chunk: DocumentChunk
    score: float
    reason: str


class Citation(BaseModel):
    path: str
    start_line: int
    end_line: int
    chunk_id: str
```

### 第二步：实现简单文件切块

创建 `app/retrieval/chunking.py`：

```python
import hashlib
from pathlib import Path

from app.retrieval.schemas import DocumentChunk


def chunk_text_file(path: Path, max_lines: int = 40) -> list[DocumentChunk]:
    lines = path.read_text(encoding="utf-8").splitlines()
    chunks: list[DocumentChunk] = []

    for start_index in range(0, len(lines), max_lines):
        end_index = min(start_index + max_lines, len(lines))
        content = "\\n".join(lines[start_index:end_index])
        relative_path = str(path)
        digest = hashlib.sha256(
            f"{relative_path}:{start_index + 1}:{content}".encode("utf-8")
        ).hexdigest()[:16]
        chunks.append(
            DocumentChunk(
                chunk_id=digest,
                document_id=relative_path,
                path=relative_path,
                start_line=start_index + 1,
                end_line=end_index,
                content=content,
                language=path.suffix.lstrip(".") or None,
            )
        )

    return chunks
```

### 为什么先按行切块

按行切块很简单，也有明显缺点：函数可能被截断、类和方法分开、Markdown 标题丢失。我们先用它建立完整索引和引用链，再在本章最后替换为按标题/函数/AST 的策略。没有基线，就无法知道高级切块是否真的改善任务。

### 第三步：写解析任务

创建 `scripts/index_course_repo.py`：

```python
import json
from pathlib import Path

from app.retrieval.chunking import chunk_text_file

ROOT = Path("/tmp/agent-platform-repo")
OUTPUT = Path("/tmp/agent-platform-index.json")

chunks = []
for path in ROOT.rglob("*"):
    if path.is_file() and path.suffix in {".py", ".md", ".txt"}:
        chunks.extend(chunk.model_dump() for chunk in chunk_text_file(path))

OUTPUT.write_text(json.dumps(chunks, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"indexed {len(chunks)} chunks")
```

运行：

```bash
python scripts/index_course_repo.py
```

打开 `/tmp/agent-platform-index.json`，确认每个 Chunk 都包含路径和行号。

### 本课验收

- 至少索引示例仓库中的 Python 和测试文件；
- Chunk 可以定位到原文件行号；
- 修改文件后重新索引会生成不同 Chunk ID；
- 你能指出固定行数切块的局限。

---
