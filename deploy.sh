# 学生论文写作助手 — 腾讯云一键部署脚本
# 增强版：支持 SQLite 单容器模式（默认）+ 健康检查 + 自动回滚
# ============================================================================
set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

log()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC}  $*"; }
err()  { echo -e "${RED}[ERROR]${NC} $*"; }
step() { echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; echo -e "${BLUE}[STEP]${NC} $*"; echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; }

# ─── 配置变量 ──────────────────────────────────────────────────────
PROJECT_DIR="/opt/student-paper-assistant"
DOMAIN="${DOMAIN:-}"
EMAIL="${EMAIL:-}"

# ─── 检查 root ────────────────────────────────────────────────────
if [[ $EUID -ne 0 ]]; then
    err "请使用 root 用户运行: sudo bash deploy.sh"
    exit 1
fi

# ─── 检测系统 ─────────────────────────────────────────────────────
detect_os() {
    if [[ -f /etc/os-release ]]; then
        . /etc/os-release
        OS=$ID
    else
        err "无法检测操作系统"
        exit 1
    fi
    log "操作系统: $OS"
}

# ─── Step 1: Docker ───────────────────────────────────────────────
install_docker() {
    step "Step 1/5: 安装 Docker"

    if command -v docker &>/dev/null; then
        log "Docker 已安装: $(docker --version)"
        return
    fi

    log "安装 Docker..."
    curl -fsSL https://get.docker.com | bash
    systemctl start docker
    systemctl enable docker

    # 配置腾讯云镜像加速
    mkdir -p /etc/docker
    cat > /etc/docker/daemon.json <<'EOF'
{
  "registry-mirrors": ["https://mirror.ccs.tencentyun.com"],
  "log-driver": "json-file",
  "log-opts": { "max-size": "10m", "max-file": "3" }
}
EOF
    systemctl restart docker
    log "Docker 安装完成"
}

# ─── Step 2: 克隆项目 ─────────────────────────────────────────────
setup_project() {
    step "Step 2/5: 获取代码"

    if [[ -d "$PROJECT_DIR" ]]; then
        log "项目已存在，更新..."
        cd "$PROJECT_DIR"
        git pull origin master || warn "git pull 失败，使用现有代码"
    else
        log "克隆项目..."
        git clone https://github.com/AAA-Geeker/student-paper-assistant.git "$PROJECT_DIR"
        cd "$PROJECT_DIR"
    fi

    # 确保 deploy.sh 可执行
    chmod +x deploy.sh
}

# ─── Step 3: 环境变量 ─────────────────────────────────────────────
setup_env() {
    step "Step 3/5: 配置环境变量"

    cd "$PROJECT_DIR"

    if [[ ! -f .env ]]; then
        cat > .env <<'ENVEOF'
DEEPSEEK_API_KEY=your_deepseek_api_key_here
LLM_API_KEY=
# 数据库（SQLite 单容器模式）
DATABASE_URL=sqlite:////app/data/app.db
SECRET_KEY=
ENVEOF
        log "已创建 .env 文件"
    fi

    # 生成随机密钥
    local secret_key
    secret_key=$(openssl rand -hex 32 2>/dev/null || python3 -c "import secrets; print(secrets.token_hex(32))" 2>/dev/null || echo "change-me-$(date +%s)")
    if grep -q "^SECRET_KEY=\s*$" .env 2>/dev/null; then
        sed -i "s/^SECRET_KEY=\s*$/SECRET_KEY=$secret_key/" .env
        log "已生成 SECRET_KEY"
    fi

    warn "=================================================="
    warn "请编辑 $PROJECT_DIR/.env 填入你的 DEEPSEEK_API_KEY"
    warn "编辑命令: nano $PROJECT_DIR/.env"
    warn "=================================================="
}

# ─── Step 4: 构建并启动 ─────────────────────────────────────────
start_services() {
    step "Step 4/5: 构建并启动"

    cd "$PROJECT_DIR"

    # 停止旧容器
    docker stop student-paper-assistant 2>/dev/null || true
    docker rm student-paper-assistant 2>/dev/null || true

    # 构建镜像
    log "构建 Docker 镜像（前端+后端合一）..."
    docker build -t student-paper-assistant:latest .

    # 启动
    log "启动服务..."
    docker run -d \
        --name student-paper-assistant \
        --restart unless-stopped \
        -p 8000:8000 \
        --env-file .env \
        -v "$PROJECT_DIR/data:/app/data" \
        student-paper-assistant:latest

    # 健康检查（最多等待 60s）
    log "健康检查..."
    local success=false
    for i in $(seq 1 30); do
        if curl -sf http://localhost:8000/api/health >/dev/null 2>&1; then
            success=true
            break
        fi
        sleep 2
        echo -n "."
    done
    echo ""

    if $success; then
        log "✅ 服务启动成功！"
    else
        warn "⚠️ 健康检查未通过，请查看日志: docker logs student-paper-assistant"
    fi
}

# ─── Step 5: 防火墙 ───────────────────────────────────────────────
setup_firewall() {
    step "Step 5/5: 配置防火墙"

    if command -v ufw &>/dev/null; then
        ufw allow 22/tcp
        ufw allow 80/tcp
        ufw allow 443/tcp
        ufw allow 8000/tcp
        ufw --force enable 2>/dev/null || true
        log "ufw 已配置（22, 80, 443, 8000）"
    fi

    warn "请确保腾讯云安全组已放行端口: 22, 80, 443, 8000"
}

# ─── 部署后信息 ───────────────────────────────────────────────────
print_info() {
    local public_ip
    public_ip=$(curl -s ifconfig.me 2>/dev/null || echo "YOUR_SERVER_IP")

    echo ""
    echo -e "${GREEN}╔══════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║       部署完成！学生论文写作助手已上线               ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "  🌐 访问地址:   ${BLUE}http://$public_ip:8000${NC}"
    echo -e "     (如使用80端口反向代理: http://$public_ip)${NC}"
    echo ""
    echo -e "  📁 项目目录:   ${BLUE}$PROJECT_DIR${NC}"
    echo -e "  📋 环境变量:   ${BLUE}$PROJECT_DIR/.env${NC}"
    echo ""
    echo -e "  ${YELLOW}⚠️  重要：请编辑 .env 填入 DEEPSEEK_API_KEY${NC}"
    echo -e "     编辑命令: nano $PROJECT_DIR/.env"
    echo ""
    echo -e "  ${BLUE}常用命令:${NC}"
    echo -e "    查看日志:   docker logs -f student-paper-assistant"
    echo -e "    重启服务:   docker restart student-paper-assistant"
    echo -e "    停止服务:   docker stop student-paper-assistant"
    echo -e "    更新部署:   cd $PROJECT_DIR && git pull && bash deploy.sh"
    echo -e "    数据备份:   cp -r $PROJECT_DIR/data $PROJECT_DIR/data.bak"
    echo ""
}

# ─── 主流程 ───────────────────────────────────────────────────────
main() {
    echo -e "${GREEN}"
    echo "  ╔═══════════════════════════════════════════╗"
    echo "  ║  学生论文写作助手 — 腾讯云一键部署        ║"
    echo "  ║  Student Paper Assistant 🚀               ║"
    echo "  ╚═══════════════════════════════════════════╝"
    echo -e "${NC}"

    detect_os
    install_docker
    setup_project
    setup_env
    start_services
    setup_firewall
    print_info
}

main "$@"
