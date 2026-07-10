from typing import List
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.paper import Paper
from app.schemas.paper import PaperCreate, PaperOut, PaperUpdate
from app.routers.auth import get_current_user
from app.utils.export import to_markdown, to_docx, to_pdf
from app.models.user import User
from urllib.parse import quote

router = APIRouter(tags=["papers"])

@router.post("", response_model=PaperOut)
def create_paper(payload: PaperCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    paper = Paper(title=payload.title, content=payload.content, outline=payload.outline, user_id=user.id)
    db.add(paper); db.commit(); db.refresh(paper)
    return paper

@router.get("", response_model=List[PaperOut])
def list_papers(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return db.query(Paper).filter(Paper.user_id == user.id).order_by(Paper.updated_at.desc()).all()

@router.get("/{paper_id}", response_model=PaperOut)
def get_paper(paper_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    paper = db.query(Paper).filter(Paper.id == paper_id, Paper.user_id == user.id).first()
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")
    return paper

@router.put("/{paper_id}", response_model=PaperOut)
def update_paper(paper_id: int, payload: PaperUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    paper = db.query(Paper).filter(Paper.id == paper_id, Paper.user_id == user.id).first()
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(paper, key, value)
    db.commit(); db.refresh(paper)
    return paper

@router.delete("/{paper_id}")
def delete_paper(paper_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    paper = db.query(Paper).filter(Paper.id == paper_id, Paper.user_id == user.id).first()
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")
    db.delete(paper); db.commit()
    return {"ok": True}

@router.get("/{paper_id}/export/{fmt}")
def export_paper(paper_id: int, fmt: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    paper = db.query(Paper).filter(Paper.id == paper_id, Paper.user_id == user.id).first()
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")
    fname = quote(paper.title.encode('utf-8'), safe='')
    if fmt == "md":
        return StreamingResponse(iter([to_markdown(paper.title, paper.content).encode()]), media_type="text/markdown", headers={"Content-Disposition": f"attachment; filename*=UTF-8''{fname}.md"})
    if fmt == "docx":
        buf = to_docx(paper.title, paper.content)
        return StreamingResponse(iter([buf.read()]), media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document", headers={"Content-Disposition": f"attachment; filename*=UTF-8''{fname}.docx"})
    if fmt == "pdf":
        buf = to_pdf(paper.title, paper.content)
        return StreamingResponse(iter([buf.read()]), media_type="application/pdf", headers={"Content-Disposition": f"attachment; filename*=UTF-8''{fname}.pdf"})
    raise HTTPException(status_code=400, detail="Unsupported format")
