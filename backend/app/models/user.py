from sqlalchemy import Column, Integer, String, DateTime, Numeric, Boolean
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    # 资产体系：点数（1元 = 100点）
    credits = Column(Numeric(precision=10, scale=2), default=1000.00, nullable=False)
    credits_used = Column(Numeric(precision=10, scale=2), default=0.00, nullable=False)
    # 商业化：订阅与加急
    subscription_plan = Column(String, default="free", nullable=False)  # free / pro / premium
    subscription_expires_at = Column(DateTime(timezone=True), nullable=True)
    is_premium = Column(Boolean, default=False, nullable=False)
    papers = relationship("Paper", back_populates="user", cascade="all, delete-orphan")
    transactions = relationship("CreditTransaction", back_populates="user", cascade="all, delete-orphan")
