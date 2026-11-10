/**
 * CineLink — every tunable number lives here (Build Plan: "Shared systems",
 * "Difficulty over a run", "Who counts as a link", "Start pool").
 *
 * This file is imported by BOTH the browser (src/) and the proxy (api/), so
 * it must stay free of browser- or Node-only code.
 */

export interface TopBilledBand {
  /** Inclusive lower chain length for this band. */
  fromChain: number;
  /** Actor Chain: the next actor is drawn from the top N billed cast. */
  topN: number;
}

export const config = {
  /** Lives per run. No way to earn them back in v1. */
  lives: 3,

  timer: {
    /** Seconds per turn until the chain reaches `threshold`. */
    baseSeconds: 15,
    /** Seconds per turn once the chain is at or past `threshold`. */
    fastSeconds: 10,
    /** Chain length at which the turn timer drops to `fastSeconds`. */
    threshold: 15,
    /** Draining bar turns amber at this many seconds left. */
    amberAtSeconds: 5,
    /** ...and red at this many seconds left. */
    redAtSeconds: 3,
    /** Show a spinner if a network check takes longer than this. */
    spinnerAfterMs: 300,
  },

  actorChain: {
    /**
     * Next-actor pool widens as the chain grows (Build Plan table).
     * Bands are matched by the highest `fromChain` <= chain length.
     */
    topBilledBands: [
      { fromChain: 0, topN: 3 },
      { fromChain: 10, topN: 5 },
      { fromChain: 25, topN: 8 },
      { fromChain: 40, topN: 12 },
    ] as TopBilledBand[],
    /**
     * PROVISIONAL (spec says "weighted towards the more popular actors" but
     * gives no formula): weight = max(popularity, popularityFloor).
     */
    popularityFloor: 0.1,
    /** How long the character-name reveal stays on screen (ms). */
    revealMs: 1000,
  },

  filmChain: {
    /** Cast counts as a link only when order <= this on BOTH films (0..14). */
    castOrderCutoff: 14,
    /** A person can be spent as a link at most this many times per run. */
    linkCap: 4,
    /** Crew jobs that count as links, exactly as TMDB names them. */
    eligibleCrewJobs: [
      'Director',
      'Director of Photography',
      'Screenplay',
      'Writer',
      'Story',
      'Original Music Composer',
      'Editor',
    ] as readonly string[],
    /** Nudge on the prompt card: director + this many top-billed cast. */
    nudgeCastCount: 3,
  },

  startPool: {
    /** Roughly the N most-voted released films (discover, vote_count.desc). */
    size: 1000,
    /** TMDB discover returns 20 per page. */
    pageSize: 20,
    /** Refresh the pool this often (seconds). "refresh weekly". */
    cacheSeconds: 7 * 24 * 60 * 60,
  },

  search: {
    /** Autocomplete debounce (ms). */
    debounceMs: 250,
    /** Max suggestions shown. */
    maxResults: 6,
    /** Proxy edge-cache TTL for search responses (seconds). */
    cacheSeconds: 60 * 60,
  },

  credits: {
    /** Proxy edge-cache TTL for trimmed film credits (seconds). Film credits rarely change. */
    cacheSeconds: 7 * 24 * 60 * 60,
    /** Image configuration cache TTL (seconds): "cache for a day". */
    imageConfigCacheSeconds: 24 * 60 * 60,
  },

  images: {
    /** Loaded straight from TMDB's image CDN. */
    baseUrl: 'https://image.tmdb.org/t/p',
    posterSize: 'w342',
    profileSize: 'w185',
    thumbSize: 'w92',
  },

  /** Cast entries whose character contains any of these are ignored. */
  ignoredCharacterMarkers: ['(archive footage)', '(uncredited)'] as readonly string[],

  /** TMDB soft rate limit: back off on 429. */
  tmdb: {
    maxRetries: 2,
    backoffMs: 500,
  },
} as const;

export type Config = typeof config;
