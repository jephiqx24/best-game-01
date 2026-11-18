// Where Is My Coin — the game state: screens, levels, coins, marks, undo,
// hints, mistakes, timer, sats and saved progress. No DOM here; render.js
// paints this state, input.js drives it.

import { LEVELS } from './levels.js';
import { coinForLevel } from './coins.js';
import { cellIsFree } from './puzzle.js';
import { HINTS_PER_LEVEL, MAX_MISTAKES, PAR_TIME, SCORE, STARS, STORE } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_HOWTO = 'howto';
export const SCREEN_PLAY = 'play';
export const SCREEN_WIN = 'win';
export const SCREEN_FAIL = 'fail';

/** A cell key, "row,col". */
export function cellKey(row, col) {
  return `${row},${col}`;
}

/** Stars for a finished level: 3 with no mistake under par, 2 with at most one mistake under 2x par, else 1. */
export function starsFor(mistakes, seconds, n) {
  const par = PAR_TIME[n];
  if (mistakes <= STARS.threeMaxMistakes && seconds <= par) return 3;
  if (mistakes <= STARS.twoMaxMistakes && seconds <= par * STARS.twoMaxTimeMult) return 2;
  return 1;
}

/** Sats earned for a win: a flat bonus plus a speed bonus for beating par. */
export function winBonus(seconds, n) {
  return SCORE.win + Math.max(0, PAR_TIME[n] - Math.floor(seconds)) * SCORE.speedPerSecond;
}

function readProgress() {
  try {
    const raw = window.localStorage.getItem(STORE.progress);
    if (!raw) return { stars: [], sats: [] };
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.stars)) return { stars: [], sats: [] };
    return { stars: parsed.stars, sats: Array.isArray(parsed.sats) ? parsed.sats : [] };
  } catch {
    return { stars: [], sats: [] };
  }
}

function saveProgress(progress) {
  try {
    window.localStorage.setItem(STORE.progress, JSON.stringify(progress));
  } catch {
    // Storage can be off: progress then lasts this visit only.
  }
}

function readMuted() {
  try {
    return window.localStorage.getItem(STORE.muted) === '1';
  } catch {
    return false;
  }
}

/** Create the whole game state. */
export function createGame() {
  const progress = readProgress();
  const game = {
    screen: SCREEN_TITLE,
    progress,
    muted: readMuted(),
    levelIndex: 0,
    n: 0,
    regions: [],
    solution: [],
    /** The coin hidden on this level: one per level, BTC only on level 30. */
    coin: coinForLevel(0),
    /** Placed coins: key -> { row, col, byHint }. */
    placed: new Map(),
    /** Eliminated cells, marked with an X: a set of keys. */
    marks: new Set(),
    /** Undo stack of { kind, row, col, byHint }. */
    undoStack: [],
    mistakes: 0,
    hintsLeft: HINTS_PER_LEVEL,
    /** The last rejected placement, for the red flash: { row, col, rule, conflicts }. */
    violation: null,
    /** Seconds played on this level (the timer only runs on the play screen). */
    elapsed: 0,
    /** Sats earned on this level so far. */
    sats: 0,
    stars: 0,
    /** The win bonus sats for this level (0 until won). */
    winBonus: 0,
    /** Whether the mark tool is armed (touch players tap to mark instead of right-clicking). */
    markMode: false,
    /** The level the title screen has selected. */
    selectedLevel: 0,
  };

  /** Total sats: the sum of the best sats on each level (replays never farm). */
  game.totalSats = function totalSats() {
    return game.progress.sats.reduce((sum, value) => sum + (value || 0), 0);
  };

  /** The highest level the player may open (1-based count). */
  game.unlockedCount = function unlockedCount() {
    let count = 1;
    for (let i = 0; i < game.progress.stars.length; i += 1) {
      if (game.progress.stars[i] > 0) count = i + 2;
    }
    return Math.min(count, LEVELS.length);
  };

  /** Open a level fresh: clear the board, the timer, the mistakes and the hints. */
  game.startLevel = function startLevel(index) {
    const level = LEVELS[index];
    game.levelIndex = index;
    game.n = level.n;
    game.regions = level.regions;
    game.solution = level.solution;
    game.coin = coinForLevel(index);
    game.placed = new Map();
    game.marks = new Set();
    game.undoStack = [];
    game.mistakes = 0;
    game.hintsLeft = HINTS_PER_LEVEL;
    game.violation = null;
    game.elapsed = 0;
    game.sats = 0;
    game.stars = 0;
    game.markMode = false;
    game.screen = SCREEN_PLAY;
    return game;
  };

  /** The coin in the solution for a row, as [row, col]. */
  game.solutionCell = function solutionCell(row) {
    return [row, game.solution[row]];
  };

  /** Try to put a coin on a cell. A move that breaks a rule is rejected, flashes red and costs a mistake. */
  game.placeCoin = function placeCoin(row, col, byHint = false) {
    const key = cellKey(row, col);
    if (game.placed.has(key)) return { ok: false, rule: 'occupied' };
    const coins = [...game.placed.values()];
    const rule = cellIsFree(game.n, game.regions, coins, row, col);
    if (rule !== null) {
      game.mistakes += 1;
      const conflicts = coins.filter((coin) => {
        if (rule === 'row') return coin.row === row;
        if (rule === 'column') return coin.col === col;
        if (rule === 'region') return game.regions[coin.row * game.n + coin.col] === game.regions[row * game.n + col];
        return Math.abs(coin.row - row) <= 1 && Math.abs(coin.col - col) <= 1;
      });
      game.violation = { row, col, rule, conflicts };
      if (game.mistakes >= MAX_MISTAKES) game.screen = SCREEN_FAIL;
      return { ok: false, rule, conflicts };
    }
    game.placed.set(key, { row, col, byHint });
    game.marks.delete(key);
    game.undoStack.push({ kind: 'place', row, col, byHint });
    if (!byHint) game.sats += SCORE.coin;
    game.violation = null;
    if (game.placed.size === game.n) game.finishLevel();
    return { ok: true };
  };

  /** Take a coin off the board. */
  game.removeCoin = function removeCoin(row, col) {
    const key = cellKey(row, col);
    const coin = game.placed.get(key);
    if (!coin) return false;
    game.placed.delete(key);
    game.undoStack.push({ kind: 'remove', row, col, byHint: coin.byHint });
    if (!coin.byHint) game.sats = Math.max(0, game.sats - SCORE.coin);
    game.violation = null;
    return true;
  };

  /** Toggle an X mark on an empty cell. */
  game.toggleMark = function toggleMark(row, col) {
    const key = cellKey(row, col);
    if (game.placed.has(key)) return false;
    if (game.marks.has(key)) {
      game.marks.delete(key);
      game.undoStack.push({ kind: 'unmark', row, col });
    } else {
      game.marks.add(key);
      game.undoStack.push({ kind: 'mark', row, col });
    }
    return true;
  };

  /** Reveal one correct cell: place the solution coin in the first empty solution cell. */
  game.useHint = function useHint() {
    if (game.hintsLeft <= 0 || game.screen !== SCREEN_PLAY) return null;
    for (let row = 0; row < game.n; row += 1) {
      const col = game.solution[row];
      if (!game.placed.has(cellKey(row, col))) {
        game.hintsLeft -= 1;
        game.placeCoin(row, col, true);
        return { row, col };
      }
    }
    return null;
  };

  /** Undo the last board action (a mistake is never undone). */
  game.undo = function undo() {
    const action = game.undoStack.pop();
    if (!action) return null;
    const key = cellKey(action.row, action.col);
    if (action.kind === 'place') {
      game.placed.delete(key);
      if (!action.byHint) game.sats = Math.max(0, game.sats - SCORE.coin);
      if (action.byHint) game.hintsLeft += 1;
    } else if (action.kind === 'remove') {
      game.placed.set(key, { row: action.row, col: action.col, byHint: action.byHint });
      if (!action.byHint) game.sats += SCORE.coin;
    } else if (action.kind === 'mark') {
      game.marks.delete(key);
    } else if (action.kind === 'unmark') {
      game.marks.add(key);
    }
    game.violation = null;
    return action;
  };

  /** The level is won: all coins placed. Stars, bonus and progress are settled here. */
  game.finishLevel = function finishLevel() {
    game.stars = starsFor(game.mistakes, game.elapsed, game.n);
    const bonus = winBonus(game.elapsed, game.n);
    game.sats += bonus;
    game.winBonus = bonus;
    const index = game.levelIndex;
    if (game.stars > (game.progress.stars[index] || 0)) {
      game.progress.stars[index] = game.stars;
    }
    if (game.sats > (game.progress.sats[index] || 0)) {
      game.progress.sats[index] = game.sats;
    }
    saveProgress(game.progress);
    game.screen = SCREEN_WIN;
  };

  /** Back to the title screen. */
  game.toTitle = function toTitle() {
    game.screen = SCREEN_TITLE;
    game.selectedLevel = game.levelIndex;
  };

  /** Toggle the sound mute and remember it. */
  game.toggleMute = function toggleMute() {
    game.muted = !game.muted;
    try {
      window.localStorage.setItem(STORE.muted, game.muted ? '1' : '0');
    } catch {
      // Ignore storage failures.
    }
    return game.muted;
  };

  return game;
}

/** The level list the title screen shows, with stars and locks. */
export function levelList(game) {
  const unlocked = game.unlockedCount();
  return LEVELS.map((level, index) => ({
    index,
    n: level.n,
    stars: game.progress.stars[index] || 0,
    locked: index + 1 > unlocked,
  }));
}
