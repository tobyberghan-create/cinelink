import { useEffect, useState } from 'react';
import { config } from '../../config';
import type { FilmCredits, Link } from '../../engine';
import { profileUrl } from '../api';

/**
 * Film Chain: several shared people matched. Timer is paused while open.
 * Lists each person, their role on each film and uses so far; pre-selects the
 * person with the most uses remaining (links arrive sorted that way).
 */
export function LinkChooser({ links, filmA, filmB, onChoose }: { links: Link[]; filmA: FilmCredits; filmB: FilmCredits; onChoose: (personId: number) => void }) {
  const [selected, setSelected] = useState(links[0]?.personId);
  useEffect(() => setSelected(links[0]?.personId), [links]);
  const cap = config.filmChain.linkCap;

  return (
    <div className="fixed inset-0 z-30 flex items-end bg-black/70" role="dialog" aria-modal aria-label="Choose the link">
      <div className="flex max-h-[85dvh] w-full flex-col rounded-t-3xl border-t border-zinc-800 bg-zinc-900">
        <div className="px-5 pt-4">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-zinc-700" aria-hidden />
          <h2 className="text-lg font-bold">Which link do you want to spend?</h2>
          <p className="text-sm text-zinc-400">
            {links.length} people connect <span className="text-zinc-200">{filmA.title}</span> and <span className="text-zinc-200">{filmB.title}</span>. Timer paused.
          </p>
        </div>
        <ul className="mt-3 flex-1 overflow-y-auto px-3" role="radiogroup">
          {links.map((l) => {
            const left = cap - l.usesSoFar;
            const on = selected === l.personId;
            return (
              <li key={l.personId}>
                <button
                  role="radio"
                  aria-checked={on}
                  onClick={() => setSelected(l.personId)}
                  className={`my-1 flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left ${on ? 'border-amber-400 bg-zinc-800' : 'border-zinc-800 hover:bg-zinc-800/60'}`}
                >
                  {profileUrl(l.profilePath) ? (
                    <img src={profileUrl(l.profilePath)!} alt="" className="h-12 w-12 rounded-full bg-zinc-800 object-cover" />
                  ) : (
                    <div className="h-12 w-12 rounded-full bg-zinc-800" aria-hidden />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{l.name}</p>
                    <p className="truncate text-xs text-zinc-400">
                      {l.roleA} · {l.roleB}
                    </p>
                  </div>
                  <span className={`shrink-0 text-sm tabular-nums ${left === 1 ? 'text-amber-300' : 'text-zinc-400'}`}>
                    {l.usesSoFar} of {cap} used
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="px-5 pb-[max(env(safe-area-inset-bottom),20px)] pt-3">
          <button onClick={() => selected !== undefined && onChoose(selected)} className="min-h-12 w-full rounded-xl bg-amber-400 font-semibold text-black">
            Use this link
          </button>
        </div>
      </div>
    </div>
  );
}
