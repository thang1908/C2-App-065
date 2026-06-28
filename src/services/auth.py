from __future__ import annotations

import secrets
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from src.config import get_settings
from src.core.security import (
    create_access_token,
    hash_password,
    hash_token,
    utc_now,
    verify_password,
)
from src.models.user import EmailVerificationToken, User
from src.services.email import send_verification_email


def configured_admin_emails() -> set[str]:
    settings = get_settings()
    return {email.strip().lower() for email in settings.admin_emails.split(",") if email.strip()}


def is_configured_admin_email(email: str) -> bool:
    return email.lower().strip() in configured_admin_emails()


def sync_configured_admin_role(db: Session, user: User) -> User:
    if is_configured_admin_email(user.email) and user.role != "admin":
        user.role = "admin"
        user.updated_at = utc_now()
        db.add(user)
        db.commit()
        db.refresh(user)
    return user


def get_user_by_email(db: Session, email: str) -> User | None:
    normalized_email = email.lower().strip()
    return db.scalar(select(User).where(User.email == normalized_email))


def get_user_by_id(db: Session, user_id: int) -> User | None:
    return db.get(User, user_id)


def create_user(db: Session, email: str, password: str, full_name: str | None = None) -> User:
    now = utc_now()
    normalized_email = email.lower().strip()
    user = User(
        email=normalized_email,
        full_name=full_name.strip() if full_name else None,
        hashed_password=hash_password(password),
        role="admin" if is_configured_admin_email(normalized_email) else "user",
        is_active=True,
        is_email_verified=False,
        created_at=now,
        updated_at=now,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def authenticate_user(db: Session, email: str, password: str) -> User | None:
    user = get_user_by_email(db, email)
    if not user or not verify_password(password, user.hashed_password):
        return None
    return user


def create_user_access_token(user: User) -> str:
    return create_access_token(str(user.id))


def create_email_verification_token(db: Session, user: User) -> str:
    settings = get_settings()
    raw_token = secrets.token_urlsafe(32)
    now = utc_now()
    token = EmailVerificationToken(
        user_id=user.id,
        token_hash=hash_token(raw_token),
        expires_at=now + timedelta(hours=settings.email_verification_token_expire_hours),
        created_at=now,
    )
    db.add(token)
    db.commit()
    return raw_token


def build_frontend_verification_url(token: str) -> str:
    settings = get_settings()
    return f"{settings.frontend_url.rstrip('/')}/?verify_token={token}"


def build_delivery_verification_url(token: str) -> str:
    settings = get_settings()
    base_url = settings.email_verification_url_base.strip()
    if not base_url:
        return build_frontend_verification_url(token)
    separator = "&" if "?" in base_url else "?"
    return f"{base_url}{separator}token={token}"


def send_user_verification_email(db: Session, user: User) -> str | None:
    token = create_email_verification_token(db, user)
    delivered = send_verification_email(user.email, build_delivery_verification_url(token))
    if delivered:
        return None
    return build_frontend_verification_url(token)


def verify_email_token(db: Session, raw_token: str) -> User | None:
    token_hash = hash_token(raw_token)
    token = db.scalar(
        select(EmailVerificationToken).where(
            EmailVerificationToken.token_hash == token_hash,
            EmailVerificationToken.used_at.is_(None),
        )
    )
    if not token or token.expires_at < utc_now():
        return None

    user = db.get(User, token.user_id)
    if not user or not user.is_active:
        return None

    now = utc_now()
    user.is_email_verified = True
    user.updated_at = now
    token.used_at = now
    db.commit()
    db.refresh(user)
    return user
