# 第 1 课：把本地依赖写成 Docker Compose

> 所属章节：[第 7 章：生产工程、可观测性与 FinOps](./index.md)  
> 下一课：[第 2 课：配置、密钥和健康检查](./lesson-42-config-secrets-healthcheck.md)

### 你将完成什么

启动 API、Web、PostgreSQL 和 Redis。先确保干净环境可运行，再讨论 Kubernetes。

创建 `infra/docker-compose.yml`：

```yaml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: agent
      POSTGRES_PASSWORD: agent-dev-only
      POSTGRES_DB: agent_platform
    ports: ["5432:5432"]
    volumes: ["postgres_data:/var/lib/postgresql/data"]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U agent -d agent_platform"]
      interval: 5s
      timeout: 3s
      retries: 10

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 10

  api:
    build: ../apps/api
    env_file: ../apps/api/.env
    ports: ["8000:8000"]
    depends_on:
      postgres: { condition: service_healthy }
      redis: { condition: service_healthy }

  web:
    build: ../apps/web
    environment:
      NEXT_PUBLIC_API_BASE_URL: http://localhost:8000
    ports: ["3000:3000"]
    depends_on: [api]

volumes:
  postgres_data:
```

创建 API `Dockerfile`：

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

启动：

```bash
cd infra
docker compose up --build
```

验收：删除旧容器后重新启动，`/health` 和 Web 页面仍可正常工作。不要把开发机上已有的数据库当作部署成功证据。

---
