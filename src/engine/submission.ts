import type { SearchResult } from '../shared/types';

/**
 * Only a film picked from the autocomplete list can be submitted, so typos
 * never cost a life. Enter with nothing highlighted picks the top suggestion.
 * Returns the film to submit, or null when nothing can be submitted.
 */
export function resolveSubmission(
  suggestions: readonly SearchResult[],
  highlightedIndex: number | null,
): SearchResult | null {
  if (suggestions.length === 0) return null;
  if (highlightedIndex !== null && highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
    return suggestions[highlightedIndex];
  }
  return suggestions[0];
}
