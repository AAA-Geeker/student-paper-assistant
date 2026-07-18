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
