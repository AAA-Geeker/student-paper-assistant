"""投稿前审稿报告结构化解析单测：验证 parse_review_output 能可靠拆出
总体评价 / 主要问题(Critical Major Minor 分级) / 优点 / 修改建议。

作为第 7 项（审查结果→修改交互高亮）的回归保护。
"""
from app.services.ai import (
    parse_review_output,
    REV_OVERALL_MARK,
    REV_ISSUES_MARK,
    REV_STRENGTHS_MARK,
    REV_SUGG_MARK,
)


def test_parse_wellformed_with_severities():
    out = (
        f"{REV_OVERALL_MARK}\n创新性4分 方法3分 写作4分，推荐 Weak Accept。\n"
        f"{REV_ISSUES_MARK}\n"
        "Critical：实验结果缺少显著性检验。\n"
        "Major：消融实验未覆盖主要对比方法。\n"
        "Minor：参考文献格式不一致。\n"
        f"{REV_STRENGTHS_MARK}\n选题有落地价值。\n"
        f"{REV_SUGG_MARK}\n补充 p 值与多轮对比实验。\n"
    )
    r = parse_review_output(out)
    assert "Weak Accept" in r["overall"]
    assert "显著性检验" in r["strengths"] or "选题有落地价值" in r["strengths"]
    assert len(r["major_issues"]) == 3
    assert r["major_issues"][0]["severity"] == "critical"
    assert "显著性检验" in r["major_issues"][0]["text"]
    assert r["major_issues"][1]["severity"] == "major"
    assert r["major_issues"][2]["severity"] == "minor"


def test_parse_issue_lines_without_prefix_default_minor():
    out = (
        f"{REV_OVERALL_MARK}\n总体\n"
        f"{REV_ISSUES_MARK}\n"
        "第一处问题（没有前缀）。\n"
        "Critical：致命问题。\n"
        f"{REV_STRENGTHS_MARK}\n优点\n"
    )
    r = parse_review_output(out)
    # 无前缀行按 minor 兜底
    assert r["major_issues"][0]["severity"] == "minor"
    assert "没有前缀" in r["major_issues"][0]["text"]
    assert r["major_issues"][1]["severity"] == "critical"


def test_parse_missing_sections_returns_empty():
    naked = "模型没按标记分段。"
    r = parse_review_output(naked)
    assert r["overall"] == ""
    assert r["strengths"] == ""
    assert r["major_issues"] == []
    assert r["suggestions"] == ""
