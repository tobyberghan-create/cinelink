import { track } from './analytics';
import type { DisputePayload } from './store';

/**
 * "Dispute" on a rejected answer logs the IDs involved for review. In v1 the
 * life is still lost; disputes guide whether refunds are needed later.
 * Logged as an anonymous analytics event and POSTed to the proxy (server log).
 */
export function sendDispute(d: DisputePayload): void {
  track('dispute', { mode: d.mode, reason: d.reason, films: d.filmIds.join(','), person: d.personId ?? '' });
  try {
    const body = JSON.stringify(d);
    if (navigator.sendBeacon) navigator.sendBeacon('/api/dispute', new Blob([body], { type: 'application/json' }));
    else fetch('/api/dispute', { method: 'POST', body, headers: { 'content-type': 'application/json' }, keepalive: true }).catch(() => {});
  } catch {
    /* best effort */
  }
}
