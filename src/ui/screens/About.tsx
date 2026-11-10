import { TmdbAttribution } from '../components/TmdbAttribution';
import { useGame } from '../store';

export function About() {
  const goHome = useGame((s) => s.goHome);
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-6 pb-[max(env(safe-area-inset-bottom),16px)] pt-[max(env(safe-area-inset-top),24px)]">
      <button onClick={goHome} className="-ml-2 self-start rounded px-2 py-1 text-sm text-zinc-400 hover:text-zinc-100">
        ← Home
      </button>
      <h1 className="mt-4 text-3xl font-black">About CineLink</h1>
      <p className="mt-3 text-zinc-300">
        A free, solo movie game: build the longest chain you can by linking films and the people in them. No account, nothing to install.
        Your personal best is saved on this device only.
      </p>

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-widest text-zinc-500">Credits</h2>
      <p className="mt-2 text-zinc-300">
        All film data — titles, posters, headshots, cast and crew — comes live from The Movie Database (TMDB), a community-built database.
        If an answer is marked wrong that you're sure is right, use the Dispute button so the data can be checked.
      </p>
      <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
        <TmdbAttribution />
      </div>

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-widest text-zinc-500">Privacy</h2>
      <p className="mt-2 text-zinc-300">No cookies, no accounts. Anonymous play events (which mode, how long a chain lasted) may be logged to improve the game.</p>
    </main>
  );
}
