# 第 5 课：把重复任务封装为 Skill

> 所属章节：[第 5 章：Multi-Agent、Skill 与 A2A](./index.md)  
> 上一课：[第 4 课：结果聚合、冲突和 Reviewer](./lesson-31-result-aggregation-conflict-reviewer.md)  
> 下一课：[第 6 课：A2A 选修实验](./lesson-33-a2a-experiment.md)

### 你将完成什么

定义一个可版本化 Skill。Skill 不是一句 Prompt，而是一种有输入、步骤、工具、权限和质量标准的工作方法。

创建 `skills/code-review.yaml`：

```yaml
name: code-review
version: 1.0.0
description: 对代码仓库进行架构、测试和安全三视角审查。
inputs:
  - repository_path
  - review_goal
steps:
  - role: Architecture
    tools: [list_files, search_code, read_file]
    scopes: [repo:read]
  - role: Test
    tools: [list_files, search_code, read_file, run_test]
    scopes: [repo:read, test:run]
  - role: Security
    tools: [search_code, read_file]
    scopes: [repo:read]
output:
  format: findings-with-evidence
quality:
  - 每个发现必须有文件和行号证据
  - 不允许修改仓库
  - 高风险结论必须被 Reviewer 或人工复核
```

初版可以用 PyYAML 读取它，转换为 `Subtask`。Skill Registry 在第七章迁移到数据库并记录负责人、版本和下线状态。

### 本课验收

- Skill 声明了工具、Scope 和质量标准；
- 读取 Skill 可生成 Subtask；
- 修改 Skill 版本后可以回滚；
- Skill 不允许绕过 Tool Runtime。

---
