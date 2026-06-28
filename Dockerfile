# ---- Stage 1: Build ----
FROM python:3.11-slim AS builder

WORKDIR /app

ENV VENV_PATH=/opt/venv \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1
RUN python -m venv $VENV_PATH
ENV PATH=$VENV_PATH/bin:$PATH

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ---- Stage 2: Frontend Build ----
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend ./
RUN npm run build

# ---- Stage 3: Production ----
FROM python:3.11-slim

WORKDIR /app

# Copy installed packages from builder
ENV VENV_PATH=/opt/venv \
    PATH=/opt/venv/bin:$PATH \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    APP_ENV=production
COPY --from=builder $VENV_PATH $VENV_PATH

# Security: run as non-root user
RUN useradd -m appuser

# Copy only runtime application code and built static frontend.
COPY src ./src
COPY --from=frontend-builder /app/web /app/web

# Create data and storage directories with correct ownership
RUN mkdir -p /app/data /app/storage && chown -R appuser:appuser /app/data /app/storage

USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health')" || exit 1

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
