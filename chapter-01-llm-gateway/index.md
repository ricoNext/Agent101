# 第 1 章：从零构建 LLM Gateway

这几年，大模型 API 越来越容易拿到。很多人想自己搭一套后端，稳定地调模型。

事情一做，问题就来了。环境变量、路由、Provider、前端流式展示……环节一多，调用失败时，你往往分不清：到底是哪一层坏了？

**本章就是来解决这个基础问题的。**

简单说，目标只有一个：先把「稳定调用模型」做正确。不做 Agent Loop，也不做工具调用。

读完并跟着做完七课，你手里会有一个可运行的前后端项目。具体包括：

- FastAPI 提供健康检查、普通对话、结构化摘要和流式对话接口
- 默认使用 Mock Provider，不需要 API Key，也能完成全部基础练习
- 可通过环境变量，切换到 OpenAI-compatible 模型服务
- Next.js 页面可发送消息、逐字显示流式内容、取消请求并展示错误
- 后端有最小测试
- 每次调用都有 `run_id`、延迟和 Token 用量记录

建议按目录顺序学：先搭可测试的后端，再接 Mock，最后再换真实模型。

---

## 课程目录

1. [第 1 课：建立一个可测试的后端](./lesson-01-build-testable-backend.md)
2. [第 2 课：先接 Mock Provider，再接真实模型](./lesson-02-mock-provider-real-model.md)
3. [第 3 课：接入 OpenAI-compatible 模型服务](./lesson-03-openai-compatible-provider.md)
4. [第 4 课：结构化输出和错误边界](./lesson-04-structured-output-error-boundary.md)
5. [第 5 课：实现 SSE 流式接口](./lesson-05-sse-streaming-api.md)
6. [第 6 课：创建前端流式对话页](./lesson-06-frontend-streaming-chat.md)
7. [第 7 课：为第一章补齐测试和 Golden Tasks](./lesson-07-tests-and-golden-tasks.md)
