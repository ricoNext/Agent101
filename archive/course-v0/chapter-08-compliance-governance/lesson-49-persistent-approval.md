# 第 3 课：实现持久化审批单

> 所属章节：[第 8 章：身份、审批、审计与治理](./index.md)  
> 上一课：[第 2 课：分开用户、Agent 和工具身份](./lesson-48-identity-separation.md)  
> 下一课：[第 4 课：数据脱敏、隔离和审计](./lesson-50-data-masking-isolation-audit.md)

### 你将完成什么

把第三章的 `approved=True` 教学简化替换为审批实体。

审批单至少包含：

```python
class ApprovalRequest(BaseModel):
    approval_id: str
    run_id: str
    requested_by: str
    tool_name: str
    arguments_summary: dict
    risk_level: str
    status: Literal["pending", "approved", "rejected", "expired"]
    expires_at: datetime
    decided_by: str | None = None
    decision_reason: str | None = None
```

执行写工具前，Runtime 查询 `approval_id` 是否存在、是否属于同一个 Run、是否未过期、是否由有权限的人批准。浏览器只能提交“批准/拒绝请求”，不能直接把 `approved=true` 传给工具。

故意尝试复用另一个 Run 的 `approval_id`，预期被拒绝。

---
