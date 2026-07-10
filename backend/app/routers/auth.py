from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.schemas.user import UserCreate, UserOut, Token
from app.services.auth import get_password_hash, verify_password, create_access_token, decode_token
from app.config import settings

router = APIRouter(tags=["auth"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

@router.post("/register", response_model=UserOut)
def register(payload: UserCreate, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(email=payload.email, hashed_password=get_password_hash(payload.password))
    db.add(user); db.commit(); db.refresh(user)
    return user

@router.post("/login", response_model=Token)
def login(payload: UserCreate, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Invalid credentials")
    token = create_access_token(
        {"sub": str(user.id)},
        timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    return {"access_token": token, "token_type": "bearer"}

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    payload = decode_token(token)
    if not payload or not payload.get("sub"):
        raise HTTPException(status_code=401, detail="Invalid token")
    user = db.query(User).filter(User.id == int(payload["sub"])).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user
