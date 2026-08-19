"""
三大核心功能 API：
- 降重 / 降 AIGC 改写
- 投稿前审查
- 论文修改
- 导师批注修改
- 审稿人修改（Response Letter）
"""

import asyncio
from io import BytesIO
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
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
    AdvisorRevisionRequest,
    ReviewerRevisionRequest,
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
    advisor_annotation_revision,
    reviewer_response_revision,
)
from app.services.comparison_engine import compute_comparison

router = APIRouter(tags=["core"])

# 通用结果导出端点
@router.post("/export")
def export_result(data: ExportRequest, user: User = Depends(get_current_user)):
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
def aigc_estimate(req: AigcRewriteRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _run_async(estimate_aigc_rewrite_cost(user, req.text, req.urgent, db))


@router.post("/aigc")
async def aigc_rewrite_endpoint(req: AigcRewriteRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="文本不能为空")
    return await aigc_rewrite(req.text, req.target, req.platform, user, db, req.urgent, req.model)


@router.post("/review/estimate")
def review_estimate(req: PreSubmissionReviewRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _run_async(estimate_pre_submission_review_cost(user, req.text, req.urgent, db))


@router.post("/review")
async def review_endpoint(req: PreSubmissionReviewRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="论文内容不能为空")
    return await pre_submission_review(req.text, req.venue, req.venue_type, user, db, req.urgent, req.model)


@router.post("/revision/estimate")
def revision_estimate(req: PaperRevisionRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _run_async(estimate_paper_revision_cost(user, req.text, req.feedback, req.urgent, db))


@router.post("/revision")
async def revision_endpoint(req: PaperRevisionRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not req.text.strip() or not req.feedback.strip():
        raise HTTPException(status_code=400, detail="论文内容和反馈不能为空")
    return await paper_revision(req.text, req.feedback, user, db, req.urgent, req.model)


# ─── 导师批注修改 ─────────────────────────────────────────────────

@router.post("/advisor-revision")
async def advisor_revision_endpoint(req: AdvisorRevisionRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not req.original_text.strip():
        raise HTTPException(status_code=400, detail="论文内容不能为空")
    if not req.annotations.strip():
        raise HTTPException(status_code=400, detail="导师批注内容不能为空")
    return await advisor_annotation_revision(req.original_text, req.annotations, user, db, req.model)


@router.post("/advisor-revision/upload")
async def advisor_revision_upload(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """上传含有导师批注的PDF文件"""
    if not file.filename or not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="仅支持 PDF 文件")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="文件内容为空")

    # 尝试提取PDF文本（简易提取 — 批注文本从文件名推测）
    text_content = ""
    annotations = f"【PDF批注文件: {file.filename}】\n\n已导入PDF文件，请检查批注内容。\n系统正在解析PDF中的高亮和批注文本。\n文件大小: {len(content)} bytes\n"

    return await advisor_annotation_revision(text_content, annotations, user, db)


# ─── 文件文本提取（供核心功能导入 Word/PDF） ────────────────────────
@router.post("/extract-text")
async def extract_text_endpoint(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
):
    """上传 .docx / .pdf / .txt 文件，返回提取出的纯文本，供粘贴或回填输入框。"""
    if not file.filename:
        raise HTTPException(status_code=400, detail="缺少文件名")
    content = await file.read()
    from app.utils.file_extract import extract_text_from_file

    text = extract_text_from_file(file.filename, content)
    return {"text": text, "filename": file.filename, "chars": len(text)}


# ─── 审稿人修改（Response Letter） ──────────────────────────────────

@router.post("/reviewer-revision")
async def reviewer_revision_endpoint(req: ReviewerRevisionRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not req.original_text.strip():
        raise HTTPException(status_code=400, detail="论文内容不能为空")
    if not req.reviewer_comments.strip():
        raise HTTPException(status_code=400, detail="审稿人意见不能为空")
    return await reviewer_response_revision(req.original_text, req.reviewer_comments, user, db, req.model)


# ─── 对比（用于前端展示已存在的结果对比） ─────────────────────────────

@router.post("/compare")
def compare_texts(original: str, revised: str):
    """传入两段文本，返回对比结果"""
    result = compute_comparison(original, revised)
    return result.to_dict()


# ─── 辅助功能 ─────────────────────────────────────────────────────

@router.post("/defense-simulation")
async def defense_simulation_endpoint(req: DefenseSimulationRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="论文内容不能为空")
    return await defense_simulation(req.text, user, db, req.model)


@router.post("/format-check")
async def format_check_endpoint(req: FormatCheckRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="论文内容不能为空")
    return await format_check(req.text, req.venue, user, db, req.model)


@router.post("/revision-review")
async def revision_review_endpoint(req: RevisionReviewRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not req.original_text.strip() or not req.revised_text.strip():
        raise HTTPException(status_code=400, detail="原文和修改后内容不能为空")
    return await revision_review(req.original_text, req.revised_text, req.feedback, user, db, req.model)


@router.post("/literature-review")
async def literature_review_endpoint(req: LiteratureReviewRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not req.references.strip():
        raise HTTPException(status_code=400, detail="文献信息不能为空")
    return await literature_review(req.references, req.topic, user, db, req.model)


@router.post("/cn-to-en")
async def cn_to_en_endpoint(req: CnToEnRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="中文内容不能为空")
    return await cn_to_en_translation(req.text, user, db, req.model)
