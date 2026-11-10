import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { config } from '../../src/config.js';
import { handleMovie, handleSearch, handleStart } from './handlers.js';
import {
  buildDiscoverUrl,
  buildMovieUrl,
  buildSearchUrl,
  clearMemCache,
  isReleased,
  startPoolPages,
  trimMovie,
  trimSearch,
} from './tmdb.js';

const TODAY = '2026-11-10';

function jsonRes(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
}

const rawMovie = (id: number, extra: Record<string, unknown> = {}) => ({
  id,
  title: `Film ${id}`,
  release_date: '1999-03-31',
  poster_path: '/p.jpg',
  overview: 'should be trimmed away',
  budget: 1,
  credits: {
    cast: [
      { id: 10, name: 'Lead', character: 'Neo', order: 0, popularity: 50, profile_path: '/a.jpg', gender: 2 },
      { id: 11, name: 'Second', character: 'Trinity', order: 1, popularity: 30, profile_path: null },
    ],
    crew: [
      { id: 20, name: 'Dir', job: 'Director', department: 'Directing', profile_path: null },
      { id: 21, name: 'Gaffer', job: 'Gaffer', department: 'Lighting', profile_path: null },
      { id: 22, name: 'Novelist', job: 'Novel', department: 'Writing', profile_path: null },
      { id: 23, name: 'DP', job: 'Director of Photography', department: 'Camera', profile_path: null },
    ],
  },
  ...extra,
});

describe('URL builders', () => {
  it('search uses /search/movie (movies only) with include_adult=false', () => {
    const u = new URL(buildSearchUrl('alien'));
    expect(u.pathname).toBe('/3/search/movie');
    expect(u.searchParams.get('include_adult')).toBe('false');
    expect(u.searchParams.get('query')).toBe('alien');
  });
  it('movie appends credits', () => {
    const u = new URL(buildMovieUrl(603));
    expect(u.pathname).toBe('/3/movie/603');
    expect(u.searchParams.get('append_to_response')).toBe('credits');
  });
  it('discover sorts by vote_count.desc, released only, no adult', () => {
    const u = new URL(buildDiscoverUrl(3, TODAY));
    expect(u.searchParams.get('sort_by')).toBe('vote_count.desc');
    expect(u.searchParams.get('primary_release_date.lte')).toBe(TODAY);
    expect(u.searchParams.get('include_adult')).toBe('false');
    expect(u.searchParams.get('page')).toBe('3');
  });
  it('start pool covers ~1,000 films = 50 pages', () => {
    expect(startPoolPages()).toBe(config.startPool.size / config.startPool.pageSize);
    expect(startPoolPages()).toBe(50);
  });
});

describe('trimming', () => {
  it('trimSearch keeps only id/title/year/poster, drops unreleased & adult, caps at maxResults', () => {
    const raw = {
      results: [
        { id: 1, title: 'A', release_date: '2001-01-01', poster_path: '/a.jpg', overview: 'x', vote_average: 7 },
        { id: 2, title: 'Future', release_date: '2027-01-01', poster_path: null },
        { id: 3, title: 'Undated', release_date: '', poster_path: null },
        { id: 4, title: 'Adult', release_date: '2000-01-01', poster_path: null, adult: true },
        { id: 5, title: 'Today', release_date: TODAY, poster_path: null },
        ...Array.from({ length: 10 }, (_, i) => ({ id: 100 + i, title: `F${i}`, release_date: '1990-01-01' })),
      ],
    };
    const out = trimSearch(raw, TODAY);
    expect(out.map((r) => r.id)).toEqual([1, 5, 100, 101, 102, 103]);
    expect(out).toHaveLength(config.search.maxResults);
    expect(out[0]).toEqual({ id: 1, title: 'A', year: 2001, releaseDate: '2001-01-01', posterPath: '/a.jpg' });
    expect(Object.keys(out[0])).not.toContain('overview');
  });

  it('trimMovie keeps cast fields, sorts by order, and keeps only eligible crew jobs', () => {
    const t = trimMovie(rawMovie(603));
    expect(t).toMatchObject({ id: 603, title: 'Film 603', year: 1999, releaseDate: '1999-03-31', posterPath: '/p.jpg' });
    expect((t as unknown as Record<string, unknown>).overview).toBeUndefined();
    expect(t.cast.map((c) => c.id)).toEqual([10, 11]);
    expect(t.cast[0]).toEqual({ id: 10, name: 'Lead', character: 'Neo', order: 0, popularity: 50, profilePath: '/a.jpg' });
    // Gaffer and Novel are not eligible link roles
    expect(t.crew.map((c) => c.job).sort()).toEqual(['Director', 'Director of Photography']);
  });

  it('isReleased: on or before today only; missing date = unreleased', () => {
    expect(isReleased('2026-11-10', TODAY)).toBe(true);
    expect(isReleased('2026-11-11', TODAY)).toBe(false);
    expect(isReleased('', TODAY)).toBe(false);
    expect(isReleased(null, TODAY)).toBe(false);
  });
});

describe('handlers (mock TMDB)', () => {
  let calls: string[];
  const fetcher = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    calls.push(url.pathname);
    expect(url.searchParams.get('api_key')).toBe('test-key'); // key added server-side
    if (url.pathname === '/3/search/movie') {
      if (url.searchParams.get('query') === 'ratelimit' && calls.filter((c) => c === url.pathname).length === 1) {
        return jsonRes({ status_message: 'slow down' }, 429, { 'retry-after': '0' });
      }
      return jsonRes({ results: [{ id: 1, title: 'A', release_date: '2001-01-01' }] });
    }
    if (url.pathname === '/3/discover/movie') {
      const p = Number(url.searchParams.get('page'));
      return jsonRes({ results: [{ id: p * 1000 + 1 }, { id: p * 1000 + 2 }] });
    }
    const m = url.pathname.match(/\/3\/movie\/(\d+)/);
    if (m) {
      if (m[1] === '404') return jsonRes({ status_message: 'nope' }, 404);
      return jsonRes(rawMovie(Number(m[1])));
    }
    return jsonRes({}, 500);
  }) as unknown as typeof fetch;

  beforeEach(() => {
    calls = [];
    clearMemCache();
    process.env.TMDB_API_KEY = 'test-key';
  });
  afterEach(() => {
    delete process.env.TMDB_API_KEY;
  });

  it('search returns trimmed JSON with a public cache header and never the key', async () => {
    const res = await handleSearch(new Request('http://x/api/search?q=alien'), { fetcher });
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toContain(`s-maxage=${config.search.cacheSeconds}`);
    const text = await res.text();
    expect(text).not.toContain('test-key');
    expect(JSON.parse(text)).toEqual({ results: [{ id: 1, title: 'A', year: 2001, releaseDate: '2001-01-01', posterPath: null }] });
  });

  it('empty query returns no results without calling TMDB', async () => {
    const res = await handleSearch(new Request('http://x/api/search?q=%20'), { fetcher });
    expect(await res.json()).toEqual({ results: [] });
    expect(calls).toHaveLength(0);
  });

  it('backs off and retries on 429', async () => {
    const res = await handleSearch(new Request('http://x/api/search?q=ratelimit'), { fetcher });
    expect(res.status).toBe(200);
    expect(calls.filter((c) => c === '/3/search/movie')).toHaveLength(2);
  });

  it('movie credits are trimmed, cached for a week at the edge, and memoised in-process', async () => {
    const r1 = await handleMovie('603', { fetcher });
    expect(r1.status).toBe(200);
    expect(r1.headers.get('cache-control')).toContain(`s-maxage=${config.credits.cacheSeconds}`);
    const body = await r1.json();
    expect(body.crew.map((c: { job: string }) => c.job)).toEqual(['Director', 'Director of Photography']);
    await handleMovie('603', { fetcher });
    expect(calls.filter((c) => c === '/3/movie/603')).toHaveLength(1); // second call served from cache
  });

  it('movie: bad id -> 400, unknown id -> 404', async () => {
    expect((await handleMovie('abc', { fetcher })).status).toBe(400);
    expect((await handleMovie('404', { fetcher })).status).toBe(404);
  });

  it('start: validates mode, fetches 50 discover pages once, returns a random film with credits, no-store', async () => {
    expect((await handleStart(new Request('http://x/api/start'), { fetcher })).status).toBe(400);
    const res = await handleStart(new Request('http://x/api/start?mode=actor'), { fetcher, rng: () => 0 });
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const body = await res.json();
    expect(body.mode).toBe('actor');
    expect(body.film.id).toBe(1001); // rng 0 -> first id of page 1
    expect(body.film.cast).toHaveLength(2);
    expect(calls.filter((c) => c === '/3/discover/movie')).toHaveLength(50);
    // Pool is cached: a second start does not re-discover
    await handleStart(new Request('http://x/api/start?mode=film'), { fetcher, rng: () => 0.999 });
    expect(calls.filter((c) => c === '/3/discover/movie')).toHaveLength(50);
  });

  it('upstream failure -> 502 upstream_unavailable (UI pauses the run, no life lost)', async () => {
    const failing = (async () => jsonRes({}, 500)) as unknown as typeof fetch;
    const res = await handleMovie('1', { fetcher: failing });
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: 'upstream_unavailable' });
  });

  it('missing TMDB_API_KEY never leaks and fails closed', async () => {
    delete process.env.TMDB_API_KEY;
    const res = await handleMovie('1', { fetcher });
    expect(res.status).toBe(500);
  });
});
