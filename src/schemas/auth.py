from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    full_name: str | None = Field(default=None, max_length=255)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=128)


class ResendVerificationRequest(BaseModel):
    email: EmailStr


class UserRead(BaseModel):
    id: int
    email: EmailStr
    full_name: str | None
    role: str
    is_active: bool
    is_email_verified: bool
    model_config = {"from_attributes": True}


class AuthToken(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserRead


class AuthMessage(BaseModel):
    message: str
    verification_url: str | None = None
