# 第 2 课：定义工具、调用和审计协议

> 所属章节：[第 2 章：构建 Tool Runtime 与 MCP 接入](./README.md)  
> 上一课：[第 1 课：理解工具调用的边界](./第01课-理解工具调用的边界.md)  
> 下一课：[第 3 课：实现 Tool Registry](./第03课-实现 Tool Registry.md)

### 你将完成什么

建立所有工具共用的数据模型。先统一协议，再写任何工具函数。

### 第一步：创建目录

在 `agent-platform/apps/api` 执行：

```bash
mkdir -p app/tools
touch app/tools/__init__.py
```

### 第二步：创建工具 Schema

创建 `app/tools/schemas.py`：

```python
from datetime import UTC, datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


RiskLevel = Literal["read", "write", "high"]
ToolStatus = Literal["enabled", "disabled"]


class ToolDefinition(BaseModel):
    name: str = Field(pattern=r"^[a-z][a-z0-9_]{2,63}$")
    description: str = Field(min_length=10)
    input_schema: dict[str, Any]
    output_schema: dict[str, Any]
    required_scopes: list[str] = Field(default_factory=list)
    risk_level: RiskLevel
    timeout_seconds: float = Field(default=10, gt=0, le=60)
    version: str = "1.0.0"
    status: ToolStatus = "enabled"


class ToolInvocation(BaseModel):
    tool_name: str
    arguments: dict[str, Any] = Field(default_factory=dict)
    run_id: str


class ToolContext(BaseModel):
    run_id: str
    user_id: str
    tenant_id: str
    scopes: set[str] = Field(default_factory=set)
    approved: bool = False


class ToolError(BaseModel):
    code: Literal[
        "tool_not_found",
        "tool_disabled",
        "invalid_arguments",
        "permission_denied",
        "approval_required",
        "tool_timeout",
        "tool_execution_failed",
        "output_validation_failed",
    ]
    message: str


class ToolResult(BaseModel):
    ok: bool
    tool_name: str
    run_id: str
    data: dict[str, Any] | None = None
    error: ToolError | None = None
    latency_ms: int


class ToolAuditRecord(BaseModel):
    audit_id: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    run_id: str
    user_id: str
    tenant_id: str
    tool_name: str
    arguments: dict[str, Any]
    risk_level: RiskLevel
    allowed: bool
    result_code: str
    latency_ms: int
```

### 为什么 `ToolResult` 不直接抛异常

工具失败是 Agent 工作流的一部分。模型可能需要根据 `permission_denied` 改为请求审批，或根据 `tool_timeout` 改用其他工具。Runtime 需要把“预期的业务失败”变成结构化结果，而不是让 Python 堆栈直接污染模型上下文。

真正的编程错误仍应记录日志并转为 `tool_execution_failed`，以便排查。

### 本课验收

- 能解释 `ToolDefinition`、`ToolInvocation`、`ToolContext` 的区别；
- 任意工具调用都带 `run_id`；
- 高风险与低风险工具的差异在 Schema 中可见；
- 不能把用户传来的 `approved=true` 直接当成最终审批，下一课会补齐审批来源。

---
