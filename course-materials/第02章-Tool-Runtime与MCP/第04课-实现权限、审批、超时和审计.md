# 第 4 课：实现权限、审批、超时和审计

> 所属章节：[第 2 章：构建 Tool Runtime 与 MCP 接入](./README.md)  
> 上一课：[第 3 课：实现 Tool Registry](./第03课-实现 Tool Registry.md)  
> 下一课：[第 5 课：测试 Tool Runtime](./第05课-测试 Tool Runtime.md)

### 你将完成什么

实现真正的 Tool Runtime。任何调用都要从 Runtime 进入，不能直接调用 handler。

### 第一步：写内存审计仓库

创建 `app/tools/audit.py`：

```python
from app.tools.schemas import ToolAuditRecord


class InMemoryAuditStore:
    def __init__(self) -> None:
        self._records: list[ToolAuditRecord] = []

    def add(self, record: ToolAuditRecord) -> None:
        self._records.append(record)

    def list_for_run(self, run_id: str) -> list[ToolAuditRecord]:
        return [record for record in self._records if record.run_id == run_id]
```

### 第二步：写 Runtime

创建 `app/tools/runtime.py`：

```python
import asyncio
import time
import uuid
from typing import Any

from pydantic import ValidationError

from app.tools.audit import InMemoryAuditStore
from app.tools.registry import ToolRegistry
from app.tools.schemas import (
    ToolAuditRecord,
    ToolContext,
    ToolError,
    ToolInvocation,
    ToolResult,
)


class ToolRuntime:
    def __init__(self, registry: ToolRegistry, audit_store: InMemoryAuditStore) -> None:
        self.registry = registry
        self.audit_store = audit_store

    async def invoke(self, invocation: ToolInvocation, context: ToolContext) -> ToolResult:
        started_at = time.perf_counter()
        registered = self.registry.get(invocation.tool_name)

        if registered is None:
            return self._error(invocation, context, "tool_not_found", "工具不存在", started_at)
        definition = registered.definition
        if definition.status != "enabled":
            return self._error(invocation, context, "tool_disabled", "工具已被下线", started_at)

        missing_scopes = set(definition.required_scopes) - context.scopes
        if missing_scopes:
            return self._error(
                invocation,
                context,
                "permission_denied",
                f"缺少权限：{', '.join(sorted(missing_scopes))}",
                started_at,
            )

        if definition.risk_level in {"write", "high"} and not context.approved:
            return self._error(
                invocation,
                context,
                "approval_required",
                "写入或高风险工具需要人工审批",
                started_at,
            )

        try:
            data = await asyncio.wait_for(
                registered.handler(invocation.arguments, context),
                timeout=definition.timeout_seconds,
            )
        except ValidationError as error:
            return self._error(invocation, context, "invalid_arguments", str(error), started_at)
        except asyncio.TimeoutError:
            return self._error(invocation, context, "tool_timeout", "工具执行超时", started_at)
        except ValueError as error:
            return self._error(invocation, context, "invalid_arguments", str(error), started_at)
        except Exception:
            return self._error(
                invocation,
                context,
                "tool_execution_failed",
                "工具执行失败，请查看审计和服务日志",
                started_at,
            )

        latency_ms = int((time.perf_counter() - started_at) * 1000)
        result = ToolResult(
            ok=True,
            tool_name=definition.name,
            run_id=invocation.run_id,
            data=data,
            latency_ms=latency_ms,
        )
        self._audit(invocation, context, definition.risk_level, True, "ok", latency_ms)
        return result

    def _error(
        self,
        invocation: ToolInvocation,
        context: ToolContext,
        code: str,
        message: str,
        started_at: float,
    ) -> ToolResult:
        latency_ms = int((time.perf_counter() - started_at) * 1000)
        result = ToolResult(
            ok=False,
            tool_name=invocation.tool_name,
            run_id=invocation.run_id,
            error=ToolError(code=code, message=message),
            latency_ms=latency_ms,
        )
        registered = self.registry.get(invocation.tool_name)
        risk_level = registered.definition.risk_level if registered else "high"
        self._audit(invocation, context, risk_level, False, code, latency_ms)
        return result

    def _audit(
        self,
        invocation: ToolInvocation,
        context: ToolContext,
        risk_level: str,
        allowed: bool,
        result_code: str,
        latency_ms: int,
    ) -> None:
        self.audit_store.add(
            ToolAuditRecord(
                audit_id=str(uuid.uuid4()),
                run_id=invocation.run_id,
                user_id=context.user_id,
                tenant_id=context.tenant_id,
                tool_name=invocation.tool_name,
                arguments=invocation.arguments,
                risk_level=risk_level,
                allowed=allowed,
                result_code=result_code,
                latency_ms=latency_ms,
            )
        )
```

### 代码为什么这样写

- `asyncio.wait_for` 给 handler 加执行时间上限；
- 权限和审批在 handler 之前检查，避免产生副作用；
- 审计不仅记录成功，也记录被拒绝的调用；
- `Exception` 不把内部堆栈返回给前端或模型；
- 这里的 `approved` 只是教学简化，第三章会改成持久化审批单，避免用户伪造参数。

### 第三步：把 Runtime 装配到 FastAPI

创建 `app/tools/dependencies.py`：

```python
from app.tools.audit import InMemoryAuditStore
from app.tools.factory import create_registry
from app.tools.runtime import ToolRuntime

registry = create_registry()
audit_store = InMemoryAuditStore()
runtime = ToolRuntime(registry=registry, audit_store=audit_store)
```

在 `app/main.py` 增加：

```python
from fastapi import Header, HTTPException

from app.tools.dependencies import audit_store, registry, runtime
from app.tools.schemas import ToolContext, ToolInvocation, ToolResult


@app.get("/v1/tools")
async def list_tools():
    return registry.list()


@app.post("/v1/tools/invoke", response_model=ToolResult)
async def invoke_tool(
    invocation: ToolInvocation,
    x_user_id: str = Header(default="student"),
    x_tenant_id: str = Header(default="course"),
    x_scopes: str = Header(default=""),
    x_approved: str = Header(default="false"),
) -> ToolResult:
    context = ToolContext(
        run_id=invocation.run_id,
        user_id=x_user_id,
        tenant_id=x_tenant_id,
        scopes={scope for scope in x_scopes.split(",") if scope},
        approved=x_approved.lower() == "true",
    )
    return await runtime.invoke(invocation, context)


@app.get("/v1/tool-audits/{run_id}")
async def list_tool_audits(run_id: str):
    return audit_store.list_for_run(run_id)
```

`x_approved` 只用于本课模拟审批，绝不能在真实系统中由浏览器直接决定。第八章会使用服务端审批记录和身份验证。

### 第四步：手工调用工具

调用天气工具：

```bash
curl -X POST http://127.0.0.1:8000/v1/tools/invoke \
  -H 'content-type: application/json' \
  -d '{"tool_name":"get_weather","run_id":"tool-demo-001","arguments":{"city":"上海"}}'
```

读取课程文件：

```bash
curl -X POST http://127.0.0.1:8000/v1/tools/invoke \
  -H 'content-type: application/json' \
  -H 'x-scopes: workspace:read' \
  -d '{"tool_name":"read_course_file","run_id":"tool-demo-002","arguments":{"path":"readme.txt"}}'
```

写笔记但不审批：

```bash
curl -X POST http://127.0.0.1:8000/v1/tools/invoke \
  -H 'content-type: application/json' \
  -H 'x-scopes: notes:write' \
  -d '{"tool_name":"write_note","run_id":"tool-demo-003","arguments":{"path":"notes/first.md","content":"hello"}}'
```

预期错误码：`approval_required`。把请求加上 `-H 'x-approved: true'`，才会写入教学目录。

### 本课验收

- 只读工具可执行；
- 缺少 Scope 时返回 `permission_denied`；
- 写工具未审批时返回 `approval_required`；
- 每次调用可通过 `/v1/tool-audits/{run_id}` 查询；
- 任何失败都有结构化错误码。

---
