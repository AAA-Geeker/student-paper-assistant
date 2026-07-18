from pydantic import BaseModel
from decimal import Decimal
from typing import Optional, List
from datetime import datetime


class CreditTransactionOut(BaseModel):
    id: int
    type: str
    scene: str
    amount: float
    balance_after: float
    description: str
    created_at: datetime


class CreditsOut(BaseModel):
    credits: float
    credits_used: float
    transactions: List[CreditTransactionOut]


class CoreCostEstimateRequest(BaseModel):
    scene: str  # aigc_rewrite / pre_submission_review / paper_revision
    text_length: int
    urgent: bool = False


class CoreCostEstimateOut(BaseModel):
    scene: str
    scene_name: str
    points: float
    is_free: bool
    discount: int
    urgent: bool


class AigcRewriteRequest(BaseModel):
    text: str
    target: str = "both"  # plagiarism | aigc | both
    platform: str = "知网"  # 知网/维普/万方/Turnitin/GPTZero/格子达
    urgent: bool = False
    model: str = "deepseek"


class PreSubmissionReviewRequest(BaseModel):
    text: str
    venue: str  # ACL / EMNLP / SCI / CVPR / 国内核心 等
    venue_type: str = "conference"  # conference | journal
    urgent: bool = False
    model: str = "deepseek"


class PaperRevisionRequest(BaseModel):
    text: str
    feedback: str
    style: str = "standard"  # minimal / standard / deep
    urgent: bool = False
    model: str = "deepseek"


class TopUpPackageOut(BaseModel):
    id: str
    name: str
    credits: int
    bonus: int
    total_credits: int
    price_rmb: int


class SubscriptionPlanOut(BaseModel):
    id: str
    name: str
    monthly_price_rmb: int
    yearly_price_rmb: int = 0
    monthly_discount_label: str = ""
    daily_free_core: int
    discount_percent: int
    description: str


class SubscriptionOut(BaseModel):
    plan: str
    plan_label: str
    monthly_price_rmb: int
    daily_free_core: int
    discount_percent: int
    expires_at: Optional[str]
    is_active: bool
    is_premium: bool


class ApplyTopUpRequest(BaseModel):
    package_id: str


class ApplySubscriptionRequest(BaseModel):
    plan: str  # free / pro / premium
