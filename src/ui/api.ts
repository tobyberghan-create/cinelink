import { config } from '../config';
import type { FilmCredits, GameMode, SearchResponse, SearchResult } from '../shared/types';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(`${status} ${code}`);
  }
  /** True when the film database (or the proxy) cannot be reached — pause the run, don't charge a life. */
  get unavailable(): boolean {
    return this.status === 0 || this.status >= 500;
  }
}

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, { signal, headers: { accept: 'application/json' } });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new ApiError(0, 'network');
  }
  if (!res.ok) {
    let code = 'error';
    try {
      code = ((await res.json()) as { error?: string }).error ?? code;
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, code);
  }
  return (await res.json()) as T;
}

export function fetchStart(mode: GameMode): Promise<{ mode: GameMode; film: FilmCredits }> {
  return getJson(`/api/start?mode=${mode}`);
}

export function fetchMovie(id: number): Promise<FilmCredits> {
  return getJson(`/api/movie/${id}`);
}

export async function searchFilms(q: string, signal?: AbortSignal): Promise<SearchResult[]> {
  const r = await getJson<SearchResponse>(`/api/search?q=${encodeURIComponent(q)}`, signal);
  return r.results.slice(0, config.search.maxResults);
}

export function posterUrl(path: string | null, size: string = config.images.posterSize): string | null {
  return path ? `${config.images.baseUrl}/${size}${path}` : null;
}
export function profileUrl(path: string | null): string | null {
  return path ? `${config.images.baseUrl}/${config.images.profileSize}${path}` : null;
}
export function thumbUrl(path: string | null): string | null {
  return path ? `${config.images.baseUrl}/${config.images.thumbSize}${path}` : null;
}
