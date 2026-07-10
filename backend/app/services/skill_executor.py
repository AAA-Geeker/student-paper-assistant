"""
Skill 执行引擎——编排多步骤工作流，管理模型选择、上下文裁剪、结果组装。

每个 skill 的执行流程定义在此。引擎负责：
  1. 接收 skill 名称 + 参数
  2. 按步骤执行（每步可能用不同模型）
  3. 管理中间结果
  4. 返回最终结果 + 执行摘要（含 token 估算）
"""

import json
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple, Callable, Awaitable

from .model_router import route_model, get_model_config, estimate_tokens, estimate_cost
from .context_manager import get_context_for_skill
from .ai import call_llm_with_config


@dataclass
class SkillStep:
    name: str
    description: str
    skill: str
    step: str
    prompt_template: str  # 支持 {title}, {content}, {outline}, {extra} 等占位符


@dataclass
class SkillResult:
    success: bool
    skill: str
    steps_completed: List[str]
    output: str
    estimated_cost: float = 0.0
    estimated_tokens: int = 0
    warnings: List[str] = field(default_factory=list)


# ─── 内置 Skill 定义 ──────────────────────────────────────────────

BUILTIN_SKILLS: Dict[str, List[SkillStep]] = {
    "paper-outline": [
        SkillStep(
            name="生成大纲",
            description="基于题目和要求生成详细大纲",
            skill="outline", step="generate",
            prompt_template="""你是一位资深学术导师，正在指导一名研究生撰写论文。

论文题目：《{title}》
补充要求：{extra}

请生成一份详细的论文大纲，要求：
1. 使用 3 级标题结构（1 → 1.1 → 1.1.1）
2. 每个一级章节下面标注【写作要点】：该节要解决什么问题
3. 逻辑链要完整：问题 → 现有不足 → 我们的方法 → 实验验证 → 结论
4. 参考 ACL/EMNLP 论文的标准结构

特别关注：
- Introduction 要有一个"钩子"来抓住读者
- 贡献列表要具体（3-4 点），每点说明带来了什么 insight
- 实验章节要包含主实验、消融实验、案例分析""",
        ),
        SkillStep(
            name="审查大纲",
            description="检查大纲的逻辑完整性和可行性",
            skill="outline", step="review",
            prompt_template="""你是一位严格的论文审稿人。请审查以下论文大纲，找出潜在问题：

论文题目：《{title}》
大纲：
{outline}

对照以下清单逐项检查：
1. 逻辑链是否完整？（问题 → 方法 → 验证 → 结论）
2. 每节是否有明确的写作目标？
3. 贡献是否清晰可辨识？（不要泛泛地说"提出了 X"）
4. 结构是否符合 ACL/EMNLP 标准？
5. 章节篇幅分配是否合理？

请输出：
- ✅ 做得好的地方
- ⚠️ 需要改进的地方
- 🔴 严重问题（如有）
- 💡 改进建议""",
        ),
    ],

    "paper-revise": [
        SkillStep(
            name="解析反馈",
            description="将导师/审稿人反馈拆解为可操作条目",
            skill="revise", step="parse",
            prompt_template="""请将以下导师/审稿人的反馈意见，拆解为具体的、可操作的修改条目。

反馈内容：
{extra}

对于每条反馈，请标注：
- 类型：结构 / 论证 / 写作 / 格式
- 影响范围：单段 / 单节 / 全文
- 紧急程度：🔴必须改 / 🟡建议改 / 🟢可选

请用 JSON 格式输出（每项一个对象）：
```json
[
  {{"id": 1, "type": "论证", "scope": "单段", "urgency": "必须改",
    "original_text": "...", "parsed_requirement": "...", "suggested_action": "..."}}
]
```""",
        ),
        SkillStep(
            name="生成修改方案",
            description="对每条反馈生成 2-3 个可选修改方案",
            skill="revise", step="generate_plan",
            prompt_template="""基于以下论文内容和解析后的反馈，为每条反馈生成修改方案。

论文内容（相关段落）：
{content}

解析后的反馈：
{extra}

对每条反馈生成 2-3 个修改方案：
- 方案 A（最小改动）：只改必须改的地方
- 方案 B（中等改动）：重写相关段落
- 方案 C（深度改动）：调整相关章节结构

对每个方案标注：
- 改动范围
- 优缺点
- 推荐指数（1-5 星）""",
        ),
    ],

    "paper-polish": [
        SkillStep(
            name="分段润色",
            description="逐段润色，保持术语一致性",
            skill="polish", step="segment",
            prompt_template="""请用学术风格润色以下段落，保持原意不变。

论文题目：《{title}》

原文：
{content}

润色要求：
- 保持学术性和严谨性
- 提升逻辑连贯性
- 消除口语化表达
- 统一术语翻译
- 不要添加新的技术主张
- 如果有多处可以改进，优先选择简洁的表达方式
- 对于数据不足以支撑的推断，标注【不确定】""",
        ),
    ],

    "paper-draft": [
        SkillStep(
            name="起草章节",
            description="基于大纲和上下文起草一个章节",
            skill="draft", step="generate",
            prompt_template="""你是一位经验丰富的学术写作者，正在帮助一位研究生起草论文章节。

论文题目：《{title}》

大纲结构：
{outline}

前文衔接：
{content}

请根据大纲和已有内容，撰写下一部分。要求：
1. 每段有明确主题句
2. 段落之间有自然过渡
3. 术语使用正确且一致
4. 所有 claim 需要有支撑（标注 [需要引用] 的地方）
5. 对不确定的内容标注 [不确定]
6. 遵循学术写作规范（避免口语化，客观严谨）

请直接输出章节内容，不要输出解释性文字。""",
        ),
    ],

    "paper-review": [
        SkillStep(
            name="综合审查",
            description="从多个维度审查论文质量",
            skill="review", step="structure",
            prompt_template="""你是顶级会议（ACL/EMNLP）的资深审稿人。请对以下论文进行全面审查。

论文题目：《{title}》

大纲：
{outline}

正文（关键章节）：
{content}

请从以下维度进行审查：

## 1. 结构审查
- 逻辑链是否完整？
- 各节篇幅是否合理？
- Introduction 是否包含完整的"故事线"？

## 2. 论证审查
- 每个 claim 是否有证据？
- 方法 motivation 是否充分？
- 是否有 overclaiming？

## 3. 对比审查
- 基线选择是否合理？
- 消融实验是否充分？

## 4. 语言与格式
- 术语是否一致？
- 引用格式是否规范？

请按以下格式输出：
- 🔴 Critical（影响接收）
- 🟡 Major（需要修改）
- 🟢 Minor（建议修改）
- 💡 Suggestion（锦上添花）

每个问题请给出具体位置和修改建议。""",
        ),
    ],

    "paper-defense": [
        SkillStep(
            name="生成答辩准备文档",
            description="提取核心贡献、生成 PPT 大纲、预判问题",
            skill="defense", step="questions",
            prompt_template="""你是一位经验丰富的博士生导师，正在帮助一位研究生准备论文答辩。

论文题目：《{title}》
论文内容：
{content}

请生成一份完整的答辩准备文档，包含：

## 一、核心贡献提炼
1. 研究动机（1 句话）
2. 核心问题（1 句话）
3. 方法亮点（3-5 条，每条说明与其他方法的本质不同）
4. 关键结果（带具体数字）
5. 主要贡献（3-4 点 insight）

## 二、PPT 大纲（15-20 页）
每页标注：核心信息 + 支撑材料 + 可能的追问

## 三、预判问题（23 题）
- 方法论类（5 题）
- 创新性类（5 题）
- 实验类（5 题）
- 局限性类（5 题）
- 未来工作类（3 题）

## 四、Q&A 回答框架
为每道预判问题生成：直接回答 + 支撑论据 + 被追问的应对""",
        ),
    ],
}


# ─── 执行器 ────────────────────────────────────────────────────────

async def execute_skill(
    skill_name: str,
    paper_data: dict,
    extra: str = "",
    on_step: Optional[Callable[[str, str], Awaitable[None]]] = None,
) -> SkillResult:
    """
    执行一个完整的 skill 流程。

    Args:
        skill_name: skill 名称（如 "paper-outline"）
        paper_data: 论文数据 {"title": ..., "content": ..., "outline": ...}
        extra: 额外参数（如导师反馈文本、润色风格等）
        on_step: 每步完成时的回调（异步），接收 (step_name, step_output)
    """
    steps = BUILTIN_SKILLS.get(skill_name)
    if not steps:
        return SkillResult(success=False, skill=skill_name, steps_completed=[], output="",
                           warnings=[f"Unknown skill: {skill_name}"])

    accumulated: Dict[str, str] = {
        "title": paper_data.get("title", ""),
        "content": paper_data.get("content", ""),
        "outline": paper_data.get("outline", ""),
        "extra": extra,
    }

    warnings: List[str] = []
    total_cost = 0.0
    total_tokens = 0
    completed = []

    for step in steps:
        try:
            # 1. 选模型
            model_name = route_model(step.skill, step.step)

            # 2. 构建上下文（自动裁剪）
            context, token_count = get_context_for_skill(
                paper_data, step.skill, step.step, extra
            )
            total_tokens += token_count

            # 3. 填充 prompt 模板
            prompt = step.prompt_template.format(**accumulated)

            # 4. 调用 LLM
            response = await call_llm_with_config(model_name, [
                {"role": "system", "content": "你是一位专业的学术写作助手。请用中文回复（论文内容根据需要中英混合）。"},
                {"role": "user", "content": prompt},
            ])

            # 5. 更新累积状态
            accumulated["outline"] = accumulated.get("outline", "") or response
            accumulated["content"] = accumulated.get("content", "") or response

            # 6. 估算成本
            output_tokens = estimate_tokens(response)
            total_tokens += output_tokens
            total_cost += estimate_cost(model_name, token_count, output_tokens)

            completed.append(step.name)

            if on_step:
                await on_step(step.name, response)

        except Exception as e:
            warnings.append(f"Step '{step.name}' failed: {str(e)}")
            # 继续执行后续步骤（除非是关键步骤失败）

    final_output = accumulated.get("content", "") or accumulated.get("outline", "")

    return SkillResult(
        success=len(completed) > 0,
        skill=skill_name,
        steps_completed=completed,
        output=final_output,
        estimated_cost=round(total_cost, 6),
        estimated_tokens=total_tokens,
        warnings=warnings,
    )


async def execute_skill_step(
    skill_name: str,
    step_name: str,
    paper_data: dict,
    extra: str = "",
) -> Tuple[str, float, int]:
    """
    执行 skill 的单个步骤（用于人在回路模式）。

    Returns:
        (output_text, estimated_cost, estimated_tokens)
    """
    steps = BUILTIN_SKILLS.get(skill_name, [])
    step = next((s for s in steps if s.name == step_name), None)
    if not step:
        raise ValueError(f"Step '{step_name}' not found in skill '{skill_name}'")

    model_name = route_model(step.skill, step.step)
    context, in_tokens = get_context_for_skill(paper_data, step.skill, step.step, extra)

    accumulated = {
        "title": paper_data.get("title", ""),
        "content": paper_data.get("content", ""),
        "outline": paper_data.get("outline", ""),
        "extra": extra,
    }
    prompt = step.prompt_template.format(**accumulated)

    response = await call_llm_with_config(model_name, [
        {"role": "system", "content": "你是一位专业的学术写作助手。请用中文回复。"},
        {"role": "user", "content": prompt},
    ])

    out_tokens = estimate_tokens(response)
    cost = estimate_cost(model_name, in_tokens, out_tokens)

    return response, round(cost, 6), in_tokens + out_tokens


def list_skills() -> List[dict]:
    """列出所有可用的 skill 及其步骤"""
    result = []
    for name, steps in BUILTIN_SKILLS.items():
        result.append({
            "name": name,
            "steps": [
                {"name": s.name, "description": s.description}
                for s in steps
            ],
        })
    return result
