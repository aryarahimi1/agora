import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.chat import Chat
from app.models.user import User
from app.schemas.chat import (
    ChatCreate,
    ChatListItem,
    ChatRead,
    ChatUpdate,
    EntryAppend,
    EntriesReplace,
    ImportItem,
    ImportRequest,
)
from app.security import get_current_user

router = APIRouter(prefix="/api/chats", tags=["chats"])
logger = logging.getLogger(__name__)


async def _get_owned_chat(
    chat_id: uuid.UUID,
    db: AsyncSession,
    user: User,
) -> Chat:
    result = await db.execute(
        select(Chat).where(Chat.id == chat_id, Chat.user_id == user.id)
    )
    chat = result.scalar_one_or_none()
    if chat is None:
        raise HTTPException(status_code=404, detail="Chat not found")
    return chat


@router.get("", response_model=list[ChatListItem])
async def list_chats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Chat)
        .where(Chat.user_id == current_user.id)
        .order_by(Chat.updated_at.desc())
    )
    return result.scalars().all()


@router.post("", status_code=status.HTTP_201_CREATED, response_model=ChatRead)
async def create_chat(
    body: ChatCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Chat:
    chat = Chat(
        user_id=current_user.id,
        title=body.title,
        mode=body.mode,
        generations=body.generations,
        draft_topic=body.draft_topic,
        agents=body.agents,
        entries=body.entries,
    )
    db.add(chat)
    await db.commit()
    await db.refresh(chat)
    return chat


@router.get("/{chat_id}", response_model=ChatRead)
async def get_chat(
    chat_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Chat:
    return await _get_owned_chat(chat_id, db, current_user)


@router.patch("/{chat_id}", response_model=ChatRead)
async def update_chat(
    chat_id: uuid.UUID,
    body: ChatUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Chat:
    chat = await _get_owned_chat(chat_id, db, current_user)
    updates = body.model_dump(exclude_unset=True)
    for key, val in updates.items():
        setattr(chat, key, val)
    if updates:
        chat.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(chat)
    return chat


@router.delete("/{chat_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_chat(
    chat_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    chat = await _get_owned_chat(chat_id, db, current_user)
    await db.delete(chat)
    await db.commit()


@router.post("/{chat_id}/entries")
async def append_entry(
    chat_id: uuid.UUID,
    body: EntryAppend,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    chat = await _get_owned_chat(chat_id, db, current_user)
    current_entries = list(chat.entries or [])
    current_entries.append(body.entry)
    chat.entries = current_entries
    chat.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(chat)
    return {"entries": chat.entries, "updated_at": chat.updated_at}


@router.put("/{chat_id}/entries")
async def replace_entries(
    chat_id: uuid.UUID,
    body: EntriesReplace,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    chat = await _get_owned_chat(chat_id, db, current_user)
    chat.entries = body.entries
    chat.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(chat)
    return {"entries": chat.entries, "updated_at": chat.updated_at}


@router.post("/import", status_code=status.HTTP_201_CREATED)
async def import_chats(
    body: ImportRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, int]:
    imported = 0
    for raw in body.sessions:
        try:
            item = ImportItem.model_validate(raw)
        except Exception:
            continue  # silently skip malformed

        chat = Chat(
            user_id=current_user.id,
            title=item.title or "New chat",
            mode=item.mode,
            generations=item.generations or 3,
            draft_topic=item.draftTopic or "",
            agents=item.agents or [],
            entries=item.entries or [],
        )
        db.add(chat)
        imported += 1

    if imported:
        await db.commit()
    return {"imported": imported}
