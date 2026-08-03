# 第 3 章：实现可恢复的 Agent Loop 与 Codebase Agent

## 本章完成后的效果

完成本章后，项目会从“用户手动调用工具”升级为“Agent 按步骤调用工具”：

- 一个任务拥有明确状态、步骤和最终结果；
- Agent 每轮只能返回“调用工具”或“结束任务”两类结构化决策；
- Loop 有最大步数、超时、取消和失败状态；
- 任务可保存 Checkpoint 并恢复；
- 代码仓库操作使用受限工具，不允许自由 Shell；
- 前端任务工作台能显示状态、步骤、工具结果和人工审批。

本章仍优先使用确定性的 Scripted Decider 做测试。将真实模型接入决策层是最后一步，而不是第一步。

---

## 课程目录

1. [第 1 课：把“对话”变成“任务”](./第01课-把“对话”变成“任务”.md)
2. [第 2 课：保存任务和 Checkpoint](./第02课-保存任务和 Checkpoint.md)
3. [第 3 课：定义 Agent Decision 并实现 Scripted Decider](./第03课-定义 Agent Decision 并实现 Scripted Decider.md)
4. [第 4 课：实现最小 Agent Loop](./第04课-实现最小 Agent Loop.md)
5. [第 5 课：审批、取消和恢复](./第05课-审批、取消和恢复.md)
6. [第 6 课：构建受限 Codebase 工具和 Sandbox](./第06课-构建受限 Codebase 工具和 Sandbox.md)
7. [第 7 课：接入真实模型决策和任务工作台](./第07课-接入真实模型决策和任务工作台.md)
