import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from app.database import engine, Base
from app.routers import auth, papers, ai

Base.metadata.create_all(bind=engine)

app = FastAPI(title="学生论文写作助手")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(papers.router, prefix="/api/papers", tags=["papers"])
app.include_router(ai.router, prefix="/api/ai", tags=["ai"])


@app.get("/api/health")
def health():
    return {"status": "ok"}


# ─── Serve frontend static files in production ─────────────────────
_BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # backend/
FRONTEND_DIR = os.path.join(_BASE_DIR, "static")

if os.path.isdir(FRONTEND_DIR):
    # Mount static assets (JS, CSS, images)
    assets_dir = os.path.join(FRONTEND_DIR, "assets")
    if os.path.isdir(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    # Serve index.html for all non-API routes (SPA fallback)
    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str = ""):
        file_path = os.path.join(FRONTEND_DIR, full_path) if full_path else os.path.join(FRONTEND_DIR, "index.html")
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))
