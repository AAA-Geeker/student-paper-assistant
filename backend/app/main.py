from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
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
