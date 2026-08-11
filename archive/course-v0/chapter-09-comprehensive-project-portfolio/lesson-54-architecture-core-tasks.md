# 第 2 课：冻结架构和核心任务

> 所属章节：[第 9 章：完成一个可展示的全栈 Agent 产品](./index.md)  
> 上一课：[第 1 课：写一页产品需求](./lesson-53-product-requirements.md)  
> 下一课：[第 3 课：完成全栈用户流程](./lesson-55-fullstack-user-flow.md)

画出架构图和状态图，选择 5 个核心用户任务。每个任务都要有：输入、工具、权限、预期输出、失败策略和 Golden Task ID。

产品最小架构：

```text
Next.js 工作台
  -> FastAPI Gateway
    -> Identity / Tenant
    -> Agent Run + State + Approval
    -> Context / RAG / Memory
    -> Tool Runtime / MCP
    -> Eval / Trace / Audit
    -> PostgreSQL / Redis / Vector Store
```

不要在最后两周更换主框架。已有模块比新框架更重要。

---
