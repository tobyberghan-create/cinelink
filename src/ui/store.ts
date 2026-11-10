/**
 * Game state machine (Zustand). Rules come from engine/; this file only
 * sequences turns, talks to the proxy and drives the timer.
 */
import { create } from 'zustand';
import { config } from '../config';
import {
  REJECT_MESSAGES,
  characterFor,
  isTimedOut,
  isValidActorAnswer,
  isValidFilmAnswer,
  pickNextActor,
  resetTimer,
  roleLabel,
  spendLink,
  startActor,
  tickTimer,
  todayLocalIso,
  eligibleCast,
  type CastCredit,
  type FilmCredits,
  type Link,
  type RejectReason,
  type TimerState,
  type UseCounts,
} from '../engine';
import type { GameMode, SearchResult } from '../shared/types';
import { ApiError, fetchMovie, fetchStart } from './api';
import { loadBests, saveBests, type Bests } from './storage';
import { track } from './analytics';

export type Screen = 'home' | 'game' | 'gameover' | 'about';
export type Phase = 'loading' | 'playing' | 'checking' | 'reveal' | 'chooser' | 'error' | 'over';

export interface ChainStep {
  kind: 'person' | 'film';
  id: number;
  title: string;
  subtitle?: string;
  imagePath: string | null;
  /** The link label shown under this step, e.g. "as Neo" or "Linked by Roger Deakins, Cinematographer (1 of 4)". */
  label?: string;
}

export interface Feedback {
  kind: 'correct' | 'wrong' | 'timeout';
  message: string;
  sub?: string;
  /** For the Dispute button on rejected answers. */
  dispute?: DisputePayload;
}

export interface DisputePayload {
  mode: GameMode;
  reason: RejectReason;
  /** Actor Chain: the shown actor. Film Chain: unused. */
  personId?: number;
  /** Actor Chain: the answered film. Film Chain: the current film and the answered film. */
  filmIds: number[];
}

export interface Pending {
  /** What to retry after a network error. */
  retry: () => void;
}

interface GameState {
  screen: Screen;
  mode: GameMode;
  phase: Phase;
  chain: ChainStep[];
  score: number;
  lives: number;
  timer: TimerState;
  turnStartedAt: number;
  feedback: Feedback | null;
  error: string | null;
  pending: Pending | null;
  bests: Bests;
  newBest: boolean;

  // Actor Chain
  currentActor: CastCredit | null;
  currentFilm: FilmCredits | null;
  usedFilmIds: number[];
  usedActorIds: number[];

  // Film Chain
  useCounts: UseCounts;
  linkChoices: Link[] | null;
  pendingAnswer: FilmCredits | null;
  /** People spent so far, in first-use order, for the link tray. */
  usedPeople: { id: number; name: string; profilePath: string | null }[];

  // actions
  goHome: () => void;
  goAbout: () => void;
  startRun: (mode: GameMode) => void;
  submitAnswer: (pick: SearchResult) => void;
  chooseLink: (personId: number) => void;
  tick: (deltaMs: number) => void;
  retry: () => void;
  clearFeedback: () => void;
}

const CANT_REACH = "Can't reach the film database";

let revealTimeout: ReturnType<typeof setTimeout> | null = null;
let feedbackTimeout: ReturnType<typeof setTimeout> | null = null;
let runSeq = 0; // invalidates async work from a previous run

function clearTimers() {
  if (revealTimeout) clearTimeout(revealTimeout);
  if (feedbackTimeout) clearTimeout(feedbackTimeout);
  revealTimeout = feedbackTimeout = null;
}

function filmStep(f: FilmCredits, label?: string): ChainStep {
  return { kind: 'film', id: f.id, title: f.title, subtitle: f.year ? String(f.year) : undefined, imagePath: f.posterPath, label };
}
function personStep(c: CastCredit): ChainStep {
  return { kind: 'person', id: c.id, title: c.name, imagePath: c.profilePath };
}

export const useGame = create<GameState>((set, get) => {
  const bump = (patch: Partial<GameState>) => set(patch);

  /** Film database unreachable: pause the run (timer held) and offer Retry. No life is charged. */
  function fail(_e: unknown, retry: () => void) {
    bump({ phase: 'error', error: CANT_REACH, pending: { retry }, timer: { ...get().timer, paused: true } });
  }

  function newTurn(patch: Partial<GameState> = {}) {
    const s = get();
    bump({ ...patch, phase: 'playing', timer: resetTimer(s.score), turnStartedAt: Date.now(), error: null, pending: null });
  }

  function showFeedback(fb: Feedback, ms = 1200) {
    if (feedbackTimeout) clearTimeout(feedbackTimeout);
    bump({ feedback: fb });
    feedbackTimeout = setTimeout(() => {
      if (get().feedback === fb) bump({ feedback: null });
    }, ms);
  }

  function loseLife(): boolean {
    const lives = get().lives - 1;
    bump({ lives });
    if (lives <= 0) {
      endRun();
      return true;
    }
    return false;
  }

  function endRun() {
    clearTimers();
    const s = get();
    const prev = s.bests[s.mode];
    const newBest = s.score > prev;
    const bests = newBest ? { ...s.bests, [s.mode]: s.score } : s.bests;
    if (newBest) saveBests(bests);
    track('run_end', { mode: s.mode, score: s.score });
    bump({ phase: 'over', screen: 'gameover', bests, newBest, timer: { ...s.timer, paused: true }, feedback: null });
  }

  /** Fetch a fresh start film; `onFilm` applies it. Used for run start and Actor Chain dead ends. */
  function loadStart(seq: number, onFilm: (f: FilmCredits) => void, attempt = 0) {
    const mode = get().mode;
    const retry = () => loadStart(seq, onFilm, attempt);
    bump({ phase: 'loading', timer: { ...get().timer, paused: true }, error: null, pending: null });
    fetchStart(mode)
      .then(({ film }) => {
        if (seq !== runSeq) return;
        const s = get();
        const usable =
          mode === 'actor'
            ? eligibleCast(film).some((c) => !s.usedActorIds.includes(c.id))
            : !s.usedFilmIds.includes(film.id);
        if (!usable && attempt < 4) return loadStart(seq, onFilm, attempt + 1);
        onFilm(film);
      })
      .catch((e) => seq === runSeq && fail(e, retry));
  }

  // ---------------- Actor Chain ----------------

  function actorNextFrom(film: FilmCredits, seq: number) {
    const s = get();
    const next = pickNextActor(film, s.usedActorIds, s.score);
    if (next) {
      newTurn({
        currentActor: next,
        currentFilm: film,
        usedActorIds: [...s.usedActorIds, next.id],
        chain: [...s.chain, personStep(next)],
      });
      return;
    }
    // Dead end: whole cast used — new start actor, no penalty, chain count kept.
    loadStart(seq, (f) => {
      const st = get();
      const a = eligibleCast(f).find((c) => !st.usedActorIds.includes(c.id)) ?? startActor(f);
      if (!a) return actorNextFrom(film, seq);
      newTurn({
        currentActor: a,
        currentFilm: f,
        usedActorIds: [...st.usedActorIds, a.id],
        chain: [...st.chain, { ...personStep(a), label: 'New start' }],
      });
    });
  }

  function actorSubmit(pick: SearchResult, seq: number) {
    const s = get();
    const actor = s.currentActor!;
    const retry = () => actorSubmit(pick, seq);
    bump({ phase: 'checking', timer: { ...s.timer, paused: true } });
    fetchMovie(pick.id)
      .then((film) => {
        if (seq !== runSeq) return;
        const st = get();
        const verdict = isValidActorAnswer(actor.id, film, st.usedFilmIds, todayLocalIso());
        const secondsTaken = (Date.now() - st.turnStartedAt) / 1000;
        if (verdict.ok) {
          const character = characterFor(actor.id, film);
          const score = st.score + 1;
          track('answer_correct', { mode: 'actor', chain: score, seconds: Math.round(secondsTaken * 10) / 10 });
          bump({
            phase: 'reveal',
            score,
            usedFilmIds: [...st.usedFilmIds, film.id],
            chain: [...st.chain, filmStep(film, character ? `${actor.name} as ${character}` : actor.name)],
            feedback: { kind: 'correct', message: character ? `as ${character}` : 'Correct', sub: film.title },
          });
          revealTimeout = setTimeout(() => {
            if (seq !== runSeq) return;
            bump({ feedback: null });
            actorNextFrom(film, seq);
          }, config.actorChain.revealMs);
        } else {
          track('answer_wrong', { mode: 'actor', reason: verdict.reason });
          const dispute: DisputePayload = { mode: 'actor', reason: verdict.reason, personId: actor.id, filmIds: [film.id] };
          showFeedback({ kind: 'wrong', message: REJECT_MESSAGES[verdict.reason], sub: film.title, dispute }, 2500);
          if (!loseLife()) newTurn(); // same actor stays
        }
      })
      .catch((e) => {
        if (seq !== runSeq) return;
        if (e instanceof ApiError && e.status === 404) {
          // Unknown id: cannot happen from autocomplete; treat as wrong without charging? Spec gives no row -> charge like a wrong answer.
          showFeedback({ kind: 'wrong', message: 'Film not found' });
          if (!loseLife()) newTurn();
          return;
        }
        fail(e, retry);
      });
  }

  function actorTimeout(seq: number) {
    const s = get();
    track('timeout', { mode: 'actor', chain: s.score });
    showFeedback({ kind: 'timeout', message: "Time's up" });
    if (loseLife()) return;
    // Swap to a different actor from the previous film; dead-end rules apply.
    actorNextFrom(s.currentFilm!, seq);
  }

  // ---------------- Film Chain ----------------

  function filmCorrect(answer: FilmCredits, link: Link) {
    const st = get();
    const uses = (st.useCounts[link.personId] ?? 0) + 1;
    const role = roleLabel(link.roleB.split(' / ')[0]);
    const label = `Linked by ${link.name}, ${role.toLowerCase()} (${uses} of ${config.filmChain.linkCap})`;
    const score = st.score + 1;
    track('answer_correct', { mode: 'film', chain: score, seconds: Math.round(((Date.now() - st.turnStartedAt) / 1000) * 10) / 10 });
    const usedPeople = st.usedPeople.some((p) => p.id === link.personId)
      ? st.usedPeople
      : [...st.usedPeople, { id: link.personId, name: link.name, profilePath: link.profilePath }];
    bump({
      score,
      useCounts: spendLink(st.useCounts, link.personId),
      usedPeople,
      usedFilmIds: [...st.usedFilmIds, answer.id],
      chain: [...st.chain, filmStep(answer, label)],
      currentFilm: answer,
      linkChoices: null,
      pendingAnswer: null,
    });
    showFeedback({ kind: 'correct', message: label, sub: answer.title });
    newTurn();
  }

  function filmSubmit(pick: SearchResult, seq: number) {
    const s = get();
    const current = s.currentFilm!;
    const retry = () => filmSubmit(pick, seq);
    bump({ phase: 'checking', timer: { ...s.timer, paused: true } });
    fetchMovie(pick.id)
      .then((answer) => {
        if (seq !== runSeq) return;
        const st = get();
        const verdict = isValidFilmAnswer(current, answer, st.usedFilmIds, st.useCounts, todayLocalIso());
        if (verdict.ok) {
          const links = verdict.links!;
          if (links.length === 1) return filmCorrect(answer, links[0]); // one link: spend automatically
          // Several links: pause the timer and open the chooser.
          bump({ phase: 'chooser', linkChoices: links, pendingAnswer: answer, timer: { ...st.timer, paused: true } });
        } else {
          track('answer_wrong', { mode: 'film', reason: verdict.reason });
          const dispute: DisputePayload = { mode: 'film', reason: verdict.reason, filmIds: [current.id, answer.id] };
          showFeedback({ kind: 'wrong', message: REJECT_MESSAGES[verdict.reason], sub: answer.title, dispute }, 2500);
          if (!loseLife()) newTurn(); // same film stays
        }
      })
      .catch((e) => {
        if (seq !== runSeq) return;
        if (e instanceof ApiError && e.status === 404) {
          showFeedback({ kind: 'wrong', message: 'Film not found' });
          if (!loseLife()) newTurn();
          return;
        }
        fail(e, retry);
      });
  }

  function filmTimeout() {
    const s = get();
    track('timeout', { mode: 'film', chain: s.score });
    showFeedback({ kind: 'timeout', message: "Time's up" });
    if (loseLife()) return;
    newTurn(); // same film stays
  }

  return {
    screen: 'home',
    mode: 'actor',
    phase: 'loading',
    chain: [],
    score: 0,
    lives: config.lives,
    timer: { ...resetTimer(0), paused: true },
    turnStartedAt: 0,
    feedback: null,
    error: null,
    pending: null,
    bests: loadBests(),
    newBest: false,
    currentActor: null,
    currentFilm: null,
    usedFilmIds: [],
    usedActorIds: [],
    useCounts: {},
    linkChoices: null,
    pendingAnswer: null,
    usedPeople: [],

    goHome: () => {
      runSeq++;
      clearTimers();
      bump({ screen: 'home', phase: 'loading', feedback: null, error: null, pending: null });
    },
    goAbout: () => bump({ screen: 'about' }),

    startRun: (mode) => {
      runSeq++;
      const seq = runSeq;
      clearTimers();
      track('run_start', { mode });
      bump({
        screen: 'game',
        mode,
        phase: 'loading',
        chain: [],
        score: 0,
        lives: config.lives,
        timer: { ...resetTimer(0), paused: true },
        feedback: null,
        error: null,
        pending: null,
        newBest: false,
        currentActor: null,
        currentFilm: null,
        usedFilmIds: [],
        usedActorIds: [],
        useCounts: {},
        linkChoices: null,
        pendingAnswer: null,
        usedPeople: [],
      });
      loadStart(seq, (film) => {
        if (mode === 'actor') {
          const a = startActor(film)!;
          // PROVISIONAL: the start film is NOT marked used in Actor Chain (the player never sees it).
          newTurn({ currentFilm: film, currentActor: a, usedActorIds: [a.id], chain: [personStep(a)] });
        } else {
          // The start film counts as used.
          newTurn({ currentFilm: film, usedFilmIds: [film.id], chain: [filmStep(film)] });
        }
      });
    },

    submitAnswer: (pick) => {
      const s = get();
      if (s.phase !== 'playing') return;
      if (s.mode === 'actor') actorSubmit(pick, runSeq);
      else filmSubmit(pick, runSeq);
    },

    chooseLink: (personId) => {
      const s = get();
      if (s.phase !== 'chooser' || !s.linkChoices || !s.pendingAnswer) return;
      const link = s.linkChoices.find((l) => l.personId === personId);
      if (!link) return;
      filmCorrect(s.pendingAnswer, link);
    },

    tick: (deltaMs) => {
      const s = get();
      if (s.phase !== 'playing' || s.timer.paused) return;
      const timer = tickTimer(s.timer, deltaMs);
      bump({ timer });
      if (isTimedOut(timer)) {
        if (s.mode === 'actor') actorTimeout(runSeq);
        else filmTimeout();
      }
    },

    retry: () => {
      const p = get().pending;
      if (p) p.retry();
    },

    clearFeedback: () => bump({ feedback: null }),
  };
});
