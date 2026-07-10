# ─── Stage 1: Build frontend ──────────────────────────────────────
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ─── Stage 2: Backend with frontend static files ───────────────────
FROM python:3.11-slim
WORKDIR /app

# Install system dependencies for PDF export
RUN apt-get update && apt-get install -y --no-install-recommends \
    fonts-noto-cjk \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt weasyprint email-validator

# Copy backend code
COPY backend/ .

# Copy frontend build from stage 1
COPY --from=frontend-build /app/frontend/dist/ ./static/

# Create data directory for SQLite
RUN mkdir -p /app/data

ENV DATABASE_URL=sqlite:////app/data/app.db

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
