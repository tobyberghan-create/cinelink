/**
 * Trimmed shapes returned by the proxy and consumed by the engine + UI.
 * Only the fields the game uses.
 */

export interface CastCredit {
  id: number;
  name: string;
  character: string;
  /** TMDB billing order, 0 = top billed. */
  order: number;
  popularity: number;
  profilePath: string | null;
}

export interface CrewCredit {
  id: number;
  name: string;
  /** TMDB job name, e.g. "Director of Photography". Only eligible jobs are kept. */
  job: string;
  profilePath: string | null;
}

export interface FilmCredits {
  id: number;
  title: string;
  /** Four-digit year or null when TMDB has no release date. */
  year: number | null;
  /** ISO date "YYYY-MM-DD" or null. */
  releaseDate: string | null;
  posterPath: string | null;
  cast: CastCredit[];
  crew: CrewCredit[];
}

export interface SearchResult {
  id: number;
  title: string;
  year: number | null;
  releaseDate: string | null;
  posterPath: string | null;
}

export interface SearchResponse {
  results: SearchResult[];
}

export type GameMode = 'actor' | 'film';
