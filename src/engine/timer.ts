import { config as defaultConfig, type Config } from '../config';

/** 15 s per turn until the chain reaches the threshold (15), then 10 s. */
export function turnTimerSeconds(chainLength: number, config: Config = defaultConfig): number {
  return chainLength >= config.timer.threshold ? config.timer.fastSeconds : config.timer.baseSeconds;
}

export type TimerTone = 'normal' | 'amber' | 'red';

/** Bar colour from seconds remaining: amber at 5 s, red at 3 s. */
export function timerTone(secondsLeft: number, config: Config = defaultConfig): TimerTone {
  if (secondsLeft <= config.timer.redAtSeconds) return 'red';
  if (secondsLeft <= config.timer.amberAtSeconds) return 'amber';
  return 'normal';
}

export interface TimerState {
  totalMs: number;
  remainingMs: number;
  /** Paused while checking an answer with the server or while the link chooser is open. */
  paused: boolean;
}

export function resetTimer(chainLength: number, config: Config = defaultConfig): TimerState {
  const totalMs = turnTimerSeconds(chainLength, config) * 1000;
  return { totalMs, remainingMs: totalMs, paused: false };
}

/** Advance the timer by `deltaMs`. Paused timers do not move. Never below zero. */
export function tickTimer(t: TimerState, deltaMs: number): TimerState {
  if (t.paused || t.remainingMs <= 0) return t;
  return { ...t, remainingMs: Math.max(0, t.remainingMs - deltaMs) };
}

export function isTimedOut(t: TimerState): boolean {
  return t.remainingMs <= 0;
}
