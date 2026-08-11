# 第 5 课：版本、灰度和回滚

> 所属章节：[第 7 章：生产工程、可观测性与 FinOps](./index.md)  
> 上一课：[第 4 课：建立 Token 预算和 FinOps 报表](./lesson-44-token-budget-finops-report.md)  
> 下一课：[第 6 课：运维治理台和本章验收](./lesson-46-ops-governance-acceptance.md)

### 你将完成什么

让 Prompt、模型、工具、RAG、Skill 和前端协议都有版本，不再只给 Docker 镜像打标签。

发布前执行：

1. 记录候选版本；
2. 在同一 Golden Dataset 上与基线比较；
3. 将候选版本只分给一个测试租户或任务类型；
4. 观察成功率、P95、成本和安全拦截；
5. 达不到门槛则回滚到已知基线。

模拟演练：将 Prompt 从 `v1` 改为 `v2`，故意使一个引用任务退化。Eval Pipeline 应阻止全量发布，并在运维页显示回滚原因。

---
