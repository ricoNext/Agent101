# 第 6 课：创建工具管理和审批页面

> 所属章节：[第 2 章：构建 Tool Runtime 与 MCP 接入](./index.md)  
> 上一课：[第 5 课：测试 Tool Runtime](./lesson-12-test-tool-runtime.md)  
> 下一课：[第 7 课：最小 MCP Server 选修实验](./lesson-14-mcp-server-experiment.md)

### 你将完成什么

在 Next.js 中新增 `/tools` 页面。它不是后台装饰，而是让用户看见工具、风险和审批状态的控制面。

创建 `apps/web/src/app/tools/page.tsx`：

```tsx
"use client";

import { useEffect, useState } from "react";

type Tool = {
  name: string;
  description: string;
  risk_level: "read" | "write" | "high";
  required_scopes: string[];
  status: "enabled" | "disabled";
};

type ToolResult = {
  ok: boolean;
  tool_name: string;
  data?: Record<string, unknown>;
  error?: { code: string; message: string };
  latency_ms: number;
};

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

export default function ToolsPage() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [result, setResult] = useState<ToolResult | null>(null);
  const [approved, setApproved] = useState(false);

  useEffect(() => {
    fetch(`${apiBaseUrl}/v1/tools`)
      .then((response) => response.json())
      .then((body) => setTools(body));
  }, []);

  async function invoke(tool: Tool) {
    const argumentsByTool: Record<string, Record<string, unknown>> = {
      get_weather: { city: "上海" },
      read_course_file: { path: "readme.txt" },
      write_note: { path: "notes/from-ui.md", content: "由工具管理页面创建" },
    };

    const response = await fetch(`${apiBaseUrl}/v1/tools/invoke`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-scopes": "workspace:read,notes:write",
        "x-approved": String(approved),
      },
      body: JSON.stringify({
        tool_name: tool.name,
        run_id: crypto.randomUUID(),
        arguments: argumentsByTool[tool.name] ?? {},
      }),
    });
    setResult(await response.json());
  }

  return (
    <main style={{ maxWidth: 900, margin: "40px auto", fontFamily: "sans-serif" }}>
      <h1>工具管理</h1>
      <label>
        <input
          type="checkbox"
          checked={approved}
          onChange={(event) => setApproved(event.target.checked)}
        />
        我确认允许本次写操作（仅教学演示）
      </label>

      {tools.map((tool) => (
        <article key={tool.name} style={{ border: "1px solid #ddd", padding: 16, margin: "16px 0" }}>
          <h2>{tool.name}</h2>
          <p>{tool.description}</p>
          <p>风险：{tool.risk_level}</p>
          <p>需要权限：{tool.required_scopes.join(", ") || "无"}</p>
          <button disabled={tool.status !== "enabled"} onClick={() => invoke(tool)}>
            调用测试
          </button>
        </article>
      ))}

      {result && (
        <section aria-live="polite">
          <h2>{result.ok ? "调用成功" : "调用被拒绝或失败"}</h2>
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </section>
      )}
    </main>
  );
}
```

打开 `http://localhost:3000/tools`：

1. 调用天气工具，预期成功；
2. 调用写工具但不勾选审批，预期看到 `approval_required`；
3. 勾选审批后再次调用，预期成功；
4. 查看后端审计接口，确认拒绝和成功都记录了。

这里把 Scope 和审批状态暴露为前端 header 仅用于教学。第八章会改成登录身份、服务端审批单和不可伪造的授权判断。

---
