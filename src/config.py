from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # App
    app_name: str = "AI20K Lesson Studio"
    app_env: Literal["development", "production", "test"] = "development"
    app_port: int = Field(default=8000, ge=1, le=65535)
    app_host: str = "0.0.0.0"
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"
    cors_origins: str = "http://localhost:3000"
    frontend_url: str = "http://localhost:3000"

    # Database
    database_url: str = "sqlite:///./data/app.db"
    database_connect_retries: int = Field(default=5, ge=1, le=30)
    database_connect_retry_seconds: float = Field(default=1.0, ge=0.1, le=10.0)
    database_allow_sqlite_fallback: bool = False

    # Auth
    jwt_secret_key: str = "replace-with-a-long-random-secret"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = Field(default=60, ge=5, le=10080)
    email_verification_token_expire_hours: int = Field(default=24, ge=1, le=168)
    admin_emails: str = ""

    # Email
    smtp_host: str = ""
    smtp_port: int = Field(default=587, ge=1, le=65535)
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_from_email: str = "noreply@example.com"
    smtp_use_tls: bool = True
    email_verification_url_base: str = ""

    # AI
    openai_api_key: str = ""
    openai_model: str = "gpt-4o"


@lru_cache
def get_settings() -> Settings:
    return Settings()
