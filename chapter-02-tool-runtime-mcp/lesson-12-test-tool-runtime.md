# 第 5 课：测试 Tool Runtime

> 所属章节：[第 2 章：构建 Tool Runtime 与 MCP 接入](./README.md)  
> 上一课：[第 4 课：实现权限、审批、超时和审计](./第04课-实现权限、审批、超时和审计.md)  
> 下一课：[第 6 课：创建工具管理和审批页面](./第06课-创建工具管理和审批页面.md)

### 你将完成什么

为 Runtime 的关键边界写测试。不要只测“天气工具返回太阳”。

创建 `tests/test_tool_runtime.py`：

```python
import pytest

from app.tools.audit import InMemoryAuditStore
from app.tools.factory import create_registry
from app.tools.runtime import ToolRuntime
from app.tools.schemas import ToolContext, ToolInvocation


@pytest.fixture
def runtime() -> ToolRuntime:
    return ToolRuntime(create_registry(), InMemoryAuditStore())


@pytest.fixture
def read_context() -> ToolContext:
    return ToolContext(
        run_id="run-test",
        user_id="student",
        tenant_id="course",
        scopes={"workspace:read"},
    )


@pytest.mark.asyncio
async def test_read_tool_requires_scope(runtime: ToolRuntime) -> None:
    result = await runtime.invoke(
        ToolInvocation(
            tool_name="read_course_file",
            run_id="run-test",
            arguments={"path": "readme.txt"},
        ),
        ToolContext(run_id="run-test", user_id="student", tenant_id="course"),
    )

    assert result.ok is False
    assert result.error is not None
    assert result.error.code == "permission_denied"


@pytest.mark.asyncio
async def test_write_tool_requires_approval(runtime: ToolRuntime) -> None:
    result = await runtime.invoke(
        ToolInvocation(
            tool_name="write_note",
            run_id="run-test",
            arguments={"path": "notes/test.md", "content": "test"},
        ),
        ToolContext(
            run_id="run-test",
            user_id="student",
            tenant_id="course",
            scopes={"notes:write"},
            approved=False,
        ),
    )

    assert result.ok is False
    assert result.error is not None
    assert result.error.code == "approval_required"


@pytest.mark.asyncio
async def test_unknown_tool_returns_structured_error(runtime: ToolRuntime, read_context: ToolContext) -> None:
    result = await runtime.invoke(
        ToolInvocation(tool_name="does_not_exist", run_id="run-test", arguments={}),
        read_context,
    )

    assert result.ok is False
    assert result.error is not None
    assert result.error.code == "tool_not_found"
```

运行：

```bash
pytest -q
```

主动增加两个测试：参数错误和路径穿越。路径穿越请求应使用 `{"path":"../../secret.txt"}`，预期错误为 `invalid_arguments`。

### 本课验收

- 至少有 5 个 Tool Runtime 测试；
- 你能区分“未授权”和“工具内部失败”；
- 测试不会调用真实模型或真实外部服务；
- 每个失败测试都对应第 1 课画出的失败流程。

---
