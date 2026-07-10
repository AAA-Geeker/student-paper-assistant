from io import BytesIO
from docx import Document

def to_markdown(title: str, content: str) -> str:
    return "# " + title + "\n\n" + content

def to_docx(title: str, content: str) -> BytesIO:
    doc = Document()
    doc.add_heading(title, level=1)
    for para in content.split("\n\n"):
        if para.strip():
            doc.add_paragraph(para)
    buf = BytesIO()
    doc.save(buf)
    buf.seek(0)
    return buf

def to_pdf(title: str, content: str) -> BytesIO:
    try:
        from weasyprint import HTML
    except ImportError:
        raise RuntimeError("PDF export requires weasyprint. Install it or use markdown/docx.")
    html = f"<html><head><meta charset=\"utf-8\"></head><body><h1>{title}</h1><div style=\"white-space: pre-wrap;\">{content.replace(chr(10), '<br>')}</div></body></html>"
    buf = BytesIO()
    HTML(string=html).write_pdf(buf)
    buf.seek(0)
    return buf
