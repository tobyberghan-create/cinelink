import { useEffect, useRef, useState } from 'react';
import { config } from '../../config';
import { resolveSubmission } from '../../engine';
import type { SearchResult } from '../../shared/types';
import { ApiError, searchFilms, thumbUrl } from '../api';

interface Props {
  disabled: boolean;
  onSubmit: (pick: SearchResult) => void;
  /** Called when the film database cannot be reached while searching. */
  onUnavailable: () => void;
  placeholder?: string;
}

/**
 * Film title autocomplete. Only a film picked from the list can be submitted;
 * Enter picks the highlighted (or top) suggestion. Suggestions open upward so
 * they stay visible above the on-screen keyboard.
 */
export function Autocomplete({ disabled, onSubmit, onUnavailable, placeholder = 'Type a film title…' }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [highlight, setHighlight] = useState<number | null>(null);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Debounced search
  useEffect(() => {
    const q = query.trim();
    abortRef.current?.abort();
    if (q.length === 0) {
      setResults([]);
      setHighlight(null);
      setSearching(false);
      return;
    }
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await searchFilms(q, ctrl.signal);
        if (ctrl.signal.aborted) return;
        setResults(r);
        setHighlight(null);
      } catch (e) {
        if ((e as Error).name === 'AbortError') return;
        if (e instanceof ApiError && e.unavailable) onUnavailable();
      } finally {
        if (!ctrl.signal.aborted) setSearching(false);
      }
    }, config.search.debounceMs);
    return () => clearTimeout(t);
  }, [query, onUnavailable]);

  // Keep focus on the box whenever a new turn starts.
  useEffect(() => {
    if (!disabled) inputRef.current?.focus();
  }, [disabled]);

  function submit(pick: SearchResult | null) {
    if (!pick || disabled) return;
    abortRef.current?.abort();
    setQuery('');
    setResults([]);
    setHighlight(null);
    onSubmit(pick);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      submit(resolveSubmission(results, highlight)); // Enter picks the top suggestion
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      if (results.length === 0) return;
      const dir = e.key === 'ArrowUp' ? -1 : 1; // list opens upward, so Up moves to the item above
      setHighlight((h) => (h === null ? (dir === 1 ? 0 : results.length - 1) : (h + dir + results.length) % results.length));
    } else if (e.key === 'Escape') {
      setResults([]);
    }
  }

  const listId = 'film-suggestions';
  return (
    <div className="relative">
      {results.length > 0 && !disabled && (
        <ul
          id={listId}
          role="listbox"
          className="absolute inset-x-0 bottom-full mb-2 max-h-[min(calc(100dvh-14.5rem),24rem)] overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-900/95 shadow-2xl shadow-black/60 backdrop-blur"
        >
          {results.map((r, i) => (
            <li
              key={r.id}
              role="option"
              aria-selected={highlight === i}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => submit(r)}
              className={`flex cursor-pointer items-center gap-3 px-3 py-2 ${highlight === i ? 'bg-zinc-800' : 'hover:bg-zinc-800/60'} ${i > 0 ? 'border-t border-zinc-800/70' : ''}`}
            >
              {thumbUrl(r.posterPath) ? (
                <img src={thumbUrl(r.posterPath)!} alt="" className="h-14 w-10 shrink-0 rounded bg-zinc-800 object-cover" />
              ) : (
                <div className="h-14 w-10 shrink-0 rounded bg-zinc-800" aria-hidden />
              )}
              <div className="min-w-0">
                <p className="truncate font-medium">{r.title}</p>
                <p className="text-sm text-zinc-400">{r.year ?? '—'}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          inputMode="search"
          enterKeyHint="go"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="words"
          spellCheck={false}
          role="combobox"
          aria-expanded={results.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          disabled={disabled}
          value={query}
          placeholder={placeholder}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          className="min-h-12 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 text-base text-zinc-50 placeholder:text-zinc-500 focus:border-amber-400 focus:outline-none disabled:opacity-50"
        />
        <button
          type="button"
          onClick={() => submit(resolveSubmission(results, highlight))}
          disabled={disabled || results.length === 0}
          className="min-h-12 shrink-0 rounded-xl bg-amber-400 px-4 font-semibold text-black disabled:opacity-30"
          aria-label="Submit the highlighted film"
        >
          Go
        </button>
      </div>
      {searching && <p className="sr-only">Searching…</p>}
    </div>
  );
}
