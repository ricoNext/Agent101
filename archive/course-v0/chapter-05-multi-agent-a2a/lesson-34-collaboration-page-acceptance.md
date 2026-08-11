# 第 7 课：创建协作任务页并完成验收

> 所属章节：[第 5 章：Multi-Agent、Skill 与 A2A](./index.md)  
> 上一课：[第 6 课：A2A 选修实验](./lesson-33-a2a-experiment.md)

### 前端页面要求

创建 `/collaboration` 页面，显示：

- 主任务和主 Agent；
- 子 Agent 列表、目标、状态、预算和耗时；
- 子任务证据；
- 聚合后的发现；
- 冲突和失败子任务；
- 取消单个子任务或将高风险问题转人工。

页面可以先用轮询获取 Run 状态；第七章再统一为事件流和持久化 Trace。不要展示模型完整内部思考，只展示目标、步骤摘要、工具事件、证据和结论。

### 本章最终验收

- 有三种 Specialist 和一个 Supervisor；
- Subtask 有目标、上下文、工具、Scope、预算和输出协议；
- 独立只读任务可并行；
- 超时、失败和冲突能被展示；
- Skill 可以重复使用；
- A2A 有最小概念实验或边界说明；
- 协作页面可以解释“谁做了什么、证据是什么”。

### 进入第六章前的复盘

写入 `docs/chapter-05-retrospective.md`：

1. 哪个任务不适合 Multi-Agent，为什么？
2. 为什么每个子任务都需要独立 Scope 和预算？
3. 为什么不能把所有子结果直接拼成最终报告？
4. Skill 与 Prompt 模板有什么不同？
5. A2A、MCP 和 Tool Runtime 的边界是什么？

第六章会用 Golden Dataset 和 Trace 验证：多 Agent 是否真的提高任务质量，还是只增加了成本和延迟。
