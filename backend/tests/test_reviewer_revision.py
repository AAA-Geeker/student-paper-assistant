"""审稿人修改结构化解析单测：验证 reviewer_response_revision 的
_parse_reviewer_output 能可靠拆出 Response Letter / 修改后论文 / 对照项。

作为第 6 项（理顺审稿场景 Response Letter / 对照表）的回归保护。
"""
from app.services.core_features import (
    _parse_reviewer_output,
    R_LETTER_MARK,
    R_PAPER_MARK,
    R_COMPARE_MARK,
)


def test_parse_full_three_sections():
    out = (
        f"{R_LETTER_MARK}\n"
        "关于摘要过长的问题，已删减并对结论做了精简。\n"
        "\n"
        f"{R_PAPER_MARK}\n"
        "这是修改后的完整论文正文。\n"
        "未修改部分保持不变。\n"
        "\n"
        f"{R_COMPARE_MARK}\n"
        "第一段——原句A；改后句A'\n"
        "第二段——原句B；改后句B'\n"
    )
    letter, paper, items = _parse_reviewer_output(out)
    assert "摘要过长" in letter
    assert "修改后的完整论文正文" in paper
    assert len(items) == 2
    assert items[0].startswith("第一段")


def test_parse_missing_compare_mark_falls_back_to_rest():
    out = (
        f"{R_LETTER_MARK}\n回复内容。\n"
        f"{R_PAPER_MARK}\n修改后论文。\n"
    )
    letter, paper, items = _parse_reviewer_output(out)
    assert "回复内容" in letter
    assert "修改后论文" in paper
    assert items == []


def test_parse_no_markers_returns_whole_as_letter_and_paper():
    naked = "模型没有按标记分段的纯文本正文。"
    letter, paper, items = _parse_reviewer_output(naked)
    assert letter.strip() == naked
    assert paper.strip() == naked
    assert items == []
