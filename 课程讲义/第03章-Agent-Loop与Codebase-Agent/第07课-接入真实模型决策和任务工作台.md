# 第 7 课：接入真实模型决策和任务工作台

> 所属章节：[第 3 章：实现可恢复的 Agent Loop 与 Codebase Agent](./README.md)  
> 上一课：[第 6 课：构建受限 Codebase 工具和 Sandbox](./第06课-构建受限 Codebase 工具和 Sandbox.md)

### 你将完成什么

将第一章的 LLM Gateway 接入 `AgentDecider`，要求模型返回结构化 Decision；然后创建前端任务工作台。

### 第一步：定义决策 Prompt

模型必须只返回 JSON：

```text
你是一个受限的代码任务 Agent。

当前任务：{task}
允许工具：{tools}
已完成步骤：{steps}

只返回 JSON：
{
  "kind": "tool_call" 或 "final",
  "tool_name": "仅在 tool_call 时填写",
  "arguments": {},
  "answer": "仅在 final 时填写"
}

规则：
- 不要调用未列出的工具。
- 不要尝试自行执行 Shell。
- 信息不足时使用读取或搜索工具。
- 写操作必须先请求工具，系统会单独审批。
```

创建 `LLMDecider` 时，将模型文本传给 `AgentDecision.model_validate_json()`。解析失败时，不要假装模型已经给出最终答案；把 Run 标记为 `failed`，错误码设为 `invalid_model_decision`，并保存原始响应摘要。

### 第二步：创建任务页面

创建 `apps/web/src/app/runs/page.tsx`。页面至少有：

- 任务输入框；
- 当前状态；
- 步骤列表；
- 每一步的工具名、参数摘要、结果和耗时；
- `waiting_approval` 时的批准和拒绝按钮；
- 取消按钮；
- 完成后的最终答案和修改摘要；
- 刷新页面后通过 `run_id` 恢复。

推荐状态映射：

| 后端状态 | 前端文案 | 用户可操作 |
|----------|----------|------------|
| created | 等待开始 | 无 |
| running | 正在执行 | 取消 |
| waiting_approval | 等待你的确认 | 批准、拒绝、取消 |
| completed | 已完成 | 查看结果和 Trace |
| failed | 执行失败 | 查看错误、重新创建任务 |
| cancelled | 已取消 | 新建任务 |

### 第三步：最小前端验收流程

1. 创建“读取课程文件”任务；
2. 观察 `running -> completed`；
3. 创建“写入笔记”任务；
4. 观察 `waiting_approval`；
5. 批准后确认文件写入；
6. 创建一个超过最大步骤的任务；
7. 确认页面显示失败而非无限加载；
8. 点击取消并确认后端 Run 状态变化。

### 第三章最终验收

- Agent Run、Step、状态机和 Checkpoint 存在；
- Loop 的最大步骤、取消和失败边界可验证；
- Tool Runtime 是唯一工具执行入口；
- 写操作进入审批；
- 代码仓库工具处于受限 Sandbox 中；
- 任务工作台能呈现真实后端状态；
- 有 Scripted Decider 测试和至少一次真实模型实验；
- 失败 Run 可以查询和解释。

### 进入第四章前的复盘

在 `docs/chapter-03-retrospective.md` 回答：

1. 为什么 Agent Run 需要独立于聊天记录？
2. Loop 的停止条件有哪些？
3. Checkpoint 保存什么，不保存什么？
4. 为什么不让模型自由生成 Shell 命令？
5. 为什么先用 Scripted Decider 再用真实模型？

第四章将改进 Agent 的“信息输入”。你会发现，很多看似模型能力不足的问题，其实是 Context、检索和记忆管理失败。
