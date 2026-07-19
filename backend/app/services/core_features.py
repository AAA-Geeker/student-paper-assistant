"""
三大核心功能服务：
1. 降重 / 降 AIGC 改写
2. 投稿前审查（模拟审稿人报告）
3. 论文修改（导师/审稿意见处理）

每个服务都：
- 先估算价格（让用户确认）
- 扣费后再执行
- 返回结构化结果
"""

from typing import Dict, Tuple
from sqlalchemy.orm import Session

from app.models.user import User
from app.services.ai import call_llm_with_config
from app.services.credits import (
    calculate_core_cost,
    has_free_core_today,
    consume_credits,
    get_subscription_info,
    estimate_usd_cost,
    CORE_PRICING,
)
from app.services.model_router import estimate_tokens
from app.services.commerce import get_plan_discount


# ─── 公共：先估算，后执行 ───────────────────────────────────────────

def estimate_task_cost(user: User, scene: str, text_length: int, urgent: bool, db: Session) -> Dict:
    """估算任务点数消耗。"""
    discount = get_plan_discount(user)
    free = has_free_core_today(user, scene, db)
    if free:
        return {
            "scene": scene,
            "scene_name": CORE_PRICING[scene]["description"],
            "points": 0,
            "is_free": True,
            "discount": 100,
            "urgent": urgent,
            "subscription": get_subscription_info(user),
        }

    cost = calculate_core_cost(scene, text_length, urgent=urgent, discount_percent=discount)
    return {
        "scene": scene,
        "scene_name": CORE_PRICING[scene]["description"],
        "points": float(cost),
        "is_free": False,
        "discount": discount,
        "urgent": urgent,
        "subscription": get_subscription_info(user),
    }


async def deduct_and_run(
    db: Session,
    user: User,
    scene: str,
    text_length: int,
    urgent: bool,
    runner,
) -> Tuple[bool, Dict]:
    """
    统一流程：检查免费/折扣 -> 扣费 -> 执行。
    Returns (success, result)
    """
    free = has_free_core_today(user, scene, db)
    if not free:
        discount = get_plan_discount(user)
        cost = calculate_core_cost(scene, text_length, urgent=urgent, discount_percent=discount)
        ok, _ = consume_credits(db, user, scene, cost, CORE_PRICING[scene]["description"])
        if not ok:
            return False, {"detail": "点数不足，请先充值"}

    result = await runner()
    return True, result


# ─── 1. 降重 / 降 AIGC 改写 ─────────────────────────────────────────

async def estimate_aigc_rewrite_cost(
    user: User, text: str, urgent: bool, db: Session
) -> Dict:
    return estimate_task_cost(user, "aigc_rewrite", len(text), urgent, db)


async def aigc_rewrite(
    text: str,
    target: str,  # "plagiarism" | "aigc" | "both"
    platform: str,  # 知网/维普/万方/Turnitin/GPTZero/格子达
    user: User,
    db: Session,
    urgent: bool = False,
    model: str = "deepseek",
) -> Dict:
    """降重/降 AIGC 改写。"""
    text_length = len(text)

    async def runner() -> Dict:
        system = "你是一位学术写作专家，擅长在保持原意和学术严谨性的前提下改写中文论文。"
        prompt = f"""请对以下论文内容进行改写，目标是降低重复率和/或降低 AIGC 检测率。

检测平台：{platform}
改写目标：{"降重" if target == "plagiarism" else "降 AIGC" if target == "aigc" else "同时降重与降 AIGC"}

要求：
1. 保持原意、数据、结论不变
2. 调整句式结构，替换同义词，拆分/合并长句
3. 保留所有专业术语，但改变表达形式
4. 对改写后的关键段落，给出"预估重复率"和"预估 AIGC 率"（高/中/低）
5. 输出格式：先给出改写后的全文，再给出修改说明

原文：
{text}"""
        result = await call_llm_with_config(model, [
            {"role": "system", "content": system},
            {"role": "user", "content": prompt},
        ])
        return {
            "type": "aigc_rewrite",
            "target": target,
            "platform": platform,
            "original_length": text_length,
            "result": result,
        }

    ok, res = await deduct_and_run(db, user, "aigc_rewrite", text_length, urgent, runner)
    return res


# ─── 2. 投稿前审查 ────────────────────────────────────────────────

async def estimate_pre_submission_review_cost(
    user: User, text: str, urgent: bool, db: Session
) -> Dict:
    return estimate_task_cost(user, "pre_submission_review", len(text), urgent, db)


async def pre_submission_review(
    text: str,
    venue: str,  # 目标会议/期刊，如 ACL/EMNLP/SCI 一区
    venue_type: str,  # conference | journal
    user: User,
    db: Session,
    urgent: bool = False,
    model: str = "deepseek",
) -> Dict:
    """投稿前审稿人报告。"""
    text_length = len(text)

    async def runner() -> Dict:
        system = "你是一位顶级会议/期刊的资深审稿人，熟悉 ACL/EMNLP/SCI 等审稿标准。"
        prompt = f"""请对以下论文进行投稿前审查，模拟 {venue} ({venue_type}) 审稿人视角。

请按以下维度输出审稿报告：

## 1. 总体评价
- 贡献度（1-5 分）
- 创新性（1-5 分）
- 写作质量（1-5 分）
- 推荐意见：Accept / Weak Accept / Borderline / Reject

## 2. 结构审查
- Introduction 的故事线是否完整
- Method 是否清晰可复现
- Experiments 是否充分
- Conclusion 是否准确

## 3. 论证审查
- 每个 claim 是否有证据支撑
- 是否存在 overclaiming
- 基线选择和消融实验是否充分

## 4. 语言与格式
- 术语一致性
- 引用格式
- 语法问题

## 5. 修改优先级清单
- 🔴 Critical（必须改）
- 🟡 Major（建议改）
- 🟢 Minor（可优化）

论文内容：
{text}"""
        result = await call_llm_with_config(model, [
            {"role": "system", "content": system},
            {"role": "user", "content": prompt},
        ])
        return {
            "type": "pre_submission_review",
            "venue": venue,
            "venue_type": venue_type,
            "original_length": text_length,
            "result": result,
        }

    ok, res = await deduct_and_run(db, user, "pre_submission_review", text_length, urgent, runner)
    return res


# ─── 3. 论文修改 ────────────────────────────────────────────────────

async def estimate_paper_revision_cost(
    user: User, text: str, feedback: str, urgent: bool, db: Session
) -> Dict:
    # 论文修改费用以论文内容长度为主，反馈不计入字数
    return estimate_task_cost(user, "paper_revision", len(text), urgent, db)


async def paper_revision(
    text: str,
    feedback: str,
    style: str,  # minimal / standard / deep
    user: User,
    db: Session,
    urgent: bool = False,
    model: str = "deepseek",
) -> Dict:
    """根据导师/审稿意见生成修改方案并改写。"""
    text_length = len(text)

    style_prompts = {
        "minimal": "最小改动：只修改反馈中明确指出的问题，尽量保持原文结构。",
        "standard": "标准改写：针对每条反馈重写相关段落，提升表达质量。",
        "deep": "深度重构：必要时调整段落结构、补充论证、重新组织内容。",
    }

    async def runner() -> Dict:
        system = "你是一位资深学术导师，正在根据反馈帮助学生修改论文。"
        prompt = f"""请根据以下导师/审稿人反馈，对论文内容生成修改方案并改写。

修改风格：{style_prompts.get(style, style_prompts['standard'])}

反馈内容：
{feedback}

论文内容：
{text}

要求：
1. 先逐条解析反馈，给出修改条目（类型、影响范围、紧急程度）
2. 再给出修改后的全文
3. 对每处修改用【修改点 N】标注在原文位置附近
4. 保持学术性和数据结论不变
5. 不要添加新的未经验证的数据

输出格式：
## 反馈解析
## 修改后的全文
## 修改说明"""
        result = await call_llm_with_config(model, [
            {"role": "system", "content": system},
            {"role": "user", "content": prompt},
        ])
        return {
            "type": "paper_revision",
            "style": style,
            "original_length": text_length,
            "feedback_length": len(feedback),
            "result": result,
        }

    ok, res = await deduct_and_run(db, user, "paper_revision", text_length, urgent, runner)
    return res


# ─── 辅助功能：按 token 计费 ───────────────────────────────────────

async def estimate_skill_usage_cost(model: str, input_text: str, output_text: str = "") -> float:
    """估算辅助功能（skill）的点数消耗。"""
    in_tokens = estimate_tokens(input_text)
    out_tokens = estimate_tokens(output_text) if output_text else in_tokens
    return float(estimate_usd_cost(model, in_tokens, out_tokens))


# ─── 5. 答辩模拟 ──────────────────────────────────────────────────

async def defense_simulation(
    paper_text: str,
    user: User,
    db: Session,
    model: str = "deepseek",
) -> Dict:
    """模拟答辩委员会提问，帮助用户准备答辩。"""
    async def runner() -> Dict:
        system = "你是一位资深论文答辩委员会成员，熟悉本科/硕士/博士学位论文答辩流程。"
        prompt = f"""请根据以下论文内容，模拟答辩委员会提问。

论文内容：
{paper_text}

请生成：

## 答辩模拟报告

### 1. 论文亮点总结（3-5 点）
### 2. 可能被问到的问题（10-15 个，按可能性排序）
- 每个问题标注：难度（⭐/⭐⭐/⭐⭐⭐）、考察点、建议回答思路
### 3. 可能的致命问题（2-3 个）
- 如果回答不好可能直接影响答辩结果的问题
### 4. 准备建议
- 需要提前准备的数据、图表、文献
"""
        result = await call_llm_with_config(model, [
            {"role": "system", "content": system},
            {"role": "user", "content": prompt},
        ])
        return {
            "type": "defense_simulation",
            "original_length": len(paper_text),
            "result": result,
        }

    return await deduct_and_run(db, user, "aigc_rewrite", len(paper_text), False, runner)


# ─── 6. 投稿格式预检 ─────────────────────────────────────────────

async def format_check(
    paper_text: str,
    venue: str,  # ACL / IEEE / CSSCI 等
    user: User,
    db: Session,
    model: str = "deepseek",
) -> Dict:
    """检查论文格式是否符合目标期刊/会议要求。"""
    async def runner() -> Dict:
        system = "你是一位学术期刊/会议格式审查专家。"
        prompt = f"""请检查以下论文内容是否符合 {venue} 的格式要求。

论文内容：
{paper_text}

请按以下维度输出检查报告：

## 格式检查报告

### 1. 结构完整性
- 是否包含标准章节（摘要、Introduction、方法、实验、结论）
- 章节顺序是否合理

### 2. 引用格式
- 引用格式是否一致
- 是否缺失参考文献

### 3. 图表与公式
- 图表编号是否连续
- 公式格式是否规范

### 4. 语言与排版
- 标题层级是否正确
- 段落缩进、行距等

### 5. 问题清单
- 🔴 必须修改
- 🟡 建议修改
- 🟢 可优化
"""
        result = await call_llm_with_config(model, [
            {"role": "system", "content": system},
            {"role": "user", "content": prompt},
        ])
        return {
            "type": "format_check",
            "venue": venue,
            "original_length": len(paper_text),
            "result": result,
        }

    return await deduct_and_run(db, user, "aigc_rewrite", len(paper_text), False, runner)


# ─── 7. 改后复查 ─────────────────────────────────────────────────

async def revision_review(
    original_text: str,
    revised_text: str,
    feedback: str,
    user: User,
    db: Session,
    model: str = "deepseek",
) -> Dict:
    """修改完成后，AI 对照反馈意见判断是否达标。"""
    async def runner() -> Dict:
        system = "你是一位严谨的学术导师，检查学生是否已经按反馈意见修改到位。"
        prompt = f"""请对照反馈意见，检查修改是否到位。

## 反馈意见
{feedback}

## 修改前原文
{original_text}

## 修改后版本
{revised_text}

请输出复查报告：

## 复查报告

### 1. 逐条反馈对照
每条反馈意见 → 是否已修改 → 修改是否到位（✅ 达标 / ⚠️ 部分达标 / ❌ 未修改）

### 2. 总体评价
- 修改完成度（百分比）
- 修改质量（优/良/中/差）

### 3. 遗留问题
- 仍然存在的问题或可以继续改进的点
"""
        result = await call_llm_with_config(model, [
            {"role": "system", "content": system},
            {"role": "user", "content": prompt},
        ])
        return {
            "type": "revision_review",
            "original_length": len(original_text),
            "revised_length": len(revised_text),
            "result": result,
        }

    return await deduct_and_run(db, user, "aigc_rewrite", len(original_text) + len(revised_text), False, runner)


# ─── 8. 文献综述生成 ─────────────────────────────────────────────

async def literature_review(
    references: str,  # 文献标题/摘要列表，每行一篇
    topic: str,       # 主题
    user: User,
    db: Session,
    model: str = "deepseek",
) -> Dict:
    """输入 5-10 篇文献标题/摘要，AI 生成综述段落。"""
    async def runner() -> Dict:
        system = "你是一位学术文献综述专家，擅长归纳和对比相关研究工作。"
        prompt = f"""请根据以下文献信息，生成一段学术文献综述。

主题：{topic}

文献：
{references}

要求：
1. 按主题/方法分类组织（不要逐篇总结）
2. 指出各类方法的优劣势和适用场景
3. 识别 research gap
4. 说明你的工作如何填补该 gap（如果有）
5. 引用格式用 [1], [2] 等标注

请输出：

## 文献综述
（学术风格，500-1000 字）

## 分类总结
（表格形式：类别 | 代表工作 | 方法特点 | 局限性）

## Research Gap 分析
"""
        result = await call_llm_with_config(model, [
            {"role": "system", "content": system},
            {"role": "user", "content": prompt},
        ])
        return {
            "type": "literature_review",
            "topic": topic,
            "reference_count": len(references.strip().split('\n')),
            "result": result,
        }

    return await deduct_and_run(db, user, "aigc_rewrite", len(references) + len(topic), False, runner)


# ─── 9. 中译英学术润色 ─────────────────────────────────────────

async def cn_to_en_translation(
    chinese_text: str,
    user: User,
    db: Session,
    model: str = "deepseek",
) -> Dict:
    """中文论文翻译为学术英文，保留术语和风格。"""
    async def runner() -> Dict:
        system = "你是一位中英学术翻译专家，擅长将中文论文翻译为地道的学术英文。"
        prompt = f"""请将以下中文论文内容翻译为学术英文。

中文原文：
{chinese_text}

要求：
1. 翻译为地道的学术英语
2. 保留所有专业术语（首次出现时标注中文对照）
3. 不改变原意、数据、结论
4. 保持学术严谨风格
5. 使用标准学术英语表达

请输出：

## English Translation
（全文英文翻译）

## 翻译说明
- 术语对照表（中文 → 英文）
- 翻译难点说明（如有）
"""
        result = await call_llm_with_config(model, [
            {"role": "system", "content": system},
            {"role": "user", "content": prompt},
        ])
        return {
            "type": "cn_to_en_translation",
            "original_length": len(chinese_text),
            "result": result,
        }

    return await deduct_and_run(db, user, "aigc_rewrite", len(chinese_text), False, runner)
