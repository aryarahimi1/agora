import asyncio
import logging
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException

from app.config import settings
from app.models.user import User
from app.openrouter_client import fetch_models
from app.security import get_current_user

router = APIRouter(prefix="/api/openrouter", tags=["openrouter"])
logger = logging.getLogger(__name__)


@router.get("/models")
async def list_models(
    current_user: User = Depends(get_current_user),
) -> Dict[str, List[Any]]:
    # Auth-gate so anonymous callers can't spam the upstream and burn our quota.
    effective_key = current_user.openrouter_api_key or settings.OPENROUTER_API_KEY or None
    if effective_key is None:
        raise HTTPException(
            status_code=400,
            detail="No OpenRouter API key. Add one in Account settings.",
        )
    # fetch_models is sync; offload to a thread to keep the loop responsive.
    models = await asyncio.to_thread(fetch_models, api_key=effective_key)
    return {"models": models}
