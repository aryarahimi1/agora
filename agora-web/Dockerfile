# syntax=docker/dockerfile:1.7

# ---- deps -------------------------------------------------------------------
FROM node:22-alpine AS deps

WORKDIR /app

# Install full deps (dev + prod) — needed for `vite build`.
# `npm install` (not ci) so platform-specific optional native deps that the host
# lockfile didn't capture (e.g. linux/arm64 @emnapi bindings) can resolve.
COPY package.json package-lock.json ./
RUN npm install --no-audit --no-fund --ignore-scripts \
 && npm rebuild

# ---- build ------------------------------------------------------------------
FROM node:22-alpine AS build

WORKDIR /app

# Same-origin by default. When deployed behind Caddy, the browser hits
# /api/... and /auth/... at the public origin and Caddy proxies to the API.
# Override only if you want the frontend to call a different absolute URL.
ARG VITE_API_URL=""
ENV VITE_API_URL=${VITE_API_URL}

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build \
 && npm prune --omit=dev

# ---- runtime ----------------------------------------------------------------
FROM node:22-alpine AS runtime

ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0

# wget is in busybox — use it for HEALTHCHECK without adding a layer.
WORKDIR /app

# Non-root user. The `node` user is shipped with the official image (uid 1000).
COPY --from=build --chown=node:node /app/build ./build
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/package.json ./package.json

USER node

EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=15s --retries=3 \
    CMD wget -qO- http://localhost:3000/ >/dev/null 2>&1 || exit 1

CMD ["node", "build"]
