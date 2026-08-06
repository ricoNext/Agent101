# 第 5 章：Multi-Agent、Skill 与 A2A

## 本章完成后的效果

完成本章后，平台能把一个复杂任务拆成多个受限子任务，并由 Supervisor 汇总结果：

- 每个 Subagent 都有任务目标、上下文、工具、预算和输出 Schema；
- 无依赖的只读任务可并行，写任务默认串行并需要审批；
- 子任务的结果保留证据、来源和失败状态；
- Supervisor 使用确定性规则优先处理冲突；
- Skill 被定义为可版本化的任务方法；
- 前端可以展示协作关系、进度和冲突；
- A2A 作为选修：实现 Agent Card 和最小 Task 生命周期。

本章先问“是否应该使用多个 Agent”，再写协作代码。多个 Agent 并不天然提高质量。

---

## 课程目录

1. [第 28 课：判断是否需要 Multi-Agent](./lesson-28-determine-need-multi-agent.md)
2. [第 29 课：定义 Subtask 和结果协议](./lesson-29-subtask-result-protocol.md)
3. [第 30 课：实现并行 Supervisor](./lesson-30-parallel-supervisor.md)
4. [第 31 课：结果聚合、冲突和 Reviewer](./lesson-31-result-aggregation-conflict-reviewer.md)
5. [第 32 课：把重复任务封装为 Skill](./lesson-32-skill-encapsulation.md)
6. [第 33 课：A2A 选修实验](./lesson-33-a2a-experiment.md)
7. [第 34 课：创建协作任务页并完成验收](./lesson-34-collaboration-page-acceptance.md)
