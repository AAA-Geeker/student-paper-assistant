"""格式/规范审查结构化解析单测：验证 parse_format_output 能可靠拆出
通过项 / 分级问题项(含四维标注) / 总体评级。

作为第 9 项（审查板块加强 格式/内容/版本/字体字号 审查）的回归保护。
"""
from app.services.ai import (
    parse_format_output,
    FMT_PASS_MARK,
    FMT_ISSUE_MARK,
    FMT_GRADE_MARK,
)


def test_parse_full_sections_with_dimensions():
    out = (
        f"{FMT_PASS_MARK}\n标题层级清晰。\n摘要、关键词齐全。\n"
        f"{FMT_ISSUE_MARK}\n"
        "Critical：格式｜图3编号跳号，缺图2。\n"
        "Major：内容｜实验部分缺少对照组描述。\n"
        "Minor：字体字号｜正文行距不一致。\n"
        "版本｜Method 与 Introduction 术语不统一。\n"
        f"{FMT_GRADE_MARK}\n82%\n整体基本就绪。\n"
    )
    r = parse_format_output(out)
    assert len(r["passed_items"]) == 2
    assert "标题层级" in r["passed_items"][0]
    assert "82%" in r["grade"]
    assert len(r["issues"]) == 4
    # 严重度
    assert r["issues"][0]["severity"] == "critical"
    assert r["issues"][1]["severity"] == "major"
    assert r["issues"][2]["severity"] == "minor"
    # 维度标注 + 前缀剥离
    assert r["issues"][0]["dimension"] == "格式"
    assert "图3编号跳号" in r["issues"][0]["text"]  # 前缀+维度被剥离，保留正文
    assert r["issues"][1]["dimension"] == "内容"
    assert r["issues"][2]["dimension"] == "字体字号"
    # 无严重度前缀的行默认 minor + 维度前缀推断
    assert r["issues"][3]["severity"] == "minor"
    assert r["issues"][3]["dimension"] == "版本"


def test_parse_default_dimension_when_no_prefix_keyword():
    out = (
        f"{FMT_ISSUE_MARK}\nMajor：引文格式缺年份。\n"
    )
    r = parse_format_output(out)
    assert len(r["issues"]) == 1
    assert r["issues"][0]["severity"] == "major"
    # 未标注维度且无关键词时回退到"格式"
    assert r["issues"][0]["dimension"] == "格式"
    assert "引文格式缺年份" in r["issues"][0]["text"]


def test_parse_missing_sections_returns_empty():
    r = parse_format_output("没有标记的分段文本。")
    assert r["passed_items"] == []
    assert r["issues"] == []
    assert r["grade"] == ""
