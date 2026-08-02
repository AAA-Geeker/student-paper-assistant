# 学生论文写作助手

基于 FastAPI + React 的学生论文写作辅助工具（SaaS），覆盖论文写作全流程：降重降 AIGC、投稿前审查、论文修改、导师批注处理、审稿人回复，以及答辩模拟等辅助功能。已部署上线，开箱即用。

## 🌐 在线访问

**线上地址：http://82.156.208.86**

> 注册即可体验，注册赠送 1000 点免费额度。注册需邮箱验证码验证真实邮箱。

---

## ✨ 功能清单

### 核心功能

| 功能 | 说明 | 入口 |
|------|------|------|
| 🎯 **降重 / 降 AIGC** | 粘贴查重报告标红段落或 AIGC 检测过高段落，一键改写。保留原意与专业术语，去 AI 痕迹（无逻辑词、无模板句），输出像人写的自然学术文本。支持知网、维普、万方、Turnitin、GPTZero、格子达等平台风格匹配。含**逐句对照**查看改动。 | `/aigc` |
| 🔍 **投稿前审查** | 模拟 ACL/SCI/CSSCI 等期刊审稿人，从结构、论证、实验、语言四个维度审查论文，提前发现致命问题。 | `/review` |
| ✏️ **论文修改** | 把原文和导师/审稿反馈意见粘贴进来，逐条解析每条意见，提供最小改动、标准改写、深度重构三种力度。 | `/revision` |
| 👨🏫 **导师批注修改** | 导入含批注的 PDF 或粘贴导师意见，自动解析批注，逐条生成修改方案。 | `/advisor-revision` |
| 🔬 **审稿人修改** | 模拟审稿人视角逐条回复，生成 Response Letter 与修改对照表。 | `/reviewer-revision` |

### 辅助功能

| 功能 | 说明 | 入口 |
|------|------|------|
| 🎤 答辩模拟 | 粘贴论文全文，模拟答辩现场问答 | `/aux/defense-simulation` |
| 📐 投稿格式预检 | 检查论文是否符合目标期刊格式要求 | `/aux/format-check` |
| 🔄 改后复查 | 修改后再审一遍，确认问题是否解决 | `/aux/revision-review` |
| 📚 文献综述 | 围绕主题生成文献综述草稿 | `/aux/literature-review` |
| 🌐 中译英 | 学术中文翻译成英文 | `/aux/cn-to-en` |

### 平台能力

- **账号与安全**：邮箱注册（**163 SMTP 验证码验证真实邮箱，防虚假注册**）、JWT 登录、密码加密存储
- **信用点体系**：注册送 1000 点，按功能/字数计费，含充值套餐、订阅套餐（Pro/Premium）、余额不足提醒
- **结果导出**：改写/审查/修改结果可导出 **Markdown / Word / PDF**（PDF 用 fpdf2 + 中文字体，Linux 与 Windows 均可正常渲染中文）
- **写作编辑器**：Markdown 论文编辑器，支持大纲、分段起草、AI 辅助工具栏
- **论文管理**：工作台管理多篇论文
- **AI 去痕迹**：核心生成功能后端直连 DeepSeek，SYSTEM 强约束禁 Markdown 符号 / 元话语，保留数据，生成自然学术语体
- **UI**：全站 shadcn/ui，支持**暗色模式**切换，移动端适配

---

## 技术栈

- **后端**：Python 3.11 + FastAPI + SQLAlchemy + PostgreSQL（生产）/ SQLite（本地开发）
- **前端**：React 18 + Vite + Tailwind CSS + TypeScript + shadcn/ui
- **AI**：DeepSeek API（`deepseek-chat`）
- **部署**：Docker + Docker Compose + Nginx（腾讯云 CVM）
- **邮件**：163 SMTP（注册邮箱验证码）

---

## 本地开发

### 1. 后端

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

后端运行在 `http://localhost:8000`，API 文档在 `http://localhost:8000/docs`。

### 2. 前端

```bash
cd frontend
npm install
npm run dev
```

前端开发服务器运行在 `http://localhost:5173`。

### 3. 邮箱验证配置（本地）

注册需邮箱验证码，需配置 SMTP（163 邮箱 + 授权码），写入 `backend/.env`：

```
EMAIL_SMTP_ENABLED=true
EMAIL_SMTP_HOST=smtp.163.com
EMAIL_SMTP_PORT=465
EMAIL_SMTP_USER=你的163邮箱
EMAIL_SMTP_PASSWORD=你的授权码    # 非登录密码，163 网页版 POP3/SMTP/IMAP 生成
EMAIL_FROM=你的163邮箱
```

未配置 SMTP 时，发送验证码接口会提示"邮箱服务未配置"。

### 测试

```bash
cd backend
pytest
```

---

## 生产部署（腾讯云）

1. 准备腾讯云服务器（Ubuntu，2核4G 起步），安装 Docker 与 Docker Compose。
2. 上传项目代码到服务器。
3. 创建 `.env`，填写 `POSTGRES_PASSWORD`、`SECRET_KEY`、`LLM_API_KEY`、`DEEPSEEK_API_KEY` 及 `EMAIL_SMTP_*`。
4. 构建并运行：

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

5. 访问服务器公网 IP。

### 生产注意事项

- 生产务必修改 `SECRET_KEY` 与 `POSTGRES_PASSWORD`。
- 服务器用 Docker 多容器栈（db + backend + frontend + nginx），`email_verifications`、`users` 等表由后端启动时自动创建。
- 后端镜像构建已使用腾讯内网 pip/apt 镜像加速。
