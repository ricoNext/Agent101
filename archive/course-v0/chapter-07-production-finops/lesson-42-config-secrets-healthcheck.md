# 第 2 课：配置、密钥和健康检查

> 所属章节：[第 7 章：生产工程、可观测性与 FinOps](./index.md)  
> 上一课：[第 1 课：把本地依赖写成 Docker Compose](./lesson-41-docker-compose-deps.md)  
> 下一课：[第 3 课：结构化日志、Trace 和 Replay](./lesson-43-structured-logs-trace-replay.md)

### 你将完成什么

将环境配置、密钥和健康状态分开管理。

规则：

- `.env` 只用于本地，不能提交；
- 生产密钥来自部署平台的 Secret Manager；
- `/health/live` 只证明进程存活；
- `/health/ready` 应检查数据库和 Redis 是否可用；
- 日志中永远不输出 API Key、完整身份信息和完整 Prompt。

创建两类接口：

```text
GET /health/live   -> 进程是否活着
GET /health/ready  -> 关键依赖是否可用
```

故意停止 Redis。预期：`live` 仍可返回成功，`ready` 失败，部署系统不会把未就绪实例放进流量。

---
