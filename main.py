import logging
from typing import Any, Dict, List

from fastapi import FastAPI, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from ai_core import (
    BRAINSTORM_ROLES,
    COLLABORATIVE_ROLES,
    CONSENSUS_ROLES,
    DEBATE_ROLES,
    MODELS,
    ROLEPLAY_ROLES,
    call_ai,
)

logger = logging.getLogger(__name__)

app = FastAPI(title="AI Discussion API")

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+",
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    _request: Any, exc: RequestValidationError
) -> JSONResponse:
    logger.warning("Invalid request body: %s", exc.errors())
    return JSONResponse(
        status_code=422,
        content={"detail": "Invalid request body"},
    )


class Message(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    model: str
    role: str
    context: List[Message]


class ChatResponse(BaseModel):
    content: str


@app.get("/api/config")
def get_config() -> Dict[str, Any]:
    return {
        "models": MODELS,
        "roles": {
            "roleplay": ROLEPLAY_ROLES,
            "consensus": CONSENSUS_ROLES,
            "brainstorm": BRAINSTORM_ROLES,
            "debate": DEBATE_ROLES,
            "collaborative": COLLABORATIVE_ROLES,
        },
    }


@app.post("/api/chat", response_model=ChatResponse)
def chat(req: ChatRequest) -> ChatResponse:
    try:
        content = call_ai(req.model, req.role, [m.model_dump() for m in req.context])
    except RuntimeError:
        logger.exception("Upstream AI call failed")
        raise HTTPException(
            status_code=502,
            detail="The AI service returned an error.",
        )
    return ChatResponse(content=content)


@app.get("/")
def root() -> Dict[str, str]:
    return {"status": "ok", "docs": "/docs"}
