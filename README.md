# 学生论文写作助手

前后端分离的学生论文写作辅助工具，支持项目管理、AI 辅助写作、Markdown 编辑与导出。

## 技术栈

- 后端：Python 3.11 + FastAPI + SQLAlchemy + PostgreSQL/SQLite
- 前端：React 18 + Vite + Tailwind CSS + TypeScript
- 部署：Docker + Docker Compose + Nginx

## 本地开发

### 1. 启动后端

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

后端运行在 http://localhost:8000，API 文档在 http://localhost:8000/docs。

### 2. 启动前端

```bash
cd frontend
npm install
npm run dev
```

前端运行在 http://localhost:5173。

### 3. 使用 Docker Compose

```bash
cp .env.example .env
# 编辑 .env 填入 LLM_API_KEY
docker compose up --build
```

访问 http://localhost:3000。

## 测试

```bash
cd backend
pytest
```

## 生产部署

1. 准备腾讯云服务器（Ubuntu 22.04，2核4G 起步）。
2. 安装 Docker 与 Docker Compose。
3. 上传项目代码到服务器。
4. 创建 `.env` 文件，填写 `POSTGRES_PASSWORD`、`SECRET_KEY`、`LLM_API_KEY`。
5. 运行 `docker compose -f docker-compose.prod.yml up -d`。
6. 配置域名与 HTTPS（建议使用 Caddy 或 Certbot + Nginx）。

## 注意事项

- 生产环境务必修改 `SECRET_KEY` 和 `POSTGRES_PASSWORD`。
- 国内服务器建议优先使用 DeepSeek、智谱、文心一言等国内 LLM API。
- 中文 PDF 导出需要中文字体支持，已在后端 Dockerfile 中安装 fonts-noto-cjk。
