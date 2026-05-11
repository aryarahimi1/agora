import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response, status
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db import get_db
from app.models.user import RefreshToken, User
from app.rate_limit import check_rate_limit
from app.schemas.auth import LoginRequest, SignupRequest, TokenResponse, UserPublic
from app.security import (
    create_access_token,
    generate_refresh_token,
    hash_password,
    hash_token,
    verify_password,
    get_current_user,
)

router = APIRouter(prefix="/auth", tags=["auth"])
logger = logging.getLogger(__name__)

_REFRESH_COOKIE = "refresh_token"
_COOKIE_PATH = "/auth"
# Non-httponly sentinel: lets the SPA know there's a session worth refreshing
# without exposing the actual token. Value is meaningless.
_SESSION_HINT_COOKIE = "has_session"


def _set_refresh_cookie(response: Response, raw_token: str) -> None:
    secure = settings.ENV == "production"
    max_age = settings.REFRESH_TOKEN_TTL_DAYS * 86400
    # SameSite=Strict: refresh cookie is only used by our own SPA on first-party
    # navigations after login. Strict closes the CSRF surface on /auth/logout and
    # /auth/refresh that Lax would leave open to top-level form posts.
    response.set_cookie(
        key=_REFRESH_COOKIE,
        value=raw_token,
        httponly=True,
        secure=secure,
        samesite="strict",
        path=_COOKIE_PATH,
        max_age=max_age,
    )
    response.set_cookie(
        key=_SESSION_HINT_COOKIE,
        value="1",
        httponly=False,
        secure=secure,
        samesite="lax",
        path="/",
        max_age=max_age,
    )


def _clear_refresh_cookie(response: Response) -> None:
    secure = settings.ENV == "production"
    # Echo all attributes so browsers accept the deletion Set-Cookie.
    response.delete_cookie(
        key=_REFRESH_COOKIE,
        path=_COOKIE_PATH,
        httponly=True,
        secure=secure,
        samesite="strict",
    )
    response.delete_cookie(
        key=_SESSION_HINT_COOKIE,
        path="/",
        httponly=False,
        secure=secure,
        samesite="lax",
    )


def _rate_limit(request: Request) -> None:
    ip = request.client.host if request.client else "unknown"
    if not check_rate_limit(ip):
        raise HTTPException(status_code=429, detail="Too many requests")


@router.post("/signup", status_code=status.HTTP_201_CREATED, response_model=TokenResponse)
async def signup(
    body: SignupRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    _rate_limit(request)

    user = User(
        email=body.email.lower(),
        password_hash=hash_password(body.password),
        name=body.name,
    )
    db.add(user)
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Email already registered")

    raw_rt = generate_refresh_token()
    rt = RefreshToken(
        user_id=user.id,
        token_hash=hash_token(raw_rt),
        expires_at=datetime.now(timezone.utc)
        + timedelta(days=settings.REFRESH_TOKEN_TTL_DAYS),
    )
    db.add(rt)
    await db.commit()
    await db.refresh(user)

    access = create_access_token(user.id)
    _set_refresh_cookie(response, raw_rt)

    return TokenResponse(
        user=UserPublic.model_validate(user),
        access_token=access,
        token_type="bearer",
    )


@router.post("/login", response_model=TokenResponse)
async def login(
    body: LoginRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    _rate_limit(request)

    result = await db.execute(
        select(User).where(User.email == body.email.lower())
    )
    user = result.scalar_one_or_none()

    # Always run verify to avoid timing oracle even when user not found
    dummy_hash = "$2b$12$aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    valid = verify_password(body.password, user.password_hash if user else dummy_hash)

    if not user or not valid:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    raw_rt = generate_refresh_token()
    rt = RefreshToken(
        user_id=user.id,
        token_hash=hash_token(raw_rt),
        expires_at=datetime.now(timezone.utc)
        + timedelta(days=settings.REFRESH_TOKEN_TTL_DAYS),
    )
    db.add(rt)
    await db.commit()

    access = create_access_token(user.id)
    _set_refresh_cookie(response, raw_rt)

    return TokenResponse(
        user=UserPublic.model_validate(user),
        access_token=access,
        token_type="bearer",
    )


@router.post("/refresh")
async def refresh(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
    refresh_token: str | None = Cookie(default=None),
):
    _rate_limit(request)

    if not refresh_token:
        raise HTTPException(status_code=401, detail="Missing refresh token")

    token_hash = hash_token(refresh_token)
    now = datetime.now(timezone.utc)

    result = await db.execute(
        select(RefreshToken).where(RefreshToken.token_hash == token_hash)
    )
    rt = result.scalar_one_or_none()

    # A presented-but-already-revoked token is the canonical signal of theft:
    # the rotation moved on, so the holder of the old value is the attacker.
    # Burn the entire token family for that user.
    if rt is not None and rt.revoked_at is not None:
        await db.execute(
            update(RefreshToken)
            .where(RefreshToken.user_id == rt.user_id, RefreshToken.revoked_at.is_(None))
            .values(revoked_at=now)
        )
        await db.commit()
        _clear_refresh_cookie(response)
        logger.warning("Refresh-token reuse detected for user %s; revoked family", rt.user_id)
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

    if rt is None or rt.expires_at.replace(tzinfo=timezone.utc) < now:
        _clear_refresh_cookie(response)
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

    # Rotate: revoke old, issue new
    rt.revoked_at = now
    raw_new = generate_refresh_token()
    new_rt = RefreshToken(
        user_id=rt.user_id,
        token_hash=hash_token(raw_new),
        expires_at=now + timedelta(days=settings.REFRESH_TOKEN_TTL_DAYS),
    )
    db.add(new_rt)
    await db.commit()

    # Fetch user to build access token (user_id is sufficient here)
    access = create_access_token(rt.user_id)
    _set_refresh_cookie(response, raw_new)

    return {"access_token": access, "token_type": "bearer"}


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
    refresh_token: str | None = Cookie(default=None),
):
    _rate_limit(request)
    if refresh_token:
        token_hash = hash_token(refresh_token)
        result = await db.execute(
            select(RefreshToken).where(RefreshToken.token_hash == token_hash)
        )
        rt = result.scalar_one_or_none()
        if rt and rt.revoked_at is None:
            rt.revoked_at = datetime.now(timezone.utc)
            await db.commit()
    _clear_refresh_cookie(response)


@router.get("/me", response_model=UserPublic)
async def me(current_user: User = Depends(get_current_user)) -> UserPublic:
    return UserPublic.model_validate(current_user)
