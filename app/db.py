from collections.abc import AsyncGenerator
from typing import Optional

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.config import settings


class Base(DeclarativeBase):
    pass


_engine: Optional[AsyncEngine] = None
_sessionmaker: Optional[async_sessionmaker[AsyncSession]] = None


def _normalize_url(url: str) -> str:
    if url.startswith("postgresql://") or url.startswith("postgres://"):
        return url.replace("postgresql://", "postgresql+asyncpg://", 1).replace(
            "postgres://", "postgresql+asyncpg://", 1
        )
    return url


def _ensure_engine() -> async_sessionmaker[AsyncSession]:
    global _engine, _sessionmaker
    if _sessionmaker is not None:
        return _sessionmaker
    if not settings.DATABASE_URL:
        raise RuntimeError("DATABASE_URL is not configured")
    _engine = create_async_engine(_normalize_url(settings.DATABASE_URL), pool_pre_ping=True)
    _sessionmaker = async_sessionmaker(_engine, expire_on_commit=False, class_=AsyncSession)
    return _sessionmaker


class _LazySessionLocal:
    """Defers engine creation until first session — lets the app import without a DB."""

    def __call__(self) -> AsyncSession:
        return _ensure_engine()()


AsyncSessionLocal = _LazySessionLocal()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    sm = _ensure_engine()
    async with sm() as session:
        yield session
