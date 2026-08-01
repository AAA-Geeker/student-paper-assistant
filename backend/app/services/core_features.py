"""
三大核心功能服务：
1. 降重 / 降 AIGC 改写
2. 投稿前审查（模拟审稿人报告）
3. 论文修改（导师/审稿意见处理）
4. 导师批注修改（PDF导入）
5. 审稿人修改（Response Letter + 修改）

隐藏AI细节，返回工作流节点状态和对比数据。
每个服务生成：
- workflow: 工作流节点状态
- original_text: 原文
- revised_text: 修改后文本
- comparison: 逐段对比数据
- result: 最终文本（向下兼容）
"""

from typing import Dict, Tuple, Optional, List
from sqlalchemy.orm import Session

from app.models.user import User
from app.services.ai import call_llm_with_config, de_ai_rewrite, de_ai_task, de_ai_review
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
from app.services.workflow_engine import create_workflow
from app.services.comparison_engine import compute_comparison
from app.services import dify_client


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


def _build_workflow_response(workflow_type: str, original_text: str, runner_result: Dict) -> Dict:
    """统一构建带工作流和对比数据的响应"""
    wf = create_workflow(workflow_type, original_text)
    revised_text = runner_result.get("result", runner_result.get("revised_text", ""))

    # 标记工作流节点完成状态
    for node in wf.nodes:
        node.status = "completed"

    # 生成对比数据
    comparison = compute_comparison(original_text, revised_text)

    result = {
        "workflow": wf.to_frontend(),
        "original_text": original_text,
        "revised_text": revised_text,
        "comparison": comparison.to_dict(),
        "result": revised_text,  # 向下兼容
    }
    # 合并原始结果中的额外字段
    for k, v in runner_result.items():
        if k not in result:
            result[k] = v

    return result


# ─── 1. 降重 / 降 AIGC 改写 ─────────────────────────────────────────

async def estimate_aigc_rewrite_cost(
    user: User, text: str, urgent: bool, db: Session
) -> Dict:
    return estimate_task_cost(user, "aigc_rewrite", len(text), urgent, db)


async def aigc_rewrite(
    text: str,
    target: str,
    platform: str,
    user: User,
    db: Session,
    urgent: bool = False,
    model: str = "deepseek",
) -> Dict:
    """降重/降 AIGC 改写。"""
    text_length = len(text)

    async def runner() -> Dict:
        # ── 去 AI 痕迹改写（生产可用）：强约束直连，非 AI 问答式 ──
        # 注：Dify 工作流因运行时变量解析 bug（{{#start.text#}} 取空）暂不可用，改走此直连实现。
        #     若日后修复 Dify，可切回 run_workflow_text("aigc_rewrite", {...}) 分支。
        out = await de_ai_rewrite(text, target=target, model=model, temperature=0.6)
        return {
            "type": "aigc_rewrite",
            "target": target,
            "platform": platform,
            "original_length": text_length,
            "result": out,
        }

    ok, res = await deduct_and_run(db, user, "aigc_rewrite", text_length, urgent, runner)
    if ok and isinstance(res, dict) and "result" in res:
        return _build_workflow_response("aigc_rewrite", text, res)
    return res


# ─── 2. 投稿前审查 ────────────────────────────────────────────────

async def estimate_pre_submission_review_cost(
    user: User, text: str, urgent: bool, db: Session
) -> Dict:
    return estimate_task_cost(user, "pre_submission_review", len(text), urgent, db)


async def pre_submission_review(
    text: str,
    venue: str,
    venue_type: str,
    user: User,
    db: Session,
    urgent: bool = False,
    model: str = "deepseek",
) -> Dict:
    """投稿前审稿人报告。"""
    text_length = len(text)

    async def runner() -> Dict:
        # ── 去 AI 痕迹审稿报告（生产可用）：资深审稿人语体，非 AI 问答式 ──
        # 注：Dify 工作流因运行时变量解析 bug 暂不可用，改走此直连实现。
        out = await de_ai_review(text, venue=venue, venue_type=venue_type, model=model)
        return {
            "type": "pre_submission_review",
            "venue": venue,
            "venue_type": venue_type,
            "original_length": text_length,
            "result": out,
        }

    ok, res = await deduct_and_run(db, user, "pre_submission_review", text_length, urgent, runner)
    if ok and isinstance(res, dict) and "result" in res:
        return _build_workflow_response("pre_review", text, res)
    return res


# ─── 3. 论文修改 ────────────────────────────────────────────────────

async def estimate_paper_revision_cost(
    user: User, text: str, feedback: str, urgent: bool, db: Session
) -> Dict:
    return estimate_task_cost(user, "paper_revision", len(text), urgent, db)


async def paper_revision(
    text: str,
    feedback: str,
    user: User,
    db: Session,
    style: str = "standard",
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
        # ── 去 AI 痕迹论文修改（生产可用）：非 AI 问答式 ──
        # 注：Dify 工作流因运行时变量解析 bug 暂不可用，改走此直连实现。
        style_desc = style_prompts.get(style, style_prompts['standard'])
        instruction = (
            f"请根据以下导师/审稿人反馈，对论文内容生成修改方案并改写。修改风格：{style_desc}。\n"
            "要求：先逐条解析反馈给出修改条目，再输出修改后的全文；保持学术性与数据结论不变，"
            "不新增未经验证的数据。请分三段书写：第一段「反馈解析」，第二段「修改后的全文」，"
            "第三段「修改说明」。段落标题用普通文字，不要使用任何符号或编号。"
        )
        content = f"反馈内容：\n{feedback}\n\n论文内容：\n{text}"
        out = await de_ai_task(instruction, content, model=model)
        return {
            "type": "paper_revision",
            "style": style,
            "original_length": text_length,
            "feedback_length": len(feedback),
            "result": out,
        }

    ok, res = await deduct_and_run(db, user, "paper_revision", text_length, urgent, runner)
    if ok and isinstance(res, dict) and "result" in res:
        return _build_workflow_response("paper_revision", text, res)
    return res


# ─── 4. 导师批注修改（PDF导入 — 模拟解析批注 + 修改） ────────────────

async def advisor_annotation_revision(
    original_text: str,
    annotations: str,
    user: User,
    db: Session,
    model: str = "deepseek",
) -> Dict:
    """
    导师批注修改功能。
    - original_text: 论文原文
    - annotations: 导师批注内容（从PDF提取或手动输入）
    """
    async def runner() -> Dict:
        # ── 去 AI 痕迹导师批注修改（生产可用）：非 AI 问答式 ──
        # 注：Dify 工作流因运行时变量解析 bug 暂不可用，改走此直连实现。
        instruction = (
            "请根据导师批注意见修改论文：先逐条解析批注，再针对每条批注修改原文对应位置，"
            "输出修改后的全文（未修改部分保持不变）与新旧对照。请分三段书写：第一段「批注解析」，"
            "第二段「修改后的全文」，第三段「修改说明」（每条写原句与改后句对照）。段落标题用普通文字，"
            "不要使用任何符号或编号。"
        )
        content = f"导师批注内容：\n{annotations}\n\n论文原文：\n{original_text}"
        out = await de_ai_task(instruction, content, model=model)
        return {"type": "advisor_revision", "result": out}

    ok, res = await deduct_and_run(db, user, "paper_revision", len(original_text) + len(annotations), False, runner)
    if ok and isinstance(res, dict) and "result" in res:
        return _build_workflow_response("advisor_revision", original_text, {**res, "revised_text": res.get("result", "")})
    return res


# ─── 5. 审稿人修改（Response Letter + 修改） ────────────────────────

async def reviewer_response_revision(
    original_text: str,
    reviewer_comments: str,
    user: User,
    db: Session,
    model: str = "deepseek",
) -> Dict:
    """
    审稿人修改功能：逐条回复审稿意见 + 修改论文。
    - original_text: 论文原文
    - reviewer_comments: 审稿人评审意见
    """
    async def runner() -> Dict:
        # ── 去 AI 痕迹审稿回复与修改（生产可用）：非 AI 问答式 ──
        # 注：Dify 工作流因运行时变量解析 bug 暂不可用，改走此直连实现。
        instruction = (
            "请针对每条审稿意见生成回复和对应修改。请分四段书写：第一段「逐条回复」，每条含审稿意见引用、"
            "你的回复（说明修改方式与位置）、修改后内容（如适用）；第二段「修改后的论文全文」，把"
            "审稿意见对应的修改应用到论文；第三段「修改对照」，逐条列出修改位置、原文与改后内容。"
            "段落标题用普通文字，不要使用任何符号、编号或表格。"
        )
        content = f"审稿人意见：\n{reviewer_comments}\n\n论文原文：\n{original_text}"
        out = await de_ai_task(instruction, content, model=model)
        return {"type": "reviewer_revision", "result": out}

    ok, res = await deduct_and_run(db, user, "paper_revision", len(original_text) + len(reviewer_comments), False, runner)
    if ok and isinstance(res, dict) and "result" in res:
        return _build_workflow_response("reviewer_revision", original_text, {**res, "revised_text": res.get("result", "")})
    return res


# ─── 辅助功能：按 token 计费 ───────────────────────────────────────

async def estimate_skill_usage_cost(model: str, input_text: str, output_text: str = "") -> float:
    in_tokens = estimate_tokens(input_text)
    out_tokens = estimate_tokens(output_text) if output_text else in_tokens
    return float(estimate_usd_cost(model, in_tokens, out_tokens))


# ─── 5. 答辩模拟 ──────────────────────────────────────────────────

async def defense_simulation(paper_text: str, user: User, db: Session, model: str = "deepseek") -> Dict:
    async def runner() -> Dict:
        prompt = f"""请根据以下论文内容，模拟答辩委员会提问。

论文内容：
{paper_text}

请生成：

## 答辩模拟报告

### 1. 论文亮点总结（3-5 点）
### 2. 可能被问到的问题（10-15 个，按可能性排序）
- 每个问题标注：难度、考察点、建议回答思路
### 3. 可能的致命问题（2-3 个）
### 4. 准备建议
- 需要提前准备的数据、图表、文献"""
        result = await call_llm_with_config(model, [
            {"role": "user", "content": prompt},
        ])
        return {"type": "defense_simulation", "original_length": len(paper_text), "result": result}

    return await deduct_and_run(db, user, "aigc_rewrite", len(paper_text), False, runner)


# ─── 6. 投稿格式预检 ─────────────────────────────────────────────

async def format_check(paper_text: str, venue: str, user: User, db: Session, model: str = "deepseek") -> Dict:
    async def runner() -> Dict:
        prompt = f"""请检查以下论文内容是否符合 {venue} 的格式要求。

论文内容：
{paper_text}

请按以下维度输出检查报告：

## 格式检查报告

### 1. 结构完整性
### 2. 引用格式
### 3. 图表与公式
### 4. 语言与排版
### 5. 问题清单"""
        result = await call_llm_with_config(model, [
            {"role": "user", "content": prompt},
        ])
        return {"type": "format_check", "venue": venue, "original_length": len(paper_text), "result": result}

    return await deduct_and_run(db, user, "aigc_rewrite", len(paper_text), False, runner)


# ─── 7. 改后复查 ─────────────────────────────────────────────────

async def revision_review(original_text: str, revised_text: str, feedback: str, user: User, db: Session, model: str = "deepseek") -> Dict:
    async def runner() -> Dict:
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
每条反馈意见 → 是否已修改 → 修改是否到位

### 2. 总体评价
- 修改完成度（百分比）
- 修改质量

### 3. 遗留问题"""
        result = await call_llm_with_config(model, [
            {"role": "user", "content": prompt},
        ])
        return {"type": "revision_review", "original_length": len(original_text), "revised_length": len(revised_text), "result": result}

    return await deduct_and_run(db, user, "aigc_rewrite", len(original_text) + len(revised_text), False, runner)


# ─── 8. 文献综述生成 ─────────────────────────────────────────────

async def literature_review(references: str, topic: str, user: User, db: Session, model: str = "deepseek") -> Dict:
    async def runner() -> Dict:
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
## 分类总结
## Research Gap 分析"""
        result = await call_llm_with_config(model, [
            {"role": "user", "content": prompt},
        ])
        return {"type": "literature_review", "topic": topic, "reference_count": len(references.strip().split('\n')), "result": result}

    return await deduct_and_run(db, user, "aigc_rewrite", len(references) + len(topic), False, runner)


# ─── 9. 中译英学术润色 ─────────────────────────────────────────

async def cn_to_en_translation(chinese_text: str, user: User, db: Session, model: str = "deepseek") -> Dict:
    async def runner() -> Dict:
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
## 翻译说明
- 术语对照表（中文 → 英文）
- 翻译难点说明（如有）"""
        result = await call_llm_with_config(model, [
            {"role": "user", "content": prompt},
        ])
        return {"type": "cn_to_en_translation", "original_length": len(chinese_text), "result": result}

    return await deduct_and_run(db, user, "aigc_rewrite", len(chinese_text), False, runner)
