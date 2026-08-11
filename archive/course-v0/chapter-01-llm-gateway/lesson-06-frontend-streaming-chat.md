# 第 6 课：创建前端流式对话页

> 所属章节：[第 1 章：从零构建 LLM Gateway](./index.md)  
> 上一课：[第 5 课：实现 SSE 流式接口](./lesson-05-sse-streaming-api.md)  
> 下一课：[第 7 课：为第一章补齐测试和 Golden Tasks](./lesson-07-tests-and-golden-tasks.md)
> [课程代码](https://github.com/ricoNext/agent-platform/tree/chapter-06)

## 一、你将完成什么

创建 Next.js 页面，调用刚刚完成的 SSE 接口，逐步渲染模型输出，并提供停止按钮。

## 二、第一步：创建前端项目

回到 `agent-platform` 根目录：

```bash
cd ../..
npx create-next-app@latest apps/web --ts --eslint --app --src-dir --use-npm
cd apps/web
npm run dev
```

浏览器打开 `http://localhost:3000`，确认 Next.js 默认页面出现后再继续。

`create-next-app@latest` 会随时间更新。课程分支中的 `package.json` 和锁文件才是本课验证过的依赖基线；如果生成结果与讲义不同，以 `chapter-06` 分支为准。

## 三、第二步：配置 API 地址

创建 `apps/web/.env.local`：

```text
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
```

这不是密钥，允许暴露给浏览器。任何 `NEXT_PUBLIC_` 变量都会被打进前端代码，所以绝对不要把模型 API Key 放在这里。

## 四、第三步：替换主页

把 `apps/web/src/app/page.tsx` 替换为：

```tsx
"use client";

import { useRef, useState } from "react";
import type { FormEvent } from "react";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type AgentEvent = {
  event: "run.started" | "message.delta" | "run.completed" | "run.failed";
  run_id: string;
  sequence: number;
  data: {
    text?: string;
    code?: string;
    message?: string;
    latency_ms?: number;
    output_characters?: number;
  };
};

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

export default function Home() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState("空闲");
  const [error, setError] = useState("");
  const controllerRef = useRef<AbortController | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = input.trim();
    if (!content || controllerRef.current) return;

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content }];
    setMessages([...nextMessages, { role: "assistant", content: "" }]);
    setInput("");
    setError("");
    setStatus("正在连接模型");

    const controller = new AbortController();
    controllerRef.current = controller;

    try {
      const response = await fetch(`${apiBaseUrl}/v1/chat/stream`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(`请求失败：${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let terminalEventReceived = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split(/\r?\n\r?\n/);
        buffer = events.pop() ?? "";

        for (const rawEvent of events) {
          const line = rawEvent
            .split(/\r?\n/)
            .find((item) => item.startsWith("data: "));
          if (!line) continue;
          const agentEvent = JSON.parse(line.slice(6)) as AgentEvent;

          if (agentEvent.event === "run.started") {
            setStatus("模型正在生成");
          }
          if (agentEvent.event === "message.delta") {
            setMessages((current) => {
              const copy = [...current];
              const last = copy.length - 1;
              copy[last] = {
                role: "assistant",
                content: copy[last].content + (agentEvent.data.text ?? ""),
              };
              return copy;
            });
          }
          if (agentEvent.event === "run.completed") {
            terminalEventReceived = true;
            setStatus("已完成");
          }
          if (agentEvent.event === "run.failed") {
            terminalEventReceived = true;
            setStatus("执行失败");
            setError(agentEvent.data.message ?? "模型调用失败");
          }
        }
      }

      if (!terminalEventReceived && !controller.signal.aborted) {
        throw new Error("连接已结束，但没有收到完成或失败事件");
      }
    } catch (caughtError) {
      if ((caughtError as Error).name === "AbortError") {
        setStatus("已取消");
      } else {
        setStatus("执行失败");
        setError((caughtError as Error).message);
      }
    } finally {
      controllerRef.current = null;
    }
  }

  function cancel() {
    controllerRef.current?.abort();
  }

  return (
    <main style={{ maxWidth: 720, margin: "40px auto", fontFamily: "sans-serif" }}>
      <h1>Agent Platform</h1>
      <p>状态：{status}</p>
      {error && <p role="alert" style={{ color: "crimson" }}>{error}</p>}

      <section aria-label="对话记录">
        {messages.map((message, index) => (
          <article key={index} style={{ margin: "16px 0" }}>
            <strong>{message.role === "user" ? "你" : "Agent"}</strong>
            <p>{message.content || "正在生成..."}</p>
          </article>
        ))}
      </section>

      <form onSubmit={onSubmit}>
        <label htmlFor="message">输入消息</label>
        <textarea
          id="message"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          rows={4}
          style={{ display: "block", width: "100%", margin: "8px 0" }}
        />
        <button type="submit" disabled={Boolean(controllerRef.current)}>发送</button>
        <button type="button" onClick={cancel} disabled={!controllerRef.current}>
          停止
        </button>
      </form>
    </main>
  );
}
```

## 五、第四步：配置跨域来源

先在 `app/config.py` 的 `Settings` 中增加：

```python
cors_origins: list[str] = ["http://localhost:3000"]
```

如需通过 `.env` 覆盖，使用 JSON 数组：

```text
CORS_ORIGINS=["http://localhost:3000"]
```

然后在后端 `app/main.py` 加入：

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

浏览器的来源是 `scheme + host + port`，`localhost:3000` 和 `127.0.0.1:3000` 属于不同来源。开发时按实际前端地址配置；生产环境必须使用明确域名，不能使用任意来源。

## 六、第五步：手工验收前端

1. 后端运行在 8000；
2. 前端运行在 3000；
3. 输入“你好”；
4. 看到 Agent 内容逐字出现；
5. 生成中点击“停止”；
6. 故意关闭后端，再发送消息，确认页面显示错误；
7. 恢复后端，确认可以再次发送。

还要验证一次异常结束：临时让后端在发送 `run.started` 后直接结束生成器。页面应显示“没有收到完成或失败事件”，不能永远停在“模型正在生成”。

## 七、前端常见盲点

- `EventSource` 只能发 GET，当前接口是 POST，因此这里使用 `fetch + ReadableStream`；
- 不要把每个字符都写入数据库；先在前端聚合，后面再学习服务端持久化；
- “停止”只取消浏览器请求，后端是否真的停止 Provider 要在后续章节加取消传播；
- 不能根据加载动画猜测任务状态，必须处理后端事件。

## 八、本课验收

- 页面能解析真实的 SSE 换行边界
- 文本增量能持续追加到同一条 Assistant 消息
- `run.completed`、`run.failed` 和异常断流都有明确状态
- 停止按钮会中断当前浏览器请求
- API Key 没有进入任何 `NEXT_PUBLIC_` 环境变量
- CORS 来源由后端配置读取

## 九、小结

这一课把 Gateway 的事件协议接到了浏览器：前端不关心具体模型厂商，只处理开始、增量、完成和失败四类稳定事件。下一课会把普通聊天、结构化摘要和流式事件纳入同一套回归资产。

---
