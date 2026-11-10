import { useState } from 'react';
import { ChainTrail } from '../components/ChainTrail';
import { TmdbAttribution } from '../components/TmdbAttribution';
import { buildShareText } from '../share';
import { useGame } from '../store';

const FEEDBACK_URL = import.meta.env.VITE_FEEDBACK_URL as string | undefined;

export function GameOver() {
  const { mode, score, bests, newBest, chain, startRun, goHome } = useGame();
  const [copied, setCopied] = useState<'idle' | 'done' | 'failed'>('idle');
  const modeName = mode === 'actor' ? 'Actor Chain' : 'Film Chain';

  async function share() {
    const text = buildShareText(mode, score, window.location.origin);
    try {
      if (navigator.share && /Mobi|Android|iPhone/i.test(navigator.userAgent)) {
        await navigator.share({ text });
      } else {
        await navigator.clipboard.writeText(text);
      }
      setCopied('done');
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      try {
        await navigator.clipboard.writeText(text);
        setCopied('done');
      } catch {
        setCopied('failed');
      }
    }
    setTimeout(() => setCopied('idle'), 2000);
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-[max(env(safe-area-inset-bottom),16px)] pt-[max(env(safe-area-inset-top),32px)]">
      <p className="text-xs uppercase tracking-widest text-zinc-500">{modeName} · Game over</p>
      <div className="mt-2 flex items-end gap-4">
        <p className="text-7xl font-black tabular-nums leading-none">{score}</p>
        <div className="pb-1">
          {newBest ? (
            <p className="rounded-full bg-amber-400 px-2.5 py-0.5 text-xs font-bold text-black">New best!</p>
          ) : (
            <p className="text-sm text-zinc-400">Best {bests[mode]}</p>
          )}
          <p className="mt-1 text-sm text-zinc-400">{score === 1 ? 'link' : 'links'} in the chain</p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <button onClick={() => startRun(mode)} className="min-h-12 rounded-xl bg-amber-400 font-semibold text-black">
          Play again
        </button>
        <button onClick={share} className="min-h-12 rounded-xl border border-zinc-600 font-semibold">
          {copied === 'done' ? 'Copied!' : copied === 'failed' ? "Couldn't copy" : 'Share'}
        </button>
        <button onClick={goHome} className="min-h-11 rounded-xl border border-zinc-800 text-zinc-300">
          Home
        </button>
        {FEEDBACK_URL ? (
          <a href={FEEDBACK_URL} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center justify-center rounded-xl border border-zinc-800 text-zinc-300">
            Give feedback
          </a>
        ) : (
          <span className="flex min-h-11 items-center justify-center rounded-xl border border-zinc-900 text-zinc-600" title="Set VITE_FEEDBACK_URL">
            Give feedback
          </span>
        )}
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-zinc-500">Your chain</h2>
        <ChainTrail chain={chain} />
      </section>

      <footer className="mt-10">
        <TmdbAttribution compact />
      </footer>
    </main>
  );
}
