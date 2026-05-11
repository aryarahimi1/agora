# debator-web

SvelteKit 2 frontend for [Debator](../README.md) — the multi-agent LLM discussion platform.

## Stack

- SvelteKit 2 + Svelte 5 (runes)
- TypeScript
- Tailwind CSS 4
- Bits UI (headless components)
- Vite

## Develop

```bash
npm install
npm run dev
```

Set `VITE_API_URL` to point at a non-local backend (defaults to `http://localhost:8000`):

```bash
VITE_API_URL=https://api.example.com npm run dev
```

## Build

```bash
npm run build
npm run preview
```

The default adapter is `@sveltejs/adapter-auto`. For production, swap in the adapter that matches your host (Vercel, Netlify, Node, etc.).

## Layout

```
src/
  routes/
    +page.svelte          # Landing
    workspace/            # Main multi-agent workspace
    debate/               # Mode-specific routes
    consensus/
    brainstorm/
    roleplay/
    collaborative/
  lib/
    chat/                 # Orchestration, session state, model catalog
    components/           # UI (Bits UI + Tailwind)
```
