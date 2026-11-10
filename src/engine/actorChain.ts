import { config as defaultConfig, type Config } from '../config';
import { eligibleCast, isReleasedFilm } from './filters';
import type { CastCredit, FilmCredits, Rng, Verdict } from './types';

/**
 * Actor Chain answer check. Validation is by TMDB ID only.
 * Order of checks: unreleased → already used → not in cast.
 */
export function isValidActorAnswer(
  actorId: number,
  filmCredits: FilmCredits,
  usedFilmIds: ReadonlySet<number> | readonly number[],
  today: string,
  config: Config = defaultConfig,
): Verdict {
  const used = usedFilmIds instanceof Set ? usedFilmIds : new Set(usedFilmIds as readonly number[]);
  if (!isReleasedFilm(filmCredits, today)) return { ok: false, reason: 'unreleased' };
  if (used.has(filmCredits.id)) return { ok: false, reason: 'already_used' };
  const credit = eligibleCast(filmCredits, config).find((c) => c.id === actorId);
  if (!credit) return { ok: false, reason: 'not_in_cast' };
  return { ok: true };
}

/** The shown actor's character name on the film (for the ~1 s reveal). */
export function characterFor(actorId: number, filmCredits: FilmCredits, config: Config = defaultConfig): string | null {
  const c = eligibleCast(filmCredits, config).find((x) => x.id === actorId);
  return c ? c.character || null : null;
}

/** Top-N billed cutoff for the next-actor draw at a given chain length. */
export function topBilledN(chainLength: number, config: Config = defaultConfig): number {
  let n = config.actorChain.topBilledBands[0].topN;
  for (const band of config.actorChain.topBilledBands) if (chainLength >= band.fromChain) n = band.topN;
  return n;
}

function weightedPick(candidates: CastCredit[], rng: Rng, floor: number): CastCredit {
  const weights = candidates.map((c) => Math.max(c.popularity, floor));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < candidates.length; i++) {
    r -= weights[i];
    if (r <= 0) return candidates[i];
  }
  return candidates[candidates.length - 1];
}

/**
 * Pick the next actor from a film's cast:
 *  - never an actor already shown this run;
 *  - from the top N billed (N grows with the chain);
 *  - weighted towards more popular actors (TMDB popularity).
 * Dead end: if none left in the top N, widen to the full credited cast.
 * Returns null when the whole cast is used (caller shows a new start actor).
 */
export function pickNextActor(
  filmCredits: FilmCredits,
  usedActorIds: ReadonlySet<number> | readonly number[],
  chainLength: number,
  config: Config = defaultConfig,
  rng: Rng = Math.random,
): CastCredit | null {
  const used = usedActorIds instanceof Set ? usedActorIds : new Set(usedActorIds as readonly number[]);
  const cast = eligibleCast(filmCredits, config);
  const n = topBilledN(chainLength, config);
  const top = cast.slice(0, n).filter((c) => !used.has(c.id));
  const pool = top.length > 0 ? top : cast.filter((c) => !used.has(c.id));
  if (pool.length === 0) return null;
  return weightedPick(pool, rng, config.actorChain.popularityFloor);
}

/** The start actor for a run: the start film's top-billed eligible cast member. */
export function startActor(filmCredits: FilmCredits, config: Config = defaultConfig): CastCredit | null {
  return eligibleCast(filmCredits, config)[0] ?? null;
}
