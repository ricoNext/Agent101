# 项目中的 Python 知识

主线课程的参考实现以 Python 编写。本文档按主题整理讲义中已经出现的
Python 语言、标准库与常用库知识点，方便在读代码时按需查阅。

这些内容不占用核心课时编号。主线讲义负责「为什么这样设计」；本页负责
「实现时用到了哪些 Python 能力」。

覆盖范围以第一至第三章讲义为主（第四章及以后目前几乎没有新增语言级教学
段落）。条目默认来自课程中的解释或示例代码；对入门门槛较高的概念
（如虚拟环境），本页会补一段「是什么 / 为什么」的细讲，并回链对应课次。

## 建议阅读顺序

若你刚开始跟第一章，建议按下面顺序补齐：

1. **环境与工程骨架** → **类型系统与数据建模**
2. **异步编程与并发**（尤其取消与超时）
3. **Web / HTTP**（FastAPI、httpx、SSE）
4. **错误处理、测试**；进入第三章后再看 **持久化** 与
   **进程 / 文件 / 路径**

---

## 一、环境与工程骨架

### 1.1 虚拟环境是什么、为什么需要

所谓**虚拟环境（venv）**，字面上讲就是一个目录；更准确的说法是：
一套**只属于当前项目的 Python 解释器与包安装空间**。你在里面用
`pip install` 装的包，只对这个环境可见，不会改系统全局 Python，
也不会和另一个项目抢同一套依赖。

为什么要多这一步？因为 Python 默认会把包装进「当前解释器能看见的
那一套 site-packages」。如果两个项目都往系统 Python 里装，很快就会撞车：

- **版本冲突**：项目 A 要 `pydantic==2.x`，项目 B 还停在旧写法；
  全局只能留一个版本，另一个项目会莫名其妙挂掉。
- **污染系统**：系统工具、IDE、其他脚本也可能依赖同一解释器；
  随便升级或卸载包，可能把本来能用的命令弄坏。
- **无法复现**：队友机器、CI、你三个月后的电脑，如果都「随手往全局装」，
  谁也说不清当时到底装了哪些版本。课程用 `requirements.txt` 锁版本，
  前提就是装进**可丢弃、可重建**的隔离环境，而不是系统目录。

对本课程来说，虚拟环境还有一层很实际的含义：第一章第 2 课起的
FastAPI、httpx、pytest 等依赖，都应装在项目自己的 `.venv` 里。
这样你删掉 `.venv` 再按 `requirements.txt` 重建，就能回到同一套基线；
换电脑时也一样。`.venv` 本身不要提交进 Git（见下文 `.gitignore`）。

创建与激活（与主线一致）：

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
```

拆解一下：

1. **`python3 -m venv .venv`**  
   用当前的 Python 3，以模块方式跑内置 `venv`，在当前目录生成
   `.venv`（前缀 `.` 表示隐藏目录）。
2. **`source .venv/bin/activate`**  
   激活后，提示符前通常会出现 `(.venv)`；此后本终端里的
   `python` / `pip` 都指向这套环境。退出用 `deactivate`。
3. **Windows**  
   PowerShell：`.venv\Scripts\Activate.ps1`；  
   CMD：`.venv\Scripts\activate.bat`。  
   若 PowerShell 因执行策略拒绝脚本，优先用 WSL2，或仅对当前进程
   临时放宽：`Set-ExecutionPolicy -Scope Process Bypass`。

激活只影响**当前终端会话**。新开一个终端后，需要重新 `source`（或
等价命令），否则又会装回系统环境——这是新手最容易踩的坑。

课次：第一章第 2 课（创建与讲解）；第一章第 5 课（忽略 `.venv`）

### 1.2 同组其他知识点

- **`pip` 与 `requirements.txt`**  
  批量安装；`==` 锁版本；`uvicorn[standard]` 可选依赖组。  
  课次：第一章第 2 课；第二章第 2 课（如 `jsonschema`）

- **`__init__.py`**  
  显式标记传统 package；说明 namespace package 与课程选择。  
  课次：第一章第 2、4 课

- **`.gitignore`**  
  忽略 `.venv`、`__pycache__`、`.pytest_cache`、`.env`。  
  课次：第一章第 5 课

- **装饰器**  
  `@app.get` 把函数注册为路由。  
  课次：第一章第 2 课

- **工厂函数**  
  `create_provider(settings)` 按配置选择 Mock / 真实 Provider。  
  课次：第一章第 5 课

- **构造注入**  
  `ChatService(provider=...)`、Runtime / Harness 注入端口，避免业务层
  直接 new 客户端。  
  课次：第一章第 4、5 课；第二章第 1、4 课；第三章第 12 课

---

## 二、类型系统与数据建模

- **现代类型注解**  
  `list[T]` / `dict[K, V]` / `T | None`（Python 3.10+）。  
  课次：第一章第 2、4 课起贯穿

- **`Literal[...]`**  
  约束 `role`、配置枚举值、观测 status、图路由字面量等。  
  课次：第一章第 4、5、10 课；第二章第 1、2 课；第三章第 15 课

- **`typing.Any` / `dict[str, Any]`**  
  Provider 载荷、工具 schema、事件 payload、JSON 列。  
  课次：各章多处

- **`typing.Protocol`**  
  `ModelProvider` / `ToolHandler` / `FileGateway` / `ModelPort` 等
  结构化接口；不要求继承。  
  课次：第一章第 4 课；第二章第 1、4、6 课；第三章第 9、12、14、15 课

- **Protocol 中的 `...`（Ellipsis）**  
  接口占位、无实现体。  
  课次：第一章第 4 课

- **Protocol 里 `stream()` 用 `def` 返回 `AsyncIterator`**  
  避免类型检查器把它当成「需先 await 的协程」。  
  课次：第一章第 4 课

- **`collections.abc` 集合类型**  
  `AsyncIterator` / `Awaitable` / `Callable` / `Sequence` / `Mapping`。  
  课次：第一章第 4、9、11 课；第二、三章多处

- **`@dataclass` / `frozen=True`**  
  自动生成样板方法；不可变快照防原地改写。  
  课次：第一章起贯穿

- **`dataclasses.replace`**  
  在不可变对象上补路由元数据、更新 Registry 状态。  
  课次：第一章第 9、13 课；第二章第 3 课；第三章第 3 课

- **`dataclasses.asdict`**  
  审计事件、模型调用日志序列化。  
  课次：第一章第 9 课；第二章第 10 课

- **`dataclasses.field`**  
  字段默认值（如工具执行上下文）。  
  课次：第二章第 4 课

- **`frozenset`**  
  Prompt 必填变量、权限集合、终态集合、证据 / 预算集合。  
  课次：第一章第 6 课；第二、三章多处

- **`enum.StrEnum`**  
  任务状态、工具风险、审批状态、依赖类型、沙箱状态等。  
  课次：第二、三章大量课次

- **前向引用字符串注解**  
  如 `"ToolResult"`，避免循环导入。  
  课次：第二章第 9、14 课等

- **类型别名**  
  如 `JsonObject = dict[str, Any]`。  
  课次：第二章第 2 课

- **`TypedDict` + `Annotated` + `NotRequired`**  
  LangGraph State；`Annotated` 挂 Reducer。  
  课次：第三章第 15 课

### Pydantic

- **`BaseModel`**  
  请求 / 响应契约；校验失败在 FastAPI 中常表现为 422。  
  课次：第一章第 4 课起

- **`Field(...)`**  
  `min_length` / `max_length` / `ge` / `le` / `gt` / `pattern` /
  `default` / `default_factory`。  
  课次：第一章第 4、5、7、9 课；第二章第 1、2、13 课

- **`ConfigDict(extra="forbid")`**  
  禁止额外字段。  
  课次：第一章第 7 课；第二章第 1、2 课

- **`ConfigDict(frozen=True)`**  
  工具契约不可变。  
  课次：第二章第 2 课

- **序列化与 Schema**  
  `model_dump` / `model_validate` / `model_dump_json` /
  `model_json_schema`；以及 `model_dump(mode="json")`。  
  课次：第一章第 4、5、7 课；第二章第 1、13 课

- **`ValidationError` / `exc.errors()`**  
  结构化输出失败包装与脱敏细节。  
  课次：第一章第 7、8 课

- **`@field_validator` / `@model_validator(mode="after")`**  
  跨字段规则（如重试与幂等键）。  
  课次：第二章第 2、13 课

- **`pydantic-settings` / `BaseSettings`**  
  从 `.env` / 环境变量读配置。  
  课次：第一章第 5 课

- **`functools.lru_cache` + `get_settings()`**  
  缓存配置对象；改 `.env` 后需重启进程。  
  课次：第一章第 5 课

---

## 三、异步编程与并发

- **`async def` / `await`**  
  协程；I/O 等待时让出控制权；FastAPI 异步路由。  
  课次：第一章第 2、4 课起贯穿

- **`async for`**  
  消费 Provider / SSE / 工具流。  
  课次：第一章第 4、5、11、13、14 课

- **异步生成器（`async def` + `yield`）**  
  Mock 流式输出；服务层产出 SSE 帧。  
  课次：第一章第 4、11、13 课

- **`asyncio.sleep`**  
  Mock 流式节流；路由重试退避。  
  课次：第一章第 4、9、13 课

- **`asyncio.timeout`**  
  工具尝试截止；拿并发信号量时限时等待。  
  课次：第二章第 5、6 课

- **`TimeoutError` → 业务超时**  
  转为 `ToolTimeout` / `ToolBusy` 等稳定错误。  
  课次：第二章第 5、6 课；第三章第 10 课

- **`asyncio.CancelledError`**  
  流式取消须记录并继续抛出；勿在 `except Exception` 中吞掉。  
  课次：第一章第 11 课；第二章第 5 课；第三章第 10、15 课

- **`asyncio.Event`**  
  取消令牌：`event.is_set()` 检查点。  
  课次：第二章第 5 课

- **`asyncio.Semaphore`**  
  工具并发闸门；超时后必须释放。  
  课次：第二章第 6 课

- **`asyncio.Lock`**  
  MCP 会话等按 `server_id` 串行化。  
  课次：第二章第 11 课

- **`@asynccontextmanager`**  
  封装信号量获取 / 释放。  
  课次：第二章第 6 课

- **`async with` / `try/finally`**  
  HTTP 客户端、超时、资源清理。  
  课次：第一章第 5、11 课；第二章第 5、6 课

- **`asyncio.to_thread` 边界**  
  线程超时只能停等待，杀不掉任意同步函数；结果可能「未知」。  
  课次：第二章第 5 课

- **`asyncio.gather`**  
  并发竞态测试；也警告勿过早对真工具无界 gather。  
  课次：第二章第 1、10 课；第三章第 8 课

- **`asyncio.Barrier`**  
  并发测试同步点。  
  课次：第三章第 8 课

- **`asyncio.wait_for`**  
  等待子进程；超时后仍要 reap。  
  课次：第三章第 10 课

- **`asyncio.run(main())`**  
  基线 Runner 脚本入口。  
  课次：第一章第 14 课

- **异步生成器 `aclose()`**  
  客户端断开后关闭服务层生成器。  
  课次：第一章第 11 课

- **子进程 API**  
  `create_subprocess_exec` / `create_subprocess_shell`；
  `PIPE` / 限流读 / `communicate()`。  
  课次：第三章第 10、11 课

---

## 四、Web 与 HTTP

- **FastAPI 应用与路由**  
  `FastAPI(...)`、`@app.get` / `@app.post`、`response_model`。  
  课次：第一章第 2、4、5、7、11 课

- **uvicorn / ASGI**  
  `uvicorn app.main:app --reload --port`；ASGI 含义。  
  课次：第一章第 2、4、5 课

- **自动 `/docs`（OpenAPI）**  
  类型注解驱动接口文档。  
  课次：第一章第 2、5 课

- **`TestClient`**  
  不启真实服务器测 HTTP。  
  课次：第一章第 2、5 课

- **`httpx.AsyncClient`**  
  调 OpenAI-compatible API；Runner 调 Gateway。  
  课次：第一章第 5、14 课

- **流式客户端**  
  `client.stream` + `aiter_lines`。  
  课次：第一章第 5、14 课

- **httpx 异常族**  
  `TimeoutException` / `RequestError` / `HTTPStatusError`；
  超时是 RequestError 子类须先判断。  
  课次：第一章第 5、9 课

- **`raise_for_status()` / `.json()`**  
  Provider 响应处理。  
  课次：第一章第 5 课

- **`JSONResponse`**  
  自定义错误体与状态码（502 / 429 等）。  
  课次：第一章第 5、7、9、13 课

- **`StreamingResponse` + SSE**  
  `text/event-stream`；`Cache-Control` / `X-Accel-Buffering`。  
  课次：第一章第 11 课

- **`@app.exception_handler`**  
  `ProviderError` 等统一映射。  
  课次：第一章第 5、7、9 课

- **`@app.middleware("http")`**  
  挂 `run_id`、鉴权、限流。  
  课次：第一章第 9、13 课

- **`Request` / `request.state`**  
  挂载 run / tenant；流式读 `is_disconnected()`。  
  课次：第一章第 9、11 课

- **Pydantic 入参 → HTTP 422**  
  缺字段等契约失败。  
  课次：第一章第 4、5 课

---

## 五、错误与异常处理

- **自定义 `Exception` 子类**  
  `ProviderError`、`StructuredOutputError`、工具 / 任务领域错误；
  常带稳定 `code`。  
  课次：第一章第 4–9 课；第二、三章多处

- **`raise ... from error`**  
  保留异常链，对外仍用稳定错误码。  
  课次：第一章第 5、7、8 课；第二、三章多处

- **`super().__init__(message)`**  
  自定义异常初始化。  
  课次：第一章第 4、8、9 课

- **分层捕获**  
  JSON 解析 vs Schema；httpx vs 业务；取消 vs 失败。  
  课次：第一章第 5、7、8、11 课；第二章第 4、5 课

- **勿吞 `CancelledError`**  
  `except Exception` 的危险；清理后继续抛出。  
  课次：第二章第 5 课；第三章第 15 课

- **内置异常的业务映射**  
  `PermissionError` / `ValueError` / `KeyError` /
  `FileNotFoundError` / `ProcessLookupError` 等。  
  课次：各章代码与测试

---

## 六、时间、标识、日志与序列化

- **`uuid.uuid4()`**  
  `run_id` / `call_id` 关联 Trace。  
  课次：第一章第 4、5、7、9、11 课

- **`time.perf_counter()`**  
  测量 `latency_ms`。  
  课次：第一章第 4、7、9、11 课

- **`time.monotonic()`**  
  `Deadline` 绝对截止；避免墙上时钟回拨。  
  课次：第二章第 5 课

- **`datetime` / `UTC` / `isoformat()`**  
  SSE 时间戳、审批过期、观测记录、DB 时间列。  
  课次：第一章第 10、11 课；第二、三章多处

- **租约时钟**  
  勿用各实例本地 `datetime.now()` 竞争租约。  
  课次：第三章第 6 课

- **`logging`**  
  `getLogger` / `FileHandler` / `Formatter`；
  `logger.error(..., exc_info=...)`。  
  课次：第一章第 5、9、11、14 课

- **`json.loads` / `json.dumps(..., ensure_ascii=False)`**  
  模型输出、SSE data、JSONL。  
  课次：第一章第 5、7、8、11、13、14 课

- **`str.removeprefix("data: ")`**  
  解析 SSE 行。  
  课次：第一章第 5、13、14 课

- **`str.format_map`**  
  Prompt 模板填变量（先校验再 format）。  
  课次：第一章第 6 课

- **`hashlib.sha256`**  
  文件内容身份、状态指纹、审计链。  
  课次：第二章第 10 课；第三章第 8、9 课

- **统计与退避辅助**  
  `random` 全抖动；`math` / `statistics` / `Counter`。  
  课次：第二章第 5 课；第一章第 14 课

- **常量时间比较（实现要求）**  
  API Key 哈希比对。  
  课次：第一章第 9 课

---

## 七、持久化相关 API

- **SQLAlchemy 2.0 ORM**  
  `DeclarativeBase`、`Mapped[...]`、`mapped_column`。  
  课次：第三章第 5、6、7、9 课

- **列类型**  
  `String` / `Integer` / `Text` / `JSON` /
  `DateTime(timezone=True)` / `ForeignKey`；
  `server_default=func.now()`。  
  课次：第三章第 5–7、9 课

- **`AsyncSession`**  
  仓库构造注入；异步读写。  
  课次：第三章第 5、6 课

- **查询与更新**  
  `select` / `update` / `scalar` / `execute`。  
  课次：第三章第 5、6 课

- **事务**  
  `session.add` / `flush` / `begin()`；
  状态迁移与事件同事务提交。  
  课次：第三章第 5、6、7 课

- **乐观并发 / `version`**  
  过期 version 拒绝更新；checkpoint 落后校验。  
  课次：第三章第 5、6 课

- **领域对象不携带 Session**  
  Harness 端口边界：不把 SQLAlchemy Session 塞进领域对象 / 图 State。  
  课次：第三章第 12、15 课

---

## 八、测试

- **`pytest` 发现约定 / `pytest.ini` `pythonpath`**  
  自动发现 `test_*`；稳定导入 `app`。  
  课次：第一章第 2 课

- **`assert`**  
  内置断言即可。  
  课次：第一章第 2 课

- **`pytest.raises` / `match=`**  
  契约失败、非法迁移、路径越界。  
  课次：各章验收

- **`@pytest.mark.asyncio` / `pytest-asyncio`**  
  异步服务与流式测试。  
  课次：第一章第 2、13 课

- **`@pytest.mark.parametrize`**  
  非法路径 / 契约用例矩阵。  
  课次：第二章第 2、10 课；第三章第 9、10 课

- **Fake / Mock / Faulty Provider**  
  确定性输出；受控故障与延迟。  
  课次：第一章第 4、13 课；第三章端口 Fake

- **`tmp_path` fixture**  
  工作区 / 符号链接越界测试。  
  课次：第三章第 9 课

- **可注入 `sleeper` / 固定随机源**  
  测退避间隔而不真睡。  
  课次：第二章第 6 课

- **契约测试套**  
  同一套测内存与 PG 实现，防 Fake 语义分叉。  
  课次：第三章第 12 课

---

## 九、进程、文件与路径

- **`pathlib.Path`**  
  Runner 读写产物；沙箱路径规范化与越根拒绝。  
  课次：第一章第 14 课；第三章第 9 课

- **路径组件解析**  
  反例：字符串 `replace("..", "")` 清不干净。  
  课次：第三章第 9 课

- **符号链接逃逸测试**  
  `symlink_to`；拒绝跟随到宿主机。  
  课次：第三章第 9 课

- **原子写**  
  临时文件 + `fsync` + replace；`expected_sha256` 乐观并发。  
  课次：第三章第 9 课

- **`create_subprocess_shell` 风险**  
  任意字符串可绕过文件边界。  
  课次：第三章第 10 课

- **`create_subprocess_exec(*argv)`**  
  参数白名单 / 模板化命令。  
  课次：第三章第 10、11 课

- **进程组回收**  
  `start_new_session=True` + `os.killpg`；`signal` 发终止信号。  
  课次：第三章第 10 课

- **禁止复制整个 `os.environ`**  
  黑名单删密钥不可靠；用白名单环境。  
  课次：第三章第 10、11 课

---

## 十、其他反复出现的写法

- **`next(...)` + 生成器表达式 + `reversed`**  
  Mock 找最后一条 user 消息。  
  课次：第一章第 4、7 课

- **`hasattr(request.state, "run_id")`**  
  中间件幂等挂载。  
  课次：第一章第 9 课

- **`isinstance` 防御性解析**  
  校验上游 JSON 字段类型。  
  课次：第一章第 5 课

- **推导式与集合运算**  
  Registry、变量差集、Reducer 合并。  
  课次：第一章第 6 课；第二章第 3 课；第三章第 15 课

- **仅关键字参数 `*`**  
  Provider / 服务 API 强制命名传参。  
  课次：第一章第 4 课等

- **`range` 有限重试 / 纠错循环**  
  Structured repair、Routing attempts。  
  课次：第一章第 8、9 课；第二章第 5、6 课

- **`jsonschema.Draft202012Validator`**  
  在 Pydantic 外壳之外校验工具参数 / 输出 Schema。  
  课次：第二章第 2 课

- **LangGraph 集成 API**  
  `StateGraph` / `interrupt` / `Command` / `InMemorySaver` /
  `astream` 等；State 可序列化约束。  
  课次：第三章第 15 课

- **请求绑定身份**  
  如 `bind_request_identity`（MCP HTTP 入口的异步上下文）。  
  课次：第二章第 13 课

---

## 与主线课程的关系

| 章节 | Python 教学重心 |
| --- | --- |
| 第一章 | 环境、FastAPI、Pydantic、httpx、异步生成器、中间件、SSE、日志与 JSONL Runner |
| 第二章 | `StrEnum`、Pydantic 校验器、`jsonschema`、超时 / 取消 / 信号量、异常链与重试 |
| 第三章 | SQLAlchemy asyncio、路径安全、subprocess、端口 Protocol、LangGraph |
| 第四章及以后 | 目前几乎没有新的语言级教学段落 |

某一课若需要较长背景，正文应只保留与当前实践直接相关的片段，并链接回本页；
后续若拆成独立短文，会在侧栏挂到本菜单下。
