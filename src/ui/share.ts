import type { GameMode } from '../shared/types';

/** Short text result: mode, score, game link. */
export function buildShareText(mode: GameMode, score: number, origin: string): string {
  const name = mode === 'actor' ? 'Actor Chain' : 'Film Chain';
  const links = score === 1 ? 'link' : 'links';
  return `CineLink · ${name}\nI kept the chain going for ${score} ${links} 🎬\nBeat me: ${origin}`;
}
