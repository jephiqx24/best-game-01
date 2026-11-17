// Where Is My Coin — the screenshot scenes behind ?shot=start|play|win|fail.
// Each one drives the real game (the same functions a player uses) to a fixed
// state, with a fixed timer, so the same seed always gives the same frame.

import { SCREEN_FAIL, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './state.js';
import { cellIsFree } from './puzzle.js';

/**
 * Set the game to the named scene and return the screen to draw over it.
 * `render` is the renderer, already built; the caller paints twice and sets
 * window.__shotReady once the frame is stable.
 */
export function stageShot(name, game, render) {
  if (name === 'play') {
    // Level 7 (10x10): five true coins placed, two cells crossed out, one
    // mistake spent, two hints left, timer fixed at 1:27.
    game.startLevel(6);
    render.buildBoard();
    for (let row = 0; row < 5; row += 1) game.placeCoin(row, game.solution[row]);
    // Cross out two cells that cannot hold a coin (never a solution cell).
    const markCol = (row) => (game.solution[row] + 4) % game.n;
    game.toggleMark(7, markCol(7));
    game.toggleMark(9, markCol(9));
    game.mistakes = 1;
    game.hintsLeft = 2;
    game.elapsed = 87;
    game.screen = SCREEN_PLAY;
    render.show();
    return;
  }
  if (name === 'win') {
    // Level 1 (8x8): every true coin placed, no mistakes, 1:35 — a 3-star win.
    game.startLevel(0);
    render.buildBoard();
    game.elapsed = 95;
    for (let row = 0; row < game.n; row += 1) game.placeCoin(row, game.solution[row]);
    game.screen = SCREEN_WIN;
    render.show();
    return;
  }
  if (name === 'fail') {
    // Level 1: three refused placements — same row, same column, then a
    // diagonal touch — and the vault locks.
    game.startLevel(0);
    render.buildBoard();
    const [r0, c0] = game.solutionCell(0);
    game.placeCoin(r0, c0);
    const otherCol = (c0 + 3) % game.n;
    game.placeCoin(r0, otherCol);
    const otherRow = (r0 + 2) % game.n;
    game.placeCoin(otherRow, c0);
    // A diagonal neighbour of the first coin, if it is still free to try.
    let placed = false;
    for (const [dr, dc] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const row = r0 + dr;
      const col = c0 + dc;
      if (row < 0 || row >= game.n || col < 0 || col >= game.n) continue;
      if (cellIsFree(game.n, game.regions, [...game.placed.values()], row, col) !== null) {
        game.placeCoin(row, col);
        placed = true;
        break;
      }
    }
    if (!placed) game.placeCoin(otherRow, otherCol);
    game.screen = SCREEN_FAIL;
    render.show();
    return;
  }
  // Any other name is the title screen.
  game.screen = SCREEN_TITLE;
  render.show();
}
