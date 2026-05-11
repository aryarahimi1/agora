# syntax=docker/dockerfile:1.7

# ---- builder ----------------------------------------------------------------
FROM python:3.12-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1

# Build deps for any wheels that need to compile (e.g. bcrypt fallbacks).
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
        build-essential \
        libpq-dev \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /build

# Create an isolated venv we can copy into the runtime image.
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:${PATH}"

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# ---- runtime ----------------------------------------------------------------
FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:${PATH}"

# tini for PID 1, curl for HEALTHCHECK, libpq for asyncpg/psycopg fallbacks.
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
        tini \
        curl \
        libpq5 \
 && rm -rf /var/lib/apt/lists/* \
 && groupadd --system --gid 1001 app \
 && useradd  --system --uid 1001 --gid app --home-dir /srv --shell /usr/sbin/nologin app

# Bring in the prebuilt venv.
COPY --from=builder /opt/venv /opt/venv

WORKDIR /srv

# Application code. Order from least-to-most-likely-to-change for cache reuse.
COPY --chown=app:app requirements.txt ./
COPY --chown=app:app alembic.ini ./
COPY --chown=app:app alembic/ ./alembic/
COPY --chown=app:app app/ ./app/
COPY --chown=app:app main.py ./

# Persistent state directory. The `api_data` volume is mounted here at runtime;
# pre-creating it with the right ownership ensures the volume inherits app:app
# perms on first mount (docker copies image directory metadata onto the new
# volume when it's empty). 0700 because we store the JWT secret here.
RUN mkdir -p /data && chown app:app /data && chmod 0700 /data

USER app

EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -fsS http://localhost:8000/health || exit 1

ENTRYPOINT ["/usr/bin/tini", "--"]

# Apply migrations then exec the API server. `exec` so uvicorn becomes PID 2
# under tini and receives signals directly.
CMD ["sh", "-c", "alembic upgrade head && exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --proxy-headers --forwarded-allow-ips=*"]
