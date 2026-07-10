---
name: paper-review
description: 投稿前审查 — 多维度并行审查论文质量，生成分级问题清单和改进建议
model: opus
---

# 论文投稿前审查 Skill

## 目标
模仿审稿人视角，对论文进行全面的投稿前自查，找出逻辑、论证、格式、语言等各方面的问题。

## 前置条件
- 论文已完成（在 WorkBuddy 中）
- 已读取 [[paper-style-guide]]、[[field-conventions]]、[[advisor-feedback]]
- 已确定目标期刊/会议

## 执行流程

### Step 1：结构审查（Structure Review）
检查论文的宏观结构：
- [ ] Introduction → Related Work → Method → Experiments → Conclusion 逻辑链完整吗？
- [ ] 各节的篇幅比例是否合理？
- [ ] Introduction 是否包含：背景 → 问题 → 现有不足 → 我们的方法 → 贡献？
- [ ] 贡献列表是否具体（而非泛泛的"我们提出了 X"）？

### Step 2：论证审查（Argument Review）—— 并行
对论文核心论证进行检查：
- [ ] 每个 claim 是否有足够的证据（引用或实验数据）？
- [ ] 方法的 motivation 是否充分？
- [ ] 实验设计是否能支持结论？
- [ ] 有没有 overclaiming（过度宣称贡献）？
- [ ] 局限性是否被诚实讨论？

### Step 3：对比审查（Comparison Review）—— 并行
检查与现有工作的对比：
- [ ] 是否覆盖了所有 SOTA 方法？
- [ ] 基线选择是否有理由说明？
- [ ] 消融实验是否拆解了每个模块的贡献？
- [ ] 是否讨论了为什么自己的方法更好（而非只说"更好"）？

### Step 4：格式审查（Format Review）—— 并行
- [ ] 引用格式是否一致？
- [ ] 图表编号是否连续？
- [ ] 所有图表是否在正文中被引用？
- [ ] 术语缩写是否在首次出现时展开？
- [ ] 页数是否在期刊限制内？

### Step 5：语言审查（Language Review）—— 并行
- [ ] 错别字、语法错误
- [ ] 学术表达的规范性
- [ ] 时态一致性（英文）
- [ ] 术语一致性

### Step 6：综合报告
汇总所有维度的审查结果，生成分级报告：
- 🔴 **Critical**：会影响论文接收的问题（逻辑链断裂、主要 claim 无证据）
- 🟡 **Major**：需要修改但可控的问题（对比不充分、消融实验缺失）
- 🟢 **Minor**：建议修改的问题（措辞、格式）
- 💡 **Suggestion**：锦上添花的建议

对每个问题给出具体的修改建议和修改位置。

## 输出格式
生成审查报告 Markdown 文件，并通过 WorkBuddy API 存储。

## 模型使用策略（省钱关键！）
- Steps 1-5 可以**并行执行**，每个维度只传大纲 + 相关段落（而非全文）
- Step 1（结构）：GPT-4o-mini（传大纲即可）
- Step 2（论证）：GPT-4o（需要深度推理）
- Step 3（对比）：GPT-4o-mini（传实验章节）
- Step 4（格式）：本地脚本检查（不消耗 token）
- Step 5（语言）：DeepSeek 即可
- Step 6（综合）：本地汇总 + GPT-4o-mini 生成报告
