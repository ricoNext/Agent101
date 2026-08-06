# 第 1 课：判断是否需要 Multi-Agent

> 所属章节：[第 5 章：Multi-Agent、Skill 与 A2A](./README.md)  
> 下一课：[第 2 课：定义 Subtask 和结果协议](./第02课-定义 Subtask 和结果协议.md)

### 你将完成什么

为项目增加一张“任务分解决策表”，避免把所有任务都拆成多个模型调用。

### 判断规则

单 Agent 更适合：目标明确、步骤少、上下文集中、只需少量工具。

Multi-Agent 更适合：任务可拆成独立视角、每个视角工具/权限不同、需要审查或证据对照。

以“审查代码仓库”为例：

| 子任务 | 是否独立 | 允许工具 | 默认权限 |
|--------|----------|----------|----------|
| Architecture | 是 | list/search/read | repo:read |
| Test | 是 | list/search/read/run_test | repo:read, test:run |
| Security | 是 | list/search/read | repo:read |
| 修改代码 | 否 | apply_patch/run_test | repo:write + 审批 |

写入 `docs/chapter-05-decomposition.md`：为“代码可维护性分析”定义至少三个独立子任务，并说明为什么不把“修改代码”放进并行阶段。

### 本课验收

- 每个子任务有可验证的目标；
- 子任务不共享不必要的上下文和写权限；
- 你能说明用单 Agent 更简单的一个反例。

---
