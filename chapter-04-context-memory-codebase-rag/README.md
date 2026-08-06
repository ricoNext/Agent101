# 第 4 章：Context、Memory 与 Codebase RAG

## 本章完成后的效果

完成本章后，Codebase Agent 不再把整个仓库和全部聊天历史塞给模型，而是会：

- 为每次模型调用计算 Context Budget；
- 将文件解析成带路径、行号和版本的 Chunk；
- 先做可解释的关键词检索，再接入向量检索和 Hybrid Search；
- 把检索结果作为带来源的证据放入上下文；
- 保存项目记忆，例如技术栈、测试命令和目录约定；
- 在前端展示检索结果、引用和被选入上下文的内容。

本章的目标不是搭一个“上传文档即可问答”的 Demo，而是让 Agent 在有限上下文内找到能支持结论的代码证据。

---

## 课程目录

1. [第 1 课：先量化 Context，而不是盲目压缩](./lesson-22-context-quantification.md)
2. [第 2 课：把代码和文档解析成可引用的 Chunk](./lesson-23-code-doc-chunk.md)
3. [第 3 课：先实现可解释的关键词检索](./lesson-24-explainable-keyword-search.md)
4. [第 4 课：接入 Embedding、Hybrid Search 和 Rerank](./lesson-25-embedding-hybrid-search-rerank.md)
5. [第 5 课：项目记忆与 Context Builder 集成](./lesson-26-project-memory-context-builder.md)
6. [第 6 课：创建代码知识页面和 RAG 对照实验](./lesson-27-code-knowledge-rag-experiment.md)
