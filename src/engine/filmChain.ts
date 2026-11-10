import { config as defaultConfig, type Config } from '../config';
import { eligibleCast, isReleasedFilm } from './filters';
import type { FilmCredits, Link, UseCounts, Verdict } from './types';

interface PersonRole {
  id: number;
  name: string;
  profilePath: string | null;
  roles: string[];
}

/**
 * Every person on a film who can act as a link, with their role labels:
 *  - cast with billing order 0..cutoff (top 15 by default)
 *  - crew with an eligible job (Director, DoP, Screenplay/Writer/Story, Composer, Editor)
 * A person in several roles appears once, with all their roles.
 */
export function linkablePeople(film: FilmCredits, config: Config = defaultConfig): Map<number, PersonRole> {
  const people = new Map<number, PersonRole>();
  const add = (id: number, name: string, profilePath: string | null, role: string) => {
    const p = people.get(id);
    if (p) {
      if (!p.roles.includes(role)) p.roles.push(role);
    } else people.set(id, { id, name, profilePath, roles: [role] });
  };
  for (const c of eligibleCast(film, config)) {
    if (c.order <= config.filmChain.castOrderCutoff) add(c.id, c.name, c.profilePath, c.character ? `Cast (${c.character})` : 'Cast');
  }
  const jobs = new Set(config.filmChain.eligibleCrewJobs);
  for (const c of film.crew) if (jobs.has(c.job)) add(c.id, c.name, c.profilePath, c.job);
  return people;
}

/**
 * Every shared eligible person between two films who still has uses left
 * (one shared counter per person, whatever their roles). Sorted by most uses
 * remaining first, then by name, so index 0 is the one to pre-select.
 */
export function findLinks(
  creditsA: FilmCredits,
  creditsB: FilmCredits,
  useCounts: UseCounts,
  config: Config = defaultConfig,
): Link[] {
  const a = linkablePeople(creditsA, config);
  const b = linkablePeople(creditsB, config);
  const links: Link[] = [];
  for (const [id, pa] of a) {
    const pb = b.get(id);
    if (!pb) continue;
    const usesSoFar = useCounts[id] ?? 0;
    if (usesSoFar >= config.filmChain.linkCap) continue;
    links.push({
      personId: id,
      name: pa.name,
      profilePath: pa.profilePath ?? pb.profilePath,
      roleA: pa.roles.join(' / '),
      roleB: pb.roles.join(' / '),
      usesSoFar,
    });
  }
  return links.sort((x, y) => x.usesSoFar - y.usesSoFar || x.name.localeCompare(y.name));
}

/** Count of shared eligible people ignoring the cap (to tell "none" from "none left"). */
export function sharedPeopleCount(creditsA: FilmCredits, creditsB: FilmCredits, config: Config = defaultConfig): number {
  const a = linkablePeople(creditsA, config);
  const b = linkablePeople(creditsB, config);
  let n = 0;
  for (const id of a.keys()) if (b.has(id)) n++;
  return n;
}

/**
 * Film Chain answer check. Validation is by TMDB ID only. The start film counts
 * as used. Order of checks: unreleased → already used → links.
 */
export function isValidFilmAnswer(
  currentFilm: FilmCredits,
  answer: FilmCredits,
  usedFilmIds: ReadonlySet<number> | readonly number[],
  useCounts: UseCounts,
  today: string,
  config: Config = defaultConfig,
): Verdict & { links?: Link[] } {
  const used = usedFilmIds instanceof Set ? usedFilmIds : new Set(usedFilmIds as readonly number[]);
  if (!isReleasedFilm(answer, today)) return { ok: false, reason: 'unreleased' };
  if (used.has(answer.id)) return { ok: false, reason: 'already_used' };
  const links = findLinks(currentFilm, answer, useCounts, config);
  if (links.length === 0) {
    const any = sharedPeopleCount(currentFilm, answer, config) > 0;
    return { ok: false, reason: any ? 'no_shared_people_left' : 'no_shared_people' };
  }
  return { ok: true, links };
}

/** Spend one use of a person. Each correct answer spends exactly one. */
export function spendLink(useCounts: UseCounts, personId: number): UseCounts {
  return { ...useCounts, [personId]: (useCounts[personId] ?? 0) + 1 };
}

/** Human label for a role on a link, e.g. "Director" or "cinematographer". */
export function roleLabel(job: string): string {
  switch (job) {
    case 'Director of Photography':
      return 'Cinematographer';
    case 'Original Music Composer':
      return 'Composer';
    case 'Screenplay':
    case 'Story':
      return 'Writer';
    default:
      return job.startsWith('Cast') ? 'Actor' : job;
  }
}
