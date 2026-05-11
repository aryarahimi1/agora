import json
import logging
import os
import time
from typing import Any, Dict, List, Optional

import requests

logger = logging.getLogger(__name__)

API_URL = "https://openrouter.ai/api/v1/chat/completions"
MODELS_URL = "https://openrouter.ai/api/v1/models"

REQUEST_TIMEOUT = 60
MAX_RETRIES = 3
RETRYABLE_STATUS = {408, 429, 500, 502, 503, 504}

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


def _get_api_key() -> str:
    from app.config import settings
    return settings.OPENROUTER_API_KEY or os.getenv("OPENROUTER_API_KEY", "")


def _post_completion(
    payload: Dict[str, Any], *, api_key: Optional[str] = None
) -> Dict[str, Any]:
    resolved_key = api_key or _get_api_key()
    if not resolved_key:
        raise RuntimeError("OPENROUTER_API_KEY is not set")

    last_error: Optional[str] = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            response = requests.post(
                API_URL,
                headers={
                    "Authorization": f"Bearer {resolved_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
                timeout=REQUEST_TIMEOUT,
            )
        except requests.RequestException as exc:
            last_error = f"network error: {exc}"
            logger.warning("OpenRouter attempt %s failed: %s", attempt, last_error)
            if attempt == MAX_RETRIES:
                break
            time.sleep(2 ** (attempt - 1))
            continue

        if response.status_code == 200:
            return response.json()

        body = response.text[:500] if response.text else ""
        last_error = f"HTTP {response.status_code}: {body}"
        logger.warning("OpenRouter attempt %s failed: %s", attempt, last_error)

        if response.status_code not in RETRYABLE_STATUS or attempt == MAX_RETRIES:
            break
        time.sleep(2 ** (attempt - 1))

    raise RuntimeError(
        f"OpenRouter request failed after {MAX_RETRIES} attempts: {last_error}"
    )


def call_ai(
    model: str, role: str, context: List[Dict[str, str]], *, api_key: Optional[str] = None
) -> str:
    messages = [
        {"role": "system", "content": f"You are {role}. Respond accordingly."},
    ] + context

    data = _post_completion({"model": model, "messages": messages}, api_key=api_key)
    if "choices" not in data or not data["choices"]:
        raise RuntimeError("Invalid response from OpenRouter: no choices")
    return data["choices"][0]["message"]["content"]


def call_ai_structured(
    model: str,
    instruction: str,
    user_input: str,
    schema_hint: Dict[str, Any],
    max_attempts: int = 2,
    *,
    api_key: Optional[str] = None,
) -> Dict[str, Any]:
    required_keys = list(schema_hint.keys())
    system = (
        f"{instruction}\n\n"
        f"Reply ONLY with valid JSON matching this shape (no prose, no markdown fences):\n"
        f"{json.dumps(schema_hint, indent=2)}"
    )

    messages: List[Dict[str, str]] = [
        {"role": "system", "content": system},
        {"role": "user", "content": user_input},
    ]

    last_error: Optional[str] = None
    for attempt in range(1, max_attempts + 1):
        data = _post_completion(
            {
                "model": model,
                "messages": messages,
                "response_format": {"type": "json_object"},
            },
            api_key=api_key,
        )
        raw = data.get("choices", [{}])[0].get("message", {}).get("content", "")

        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError as exc:
            last_error = f"invalid JSON: {exc.msg}"
            messages.append({"role": "assistant", "content": raw})
            messages.append(
                {
                    "role": "user",
                    "content": f"Your previous reply was not valid JSON ({last_error}). Reply again with valid JSON only.",
                }
            )
            continue

        missing = [k for k in required_keys if k not in parsed]
        if missing:
            last_error = f"missing required keys: {missing}"
            messages.append({"role": "assistant", "content": raw})
            messages.append(
                {
                    "role": "user",
                    "content": f"Your previous reply was missing required keys ({missing}). Include them and reply again.",
                }
            )
            continue

        return parsed

    raise RuntimeError(
        f"Model failed to produce valid structured output after {max_attempts} attempts: {last_error}"
    )


def fetch_models(*, api_key: Optional[str] = None) -> List[Dict[str, Any]]:
    resolved_key = api_key or _get_api_key()
    try:
        resp = requests.get(
            MODELS_URL,
            headers={"Authorization": f"Bearer {resolved_key}"} if resolved_key else {},
            timeout=10,
        )
        if resp.status_code == 200:
            data = resp.json()
            return [
                {"id": m.get("id", ""), "name": m.get("name", m.get("id", ""))}
                for m in data.get("data", [])
            ]
    except requests.RequestException as exc:
        logger.warning("Failed to fetch OpenRouter models: %s", exc)
    return []
