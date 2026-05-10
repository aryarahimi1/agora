# AI Discussion Hub

Multi-AI conversations across 5 modes (roleplay, consensus, brainstorm, debate, collaborative).
Three personas powered by different OpenRouter models talk to each other about whatever topic you give them.

## Stack

- **Backend**: FastAPI + `requests` (`main.py`, `ai_core.py`)
- **Frontend**: React 18 + TypeScript + react-router (`react-ai-discussion/`)
- **LLM gateway**: OpenRouter (single API key, many models)

The backend is a thin proxy: it holds the OpenRouter key and exposes `POST /api/chat` so the key never ships to the browser.

## Setup

1. Get an OpenRouter API key from https://openrouter.ai/keys
2. Paste it into `.env` at the repo root:
   ```
   OPENROUTER_API_KEY=sk-or-v1-...
   ```
   (`.env` is gitignored. The backend loads it automatically via `python-dotenv`.)

### Backend

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Backend runs at http://localhost:8000 (interactive docs at `/docs`).

### Frontend

```bash
cd react-ai-discussion
npm install
npm start
```

Frontend runs at http://localhost:3000. CORS is preconfigured for that origin.

To point the frontend at a non-local backend, set `REACT_APP_API_URL` before `npm start` / `npm run build`.

## Project layout

```
ai_core.py           # OpenRouter client + model/role constants
main.py              # FastAPI app exposing /api/chat and /api/config
requirements.txt
react-ai-discussion/ # React frontend (5 mode pages + landing)
```
