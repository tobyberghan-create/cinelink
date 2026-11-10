/**
 * Anonymous play events (no personal data, no cookies). Phase 3 wires these to
 * Umami when VITE_UMAMI_WEBSITE_ID is set; until then they are no-ops.
 */
export type EventName = 'run_start' | 'answer_correct' | 'answer_wrong' | 'timeout' | 'dispute' | 'run_end';

export function track(_name: EventName, _data: Record<string, string | number> = {}): void {
  // wired in Phase 3
}
