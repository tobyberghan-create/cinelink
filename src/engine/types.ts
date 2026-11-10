import type { CastCredit, CrewCredit, FilmCredits } from '../shared/types';

export type { CastCredit, CrewCredit, FilmCredits };

export type RejectReason =
  | 'already_used' // film already in the chain this run (start film counts in Film Chain)
  | 'not_in_cast' // Actor Chain: shown actor has no eligible cast credit on the film
  | 'unreleased' // release_date missing or after today
  | 'no_shared_people' // Film Chain: no eligible person in common at all
  | 'no_shared_people_left'; // Film Chain: shared people exist but all are at the use cap

export const REJECT_MESSAGES: Record<RejectReason, string> = {
  already_used: 'Already in your chain',
  not_in_cast: 'Not in the cast',
  unreleased: 'Not released yet',
  no_shared_people: 'No shared people',
  no_shared_people_left: 'No shared people left',
};

export type Verdict = { ok: true } | { ok: false; reason: RejectReason };

/** A person shared between two films, with the role they hold on each. */
export interface Link {
  personId: number;
  name: string;
  profilePath: string | null;
  /** Role label on film A, e.g. "Director" or "Cast (Neo)". */
  roleA: string;
  roleB: string;
  /** Uses spent so far this run (before this link is spent). */
  usesSoFar: number;
}

export type UseCounts = Readonly<Record<number, number>>;

export type Rng = () => number;
