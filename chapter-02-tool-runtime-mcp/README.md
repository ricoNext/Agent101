# 第 2 章：构建 Tool Runtime 与 MCP 接入

## 本章完成后的效果

完成本章后，第一章的 Gateway 会增加一套工具运行时：

- 后端可注册、查询、启用和禁用工具；
- 工具输入先经过 Schema 校验；
- 系统根据用户 Scope、工具风险等级和审批状态决定是否执行；
- 每次调用都有审计记录和 Trace ID；
- 前端能浏览工具、查看权限、调用只读工具并审批写操作；
- 你能用一个最小 MCP Server 把外部工具接入 Runtime。

本章不让模型自动改文件。模型工具选择会在第三章的 Agent Loop 中接入；这里先把“工具能否被安全执行”做好。

---

## 课程目录

1. [第 1 课：理解工具调用的边界](./lesson-08-tool-call-boundaries.md)
2. [第 2 课：定义工具、调用和审计协议](./lesson-09-tool-call-audit-protocol.md)
3. [第 3 课：实现 Tool Registry](./lesson-10-tool-registry.md)
4. [第 4 课：实现权限、审批、超时和审计](./lesson-11-permission-approval-timeout-audit.md)
5. [第 5 课：测试 Tool Runtime](./lesson-12-test-tool-runtime.md)
6. [第 6 课：创建工具管理和审批页面](./lesson-13-tool-management-approval-page.md)
7. [第 7 课：最小 MCP Server 选修实验](./lesson-14-mcp-server-experiment.md)
