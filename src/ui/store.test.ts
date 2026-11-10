import { beforeEach, describe, expect, it, vi } from 'vitest';
import { config } from '../config';
import type { CastCredit, CrewCredit, FilmCredits } from '../engine';

// ---- mocks ----
const store = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
});

const films = new Map<number, FilmCredits>();
let startQueue: FilmCredits[] = [];
let failNext = false;

vi.mock('./api', async () => {
  const actual = await vi.importActual<typeof import('./api')>('./api');
  return {
    ...actual,
    fetchStart: vi.fn(async (mode: string) => {
      if (failNext) {
        failNext = false;
        throw new actual.ApiError(502, 'upstream_unavailable');
      }
      return { mode, film: startQueue.shift() ?? [...films.values()][0] };
    }),
    fetchMovie: vi.fn(async (id: number) => {
      if (failNext) {
        failNext = false;
        throw new actual.ApiError(0, 'network');
      }
      const f = films.get(id);
      if (!f) throw new actual.ApiError(404, 'not_found');
      return f;
    }),
  };
});

const { useGame } = await import('./store');

const cast = (id: number, order: number, character = `Role ${id}`): CastCredit => ({ id, name: `Actor ${id}`, character, order, popularity: 10, profilePath: null });
const crew = (id: number, job: string): CrewCredit => ({ id, name: `Person ${id}`, job, profilePath: null });
const film = (id: number, c: CastCredit[], cr: CrewCredit[] = [], releaseDate = '2000-01-01'): FilmCredits => {
  const f = { id, title: `Film ${id}`, year: 2000, releaseDate, posterPath: null, cast: c, crew: cr };
  films.set(id, f);
  return f;
};
const pick = (id: number) => ({ id, title: `Film ${id}`, year: 2000, releaseDate: '2000-01-01', posterPath: null });
const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  vi.useRealTimers();
  films.clear();
  startQueue = [];
  failNext = false;
  store.clear();
});

describe('Actor Chain run', () => {
  it('start → correct → reveal → next actor; wrong keeps the actor and costs a life; three strikes = game over with best saved', async () => {
    // Start film: actor 1 top billed. Film 2 has actors 1 & 2. Film 3 has actor 9 only.
    startQueue.push(film(100, [cast(1, 0, 'Lead'), cast(5, 1)]));
    film(2, [cast(1, 0, 'Neo'), cast(2, 1, 'Trinity')]);
    film(3, [cast(9, 0)]);

    const g = useGame.getState();
    g.startRun('actor');
    expect(useGame.getState().phase).toBe('loading');
    await flush();
    let s = useGame.getState();
    expect(s.phase).toBe('playing');
    expect(s.currentActor?.id).toBe(1);
    expect(s.timer.remainingMs).toBe(15000);
    expect(s.timer.paused).toBe(false);

    // Correct answer: timer pauses during the check, chain +1, character revealed, then next actor (2) from film 2.
    s.submitAnswer(pick(2));
    expect(useGame.getState().phase).toBe('checking');
    expect(useGame.getState().timer.paused).toBe(true);
    await flush();
    s = useGame.getState();
    expect(s.phase).toBe('reveal');
    expect(s.score).toBe(1);
    expect(s.feedback?.message).toBe('as Neo');
    await new Promise((r) => setTimeout(r, config.actorChain.revealMs + 20));
    s = useGame.getState();
    expect(s.phase).toBe('playing');
    expect(s.currentActor?.id).toBe(2);
    expect(s.usedFilmIds).toEqual([2]);
    expect(s.chain.map((c) => `${c.kind}:${c.id}`)).toEqual(['person:1', 'film:2', 'person:2']);

    // Already used film -> wrong, same actor stays, life lost, timer reset
    s.submitAnswer(pick(2));
    await flush();
    s = useGame.getState();
    expect(s.lives).toBe(2);
    expect(s.feedback?.message).toBe('Already in your chain');
    expect(s.feedback?.dispute).toMatchObject({ mode: 'actor', reason: 'already_used', personId: 2, filmIds: [2] });
    expect(s.currentActor?.id).toBe(2);
    expect(s.phase).toBe('playing');
    expect(s.timer.remainingMs).toBe(15000);

    // Not in cast -> wrong
    s.submitAnswer(pick(3));
    await flush();
    s = useGame.getState();
    expect(s.lives).toBe(1);
    expect(s.feedback?.message).toBe('Not in the cast');

    // Timeout -> last life, game over, best saved
    s.tick(15000);
    s = useGame.getState();
    expect(s.lives).toBe(0);
    expect(s.screen).toBe('gameover');
    expect(s.phase).toBe('over');
    expect(s.newBest).toBe(true);
    expect(s.bests.actor).toBe(1);
    expect(JSON.parse(store.get('cinelink.bests.v1')!)).toEqual({ actor: 1, film: 0 });
  });

  it('timeout swaps to a different actor from the previous film; dead end falls back to a new start actor with no penalty', async () => {
    startQueue.push(film(100, [cast(1, 0), cast(2, 1)]));
    startQueue.push(film(200, [cast(7, 0)]));
    useGame.getState().startRun('actor');
    await flush();
    let s = useGame.getState();
    expect(s.currentActor?.id).toBe(1);
    s.tick(15000); // timeout
    s = useGame.getState();
    expect(s.lives).toBe(2);
    expect(s.currentActor?.id).toBe(2); // swapped, not the same actor
    expect(s.feedback?.kind).toBe('timeout');
    // Second timeout: film 100 has nobody left -> dead end -> new start actor, chain count kept, lives still charged for the timeout
    s.tick(15000);
    await flush();
    s = useGame.getState();
    expect(s.lives).toBe(1);
    expect(s.phase).toBe('playing');
    expect(s.currentActor?.id).toBe(7);
    expect(s.chain.at(-1)?.label).toBe('New start');
  });

  it('TMDB unavailable pauses the run instead of charging a life; Retry resumes', async () => {
    startQueue.push(film(100, [cast(1, 0)]));
    film(2, [cast(1, 0)]);
    useGame.getState().startRun('actor');
    await flush();
    failNext = true;
    useGame.getState().submitAnswer(pick(2));
    await flush();
    let s = useGame.getState();
    expect(s.phase).toBe('error');
    expect(s.error).toBe("Can't reach the film database");
    expect(s.lives).toBe(3);
    expect(s.timer.paused).toBe(true);
    s.tick(99999);
    expect(useGame.getState().timer.remainingMs).toBe(15000); // held
    s.retry();
    await flush();
    s = useGame.getState();
    expect(s.score).toBe(1);
    expect(s.lives).toBe(3);
  });
});

describe('Film Chain run', () => {
  it('start film counts as used; one link spends automatically; several links open the chooser with the timer paused', async () => {
    const dir = crew(50, 'Director');
    startQueue.push(film(100, [cast(1, 0), cast(2, 1)], [dir]));
    film(2, [cast(1, 0)], []); // one link: actor 1
    film(3, [cast(1, 0), cast(2, 1)], [dir]); // three links

    useGame.getState().startRun('film');
    await flush();
    let s = useGame.getState();
    expect(s.usedFilmIds).toEqual([100]);
    expect(s.chain[0]).toMatchObject({ kind: 'film', id: 100 });

    s.submitAnswer(pick(100));
    await flush();
    s = useGame.getState();
    expect(s.feedback?.message).toBe('Already in your chain');
    expect(s.lives).toBe(2);

    s.submitAnswer(pick(2));
    await flush();
    s = useGame.getState();
    expect(s.score).toBe(1);
    expect(s.currentFilm?.id).toBe(2);
    expect(s.useCounts).toEqual({ 1: 1 });
    expect(s.chain.at(-1)?.label).toBe('Linked by Actor 1, actor (1 of 4)');
    expect(s.usedPeople.map((p) => p.id)).toEqual([1]);

    s.submitAnswer(pick(3)); // from film 2 (actor 1 only) to film 3 -> one link again (actor 1)
    await flush();
    s = useGame.getState();
    expect(s.useCounts).toEqual({ 1: 2 });

    // Now from film 3 back to... need a new film with several shared people
    film(4, [cast(1, 0), cast(2, 1)], [dir]);
    s.submitAnswer(pick(4));
    await flush();
    s = useGame.getState();
    expect(s.phase).toBe('chooser');
    expect(s.timer.paused).toBe(true);
    expect(s.linkChoices?.map((l) => l.personId)).toEqual([2, 50, 1]); // most uses remaining first; actor 1 (2 used) last
    s.tick(5000);
    expect(useGame.getState().timer.remainingMs).toBe(15000); // paused in chooser
    s.chooseLink(50);
    s = useGame.getState();
    expect(s.phase).toBe('playing');
    expect(s.score).toBe(3);
    expect(s.useCounts).toEqual({ 1: 2, 50: 1 });
    expect(s.chain.at(-1)?.label).toBe('Linked by Person 50, director (1 of 4)');
  });

  it('no shared people → wrong, same film stays; timeout keeps the same film', async () => {
    startQueue.push(film(100, [cast(1, 0)]));
    film(2, [cast(9, 0)]);
    useGame.getState().startRun('film');
    await flush();
    let s = useGame.getState();
    s.submitAnswer(pick(2));
    await flush();
    s = useGame.getState();
    expect(s.feedback?.message).toBe('No shared people');
    expect(s.feedback?.dispute).toMatchObject({ mode: 'film', filmIds: [100, 2] });
    expect(s.currentFilm?.id).toBe(100);
    s.tick(15000);
    s = useGame.getState();
    expect(s.lives).toBe(1);
    expect(s.currentFilm?.id).toBe(100);
  });
});
