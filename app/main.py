import logging
from typing import Any

from fastapi import FastAPI
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.routes import auth, chats, config, llm, openrouter
from app.routes import account

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Agora API")

# CORS: never allow wildcard when credentials are enabled
_origins = settings.get_cors_origins()
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_request: Any, exc: RequestValidationError) -> JSONResponse:
    logger.warning("Invalid request body: %s", exc.errors())
    # exc.errors() can contain non-JSON-native types (ValueError ctx, bytes).
    return JSONResponse(status_code=422, content={"detail": jsonable_encoder(exc.errors())})


app.include_router(auth.router)
app.include_router(chats.router)
app.include_router(llm.router)
app.include_router(config.router)
app.include_router(openrouter.router)
app.include_router(account.router)


@app.get("/")
def root():
    return {"status": "ok", "docs": "/docs"}


@app.get("/health")
async def health():
    from sqlalchemy import text
    from app.db import AsyncSessionLocal

    db_status = "down"
    try:
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
        db_status = "ok"
    except Exception:
        logger.warning("Health check: DB unreachable")

    return {
        "status": "ok",
        "db": db_status,
        "openrouter_key_configured": bool(settings.OPENROUTER_API_KEY),
    }
