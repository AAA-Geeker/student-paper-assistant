FROM python:3.11-slim

WORKDIR /app

# Install runtime libs only (no gcc, no dev headers)
# 使用腾讯云内网 apt 镜像，避免 deb.debian.org 速度慢/卡顿
RUN sed -i 's|deb.debian.org|mirrors.tencentyun.com|g' /etc/apt/sources.list.d/debian.sources 2>/dev/null; \
    apt-get update \
    && apt-get install -y --no-install-recommends \
       libpq5 libcairo2 libpango-1.0-0 libpangocairo-1.0-0 \
       libgdk-pixbuf-2.0-0 libffi8 shared-mime-info fonts-noto-cjk \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -i https://mirrors.tencentyun.com/pypi/simple/ -r requirements.txt

COPY app/ ./app/

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
