# 第 1 课：建立一个可测试的后端

> 所属章节：[第 1 章：从零构建 LLM Gateway](./README.md)  
> 下一课：[第 2 课：先接 Mock Provider，再接真实模型](./第02课-先接 Mock Provider，再接真实模型.md)

### 你将完成什么

创建 FastAPI 服务，提供 `GET /health`。这是后面所有章节的基础检查接口。

### 为什么先做这个

很多初学者第一次调用模型失败时，不知道问题出在 Python 环境、网络、路由、模型服务还是前端。健康检查能先证明：Python、FastAPI、路由和进程启动没有问题。

### 第一步：创建目录和虚拟环境

在终端执行：

```bash
mkdir -p agent-platform/apps/api
cd agent-platform/apps/api
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
```

> **Python 基础：虚拟环境 (venv)**
>
> `python3 -m venv .venv` 在当前目录创建名为 `.venv` 的虚拟环境。虚拟环境是一个**独立的 Python 运行空间**——里面安装的所有包只影响当前项目，不会污染系统全局或其他项目。
>
> 拆解这条命令：
> - `python3`：调用 Python 3 解释器
> - `-m venv`：以模块方式运行内置的 `venv` 模块（`-m` = module，确保用的是当前 python3 绑定的 venv）
> - `.venv`：虚拟环境目录名，前面的 `.` 表示隐藏目录
>
> `source .venv/bin/activate` 激活虚拟环境。激活后终端提示符前会出现 `(.venv)` 标记，之后所有 `python`/`pip` 命令都作用于这个隔离环境内。用 `deactivate` 退出。
>
> Windows 等效命令：CMD 用 `.venv\Scripts\activate.bat`，PowerShell 用 `.venv\Scripts\Activate.ps1`。

Windows PowerShell 请使用：

```powershell
.venv\Scripts\Activate.ps1
```

如果 PowerShell 提示执行策略禁止脚本，先不要修改系统安全策略；可以改用 Windows Terminal 的 WSL2，或临时使用 `Set-ExecutionPolicy -Scope Process Bypass`。

### 第二步：创建依赖文件

创建 `requirements.txt`：

```text
fastapi==0.141.1
uvicorn[standard]==0.52.0
httpx==0.28.1
httpx2==2.9.1
pydantic==2.13.4
pydantic-settings==2.14.2
pytest==9.1.1
pytest-asyncio==1.4.0
```

安装依赖：

```bash
pip install -r requirements.txt
```

> **Python 基础：pip 与 requirements.txt**
>
> `pip` 是 Python 的包管理工具（类似 Node.js 的 `npm`）。`pip install -r requirements.txt` 会**批量安装**文件中列出的所有依赖。
>
> `requirements.txt` 中的版本号语法：
> - `fastapi==0.141.1`：`==` 表示精确版本锁定，确保团队成员安装的版本一致
> - `uvicorn[standard]==0.52.0`：`[standard]` 表示安装 uvicorn 的 "standard" 可选依赖组（包含 uvloop、httptools 等高性能组件）
> - `httpx`：后面调用 OpenAI-compatible 接口时用；`httpx2`：Starlette/FastAPI 的 `TestClient` 现在依赖它，不装会出现弃用警告

### 第三步：创建应用文件

创建目录：

```bash
mkdir -p app tests
touch app/__init__.py
```

> **Python 基础：`__init__.py` 与 Python 包**
>
> `__init__.py` 告诉 Python："这个目录是一个**包 (package)**，其他文件可以 `import` 它"。即使文件内容为空，这个标志作用也至关重要。
>
> 创建后，你才能写 `from app.schemas import ChatRequest`——Python 会把 `app/` 当作包来查找里面的模块。没有 `__init__.py` 的目录只是一个普通文件夹，无法被 `import`。

创建 `app/main.py`：

```python
from fastapi import FastAPI

app = FastAPI(title="Agent Platform API", version="0.1.0")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
```

> **Python 基础：装饰器与 async/await**
>
> `@app.get("/health")` 是一个**装饰器 (decorator)**。装饰器本质是一个函数，它接收被装饰的函数作为参数，返回一个新的函数。这里 FastAPI 用装饰器把 `health()` 注册为 `GET /health` 路由的处理函数。
>
> `async def` 定义了一个**协程函数 (coroutine)**。协程可以在等待 I/O 操作（如网络请求、数据库查询）时让出执行权，让程序同时处理其他任务，从而大幅提高并发性能。所有 FastAPI 路由函数都推荐用 `async def`。
>
> `-> dict[str, str]` 是**类型注解**，表示返回一个字典，键和值都是字符串。FastAPI 会据此自动生成接口文档和响应校验。

启动服务：

```bash
uvicorn app.main:app --reload --port 8000
```

> **Python 基础：uvicorn 启动命令**
>
> `uvicorn` 是一个 ASGI 服务器，负责接收 HTTP 请求并交给 FastAPI 处理。拆解参数：
> - `app.main:app`：`模块路径:变量名` 格式。指 `app/main.py` 文件中名为 `app` 的变量（即 `app = FastAPI(...)` 那一行）
> - `--reload`：代码改动后自动重启服务。**仅开发时使用**，生产环境不要开，有安全风险
> - `--port 8000`：监听 8000 端口
>
> ASGI (Asynchronous Server Gateway Interface) 是 Python 异步 Web 服务的标准协议，可以类比 Node.js 世界中 Express/Koa 与 HTTP 服务器的关系。

浏览器打开 `http://127.0.0.1:8000/health`。预期结果：

```json
{"status":"ok"}
```

再打开 `http://127.0.0.1:8000/docs`。你应该看到 FastAPI 自动生成的接口文档。

### 第四步：为健康检查写测试

创建 `pytest.ini`（让测试能找到 `app` 包）：

```ini
[pytest]
pythonpath = .
```

> **为什么需要 `pytest.ini`**
>
> pytest 9 起默认用 `importlib` 导入模式，不会自动把项目根目录加入 `sys.path`。没有这行配置时，`from app.main import app` 会报 `ModuleNotFoundError: No module named 'app'`。`pythonpath = .` 表示把当前目录（`apps/api`）加入模块搜索路径。

创建 `tests/test_health.py`：

```python
from fastapi.testclient import TestClient

from app.main import app


def test_health_returns_ok() -> None:
    client = TestClient(app)

    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
```

运行测试（务必在 `apps/api` 目录下）：

```bash
pytest -q
```

预期结果：

```text
1 passed
```

> **Python 基础：pytest 测试框架**
>
> `pytest` 是 Python 最流行的测试框架。它会自动发现以 `test_` 开头的文件和函数，无需手动注册。
>
> 关键概念：
> - `assert`：Python 内置的断言语句，如果后面的表达式为 `False`，测试失败。不需要记 `assertEquals` 之类的 API
> - `TestClient(app)`：FastAPI 提供的测试客户端，可以模拟 HTTP 请求而不需要真正启动服务器
> - `-q`：quiet 模式，精简输出
> - `@pytest.mark.asyncio`（后面会出现）：标记测试函数是异步的，pytest 会自动用事件循环执行它

### 故意制造一次失败

把 `@app.get("/health")` 暂时改成 `@app.get("/healthy")`，再运行测试。你应该看到 404。恢复为 `/health` 后测试重新通过。

这个练习的目的不是背断言，而是建立习惯：先让测试明确告诉你“接口是否符合约定”。

### 本课验收

- `uvicorn` 能启动；
- `/health` 返回 `{"status":"ok"}`；
- `/docs` 可打开；
- `pytest -q` 通过。

提交建议：

```bash
git init
git add .
git commit -m "chore: initialize FastAPI service"
```

---
