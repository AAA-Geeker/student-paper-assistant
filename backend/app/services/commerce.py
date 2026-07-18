"""
商业逻辑配置：
- 按痛点场景拆分的定价、订阅、加急规则。
- 集中管理，便于后续接入支付网关（微信/支付宝）时复用。
"""

from decimal import Decimal
from datetime import datetime, timedelta
from typing import Optional, List
from sqlalchemy.orm import Session

from app.models.user import User
from app.services.credits import (
    CORE_PRICING,
    SUBSCRIPTION_PLANS,
    add_credits,
    to_decimal,
)


# 付费套餐（充值档位）
TOP_UP_PACKAGES = [
    {"id": "basic", "name": "体验包", "credits": 1000, "price_rmb": 10, "bonus": 0},
    {"id": "standard", "name": "标准包", "credits": 5500, "price_rmb": 50, "bonus": 500},  # 50元得6000点
    {"id": "pro", "name": "专业包", "credits": 12000, "price_rmb": 100, "bonus": 2000},  # 100元得14000点
    {"id": "unlimited", "name": "团队包", "credits": 35000, "price_rmb": 300, "bonus": 7000},  # 300元得42000点
]


# 后续支付网关接入时，用这些订单场景码
PAYMENT_SCENES = {
    "top_up": "点数充值",
    "subscribe_pro": "Pro 月度订阅",
    "subscribe_premium": "Premium 月度订阅",
    "urgent_aigc": "降重/降 AIGC 加急",
    "urgent_review": "投稿前审查加急",
    "urgent_revision": "论文修改加急",
    "format_check": "投稿格式预检",
    "revision_review": "改后复查",
    "defense_simulation": "答辩模拟",
    "literature_review": "文献综述生成",
    "cn_to_en": "中译英学术润色",
}


def list_top_up_packages() -> List[dict]:
    """列出所有充值套餐。"""
    return [
        {
            "id": p["id"],
            "name": p["name"],
            "credits": p["credits"],
            "bonus": p["bonus"],
            "total_credits": p["credits"] + p["bonus"],
            "price_rmb": p["price_rmb"],
        }
        for p in TOP_UP_PACKAGES
    ]


def apply_top_up(db: Session, user: User, package_id: str) -> Optional[Decimal]:
    """
    模拟充值到账（后续接入支付网关后，在回调中调用）。
    返回实际到账点数。
    """
    pkg = next((p for p in TOP_UP_PACKAGES if p["id"] == package_id), None)
    if not pkg:
        return None
    total = to_decimal(pkg["credits"] + pkg["bonus"])
    add_credits(db, user, total, "top_up", f"充值套餐：{pkg['name']}")
    return total


def apply_subscription(db: Session, user: User, plan: str) -> bool:
    """激活订阅（模拟，后续接入支付）。"""
    if plan not in SUBSCRIPTION_PLANS:
        return False
    if plan == "free":
        user.subscription_plan = "free"
        user.is_premium = False
        user.subscription_expires_at = None
        db.commit()
        return True

    user.subscription_plan = plan
    user.is_premium = plan == "premium"
    user.subscription_expires_at = datetime.utcnow() + timedelta(days=30)
    db.commit()
    return True


def list_subscription_plans() -> List[dict]:
    """列出订阅计划。"""
    return [
        {
            "id": plan_id,
            "name": {"free": "免费版", "pro": "Pro 版", "premium": "Premium 版"}.get(plan_id, plan_id),
            "monthly_price_rmb": info["monthly_price_rmb"],
            "daily_free_core": info["daily_free_core"],
            "discount_percent": info["discount_percent"],
            "description": {
                "free": "注册即送 1000 点，按次付费。",
                "pro": "29元/月，每天 3 次核心功能免费，辅助功能 8 折。",
                "premium": "79元/月，每天 10 次核心功能免费，辅助功能 8 折，优先响应。",
            }.get(plan_id, ""),
        }
        for plan_id, info in SUBSCRIPTION_PLANS.items()
    ]


def get_plan_discount(user: User) -> int:
    """获取用户当前适用的折扣百分比。"""
    if not user.subscription_expires_at or datetime.utcnow() > user.subscription_expires_at:
        return 100
    plan = SUBSCRIPTION_PLANS.get(user.subscription_plan, SUBSCRIPTION_PLANS["free"])
    return plan["discount_percent"]
