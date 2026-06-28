from __future__ import annotations

import os

os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("DATABASE_URL", "sqlite:///./data/test_app.db")
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-with-32-plus-chars")
os.environ.setdefault("SMTP_HOST", "")
os.environ.setdefault("FRONTEND_URL", "http://test")

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import src.models.lesson  # noqa: F401
import src.models.user  # noqa: F401
from src.db.base import Base
from src.db.session import get_db
from src.main import app


@pytest.fixture
def testing_session_local():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    session_local = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    Base.metadata.create_all(bind=engine)
    try:
        yield session_local
    finally:
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


@pytest_asyncio.fixture
async def client(testing_session_local):
    """Async HTTP client for testing API endpoints."""
    def override_get_db():
        db = testing_session_local()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.pop(get_db, None)
