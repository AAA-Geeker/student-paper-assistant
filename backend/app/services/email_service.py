"""邮箱验证服务：发送 QQ 邮箱(SMTP) 验证码 + 验证码生成 / 存储 / 校验。

- 验证码以 EmailVerification 行存库，支持 used / expires_at 状态。
- 发信走 smtplib SSL（QQ/163 均用 465 端口 + 授权码，本服务默认 smtp.qq.com）。
- 发送失败时对常见 SMTP 错误分类并给出用户可理解的提示（尤其 QQ 邮箱的
  当日发信上限风控、收件人频控、授权码错误等）。
- 未配置 SMTP（EMAIL_SMTP_ENABLED=False 或 user 为空）时，send_code 返回
  明确的提示而不发信，避免生产环境直接报错；配置后即真正发信。
"""
import random
import smtplib
from datetime import datetime, timedelta, timezone
from email.mime.text import MIMEText
from email.header import Header

from sqlalchemy.orm import Session

from app.config import settings
from app.models.email_verification import EmailVerification
from app.models.user import User


def _utcnow():
    """当前时间（aware UTC）。

    SQLite 存 DateTime(timezone=True) 读出的是 naive（值实为 UTC），Postgres 读出的是 aware。
    统一用 aware UTC，并在比较前把可能 naive 的 DB 字段补上 UTC tzinfo（见 _as_utc），
    避免 naive/aware 混比崩溃。
    """
    return datetime.now(timezone.utc)


def _as_utc(dt):
    """把 DB 读出的 datetime 归一化为 aware UTC（naive 视为 UTC 补 tzinfo）。"""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def generate_code() -> str:
    """生成 6 位数字验证码。"""
    return "{:06d}".format(random.randint(0, 999999))


def smtp_configured() -> bool:
    return bool(
        settings.EMAIL_SMTP_ENABLED
        and settings.EMAIL_SMTP_USER
        and settings.EMAIL_SMTP_PASSWORD
    )


def _send_via_smtp(to_email: str, code: str) -> None:
    """通过 SMTP 发送验证码。失败抛带友好提示的异常，由调用方回显。"""
    sender = settings.EMAIL_FROM or settings.EMAIL_SMTP_USER
    subject = "【学生论文写作助手】注册验证码"
    body = (
        "你好：\n\n"
        "感谢注册学生论文写作助手。你本次的验证码是：\n\n"
        "    {code}\n\n"
        "验证码 {ttl} 分钟内有效，请勿泄露给他人。若非本人操作请忽略本邮件。\n"
    ).format(code=code, ttl=settings.EMAIL_CODE_TTL_MINUTES)

    msg = MIMEText(body, "plain", "utf-8")
    msg["Subject"] = Header(subject, "utf-8")
    # From/To 必须为 RFC5322 规范的纯地址字符串，不能再用 Header() 编码——
    # QQ/163 邮箱 SMTP 会校验 From 头，MIME 编码后的地址会被判为无效并 550 拒绝。
    msg["From"] = sender
    msg["To"] = to_email

    server = smtplib.SMTP_SSL(settings.EMAIL_SMTP_HOST, settings.EMAIL_SMTP_PORT, timeout=15)
    try:
        server.login(settings.EMAIL_SMTP_USER, settings.EMAIL_SMTP_PASSWORD)
        server.sendmail(sender, [to_email], msg.as_string())
    finally:
        try:
            server.quit()
        except Exception:
            pass


def _friendly_smtp_error(exc: Exception) -> str:
    """把底层 SMTP 异常转成对用户友好的中文提示。"""
    msg = str(exc).lower()
    if "authentication" in msg or "auth" in msg or "535" in msg or "login" in msg:
        return "SMTP 授权失败：请检查发信邮箱的授权码是否正确（需在QQ邮箱开启SMTP服务生成16位授权码）"
    if "550" in msg or "554" in msg or "denied" in msg or "freq" in msg or "frequency" in msg:
        return (
            "邮件被邮件服务器拦截：可能触发QQ邮箱当日发信上限或被收件方频控"
            "（同一收件人1分钟最多2封）。请明日再试。"
        )
    if "timed out" in msg or "timeout" in msg or "connection" in msg:
        return "SMTP 连接超时：请检查 EMAIL_SMTP_HOST / EMAIL_SMTP_PORT 是否正确"
    return "发送失败（{}）".format(exc)


def too_many_recent_codes(db: Session, email: str) -> bool:
    """单邮箱 1 小时内发送验证码次数是否超限（防滥用）。"""
    since = _utcnow() - timedelta(hours=1)
    count = (
        db.query(EmailVerification)
        .filter(EmailVerification.email == email, EmailVerification.created_at >= since)
        .count()
    )
    return count >= settings.EMAIL_CODE_MAX_ATTEMPTS


def send_code(db: Session, email: str):
    """生成并发送验证码。返回一个 (ok, message) 供接口回显。

    email 必须是小写化、未被占用的邮箱（调用方已校验）。
    """
    code = generate_code()
    record = EmailVerification(
        email=email,
        code=code,
        used=False,
        expires_at=_utcnow() + timedelta(minutes=settings.EMAIL_CODE_TTL_MINUTES),
    )
    db.add(record)

    if not smtp_configured():
        # 回滚验证码记录：未发信则不留下记录，前端提示需配置。
        db.rollback()
        return False, "邮箱服务未配置，暂无法发送验证码，请联系管理员"

    try:
        _send_via_smtp(email, code)
    except Exception as e:  # noqa: BLE001
        db.rollback()
        return False, _friendly_smtp_error(e)

    db.commit()
    return True, "验证码已发送到 {}，{} 分钟内有效".format(email, settings.EMAIL_CODE_TTL_MINUTES)


def verify_code(db: Session, email: str, code: str) -> tuple:
    """校验验证码。成功 → 该验证码标记 used。返回 (ok, message)。"""
    email = (email or "").strip().lower()
    code = (code or "").strip()

    record = (
        db.query(EmailVerification)
        .filter(EmailVerification.email == email, EmailVerification.used.is_(False))
        .order_by(EmailVerification.id.desc())
        .first()
    )
    if not record:
        return False, "未找到该邮箱的验证码，请先获取验证码"

    if _as_utc(record.expires_at) < _utcnow():
        record.used = True
        db.commit()
        return False, "验证码已过期，请重新获取"

    if record.code != code:
        return False, "验证码不正确"

    record.used = True
    db.commit()
    return True, "邮箱验证通过"
