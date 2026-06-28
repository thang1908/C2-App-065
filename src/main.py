from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, status
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from src.api.router import api_router
from src.config import get_settings
from src.core.middleware import setup_middleware
from src.db.session import init_db
from src.services.storage import (
    EXPORTS_DIR,
    ensure_storage_dirs,
)

WEB_DIR = Path(__file__).resolve().parent.parent / "web"


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    print(f"Starting {settings.app_name} in {settings.app_env} mode")
    ensure_storage_dirs()
    init_db()
    yield
    print("Shutting down...")


app = FastAPI(
    title="EduMate Lesson Studio",
    description="Template-preserving lesson plan generator",
    version="2.0.0",
    lifespan=lifespan,
)

settings = get_settings()
setup_middleware(app, settings)

app.include_router(api_router, prefix="/api/v1")

Path(EXPORTS_DIR).mkdir(parents=True, exist_ok=True)
Path(WEB_DIR).mkdir(parents=True, exist_ok=True)
app.mount("/exports", StaticFiles(directory=str(EXPORTS_DIR)), name="exports")
app.mount("/web", StaticFiles(directory=str(WEB_DIR)), name="web")


@app.get("/", include_in_schema=False)
async def web_app():
    return FileResponse(WEB_DIR / "index.html", headers={"Cache-Control": "no-store"})


@app.get("/health")
async def health():
    return {"status": "ok", "env": settings.app_env}


@app.api_route("/api/{full_path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"], include_in_schema=False)
async def missing_api_route(full_path: str):
    _ = full_path
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not Found")


@app.get("/{full_path:path}", include_in_schema=False)
async def spa_fallback(full_path: str):
    if full_path.startswith(("api/", "exports/", "web/")):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not Found")
    return FileResponse(WEB_DIR / "index.html", headers={"Cache-Control": "no-store"})
