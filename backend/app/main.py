import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from app.database import engine, Base, SessionLocal
from app.routers import auth, papers, ai, me, core
from app.services.credits import auto_downgrade_expired_subscriptions

Base.metadata.create_all(bind=engine)

app = FastAPI(title="学生论文写作助手")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 应用启动时自动降级已过期的订阅
@app.on_event("startup")
def startup_downgrade():
    db = SessionLocal()
    try:
        count = auto_downgrade_expired_subscriptions(db)
        if count > 0:
            print(f"[startup] 已降级 {count} 个过期订阅")
    except Exception as e:
        print(f"[startup] 订阅降级检查失败 (非关键): {e}")
    finally:
        db.close()

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(papers.router, prefix="/api/papers", tags=["papers"])
app.include_router(ai.router, prefix="/api/ai", tags=["ai"])
app.include_router(me.router, prefix="/api/me", tags=["me"])
app.include_router(core.router, prefix="/api/core", tags=["core"])


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
