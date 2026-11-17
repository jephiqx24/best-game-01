// Where Is My Coin — every tuning number and colour in one place.
// The board is a logical grid; the renderer sizes it to the window, so no rule
// below depends on the screen size.

/** Board sizes: levels 1-5 are 8x8, levels 6-30 are 10x10. */
export const SMALL_SIZE = 8;
export const BIG_SIZE = 10;
export const LEVELS_TOTAL = 30;
export const SMALL_LEVELS = 5;

/** Mistakes end the level. */
export const MAX_MISTAKES = 3;
/** Hints per level. */
export const HINTS_PER_LEVEL = 3;

/** Par time (seconds) for a 3-star win, by board size. */
export const PAR_TIME = { 8: 150, 10: 300 };

/** Sats (score): a coin placed by hand, the win bonus, and the speed bonus per second under par. */
export const SCORE = { coin: 100, win: 500, speedPerSecond: 5 };

/** Stars: 3 when no mistake and at or under par; 2 when at most 1 mistake and at most 2x par; else 1. */
export const STARS = { threeMaxMistakes: 0, twoMaxMistakes: 1, twoMaxTimeMult: 2 };

/** Local storage keys (this browser only). */
export const STORE = {
  progress: 'where-is-my-coin.progress.v1',
  best: 'where-is-my-coin.best-sats.v1',
  muted: 'where-is-my-coin.muted.v1',
};

/** The vault palette: dark slate, warm paper text, Bitcoin gold, ten muted region tints. */
export const PALETTE = {
  page: '#10131a',
  panel: '#181d27',
  panelEdge: '#262d3b',
  text: '#f3ede0',
  muted: '#9aa3b2',
  gold: '#f7931a',
  goldDeep: '#c26f06',
  goldPale: '#ffcf87',
  danger: '#e5484d',
  dangerSoft: 'rgba(229, 72, 77, 0.22)',
  ok: '#46c98a',
  accent: '#7cc7ff',
  boardLine: '#0b0d12',
  /** Region tints, one per region id 0..9 (8x8 uses the first 8). */
  regions: [
    '#3a6ea5', // steel blue
    '#7a5ba6', // plum
    '#b0722f', // ochre
    '#4f8a6b', // sage
    '#a34d68', // rose
    '#5b7d8a', // slate teal
    '#9668a8', // lavender
    '#8a6d4b', // umber
    '#3f7d7a', // deep teal
    '#96555f', // brick
  ],
  regionText: 'rgba(255,255,255,0.55)',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
