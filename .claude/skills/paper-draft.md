---
name: paper-draft
description: 论文逐节起草 — 基于大纲逐节生成初稿，控制上下文窗口，标注不确定处
model: sonnet
---

# 论文逐节起草 Skill

## 目标
基于已确认的大纲，逐节生成论文初稿。每次聚焦一个章节，保持上下文连贯。

## 前置条件
- 大纲已确认并存入 WorkBuddy
- 已读取 [[researcher-profile]]、[[paper-style-guide]]、[[field-conventions]]

## 执行流程

### Step 1：定位当前写作位置
- 从 [[current-progress]] 和 WorkBuddy 数据库中读取当前论文状态
- 确定接下来要写哪一节
- 确认本节在大纲中的定位（属于哪个大章节的一部分）

### Step 2：收集上下文
只收集必要的上下文（控制 token 消耗）：
- 本节对应的大纲条目
- 前一节的最后一段（衔接用）
- 后一节的大纲条目（知道往哪个方向写）
- 引用需要出现的参考文献列表
- 论文的核心贡献声明（保持全文一致）

**不要** 传入全文——控制上下文在 2000 tokens 以内。

### Step 3：生成初稿
生成该节的完整内容，遵循 [[paper-style-guide]] 中的规范：
- 每段有明确主题句
- 段落之间有逻辑连接
- 术语使用正确且一致
- 引用格式正确

生成时特别关注：
- **导师反馈模式** 中的高频问题（见 [[advisor-feedback]]）
- Claim 必须有 citation 或 evidence
- 段落之间不能有逻辑断层

### Step 4：标注与写入
在初稿中标注：
- `[TODO: 需要引用]` — 需要补充文献的地方
- `[TODO: 需要数据]` — 需要填实验数据的地方
- `[不确定]` — 对内容的准确性不自信的地方

将生成的内容插入到论文的对应位置（通过 WorkBuddy API），更新 [[current-progress]]。

## 输出到 WorkBuddy
```
PUT /api/papers/{id}  →  {"content": "<更新后的完整内容>"}
```

## 模型使用策略
- Step 3（起草）：使用 DeepSeek 或 GPT-4o-mini（节省成本）
- 如果用户对初稿不满意：使用 GPT-4o 重新生成关键段落
