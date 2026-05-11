import asyncio
import logging
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db import get_db
from app.models.chat import Chat
from app.models.user import User
from app.openrouter_client import call_ai
from app.security import get_current_user

router = APIRouter(tags=["llm"])
logger = logging.getLogger(__name__)


class Message(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    model: str
    role: str
    context: List[Message]
    chat_id: Optional[str] = None
    append: Optional[bool] = False


class ChatResponse(BaseModel):
    content: str


@router.post("/api/chat", response_model=ChatResponse)
async def chat(
    req: ChatRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ChatResponse:
    effective_key = current_user.openrouter_api_key or settings.OPENROUTER_API_KEY or None
    if effective_key is None:
        raise HTTPException(
            status_code=400,
            detail="No OpenRouter API key. Add one in Account settings.",
        )

    # Validate chat ownership before the LLM call so attackers can't burn our
    # OpenRouter quota probing for chat existence across users.
    chat_obj: Optional[Chat] = None
    if req.chat_id and req.append:
        try:
            chat_uuid = uuid.UUID(req.chat_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid chat_id")
        result = await db.execute(
            select(Chat).where(Chat.id == chat_uuid, Chat.user_id == current_user.id)
        )
        chat_obj = result.scalar_one_or_none()
        if chat_obj is None:
            raise HTTPException(status_code=404, detail="Chat not found")

    try:
        # call_ai is sync `requests` — push to a thread so we don't block the loop.
        content = await asyncio.to_thread(
            call_ai,
            req.model,
            req.role,
            [m.model_dump() for m in req.context],
            api_key=effective_key,
        )
    except RuntimeError:
        logger.exception("Upstream AI call failed")
        raise HTTPException(status_code=502, detail="The AI service returned an error.")

    if chat_obj is not None:
        entries = list(chat_obj.entries or [])
        entries.append(
            {
                "participant": "assistant",
                "model": req.model,
                "response": content,
            }
        )
        chat_obj.entries = entries
        chat_obj.updated_at = datetime.now(timezone.utc)
        await db.commit()

    return ChatResponse(content=content)
