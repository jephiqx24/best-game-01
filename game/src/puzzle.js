// Where Is My Coin — the puzzle core: solutions, regions, the solver, and the
// level generator. A level is an n x n board split into n coloured regions.
// The goal is to place n coins, one per row, one per column, one per region,
// with no two coins touching, not even diagonally.
//
// Everything here is deterministic given a seed: the generator only ever draws
// from the seeded RNG it is handed, so the same seed always builds the same level.

import { createRng, intBelow, pick, shuffle } from './random.js';

/** The four rules, as one check: can a coin sit at (row, col)? */
export function cellIsFree(n, regions, placed, row, col) {
  for (const coin of placed) {
    if (coin.row === row) return 'row';
    if (coin.col === col) return 'column';
    if (regions[coin.row * n + coin.col] === regions[row * n + col]) return 'region';
    if (Math.abs(coin.row - row) <= 1 && Math.abs(coin.col - col) <= 1) return 'touch';
  }
  return null;
}

/**
 * A random valid placement: one coin per row, no shared column, no diagonal
 * neighbours. Randomised backtracking; returns the columns per row, or null
 * when the draw dead-ends (the caller retries with a fresh draw).
 */
export function generateSolution(n, rng) {
  const cols = new Array(n).fill(-1);
  const used = new Array(n).fill(false);
  function place(row) {
    if (row === n) return true;
    const order = shuffle(rng, Array.from({ length: n }, (_, c) => c));
    for (const col of order) {
      if (used[col]) continue;
      if (row > 0 && Math.abs(cols[row - 1] - col) <= 1) continue;
      cols[row] = col;
      used[col] = true;
      if (place(row + 1)) return true;
      used[col] = false;
      cols[row] = -1;
    }
    return false;
  }
  return place(0) ? cols : null;
}

/**
 * Grow n connected regions, one seeded on each solution coin. Each region
 * spreads to neighbouring cells, preferring the smallest region first, so
 * sizes stay close; a region may pass its soft cap only when a cell has no
 * other neighbour to join. Connected by construction, every region holds
 * exactly one solution coin.
 */
export function generateRegions(n, solution, rng) {
  const regions = new Array(n * n).fill(-1);
  const sizes = new Array(n).fill(0);
  const softCap = n + 2;
  for (let row = 0; row < n; row += 1) {
    regions[row * n + solution[row]] = row;
    sizes[row] = 1;
  }
  const neighbours = (row, col) => {
    const out = [];
    if (row > 0) out.push([row - 1, col]);
    if (row + 1 < n) out.push([row + 1, col]);
    if (col > 0) out.push([row, col - 1]);
    if (col + 1 < n) out.push([row, col + 1]);
    return out;
  };
  let remaining = n * n - n;
  while (remaining > 0) {
    // A frontier cell is an empty cell next to a region.
    const frontier = [];
    for (let row = 0; row < n; row += 1) {
      for (let col = 0; col < n; col += 1) {
        if (regions[row * n + col] !== -1) continue;
        if (neighbours(row, col).some(([r, c]) => regions[r * n + c] !== -1)) frontier.push([row, col]);
      }
    }
    const [row, col] = pick(rng, frontier);
    const adjacent = [...new Set(neighbours(row, col).map(([r, c]) => regions[r * n + c]).filter((v) => v !== -1))];
    const underCap = adjacent.filter((id) => sizes[id] < softCap);
    const pool = underCap.length > 0 ? underCap : adjacent;
    let best = pool[0];
    for (const id of pool) if (sizes[id] < sizes[best]) best = id;
    // Break size ties at random so regions do not always grow in id order.
    const smallest = pool.filter((id) => sizes[id] === sizes[best]);
    const chosen = pick(rng, smallest);
    regions[row * n + col] = chosen;
    sizes[chosen] += 1;
    remaining -= 1;
  }
  return { regions, sizes };
}

/**
 * Count solutions of a region board, up to `limit` (early exit). Rows are
 * tried in order; only the previous row can touch diagonally, since one coin
 * sits per row. Returns { count, nodes, solutions }: nodes is the search-tree
 * size, a stand-in for how hard the puzzle is to solve, and solutions holds
 * the columns-per-row of every solution found (at most `limit`).
 */
export function countSolutions(n, regions, limit = 2) {
  let count = 0;
  let nodes = 0;
  const solutions = [];
  const usedCol = new Array(n).fill(false);
  const usedRegion = new Array(n).fill(false);
  const cols = new Array(n).fill(-1);
  function place(row) {
    nodes += 1;
    if (count >= limit) return;
    if (row === n) {
      count += 1;
      solutions.push(cols.slice());
      return;
    }
    for (let col = 0; col < n; col += 1) {
      if (usedCol[col]) continue;
      const region = regions[row * n + col];
      if (usedRegion[region]) continue;
      if (row > 0 && Math.abs(cols[row - 1] - col) <= 1) continue;
      usedCol[col] = true;
      usedRegion[region] = true;
      cols[row] = col;
      place(row + 1);
      cols[row] = -1;
      usedRegion[region] = false;
      usedCol[col] = false;
      if (count >= limit) return;
    }
  }
  place(0);
  return { count, nodes, solutions };
}

/** The four neighbours of a cell, inside the board. */
function neighboursOf(n, row, col) {
  const out = [];
  if (row > 0) out.push([row - 1, col]);
  if (row + 1 < n) out.push([row + 1, col]);
  if (col > 0) out.push([row, col - 1]);
  if (col + 1 < n) out.push([row, col + 1]);
  return out;
}

/** The connected components of one region's cells, as lists of [row, col]. */
export function regionComponents(n, regions, id) {
  const cells = regionCells(regions, n, id);
  const set = new Set(cells.map(([r, c]) => r * n + c));
  const seen = new Set();
  const comps = [];
  for (const [r, c] of cells) {
    const key = r * n + c;
    if (seen.has(key)) continue;
    const comp = [];
    const stack = [[r, c]];
    seen.add(key);
    while (stack.length > 0) {
      const [rr, cc] = stack.pop();
      comp.push([rr, cc]);
      for (const [ar, ac] of neighboursOf(n, rr, cc)) {
        const k = ar * n + ac;
        if (set.has(k) && !seen.has(k)) {
          seen.add(k);
          stack.push([ar, ac]);
        }
      }
    }
    comps.push(comp);
  }
  return comps;
}

/**
 * Phase one of level building: greedy repair. A random region board has
 * hundreds of solutions, so each step takes the solver's first alternative,
 * tries moving each of its cells (never a cell the planted solution uses)
 * into a neighbouring region, and keeps the move that leaves the fewest
 * solutions. When no move improves the count, a few random sideways moves
 * try to get past the wall. Returns { ok, count }.
 */
function repairToUnique(n, solution, regions, rng, maxSteps = 200) {
  const FULL = 1000000;
  let count = countSolutions(n, regions, FULL).count;
  let escapes = 0;
  for (let step = 0; step < maxSteps && count > 1; step += 1) {
    const { solutions } = countSolutions(n, regions, 2);
    const alt = solutions.find((s) => s.join() !== solution.join());
    if (!alt) break;
    let bestMove = null;
    let bestCount = count;
    for (let row = 0; row < n; row += 1) {
      if (alt[row] === solution[row]) continue;
      const col = alt[row];
      const cell = row * n + col;
      const from = regions[cell];
      const targets = new Set(neighboursOf(n, row, col).map(([r, c]) => regions[r * n + c]));
      targets.delete(from);
      for (const target of targets) {
        regions[cell] = target;
        const c = countSolutions(n, regions, FULL).count;
        if (c < bestCount) {
          bestCount = c;
          bestMove = { cell, from, to: target };
        }
        regions[cell] = from;
      }
    }
    if (bestMove !== null) {
      regions[bestMove.cell] = bestMove.to;
      count = bestCount;
      escapes = 0;
      continue;
    }
    if (escapes < 12) {
      const cands = [];
      for (let row = 0; row < n; row += 1) {
        if (alt[row] === solution[row]) continue;
        const col = alt[row];
        const cell = row * n + col;
        const from = regions[cell];
        for (const target of new Set(neighboursOf(n, row, col).map(([r, c]) => regions[r * n + c]))) {
          if (target !== from) cands.push({ cell, from, to: target });
        }
      }
      if (cands.length > 0) {
        const move = pick(rng, cands);
        regions[move.cell] = move.to;
        count = countSolutions(n, regions, FULL).count;
        escapes += 1;
        continue;
      }
    }
    return { ok: false, count };
  }
  return { ok: count === 1, count };
}

/**
 * Phase two: reconnect any region the repair split. Each stray component
 * (one without the planted coin) is moved whole into an adjacent region,
 * keeping the move only when the solver still finds exactly one solution.
 * Moving a whole component keeps every region connected by construction.
 */
function reconnectRegions(n, solution, regions) {
  for (let id = 0; id < n; id += 1) {
    const comps = regionComponents(n, regions, id);
    if (comps.length <= 1) continue;
    let planted = null;
    for (let row = 0; row < n; row += 1) {
      if (regions[row * n + solution[row]] === id) planted = [row, solution[row]];
    }
    const keep = comps.findIndex((comp) => comp.some(([r, c]) => r === planted[0] && c === planted[1]));
    for (let ci = 0; ci < comps.length; ci += 1) {
      if (ci === keep) continue;
      const comp = comps[ci];
      const targets = new Set();
      for (const [r, c] of comp) {
        for (const [ar, ac] of neighboursOf(n, r, c)) {
          const target = regions[ar * n + ac];
          if (target !== id) targets.add(target);
        }
      }
      let fixed = false;
      for (const target of targets) {
        for (const [r, c] of comp) regions[r * n + c] = target;
        if (countSolutions(n, regions, 2).count === 1) {
          fixed = true;
          break;
        }
        for (const [r, c] of comp) regions[r * n + c] = id;
      }
      if (!fixed) return false;
    }
  }
  return regionsAreConnected(n, regions) && countSolutions(n, regions, 2).count === 1;
}

/**
 * Build one level: draw a solution, grow regions around it, repair the board
 * to exactly one solution, then reconnect any region the repair split.
 * Returns null when the repair stalls, so the caller can draw a fresh board.
 * `nodes` is the solver's search-tree size for the finished board, a
 * stand-in for how hard the level is.
 */
export function generateLevel(n, seed, maxSteps = 200) {
  const rng = createRng(seed);
  const solution = generateSolution(n, rng);
  if (solution === null) return null;
  const { regions } = generateRegions(n, solution, rng);
  const repaired = repairToUnique(n, solution, regions, rng, maxSteps);
  if (!repaired.ok) return null;
  if (!reconnectRegions(n, solution, regions)) return null;
  const sizes = new Array(n).fill(0);
  for (const region of regions) sizes[region] += 1;
  const { nodes } = countSolutions(n, regions, 2);
  return { n, seed, regions, solution, sizes, nodes };
}

/** The region id of a cell, from a flat regions array. */
export function regionAt(regions, n, row, col) {
  return regions[row * n + col];
}

/** All cells of one region, as [row, col] pairs. */
export function regionCells(regions, n, id) {
  const cells = [];
  for (let row = 0; row < n; row += 1) {
    for (let col = 0; col < n; col += 1) {
      if (regions[row * n + col] === id) cells.push([row, col]);
    }
  }
  return cells;
}

/** Check a region board is connected per region (flood fill); used by the build tools. */
export function regionsAreConnected(n, regions) {
  for (let id = 0; id < n; id += 1) {
    const cells = regionCells(regions, n, id);
    if (cells.length === 0) return false;
    const seen = new Set([cells[0][0] * n + cells[0][1]]);
    const stack = [cells[0]];
    while (stack.length > 0) {
      const [row, col] = stack.pop();
      for (const [r, c] of [[row - 1, col], [row + 1, col], [row, col - 1], [row, col + 1]]) {
        if (r < 0 || r >= n || c < 0 || c >= n) continue;
        if (regions[r * n + c] !== id || seen.has(r * n + c)) continue;
        seen.add(r * n + c);
        stack.push([r, c]);
      }
    }
    if (seen.size !== cells.length) return false;
  }
  return true;
}

// Keep intBelow imported for the build tools that share this module.
export { intBelow };
