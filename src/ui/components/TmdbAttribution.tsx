import { useState } from 'react';

export const TMDB_NOTICE = 'This product uses the TMDB API but is not endorsed or certified by TMDB.';

/**
 * Required TMDB attribution: an approved TMDB logo (less prominent than the
 * game's own logo) + the notice + a link to themoviedb.org.
 *
 * Drop the official logo from https://www.themoviedb.org/about/logos-attribution
 * into public/tmdb-logo.svg. Until it exists, a plain-text fallback is shown.
 */
export function TmdbAttribution({ compact = false }: { compact?: boolean }) {
  const [logoOk, setLogoOk] = useState(true);
  return (
    <div className={`flex flex-col items-center gap-2 text-center ${compact ? 'text-xs' : 'text-sm'} text-zinc-400`}>
      <a href="https://www.themoviedb.org/" target="_blank" rel="noopener noreferrer" aria-label="The Movie Database (TMDB)" className="inline-block">
        {logoOk ? (
          <img src="/tmdb-logo.svg" alt="TMDB" className={compact ? 'h-4' : 'h-6'} onError={() => setLogoOk(false)} />
        ) : (
          <span className="rounded bg-[#0d253f] px-2 py-0.5 text-xs font-bold tracking-wide text-[#90cea1]">TMDB</span>
        )}
      </a>
      <p className="max-w-xs">{TMDB_NOTICE}</p>
      {!compact && (
        <a href="https://www.themoviedb.org/" target="_blank" rel="noopener noreferrer" className="text-amber-300 underline-offset-2 hover:underline">
          themoviedb.org
        </a>
      )}
    </div>
  );
}
