import type { GameMode } from '../shared/types';

const KEY = 'cinelink.bests.v1';

export type Bests = Record<GameMode, number>;

export function loadBests(): Bests {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Bests>;
      return { actor: p.actor ?? 0, film: p.film ?? 0 };
    }
  } catch {
    /* private mode or disabled storage */
  }
  return { actor: 0, film: 0 };
}

export function saveBests(b: Bests): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(b));
  } catch {
    /* ignore */
  }
}
