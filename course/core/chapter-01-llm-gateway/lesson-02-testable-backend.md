# 第 2 课：建立一个可测试的后端

> 所属章节：[第一章：LLM API、Prompt、Structured Output 与 Gateway](./index.md)  
> 上一课：[第 1 课：认识 Agent 工程与课程平台](./lesson-01-agent-engineering-map.md)  
> 下一课：[第 3 课：用 Provider 抽象隔离模型服务](./lesson-03-provider-abstraction-mock.md)  
> [参考代码基线](https://github.com/ricoNext/agent-platform/tree/chapter-01)

## 一、前言

这几年，大模型应用开发成了后端工程师绕不开的话题。你要搭一个 LLM Gateway，通常得同时处理 Python 环境、HTTP 路由、模型调用、前端联调。环节一多，问题就来了：

**第一次调用失败时，往往不知道问题出在哪一层。**

是 Python 没装好？FastAPI 没跑起来？路由写错了？还是模型服务本身挂了？

事情是这样的：很多人一上来就接真实模型，结果环境、框架、接口、模型四件事缠在一起，排查起来特别痛苦。我自己学的时候，也常遇到「教程一上来就全栈齐上」的写法，跟完一遍还是不清楚每一步到底验证了什么。

对于这类排查，**健康检查（health check）是常见需求**。它不做任何业务逻辑，只回答一个问题：服务进程是否正常、HTTP 栈是否可用。后面所有章节都会依赖这个最基础的检查接口。

**这一篇是第 1 章的起步教程。** 读完并跟着做一遍，你将得到一个可启动、可测试的 FastAPI 后端，提供 `GET /health` 接口。本章后面还会分几课，逐步接入 Mock Provider 和真实模型——先把地基打稳，再往上加功能。

建议先跟着例子做一遍，再读文字说明。

## 二、第一步：创建目录和虚拟环境

下面演示如何搭建项目目录，并创建 Python 虚拟环境。

在终端执行：

```bash
mkdir -p agent-platform/apps/api
cd agent-platform/apps/api
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
```

### 2.1 虚拟环境是什么

所谓**虚拟环境（venv）**，就是一个**独立的 Python 运行空间**。字面上讲，它就是一个目录；但更准确的说法是：在这个目录里安装的所有包，只影响当前项目，不会污染系统全局或其他项目。

下面解释一下上面几条命令。

**（1）`python3 -m venv .venv`**

在当前目录创建名为 `.venv` 的虚拟环境。拆解这条命令：

- `python3`：调用 Python 3 解释器
- `-m venv`：以模块方式运行内置的 `venv` 模块（`-m` 表示 module，确保用的是当前 `python3` 绑定的 venv）
- `.venv`：虚拟环境目录名，前面的 `.` 表示隐藏目录

**（2）`source .venv/bin/activate`**

激活虚拟环境。激活后，终端提示符前会出现 `(.venv)` 标记，之后所有 `python` / `pip` 命令都作用于这个隔离环境内。用 `deactivate` 退出。

Windows 用户请使用以下等效命令：

```powershell
.venv\Scripts\Activate.ps1
```

CMD 用户用 `.venv\Scripts\activate.bat`。

注意：如果 PowerShell 提示执行策略禁止脚本，先不要修改系统安全策略；可以改用 Windows Terminal 的 WSL2，或临时使用 `Set-ExecutionPolicy -Scope Process Bypass`。

## 三、第二步：创建依赖文件

这一节就来看看，这个项目需要哪些 Python 包。

本课会用到 **FastAPI**——一个用 Python 写异步 Web API 的框架，文档自动生成、类型提示友好。官方文档见：[https://fastapi.tiangolo.com](https://fastapi.tiangolo.com)。自己从零搭一套路由、校验和文档，还是挺麻烦的，也没有这个必要。

创建 `requirements.txt`：

```text
fastapi==0.141.1
uvicorn[standard]==0.52.1
httpx==0.28.1
pydantic==2.13.4
pydantic-settings==2.14.2
pytest==9.1.1
pytest-asyncio==1.4.0
```

安装依赖：

```bash
pip install -r requirements.txt
```

### 3.1 pip 与 requirements.txt

简单说，`pip` 就是 Python 的包管理工具，类似 Node.js 的 `npm`。`pip install -r requirements.txt` 会**批量安装**文件中列出的所有依赖。

需要说明的是，版本号写法各有含义：

- `fastapi==0.141.1`：`==` 表示精确版本锁定，确保团队成员安装的版本一致
- `uvicorn[standard]==0.52.1`：`[standard]` 表示安装 uvicorn 的 "standard" 可选依赖组（包含 uvloop、httptools 等高性能组件）
- `httpx`：后面调用 OpenAI-compatible 接口时使用，FastAPI 的 `TestClient` 也基于它工作

## 四、第三步：创建应用文件

下面演示如何创建 FastAPI 应用，并实现健康检查接口。

### 4.1 创建目录结构

```bash
mkdir -p app tests
touch app/__init__.py
```

所谓 **`__init__.py`**，就是明确告诉 Python 和开发工具：「这个目录是一个传统的包（package）」。即使文件内容为空，也能让项目结构、测试发现和类型检查更直观。

Python 3.3 以后支持没有 `__init__.py` 的 namespace package，因此“没有它就绝对不能导入”并不准确。本课程仍显式创建它，是为了避免不同启动目录和开发工具对包边界产生歧义。

### 4.2 编写 main.py

创建 `app/main.py`：

```python
from fastapi import FastAPI

app = FastAPI(title="Agent Platform API", version="0.1.0")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
```

下面看一个例子，逐段讲解上面的代码。

**（1）`app = FastAPI(...)`**

创建 FastAPI 应用实例。`title` 和 `version` 会显示在自动生成的接口文档里。

**（2）`@app.get("/health")`**

这是一个**装饰器（decorator）**。装饰器本质是一个函数，它接收被装饰的函数作为参数，返回一个新的函数。这里 FastAPI 用装饰器把 `health()` 注册为 `GET /health` 路由的处理函数。

**（3）`async def health()`**

`async def` 定义了一个**协程函数（coroutine）**。协程可以在等待 I/O 操作（如网络请求、数据库查询）时让出执行权，让程序同时处理其他任务。需要等待异步 I/O 的 FastAPI 路由适合使用 `async def`；普通同步函数也可以使用 `def`，FastAPI 会在线程池中执行它。

**（4）`-> dict[str, str]`**

这是**类型注解**，表示返回一个字典，键和值都是字符串。FastAPI 会据此自动生成接口文档和响应校验。

### 4.3 启动服务

```bash
uvicorn app.main:app --reload --port 8000
```

下面解释一下这条启动命令。

上面命令中，`uvicorn` 是一个 ASGI 服务器，负责接收 HTTP 请求并交给 FastAPI 处理。拆解参数：

- `app.main:app`：`模块路径:变量名` 格式，指 `app/main.py` 文件中名为 `app` 的变量
- `--reload`：代码改动后自动重启服务。**仅开发时使用**，生产环境不要开，有安全风险
- `--port 8000`：监听 8000 端口

所谓 **ASGI（Asynchronous Server Gateway Interface）**，就是 Python 异步 Web 服务的标准协议，可以类比 Node.js 世界中 Express / Koa 与 HTTP 服务器的关系。

### 4.4 验证结果

浏览器打开 `http://127.0.0.1:8000/health`，预期结果：

```json
{"status":"ok"}
```

再打开 `http://127.0.0.1:8000/docs`，你应该看到 FastAPI 自动生成的接口文档。

## 五、第四步：为健康检查写测试

服务能跑起来，还不够。**必须牢记的是：可测试的后端，才适合长期迭代。** 下面演示如何为 `/health` 写一条自动化测试。

### 5.1 配置 pytest

在 `apps/api` 目录下创建 `pytest.ini`（让测试能找到 `app` 包）：

```ini
[pytest]
pythonpath = .
```

`pythonpath = .` 表示把当前目录（`apps/api`）明确加入模块搜索路径。这样无论从本地终端还是后续自动化入口运行，`from app.main import app` 都有一致的导入基准。

### 5.2 编写测试

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

上面代码中，测试客户端模拟了一次 `GET /health`，并断言状态码与响应体。下面解释一下关键点。

**（1）`TestClient(app)`**

FastAPI 提供的测试客户端，可以模拟 HTTP 请求，**不需要真正启动服务器**。

**（2）`assert`**

Python 内置的断言语句。如果后面的表达式为 `False`，测试失败。不需要记 `assertEquals` 之类的 API。

**（3）`pytest -q`**

`-q` 是 quiet 模式，精简输出。`pytest` 会自动发现以 `test_` 开头的文件和函数，无需手动注册。后面课程还会出现 `@pytest.mark.asyncio`，用于标记异步测试函数。

停止刚才启动的服务，运行测试：

```bash
pytest -q
```

预期结果：

```text
1 passed
```

## 六、故意制造一次失败

上面测试通过后，建议你做一个小练习：把 `@app.get("/health")` 暂时改成 `@app.get("/healthy")`，再运行测试。

你应该看到 404。恢复为 `/health` 后，测试重新通过。


## 七、本课验收

完成本课后，请确认以下四项：

- `uvicorn` 能启动
- `/health` 返回 `{"status":"ok"}`
- `/docs` 可打开
- `pytest -q` 通过

## 八、小结

今天就讲到这里。这一课我们创建了一个 FastAPI 服务，实现了健康检查接口，并写好了自动化测试。

通过这个健康检查，你可以在不依赖任何外部 API、不消耗一分钱的情况下，验证 Python 环境、FastAPI 路由和进程启动都没有问题。下一篇教程将讲解如何实现一个通用的模型提供者接口，并用 Mock Provider 来测试服务。

如果你看到了结尾，说明你已经完成了第 1 章最基础的一步。下一课见。
---
