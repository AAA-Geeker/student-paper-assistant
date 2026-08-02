"""邮箱验证服务：发送 163 SMTP 验证码 + 验证码生成 / 存储 / 校验。

- 验证码以 EmailVerification 行存库，支持 used / expires_at 状态。
- 发信走 smtplib SSL（163 用 465 端口 + 授权码）。
- 未配置 SMTP（EMAIL_SMTP_ENABLED=False 或 user 为空）时，send_code 返回
  明确的提示而不发信，避免生产环境直接报错；配置后即真正发信。
"""
import random
import smtplib
from datetime import datetime, timedelta
from email.mime.text import MIMEText
from email.header import Header

from sqlalchemy.orm import Session

from app.config import settings
from app.models.email_verification import EmailVerification
from app.models.user import User


def _utcnow():
    # 统一使用 naive UTC：SQLite 存 DateTime(timezone=True) 时读出的是 naive，
    # 与 aware（含 tzinfo）比较会抛 "can't compare offset-naive/aware"。用 naive UTC 保证跨
    # SQLite(测试)/Postgres(生产) 一致。
    return datetime.utcnow()


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
    """通过 163 SMTP 发送验证码。失败抛异常由调用方处理。"""
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
    msg["From"] = Header(sender, "utf-8")
    msg["To"] = Header(to_email, "utf-8")

    server = smtplib.SMTP_SSL(settings.EMAIL_SMTP_HOST, settings.EMAIL_SMTP_PORT, timeout=15)
    try:
        server.login(settings.EMAIL_SMTP_USER, settings.EMAIL_SMTP_PASSWORD)
        server.sendmail(sender, [to_email], msg.as_string())
    finally:
        try:
            server.quit()
        except Exception:
            pass


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
        return False, "验证码发送失败：{}".format(e)

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

    if record.expires_at < _utcnow():
        record.used = True
        db.commit()
        return False, "验证码已过期，请重新获取"

    if record.code != code:
        return False, "验证码不正确"

    record.used = True
    db.commit()
    return True, "邮箱验证通过"
