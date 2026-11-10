import { useCallback, useEffect, useRef } from 'react';
import { Autocomplete } from '../components/Autocomplete';
import { CheckingSpinner, ErrorPanel, FeedbackOverlay } from '../components/Feedback';
import { LinkChooser } from '../components/LinkChooser';
import { LinkTray } from '../components/LinkTray';
import { ActorPrompt, FilmPrompt } from '../components/PromptCard';
import { TopBar } from '../components/TopBar';
import { useGame, type Feedback } from '../store';
import { sendDispute } from '../dispute';

const CANT_REACH = "Can't reach the film database";

/** Drives the turn timer from wall-clock time while the phase is "playing" and not paused. */
function useTimerLoop() {
  const tick = useGame((s) => s.tick);
  const running = useGame((s) => s.phase === 'playing' && !s.timer.paused);
  const last = useRef<number>(0);
  useEffect(() => {
    if (!running) return;
    last.current = performance.now();
    const id = setInterval(() => {
      const now = performance.now();
      tick(now - last.current);
      last.current = now;
    }, 100);
    return () => clearInterval(id);
  }, [running, tick]);
}

export function Game() {
  const s = useGame();
  useTimerLoop();

  const onUnavailable = useCallback(() => {
    // Search failed with a 5xx: pause the run rather than letting the clock run out with no suggestions.
    useGame.setState((st) =>
      st.phase === 'playing' ? { phase: 'error', error: CANT_REACH, timer: { ...st.timer, paused: true }, pending: { retry: () => useGame.setState({ phase: 'playing', error: null, pending: null, timer: { ...useGame.getState().timer, paused: false } }) } } : {},
    );
  }, []);

  const onDispute = useCallback((f: Feedback) => {
    if (f.dispute) sendDispute(f.dispute);
    useGame.setState({ feedback: f.dispute ? { ...f, dispute: undefined, message: 'Dispute logged — thanks' } : f });
  }, []);

  const inputDisabled = s.phase !== 'playing';

  return (
    <div className="mx-auto flex h-dvh max-w-md flex-col">
      <TopBar score={s.score} lives={s.lives} timer={s.timer} onHome={s.goHome} paused={s.phase !== 'playing'} />

      <div className="flex-1 overflow-y-auto">
        {s.phase === 'loading' && (
          <p className="px-4 py-10 text-center text-zinc-400" role="status">
            Picking a film…
          </p>
        )}
        {s.phase === 'error' && s.error && <ErrorPanel message={s.error} onRetry={s.retry} onHome={s.goHome} />}
        {s.phase !== 'loading' && s.phase !== 'error' && (
          <>
            {s.mode === 'actor' && s.currentActor && <ActorPrompt actor={s.currentActor} />}
            {s.mode === 'film' && s.currentFilm && <FilmPrompt film={s.currentFilm} />}
            {s.mode === 'film' && <LinkTray people={s.usedPeople} useCounts={s.useCounts} />}
          </>
        )}
        <CheckingSpinner active={s.phase === 'checking'} />
      </div>

      {/* Answer box sits above the on-screen keyboard; suggestions open upward. */}
      <div className="border-t border-zinc-800/80 bg-[#0b0b0f] px-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-3">
        <Autocomplete disabled={inputDisabled} onSubmit={s.submitAnswer} onUnavailable={onUnavailable} />
      </div>

      <FeedbackOverlay feedback={s.feedback} onDispute={onDispute} />
      {s.phase === 'chooser' && s.linkChoices && s.pendingAnswer && s.currentFilm && (
        <LinkChooser links={s.linkChoices} filmA={s.currentFilm} filmB={s.pendingAnswer} onChoose={s.chooseLink} />
      )}
    </div>
  );
}
