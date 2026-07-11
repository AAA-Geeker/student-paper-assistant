#!/usr/bin/env bash
# ============================================================================
# 学生论文写作助手 — 腾讯云一键部署脚本
# 适用：腾讯云 CVM / LightHouse（CentOS 7+ / Ubuntu 20.04+ / Debian 11+）
# ============================================================================
set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC}  $*"; }
err()  { echo -e "${RED}[ERROR]${NC} $*"; }
step() { echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; echo -e "${BLUE}[STEP]${NC} $*"; echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; }

# ─── 配置变量 ──────────────────────────────────────────────────────────────
PROJECT_DIR="/opt/student-paper-assistant"
DOMAIN="${DOMAIN:-}"          # 如果有域名，设置后启用 SSL
EMAIL="${EMAIL:-}"            # Let's Encrypt 通知邮箱
USE_SQLITE="${USE_SQLITE:-false}"  # true=单容器SQLite模式（简单），false=PostgreSQL模式（推荐）

# ─── 检查 root 权限 ────────────────────────────────────────────────────────
if [[ $EUID -ne 0 ]]; then
    err "请使用 root 用户运行此脚本: sudo bash deploy.sh"
    exit 1
fi

# ─── 检测操作系统 ──────────────────────────────────────────────────────────
detect_os() {
    if [[ -f /etc/os-release ]]; then
        . /etc/os-release
        OS=$ID
        OS_VERSION=$VERSION_ID
    else
        err "无法检测操作系统版本"
        exit 1
    fi
    log "检测到操作系统: $OS $OS_VERSION"
}

# ─── Step 1: 安装 Docker ───────────────────────────────────────────────────
install_docker() {
    step "Step 1/6: 安装 Docker & Docker Compose"

    if command -v docker &>/dev/null && command -v docker compose &>/dev/null; then
        log "Docker 已安装，跳过"
        docker --version
        return
    fi

    case "$OS" in
        ubuntu|debian)
            # 使用腾讯云镜像加速
            curl -fsSL https://mirrors.cloud.tencent.com/docker-ce/linux/$OS/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
            echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://mirrors.cloud.tencent.com/docker-ce/linux/$OS $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
            apt-get update -qq
            apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin
            ;;
        centos|rhel|fedora)
            yum install -y yum-utils
            yum-config-manager --add-repo https://mirrors.cloud.tencent.com/docker-ce/linux/centos/docker-ce.repo
            yum install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
            systemctl start docker
            systemctl enable docker
            ;;
        *)
            warn "未识别的系统，尝试使用官方脚本安装 Docker"
            curl -fsSL https://get.docker.com | bash
            ;;
    esac

    # 配置 Docker 使用腾讯云镜像加速
    mkdir -p /etc/docker
    if [[ ! -f /etc/docker/daemon.json ]]; then
        cat > /etc/docker/daemon.json <<'EOF'
{
  "registry-mirrors": ["https://mirror.ccs.tencentyun.com"],
  "log-driver": "json-file",
  "log-opts": { "max-size": "10m", "max-file": "3" }
}
EOF
        systemctl restart docker || true
    fi

    log "Docker 安装完成: $(docker --version)"
    log "Docker Compose 版本: $(docker compose version)"
}

# ─── Step 2: 克隆项目 ──────────────────────────────────────────────────────
setup_project() {
    step "Step 2/6: 准备项目代码"

    if [[ -d "$PROJECT_DIR" ]]; then
        log "项目目录已存在，更新代码..."
        cd "$PROJECT_DIR"
        git pull origin master || log "git pull 失败，使用现有代码继续"
    else
        log "克隆项目到 $PROJECT_DIR ..."
        git clone https://github.com/AAA-Geeker/student-paper-assistant.git "$PROJECT_DIR"
        cd "$PROJECT_DIR"
    fi
}

# ─── Step 3: 配置环境变量 ──────────────────────────────────────────────────
setup_env() {
    step "Step 3/6: 配置环境变量"

    cd "$PROJECT_DIR"

    if [[ ! -f .env ]]; then
        if [[ -f .env.example ]]; then
            cp .env.example .env
            log "已从 .env.example 创建 .env"
        else
            err "找不到 .env.example 文件"
            exit 1
        fi
    else
        log ".env 文件已存在"
    fi

    # 生成随机密钥
    SECRET_KEY=$(openssl rand -hex 32 2>/dev/null || python3 -c "import secrets; print(secrets.token_hex(32))" 2>/dev/null || cat /dev/urandom | tr -dc 'a-f0-9' | fold -w 64 | head -n1)
    DB_PASS=$(openssl rand -hex 16 2>/dev/null || python3 -c "import secrets; print(secrets.token_hex(16))" 2>/dev/null || cat /dev/urandom | tr -dc 'a-f0-9' | fold -w 32 | head -n1)

    # 更新 .env 中的敏感值（如果还是默认值）
    if grep -q "change-me-to-a-random-secret-key" .env 2>/dev/null; then
        sed -i "s/change-me-to-a-random-secret-key/$SECRET_KEY/" .env
        log "已自动生成 SECRET_KEY"
    fi
    if grep -q "change-me" .env 2>/dev/null; then
        sed -i "s/change-me/$DB_PASS/" .env
        log "已自动生成 POSTGRES_PASSWORD"
    fi

    # 设置数据库 URL
    if [[ "$USE_SQLITE" == "true" ]]; then
        warn "使用 SQLite 模式（单容器部署）"
        sed -i 's|^DATABASE_URL=.*|DATABASE_URL=sqlite:////app/data/app.db|' .env
    else
        log "使用 PostgreSQL 模式（推荐生产环境）"
        sed -i "s|^# DATABASE_URL=postgresql://|DATABASE_URL=postgresql://|" .env
        sed -i "s|YOUR_DB_PASSWORD|$DB_PASS|" .env
    fi

    warn "=============================================="
    warn "请编辑 $PROJECT_DIR/.env 填入你的 API Keys:"
    warn "  - DEEPSEEK_API_KEY  (推荐，便宜)"
    warn "  - LLM_API_KEY        (OpenAI 格式)"
    warn "  - ANTHROPIC_API_KEY  (可选)"
    warn ""
    warn "编辑命令: nano $PROJECT_DIR/.env"
    warn "=============================================="
}

# ─── Step 4: 配置 Nginx ────────────────────────────────────────────────────
setup_nginx() {
    step "Step 4/6: 配置 Nginx"

    cd "$PROJECT_DIR"
    mkdir -p nginx/ssl

    if [[ -n "$DOMAIN" ]]; then
        log "配置域名模式: $DOMAIN"

        # 创建 SSL-enabled nginx 配置
        cat > nginx/nginx.conf <<NGINX
events {}

http {
    # 限制请求速率（防止 API 滥用）
    limit_req_zone \$binary_remote_addr zone=api_limit:10m rate=10r/s;

    # 上游服务
    upstream backend { server backend:8000; }
    upstream frontend { server frontend:80; }

    # HTTP → HTTPS 重定向
    server {
        listen 80;
        server_name $DOMAIN;
        location /.well-known/acme-challenge/ { root /var/www/certbot; }
        location / { return 301 https://\$host\$request_uri; }
    }

    server {
        listen 443 ssl http2;
        server_name $DOMAIN;

        ssl_certificate     /etc/nginx/ssl/fullchain.pem;
        ssl_certificate_key /etc/nginx/ssl/privkey.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
        ssl_prefer_server_ciphers on;
        ssl_session_cache shared:SSL:10m;
        ssl_session_timeout 1d;

        # 安全头
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;

        # Gzip 压缩
        gzip on;
        gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
        gzip_min_length 1000;

        # 客户端上传限制
        client_max_body_size 20M;

        # API 反向代理
        location /api/ {
            limit_req zone=api_limit burst=20 nodelay;
            proxy_pass http://backend/api/;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
            proxy_read_timeout 120s;
        }

        # 前端静态文件
        location / {
            proxy_pass http://frontend/;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
        }
    }
}
NGINX
        log "Nginx SSL 配置已生成（域名: $DOMAIN）"

    else
        log "配置 IP 直连模式（无域名/SSL）"

        cat > nginx/nginx.conf <<NGINX
events {}

http {
    upstream backend { server backend:8000; }
    upstream frontend { server frontend:80; }

    server {
        listen 80;
        server_name _;

        client_max_body_size 20M;

        # Gzip
        gzip on;
        gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
        gzip_min_length 1000;

        location /api/ {
            proxy_pass http://backend/api/;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
            proxy_read_timeout 120s;
        }

        location / {
            proxy_pass http://frontend/;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
        }
    }
}
NGINX
        log "Nginx IP 直连配置已生成"
    fi
}

# ─── Step 5: 配置防火墙 ────────────────────────────────────────────────────
setup_firewall() {
    step "Step 5/6: 配置防火墙"

    # 腾讯云安全组优先控制，此处配置本地防火墙作为双层防护
    if command -v ufw &>/dev/null; then
        ufw allow 22/tcp    # SSH
        ufw allow 80/tcp    # HTTP
        ufw allow 443/tcp   # HTTPS
        ufw --force enable 2>/dev/null || true
        log "ufw 防火墙已配置（22, 80, 443）"
    elif command -v firewall-cmd &>/dev/null; then
        firewall-cmd --permanent --add-service=ssh
        firewall-cmd --permanent --add-service=http
        firewall-cmd --permanent --add-service=https
        firewall-cmd --reload
        log "firewalld 防火墙已配置"
    fi

    warn "请确保腾讯云安全组已放行: 22, 80, 443 端口！"
    warn "腾讯云控制台 → 云服务器 → 安全组 → 添加规则"
}

# ─── Step 6: 启动服务 ──────────────────────────────────────────────────────
start_services() {
    step "Step 6/6: 构建并启动服务"

    cd "$PROJECT_DIR"

    if [[ "$USE_SQLITE" == "true" ]]; then
        log "使用统一 Dockerfile 构建（SQLite 单容器模式）..."
        # 使用根目录的 Dockerfile（前端+后端合一）
        docker build -t student-paper-assistant:latest .
        docker run -d \
            --name student-paper-assistant \
            --restart unless-stopped \
            -p 8000:8000 \
            --env-file .env \
            -v "$PROJECT_DIR/data:/app/data" \
            student-paper-assistant:latest
        log "服务已启动 → http://<服务器IP>:8000"
    else
        log "使用 Docker Compose 启动（多容器模式）..."
        docker compose -f docker-compose.prod.yml up -d --build
        log "服务已启动 → http://<服务器IP>"
    fi

    # 等待服务就绪
    log "等待服务就绪..."
    for i in $(seq 1 30); do
        if curl -s http://localhost:80/api/health &>/dev/null || curl -s http://localhost:8000/api/health &>/dev/null; then
            log "✅ 服务启动成功！"
            break
        fi
        sleep 2
        echo -n "."
    done
    echo ""
}

# ─── Step 7 (可选): SSL 证书 ────────────────────────────────────────────────
setup_ssl() {
    if [[ -z "$DOMAIN" ]]; then
        log "未设置域名，跳过 SSL 配置"
        log "如需启用 HTTPS，请使用域名重新运行：DOMAIN=your-domain.com bash deploy.sh"
        return
    fi

    step "Step 7/7 (可选): 配置 SSL 证书"

    # 方法1: 使用腾讯云免费 SSL 证书（需在控制台申请后上传）
    if [[ -f nginx/ssl/fullchain.pem ]] && [[ -f nginx/ssl/privkey.pem ]]; then
        log "检测到已有 SSL 证书文件，使用现有证书"
        docker compose -f docker-compose.prod.yml restart nginx
        return
    fi

    # 方法2: 使用 Let's Encrypt (Certbot)
    if command -v certbot &>/dev/null; then
        log "使用 Let's Encrypt 申请免费 SSL 证书..."
        certbot certonly --standalone -d "$DOMAIN" --email "$EMAIL" --agree-tos --non-interactive
        if [[ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]]; then
            cp "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" nginx/ssl/
            cp "/etc/letsencrypt/live/$DOMAIN/privkey.pem" nginx/ssl/
        fi
    else
        warn "未安装 certbot。请通过以下方式获取 SSL 证书："
        warn "1) 腾讯云控制台 → SSL 证书 → 申请免费证书 → 下载 Nginx 格式"
        warn "2) 将 fullchain.pem 和 privkey.pem 放到 $PROJECT_DIR/nginx/ssl/"
        warn "3) 安装 certbot: apt install certbot 然后重新运行此脚本"
    fi

    docker compose -f docker-compose.prod.yml restart nginx 2>/dev/null || true
}

# ─── 最终信息 ──────────────────────────────────────────────────────────────
print_info() {
    echo ""
    echo -e "${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║         部署完成！学生论文写作助手已上线                  ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════════════╝${NC}"
    echo ""

    # 获取公网 IP
    PUBLIC_IP=$(curl -s ifconfig.me 2>/dev/null || curl -s ip.sb 2>/dev/null || echo "YOUR_SERVER_IP")

    if [[ -n "$DOMAIN" ]]; then
        echo -e "  🌐 访问地址:   ${BLUE}https://$DOMAIN${NC}"
        echo -e "  📧 管理员邮箱: ${BLUE}$EMAIL${NC}"
    else
        echo -e "  🌐 访问地址:   ${BLUE}http://$PUBLIC_IP${NC}"
    fi

    echo ""
    echo -e "  📁 项目目录:   ${BLUE}$PROJECT_DIR${NC}"
    echo -e "  📋 环境变量:   ${BLUE}$PROJECT_DIR/.env${NC}"
    echo ""
    echo -e "  ${YELLOW}⚠️  重要：请先编辑 .env 填入 API Keys 再使用！${NC}"
    echo -e "     编辑命令: nano $PROJECT_DIR/.env"
    echo ""
    echo -e "  ${BLUE}常用命令:${NC}"
    echo -e "    查看日志:   cd $PROJECT_DIR && docker compose -f docker-compose.prod.yml logs -f"
    echo -e "    重启服务:   cd $PROJECT_DIR && docker compose -f docker-compose.prod.yml restart"
    echo -e "    停止服务:   cd $PROJECT_DIR && docker compose -f docker-compose.prod.yml down"
    echo -e "    更新部署:   cd $PROJECT_DIR && git pull && docker compose -f docker-compose.prod.yml up -d --build"
    echo ""
}

# ─── 主流程 ─────────────────────────────────────────────────────────────────
main() {
    echo -e "${GREEN}"
    echo "  ╔═══════════════════════════════════════════╗"
    echo "  ║  学生论文写作助手 — 腾讯云一键部署       ║"
    echo "  ║  Student Paper Assistant — Deploy 🚀     ║"
    echo "  ╚═══════════════════════════════════════════╝"
    echo -e "${NC}"

    detect_os
    install_docker
    setup_project
    setup_env
    setup_nginx
    setup_firewall
    start_services
    setup_ssl
    print_info
}

main "$@"
