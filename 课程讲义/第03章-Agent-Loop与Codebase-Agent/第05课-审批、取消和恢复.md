# 第 5 课：审批、取消和恢复

> 所属章节：[第 3 章：实现可恢复的 Agent Loop 与 Codebase Agent](./README.md)  
> 上一课：[第 4 课：实现最小 Agent Loop](./第04课-实现最小 Agent Loop.md)  
> 下一课：[第 6 课：构建受限 Codebase 工具和 Sandbox](./第06课-构建受限 Codebase 工具和 Sandbox.md)

### 你将完成什么

让 Agent 在写操作前进入 `waiting_approval`，并能在批准后从 Checkpoint 继续；同时支持取消。

### 第一步：保存待审批调用

在 `AgentRun` 中增加字段：

```python
pending_invocation: dict[str, Any] | None = None
```

在 `runner.py` 中，当收到 `approval_required` 时保存：

```python
run.pending_invocation = {
    "tool_name": decision.tool_name,
    "arguments": decision.arguments,
}
run.status = "waiting_approval"
```

### 第二步：实现批准后的恢复方法

在 `AgentRunner` 中加入：

```python
async def approve_and_resume(self, run_id: str) -> AgentRun:
    run = self.store.get(run_id)
    if run is None:
        raise KeyError(run_id)
    if run.status != "waiting_approval" or run.pending_invocation is None:
        raise ValueError("run is not waiting for approval")

    invocation = run.pending_invocation
    result = await self.runtime.invoke(
        ToolInvocation(
            tool_name=invocation["tool_name"],
            arguments=invocation["arguments"],
            run_id=run.run_id,
        ),
        ToolContext(
            run_id=run.run_id,
            user_id=run.user_id,
            tenant_id=run.tenant_id,
            scopes={"workspace:read", "notes:write"},
            approved=True,
        ),
    )
    run.pending_invocation = None
    run.status = "running"
    run.steps.append(
        AgentStep(
            index=run.current_step,
            kind="tool",
            name=invocation["tool_name"],
            input=invocation["arguments"],
            output=result.model_dump(),
            status="completed" if result.ok else "failed",
        )
    )
    self.store.save(run)
    return await self.run(run_id)
```

这是教学代码。生产版不能把 Scope 写死在 Runner，必须从经过认证的用户会话和审批记录中取得。

### 第三步：增加 API

创建 `app/agents/dependencies.py`：

```python
from app.agents.store import InMemoryRunStore
from app.tools.dependencies import runtime

run_store = InMemoryRunStore()
```

本课先在 `app/main.py` 中手动装配一个 ScriptedDecider，以便观察整个流程。真实模型 Decider 会在本章最后一课接入。

增加三个 API：

```text
POST /v1/runs                 创建并启动任务
GET  /v1/runs/{run_id}        查询任务
POST /v1/runs/{run_id}/approve 批准待审批操作
POST /v1/runs/{run_id}/cancel  取消任务
```

实现时遵循：查询接口只读；审批和取消都要保存步骤和状态；重复取消返回当前状态但不再次执行副作用。

### 故意制造失败

使用 ScriptedDecider 请求 `write_note`。预期：

1. Run 先进入 `waiting_approval`；
2. 写文件尚未出现；
3. 调用 approve 后文件出现；
4. 再调用 approve 应返回“不是待审批状态”；
5. 取消等待审批的 Run 后，不得继续执行写入。

### 本课验收

- 写操作会暂停而非失败；
- 状态和待审批参数可查询；
- 批准后可以恢复；
- 取消不会产生后续副作用；
- 审批和取消在任务步骤中可追踪。

---
