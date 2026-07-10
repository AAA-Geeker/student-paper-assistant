"""
上下文窗口管理器——在发送给 LLM 之前裁剪内容，控制 token 消耗。

策略：
  - 全文级（full）：仅在润色收尾、答辩准备时使用
  - 章节级（section）：起草和修改时使用（当前章 + 前后衔接）
  - 段落级（paragraph）：润色时使用（当前段 + 前段末句 + 术语清单）
  - 大纲级（outline）：审查时使用（大纲 + 关键句）
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Optional, Tuple
import re


class ContextLevel(Enum):
    FULL = "full"           # ~8000+ tokens
    SECTION = "section"     # ~2000 tokens
    PARAGRAPH = "paragraph" # ~300 tokens
    OUTLINE = "outline"     # ~500 tokens
    MINIMAL = "minimal"     # ~100 tokens


@dataclass
class PaperContext:
    """论文的完整上下文，按粒度组织"""
    title: str = ""
    outline: str = ""           # 完整大纲
    content: str = ""           # 全文
    sections: List[str] = field(default_factory=list)  # 按 ## 分割的章节
    paragraphs: List[str] = field(default_factory=list)  # 按 \n\n 分割的段落
    terminology: List[str] = field(default_factory=list)  # 术语清单
    contribution: str = ""       # 核心贡献声明
    abstract: str = ""           # 摘要

    @classmethod
    def from_paper_data(cls, title: str, content: str, outline: str = "") -> "PaperContext":
        ctx = cls(title=title, content=content, outline=outline)

        # 按 ## 标题分割章节
        sections = re.split(r'\n(?=## )', content)
        ctx.sections = [s.strip() for s in sections if s.strip()]

        # 按双换行分割段落
        ctx.paragraphs = [p.strip() for p in content.split('\n\n') if p.strip()]

        return ctx


def build_context(
    paper: PaperContext,
    level: ContextLevel,
    current_section_index: Optional[int] = None,
    current_paragraph_index: Optional[int] = None,
    extra_instructions: str = "",
) -> str:
    """
    根据指定的 ContextLevel 构建发送给 LLM 的上下文。

    Args:
        paper: 论文上下文对象
        level: 上下文粒度
        current_section_index: 当前处理的章节索引（用于 section/paragraph 级）
        current_paragraph_index: 当前处理的段落索引（用于 paragraph 级）
        extra_instructions: 额外的任务指令
    """
    parts = []

    if level == ContextLevel.MINIMAL:
        # 仅标题 + 大纲摘要 + 指令
        parts.append(f"# 论文：{paper.title}")
        parts.append(f"## 大纲\n{paper.outline[:300]}")
        parts.append(extra_instructions)
        return "\n\n".join(parts)

    if level == ContextLevel.OUTLINE:
        # 大纲 + 贡献声明 + 指令
        parts.append(f"# 论文：{paper.title}")
        parts.append(f"## 大纲\n{paper.outline}")
        if paper.contribution:
            parts.append(f"## 核心贡献\n{paper.contribution}")
        parts.append(extra_instructions)
        return "\n\n".join(parts)

    if level == ContextLevel.PARAGRAPH:
        # 目标段 + 前段末句 + 后段首句 + 术语 + 指令
        parts.append(f"# 论文：{paper.title}")
        if paper.terminology:
            parts.append(f"## 关键术语\n{', '.join(paper.terminology)}")

        if current_paragraph_index is not None:
            # 前段衔接
            if current_paragraph_index > 0:
                prev = paper.paragraphs[current_paragraph_index - 1]
                parts.append(f"## 前文衔接\n...{prev[-200:]}")

            # 当前段
            curr = paper.paragraphs[current_paragraph_index]
            parts.append(f"## 待处理段落\n{curr}")

            # 后段衔接
            if current_paragraph_index < len(paper.paragraphs) - 1:
                next_para = paper.paragraphs[current_paragraph_index + 1]
                parts.append(f"## 后文衔接\n{next_para[:200]}...")

        parts.append(extra_instructions)
        return "\n\n".join(parts)

    if level == ContextLevel.SECTION:
        # 当前章 + 前一节末段 + 后一节首段 + 大纲 + 指令
        parts.append(f"# 论文：{paper.title}")
        parts.append(f"## 大纲\n{paper.outline}")

        if current_section_index is not None and 0 <= current_section_index < len(paper.sections):
            # 前一节衔接
            if current_section_index > 0:
                prev_section = paper.sections[current_section_index - 1]
                prev_paras = prev_section.split('\n\n')
                parts.append(f"## 前一节末段（衔接用）\n{prev_paras[-1][:300] if prev_paras else prev_section[-300:]}")

            # 当前节
            parts.append(f"## 当前章节（待处理）\n{paper.sections[current_section_index]}")

            # 后一节衔接
            if current_section_index < len(paper.sections) - 1:
                next_section = paper.sections[current_section_index + 1]
                parts.append(f"## 后一节首段（衔接用）\n{next_section[:300]}")

        parts.append(extra_instructions)
        return "\n\n".join(parts)

    if level == ContextLevel.FULL:
        # 完整内容
        parts.append(f"# 论文：{paper.title}")
        parts.append(f"## 大纲\n{paper.outline}")
        parts.append(f"## 正文\n{paper.content}")
        if paper.terminology:
            parts.append(f"## 术语清单\n{', '.join(paper.terminology)}")
        parts.append(extra_instructions)
        return "\n\n".join(parts)

    return extra_instructions


def extract_terminology(text: str) -> List[str]:
    """从文本中提取可能的术语（英文缩写和大写词组）"""
    # 匹配英文全大写缩写 (LLM, NLP, RAG 等)
    abbreviations = set(re.findall(r'\b[A-Z]{2,6}\b', text))
    # 匹配 "全称（ABBR）" 模式
    full_terms = re.findall(r'[一-鿿]+（([A-Z]{2,6})）', text)
    abbreviations.update(full_terms)
    return sorted(abbreviations)


def get_context_for_skill(
    paper_data: dict,
    skill: str,
    step: str,
    extra: str = ""
) -> Tuple[str, int]:
    """
    为特定 skill+step 自动构建最优上下文。

    Returns:
        (context_string, estimated_token_count)
    """
    from .model_router import estimate_tokens

    paper = PaperContext.from_paper_data(
        title=paper_data.get("title", ""),
        content=paper_data.get("content", ""),
        outline=paper_data.get("outline", ""),
    )

    # 按 skill + step 选择上下文级别
    SKILL_CONTEXT_MAP = {
        "outline":    {"generate": ContextLevel.MINIMAL, "review": ContextLevel.OUTLINE},
        "draft":      {"generate": ContextLevel.SECTION, "refine": ContextLevel.PARAGRAPH},
        "polish":     {"segment": ContextLevel.PARAGRAPH, "global_check": ContextLevel.FULL},
        "revise":     {"parse": ContextLevel.PARAGRAPH, "generate_plan": ContextLevel.PARAGRAPH,
                       "apply": ContextLevel.PARAGRAPH},
        "review":     {"structure": ContextLevel.OUTLINE, "argument": ContextLevel.SECTION,
                       "comparison": ContextLevel.SECTION, "format": ContextLevel.FULL,
                       "language": ContextLevel.PARAGRAPH},
        "abstract":   {"generate": ContextLevel.FULL},
        "defense":    {"questions": ContextLevel.FULL, "answers": ContextLevel.FULL},
    }

    level = SKILL_CONTEXT_MAP.get(skill, {}).get(step, ContextLevel.SECTION)

    # 提取术语（用于 paragraph 级以上）
    paper.terminology = extract_terminology(paper.content)

    context = build_context(paper, level, extra_instructions=extra)
    tokens = estimate_tokens(context)
    return context, tokens
