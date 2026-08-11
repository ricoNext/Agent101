# 第 7 课：最小 MCP Server 选修实验

> 所属章节：[第 2 章：构建 Tool Runtime 与 MCP 接入](./index.md)  
> 上一课：[第 6 课：创建工具管理和审批页面](./lesson-13-tool-management-approval-page.md)

### 你将完成什么

理解 MCP Server 的位置：它把外部能力以标准协议暴露出来；你的 Tool Runtime 仍负责在平台内部做白名单、权限和审计。

### 安装

在 API 虚拟环境中执行：

```bash
pip install mcp
```

MCP Python SDK 的 API 可能随版本变化。先执行：

```bash
python -c "import mcp; print(getattr(mcp, '__version__', 'version unavailable'))"
```

并以当前官方文档核对 Transport 和启动命令。

### 教学 Server 示例

创建 `app/mcp_course_server.py`：

```python
from pathlib import Path

from mcp.server.fastmcp import FastMCP

mcp = FastMCP("course-files")
WORKSPACE = Path("/tmp/agent-platform-workspace").resolve()


@mcp.tool()
def list_course_files() -> list[str]:
    """列出课程工作目录中的文本文件。"""
    return [str(path.relative_to(WORKSPACE)) for path in WORKSPACE.rglob("*") if path.is_file()]


@mcp.tool()
def read_course_file_from_mcp(path: str) -> str:
    """读取课程工作目录中的一个文本文件。"""
    target = (WORKSPACE / path).resolve()
    if WORKSPACE not in target.parents:
        raise ValueError("path escapes workspace")
    return target.read_text(encoding="utf-8")


if __name__ == "__main__":
    mcp.run(transport="stdio")
```

### 你必须知道的限制

- 这个示例只说明“如何暴露 MCP 工具”，没有替代 Runtime 的授权；
- 不要直接把不可信 MCP Server 接入生产环境；
- 接入前要检查工具名称、版本、可用 Scope、网络地址和审计策略；
- 第五章会讨论不同 Agent 的互操作，MCP 不等于 A2A。

### 本章最终验收

- Tool Registry、Runtime、审计和工具管理页能运行；
- 只读、写入和高风险的处理策略明确；
- 参数错误、越权、未审批、路径穿越和未知工具均有测试；
- 每次调用都有 `run_id` 和审计记录；
- 选修 MCP Server 能启动，或你已完成其协议边界说明。

### 进入第三章前的复盘

在 `docs/chapter-02-retrospective.md` 回答：

1. 为什么模型产生 Tool Call 后仍不能直接执行？
2. Scope、风险等级和审批分别解决什么问题？
3. 为什么写操作不能简单重试？
4. 为什么路径校验必须在服务端完成？
5. MCP 和 Tool Runtime 的边界是什么？

第三章会让模型在循环中选择工具。那时这一章的 Runtime 是唯一允许执行工具的入口。
