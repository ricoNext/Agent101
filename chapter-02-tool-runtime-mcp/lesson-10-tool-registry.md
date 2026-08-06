# 第 3 课：实现 Tool Registry

> 所属章节：[第 2 章：构建 Tool Runtime 与 MCP 接入](./index.md)  
> 上一课：[第 2 课：定义工具、调用和审计协议](./lesson-09-tool-call-audit-protocol.md)  
> 下一课：[第 4 课：实现权限、审批、超时和审计](./lesson-11-permission-approval-timeout-audit.md)

### 你将完成什么

实现内存版工具注册中心。当前目标是理解机制，不急着使用数据库；第七章会把元数据和审计迁移到 PostgreSQL。

### 第一步：写 Registry

创建 `app/tools/registry.py`：

```python
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any

from app.tools.schemas import ToolContext, ToolDefinition

ToolHandler = Callable[[dict[str, Any], ToolContext], Awaitable[dict[str, Any]]]


@dataclass
class RegisteredTool:
    definition: ToolDefinition
    handler: ToolHandler


class ToolRegistry:
    def __init__(self) -> None:
        self._tools: dict[str, RegisteredTool] = {}

    def register(self, definition: ToolDefinition, handler: ToolHandler) -> None:
        if definition.name in self._tools:
            raise ValueError(f"tool already registered: {definition.name}")
        self._tools[definition.name] = RegisteredTool(
            definition=definition,
            handler=handler,
        )

    def get(self, name: str) -> RegisteredTool | None:
        return self._tools.get(name)

    def list(self) -> list[ToolDefinition]:
        return [registered.definition for registered in self._tools.values()]

    def set_status(self, name: str, status: str) -> ToolDefinition:
        registered = self._tools.get(name)
        if registered is None:
            raise KeyError(name)
        updated = registered.definition.model_copy(update={"status": status})
        self._tools[name] = RegisteredTool(definition=updated, handler=registered.handler)
        return updated
```

### 第二步：写三个教学工具

创建 `app/tools/builtins.py`：

```python
from pathlib import Path
from typing import Any

from pydantic import BaseModel, Field

from app.tools.schemas import ToolContext, ToolDefinition

COURSE_WORKSPACE = Path("/tmp/agent-platform-workspace").resolve()


class WeatherArguments(BaseModel):
    city: str = Field(min_length=1, max_length=50)


async def get_weather(arguments: dict[str, Any], context: ToolContext) -> dict[str, Any]:
    parsed = WeatherArguments.model_validate(arguments)
    return {"city": parsed.city, "condition": "sunny", "temperature_c": 24}


class ReadFileArguments(BaseModel):
    path: str = Field(min_length=1)


async def read_course_file(arguments: dict[str, Any], context: ToolContext) -> dict[str, Any]:
    parsed = ReadFileArguments.model_validate(arguments)
    target = (COURSE_WORKSPACE / parsed.path).resolve()
    if COURSE_WORKSPACE not in target.parents and target != COURSE_WORKSPACE:
        raise ValueError("path escapes workspace")
    if not target.is_file():
        raise ValueError("file does not exist")
    return {"path": parsed.path, "content": target.read_text(encoding="utf-8")}


class WriteNoteArguments(BaseModel):
    path: str = Field(pattern=r"^notes/[a-z0-9_-]+\\.md$")
    content: str = Field(min_length=1, max_length=10_000)


async def write_note(arguments: dict[str, Any], context: ToolContext) -> dict[str, Any]:
    parsed = WriteNoteArguments.model_validate(arguments)
    target = (COURSE_WORKSPACE / parsed.path).resolve()
    if COURSE_WORKSPACE not in target.parents:
        raise ValueError("path escapes workspace")
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(parsed.content, encoding="utf-8")
    return {"path": parsed.path, "bytes_written": len(parsed.content.encode("utf-8"))}


WEATHER_TOOL = ToolDefinition(
    name="get_weather",
    description="查询指定城市的教学用天气数据，只读且没有外部副作用。",
    input_schema=WeatherArguments.model_json_schema(),
    output_schema={"type": "object"},
    risk_level="read",
)

READ_FILE_TOOL = ToolDefinition(
    name="read_course_file",
    description="读取课程工作目录中的一个文本文件，只读且限制在工作目录内。",
    input_schema=ReadFileArguments.model_json_schema(),
    output_schema={"type": "object"},
    required_scopes=["workspace:read"],
    risk_level="read",
)

WRITE_NOTE_TOOL = ToolDefinition(
    name="write_note",
    description="在课程工作目录的 notes 目录创建或覆盖一个 Markdown 笔记文件。",
    input_schema=WriteNoteArguments.model_json_schema(),
    output_schema={"type": "object"},
    required_scopes=["notes:write"],
    risk_level="write",
)
```

### 关键安全点：路径穿越

用户或模型可能传入 `../../.ssh/id_rsa`。`Path.resolve()` 后必须确认目标仍在允许的工作目录内。仅检查字符串是否以 `workspace` 开头不安全，因为 `workspace/../secret` 也可能通过字符串检查。

初始化工作目录：

```bash
mkdir -p /tmp/agent-platform-workspace/notes
printf '欢迎来到课程工作区\n' > /tmp/agent-platform-workspace/readme.txt
```

### 第三步：创建工具工厂

创建 `app/tools/factory.py`：

```python
from app.tools.builtins import (
    READ_FILE_TOOL,
    WEATHER_TOOL,
    WRITE_NOTE_TOOL,
    get_weather,
    read_course_file,
    write_note,
)
from app.tools.registry import ToolRegistry


def create_registry() -> ToolRegistry:
    registry = ToolRegistry()
    registry.register(WEATHER_TOOL, get_weather)
    registry.register(READ_FILE_TOOL, read_course_file)
    registry.register(WRITE_NOTE_TOOL, write_note)
    return registry
```

### 本课验收

- Registry 中有 3 个工具；
- 同名注册会报错；
- `read_course_file` 无法读取工作目录之外的文件；
- `write_note` 的路径只能是 `notes/*.md`；
- 工具定义能返回给前端展示。

---
