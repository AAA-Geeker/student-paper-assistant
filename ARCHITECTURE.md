# 学生论文写作助手 — 完整架构设计

## 一、系统概览

```
┌─────────────────────────────────────────────────────────────────┐
│                        Hermes（编排层）                          │
│  Claude Code + Memory + Skills                                  │
│  ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │ Memory  │ │ Skills   │ │ Context  │ │ Quality  │           │
│  │ System  │ │ Engine   │ │ Manager  │ │ Reviewer │           │
│  └─────────┘ └──────────┘ └──────────┘ └──────────┘           │
│                          │                                       │
│                    API Calls (REST)                              │
└──────────────────────────┼──────────────────────────────────────┘
                           │
┌──────────────────────────┼──────────────────────────────────────┐
│               WorkBuddy Web App（执行层）                         │
│                          │                                       │
│  ┌──────────┐    ┌───────┴───────┐    ┌──────────────────┐     │
│  │ Frontend │◄──►│  FastAPI      │◄──►│ AI Service        │     │
│  │ (React)  │    │  Backend      │    │ (Multi-Model)     │     │
│  └──────────┘    └───────────────┘    └──────────────────┘     │
│                                               │                  │
│                          ┌────────────────────┼──────────────┐  │
│                          │ DeepSeek  │ GPT-4o │ Claude  │ ...│  │
│                          └────────────────────┴─────────┴────┘  │
└─────────────────────────────────────────────────────────────────┘
```

**核心设计原则**：Hermes 做"思考"（理解需求、编排步骤、质量判断），Web 工具做"执行"（调用 LLM、编辑文档、格式化导出）。

---

## 二、Skill 体系设计

### 六大核心 Skill

| # | Skill | 触发场景 | 步骤数 | 模型策略 |
|---|-------|---------|--------|---------|
| 1 | `paper-outline` | 选题确定后 | 5 步 | 便宜模型生成→高级模型审核 |
| 2 | `paper-draft` | 大纲确认后 | 4 步 | 逐节生成，上下文复用 |
| 3 | `paper-revise` | 收到导师/审稿意见 | 5 步 | 逐条对照修改 |
| 4 | `paper-polish` | 终稿打磨 | 4 步 | 分段润色，风格一致性检查 |
| 5 | `paper-review` | 投稿前自查 | 6 步 | 多维度并行审查 |
| 6 | `paper-defense` | 答辩准备 | 4 步 | 论文→PPT+Q&A |

### Skill 工作流详解

#### paper-outline（选题→大纲）
```
Step 1: 了解研究背景 → 读取 memory（研究方向、导师偏好）
Step 2: 文献头脑风暴 → 生成 3-5 个可写方向
Step 3: 用户确认方向 → 生成详细大纲（3 级标题）
Step 4: 大纲质量审查 → 检查逻辑链、可行性
Step 5: 输出大纲 + 每节写作要点（写入 DB）
```
**省钱策略**：Step 2 用 DeepSeek；Step 4 才用 GPT-4o。

#### paper-draft（逐节起草）
```
Step 1: 确定本节定位 → 读取大纲该节 + 前后节衔接
Step 2: 生成论点+论据 → 结合参考文献要点
Step 3: 初稿生成 → 控制质量，标注不确定处
Step 4: 写入 DB → 用户可在编辑器查看/修改
```
**省钱策略**：只传当前节上下文，不传全文。

#### paper-revise（修改）
```
Step 1: 解析导师意见 → 提取每条具体修改点
Step 2: 逐条定位原文 → 找到需修改的段落
Step 3: 生成修改方案 → 每条意见 2-3 个方案
Step 4: 用户选择/确认 → 应用修改
Step 5: 生成修改说明 → 逐条记录做了什么改动
```
**省钱策略**：只传被修改段落+前后各一段，不传全文。

#### paper-polish（润色）
```
Step 1: 分析全文风格 → 检测术语一致性、句式多样性
Step 2: 分段润色 → 逐段 polish + 保持术语统一
Step 3: 全局一致性检查 → 交叉验证所有段落的术语/风格
Step 4: 输出润色版 + 修改对照
```

#### paper-review（投稿前审查）
```
Step 1: 结构审查 → 逻辑链是否完整
Step 2: 论证审查 → 每个论点是否有支撑
Step 3: 格式审查 → 引用格式、图表编号
Step 4: 语言审查 → 错别字、语法、学术规范
Step 5: 创新点审查 → 是否有足够的贡献声明
Step 6: 生成审查报告 → 分级问题清单
```
**省钱策略**：Steps 1-5 可并行执行，每个只传大纲+关键段落。

#### paper-defense（答辩准备）
```
Step 1: 提取核心贡献 → 从论文抽取 3-5 个创新点
Step 2: 生成 PPT 大纲 → 15-20 页结构
Step 3: 预判问题列表 → 方法论/创新性/局限性各 5 题
Step 4: 生成 Q&A 要点 → 每题的回答框架
```

---

## 三、Memory 系统设计

### 五类持久化记忆

```
~/.claude/projects/D--WorkBuddy-student-paper-assistant/memory/
├── MEMORY.md                  # 索引文件（加载到每次对话上下文）
├── researcher-profile.md      # 研究者画像
├── paper-style-guide.md       # 写作风格指南
├── current-progress.md        # 当前进度追踪
├── advisor-feedback.md        # 导师反馈历史
└── field-conventions.md       # 学科领域规范
```

### 记忆更新策略
- **researcher-profile**：低频更新（每学期一次）
- **paper-style-guide**：中频更新（每次写作后记录偏好）
- **current-progress**：高频更新（每次写完一节后更新）
- **advisor-feedback**：中频更新（每次收到反馈后追加）
- **field-conventions**：低频更新（遇到新规范时补充）

---

## 四、多模型路由策略

### 模型分层使用

| 层级 | 模型 | 适用场景 | 成本 |
|------|------|---------|------|
| L1-廉价 | DeepSeek-V3 | 大纲生成、初稿起草、摘要 | ¥0.001/1K tokens |
| L2-中等 | GPT-4o-mini | 润色、续写、格式化 | ¥0.002/1K tokens |
| L3-高级 | GPT-4o / Claude | 质量审查、关键段落、答辩准备 | ¥0.03/1K tokens |

### 路由规则
```python
ROUTING_RULES = {
    "outline": {"model": "deepseek-chat", "max_tokens": 2000},
    "draft": {"model": "deepseek-chat", "max_tokens": 4000},
    "polish": {"model": "gpt-4o-mini", "max_tokens": 2000},
    "revise": {"model": "gpt-4o-mini", "max_tokens": 3000},
    "review": {"model": "gpt-4o", "max_tokens": 2000},
    "abstract": {"model": "deepseek-chat", "max_tokens": 500},
    "defense_qa": {"model": "gpt-4o", "max_tokens": 2000},
}
```

### 上下文窗口管理
- **全文**（8000+ tokens）：仅在润色收尾和答辩准备时使用
- **章节+前后衔接**（2000 tokens）：起草和修改时使用
- **大纲+关键句**（500 tokens）：审查时使用
- **段落级**（300 tokens）：逐段润色时使用

---

## 五、Hermes ↔ WorkBuddy 交互协议

### Hermes 调 WorkBuddy API

Hermes 通过 HTTP 直接调用后端 API（或通过 Claude Code 的 Bash 工具调用 curl）：

```bash
# 获取论文内容
curl http://localhost:8000/api/papers/{id} -H "Authorization: Bearer $TOKEN"

# 写入 AI 生成的内容
curl -X PUT http://localhost:8000/api/papers/{id} \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"content": "...", "outline": "..."}'

# 触发 AI 生成（后端执行→返回结果→写入 DB）
curl -X POST http://localhost:8000/api/ai/skill-execute \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"skill": "paper-outline", "paper_id": 1, "params": {...}}'
```

### 交互流程

```
用户: "帮我给这篇论文生成大纲"
  ↓
Hermes: 读取 memory → 了解研究方向
  ↓
Hermes: 调用 paper-outline skill 定义
  ↓
Hermes: 调用 WorkBuddy API → 后端用 DeepSeek 生成大纲
  ↓
Hermes: 审查大纲质量 → 如果不满意，重新生成
  ↓
Hermes: 写入 DB → 通知用户查看
  ↓
用户: 在 Web 编辑器看到大纲，修改/确认
  ↓
用户: "大纲不错，开始写第一节"
  ↓
Hermes: 读取 current-progress → 知道当前进度
  ↓
Hermes: 调用 paper-draft skill → 逐节生成...
```

---

## 六、后端 AI 服务重构设计

### 新增模块

```
backend/app/services/
├── __init__.py
├── ai.py              # 重构：多模型路由 + prompt 模板
├── skill_executor.py  # 新增：Skill 执行引擎
├── context_manager.py # 新增：上下文窗口管理
└── model_router.py    # 新增：模型选择与 fallback
```

### 新增 API 端点

```
POST /api/ai/skill/execute     # 执行一个 skill 的完整流程
POST /api/ai/skill/step        # 执行 skill 的单步（用于人在回路）
POST /api/ai/chat              # 多轮对话（带上下文管理）
GET  /api/ai/models            # 列出可用模型及价格
POST /api/ai/estimate-tokens   # 估算 token 用量
```

---

## 七、额度优化策略总结

| 策略 | 节省比例 | 实现难度 |
|------|---------|---------|
| 多模型分层路由 | 60-80% | 中 |
| 上下文窗口裁剪 | 40-60% | 低 |
| Prompt 模板缓存 | 10-20% | 低 |
| 并行 + 去重 | 20-30% | 中 |
| 增量而非全文 | 50-70% | 低 |
| 本地预处理（格式/统计） | 5-10% | 低 |
| **综合** | **80-90%** | — |

---

## 八、实施路线图

- **Phase 1**（当前）：Memory 文件 + Skill 定义 + 架构文档
- **Phase 2**：后端 AI 服务重构（多模型路由、上下文管理、skill 执行引擎）
- **Phase 3**：前端改造（skill 选择器、对话面板）
- **Phase 4**：测试 + 调优 + 真实场景验证
