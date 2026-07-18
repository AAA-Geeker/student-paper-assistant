"""
三大核心功能 API：
- 降重 / 降 AIGC 改写
- 投稿前审查
- 论文修改
"""

import asyncio
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.routers.auth import get_current_user
from app.schemas.commerce import (
    AigcRewriteRequest,
    PreSubmissionReviewRequest,
    PaperRevisionRequest,
)
from app.services.core_features import (
    aigc_rewrite,
    pre_submission_review,
    paper_revision,
    estimate_aigc_rewrite_cost,
    estimate_pre_submission_review_cost,
    estimate_paper_revision_cost,
)

router = APIRouter(tags=["core"])

# Shared event loop for running async estimate functions synchronously
_loop = None
def _get_loop():
    global _loop
    if _loop is None:
        _loop = asyncio.new_event_loop()
    return _loop

def _run_async(coro):
    loop = _get_loop()
    return loop.run_until_complete(coro)


@router.post("/aigc/estimate")
def aigc_estimate(
    req: AigcRewriteRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _run_async(estimate_aigc_rewrite_cost(user, req.text, req.urgent, db))


@router.post("/aigc")
async def aigc_rewrite_endpoint(
    req: AigcRewriteRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="文本不能为空")
    return await aigc_rewrite(req.text, req.target, req.platform, user, db, req.urgent, req.model)


@router.post("/review/estimate")
def review_estimate(
    req: PreSubmissionReviewRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _run_async(estimate_pre_submission_review_cost(user, req.text, req.urgent, db))


@router.post("/review")
async def review_endpoint(
    req: PreSubmissionReviewRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="论文内容不能为空")
    return await pre_submission_review(req.text, req.venue, req.venue_type, user, db, req.urgent, req.model)


@router.post("/revision/estimate")
def revision_estimate(
    req: PaperRevisionRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _run_async(estimate_paper_revision_cost(user, req.text, req.feedback, req.urgent, db))


@router.post("/revision")
async def revision_endpoint(
    req: PaperRevisionRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not req.text.strip() or not req.feedback.strip():
        raise HTTPException(status_code=400, detail="论文内容和反馈不能为空")
    return await paper_revision(req.text, req.feedback, req.style, user, db, req.urgent, req.model)
