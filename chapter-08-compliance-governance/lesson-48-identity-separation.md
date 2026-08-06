# 第 2 课：分开用户、Agent 和工具身份

> 所属章节：[第 8 章：身份、审批、审计与治理](./index.md)  
> 上一课：[第 1 课：从风险矩阵开始，而不是从法规名词开始](./lesson-47-risk-matrix.md)  
> 下一课：[第 3 课：实现持久化审批单](./lesson-49-persistent-approval.md)

### 你将完成什么

把第二章临时使用的 `x-scopes` 头替换为服务端身份上下文。

调用链必须可解释：

```text
用户 Alice (tenant-a)
  -> Supervisor Agent (只能委托只读任务)
    -> Security Specialist (repo:read)
      -> read_file Tool (resource: project-a)
```

实现原则：

- 身份认证回答“你是谁”；
- 授权回答“你能做什么”；
- 委托只能缩小权限，不能扩大权限；
- 每个数据库、缓存、向量检索和文件查询都带 `tenant_id`；
- 前端隐藏按钮不构成授权。

创建一个 `RequestIdentity`：

```python
from pydantic import BaseModel


class RequestIdentity(BaseModel):
    user_id: str
    tenant_id: str
    scopes: set[str]
    session_id: str
```

在 FastAPI dependency 中从经过验证的会话或 JWT 构造它。教学环境可先使用固定测试用户，但 Runtime 只接受 dependency 构造的 `RequestIdentity`，不再从请求 Header 自行解析 Scope。

---
