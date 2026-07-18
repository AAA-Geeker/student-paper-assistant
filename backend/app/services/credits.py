"""
资产与商业化服务：点数计算、消费、订阅与加急处理。

核心原则：
- 1 元人民币 = 100 点。
- 注册赠送 1000 点（约 10 元体验额度）。
- 所有 AI 调用先按 token 成本换算成 USD，再按 1 USD = 700 点换算成点数。
- 三大核心功能按固定点数 + 字数浮动计费。
- 订阅用户：Pro 每天 3 次核心功能免费，Premium 每天 10 次，辅助功能 8 折。
- 加急：点数 * 2。
"""

from decimal import Decimal, ROUND_HALF_UP
from datetime import datetime, timedelta
from typing import Optional, Tuple
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.credit_transaction import CreditTransaction
from app.services.model_router import estimate_cost


CREDITS_PER_USD = Decimal("700.00")  # 1 USD = 700 点
POINTS_PER_RMB_CENT = Decimal("1.00")  # 1 分人民币 = 1 点

# 三大核心功能定价（点数）
CORE_PRICING = {
    "aigc_rewrite": {
        "base": Decimal("150.00"),
        "per_1000_chars": Decimal("80.00"),  # 每千字
        "description": "降重/降 AIGC 改写",
    },
    "pre_submission_review": {
        "base": Decimal("500.00"),
        "per_1000_chars": Decimal("50.00"),
        "description": "投稿前审稿人报告",
    },
    "paper_revision": {
        "base": Decimal("300.00"),
        "per_1000_chars": Decimal("40.00"),
        "description": "论文修改方案与改写",
    },
}

# 订阅计划
SUBSCRIPTION_PLANS = {
    "free": {"daily_free_core": 0, "discount_percent": 100, "monthly_price_rmb": 0},
    "pro": {"daily_free_core": 3, "discount_percent": 80, "monthly_price_rmb": 29},
    "premium": {"daily_free_core": 10, "discount_percent": 80, "monthly_price_rmb": 79},
}


def to_decimal(value: object) -> Decimal:
    return Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def estimate_usd_cost(model: str, input_tokens: int, output_tokens: int) -> Decimal:
    """根据 token 估算 USD 成本，再换算成点数。"""
    cost = estimate_cost(model, input_tokens, output_tokens)
    return to_decimal(cost * float(CREDITS_PER_USD))


def calculate_core_cost(scene: str, text_length: int, urgent: bool = False, discount_percent: int = 100) -> Decimal:
    """计算三大核心功能的点数消耗。"""
    pricing = CORE_PRICING.get(scene)
    if not pricing:
        raise ValueError(f"Unknown core scene: {scene}")

    length_units = max(0, text_length - 500) / 1000  # 前 500 字按基础价，超出部分按字数
    cost = pricing["base"] + to_decimal(length_units * float(pricing["per_1000_chars"]))

    # 应用订阅折扣
    if discount_percent != 100:
        cost = cost * to_decimal(discount_percent) / Decimal("100")

    # 加急翻倍
    if urgent:
        cost = cost * Decimal("2")

    return cost.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def has_free_core_today(user: User, scene: str, db: Session) -> bool:
    """检查用户今天是否还有免费核心功能次数。"""
    plan = SUBSCRIPTION_PLANS.get(user.subscription_plan, SUBSCRIPTION_PLANS["free"])
    daily_limit = plan["daily_free_core"]
    if daily_limit <= 0:
        return False

    today = datetime.utcnow().date()
    used_today = db.query(CreditTransaction).filter(
        CreditTransaction.user_id == user.id,
        CreditTransaction.type == "expense",
        CreditTransaction.scene == scene,
        CreditTransaction.created_at >= today,
        CreditTransaction.amount == Decimal("0.00"),
    ).count()
    return used_today < daily_limit


def consume_credits(
    db: Session,
    user: User,
    scene: str,
    amount: Decimal,
    description: str = "",
) -> Tuple[bool, Decimal]:
    """
    扣除用户点数并写入交易记录。

    Returns:
        (success, actual_amount)
    """
    amount = amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    if amount <= Decimal("0.00"):
        return True, Decimal("0.00")

    if user.credits < amount:
        return False, Decimal("0.00")

    user.credits = user.credits - amount
    user.credits_used = user.credits_used + amount

    txn = CreditTransaction(
        user_id=user.id,
        type="expense",
        scene=scene,
        amount=amount,
        balance_after=user.credits,
        description=description,
    )
    db.add(txn)
    db.commit()
    db.refresh(user)
    return True, amount


def refund_credits(db: Session, user: User, scene: str, amount: Decimal, description: str = "") -> None:
    """退款（例如任务失败时）。"""
    amount = amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    if amount <= Decimal("0.00"):
        return

    user.credits = user.credits + amount
    txn = CreditTransaction(
        user_id=user.id,
        type="income",
        scene=scene,
        amount=amount,
        balance_after=user.credits,
        description=description,
    )
    db.add(txn)
    db.commit()


def add_credits(db: Session, user: User, amount: Decimal, scene: str, description: str = "") -> None:
    """充值或赠送点数。"""
    amount = amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    if amount <= Decimal("0.00"):
        return
    user.credits = user.credits + amount
    txn = CreditTransaction(
        user_id=user.id,
        type="income",
        scene=scene,
        amount=amount,
        balance_after=user.credits,
        description=description,
    )
    db.add(txn)
    db.commit()


def gift_registration_credits(db: Session, user: User) -> None:
    """新用户注册赠送 1000 点。"""
    add_credits(db, user, Decimal("1000.00"), "register_gift", "新用户注册赠送")


def get_subscription_info(user: User) -> dict:
    """获取用户订阅状态。"""
    plan = SUBSCRIPTION_PLANS.get(user.subscription_plan, SUBSCRIPTION_PLANS["free"])
    expired = True
    if user.subscription_expires_at:
        expired = datetime.utcnow() > user.subscription_expires_at
    return {
        "plan": user.subscription_plan,
        "plan_label": {"free": "免费版", "pro": "Pro 版", "premium": "Premium 版"}.get(user.subscription_plan, "免费版"),
        "monthly_price_rmb": plan["monthly_price_rmb"],
        "daily_free_core": plan["daily_free_core"],
        "discount_percent": plan["discount_percent"],
        "expires_at": user.subscription_expires_at.isoformat() if user.subscription_expires_at else None,
        "is_active": not expired,
        "is_premium": user.is_premium,
    }
