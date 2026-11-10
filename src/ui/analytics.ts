/**
 * Anonymous play events — no personal data, no cookies.
 *
 * Backend: Umami (free, cookieless). Set VITE_UMAMI_SCRIPT_URL and
 * VITE_UMAMI_WEBSITE_ID (both public) and the tracker script is injected once
 * at startup; events go through `umami.track(name, data)`. With neither set,
 * events are only echoed to the console in dev builds.
 *
 * Events (Build Plan): run_start(mode), answer_correct(mode, chain, seconds),
 * answer_wrong(mode, reason), timeout(mode, chain), dispute(films, person),
 * run_end(mode, score).
 */
export type EventName = 'run_start' | 'answer_correct' | 'answer_wrong' | 'timeout' | 'dispute' | 'run_end';
export type EventData = Record<string, string | number>;

declare global {
  interface Window {
    umami?: { track: (name: string, data?: EventData) => void };
  }
}

const SCRIPT_URL = import.meta.env.VITE_UMAMI_SCRIPT_URL as string | undefined;
const WEBSITE_ID = import.meta.env.VITE_UMAMI_WEBSITE_ID as string | undefined;

const queue: { name: EventName; data: EventData }[] = [];
let loaded = false;

export function initAnalytics(): void {
  if (loaded || !SCRIPT_URL || !WEBSITE_ID || typeof document === 'undefined') return;
  loaded = true;
  const s = document.createElement('script');
  s.defer = true;
  s.src = SCRIPT_URL;
  s.setAttribute('data-website-id', WEBSITE_ID);
  s.setAttribute('data-auto-track', 'true');
  s.onload = () => {
    for (const e of queue.splice(0)) window.umami?.track(e.name, e.data);
  };
  document.head.appendChild(s);
}

export function track(name: EventName, data: EventData = {}): void {
  if (import.meta.env.DEV) console.debug('[event]', name, data);
  if (!SCRIPT_URL || !WEBSITE_ID) return;
  if (window.umami) window.umami.track(name, data);
  else queue.push({ name, data });
}
