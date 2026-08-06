# 第 1 章：从零构建 LLM Gateway

## 本章完成后的效果

完成本章后，你将拥有一个可运行的前后端项目：

- FastAPI 提供健康检查、普通对话、结构化摘要和流式对话接口；
- 默认使用 Mock Provider，不需要 API Key 也能完成全部基础练习；
- 可通过环境变量切换到 OpenAI-compatible 模型服务；
- Next.js 页面可发送消息、逐字显示流式内容、取消请求并展示错误；
- 后端有最小测试；
- 每次调用都有 `run_id`、延迟和 Token 用量记录。

本章不做 Agent Loop，也不做工具调用。先把“稳定调用模型”这个基础问题做正确。

---

## 课程目录

1. [第 1 课：建立一个可测试的后端](./lesson-01-build-testable-backend.md)
2. [第 2 课：先接 Mock Provider，再接真实模型](./lesson-02-mock-provider-real-model.md)
3. [第 3 课：接入 OpenAI-compatible 模型服务](./lesson-03-openai-compatible-provider.md)
4. [第 4 课：结构化输出和错误边界](./lesson-04-structured-output-error-boundary.md)
5. [第 5 课：实现 SSE 流式接口](./lesson-05-sse-streaming-api.md)
6. [第 6 课：创建前端流式对话页](./lesson-06-frontend-streaming-chat.md)
7. [第 7 课：为第一章补齐测试和 Golden Tasks](./lesson-07-tests-and-golden-tasks.md)
