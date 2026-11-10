/**
 * Web-standard request handlers (Request -> Response). Platform-agnostic so the
 * same code runs on Vercel Functions, Cloudflare Workers, and the local Vite
 * dev plugin. Each returns only the fields the game uses, with Cache-Control
 * headers so the platform edge cache absorbs repeat lookups.
 */
import { config } from '../../src/config';
import {
  ConfigError,
  type Fetcher,
  TmdbError,
  getMovieCredits,
  getStartPool,
  pickRandom,
  searchMovies,
} from './tmdb';

export interface HandlerDeps {
  fetcher?: Fetcher;
  rng?: () => number;
}

function json(body: unknown, status = 200, cacheSeconds = 0): Response {
  const headers: Record<string, string> = { 'content-type': 'application/json; charset=utf-8' };
  headers['cache-control'] =
    cacheSeconds > 0
      ? `public, s-maxage=${cacheSeconds}, stale-while-revalidate=${Math.min(cacheSeconds, 86400)}`
      : 'no-store';
  return new Response(JSON.stringify(body), { status, headers });
}

function errorResponse(e: unknown): Response {
  if (e instanceof ConfigError) return json({ error: 'server_misconfigured' }, 500);
  if (e instanceof TmdbError) {
    // 404 from TMDB = unknown film id; everything else = upstream trouble.
    if (e.status === 404) return json({ error: 'not_found' }, 404);
    if (e.status === 429) return json({ error: 'rate_limited' }, 503);
    return json({ error: 'upstream_unavailable' }, 502);
  }
  return json({ error: 'internal' }, 500);
}

/** GET /api/search?q=… */
export async function handleSearch(request: Request, deps: HandlerDeps = {}): Promise<Response> {
  const q = new URL(request.url).searchParams.get('q') ?? '';
  if (q.trim().length === 0) return json({ results: [] }, 200, config.search.cacheSeconds);
  try {
    const results = await searchMovies(q, deps.fetcher);
    return json({ results }, 200, config.search.cacheSeconds);
  } catch (e) {
    return errorResponse(e);
  }
}

/** GET /api/movie/:id (id passed in by the platform router) */
export async function handleMovie(id: string | undefined, deps: HandlerDeps = {}): Promise<Response> {
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) return json({ error: 'bad_id' }, 400);
  try {
    const credits = await getMovieCredits(n, deps.fetcher);
    return json(credits, 200, config.credits.cacheSeconds);
  } catch (e) {
    return errorResponse(e);
  }
}

/** GET /api/start?mode=actor|film — a random well-known film with trimmed credits. */
export async function handleStart(request: Request, deps: HandlerDeps = {}): Promise<Response> {
  const mode = new URL(request.url).searchParams.get('mode');
  if (mode !== 'actor' && mode !== 'film') return json({ error: 'bad_mode' }, 400);
  try {
    const pool = await getStartPool(deps.fetcher);
    if (pool.length === 0) return json({ error: 'empty_pool' }, 502);
    // Try a few times in case a pool film has no usable cast.
    for (let i = 0; i < 5; i++) {
      const id = pickRandom(pool, deps.rng);
      const credits = await getMovieCredits(id, deps.fetcher);
      if (credits.cast.length > 0) return json({ mode, film: credits }, 200); // never cache: must be random
    }
    return json({ error: 'no_start' }, 502);
  } catch (e) {
    return errorResponse(e);
  }
}
