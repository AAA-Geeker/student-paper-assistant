# 腾讯云部署指南

本文档介绍如何将学生论文写作助手部署到腾讯云服务器上。

## 前置条件

- **腾讯云服务器**：CVM 或 LightHouse（轻量应用服务器）
  - 推荐配置：2核4G + 40GB SSD（最低 1核2G）
  - 操作系统：Ubuntu 22.04 / CentOS 7.9 / Debian 11
- **安全组放行端口**：22 (SSH)、80 (HTTP)、443 (HTTPS)
- **域名**（可选）：如需 HTTPS 则需要已备案域名
- **LLM API Key**：至少准备一个（推荐 DeepSeek，便宜好用）

---

## 快速部署（一键脚本）

### 1. SSH 登录服务器

```bash
ssh root@<你的服务器IP>
```

### 2. 下载并运行部署脚本

```bash
# 克隆项目
git clone https://github.com/AAA-Geeker/student-paper-assistant.git /opt/student-paper-assistant
cd /opt/student-paper-assistant

# 运行一键部署脚本
sudo bash deploy.sh
```

脚本会自动完成：
- ✅ 安装 Docker & Docker Compose
- ✅ 克隆/更新项目代码
- ✅ 配置环境变量（自动生成密钥）
- ✅ 配置 Nginx 反向代理
- ✅ 配置防火墙
- ✅ 构建并启动所有服务

### 3. 配置 API Key

```bash
nano /opt/student-paper-assistant/.env
```

至少填入一个 LLM API Key（推荐 DeepSeek）：
```
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxx
```

### 4. 重启服务使配置生效

```bash
cd /opt/student-paper-assistant
docker compose -f docker-compose.prod.yml restart
```

### 5. 访问

打开浏览器访问：`http://<服务器公网IP>`

---

## 部署选项

### 选项 A：PostgreSQL + Nginx（推荐生产环境）

```bash
# 使用默认 docker-compose.prod.yml
docker compose -f docker-compose.prod.yml up -d --build
```

架构：
```
用户 → Nginx(:80) → Frontend(:80, 静态文件)
                  → Backend(:8000, API)
                       ↓
                  PostgreSQL(:5432)
```

### 选项 B：SQLite 单容器（最简单）

适合个人使用、低流量场景：

```bash
# 使用根目录统一 Dockerfile
docker build -t student-paper-assistant .
docker run -d \
    --name student-paper-assistant \
    --restart unless-stopped \
    -p 8000:8000 \
    --env-file .env \
    -v $(pwd)/data:/app/data \
    student-paper-assistant
```

访问：`http://<服务器IP>:8000`

### 选项 C：腾讯云专用 Compose

```bash
docker compose -f docker-compose.tencent.yml up -d --build
```

---

## 从源码手动部署（不使用 Docker）

### 后端

```bash
# 安装 Python 3.11+
sudo apt install python3.11 python3.11-venv -y

# 创建虚拟环境
cd /opt/student-paper-assistant/backend
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# 配置环境变量
cp ../.env.example ../.env
# 编辑 .env 填入配置

# 启动（开发模式）
uvicorn app.main:app --host 0.0.0.0 --port 8000

# 启动（生产模式，使用 gunicorn + uvicorn workers）
pip install gunicorn
gunicorn -w 4 -k uvicorn.workers.UvicornWorker app.main:app --bind 0.0.0.0:8000
```

### 前端

```bash
# 安装 Node.js 20+
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install nodejs -y

cd /opt/student-paper-assistant/frontend
npm install
npm run build  # 产出在 dist/ 目录

# 使用 nginx 托管 dist/ + 反向代理 API
sudo apt install nginx -y
sudo cp nginx-ip.conf /etc/nginx/sites-available/paper
sudo ln -s /etc/nginx/sites-available/paper /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

---

## 配置 HTTPS（需要域名）

### 方法 1：腾讯云免费 SSL 证书（推荐）

1. 登录 [腾讯云 SSL 控制台](https://console.cloud.tencent.com/ssl)
2. 申请免费 DV 证书（有效期 1 年，支持自动续期）
3. 下载 Nginx 格式证书
4. 上传到服务器：
```bash
scp fullchain.pem root@<IP>:/opt/student-paper-assistant/nginx/ssl/
scp privkey.pem root@<IP>:/opt/student-paper-assistant/nginx/ssl/
```
5. 使用 SSL nginx 配置：
```bash
cd /opt/student-paper-assistant
# 编辑 nginx/nginx-ssl.conf，替换 DOMAIN_PLACEHOLDER 为你的域名
cp nginx/nginx-ssl.conf nginx/nginx.conf
# 编辑 nginx/nginx.conf 中的域名
docker compose -f docker-compose.prod.yml restart nginx
```

### 方法 2：Let's Encrypt

```bash
# 安装 certbot
sudo apt install certbot -y

# 申请证书
sudo certbot certonly --standalone -d your-domain.com --email your-email@example.com --agree-tos

# 复制到项目
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem /opt/student-paper-assistant/nginx/ssl/
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem /opt/student-paper-assistant/nginx/ssl/

# 使用 SSL nginx 配置
cd /opt/student-paper-assistant
cp nginx/nginx-ssl.conf nginx/nginx.conf
# 编辑 nginx/nginx.conf，将 DOMAIN_PLACEHOLDER 替换为你的域名
docker compose -f docker-compose.prod.yml restart nginx

# 设置自动续期 cron
echo "0 3 * * * certbot renew --quiet && docker compose -f /opt/student-paper-assistant/docker-compose.prod.yml restart nginx" | crontab -
```

---

## 腾讯云安全组配置

在腾讯云控制台中配置以下入站规则：

| 端口 | 协议 | 来源 | 说明 |
|------|------|------|------|
| 22 | TCP | 0.0.0.0/0 | SSH 远程连接 |
| 80 | TCP | 0.0.0.0/0 | HTTP Web 访问 |
| 443 | TCP | 0.0.0.0/0 | HTTPS 安全访问 |

> 操作路径：云服务器 → 实例 → 点击实例ID → 安全组 → 添加规则

---

## 常用运维命令

```bash
# 进入项目目录
cd /opt/student-paper-assistant

# 查看所有容器状态
docker compose -f docker-compose.prod.yml ps

# 查看实时日志
docker compose -f docker-compose.prod.yml logs -f

# 查看特定服务日志
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml logs -f nginx

# 重启服务
docker compose -f docker-compose.prod.yml restart

# 停止服务
docker compose -f docker-compose.prod.yml down

# 更新部署（拉取最新代码 + 重建）
git pull
docker compose -f docker-compose.prod.yml up -d --build

# 数据库备份（PostgreSQL）
docker exec $(docker ps -qf name=db) pg_dump -U paper paper > backup_$(date +%Y%m%d).sql

# 恢复数据库
docker exec -i $(docker ps -qf name=db) psql -U paper paper < backup_20250101.sql

# 查看资源占用
docker stats

# 清理旧镜像和容器
docker system prune -a
```

---

## 故障排查

### 服务无法访问

```bash
# 1. 检查容器是否运行
docker compose -f docker-compose.prod.yml ps

# 2. 检查端口是否监听
netstat -tlnp | grep -E '80|443|8000'

# 3. 检查防火墙
sudo ufw status
# 腾讯云安全组也要检查！

# 4. 查看日志
docker compose -f docker-compose.prod.yml logs --tail=100
```

### 数据库连接失败

```bash
# 检查 PostgreSQL 是否就绪
docker compose -f docker-compose.prod.yml logs db

# 进入数据库容器检查
docker exec -it $(docker ps -qf name=db) psql -U paper -d paper
```

### API 调用失败

```bash
# 检查后端日志
docker compose -f docker-compose.prod.yml logs backend

# 检查 API Key 是否配置
docker exec $(docker ps -qf name=backend) env | grep API_KEY
```

### 前端 404 或空白页

```bash
# 检查前端是否构建成功
docker compose -f docker-compose.prod.yml logs frontend

# 重新构建前端
docker compose -f docker-compose.prod.yml build --no-cache frontend
docker compose -f docker-compose.prod.yml up -d
```

---

## 成本估算（腾讯云）

| 资源 | 规格 | 月费用（参考） |
|------|------|---------------|
| LightHouse 轻量服务器 | 2核4G 6Mbps | ~¥80/月 |
| CVM 云服务器 | 2核4G 按量 | ~¥150/月 |
| SSL 证书 | 免费 DV | ¥0 |
| 域名 | .com/.cn | ~¥60/年 |
| DeepSeek API | 按量 | ~¥10-50/月 |
| **合计** | — | **~¥90-200/月** |

> 💡 新用户优惠：腾讯云 LightHouse 新客低至 ¥28/年（1核2G），足够运行此项目。

---

## 环境变量完整参考

| 变量 | 必填 | 默认值 | 说明 |
|------|------|--------|------|
| `SECRET_KEY` | ✅ | — | JWT 签名密钥，随机字符串 |
| `POSTGRES_PASSWORD` | ✅ | — | 数据库密码 |
| `DATABASE_URL` | — | `sqlite:///./app.db` | 数据库连接串 |
| `DEEPSEEK_API_KEY` | ✅ | — | DeepSeek API Key（推荐） |
| `LLM_API_KEY` | — | — | OpenAI API Key |
| `ANTHROPIC_API_KEY` | — | — | Anthropic API Key |
| `LLM_API_BASE` | — | `https://api.openai.com/v1` | API 地址 |
| `LLM_MODEL` | — | `gpt-4o-mini` | 默认模型 |
| `LLM_MAX_TOKENS` | — | `4096` | 单次最大 Token |
| `MONTHLY_BUDGET_USD` | — | `10.0` | 月度 API 预算 |
| `DEFAULT_TIER` | — | `standard` | 模型层级 |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | — | `1440` | 登录过期时间 |
