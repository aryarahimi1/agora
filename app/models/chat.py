import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class Chat(Base):
    __tablename__ = "chats"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default="gen_random_uuid()"
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(Text, nullable=False, server_default="New chat")
    mode: Mapped[str] = mapped_column(Text, nullable=False)
    generations: Mapped[int] = mapped_column(Integer, nullable=False, server_default="3")
    draft_topic: Mapped[str] = mapped_column(Text, nullable=False, server_default="")
    agents: Mapped[list] = mapped_column(JSONB, nullable=False, server_default="'[]'::jsonb")
    entries: Mapped[list] = mapped_column(JSONB, nullable=False, server_default="'[]'::jsonb")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default="now()"
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default="now()"
    )

    user: Mapped["User"] = relationship("User", back_populates="chats")  # type: ignore[name-defined]

    __table_args__ = (
        Index("ix_chats_user_id_updated_at", "user_id", "updated_at"),
    )
