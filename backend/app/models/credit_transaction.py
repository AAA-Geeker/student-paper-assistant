from sqlalchemy import Column, Integer, String, Numeric, DateTime, Text, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base


class CreditTransaction(Base):
    """点数收支记录"""
    __tablename__ = "credit_transactions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    # income / expense
    type = Column(String, nullable=False)
    # 具体场景：register_gift / top_up / aigc_rewrite / pre_submission_review / paper_revision / skill_usage / subscription / urgent
    scene = Column(String, nullable=False)
    amount = Column(Numeric(precision=10, scale=2), nullable=False)
    balance_after = Column(Numeric(precision=10, scale=2), nullable=False)
    description = Column(Text, default="")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="transactions")
