import uuid
from datetime import datetime
from typing import Any, List, Optional

from pydantic import BaseModel, field_validator

VALID_MODES = {"roleplay", "consensus", "brainstorm", "debate", "collaborative"}


class AgentSchema(BaseModel):
    id: Optional[str] = None
    name: str
    emoji: str
    persona: str
    model: str


class ChatCreate(BaseModel):
    mode: str
    generations: int = 3
    title: str = "New chat"
    draft_topic: str = ""
    agents: List[Any] = []
    entries: List[Any] = []

    @field_validator("mode")
    @classmethod
    def mode_valid(cls, v: str) -> str:
        if v not in VALID_MODES:
            raise ValueError(f"mode must be one of {sorted(VALID_MODES)}")
        return v

    @field_validator("generations")
    @classmethod
    def generations_range(cls, v: int) -> int:
        if not (1 <= v <= 24):
            raise ValueError("generations must be between 1 and 24")
        return v


class ChatUpdate(BaseModel):
    title: Optional[str] = None
    mode: Optional[str] = None
    generations: Optional[int] = None
    draft_topic: Optional[str] = None
    agents: Optional[List[Any]] = None

    @field_validator("mode")
    @classmethod
    def mode_valid(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in VALID_MODES:
            raise ValueError(f"mode must be one of {sorted(VALID_MODES)}")
        return v

    @field_validator("generations")
    @classmethod
    def generations_range(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and not (1 <= v <= 24):
            raise ValueError("generations must be between 1 and 24")
        return v


class ChatListItem(BaseModel):
    id: uuid.UUID
    title: str
    mode: str
    generations: int
    draft_topic: str
    updated_at: datetime
    created_at: datetime

    model_config = {"from_attributes": True}


class ChatRead(BaseModel):
    id: uuid.UUID
    title: str
    mode: str
    generations: int
    draft_topic: str
    agents: List[Any]
    entries: List[Any]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class EntryAppend(BaseModel):
    entry: Any


class EntriesReplace(BaseModel):
    entries: List[Any]


class ImportItem(BaseModel):
    id: Optional[str] = None
    title: Optional[str] = "New chat"
    mode: str
    generations: Optional[int] = 3
    draftTopic: Optional[str] = ""
    agents: Optional[List[Any]] = []
    entries: Optional[List[Any]] = []

    @field_validator("mode")
    @classmethod
    def mode_valid(cls, v: str) -> str:
        if v not in VALID_MODES:
            raise ValueError(f"invalid mode: {v}")
        return v

    @field_validator("generations")
    @classmethod
    def generations_range(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and not (1 <= v <= 24):
            return 3
        return v


class ImportRequest(BaseModel):
    sessions: List[Any]
