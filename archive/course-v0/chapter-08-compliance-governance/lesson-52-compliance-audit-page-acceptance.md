# 第 6 课：合规与审计页面、本章验收

> 所属章节：[第 8 章：身份、审批、审计与治理](./index.md)  
> 上一课：[第 5 课：Human-in-the-loop 和 Kill Switch](./lesson-51-human-in-loop-kill-switch.md)

创建 `/governance` 页面：

- 风险任务列表；
- 审批队列；
- 工具 Scope 矩阵；
- 审计事件详情；
- 脱敏预览；
- 租户过滤状态；
- Kill Switch 操作和历史；
- 合规检查清单。

Governance Agent 是选修：它可以汇总审计异常、提示缺失文档，但绝不能替代规则引擎、权限检查、审批和 Kill Switch。

本章最终验收：

- 用户、Agent、工具身份可追踪；
- 委托不扩大 Scope；
- 写/高风险工具使用真实审批单；
- 租户数据不会通过 RAG、缓存或审计串出；
- 敏感信息不会进入普通日志；
- Kill Switch 演练可审计；
- 有 `docs/risk-assessment.md` 和控制映射。

进入第九章前复盘：你的综合产品中哪些动作应该自动化，哪些必须由人确认？发生严重异常时，谁能停止系统，谁能恢复？
