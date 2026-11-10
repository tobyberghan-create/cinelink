# CineLink

Free, solo, browser-based movie linking game. Two modes — **Actor Chain** and **Film Chain** — built on live TMDB data. Spec: `spec/CineLink-Build-Plan.pdf`.

## Stack

- **Front end:** React + Vite + TypeScript + Tailwind, state in Zustand (`src/ui/`)
- **Game rules:** pure, unit-tested functions in `src/engine/` — no network or UI code
- **Tunables:** every number in `src/config.ts`
- **Proxy:** Vercel Functions in `api/` (`search`, `movie/[id]`, `start`). Holds the TMDB key, trims responses, sets edge-cache headers (credits cached 7 days, start pool 7 days, search 1 hour) plus an in-process memo.
- **Images:** loaded straight from `image.tmdb.org`

## Game rules (summary)

- **Actor Chain:** shown an actor → name a film they're credited in (any cast role incl. voice; archive footage / uncredited ignored) → next actor drawn from that film's top-N billed (3 → 5 → 8 → 12 as the chain grows), weighted by popularity, never one already shown. Timeout swaps actor; dead end widens to full cast then gives a new start actor free.
- **Film Chain:** shown a film → name another film sharing an eligible person (cast billed 0–14 on both films, or Director / DoP / Screenplay / Writer / Story / Original Music Composer / Editor). One counter per person, max 4 uses. Several matches → chooser (timer paused). Start film counts as used.
- **Shared:** 15 s a turn (10 s from chain 15), 3 lives, score = chain length, personal best in localStorage. Timer pauses during server checks and in the chooser; TMDB outage pauses the run instead of charging a life.

## Local development

```bash
npm install
cp .env.example .env        # then put your TMDB v3 key in TMDB_API_KEY
npm run dev                 # http://localhost:5173 — /api/* is served by the same handlers Vercel runs
TMDB_MOCK=1 npm run dev     # no key needed: a small fake film set (dev/mockTmdb.ts) for UI work offline
npm test                    # vitest: engine + proxy tests
npm run build               # typecheck + production build
```

`.env` is git-ignored. Never prefix the key with `VITE_` — that would ship it to the browser.

## Deploy (Vercel, free Hobby tier)

1. Push this repo to GitHub.
2. In Vercel: **Add New → Project → Import** the repo. Framework preset is detected as Vite; leave build settings default.
3. **Settings → Environment Variables:** add `TMDB_API_KEY` (your 32-character v3 key) for Production + Preview. (Alternatively `TMDB_READ_ACCESS_TOKEN`, the long v4 token.)
4. Deploy. Every later push to `main` redeploys the production URL; every branch/PR gets a preview URL.

Phase 3 optional public variables (safe to expose): `VITE_FEEDBACK_URL` (Tally form), `VITE_UMAMI_SCRIPT_URL` + `VITE_UMAMI_WEBSITE_ID` (anonymous analytics).

### Cloudflare Pages instead?

The handlers in `api/_lib/handlers.ts` are plain `Request → Response` functions; only the three thin entry files in `api/` are Vercel-specific. A `functions/api/*.ts` wrapper for Pages Functions is a ~20-line port.

## API (proxy) contract

| Route | Returns | Cache |
|---|---|---|
| `GET /api/search?q=` | `{ results: [{ id, title, year, releaseDate, posterPath }] }` — max 6, movies only, `include_adult=false`, released only | 1 h |
| `GET /api/movie/:id` | `{ id, title, year, releaseDate, posterPath, cast[], crew[] }` — cast sorted by billing `order`; crew filtered to eligible link jobs | 7 d |
| `GET /api/start?mode=actor\|film` | `{ mode, film }` — random film from the ~1,000 most-voted released films, with credits | none (random) |

Errors: `{ error }` with `400` bad input, `404` unknown film, `502` TMDB unavailable, `503` rate limited, `500` server misconfigured. The client pauses the run on 5xx rather than charging a life.

## Attribution

This product uses the TMDB API but is not endorsed or certified by TMDB. See the About screen.
