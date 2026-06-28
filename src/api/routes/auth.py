from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from src.api.dependencies.auth import get_current_user
from src.db.session import get_db
from src.models.user import User
from src.schemas.auth import (
    AuthMessage,
    AuthToken,
    LoginRequest,
    RegisterRequest,
    ResendVerificationRequest,
    UserRead,
)
from src.services.auth import (
    authenticate_user,
    create_user,
    create_user_access_token,
    get_user_by_email,
    send_user_verification_email,
    verify_email_token,
)

router = APIRouter()


def _create_auth_token(db: Session, email: str, password: str) -> AuthToken:
    user = authenticate_user(db, email, password)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User is disabled")
    if not user.is_email_verified:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Please verify your email before logging in")
    return AuthToken(access_token=create_user_access_token(user), user=UserRead.model_validate(user))


@router.post("/register", response_model=AuthMessage, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> AuthMessage:
    if get_user_by_email(db, payload.email):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email is already registered")
    user = create_user(db, email=payload.email, password=payload.password, full_name=payload.full_name)
    verification_url = send_user_verification_email(db, user)
    return AuthMessage(
        message="Registration successful. Please verify your email before logging in.",
        verification_url=verification_url,
    )


@router.post("/login", response_model=AuthToken)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> AuthToken:
    return _create_auth_token(db, payload.email, payload.password)


@router.post("/token", response_model=AuthToken)
def token_login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)) -> AuthToken:
    return _create_auth_token(db, form_data.username, form_data.password)


@router.get("/verify-email", response_model=AuthMessage)
def verify_email(token: str = Query(..., min_length=1), db: Session = Depends(get_db)) -> AuthMessage:
    user = verify_email_token(db, token)
    if not user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired verification token")
    return AuthMessage(message="Email verified successfully. You can sign in now.")


@router.post("/resend-verification", response_model=AuthMessage)
def resend_verification(payload: ResendVerificationRequest, db: Session = Depends(get_db)) -> AuthMessage:
    verification_url: str | None = None
    user = get_user_by_email(db, payload.email)
    if user and user.is_active and not user.is_email_verified:
        verification_url = send_user_verification_email(db, user)
    return AuthMessage(
        message="If the email exists and is not verified, a new verification link was sent.",
        verification_url=verification_url,
    )


@router.get("/me", response_model=UserRead)
def read_current_user(current_user: User = Depends(get_current_user)) -> UserRead:
    return UserRead.model_validate(current_user)
