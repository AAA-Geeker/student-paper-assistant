from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.schemas.user import UserCreate, UserOut, Token, SendCodeRequest, RegisterRequest
from app.services.auth import get_password_hash, verify_password, create_access_token, decode_token
from app.services import email_service
from app.config import settings
from app.services.credits import gift_registration_credits

router = APIRouter(tags=["auth"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    payload = decode_token(token)
    if not payload or not payload.get("sub"):
        raise HTTPException(status_code=401, detail="Invalid token")
    user = db.query(User).filter(User.id == int(payload["sub"])).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def _norm_email(email: str) -> str:
    return (email or "").strip().lower()


@router.post("/send-code")
def send_code(payload: SendCodeRequest, db: Session = Depends(get_db)):
    """向指定邮箱发送注册验证码（用于验证邮箱真实性）。"""
    email = _norm_email(payload.email)
    if not email or "@" not in email or "." not in email.split("@")[-1]:
        raise HTTPException(status_code=400, detail="邮箱格式不正确")

    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=400, detail="该邮箱已被注册，请直接登录")

    if email_service.too_many_recent_codes(db, email):
        raise HTTPException(status_code=429, detail="发送过于频繁，请稍后再试")

    if not email_service.smtp_configured():
        raise HTTPException(
            status_code=503,
            detail="邮箱服务暂未配置，无法发送验证码，请联系客服或在管理员配置 SMTP 后重试",
        )

    ok, msg = email_service.send_code(db, email)
    if not ok:
        raise HTTPException(status_code=500, detail=msg)
    return {"ok": True, "message": msg}


@router.post("/register", response_model=Token)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    email = _norm_email(payload.email)

    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    # 必须通过邮箱验证码，防止用虚假邮箱注册
    ok, msg = email_service.verify_code(db, email, payload.code)
    if not ok:
        raise HTTPException(status_code=400, detail=msg)

    user = User(email=email, hashed_password=get_password_hash(payload.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    gift_registration_credits(db, user)
    token = create_access_token(
        {"sub": str(user.id)},
        timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    return {"access_token": token, "token_type": "bearer", "user": UserOut.model_validate(user)}


@router.post("/login", response_model=Token)
def login(payload: UserCreate, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == _norm_email(payload.email)).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Invalid credentials")
    token = create_access_token(
        {"sub": str(user.id)},
        timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    return {"access_token": token, "token_type": "bearer", "user": UserOut.model_validate(user)}


@router.get("/me", response_model=UserOut)
def auth_me(user: User = Depends(get_current_user)):
    return UserOut.model_validate(user)
