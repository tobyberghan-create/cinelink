import { useState } from 'react';
import { config } from '../../config';
import type { GameMode } from '../../shared/types';
import { TmdbAttribution } from '../components/TmdbAttribution';
import { useGame } from '../store';

const HOW_TO: Record<GameMode, string[]> = {
  actor: [
    'We show you an actor. Name any film they appear in.',
    'We pick another actor from that film. Keep going.',
    `${config.timer.baseSeconds} s a turn (${config.timer.fastSeconds} s past chain ${config.timer.threshold}), ${config.lives} lives. No film twice.`,
  ],
  film: [
    'We show you a film. Name another film that shares an actor, director, writer, cinematographer, composer or editor.',
    'Your film becomes the new starting point. The game finds the link.',
    `Each person can link at most ${config.filmChain.linkCap} times. ${config.timer.baseSeconds} s a turn, ${config.lives} lives.`,
  ],
};

export function Home() {
  const { startRun, goAbout, bests } = useGame();
  const [sheet, setSheet] = useState<GameMode | null>(null);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-6 pb-[max(env(safe-area-inset-bottom),16px)] pt-[max(env(safe-area-inset-top),40px)]">
      <div className="flex-1">
        <h1 className="text-5xl font-black tracking-tight">
          Cine<span className="text-amber-400">Link</span>
        </h1>
        <p className="mt-2 text-zinc-400">Link films and the people in them. How long can you keep the chain going?</p>

        <div className="mt-10 space-y-4">
          <ModeButton title="Actor Chain" blurb="Actor → film → actor → film…" best={bests.actor} onPlay={() => startRun('actor')} onHow={() => setSheet('actor')} />
          <ModeButton title="Film Chain" blurb="Film → film, through anyone they share" best={bests.film} onPlay={() => startRun('film')} onHow={() => setSheet('film')} />
        </div>
      </div>

      <footer className="mt-10 flex flex-col items-center gap-3">
        <button onClick={goAbout} className="text-sm text-zinc-400 underline-offset-2 hover:underline">
          About / Credits
        </button>
        <TmdbAttribution compact />
      </footer>

      {sheet && (
        <div className="fixed inset-0 z-30 flex items-end bg-black/60" onClick={() => setSheet(null)} role="dialog" aria-modal aria-label="How to play">
          <div className="w-full rounded-t-3xl border-t border-zinc-800 bg-zinc-900 px-6 pb-[max(env(safe-area-inset-bottom),24px)] pt-5" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-zinc-700" aria-hidden />
            <h2 className="text-lg font-bold">How to play {sheet === 'actor' ? 'Actor Chain' : 'Film Chain'}</h2>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-zinc-300">
              {HOW_TO[sheet].map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ol>
            <button onClick={() => startRun(sheet)} className="mt-5 min-h-12 w-full rounded-xl bg-amber-400 font-semibold text-black">
              Play
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

function ModeButton({ title, blurb, best, onPlay, onHow }: { title: string; blurb: string; best: number; onPlay: () => void; onHow: () => void }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-2">
      <button onClick={onPlay} className="flex min-h-20 w-full items-center justify-between rounded-xl px-4 py-3 text-left hover:bg-zinc-800/60 active:bg-zinc-800">
        <div>
          <p className="text-2xl font-bold">{title}</p>
          <p className="text-sm text-zinc-400">{blurb}</p>
        </div>
        <span className="text-3xl text-amber-400" aria-hidden>
          ▶
        </span>
      </button>
      <div className="flex items-center justify-between px-4 pb-2 pt-1 text-sm text-zinc-500">
        <span>Personal best: <span className="font-semibold text-zinc-300">{best}</span></span>
        <button onClick={onHow} className="underline-offset-2 hover:underline">
          How to play
        </button>
      </div>
    </div>
  );
}
