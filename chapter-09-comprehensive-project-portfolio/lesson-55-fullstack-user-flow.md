# 第 3 课：完成全栈用户流程

> 所属章节：[第 9 章：完成一个可展示的全栈 Agent 产品](./index.md)  
> 上一课：[第 2 课：冻结架构和核心任务](./lesson-54-architecture-core-tasks.md)  
> 下一课：[第 4 课：做一次真实的质量改进](./lesson-56-quality-improvement.md)

前端必须包含：

- 登录或教学身份切换；
- 任务创建和历史；
- 流式状态；
- 工具事件；
- 审批；
- 引用/证据；
- Trace 或 Eval 入口；
- 错误、取消和恢复。

后端必须包含：

- 输入输出 Schema；
- Tool Runtime；
- Run/Checkpoint；
- 权限和审批；
- Trace、审计和成本；
- Golden Tasks；
- Docker Compose。

用 Playwright 写至少 3 条端到端测试：成功任务、审批任务、失败/取消任务。页面不是聊天壳，而是让用户能控制和理解 Agent 的工作台。

---
