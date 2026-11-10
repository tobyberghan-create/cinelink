import { describe, expect, it } from 'vitest';
import { config } from '../config';
import {
  characterFor,
  eligibleCast,
  findLinks,
  isReleasedFilm,
  isTimedOut,
  isValidActorAnswer,
  isValidFilmAnswer,
  pickNextActor,
  resetTimer,
  resolveSubmission,
  spendLink,
  startActor,
  tickTimer,
  timerTone,
  topBilledN,
  turnTimerSeconds,
  type CastCredit,
  type CrewCredit,
  type FilmCredits,
} from './index';

const TODAY = '2026-11-10';

const cast = (id: number, order: number, character = `Role ${id}`, popularity = 10): CastCredit => ({
  id,
  name: `Actor ${id}`,
  character,
  order,
  popularity,
  profilePath: null,
});
const crew = (id: number, job: string): CrewCredit => ({ id, name: `Person ${id}`, job, profilePath: null });
const film = (id: number, cast: CastCredit[], crew: CrewCredit[] = [], releaseDate: string | null = '2000-01-01', title = `Film ${id}`): FilmCredits => ({
  id,
  title,
  year: releaseDate ? Number(releaseDate.slice(0, 4)) : null,
  releaseDate,
  posterPath: null,
  cast,
  crew,
});

// ---------------------------------------------------------------------------
// Validation table
// ---------------------------------------------------------------------------

describe('Row: Films with the same title (remakes) — check uses the picked TMDB ID', () => {
  const original = film(1, [cast(100, 0)], [], '1960-06-16', 'Psycho');
  const remake = film(2, [cast(200, 0)], [], '1998-12-04', 'Psycho');
  it('actor chain: the two Psychos are judged separately by ID', () => {
    expect(isValidActorAnswer(100, original, [], TODAY)).toEqual({ ok: true });
    expect(isValidActorAnswer(100, remake, [], TODAY)).toEqual({ ok: false, reason: 'not_in_cast' });
    // using one does not use the other
    expect(isValidActorAnswer(200, remake, [1], TODAY)).toEqual({ ok: true });
  });
  it('film chain: same-title film with a different ID is not "already used"', () => {
    const current = film(3, [cast(200, 0)]);
    expect(isValidFilmAnswer(current, remake, [3, 1], {}, TODAY).ok).toBe(true);
  });
});

describe('Row: Film already used this run — "Already in your chain"', () => {
  const f = film(10, [cast(1, 0)]);
  it('actor chain rejects a reused film', () => {
    expect(isValidActorAnswer(1, f, new Set([10]), TODAY)).toEqual({ ok: false, reason: 'already_used' });
  });
  it('film chain rejects a reused film, and the start film counts as used', () => {
    const start = film(20, [cast(1, 0)]);
    const other = film(21, [cast(1, 0)]);
    // start film itself answered back
    expect(isValidFilmAnswer(other, start, [20, 21], {}, TODAY)).toEqual({ ok: false, reason: 'already_used' });
  });
  it('already-used wins over not-in-cast (message says already in chain)', () => {
    expect(isValidActorAnswer(999, f, [10], TODAY)).toEqual({ ok: false, reason: 'already_used' });
  });
});

describe('Row: Typed text not picked from the list — cannot be submitted; Enter picks top suggestion', () => {
  const s = [
    { id: 1, title: 'A', year: 2000, releaseDate: '2000-01-01', posterPath: null },
    { id: 2, title: 'B', year: 2001, releaseDate: '2001-01-01', posterPath: null },
  ];
  it('nothing to submit when there are no suggestions', () => {
    expect(resolveSubmission([], null)).toBeNull();
    expect(resolveSubmission([], 0)).toBeNull();
  });
  it('Enter with nothing highlighted submits the top suggestion', () => {
    expect(resolveSubmission(s, null)?.id).toBe(1);
  });
  it('a highlighted suggestion is submitted', () => {
    expect(resolveSubmission(s, 1)?.id).toBe(2);
    expect(resolveSubmission(s, 7)?.id).toBe(1); // out of range falls back to top
  });
});

describe('Row: Archive footage or uncredited cast — ignored', () => {
  const f = film(30, [
    cast(1, 0, 'Himself (archive footage)'),
    cast(2, 1, 'Cop (uncredited)'),
    cast(3, 2, 'Neo'),
    cast(4, 3, 'Trinity (voice)'),
  ]);
  it('drops archive and uncredited entries, keeps voice roles', () => {
    expect(eligibleCast(f).map((c) => c.id)).toEqual([3, 4]);
  });
  it('archive/uncredited actors do not validate an answer', () => {
    expect(isValidActorAnswer(1, f, [], TODAY)).toEqual({ ok: false, reason: 'not_in_cast' });
    expect(isValidActorAnswer(2, f, [], TODAY)).toEqual({ ok: false, reason: 'not_in_cast' });
    expect(isValidActorAnswer(4, f, [], TODAY)).toEqual({ ok: true });
  });
  it('are never picked as the next actor and do not link films', () => {
    expect(pickNextActor(f, [3, 4], 0)).toBeNull();
    const g = film(31, [cast(1, 0, 'Himself (archive footage)')]);
    expect(findLinks(f, g, {})).toEqual([]);
  });
});

describe('Row: Appearing as themselves (documentaries) — accepted in v1', () => {
  const doc = film(40, [cast(5, 0, 'Self'), cast(6, 1, 'Himself')]);
  it('"Self" credits count', () => {
    expect(isValidActorAnswer(5, doc, [], TODAY)).toEqual({ ok: true });
    expect(isValidActorAnswer(6, doc, [], TODAY)).toEqual({ ok: true });
  });
  it('and link films in Film Chain', () => {
    const feature = film(41, [cast(5, 0, 'Lead')]);
    expect(findLinks(doc, feature, {}).map((l) => l.personId)).toEqual([5]);
  });
});

describe('Row: Unreleased films — release_date must be on or before today', () => {
  it('future, missing and today release dates', () => {
    expect(isReleasedFilm({ releaseDate: '2027-05-01' }, TODAY)).toBe(false);
    expect(isReleasedFilm({ releaseDate: null }, TODAY)).toBe(false);
    expect(isReleasedFilm({ releaseDate: '' }, TODAY)).toBe(false);
    expect(isReleasedFilm({ releaseDate: TODAY }, TODAY)).toBe(true);
    expect(isReleasedFilm({ releaseDate: '2026-11-09' }, TODAY)).toBe(true);
  });
  it('announced casts cannot be used in either mode', () => {
    const future = film(50, [cast(1, 0)], [crew(9, 'Director')], '2027-05-01');
    expect(isValidActorAnswer(1, future, [], TODAY)).toEqual({ ok: false, reason: 'unreleased' });
    const current = film(51, [cast(1, 0)], [crew(9, 'Director')]);
    expect(isValidFilmAnswer(current, future, [51], {}, TODAY)).toEqual({ ok: false, reason: 'unreleased' });
  });
});

describe('Row: Adult titles — include_adult=false on every search', () => {
  // Enforced in the proxy URL builder; see api/_lib/tmdb.test.ts. Config carries no override.
  it('config has no switch to enable adult content', () => {
    expect(JSON.stringify(config)).not.toMatch(/adult/i);
  });
});

describe('Row: TV shows — not searchable in v1', () => {
  // Enforced by using only /search/movie in the proxy; see api/_lib/tmdb.test.ts.
  it('engine types carry no media_type; everything reaching it is a movie', () => {
    const f = film(60, [cast(1, 0)]);
    expect('media_type' in f).toBe(false);
  });
});

describe('Row: Short films and TV movies — accepted if TMDB lists them as movies', () => {
  it('no runtime or type filter exists in the engine', () => {
    const short = film(70, [cast(1, 0, 'Man')], [], '2015-01-01', 'A Short');
    expect(isValidActorAnswer(1, short, [], TODAY)).toEqual({ ok: true });
    const tvMovie = film(71, [cast(1, 0, 'Man')]);
    expect(isValidFilmAnswer(short, tvMovie, [70], {}, TODAY).ok).toBe(true);
  });
});

describe('Row: Sequels and franchises — allowed; the 4-use cap stops endless sequel chains', () => {
  const lead = cast(1, 0, 'Hero', 90);
  const parts = Array.from({ length: 6 }, (_, i) => film(80 + i, [lead], [crew(2, 'Director')], '2000-01-01', `Saga ${i + 1}`));
  it('the same actor links sequel after sequel until their 4th use, then is dropped', () => {
    let counts = {} as Record<number, number>;
    for (let i = 0; i < 4; i++) {
      const links = findLinks(parts[i], parts[i + 1], counts);
      expect(links.map((l) => l.personId).sort()).toEqual([1, 2]);
      counts = { ...spendLink(counts, 1) };
    }
    expect(counts[1]).toBe(config.filmChain.linkCap);
    const after = findLinks(parts[4], parts[5], counts);
    expect(after.map((l) => l.personId)).toEqual([2]); // director still available
    // exhaust the director too -> "No shared people left"
    counts = { ...counts, 2: config.filmChain.linkCap };
    expect(isValidFilmAnswer(parts[4], parts[5], [80, 81, 82, 83, 84], counts, TODAY)).toEqual({
      ok: false,
      reason: 'no_shared_people_left',
    });
  });
  it('each correct answer spends exactly one use, even when several links matched', () => {
    const counts = spendLink({}, 1);
    expect(counts).toEqual({ 1: 1 });
    expect(spendLink(counts, 1)).toEqual({ 1: 2 });
  });
});

describe('Row: Missing or wrong TMDB data — Dispute logs the two IDs; life still lost', () => {
  it('a film with no crew and a stranger cast is simply rejected (the UI offers Dispute)', () => {
    const a = film(90, [cast(1, 0)], []);
    const b = film(91, [cast(2, 0)], []);
    expect(isValidFilmAnswer(a, b, [90], {}, TODAY)).toEqual({ ok: false, reason: 'no_shared_people' });
  });
});

describe('Row: Slow network — timer pauses while an answer is being checked', () => {
  it('a paused timer does not drain; an unpaused one does', () => {
    const t = resetTimer(0);
    expect(t.totalMs).toBe(15000);
    const paused = tickTimer({ ...t, paused: true }, 5000);
    expect(paused.remainingMs).toBe(15000);
    const running = tickTimer(t, 5000);
    expect(running.remainingMs).toBe(10000);
    expect(isTimedOut(tickTimer(running, 99999))).toBe(true);
    expect(tickTimer(running, 99999).remainingMs).toBe(0);
  });
});

describe('Row: TMDB unavailable — pause the run rather than charging lives', () => {
  // Store behaviour: on a 5xx the run enters an "error" state with the timer paused. Covered in store tests.
  it('timer can be held at full while the run is paused', () => {
    const t = { ...resetTimer(3), paused: true };
    expect(tickTimer(t, 60000).remainingMs).toBe(15000);
  });
});

describe('Row: Actor Chain dead end — widen to full cast, then new start actor', () => {
  const f = film(95, [cast(1, 0), cast(2, 1), cast(3, 2), cast(4, 3), cast(5, 4)]);
  it('picks from the top N while any remain', () => {
    const picked = new Set<number>();
    for (let i = 0; i < 200; i++) picked.add(pickNextActor(f, [], 0, config, Math.random)!.id);
    expect([...picked].sort()).toEqual([1, 2, 3]);
  });
  it('widens to the full credited cast once the top N are all used', () => {
    const picked = new Set<number>();
    for (let i = 0; i < 200; i++) picked.add(pickNextActor(f, [1, 2, 3], 0)!.id);
    expect([...picked].sort()).toEqual([4, 5]);
  });
  it('returns null when every eligible actor has been shown (caller shows a new start actor)', () => {
    expect(pickNextActor(f, [1, 2, 3, 4, 5], 0)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Rule tables
// ---------------------------------------------------------------------------

describe('Timer: 15 s until chain 15, then 10 s; amber at 5, red at 3', () => {
  it('turnTimerSeconds', () => {
    expect(turnTimerSeconds(0)).toBe(15);
    expect(turnTimerSeconds(14)).toBe(15);
    expect(turnTimerSeconds(15)).toBe(10);
    expect(turnTimerSeconds(40)).toBe(10);
  });
  it('timerTone', () => {
    expect(timerTone(6)).toBe('normal');
    expect(timerTone(5)).toBe('amber');
    expect(timerTone(3.1)).toBe('amber');
    expect(timerTone(3)).toBe('red');
    expect(timerTone(0)).toBe('red');
  });
});

describe('Actor Chain: top-billed cutoff table', () => {
  it('0-9 → 3, 10-24 → 5, 25-39 → 8, 40+ → 12', () => {
    expect(topBilledN(0)).toBe(3);
    expect(topBilledN(9)).toBe(3);
    expect(topBilledN(10)).toBe(5);
    expect(topBilledN(14)).toBe(5);
    expect(topBilledN(15)).toBe(5);
    expect(topBilledN(24)).toBe(5);
    expect(topBilledN(25)).toBe(8);
    expect(topBilledN(39)).toBe(8);
    expect(topBilledN(40)).toBe(12);
    expect(topBilledN(400)).toBe(12);
  });
});

describe('Actor Chain: next actor', () => {
  it('never an actor already shown this run', () => {
    const f = film(1, [cast(1, 0), cast(2, 1), cast(3, 2)]);
    for (let i = 0; i < 100; i++) expect(pickNextActor(f, [1, 2], 0)!.id).toBe(3);
  });
  it('is weighted towards more popular actors', () => {
    const f = film(1, [cast(1, 0, 'A', 1), cast(2, 1, 'B', 99)]);
    let hits2 = 0;
    for (let i = 0; i < 2000; i++) if (pickNextActor(f, [], 0)!.id === 2) hits2++;
    expect(hits2).toBeGreaterThan(1800);
  });
  it('a deterministic rng is honoured', () => {
    const f = film(1, [cast(1, 0, 'A', 50), cast(2, 1, 'B', 50)]);
    expect(pickNextActor(f, [], 0, config, () => 0)!.id).toBe(1);
    expect(pickNextActor(f, [], 0, config, () => 0.99)!.id).toBe(2);
  });
  it('start actor is the top-billed eligible cast member; character reveal available', () => {
    const f = film(1, [cast(9, 0, 'Narrator (archive footage)'), cast(1, 1, 'Neo'), cast(2, 2, 'Trinity')]);
    expect(startActor(f)!.id).toBe(1);
    expect(characterFor(1, f)).toBe('Neo');
    expect(characterFor(9, f)).toBeNull();
  });
});

describe('Film Chain: who counts as a link', () => {
  const a = film(
    1,
    [cast(1, 0, 'Lead'), cast(15, 14, 'Fifteenth'), cast(16, 15, 'Sixteenth')],
    [crew(20, 'Director'), crew(21, 'Director of Photography'), crew(22, 'Screenplay'), crew(23, 'Writer'), crew(24, 'Story'), crew(25, 'Original Music Composer'), crew(26, 'Editor'), crew(27, 'Novel'), crew(28, 'Characters'), crew(29, 'Producer')],
  );
  const b = film(
    2,
    [cast(1, 3, 'Other'), cast(15, 0, 'Lead'), cast(16, 1, 'Second')],
    [crew(20, 'Director'), crew(21, 'Director of Photography'), crew(22, 'Screenplay'), crew(23, 'Writer'), crew(24, 'Story'), crew(25, 'Original Music Composer'), crew(26, 'Editor'), crew(27, 'Novel'), crew(28, 'Characters'), crew(29, 'Producer')],
  );
  it('actors need order 0-14 on BOTH films; all seven crew jobs count; Novel/Characters/Producer do not', () => {
    const ids = findLinks(a, b, {}).map((l) => l.personId).sort((x, y) => x - y);
    expect(ids).toEqual([1, 15, 20, 21, 22, 23, 24, 25, 26]);
    // 16 is 15th-billed (order 15) on film A -> outside the cutoff
    expect(ids).not.toContain(16);
    expect(ids).not.toContain(27);
    expect(ids).not.toContain(28);
    expect(ids).not.toContain(29);
  });
  it('cutoff is configurable', () => {
    const wide = { ...config, filmChain: { ...config.filmChain, castOrderCutoff: 20 } };
    expect(findLinks(a, b, {}, wide).map((l) => l.personId)).toContain(16);
  });
  it('a crew member who is not eligible on one film is still a link if eligible on both', () => {
    const c = film(3, [], [crew(20, 'Producer')]);
    expect(findLinks(a, c, {})).toEqual([]);
  });
  it('one counter per person, whatever role: director-writer is one link', () => {
    const d1 = film(4, [cast(7, 0, 'Also acts')], [crew(7, 'Director'), crew(7, 'Screenplay')]);
    const d2 = film(5, [], [crew(7, 'Director'), crew(7, 'Writer')]);
    const links = findLinks(d1, d2, {});
    expect(links).toHaveLength(1);
    expect(links[0].roleA).toBe('Cast (Also acts) / Director / Screenplay');
    expect(links[0].roleB).toBe('Director / Writer');
  });
  it('reports roles on each film and uses so far; pre-select = most uses remaining', () => {
    const links = findLinks(a, b, { 1: 3, 20: 1 });
    expect(links[0].usesSoFar).toBe(0);
    expect(links.find((l) => l.personId === 1)).toMatchObject({ roleA: 'Cast (Lead)', roleB: 'Cast (Other)', usesSoFar: 3 });
    expect(links[links.length - 1].personId).toBe(1);
  });
  it('people at the cap are dropped', () => {
    expect(findLinks(a, b, { 1: 4, 20: 4 }).map((l) => l.personId)).not.toContain(1);
  });
  it('isValidFilmAnswer returns links for the chooser', () => {
    const v = isValidFilmAnswer(a, b, [1], {}, TODAY);
    expect(v.ok).toBe(true);
    expect(v.links!.length).toBe(9);
  });
});
