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
