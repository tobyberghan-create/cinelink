/**
 * TMDB v3 proxy library. Pure helpers (URL building, trimming) are exported
 * separately from the fetching code so they can be unit-tested without network.
 *
 * The API key is read from the server environment only (TMDB_API_KEY) and is
 * never included in any response.
 */
import { config } from '../../src/config';
import type { CastCredit, CrewCredit, FilmCredits, SearchResult } from '../../src/shared/types';

export const TMDB_BASE = 'https://api.themoviedb.org/3';

// ---------- URL builders (pure) ----------

export function buildSearchUrl(query: string, page = 1): string {
  const u = new URL(`${TMDB_BASE}/search/movie`);
  u.searchParams.set('query', query);
  u.searchParams.set('include_adult', 'false'); // every search, per spec
  u.searchParams.set('language', 'en-US');
  u.searchParams.set('page', String(page));
  return u.toString();
}

export function buildMovieUrl(id: number): string {
  const u = new URL(`${TMDB_BASE}/movie/${id}`);
  u.searchParams.set('append_to_response', 'credits');
  u.searchParams.set('language', 'en-US');
  return u.toString();
}

export function buildDiscoverUrl(page: number, today: string): string {
  const u = new URL(`${TMDB_BASE}/discover/movie`);
  u.searchParams.set('sort_by', 'vote_count.desc');
  u.searchParams.set('include_adult', 'false');
  u.searchParams.set('include_video', 'false');
  u.searchParams.set('language', 'en-US');
  u.searchParams.set('primary_release_date.lte', today); // released only
  u.searchParams.set('page', String(page));
  return u.toString();
}

export function startPoolPages(): number {
  return Math.ceil(config.startPool.size / config.startPool.pageSize);
}

// ---------- Trimming (pure) ----------

export function yearOf(releaseDate: string | null | undefined): number | null {
  if (!releaseDate || releaseDate.length < 4) return null;
  const y = Number(releaseDate.slice(0, 4));
  return Number.isFinite(y) ? y : null;
}

export function todayIso(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** Released = has a release_date on or before `today`. */
export function isReleased(releaseDate: string | null | undefined, today: string): boolean {
  return !!releaseDate && releaseDate <= today;
}

interface RawSearchItem {
  id: number;
  title?: string;
  release_date?: string;
  poster_path?: string | null;
  adult?: boolean;
}

export function trimSearch(raw: { results?: RawSearchItem[] }, today: string): SearchResult[] {
  const out: SearchResult[] = [];
  for (const r of raw.results ?? []) {
    if (r.adult) continue; // belt and braces; include_adult=false already set
    if (!isReleased(r.release_date, today)) continue; // unreleased never offered
    out.push({
      id: r.id,
      title: r.title ?? '',
      year: yearOf(r.release_date),
      releaseDate: r.release_date ?? null,
      posterPath: r.poster_path ?? null,
    });
    if (out.length >= config.search.maxResults) break;
  }
  return out;
}

interface RawCast {
  id: number;
  name: string;
  character?: string;
  order?: number;
  popularity?: number;
  profile_path?: string | null;
}
interface RawCrew {
  id: number;
  name: string;
  job?: string;
  profile_path?: string | null;
}
export interface RawMovie {
  id: number;
  title?: string;
  release_date?: string;
  poster_path?: string | null;
  credits?: { cast?: RawCast[]; crew?: RawCrew[] };
}

export function trimMovie(raw: RawMovie): FilmCredits {
  const cast: CastCredit[] = (raw.credits?.cast ?? [])
    .map((c) => ({
      id: c.id,
      name: c.name,
      character: c.character ?? '',
      order: c.order ?? 9999,
      popularity: c.popularity ?? 0,
      profilePath: c.profile_path ?? null,
    }))
    .sort((a, b) => a.order - b.order);

  const eligible = new Set(config.filmChain.eligibleCrewJobs);
  const crew: CrewCredit[] = (raw.credits?.crew ?? [])
    .filter((c) => c.job && eligible.has(c.job))
    .map((c) => ({ id: c.id, name: c.name, job: c.job as string, profilePath: c.profile_path ?? null }));

  return {
    id: raw.id,
    title: raw.title ?? '',
    year: yearOf(raw.release_date),
    releaseDate: raw.release_date ?? null,
    posterPath: raw.poster_path ?? null,
    cast,
    crew,
  };
}

// ---------- Fetching ----------

export class TmdbError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Server-side configuration problem (missing credentials). */
export class ConfigError extends Error {}

export type Fetcher = typeof fetch;

/**
 * Credentials come from the server environment only. Either works:
 *  - TMDB_API_KEY            (v3 key, sent as ?api_key=)
 *  - TMDB_READ_ACCESS_TOKEN  (v4 read token, sent as Authorization: Bearer)
 */
function auth(u: URL): Record<string, string> {
  const headers: Record<string, string> = { accept: 'application/json' };
  const key = process.env.TMDB_API_KEY;
  const token = process.env.TMDB_READ_ACCESS_TOKEN;
  if (key) u.searchParams.set('api_key', key);
  else if (token) headers.authorization = `Bearer ${token}`;
  else throw new ConfigError('TMDB_API_KEY (or TMDB_READ_ACCESS_TOKEN) is not set on the server');
  return headers;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** GET JSON from TMDB with credentials added server-side and 429 back-off. */
export async function tmdbGet<T>(url: string, fetcher: Fetcher = fetch): Promise<T> {
  const u = new URL(url);
  const headers = auth(u);
  let attempt = 0;
  for (;;) {
    const res = await fetcher(u.toString(), { headers });
    if (res.status === 429 && attempt < config.tmdb.maxRetries) {
      const retryAfter = Number(res.headers.get('retry-after'));
      await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : config.tmdb.backoffMs * (attempt + 1));
      attempt++;
      continue;
    }
    if (!res.ok) throw new TmdbError(res.status, `TMDB ${res.status} for ${u.pathname}`);
    return (await res.json()) as T;
  }
}

// ---------- In-memory cache (per function instance; edge cache is the primary layer) ----------

const mem = new Map<string, { expires: number; value: unknown }>();

export async function cached<T>(key: string, ttlSeconds: number, load: () => Promise<T>): Promise<T> {
  const hit = mem.get(key);
  const now = Date.now();
  if (hit && hit.expires > now) return hit.value as T;
  const value = await load();
  mem.set(key, { expires: now + ttlSeconds * 1000, value });
  return value;
}

export function clearMemCache(): void {
  mem.clear();
}

// ---------- High-level loaders ----------

export async function searchMovies(query: string, fetcher: Fetcher = fetch, today = todayIso()): Promise<SearchResult[]> {
  const q = query.trim();
  if (!q) return [];
  return cached(`search:${q.toLowerCase()}:${today}`, config.search.cacheSeconds, async () => {
    const raw = await tmdbGet<{ results?: RawSearchItem[] }>(buildSearchUrl(q), fetcher);
    return trimSearch(raw, today);
  });
}

export async function getMovieCredits(id: number, fetcher: Fetcher = fetch): Promise<FilmCredits> {
  return cached(`movie:${id}`, config.credits.cacheSeconds, async () => {
    const raw = await tmdbGet<RawMovie>(buildMovieUrl(id), fetcher);
    return trimMovie(raw);
  });
}

/** IDs of roughly the N most-voted released films. Cached for a week. */
export async function getStartPool(fetcher: Fetcher = fetch, today = todayIso()): Promise<number[]> {
  return cached(`startpool`, config.startPool.cacheSeconds, async () => {
    const pages = startPoolPages();
    const ids: number[] = [];
    // Fetch in small parallel batches to stay well under TMDB's soft limit.
    const batch = 5;
    for (let p = 1; p <= pages; p += batch) {
      const nums = Array.from({ length: Math.min(batch, pages - p + 1) }, (_, i) => p + i);
      const results = await Promise.all(
        nums.map((n) => tmdbGet<{ results?: RawSearchItem[] }>(buildDiscoverUrl(n, today), fetcher)),
      );
      for (const r of results) for (const m of r.results ?? []) if (!m.adult) ids.push(m.id);
    }
    return ids;
  });
}

export function pickRandom<T>(items: T[], rng: () => number = Math.random): T {
  return items[Math.floor(rng() * items.length)];
}
