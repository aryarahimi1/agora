from typing import Any, Dict

from fastapi import APIRouter

from app.openrouter_client import (
    BRAINSTORM_ROLES,
    COLLABORATIVE_ROLES,
    CONSENSUS_ROLES,
    DEBATE_ROLES,
    MODELS,
    ROLEPLAY_ROLES,
)

router = APIRouter(tags=["config"])


@router.get("/api/config")
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
