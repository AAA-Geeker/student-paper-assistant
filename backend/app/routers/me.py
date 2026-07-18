"""
用户资产 / 商业化 API
- 查询余额和消费记录
- 核心功能价格估算
- 充值套餐 / 订阅计划查询
- 模拟充值/订阅（后续接入支付网关）
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.models.user import User
from app.models.credit_transaction import CreditTransaction
from app.routers.auth import get_current_user
from app.schemas.user import UserOut
from app.schemas.commerce import (
    CreditsOut,
    CreditTransactionOut,
    CoreCostEstimateRequest,
    CoreCostEstimateOut,
    TopUpPackageOut,
    SubscriptionPlanOut,
    SubscriptionOut,
    ApplyTopUpRequest,
    ApplySubscriptionRequest,
)
from app.services.credits import (
    get_subscription_info,
)
from app.services.core_features import estimate_task_cost
from app.services.commerce import (
    list_top_up_packages,
    list_subscription_plans,
    apply_top_up,
    apply_subscription,
)

router = APIRouter(tags=["me"])


@router.get("/profile", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user


@router.get("/credits", response_model=CreditsOut)
def credits(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    txns = db.query(CreditTransaction).filter(
        CreditTransaction.user_id == user.id
    ).order_by(CreditTransaction.created_at.desc()).all()
    return CreditsOut(
        credits=float(user.credits),
        credits_used=float(user.credits_used),
        transactions=[
            CreditTransactionOut.model_validate(t) for t in txns
        ],
    )


@router.get("/subscription", response_model=SubscriptionOut)
def subscription(user: User = Depends(get_current_user)):
    return get_subscription_info(user)


@router.post("/estimate", response_model=CoreCostEstimateOut)
def estimate_cost(
    req: CoreCostEstimateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if req.scene not in ["aigc_rewrite", "pre_submission_review", "paper_revision"]:
        raise HTTPException(status_code=400, detail="Unknown scene")
    return CoreCostEstimateOut(**estimate_task_cost(user, req.scene, req.text_length, req.urgent, db))


@router.get("/top-up-packages", response_model=List[TopUpPackageOut])
def top_up_packages():
    return [TopUpPackageOut.model_validate(p) for p in list_top_up_packages()]


@router.post("/top-up")
def top_up(req: ApplyTopUpRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    amount = apply_top_up(db, user, req.package_id)
    if amount is None:
        raise HTTPException(status_code=400, detail="Invalid package")
    return {"ok": True, "credits_added": float(amount), "balance": float(user.credits)}


@router.get("/subscription-plans", response_model=List[SubscriptionPlanOut])
def subscription_plans():
    return [SubscriptionPlanOut.model_validate(p) for p in list_subscription_plans()]


@router.post("/subscribe")
def subscribe(req: ApplySubscriptionRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ok = apply_subscription(db, user, req.plan)
    if not ok:
        raise HTTPException(status_code=400, detail="Invalid plan")
    return {"ok": True, "subscription": get_subscription_info(user)}
