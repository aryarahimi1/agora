import logging
import os
import secrets
from typing import List

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)

_DEV_FALLBACK_SECRET = "dev-insecure-fallback-do-not-use-in-production-xx"


def _resolve_jwt_secret(provided: str, secret_file_path: str) -> str:
    """
    Resolution order:
      1. Env var JWT_SECRET (≥32 chars) — use as-is.
      2. File at JWT_SECRET_FILE (default /data/jwt_secret) — read and validate.
      3. Create that file with a fresh 64-char hex secret and use it.
      4. If the file cannot be written (bad perms, missing dir) — fall back to
         the dev insecure default and warn. Startup is NOT blocked.
    """
    if provided and len(provided) >= 32:
        return provided

    if provided and len(provided) < 32:
        logger.warning(
            "JWT_SECRET is set but shorter than 32 characters; ignoring it "
            "and falling through to file-based secret."
        )

    try:
        if os.path.isfile(secret_file_path) and os.access(secret_file_path, os.R_OK):
            value = open(secret_file_path).read().strip()
            if len(value) >= 32:
                return value
            logger.warning(
                "JWT secret file %s exists but contains a value shorter than "
                "32 characters; regenerating.",
                secret_file_path,
            )

        new_secret = secrets.token_hex(32)
        with open(secret_file_path, "w") as fh:
            os.chmod(secret_file_path, 0o600)
            fh.write(new_secret)
        # Use WARNING so the message survives even if basicConfig hasn't run yet
        # (this resolver fires during Settings() import — before app.main configures
        # logging). Auto-generating a secret is worth surfacing on first boot.
        logger.warning(
            "Auto-generated JWT secret at %s (persisted; tokens will survive restarts)",
            secret_file_path,
        )
        return new_secret

    except OSError:
        logger.warning(
            "Could not read or write JWT secret file at %s. "
            "Using insecure dev fallback — mount the api_data volume or set "
            "JWT_SECRET before going to production.",
            secret_file_path,
        )
        return _DEV_FALLBACK_SECRET


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DATABASE_URL: str = ""
    JWT_SECRET: str = ""
    JWT_SECRET_FILE: str = "/data/jwt_secret"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_TTL: int = 900  # seconds
    REFRESH_TOKEN_TTL_DAYS: int = 30
    OPENROUTER_API_KEY: str = ""
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:4173"
    ENV: str = "development"

    @model_validator(mode="after")
    def check_secrets(self) -> "Settings":
        if self.ENV == "production":
            if not self.DATABASE_URL:
                import sys
                sys.exit("FATAL: DATABASE_URL must be set in production")

        resolved = _resolve_jwt_secret(self.JWT_SECRET, self.JWT_SECRET_FILE)
        object.__setattr__(self, "JWT_SECRET", resolved)
        return self

    def get_cors_origins(self) -> List[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


settings = Settings()
