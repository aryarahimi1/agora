# Agora

A multi-agent LLM discussion platform. You give it a topic and a mode; three (or more) language models from different providers — GPT‑4o‑mini, Gemini 2.5 Pro, DeepSeek, Claude 3.5 Sonnet, and others — talk to each other in real time.

Five conversation modes shape the orchestration loop:

| Mode | What it does |
|---|---|
| **Debate** | Models argue opposing positions over multiple rounds |
| **Consensus** | A facilitator, negotiator, and synthesizer reach a shared conclusion |
| **Brainstorm** | Lateral thinkers riff on each other's ideas |
| **Roleplay** | Personas (scientist, entrepreneur, philosopher) explore a topic from their angle |
| **Collaborative** | Educator + analyst + synthesizer co-teach a concept |

Each model is assigned a per-mode persona via system prompt; turns pass through a back-end orchestrator that streams responses to the UI.

## Stack

- **Backend** — FastAPI (`main.py`, `ai_core.py`). Thin proxy that holds the OpenRouter key and exposes `POST /api/chat` so the key never reaches the browser.
- **Frontend** — SvelteKit 2 + TypeScript + Tailwind 4 + Bits UI. Streaming UI with abort/interrupt, dark mode, mode-specific routes.
- **LLM gateway** — [OpenRouter](https://openrouter.ai). One API, many providers (OpenAI, Google, Anthropic, DeepSeek, Meta, etc.).

```
┌─────────────────┐    POST /api/chat   ┌─────────────┐    HTTPS    ┌─────────────┐
│ SvelteKit UI    │ ──────────────────► │  FastAPI    │ ──────────► │ OpenRouter  │
│ (agora-web/)    │ ◄───── stream ───── │  (main.py)  │ ◄────────── │ (any model) │
└─────────────────┘                     └─────────────┘             └─────────────┘
```

## Why I built it

Most "chat with an LLM" apps are single-turn, single-model. I wanted to see what happens when you put models from different providers in the same room and give them roles. The orchestration loop — who speaks when, what context they see, how to keep responses on-topic across turns — is the actual interesting problem.

## Getting started

### 1. Get an OpenRouter key

Sign up at [openrouter.ai/keys](https://openrouter.ai/keys) and grab an API key. Copy `.env.example` to `.env` and paste it in:

```bash
cp .env.example .env
# edit .env, set OPENROUTER_API_KEY=sk-or-v1-...
```

### 2. Backend

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Backend at `http://localhost:8000` (interactive docs at `/docs`).

### 3. Frontend

```bash
cd agora-web
npm install
npm run dev
```

Frontend at `http://localhost:5173`. CORS is preconfigured for any localhost port.

To point the frontend at a non-local backend, set `VITE_API_URL=https://your-api.example.com` before `npm run dev` or `npm run build`.

## Project layout

```
ai_core.py           # OpenRouter client, model & role definitions, validation/retry
main.py              # FastAPI app: /api/chat, /api/config, /health
requirements.txt
agora-web/           # SvelteKit frontend
  src/
    routes/          # /, /workspace, /debate, /consensus, /brainstorm, /roleplay, /collaborative
    lib/
      chat/          # orchestration, model catalog, session state
      components/    # UI (Bits UI + Tailwind)
.env.example
LICENSE
```

## What I'd do next

- Persistence layer (right now discussions live in browser state only)
- Token/cost tracking per turn
- Export discussion as markdown
- Structured-output mode where models return JSON the orchestrator validates against a schema, with retry on malformed responses
- Auto-judge: a separate model scores each turn for relevance, factuality, and on-character behavior

## License

MIT — see [LICENSE](LICENSE).
