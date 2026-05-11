"""
Simple in-memory token bucket per IP.
Structured so the storage backend (currently a plain dict) can be swapped
for a Redis-backed version by replacing _store and the two helper functions.
"""

import time
from collections import defaultdict
from threading import Lock
from typing import Protocol


class RateLimitStore(Protocol):
    def get(self, key: str) -> tuple[float, float]:
        ...

    def set(self, key: str, tokens: float, last_refill: float) -> None:
        ...


class _InMemoryStore:
    def __init__(self) -> None:
        self._data: dict[str, tuple[float, float]] = defaultdict(lambda: (0.0, 0.0))
        self._lock = Lock()

    def get(self, key: str) -> tuple[float, float]:
        with self._lock:
            return self._data[key]

    def set(self, key: str, tokens: float, last_refill: float) -> None:
        with self._lock:
            self._data[key] = (tokens, last_refill)


_store = _InMemoryStore()

# 10 requests per 60 seconds per IP
_CAPACITY = 10.0
_REFILL_RATE = 10.0 / 60.0  # tokens per second


def check_rate_limit(ip: str) -> bool:
    """Returns True if the request is allowed, False if rate-limited."""
    now = time.monotonic()
    tokens, last_refill = _store.get(ip)

    if last_refill == 0.0:
        # First request from this IP
        _store.set(ip, _CAPACITY - 1.0, now)
        return True

    elapsed = now - last_refill
    tokens = min(_CAPACITY, tokens + elapsed * _REFILL_RATE)

    if tokens < 1.0:
        _store.set(ip, tokens, now)
        return False

    _store.set(ip, tokens - 1.0, now)
    return True
