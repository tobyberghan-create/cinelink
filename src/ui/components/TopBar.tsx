import { config } from '../../config';
import { timerTone, type TimerState } from '../../engine';

export function Lives({ lives }: { lives: number }) {
  return (
    <div className="flex gap-1" aria-label={`${lives} of ${config.lives} lives`}>
      {Array.from({ length: config.lives }, (_, i) => (
        <span
          key={i}
          className={`text-lg leading-none transition-opacity ${i < lives ? 'text-red-400' : 'text-zinc-700 opacity-60'}`}
          aria-hidden
        >
          ♥
        </span>
      ))}
    </div>
  );
}

export function TimerBar({ timer, hidden }: { timer: TimerState; hidden?: boolean }) {
  const secondsLeft = timer.remainingMs / 1000;
  const tone = timerTone(secondsLeft);
  const pct = timer.totalMs > 0 ? (timer.remainingMs / timer.totalMs) * 100 : 0;
  const color = tone === 'red' ? 'bg-red-500' : tone === 'amber' ? 'bg-amber-400' : 'bg-emerald-400';
  return (
    <div
      className={`h-1.5 w-full overflow-hidden rounded-full bg-zinc-800 ${hidden ? 'opacity-30' : ''}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      aria-label={`${Math.ceil(secondsLeft)} seconds left${timer.paused ? ', paused' : ''}`}
    >
      <div className={`h-full ${color} ${timer.paused ? 'animate-pulse' : ''}`} style={{ width: `${pct}%`, transition: 'width 100ms linear' }} />
    </div>
  );
}

export function TopBar({ score, lives, timer, onHome, paused }: { score: number; lives: number; timer: TimerState; onHome: () => void; paused: boolean }) {
  return (
    <header className="sticky top-0 z-10 bg-[#0b0b0f]/95 px-4 pt-[max(env(safe-area-inset-top),8px)] pb-2 backdrop-blur">
      <div className="flex items-center justify-between py-1">
        <button onClick={onHome} className="-ml-2 rounded px-2 py-1 text-sm text-zinc-400 hover:text-zinc-100" aria-label="Back to home">
          ← Home
        </button>
        <div className="flex items-center gap-4">
          <span className="text-sm text-zinc-400">
            Chain <span className="text-xl font-bold tabular-nums text-zinc-50">{score}</span>
          </span>
          <Lives lives={lives} />
        </div>
      </div>
      <TimerBar timer={timer} hidden={paused} />
    </header>
  );
}
