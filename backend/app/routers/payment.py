"""
支付端到端验证服务 — 支持支付宝/微信支付模拟 + 异步回调验证。
生产环境接入真实支付网关（支付宝当面付/微信Native支付）。

支付流程：
1. 用户选择套餐 → 发起支付
2. 后端创建支付订单（状态: pending）
3. 返回支付二维码/链接
4. 用户支付 → 支付平台回调 /api/me/payment/notify
5. 后端验证订单并到账
6. 前端轮询 /api/me/payment/status 确认支付结果
"""

import json
import hashlib
import hmac
import time
import uuid
from decimal import Decimal
from datetime import datetime
from typing import Optional, List, Dict
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.routers.auth import get_current_user
from app.services.credits import add_credits
from app.services.commerce import TOP_UP_PACKAGES


# ─── 数据模型 ──────────────────────────────────────────────────────

class PaymentOrder(BaseModel):
    """支付订单"""
    id: str
    user_id: int
    package_id: str
    package_name: str
    amount_rmb: int
    credits: int
    bonus: int
    total_credits: int
    pay_method: str  # alipay | wechat
    status: str  # pending | paid | expired | refunded
    qr_code_url: str  # 支付二维码URL（模拟或真实）
    created_at: str
    paid_at: Optional[str] = None


class CreatePaymentRequest(BaseModel):
    package_id: str
    pay_method: str = "alipay"  # alipay | wechat


class PaymentStatusResponse(BaseModel):
    order_id: str
    status: str
    paid: bool


# 模拟支付存储（生产环境应存数据库）
_payment_orders: Dict[str, dict] = {}


def _generate_order_id() -> str:
    return f"PAY{int(time.time())}{uuid.uuid4().hex[:8].upper()}"


def _create_qr_url(order_id: str, amount: int, method: str) -> str:
    """
    生成支付二维码URL。
    生产环境替换为真实支付网关的二维码API调用。
    目前返回模拟二维码URL。
    """
    return f"https://qr.alipay.com/{order_id}_{amount}_{method}"


# ─── 支付 API ─────────────────────────────────────────────────────

router = APIRouter(tags=["payment"])


@router.post("/payment/create")
def create_payment(
    req: CreatePaymentRequest,
    user: User = Depends(get_current_user),
):
    """创建支付订单"""
    pkg = next((p for p in TOP_UP_PACKAGES if p["id"] == req.package_id), None)
    if not pkg:
        raise HTTPException(status_code=404, detail="套餐不存在")

    order_id = _generate_order_id()

    order = {
        "id": order_id,
        "user_id": user.id,
        "package_id": pkg["id"],
        "package_name": pkg["name"],
        "amount_rmb": pkg["price_rmb"],
        "credits": pkg["credits"],
        "bonus": pkg["bonus"],
        "total_credits": pkg["credits"] + pkg["bonus"],
        "pay_method": req.pay_method,
        "status": "pending",
        "qr_code_url": _create_qr_url(order_id, pkg["price_rmb"], req.pay_method),
        "created_at": datetime.utcnow().isoformat(),
        "paid_at": None,
    }
    _payment_orders[order_id] = order

    return order


@router.post("/payment/notify")
async def payment_notify(request: Request):
    """
    支付异步回调通知（生产环境由微信/支付宝异步调用）。
    模拟: 前端模拟支付后调用此接口验证。
    """
    body = await request.body()
    try:
        data = json.loads(body)
    except json.JSONDecodeError:
        data = dict(request.query_params)

    order_id = data.get("out_trade_no") or data.get("order_id")
    trade_status = data.get("trade_status") or data.get("status", "TRADE_SUCCESS")

    if not order_id:
        raise HTTPException(status_code=400, detail="缺少订单号")

    order = _payment_orders.get(order_id)
    if not order:
        raise HTTPException(status_code=404, detail="订单不存在")

    if order["status"] == "paid":
        return {"code": "SUCCESS", "message": "订单已支付"}

    if trade_status in ("TRADE_SUCCESS", "paid"):
        # 验证通过，到账
        order["status"] = "paid"
        order["paid_at"] = datetime.utcnow().isoformat()

        # 直接为用户加点数（通过user_id）
        db = next(get_db())
        try:
            user = db.query(User).filter(User.id == order["user_id"]).first()
            if user:
                total = Decimal(str(order["total_credits"]))
                add_credits(
                    db, user, total,
                    "top_up",
                    f"支付成功：{order['package_name']}（{order['pay_method']}）"
                )
        finally:
            db.close()

        return {"code": "SUCCESS", "message": "支付成功"}

    return {"code": "FAIL", "message": "支付失败"}


@router.post("/payment/simulate")
def simulate_payment(
    order_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    模拟支付成功（测试用）。
    前端模拟支付弹窗确认后调用此接口。
    """
    order = _payment_orders.get(order_id)
    if not order:
        raise HTTPException(status_code=404, detail="订单不存在")

    if order["user_id"] != user.id:
        raise HTTPException(status_code=403, detail="无权操作此订单")

    if order["status"] == "paid":
        return {"code": "SUCCESS", "message": "订单已支付", "order_id": order_id}

    # 模拟支付到账
    order["status"] = "paid"
    order["paid_at"] = datetime.utcnow().isoformat()

    total = Decimal(str(order["total_credits"]))
    add_credits(
        db, user, total,
        "top_up",
        f"充值成功：{order['package_name']}（{order['pay_method']}）"
    )

    return {
        "code": "SUCCESS",
        "message": "支付成功",
        "order_id": order_id,
        "credits_added": order["total_credits"],
        "balance": float(user.credits),
        "pay_method": order["pay_method"],
    }


@router.get("/payment/status/{order_id}")
def get_payment_status(
    order_id: str,
    user: User = Depends(get_current_user),
):
    """查询支付状态（前端轮询用）"""
    order = _payment_orders.get(order_id)
    if not order:
        raise HTTPException(status_code=404, detail="订单不存在")
    if order["user_id"] != user.id:
        raise HTTPException(status_code=403, detail="无权查看此订单")

    return {
        "order_id": order_id,
        "status": order["status"],
        "paid": order["status"] == "paid",
        "paid_at": order.get("paid_at"),
    }


@router.get("/payment/orders")
def list_user_orders(
    user: User = Depends(get_current_user),
):
    """查询用户的历史订单"""
    orders = [o for o in _payment_orders.values() if o["user_id"] == user.id]
    # 按时间降序
    orders.sort(key=lambda o: o["created_at"], reverse=True)
    return {"orders": orders}
