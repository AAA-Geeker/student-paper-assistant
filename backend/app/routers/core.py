"""
三大核心功能 API：
- 降重 / 降 AIGC 改写
- 投稿前审查
- 论文修改
"""

import asyncio
from io import BytesIO
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.routers.auth import get_current_user
from app.schemas.commerce import (
    AigcRewriteRequest,
    PreSubmissionReviewRequest,
    PaperRevisionRequest,
    ExportRequest,
    DefenseSimulationRequest,
    FormatCheckRequest,
    RevisionReviewRequest,
    LiteratureReviewRequest,
    CnToEnRequest,
)
from app.services.core_features import (
    aigc_rewrite,
    pre_submission_review,
    paper_revision,
    estimate_aigc_rewrite_cost,
    estimate_pre_submission_review_cost,
    estimate_paper_revision_cost,
    defense_simulation,
    format_check,
    revision_review,
    literature_review,
    cn_to_en_translation,
)

router = APIRouter(tags=["core"])

# 通用结果导出端点（供三大功能的结果下载使用）
@router.post("/export")
def export_result(
    data: ExportRequest,
    user: User = Depends(get_current_user),
):
    """导出生成结果为文件。body: {content, title, format} format=md/docx/pdf"""
    title = data.title or "论文助手-导出结果"
    content = data.content
    fmt = data.format

    from app.utils.export import to_markdown, to_docx, to_pdf

    if fmt == "md":
        buf = BytesIO(to_markdown(title, content).encode("utf-8"))
        media_type = "text/markdown"
        ext = "md"
    elif fmt == "docx":
        buf = to_docx(title, content)
        media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        ext = "docx"
    elif fmt == "pdf":
        buf = to_pdf(title, content)
        media_type = "application/pdf"
        ext = "pdf"
    else:
        raise HTTPException(status_code=400, detail="Unsupported format")

    from urllib.parse import quote
    fname = quote(title.encode("utf-8"), safe='')
    return StreamingResponse(
        iter([buf.read()]),
        media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{fname}.{ext}"}
    )

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


# ─── 5. 答辩模拟 ─────────────────────────────────────────────────

@router.post("/defense-simulation")
async def defense_simulation_endpoint(
    req: DefenseSimulationRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="论文内容不能为空")
    return await defense_simulation(req.text, user, db, req.model)


# ─── 6. 投稿格式预检 ─────────────────────────────────────────────

@router.post("/format-check")
async def format_check_endpoint(
    req: FormatCheckRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="论文内容不能为空")
    return await format_check(req.text, req.venue, user, db, req.model)


# ─── 7. 改后复查 ─────────────────────────────────────────────────

@router.post("/revision-review")
async def revision_review_endpoint(
    req: RevisionReviewRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not req.original_text.strip() or not req.revised_text.strip():
        raise HTTPException(status_code=400, detail="原文和修改后内容不能为空")
    return await revision_review(req.original_text, req.revised_text, req.feedback, user, db, req.model)


# ─── 8. 文献综述生成 ─────────────────────────────────────────────

@router.post("/literature-review")
async def literature_review_endpoint(
    req: LiteratureReviewRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not req.references.strip():
        raise HTTPException(status_code=400, detail="文献信息不能为空")
    return await literature_review(req.references, req.topic, user, db, req.model)


# ─── 9. 中译英学术润色 ─────────────────────────────────────────

@router.post("/cn-to-en")
async def cn_to_en_endpoint(
    req: CnToEnRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="中文内容不能为空")
    return await cn_to_en_translation(req.text, user, db, req.model)
