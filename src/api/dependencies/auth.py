from __future__ import annotations

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from src.core.security import decode_access_token
from src.db.session import get_db
from src.models.user import User
from src.services.auth import get_user_by_id, sync_configured_admin_role

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/token")


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_access_token(token)
        subject = payload.get("sub")
        if subject is None:
            raise credentials_error
        user_id = int(subject)
    except (jwt.InvalidTokenError, ValueError):
        raise credentials_error from None

    user = get_user_by_id(db, user_id)
    if user is None or not user.is_active:
        raise credentials_error
    return sync_configured_admin_role(db, user)


def get_verified_user(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_email_verified:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Email address is not verified")
    return current_user


def get_admin_user(current_user: User = Depends(get_verified_user)) -> User:
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin permission is required")
    return current_user
