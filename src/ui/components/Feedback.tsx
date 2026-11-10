import { useEffect, useState } from 'react';
import { config } from '../../config';
import type { Feedback } from '../store';

/** Answer feedback overlay (~1 s): green flash + link revealed, or shake + red flash + reason. */
export function FeedbackOverlay({ feedback, onDispute }: { feedback: Feedback | null; onDispute?: (f: Feedback) => void }) {
  if (!feedback) return null;
  const good = feedback.kind === 'correct';
  return (
    <div
      className={`pointer-events-none fixed inset-0 z-20 flex items-start justify-center pt-28 ${good ? 'flash-green' : 'flash-red'}`}
      role="status"
      aria-live="assertive"
    >
      <div
        className={`pointer-events-auto mx-6 max-w-sm rounded-2xl border px-5 py-4 text-center shadow-2xl ${
          good ? 'border-emerald-500/50 bg-emerald-950/90' : 'animate-shake border-red-500/50 bg-red-950/90'
        }`}
      >
        {feedback.sub && <p className="truncate text-sm text-zinc-300">{feedback.sub}</p>}
        <p className="mt-0.5 text-lg font-semibold leading-snug">{feedback.message}</p>
        {feedback.kind === 'timeout' && <p className="text-sm text-zinc-300">Life lost</p>}
        {feedback.dispute && onDispute && (
          <button onClick={() => onDispute(feedback)} className="mt-2 rounded-full border border-zinc-500 px-3 py-1 text-xs text-zinc-200 hover:bg-zinc-800">
            Dispute
          </button>
        )}
      </div>
    </div>
  );
}

/** Spinner shown only after the network check has taken longer than spinnerAfterMs. */
export function CheckingSpinner({ active }: { active: boolean }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!active) {
      setShow(false);
      return;
    }
    const t = setTimeout(() => setShow(true), config.timer.spinnerAfterMs);
    return () => clearTimeout(t);
  }, [active]);
  if (!show) return null;
  return (
    <div className="flex items-center justify-center gap-2 py-2 text-sm text-zinc-400" role="status">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-600 border-t-amber-400" aria-hidden />
      Checking…
    </div>
  );
}

export function ErrorPanel({ message, onRetry, onHome }: { message: string; onRetry: () => void; onHome: () => void }) {
  return (
    <div className="mx-4 rounded-2xl border border-zinc-700 bg-zinc-900 p-5 text-center" role="alert">
      <p className="text-lg font-semibold">{message}</p>
      <p className="mt-1 text-sm text-zinc-400">Your run is paused. No life lost.</p>
      <div className="mt-4 flex justify-center gap-3">
        <button onClick={onRetry} className="rounded-xl bg-amber-400 px-5 py-2.5 font-semibold text-black">
          Retry
        </button>
        <button onClick={onHome} className="rounded-xl border border-zinc-600 px-5 py-2.5 text-zinc-200">
          Home
        </button>
      </div>
    </div>
  );
}
