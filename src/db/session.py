from __future__ import annotations

from collections.abc import Generator
from pathlib import Path
from time import sleep

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import Engine, make_url
from sqlalchemy.exc import NoSuchModuleError, OperationalError
from sqlalchemy.orm import Session, sessionmaker

from src.config import get_settings
from src.db.base import Base

DEFAULT_SQLITE_URL = "sqlite:///./data/app.db"

SessionLocal: sessionmaker[Session] | None = None
_engine: Engine | None = None
_resolved_database_url: str | None = None


def _connect_args(database_url: str) -> dict[str, object]:
    if database_url.startswith("sqlite"):
        return {"check_same_thread": False}
    return {}


def _ensure_sqlite_parent(database_url: str) -> None:
    url = make_url(database_url)
    if url.drivername.startswith("sqlite") and url.database not in (None, "", ":memory:"):
        Path(url.database).expanduser().parent.mkdir(parents=True, exist_ok=True)


def _configured_database_url() -> str:
    settings = get_settings()
    return settings.database_url.strip() or DEFAULT_SQLITE_URL


def _configure_session_factory(database_url: str) -> Engine:
    global SessionLocal, _engine, _resolved_database_url
    _ensure_sqlite_parent(database_url)
    _engine = create_engine(
        database_url,
        connect_args=_connect_args(database_url),
        pool_pre_ping=True,
    )
    SessionLocal = sessionmaker(bind=_engine, autoflush=False, autocommit=False)
    _resolved_database_url = database_url
    return _engine


def get_engine() -> Engine:
    global _engine
    if _engine is None:
        _engine = _configure_session_factory(_configured_database_url())
    return _engine


def _fallback_to_local_sqlite(cause: Exception) -> Engine:
    settings = get_settings()
    if settings.app_env == "production" or not settings.database_allow_sqlite_fallback:
        raise cause
    if _resolved_database_url != DEFAULT_SQLITE_URL:
        print(f"Primary database unavailable ({cause!r}). Falling back to {DEFAULT_SQLITE_URL}.")
    return _configure_session_factory(DEFAULT_SQLITE_URL)


def init_db() -> None:
    """Create database tables registered on Base metadata."""
    import src.models.lesson  # noqa: F401
    import src.models.user  # noqa: F401

    settings = get_settings()
    last_error: Exception | None = None

    for attempt in range(1, settings.database_connect_retries + 1):
        try:
            engine = get_engine()
            Base.metadata.create_all(bind=engine)
            _run_lightweight_migrations(engine)
            _bootstrap_configured_admins(engine)
            return
        except (ModuleNotFoundError, NoSuchModuleError, OperationalError) as exc:
            last_error = exc
            if (
                settings.app_env != "production"
                and settings.database_allow_sqlite_fallback
                and _configured_database_url() != DEFAULT_SQLITE_URL
            ):
                engine = _fallback_to_local_sqlite(exc)
                Base.metadata.create_all(bind=engine)
                _run_lightweight_migrations(engine)
                _bootstrap_configured_admins(engine)
                return
            if attempt == settings.database_connect_retries:
                break
            sleep(settings.database_connect_retry_seconds)

    if last_error is not None:
        raise last_error


def _run_lightweight_migrations(engine: Engine) -> None:
    inspector = inspect(engine)
    table_names = set(inspector.get_table_names())
    migrations: list[str] = []

    if "users" in table_names:
        user_columns = {column["name"] for column in inspector.get_columns("users")}
        if "role" not in user_columns:
            migrations.append("ALTER TABLE users ADD COLUMN role VARCHAR(32) NOT NULL DEFAULT 'user'")

    if "lesson_templates" in table_names:
        template_columns = {column["name"] for column in inspector.get_columns("lesson_templates")}
        if "visibility" not in template_columns:
            migrations.append("ALTER TABLE lesson_templates ADD COLUMN visibility VARCHAR(32) NOT NULL DEFAULT 'personal'")

    if not migrations:
        return

    with engine.begin() as connection:
        for migration in migrations:
            connection.execute(text(migration))


def _bootstrap_configured_admins(engine: Engine) -> None:
    settings = get_settings()
    admin_emails = [email.strip().lower() for email in settings.admin_emails.split(",") if email.strip()]
    if not admin_emails:
        return

    with engine.begin() as connection:
        for email in admin_emails:
            connection.execute(text("UPDATE users SET role = 'admin' WHERE lower(email) = :email"), {"email": email})


def get_db() -> Generator[Session, None, None]:
    global SessionLocal
    if SessionLocal is None:
        try:
            get_engine()
        except (ModuleNotFoundError, NoSuchModuleError, OperationalError) as exc:
            _fallback_to_local_sqlite(exc)

    if SessionLocal is None:
        raise RuntimeError("Database session factory is not configured")

    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
