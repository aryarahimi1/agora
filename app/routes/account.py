import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.user import User
from app.schemas.auth import UserPublic
from app.security import get_current_user

router = APIRouter(prefix="/api/account", tags=["account"])
logger = logging.getLogger(__name__)

_OPENROUTER_KEY_PREFIXES = ("sk-or-v1-", "sk-or-")


class AccountPatch(BaseModel):
    # Pydantic marks fields absent from the JSON payload in model_fields_set,
    # which lets us distinguish "not provided" (skip) from explicit null (clear).
    name: Optional[str] = Field(default=None)
    openrouter_api_key: Optional[str] = Field(default=None)

    @field_validator("name")
    @classmethod
    def _validate_name(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and (len(v) < 1 or len(v) > 100):
            raise ValueError("name must be between 1 and 100 characters")
        return v

    @field_validator("openrouter_api_key")
    @classmethod
    def _validate_key(cls, v: Optional[str]) -> Optional[str]:
        if v is None or v == "":
            return None
        if not any(v.startswith(p) for p in _OPENROUTER_KEY_PREFIXES):
            raise ValueError("Not a valid OpenRouter API key")
        return v


@router.get("", response_model=UserPublic)
async def get_account(
    current_user: User = Depends(get_current_user),
) -> UserPublic:
    return UserPublic.model_validate(current_user)


@router.patch("", response_model=UserPublic)
async def patch_account(
    body: AccountPatch,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserPublic:
    changed = False

    if "name" in body.model_fields_set:
        current_user.name = body.name
        changed = True

    if "openrouter_api_key" in body.model_fields_set:
        # Empty string and null both clear the key.
        current_user.openrouter_api_key = body.openrouter_api_key or None
        changed = True

    if changed:
        current_user.updated_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(current_user)

    return UserPublic.model_validate(current_user)
