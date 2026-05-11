import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator


class SignupRequest(BaseModel):
    email: EmailStr
    password: str
    name: Optional[str] = None

    @field_validator("password")
    @classmethod
    def password_bounds(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("password must be at least 8 characters")
        # bcrypt silently truncates beyond 72 bytes — reject rather than mislead.
        if len(v.encode("utf-8")) > 72:
            raise ValueError("password must be 72 bytes or fewer")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserPublic(BaseModel):
    id: uuid.UUID
    email: str
    name: Optional[str]
    created_at: datetime
    email_verified_at: Optional[datetime] = None
    openrouter_key_set: bool = False

    # Accept the raw column value during construction but never expose it.
    # exclude=True means it is dropped from model_dump() / JSON responses.
    openrouter_api_key: Optional[str] = Field(default=None, exclude=True)

    model_config = {"from_attributes": True}

    @model_validator(mode="after")
    def _derive_key_set(self) -> "UserPublic":
        self.openrouter_key_set = self.openrouter_api_key is not None
        return self


class TokenResponse(BaseModel):
    user: UserPublic
    access_token: str
    token_type: str = "bearer"
