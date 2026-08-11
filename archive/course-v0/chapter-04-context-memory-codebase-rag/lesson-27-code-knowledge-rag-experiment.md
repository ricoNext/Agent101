# 第 6 课：创建代码知识页面和 RAG 对照实验

> 所属章节：[第 4 章：Context、Memory 与 Codebase RAG](./index.md)  
> 上一课：[第 5 课：项目记忆与 Context Builder 集成](./lesson-26-project-memory-context-builder.md)

### 你将完成什么

让用户看见 Agent 找到了什么证据，并对比不同检索策略。

### 前端页面要求

创建 `/knowledge` 页面，至少有：

- 问题输入框；
- 检索策略选择：关键词、向量、Hybrid；
- 结果列表，显示路径、行号、分数和命中原因；
- 代码片段；
- “加入当前上下文”与“排除”操作；
- 当前 Project Memory；
- Context Budget Report；
- 生成答案后显示答案引用。

前端不要把引用只渲染成普通文字。路径和行号应可点击或至少可复制，方便用户到编辑器验证。

### 对照实验题目

为示例仓库准备至少 5 个问题：

1. `add` 函数在哪里？
2. 测试命令是什么？
3. 登录逻辑经过哪些文件？
4. 一个不存在的支付模块在哪里？
5. 新增计算函数时应补哪些测试？

每题分别运行：关键词、向量、Hybrid、Hybrid + Rerank。记录：

| 问题 | 关键 Chunk 是否召回 | 引用是否正确 | 延迟 | 输入 Token |
|------|----------------------|--------------|------|------------|

第六章会把这张表变成 Golden Dataset。

### 第四章最终验收

- Context Budget 和 Debug Report 可用；
- 索引、Chunk、关键词检索和向量接口已实现；
- 检索结果含路径和行号；
- Project Memory 可管理；
- `/knowledge` 能显示检索和上下文选择；
- 至少完成 5 个检索策略对照实验；
- Agent 不能在没有证据时伪造引用。

### 进入第五章前的复盘

在 `docs/chapter-04-retrospective.md` 回答：

1. 为什么 Context Window 不是“越大越好”？
2. Project Memory 与 Agent State 有什么不同？
3. 为什么关键词检索不能被向量检索完全替代？
4. Rerank 为什么不能修复没有召回到的证据？
5. 如果引用错误，应优先排查 RAG 的哪一层？

第五章开始把复杂任务拆给多个 Agent。此时每个子 Agent 都需要受控上下文和最小工具集合，不能共享整个主任务的全部信息。
