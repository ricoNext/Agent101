# 第 4 课：实现最小 Agent Loop

> 所属章节：[第 3 章：实现可恢复的 Agent Loop 与 Codebase Agent](./index.md)  
> 上一课：[第 3 课：定义 Agent Decision 并实现 Scripted Decider](./lesson-17-agent-decision-scripted-decider.md)  
> 下一课：[第 5 课：审批、取消和恢复](./lesson-19-approval-cancel-resume.md)

### 你将完成什么

将 Decision、Runtime 和 RunStore 串起来。这个 Runner 是本章最重要的代码。

创建 `app/agents/runner.py`：

```python
from datetime import UTC, datetime

from app.agents.decider import AgentDecider
from app.agents.schemas import AgentRun, AgentStep
from app.agents.store import InMemoryRunStore
from app.tools.runtime import ToolRuntime
from app.tools.schemas import ToolContext, ToolInvocation


class AgentRunner:
    def __init__(
        self,
        *,
        decider: AgentDecider,
        runtime: ToolRuntime,
        store: InMemoryRunStore,
    ) -> None:
        self.decider = decider
        self.runtime = runtime
        self.store = store

    async def run(self, run_id: str) -> AgentRun:
        run = self.store.get(run_id)
        if run is None:
            raise KeyError(run_id)
        if run.status not in {"created", "running"}:
            return run

        run.status = "running"
        self.store.save(run)

        while run.current_step < run.max_steps:
            if run.cancel_requested:
                run.status = "cancelled"
                self.store.save(run)
                return run

            decision = await self.decider.decide(run)
            run.current_step += 1
            run.steps.append(
                AgentStep(
                    index=run.current_step,
                    kind="model",
                    name="decide",
                    input={"task": run.task},
                    output=decision.model_dump(),
                    status="completed",
                )
            )

            if decision.kind == "final":
                run.status = "completed"
                run.final_answer = decision.answer
                self.store.save(run)
                return run

            context = ToolContext(
                run_id=run.run_id,
                user_id=run.user_id,
                tenant_id=run.tenant_id,
                scopes={"workspace:read", "notes:write"},
                approved=False,
            )
            result = await self.runtime.invoke(
                ToolInvocation(
                    tool_name=decision.tool_name or "",
                    arguments=decision.arguments,
                    run_id=run.run_id,
                ),
                context,
            )
            run.steps.append(
                AgentStep(
                    index=run.current_step,
                    kind="tool",
                    name=decision.tool_name or "unknown",
                    input=decision.arguments,
                    output=result.model_dump(),
                    status="completed" if result.ok else "failed",
                )
            )
            self.store.save(run)

            if not result.ok and result.error and result.error.code == "approval_required":
                run.status = "waiting_approval"
                self.store.save(run)
                return run

        run.status = "failed"
        run.error_code = "max_steps_exceeded"
        run.error_message = "Agent 超过最大步骤数，已停止"
        self.store.save(run)
        return run
```

### 为什么在工具失败后仍保存状态

失败本身是重要信息。比如 `permission_denied` 告诉后续决策“不能继续尝试同一个工具”；`approval_required` 告诉 UI 展示审批卡片。若失败直接抛异常退出，你会失去恢复和解释能力。

### 第一步：写 Loop 测试

创建 `tests/test_agent_runner.py`：

```python
import pytest

from app.agents.decider import ScriptedDecider
from app.agents.runner import AgentRunner
from app.agents.schemas import AgentDecision, AgentRun
from app.agents.store import InMemoryRunStore
from app.tools.audit import InMemoryAuditStore
from app.tools.factory import create_registry
from app.tools.runtime import ToolRuntime


@pytest.mark.asyncio
async def test_agent_runs_a_tool_then_completes() -> None:
    store = InMemoryRunStore()
    run = AgentRun(
        run_id="agent-001",
        task="读取课程文件",
        user_id="student",
        tenant_id="course",
    )
    store.create(run)
    runner = AgentRunner(
        decider=ScriptedDecider(
            [
                AgentDecision(
                    kind="tool_call",
                    tool_name="read_course_file",
                    arguments={"path": "readme.txt"},
                ),
                AgentDecision(kind="final", answer="读取完成"),
            ]
        ),
        runtime=ToolRuntime(create_registry(), InMemoryAuditStore()),
        store=store,
    )

    finished = await runner.run("agent-001")

    assert finished.status == "completed"
    assert finished.final_answer == "读取完成"
    assert len(finished.steps) == 3
```

为什么是 3 步：第一次模型决策、一次工具执行、第二次模型决策。这种可解释计数有助于发现多余循环。

### 第二步：测试最大步骤限制

创建一个每次都返回同样 `get_weather` Tool Call 的 ScriptedDecider，并把 `max_steps=2`。预期最终状态为 `failed`，错误码为 `max_steps_exceeded`。

### 本课验收

- Agent 能调用只读工具后结束；
- 每一步都有 `AgentStep`；
- 最大步骤限制生效；
- 工具调用失败不会让 Run 丢失；
- 测试不调用真实模型。

---
