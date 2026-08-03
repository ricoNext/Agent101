# 第 4 课：结果聚合、冲突和 Reviewer

> 所属章节：[第 5 章：Multi-Agent、Skill 与 A2A](./README.md)  
> 上一课：[第 3 课：实现并行 Supervisor](./第03课-实现并行 Supervisor.md)  
> 下一课：[第 5 课：把重复任务封装为 Skill](./第05课-把重复任务封装为 Skill.md)

### 你将完成什么

把多个 `SubtaskResult` 合并成可读报告。先使用确定性规则，不让 LLM 自己裁决一切。

创建 `app/multi_agent/aggregation.py`：

```python
from app.multi_agent.schemas import Finding, SubtaskResult


def aggregate(results: list[SubtaskResult]) -> dict:
    completed = [result for result in results if result.status == "completed"]
    failed = [result for result in results if result.status != "completed"]
    findings: list[Finding] = []
    seen_titles: set[str] = set()

    for result in completed:
        for finding in result.findings:
            dedupe_key = finding.title.strip().lower()
            if dedupe_key not in seen_titles:
                findings.append(finding)
                seen_titles.add(dedupe_key)

    priority = {"high": 0, "medium": 1, "low": 2}
    findings.sort(key=lambda finding: priority[finding.severity])
    return {
        "findings": [finding.model_dump() for finding in findings],
        "failed_subtasks": [result.model_dump() for result in failed],
    }
```

冲突处理顺序：

1. 检查两个结论是否引用同一证据；
2. 检查谁的证据更具体、更新或权限更高；
3. 用规则无法决定时，标记冲突并请求 Reviewer 或人工确认；
4. 不允许主 Agent 静默丢弃少数意见。

Reviewer 的输入应是“任务目标、两个结论、证据和 Rubric”，不是“请判断谁对”。第六章会为 Reviewer 增加评测。

### 本课验收

- 聚合结果保留来源和失败子任务；
- 重复发现会去重；
- 高风险发现优先显示；
- 证据冲突会被显式标记。

---
