from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.config import Settings


def setup_middleware(app: FastAPI, settings: Settings) -> None:
    """Register application middleware."""
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_parse_cors_origins(settings.cors_origins),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


def _parse_cors_origins(value: str) -> list[str]:
    return [origin.strip() for origin in value.split(",") if origin.strip()]
