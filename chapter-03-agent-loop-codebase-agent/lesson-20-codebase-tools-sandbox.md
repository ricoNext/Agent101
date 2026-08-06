# 第 6 课：构建受限 Codebase 工具和 Sandbox

> 所属章节：[第 3 章：实现可恢复的 Agent Loop 与 Codebase Agent](./index.md)  
> 上一课：[第 5 课：审批、取消和恢复](./lesson-19-approval-cancel-resume.md)  
> 下一课：[第 7 课：接入真实模型决策和任务工作台](./lesson-21-real-model-decision-workbench.md)

### 你将完成什么

新增代码仓库工具，但拒绝让模型执行任意 Shell 命令。先做一个安全、有限、可记录的教学 Sandbox。

### 第一步：准备示例仓库

创建一个专用工作目录，不要把 Agent 直接指向你的真实项目：

```bash
mkdir -p /tmp/agent-platform-repo/src /tmp/agent-platform-repo/tests
cat > /tmp/agent-platform-repo/src/calculator.py <<'EOF'
def add(left: int, right: int) -> int:
    return left + right
EOF
cat > /tmp/agent-platform-repo/tests/test_calculator.py <<'EOF'
from src.calculator import add


def test_add() -> None:
    assert add(1, 2) == 3
EOF
```

### 第二步：只允许固定命令

创建 `app/agents/sandbox.py`：

```python
import asyncio
from pathlib import Path

REPOSITORY_ROOT = Path("/tmp/agent-platform-repo").resolve()
ALLOWED_COMMANDS = {
    "run_tests": ["pytest", "-q"],
    "git_status": ["git", "status", "--short"],
    "git_diff": ["git", "diff", "--"],
}


class SandboxError(Exception):
    pass


async def run_allowed_command(name: str, timeout_seconds: float = 30) -> dict[str, str | int]:
    command = ALLOWED_COMMANDS.get(name)
    if command is None:
        raise SandboxError("command is not allowed")

    process = await asyncio.create_subprocess_exec(
        *command,
        cwd=REPOSITORY_ROOT,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    try:
        stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=timeout_seconds)
    except asyncio.TimeoutError:
        process.kill()
        await process.communicate()
        raise SandboxError("command timed out")

    return {
        "exit_code": process.returncode,
        "stdout": stdout.decode("utf-8", errors="replace"),
        "stderr": stderr.decode("utf-8", errors="replace"),
    }
```

不要使用 `create_subprocess_shell`，也不要把模型生成的字符串传给 Shell。`exec` 形式和固定参数能显著缩小攻击面。

### 第三步：封装代码工具

新增工具时沿用第二章的 Runtime。建议先实现：

- `list_files`：只列出仓库根目录内文件；
- `search_code`：限制搜索后缀、关键词长度和最大结果数；
- `read_file`：沿用路径边界检查；
- `run_test`：只调用 `run_allowed_command("run_tests")`；
- `git_diff`：只读；
- `apply_patch`：第三章只生成 diff，实际应用必须审批。

不要在本课实现“任意命令执行”。这是 Agent 系统最危险的快捷方式之一。

### Docker Sandbox 的位置

本地受限目录只能用于教学。真实代码执行最好使用容器或隔离虚拟化，并进一步限制网络、CPU、内存、挂载目录和环境变量。第七章再把 Sandbox 放入 Docker Compose；在理解命令白名单前不要用容器掩盖安全问题。

### 本课验收

- Agent 只能访问 `/tmp/agent-platform-repo`；
- 不在白名单中的命令被拒绝；
- 测试输出、退出码和超时可记录；
- 真实用户仓库未被 Agent 修改；
- 你能解释为什么 Docker 不是唯一安全控制。

---
