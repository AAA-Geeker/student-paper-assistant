"""
AI 服务层——多模型 LLM 调用、Prompt 模板、高级写作功能。

重构后支持：
  - 多模型路由（DeepSeek / GPT-4o-mini / GPT-4o / Claude）
  - System prompt 注入
  - JSON mode 支持
  - 超时和重试
  - 成本追踪
  - 上下文窗口裁剪
"""

import os
import httpx
import json
from typing import Dict, List, Optional

from app.config import settings
from .model_router import (
    get_model_config, ModelConfig, estimate_tokens, estimate_cost
)
from .context_manager import PaperContext, ContextLevel, build_context, extract_terminology


# ─── 核心 LLM 调用函数 ────────────────────────────────────────────

async def call_llm_with_config(
    model_name: str,
    messages: List[dict],
    temperature: float = 0.7,
    max_tokens: Optional[int] = None,
    json_mode: bool = False,
) -> str:
    """
    使用指定模型配置调用 LLM。
    自动处理 API key、base URL、超时、重试。
    """
    cfg = get_model_config(model_name)
    if not cfg:
        # 降级到默认配置
        return await call_llm_default(messages, temperature)

    # 检查 API key（优先用 settings，其次 os.environ）
    from .model_router import _get_api_key
    api_key = _get_api_key(cfg.api_key_env) or settings.LLM_API_KEY
    if not api_key:
        return await call_llm_default(messages, temperature)

    # 根据 provider 调整请求格式
    if cfg.provider == "anthropic":
        return await _call_anthropic(cfg, api_key, messages, temperature, max_tokens or cfg.max_tokens)
    else:
        # OpenAI 兼容格式（DeepSeek, GPT-4o 等都用这个）
        return await _call_openai_compatible(
            cfg, api_key, messages, temperature, max_tokens or cfg.max_tokens, json_mode
        )


async def _call_openai_compatible(
    cfg: ModelConfig,
    api_key: str,
    messages: List[dict],
    temperature: float,
    max_tokens: int,
    json_mode: bool = False,
) -> str:
    """调用 OpenAI 兼容 API"""
    body = {
        "model": cfg.model_id,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    if json_mode and cfg.supports_json_mode:
        body["response_format"] = {"type": "json_object"}

    async with httpx.AsyncClient() as client:
        for attempt in range(3):
            try:
                r = await client.post(
                    f"{cfg.api_base}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json",
                    },
                    json=body,
                    timeout=120.0,
                )
                r.raise_for_status()
                data = r.json()
                return data["choices"][0]["message"]["content"]
            except httpx.HTTPStatusError as e:
                if attempt == 2:
                    raise
                # 429 (rate limit) 或 5xx 时重试
                if e.response.status_code in (429, 500, 502, 503):
                    import asyncio
                    await asyncio.sleep(2 ** attempt)
                    continue
                raise
            except httpx.TimeoutException:
                if attempt == 2:
                    raise


async def _call_anthropic(
    cfg: ModelConfig,
    api_key: str,
    messages: List[dict],
    temperature: float,
    max_tokens: int,
) -> str:
    """调用 Anthropic Messages API"""
    # 提取 system prompt
    system_prompt = ""
    anthropic_messages = []
    for msg in messages:
        if msg["role"] == "system":
            system_prompt = msg["content"]
        else:
            anthropic_messages.append(msg)

    body = {
        "model": cfg.model_id,
        "max_tokens": max_tokens,
        "temperature": temperature,
        "messages": anthropic_messages,
    }
    if system_prompt:
        body["system"] = system_prompt

    async with httpx.AsyncClient() as client:
        for attempt in range(3):
            try:
                r = await client.post(
                    f"{cfg.api_base}/messages",
                    headers={
                        "x-api-key": api_key,
                        "anthropic-version": "2023-06-01",
                        "Content-Type": "application/json",
                    },
                    json=body,
                    timeout=120.0,
                )
                r.raise_for_status()
                data = r.json()
                return data["content"][0]["text"]
            except httpx.HTTPStatusError as e:
                if attempt == 2:
                    raise
                if e.response.status_code in (429, 500, 502, 503):
                    import asyncio
                    await asyncio.sleep(2 ** attempt)
                    continue
                raise
            except httpx.TimeoutException:
                if attempt == 2:
                    raise


async def call_llm_default(messages: List[dict], temperature: float = 0.7) -> str:
    """使用默认配置调用 LLM（向后兼容）"""
    if not settings.LLM_API_KEY:
        return f"[模拟 LLM 输出] 用户提示：{messages[-1]['content'][:100]}..."

    async with httpx.AsyncClient() as client:
        r = await client.post(
            f"{settings.LLM_API_BASE}/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.LLM_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": settings.LLM_MODEL,
                "messages": messages,
                "temperature": temperature,
                "max_tokens": settings.LLM_MAX_TOKENS,
            },
            timeout=120.0,
        )
        r.raise_for_status()
        return r.json()["choices"][0]["message"]["content"]


async def call_llm(messages: List[dict], temperature: float = 0.7) -> str:
    """向后兼容的 call_llm 函数"""
    return await call_llm_default(messages, temperature)


# ─── 论文写作专用函数（增强版）────────────────────────────────────

SYSTEM_PROMPT_ACADEMIC = """你是一位专业的学术写作助手，专门帮助研究生撰写计算机科学/NLP 领域的论文。

写作规范：
- 学术风格：客观、严谨、逻辑清晰
- 每个 claim 需要有证据支撑（引用或实验数据）
- 对不确定的内容标注【不确定】
- 需要引用文献的地方标注【需要引用】
- 术语首次出现时标注英文全称
- 避免口语化表达

你了解以下领域的学术规范：
- ACL/EMNLP/NAACL 等 NLP 会议论文格式
- 论文结构：Introduction → Related Work → Method → Experiments → Conclusion
- 常见术语：LLM, NLP, SFT, RLHF, DPO, Benchmark 等"""


async def generate_outline(title: str, requirements: str = "", model: str = "deepseek") -> str:
    """生成论文大纲（增强版——使用 system prompt + 更好的模板）"""
    prompt = f"""请为论文题目《{title}》生成一份详细大纲。

要求：{requirements if requirements else "遵循标准 ACL/EMNLP 论文结构"}

请输出：
1. 三级标题结构（1 → 1.1 → 1.1.1）
2. 每节标注【写作要点】
3. 确保逻辑链完整：问题 → 现有不足 → 方法 → 验证 → 结论
4. 贡献部分要具体（3-4 点，每点说明 insight）"""

    return await call_llm_with_config(model, [
        {"role": "system", "content": SYSTEM_PROMPT_ACADEMIC},
        {"role": "user", "content": prompt},
    ], temperature=0.7)


async def continue_writing(context: str, instruction: str = "", model: str = "deepseek") -> str:
    """续写论文（增强版）"""
    prompt = f"""请根据以下内容继续写作。

已有内容：
{context}

续写要求：{instruction if instruction else "自然地延续上文，保持风格和逻辑一致"}

请直接输出续写内容，标注 [需要引用] 和 [不确定] 的地方。"""

    return await call_llm_with_config(model, [
        {"role": "system", "content": SYSTEM_PROMPT_ACADEMIC},
        {"role": "user", "content": prompt},
    ])


async def polish(text: str, style: str = "学术", model: str = "gpt-4o-mini") -> str:
    """润色文本（增强版——分段处理 + 风格指导）"""
    prompt = f"""请用{style}风格润色以下文字，保持原意不变。

原文：
{text}

润色要求：
- 提升逻辑连贯性（段落内部和段落之间）
- 消除口语化表达和不规范的缩写
- 统一术语
- 调整冗长或结构混乱的句子
- 不要添加新的技术主张或数据
- 如果原文有数据不足以支撑的推断，标注【不确定：原因】"""

    return await call_llm_with_config(model, [
        {"role": "system", "content": SYSTEM_PROMPT_ACADEMIC},
        {"role": "user", "content": prompt},
    ], temperature=0.5)


async def generate_abstract(text: str, model: str = "deepseek") -> str:
    """生成中英文摘要和关键词"""
    prompt = f"""请为以下论文生成中文摘要和关键词。

论文内容：
{text}

请输出：
## 中文摘要
（200-300 字，包含：研究背景、问题、方法、关键结果、贡献）

## 关键词
（3-5 个，中英文对照）

## English Abstract
（150-250 words）

## Keywords
（对应英文关键词）"""

    return await call_llm_with_config(model, [
        {"role": "system", "content": SYSTEM_PROMPT_ACADEMIC},
        {"role": "user", "content": prompt},
    ])


async def critical_analysis(literature_text: str, model: str = "gpt-4o-mini") -> str:
    """
    对文献综述进行 Critical Analysis（新增功能）。
    用于解决导师常说的"文献综述缺乏 critical analysis"。
    """
    prompt = f"""请对以下文献综述进行 Critical Analysis：

{literature_text}

请从以下角度进行分析：
1. **Knowledge Gap 识别**：现有工作遗漏了什么？
2. **方法对比**：各方法的优劣势和适用场景是什么？
3. **趋势分析**：这个领域的发展方向和未解决问题
4. **与你工作的关系**：你的工作填补了哪个 gap？（如果有的话）

请输出分析结果，每个角度 3-5 条具体的观察。"""

    return await call_llm_with_config(model, [
        {"role": "system", "content": SYSTEM_PROMPT_ACADEMIC},
        {"role": "user", "content": prompt},
    ])


async def improve_introduction_hook(intro_text: str, model: str = "gpt-4o-mini") -> str:
    """
    改进 Introduction 的"钩子"（新增功能）。
    解决导师常说的"Introduction 缺乏钩子"。
    """
    prompt = f"""请改进以下 Introduction 的开头，使其更有"钩子"（hook）：

原文：
{intro_text}

要求：
1. 第一段用一个具体的现象、数据或矛盾来抓住读者
2. 不要用"XX 是近年来的热门研究方向"这种泛泛的开头
3. 明确指出"为什么现在这个问题变得 urgent"
4. 保持学术风格

请输出改进后的版本和改动说明。"""

    return await call_llm_with_config(model, [
        {"role": "system", "content": SYSTEM_PROMPT_ACADEMIC},
        {"role": "user", "content": prompt},
    ])


# ─── 去 AI 痕迹改写（降重核心，替代 Dify）─────────────────────────

SYSTEM_PROMPT_DEAI = (
    "你是一名资深学术论文撰写者，负责把一段文本重写成自然、像人类研究生亲手写作的中文学术"
    "段落。\n"
    "硬性要求：\n"
    "1. 只输出改写后的段落正文，开头不写\"好的/首先/当然\"等，结尾不写\"总之/综上所述/希望对"
    "你有帮助\"等，禁止任何元话语、解释或寒暄。\n"
    "2. 仅依据给定原文改写，忠实保留其中的方法名称、数据、结论，不得编造、新增或删改事实。\n"
    "3. 消除 AI 高频特征：避免\"值得注意的是/毫无疑问/值得注意的是/综上所述/本文提出了一种\""
    "这类套话；避免呆板排比和机械三次重复；避免连续多句以\"该/其/它\"起头；让句子长短错落、"
    "逻辑自然流动。\n"
    "4. 使用客观、凝练、符合中文理工科论文语体的表达，研究过程可用\"我们\"叙述。\n"
    "5. 直接给出最终结果，不要列出任何步骤说明。\n"
    "6. 禁止输出任何 Markdown 或排版符号：#、*、**、-、>、1. 2. 等数字编号、竖线表格等一律不用；"
    "需要分段小标题时直接写纯文本标题（如\"反馈解析\"），列表改用通顺的叙述或分号衔接，"
    "不要用符号做项目符号或标题前缀。"
)


async def de_ai_rewrite(
    text: str,
    target: str = "plagiarism",
    model: str = "deepseek",
    temperature: float = 0.6,
) -> str:
    """去 AI 痕迹改写：强约束地把文本改写成像人类写作的学术段落（降重/降AIGC 核心）。

    target: 'plagiarism'(降重) / 'aigc'(降AIGC) / 其它(同时)。
    返回改写后的文本（不包含任何 AI 元话语）。"""
    target_cn = {"plagiarism": "降低重复率", "aigc": "降低AIGC检测率"}.get(target, "同时降低重复率和AIGC检测率")
    prompt = (
        f"请把下面的段落改写为去除了机器痕迹、自然学术风格的中文。本次改写目标：{target_cn}。"
        f"仅输出改写后的段落，不要任何额外说明。\n\n{text}"
    )
    return await call_llm_with_config(
        model,
        [
            {"role": "system", "content": SYSTEM_PROMPT_DEAI},
            {"role": "user", "content": prompt},
        ],
        temperature=temperature,
    )


async def de_ai_task(
    instruction: str,
    content: str,
    model: str = "deepseek",
    temperature: float = 0.6,
) -> str:
    """通用去 AI 痕迹任务生成：按给定指令处理输入内容，产出自然、专业、像人写的文本。

    用于论文修改/导师批注/审稿回复等"基于输入产出结果"的场景。
    补充了 SYSTEM_PROMPT_DEAI 的去 AI 规矩，并允许任务自带结构要求。
    """
    system = SYSTEM_PROMPT_DEAI + (
        "\n补充：\n"
        "7. 即使任务文字里出现\"## xxx\"、\"| 表格 |\"等结构提示，也一律把它们转成纯文本小标题"
        "或自然叙述，不得输出 #、*、-、数字编号、竖线等排版符号；需要列要点时用通顺的句子分行书写。\n"
        "8. 涉及修改原文时，只基于给定原文与其批注/意见动手，不新增事实，保留原意与数据。"
    )
    prompt = f"{instruction}\n\n{content}\n\n请直接输出结果，不要任何额外说明。"
    return await call_llm_with_config(
        model,
        [{"role": "system", "content": system}, {"role": "user", "content": prompt}],
        temperature=temperature,
    )


# ─── 投稿前审查报告：结构化段落标记（供解析拆出 总体评价/问题/优点/建议） ──
REV_OVERALL_MARK = "【总体评价】"
REV_ISSUES_MARK = "【主要问题】"
REV_STRENGTHS_MARK = "【优点】"
REV_SUGG_MARK = "【修改建议】"

# 问题严重度前缀（纯文字，非排版符号；便于前端按严重度高亮 + 逐条联动修改）
SEV_PREFIXES = ("Critical：", "Major：", "Minor：")
_SEV_KEYS = {"critical": "critical", "major": "major", "minor": "minor"}


def parse_review_output(out: str) -> Dict:
    """把审稿报告拆成 {overall, issues_multiline, strengths, suggestions, major_issues}。

    - 各段按【】标记切出（容错：缺段回落到空字符串）。
    - major_issues: [{severity, text}]，从「主要问题」段逐行解析 Critical/Major/Minor 前缀。
    """
    def _slice(mark: str, end_mark: str) -> str:
        si = out.find(mark)
        if si < 0:
            return ""
        si += len(mark)
        ei = out.find(end_mark, si) if end_mark else -1
        return out[si:ei].strip() if ei > si else out[si:].strip()

    overall = _slice(REV_OVERALL_MARK, REV_ISSUES_MARK)
    issues_text = _slice(REV_ISSUES_MARK, REV_STRENGTHS_MARK)
    strengths = _slice(REV_STRENGTHS_MARK, REV_SUGG_MARK)
    suggestions = _slice(REV_SUGG_MARK, "")

    major_issues: List[Dict] = []
    for line in issues_text.splitlines():
        ln = line.strip()
        if not ln:
            continue
        sev = "minor"
        for prefix in SEV_PREFIXES:
            if ln.startswith(prefix):
                sev = _SEV_KEYS[prefix.lower().rstrip("：")]
                ln = ln[len(prefix):].strip()
                break
        if ln:
            major_issues.append({"severity": sev, "text": ln})

    return {
        "overall": overall,
        "issues_multiline": issues_text,
        "strengths": strengths,
        "suggestions": suggestions,
        "major_issues": major_issues,
    }


SYSTEM_PROMPT_REV = (
    "你是一位资深、挑剔、经验丰富的学术会议/期刊审稿人，正在撰写一篇投稿的审稿报告。\n"
    "硬性要求：\n"
    "1. 用语客观、专业、克制，像认真读完论文的老练审稿人，不使用\"本文亮点多多/令人惊艳\""
    "等夸张或模板套话，不出现\"首先/其次/总之/希望作者\"等 AI 味衔接。\n"
    "2. 严格依据论文内容评审，直接指出具体问题（哪一节、哪句、什么不足），可复现、可执行。\n"
    "3. 评分与推荐用具体数字/档位，理由具体。\n"
    "4. 禁止输出 Markdown 或表格排版符号：#、*、**、-、>、竖线等不用；但允许用【】括起的小标题，"
    "以及用 Critical：/Major：/Minor：（后接中文冒号）作为问题严重度前缀。\n"
    "5. 直接输出审稿报告，不要任何前置说明或寒暄。"
)


async def de_ai_review(
    text: str,
    venue: str,
    venue_type: str,
    model: str = "deepseek",
    temperature: float = 0.5,
) -> str:
    """投稿前审查：以"资深审稿人"语体生成去 AI 痕迹的专业审稿报告。"""
    prompt = (
        f"请以 {venue}（{venue_type}）审稿人视角，对下面这篇论文撰写审稿报告。\n\n"
        "请严格按以下五个用【】括起的小标题分节输出，顺序与标题文字必须与下面完全一致，"
        "不要输出这些标题之外的任何内容：\n"
        f"{REV_OVERALL_MARK}\n"
        "（给出创新性、方法与实验充分度、写作与可读性的 1-5 分，以及推荐意见 "
        "Accept/Weak Accept/Borderline/Reject 选一）\n"
        f"{REV_ISSUES_MARK}\n"
        "（按严重程度列出问题，每条单独一行，行首必须以 Critical：或 Major：或 Minor：开头，"
        "每条指出具体位置、问题、建议）\n"
        f"{REV_STRENGTHS_MARK}\n"
        "（简要列出值得肯定之处）\n"
        f"{REV_SUGG_MARK}\n"
        "（对作者的具体、可执行修改建议）\n\n"
        f"论文内容：\n{text}"
    )
    return await call_llm_with_config(
        model,
        [{"role": "system", "content": SYSTEM_PROMPT_REV}, {"role": "user", "content": prompt}],
        temperature=temperature,
    )


# ─── 批量处理 ────────────────────────────────────────────────────

async def polish_by_segments(
    text: str,
    style: str = "学术",
    segment_size: int = 500,
    model: str = "gpt-4o-mini",
) -> Dict:
    """
    分段润色文本（节省 token 的核心策略）。

    将长文本按段分割，逐段润色，最后做全局一致性检查。
    返回：{"segments": [...], "total_cost": float, "total_tokens": int}
    """
    segments = text.split('\n\n')
    polished_segments = []
    total_cost = 0.0
    total_tokens = 0

    # 提取全局术语清单
    terminology = extract_terminology(text)

    for i, seg in enumerate(segments):
        if not seg.strip():
            polished_segments.append(seg)
            continue

        # 构建逐段上下文（衔接用）
        prev_end = ""
        next_start = ""
        if i > 0:
            prev_end = segments[i-1][-200:] if segments[i-1].strip() else ""
        if i < len(segments) - 1:
            next_start = segments[i+1][:200] if segments[i+1].strip() else ""

        context_hint = ""
        if prev_end:
            context_hint += f"前文：...{prev_end}\n"
        if next_start:
            context_hint += f"后文：{next_start}...\n"
        if terminology:
            context_hint += f"术语清单（请保持一致）：{', '.join(terminology[:30])}\n"

        prompt = context_hint + f"\n请润色以下段落（{style}风格，保持原意）：\n\n{seg}"

        result = await call_llm_with_config(model, [
            {"role": "system", "content": SYSTEM_PROMPT_ACADEMIC},
            {"role": "user", "content": prompt},
        ], temperature=0.5)

        polished_segments.append(result)
        total_tokens += estimate_tokens(seg) + estimate_tokens(result)
        total_cost += estimate_cost(model, estimate_tokens(seg), estimate_tokens(result))

    return {
        "segments": polished_segments,
        "total_cost": round(total_cost, 6),
        "total_tokens": total_tokens,
    }
