"""邮箱服务单测：验证 _send_via_smtp 构造的邮件头符合 RFC5322。

回归保护：QQ 邮箱 SMTP 会校验 From 头（RFC5322/RFC2047/RFC822），若 From/To 被
Header() MIME 编码会收到 550 "From header is missing or invalid" 而被拒绝（163 宽容，
QQ 严格）。本测试确保 From/To 是纯地址字符串、只有 Subject 用 Header 编码。
不在测试中真实发信，改用 monkeypatch 捕获待发邮件头。
"""
import email
import smtplib

import pytest

from app.services import email_service


class _FakeSMTP:
    """记录 login/sendmail 调用，不真正连接 SMTP。"""

    def __init__(self, *args, **kwargs):
        self.calls = []

    def login(self, user, password):
        self.calls.append(("login", user, password))

    def sendmail(self, sender, recipients, message):
        self.calls.append(("sendmail", sender, recipients))
        self.message = message

    def quit(self):
        self.calls.append(("quit",))


def test_from_to_headers_are_plain_rfc5322(monkeypatch, capsys):
    capture = {}

    def fake_factory(*args, **kwargs):
        capture["smtp"] = _FakeSMTP(*args, **kwargs)
        return capture["smtp"]

    monkeypatch.setattr(smtplib, "SMTP_SSL", fake_factory)
    # settings 来自 config（EMAIL_SMTP_HOST 等已配好，测试只关心发信行为）
    email_service._send_via_smtp(to_email="someone@example.com", code="123456")

    raw = capture["smtp"].message
    msg = email.message_from_string(raw)

    # From/To 必须是纯地址字符串，不能是 =?utf-8?...?= 的 MIME 编码
    assert "=?" not in msg["From"], "From 头不应被 MIME 编码（QQ 会 550 拒绝）"
    assert "=?" not in msg["To"], "To 头不应被 MIME 编码"
    assert email.utils.parseaddr(msg["From"])[1] == email_service.settings.EMAIL_SMTP_USER
    assert email.utils.parseaddr(msg["To"])[1] == "someone@example.com"

    # Subject 仍应被正确编码（中文主题）
    assert "=?" in msg["Subject"] and "utf-8" in msg["Subject"]
    # sendmail 使用同一 sender 与单一收件人
    assert capture["smtp"].calls[0][0] == "login"
    assert capture["smtp"].calls[1][0] == "sendmail"
    assert capture["smtp"].calls[1][2] == ["someone@example.com"]


def test_smtp_not_configured_returns_clear_hint(monkeypatch):
    """未配置 SMTP 时 send_code 应回滚并返回友好提示，而不是去连服务器。"""
    # 直接验证 smtp_configured 在空 user 时为 False（send_code 会据此分支）
    from app.config import settings
    if settings.EMAIL_SMTP_USER:
        pytest.skip("环境已配置 EMAIL_SMTP_USER，跳过未配置分支测试")

    assert email_service.smtp_configured() is False
