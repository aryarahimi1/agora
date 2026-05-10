import logging
import os
from typing import Dict, List

import requests
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
API_URL = "https://openrouter.ai/api/v1/chat/completions"

MODELS: Dict[str, str] = {
    "AI_1": "openai/gpt-4o-mini",
    "AI_2": "google/gemini-2.5-pro",
    "AI_3": "deepseek/deepseek-chat-v3.1",
    "x-ai/grok-3-mini": "x-ai/grok-3-mini",
    "deepseek/deepseek-r1-0528-qwen3-8b": "deepseek/deepseek-r1-0528-qwen3-8b",
    "moonshotai/kimi-k2-0905": "moonshotai/kimi-k2-0905",
}

ROLEPLAY_ROLES = {
    "AI_1": "a brilliant scientist who explains concepts with precision and curiosity",
    "AI_2": "an innovative entrepreneur who sees practical applications and market potential",
    "AI_3": "a thoughtful philosopher who explores deeper meanings and ethical implications",
}

CONSENSUS_ROLES = {
    "AI_1": "a diplomatic facilitator who seeks common ground and builds bridges between ideas",
    "AI_2": "a practical negotiator who focuses on feasible solutions and compromises",
    "AI_3": "a synthesis expert who combines different viewpoints into unified conclusions",
}

BRAINSTORM_ROLES = {
    "AI_1": "a creative innovator who generates wild, out-of-the-box ideas without limits",
    "AI_2": "a lateral thinker who connects unexpected dots and finds novel approaches",
    "AI_3": "an idea amplifier who builds on others' concepts and makes them even better",
}

DEBATE_ROLES = {
    "AI_1": "a fierce advocate who passionately defends their position with strong arguments",
    "AI_2": "a critical challenger who aggressively questions and pokes holes in ideas",
    "AI_3": "a strategic debater who uses logic and evidence to demolish opposing viewpoints",
}

COLLABORATIVE_ROLES = {
    "AI_1": "an insightful educator who explains concepts clearly and sees the big picture",
    "AI_2": "a detail-oriented analyst who adds depth and catches important nuances",
    "AI_3": "a practical synthesizer who connects theory to real-world applications and examples",
}


def call_ai(model: str, role: str, context: List[Dict[str, str]]) -> str:
    if not OPENROUTER_API_KEY:
        raise RuntimeError("OPENROUTER_API_KEY is not set")

    messages = [{"role": "system", "content": f"You are {role}. Respond accordingly."}] + context

    response = requests.post(
        API_URL,
        headers={
            "Authorization": f"Bearer {OPENROUTER_API_KEY}",
            "Content-Type": "application/json",
        },
        json={"model": model, "messages": messages},
        timeout=60,
    )

    if response.status_code != 200:
        body = response.text[:2000] if response.text else ""
        logger.error(
            "OpenRouter HTTP %s: %s",
            response.status_code,
            body,
        )
        raise RuntimeError("OpenRouter request failed")

    data = response.json()
    if "choices" not in data or not data["choices"]:
        raise RuntimeError("Invalid response from OpenRouter")

    return data["choices"][0]["message"]["content"]
