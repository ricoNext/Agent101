# 第 2 课：建立一个可测试的后端

> 所属章节：[第一章：LLM API、Prompt、Structured Output 与 Gateway](./index.md)  
> 上一课：[第 1 课：认识 Agent 工程与课程平台](./lesson-01-agent-engineering-map.md)  
> 下一课：[第 3 课：理解 LLM API 与模型调用边界](./lesson-03-llm-api-model-boundaries.md)  
> [参考代码](https://github.com/ricoNext/agent-platform/tree/chapter-01)

第一章先建 Gateway，是因为它是平台对外的 HTTP 入口：收请求、查健康，后面再挂模型调用。
这一课还不接任何模型，只把 `apps/api` 做成一个能启动、能用测试锁住的 FastAPI 服务。

这节课会开始代码的搭建， 涉及到的Python 等基础知识，见 [项目中的 Python 知识](/foundations/python-in-project)。

## 一、创建目录和虚拟环境

```bash
mkdir -p agent-platform/apps/api
cd agent-platform/apps/api
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
```

激活后提示符前应出现 `(.venv)`。退出用 `deactivate`。新开终端要重新激活，否则包装进系统 Python。

## 二、安装依赖

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

安装requirements.txt中的依赖：

```bash
pip install -r requirements.txt
```

`==` 锁死版本，避免各人环境漂移。`uvicorn[standard]` 会带上 uvloop、httptools。
`httpx` 这一课测接口会间接用到，后面调 OpenAI-compatible API 也会用。

## 三、写健康检查

```bash
mkdir -p app tests
touch app/__init__.py
```

`__init__.py` 把 `app` 标成普通包，减少不同启动目录下的导入歧义。

创建 `app/main.py`：

```python
from fastapi import FastAPI

app = FastAPI(title="Agent Platform API", version="0.1.0")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
```

`title` 和 `version` 会出现在 `/docs`。`@app.get("/health")` 把函数挂到 `GET /health`。

启动：

```bash
uvicorn app.main:app --reload --port 8000
```

- `app.main:app`：`app/main.py` 里的 `app` 对象
- `--reload`：改代码自动重启，只给开发用
- `--port 8000`：监听端口

打开 `http://127.0.0.1:8000/health`，应返回：

```json
{"status": "ok"}
```

再打开 `http://127.0.0.1:8000/docs`，应能看到自动生成的接口文档。

## 四、给 `/health` 写测试

能手动打开还不够。后面每加一层 Provider、路由、校验，都要用测试把行为钉住。

在 `apps/api` 下创建 `pytest.ini`：

```ini
[pytest]
pythonpath = .
```

这样 `from app.main import app` 不论从本机还是后续自动化入口跑，导入基准都一样。

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

`TestClient` 在进程内发 HTTP，不必先起 uvicorn。停掉刚才的服务，然后：

```bash
pytest -q
```

预期：

```text
1 passed
```

建议顺手做一次反向验证：把路由改成 `@app.get("/healthy")` 再跑测试，应得到 404；改回 `/health` 后重新通过。

## 本课验收

- `uvicorn` 能启动
- `/health` 返回 `{"status": "ok"}`
- `/docs` 可打开
- `pytest -q` 通过

## 小结

现在平台有了一条不依赖外部 API 的 HTTP 基线：环境、路由、进程启动、测试发现都通了。下一课先把模型调用看成一份内部协议，再往上接 Provider。
