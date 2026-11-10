import { config as defaultConfig, type Config } from '../config';
import type { CastCredit, FilmCredits } from './types';

/**
 * Eligible cast = any credited cast role, voice roles included. Archive
 * footage and uncredited appearances are dropped. "Self" credits (documentaries)
 * are accepted in v1. Returned sorted by billing order.
 */
export function eligibleCast(film: FilmCredits, config: Config = defaultConfig): CastCredit[] {
  const markers = config.ignoredCharacterMarkers.map((m) => m.toLowerCase());
  return film.cast
    .filter((c) => {
      const ch = (c.character ?? '').toLowerCase();
      return !markers.some((m) => ch.includes(m));
    })
    .sort((a, b) => a.order - b.order);
}

/** Today's date as YYYY-MM-DD in the device's local time zone. */
export function todayLocalIso(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** A film is released when it has a release date on or before today. */
export function isReleasedFilm(film: Pick<FilmCredits, 'releaseDate'>, today: string): boolean {
  return !!film.releaseDate && film.releaseDate <= today;
}
