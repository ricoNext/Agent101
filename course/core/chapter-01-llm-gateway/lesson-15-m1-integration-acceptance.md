# 第 15 课：完成 M1 联调验收与复盘

> 所属章节：[第一章：LLM API、Prompt、Structured Output 与 Gateway](./index.md)  
> 上一课：[第 14 课：实现基线 Runner 与评测报告](./lesson-14-baseline-runner-report.md)  
> 下一章：[第二章：Function Calling、Tool Runtime 与 MCP](../chapter-02-tool-runtime-mcp/)  
> [参考代码基线](https://github.com/ricoNext/agent-platform/tree/chapter-07)

## 一、你将完成什么

本课不再增加新的 Gateway 架构能力，而是使用前两课的任务集、Runner 和基线报告完成 M1 联调验收。你会检查后端接口、前端交互、失败路径、运行证据和工程边界，最后形成明确的“通过、带条件通过或不通过”结论。

M1 验收不是“页面能打开”或“模型回复过一次”，而是证明这条调用链可替换、可验证、可追踪并且可取消。

## 二、准备验收环境

后端先执行测试，再启动服务：

```bash
cd agent-platform/apps/api
source .venv/bin/activate
pytest -q
uvicorn app.main:app --reload --port 8000
```

前端单独启动：

```bash
cd agent-platform/apps/web
npm run dev
```

准备两套明确隔离的配置：

| 环境 | Provider | 用途 | 允许故障场景 |
| --- | --- | --- | --- |
| Mock 基线 | `ScenarioProvider(MockProvider())` | 协议、失败恢复和取消 | 是 |
| 真实模型基线 | OpenAI-compatible Provider | 延迟、Token、成本和真实输出 | 否 |

不要通过修改业务代码切换环境，也不要把 Mock 结果混入真实模型报告。

## 三、检查后端接口矩阵

逐项验证接口，不只检查成功路径：

| 接口或能力 | 成功路径 | 失败或边界路径 |
| --- | --- | --- |
| `GET /health` | 返回当前 Provider 和服务状态 | 配置错误时拒绝启动 |
| `POST /v1/chat` | 返回文本、usage、耗时和 `run_id` | 空消息返回 `422` |
| `POST /v1/summaries` | 返回经过 Schema 校验的摘要 | 纠错耗尽返回稳定错误 |
| `POST /v1/chat/stream` | 事件有序并正常结束 | Provider 异常以 `run.failed` 终止 |
| 逻辑模型路由 | `dev`、`fast`、`balanced` 按配置选路 | 未开放路由返回 `400` |
| 租户限流 | Gateway 返回自己的限流错误 | 不与 Provider 429 混淆 |
| 用户取消 | 上游连接和生成器释放 | 不留下后台运行任务 |

每次失败都要能够从响应中的 `run_id` 回查模型调用记录。Provider 原始错误不得直接暴露给浏览器。

## 四、检查前端交互矩阵

在 Gateway 控制台完成四组操作：

| 场景 | 页面应显示 | 系统应发生 |
| --- | --- | --- |
| 正常流式回复 | 运行状态、增量文本、`run_id`、耗时 | 收到 `run.completed` |
| 用户停止 | 明确显示“已取消” | `AbortController` 关闭请求并传播取消 |
| 后端离线 | 可理解的连接错误 | 页面不永久停留在生成中 |
| 异常断流 | 明确显示缺少终态或执行失败 | 不把不完整结果标记为成功 |

切换逻辑模型路由后，页面只提交路由别名，不应该知道底层厂商模型名称。浏览器环境变量中不得出现模型 API Key。

## 五、核对工程产物

第一章结束时，项目至少包含：

```text
agent-platform/
├── apps/
│   ├── api/
│   │   ├── app/
│   │   │   ├── config.py
│   │   │   ├── events.py
│   │   │   ├── main.py
│   │   │   ├── observability.py
│   │   │   ├── prompts.py
│   │   │   ├── schemas.py
│   │   │   ├── services.py
│   │   │   ├── structured.py
│   │   │   └── providers/
│   │   │       ├── base.py
│   │   │       ├── factory.py
│   │   │       ├── mock.py
│   │   │       ├── openai_compatible.py
│   │   │       ├── router.py
│   │   │       └── scenario.py
│   │   └── tests/
│   │       ├── test_chat_service.py
│   │       ├── test_health.py
│   │       └── test_structured.py
│   └── web/
│       └── src/app/page.tsx
├── packages/evals/
│   ├── chapter_01_golden_tasks.json
│   ├── run_chapter_01.py
│   └── report_chapter_01.py
├── artifacts/
│   ├── chapter-01-runs-mock.jsonl
│   ├── chapter-01-runs-real-model.jsonl
│   └── model-calls.jsonl
└── docs/
    └── chapter-01-baseline.md
```

`artifacts/` 中如果含敏感输入，应只保留脱敏版本，或者将原始数据放入受控存储而不是提交 Git。

## 六、阅读并解释基线报告

报告中的数字必须回答工程问题：

1. 默认逻辑路由为什么选择当前模型？
2. 哪类任务最容易产生 Structured Output 失败？
3. 有限纠错和重试提高了多少成功率，增加了多少延迟与成本？
4. 普通调用和 Streaming 的 P95 是否满足当前目标？
5. 用户取消后是否仍存在调用记录或后台任务？
6. 哪些已知限制可以带到第二章，哪些必须在进入第二章前修复？

每个失败结论至少回指一条任务 ID、`run_id`、错误码、模型路由、Prompt 版本和处理结论。缺少事实证据时，应写“当前无法判断”，不能用主观印象补齐。

## 七、执行 M1 最终验收

### 协议与抽象

- Mock 与真实 Provider 通过配置切换，不修改业务路由。
- 上层调用方不感知厂商请求格式和底层模型名称。
- Prompt 有稳定 ID、版本和变量校验。
- Structured Output 声明业务 Schema 版本。

### 可靠性与安全

- 限流、超时、鉴权和格式错误使用稳定错误协议。
- 只有可恢复的瞬时错误会有限重试。
- fallback 不会把 Mock 结果伪装成生产回答。
- API Key、`.env` 和 Provider 原始错误没有进入 Git 或浏览器。

### Streaming 与交互

- 每条事件具有相同 `run_id` 和递增 `sequence`。
- 正常、失败流都有明确终态。
- 用户取消能够释放服务端生成器和 Provider 连接。
- 前端能处理成功、停止、后端离线和异常断流。

### 可观测与评测

- 调用记录包含模型、Prompt、Schema、Token、Cost、Latency、重试和错误分类。
- Token usage 缺失时明确为 `null`，不使用字符数冒充。
- Golden Tasks 覆盖普通、结构化、失败、Streaming 和取消路径。
- Runner 能重复执行任务并保留带 `run_id` 的 JSONL 结果。
- 报告能比较 Mock 与真实模型，并保留实验条件与价格快照。

## 八、给出验收结论

使用统一模板写入 `docs/chapter-01-acceptance.md`：

```text
M1 验收结论：通过 / 带条件通过 / 不通过

已满足：
- 逐项列出通过的验收条件和证据位置。

未满足：
- 列出失败条件、关联 task_id / run_id 和影响。

遗留风险：
- 记录不阻塞第二章但必须持续跟踪的问题。

后续动作：
- 写明负责人、修复条件和重新验收方式。
```

出现以下任一情况时不得判定“通过”：

- 真实 Provider 只能通过修改代码切换。
- Structured Output 校验失败后仍返回未经验证的数据。
- Streaming 没有明确终态或取消后继续运行。
- 无法通过 `run_id` 关联接口结果和调用记录。
- 基线报告缺少实验条件，或 Mock 与真实模型数据混杂。
- 密钥或敏感 Provider 错误进入浏览器、日志样本或 Git。

## 九、完成章节复盘

把以下问题写入 `docs/chapter-01-retrospective.md`：

1. Mock Provider 解决了什么问题，又不能证明什么？
2. 为什么 Provider 原始 SSE 要转换成 Gateway 自己的事件协议？
3. 合法 JSON 缺少业务字段时，系统为什么仍应判定失败？
4. `run_id` 在后续 Agent 系统中还会关联哪些对象？
5. 单元测试与 Golden Task 分别防止哪类回归？
6. 为什么调用方应使用逻辑模型路由而不是具体模型名称？
7. 哪些错误可以重试，哪些错误必须立即失败？
8. 如何证明用户取消后没有遗留模型调用？

下一章不要删除 Gateway、事件协议、调用记录和 Golden Tasks。Tool Runtime 会直接复用这些能力，让模型开始调用受控工具。
