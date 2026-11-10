import { config } from '../../config';
import type { UseCounts } from '../../engine';

/** Film Chain: everyone used as a link so far, with "x of 4"; exhausted people are greyed out. */
export function LinkTray({ people, useCounts }: { people: { id: number; name: string }[]; useCounts: UseCounts }) {
  const cap = config.filmChain.linkCap;
  if (people.length === 0) {
    return <p className="px-4 pt-4 text-xs text-zinc-600">Links you spend will appear here (max {cap} each).</p>;
  }
  return (
    <ul className="flex flex-wrap gap-2 px-4 pt-4" aria-label="Links used this run">
      {people.map((p) => {
        const n = useCounts[p.id] ?? 0;
        const out = n >= cap;
        return (
          <li
            key={p.id}
            className={`rounded-full border px-3 py-1 text-xs ${out ? 'border-zinc-800 text-zinc-600 line-through' : 'border-zinc-700 text-zinc-200'}`}
            aria-label={`${p.name}, ${n} of ${cap} used${out ? ', exhausted' : ''}`}
          >
            {p.name} <span className={`tabular-nums ${out ? '' : 'text-amber-300'}`}>{n} of {cap}</span>
          </li>
        );
      })}
    </ul>
  );
}
