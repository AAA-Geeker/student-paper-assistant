from typing import Optional
from pydantic import BaseModel, EmailStr, ConfigDict
from decimal import Decimal


class UserCreate(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: int
    email: str
    credits: float
    credits_used: float
    subscription_plan: str
    is_premium: bool
    subscription_expires_at: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

    @classmethod
    def model_validate(cls, obj):
        data = {
            "id": obj.id,
            "email": obj.email,
            "credits": float(obj.credits),
            "credits_used": float(obj.credits_used),
            "subscription_plan": obj.subscription_plan,
            "is_premium": obj.is_premium,
            "subscription_expires_at": obj.subscription_expires_at.isoformat() if obj.subscription_expires_at else None,
        }
        return cls(**data)


class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserOut
