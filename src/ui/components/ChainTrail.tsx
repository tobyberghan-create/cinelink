import { posterUrl, profileUrl } from '../api';
import type { ChainStep } from '../store';

/** The whole chain as a scrollable trail of posters and headshots, each link labelled. */
export function ChainTrail({ chain }: { chain: ChainStep[] }) {
  if (chain.length === 0) return null;
  return (
    <ol className="space-y-1">
      {chain.map((s, i) => {
        const img = s.kind === 'person' ? profileUrl(s.imagePath) : posterUrl(s.imagePath);
        return (
          <li key={`${s.kind}-${s.id}-${i}`} className="flex gap-3">
            <div className="flex w-12 flex-col items-center">
              {img ? (
                <img src={img} alt="" className={`h-16 w-12 object-cover ${s.kind === 'person' ? 'rounded-full' : 'rounded'} bg-zinc-800`} />
              ) : (
                <div className={`h-16 w-12 bg-zinc-800 ${s.kind === 'person' ? 'rounded-full' : 'rounded'}`} aria-hidden />
              )}
              {i < chain.length - 1 && <div className="my-1 h-4 w-px bg-zinc-700" aria-hidden />}
            </div>
            <div className="min-w-0 py-1">
              {s.label && <p className="text-xs text-amber-300/90">{s.label}</p>}
              <p className="truncate font-medium">{s.title}</p>
              {s.subtitle && <p className="text-sm text-zinc-500">{s.subtitle}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
