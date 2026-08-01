"""
对比引擎 — 支持改写前后 / 修改前后的差异对比展示。

功能：
1. 逐句对比：将原文和修改后文本按句子语义对齐，1:1 一一对应
2. 差异高亮：用 █████ 标记增加/删除/修改的部分
3. 统计摘要：字数变化、修改率、术语一致性
"""

from typing import Dict, List, Tuple, Optional
import re


class ComparisonSegment:
    """对比段落"""

    def __init__(
        self,
        original: str,
        revised: str,
        status: str = "unchanged",  # unchanged | modified | added | deleted
        similarity: float = 1.0,
    ):
        self.original = original
        self.revised = revised
        self.status = status
        self.similarity = similarity

    def to_dict(self) -> Dict:
        return {
            "original": self.original,
            "revised": self.revised,
            "status": self.status,
            "similarity": round(self.similarity, 2),
        }


class ComparisonResult:
    """完整对比结果"""

    def __init__(self, original_text: str, revised_text: str):
        self.original_text = original_text
        self.revised_text = revised_text
        self.segments: List[ComparisonSegment] = []
        self.stats: Dict = {}

    def to_dict(self) -> Dict:
        return {
            "original_length": len(self.original_text),
            "revised_length": len(self.revised_text),
            "segments": [s.to_dict() for s in self.segments],
            "stats": self.stats,
        }


def _split_paragraphs(text: str) -> List[str]:
    """将文本按段落拆分"""
    paragraphs = re.split(r'\n\s*\n|\n', text.strip())
    return [p.strip() for p in paragraphs if p.strip()]


def _split_sentences(text: str) -> List[str]:
    """将文本按句子拆分（保留句末标点）。英文句点、中文句号/感叹/问号以及换行都视为边界。"""
    parts = re.split(r'(?<=[。！？!?；;])\s*|\n+', text.strip())
    sents = [p.strip() for p in parts if p.strip()]
    # 若文本没有分句标点（纯短语文本），按整段作为一个句子返回
    if not sents and text.strip():
        return [text.strip()]
    # 极端情况下把过长段落按换行兜底
    if len(sents) == 1 and len(text) > 200:
        sents = [p.strip() for p in text.strip().split("。") if p.strip()]
        sents = [s + ("。" if not s.endswith("。") else "") for s in sents] if sents else sents
    return [s for s in sents if s]


def _text_similarity(a: str, b: str) -> float:
    """计算两段文本的简单相似度（基于字符级交集，对中英文通用）"""
    if not a or not b:
        return 0.0
    # 直接比较，含数字与术语（比仅关键词更灵敏）
    def ngram_set(s: str, n: int = 2) -> set:
        s = re.sub(r'\s+', '', s.lower())
        return {s[i:i+n] for i in range(max(0, len(s)-n+1))}
    ka = ngram_set(a, 2)
    kb = ngram_set(b, 2)
    if not ka or not kb:
        return 0.0
    inter = ka & kb
    union = ka | kb
    return len(inter) / len(union) if union else 0.0


def _greedy_align(o_sents: List[str], r_sents: List[str], thr: float = 0.35) -> List[Tuple[int, int, float]]:
    """贪心语义对齐：尽量让每个原句匹配到唯一的修改句（1:1），按相似度降序配对。"""
    # 计算全相似度矩阵
    sims = []  # (sim, o_idx, r_idx)
    for oi, o in enumerate(o_sents):
        for ri, r in enumerate(r_sents):
            sims.append((_text_similarity(o, r), oi, ri))
    sims.sort(reverse=True, key=lambda x: x[0])

    used_o, used_r = set(), set()
    matched = []
    for sim, oi, ri in sims:
        if sim < thr:
            break  # 剩余相似度都低于阈值
        if oi in used_o or ri in used_r:
            continue
        used_o.add(oi)
        used_r.add(ri)
        matched.append((oi, ri, sim))
    matched.sort(key=lambda x: x[0])  # 按原句顺序输出
    return matched


def compute_comparison(original_text: str, revised_text: str) -> ComparisonResult:
    """
    计算两段文本的逐句对比结果（语义对齐，1:1 一一对应）。

    策略：
    - 把原文、修改均切成句子
    - 用相似度矩阵做贪心 1:1 对齐
    - 对齐的原句→修改句：similarity>=0.7 记为 unchanged，否则 modified
    - 未匹配到的原句记为 deleted（整体删除），未匹配到的修改句记为 added（整体新增）
    - 输出 segments 顺序：按原句出现顺序，原句的整体删除紧跟其匹配句之后展示
    """
    result = ComparisonResult(original_text, revised_text)

    o_sents = _split_sentences(original_text)
    r_sents = _split_sentences(revised_text)

    if not o_sents and not r_sents:
        return result

    matched = _greedy_align(o_sents, r_sents)
    m_map = {oi: (ri, sim) for oi, ri, sim in matched}
    matched_r = {ri for oi, ri, sim in matched}

    # 组装 segments：按原句顺序，每句产出其对齐项；未被匹配的修改句（新增）插到紧邻的前一原句之后，
    # 保证"原文 ↔ 对应修改"在视觉上逐句紧邻。
    segments: List[ComparisonSegment] = []
    unmatched_r = sorted(set(range(len(r_sents))) - matched_r)

    # 每个 unmatched 修改句归属到它之前最近已匹配的原句之后
    added_by_after: Dict[int, List[int]] = {}
    for ur in unmatched_r:
        # 归属到 ri < ur 的最近已匹配原句；否则挂到最后
        owner = None
        for oi2, ri2, sim2 in matched:
            if ri2 < ur:
                owner = oi2
            else:
                break
        added_by_after.setdefault(owner, []).append(ur)

    for oi, o_sent in enumerate(o_sents):
        if oi in m_map:
            ri, sim = m_map[oi]
            status = "unchanged" if sim >= 0.7 else "modified"
            segments.append(ComparisonSegment(
                original=o_sent, revised=r_sents[ri], status=status, similarity=sim
            ))
            # 紧随其后内联属于本句的新增句
            for ur in added_by_after.get(oi, []):
                segments.append(ComparisonSegment(
                    original="", revised=r_sents[ur], status="added", similarity=0.0
                ))
        else:
            segments.append(ComparisonSegment(
                original=o_sent, revised="", status="deleted", similarity=0.0
            ))

    # 剩余还没有归属的新增句（owner 为 None 的）追加到末尾
    placed = {ri for v in added_by_after.values() for ri in v}
    for ur in unmatched_r:
        if ur not in placed:
            segments.append(ComparisonSegment(
                original="", revised=r_sents[ur], status="added", similarity=0.0
            ))

    result.segments = segments

    orig_len = len(original_text.replace(" ", "").replace("\n", ""))
    rev_len = len(revised_text.replace(" ", "").replace("\n", ""))
    modified_count = sum(1 for s in result.segments if s.status == "modified")
    added_count = sum(1 for s in result.segments if s.status == "added")
    deleted_count = sum(1 for s in result.segments if s.status == "deleted")
    total = len(result.segments)

    result.stats = {
        "original_chars": orig_len,
        "revised_chars": rev_len,
        "char_change": rev_len - orig_len,
        "char_change_percent": round(abs(rev_len - orig_len) / max(orig_len, 1) * 100, 1),
        "total_segments": total,
        "unchanged_segments": sum(1 for s in result.segments if s.status == "unchanged"),
        "modified_segments": modified_count,
        "added_segments": added_count,
        "deleted_segments": deleted_count,
        "modification_rate": round(
            (modified_count + added_count + deleted_count) / max(total, 1) * 100, 1
        ),
    }

    return result


def extract_changed_spans(original: str, revised: str) -> List[Dict]:
    """
    更细粒度的差异提取——返回原文中每个改动区间。
    用于前端高亮显示。
    """
    result = []

    o_sentences = _split_sentences(original)
    r_sentences = _split_sentences(revised)

    matched = _greedy_align(o_sentences, r_sentences, thr=0.5)
    m_map = {oi: ri for oi, ri, sim in matched}
    matched_o = {oi for oi, ri, sim in matched}
    matched_r = {ri for oi, ri, sim in matched}

    for oi, o in enumerate(o_sentences):
        if oi in m_map:
            r = r_sentences[m_map[oi]]
            sim = _text_similarity(o, r)
            if sim < 0.5:
                result.append({"type": "modified", "original": o, "revised": r})
            elif o != r:
                result.append({"type": "polished", "original": o, "revised": r})
        else:
            result.append({"type": "deleted", "original": o, "revised": ""})

    for ri, r in enumerate(r_sentences):
        if ri not in matched_r:
            result.append({"type": "added", "original": "", "revised": r})

    return result
