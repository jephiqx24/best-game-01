// Where Is My Coin — input: mouse and touch on the board (click to place or
// remove a coin, right-click to mark), every button, and the keyboard.
// H hint, U undo, R restart, M sound, N next level after a win, Esc menu.

import { SCREEN_FAIL, SCREEN_HOWTO, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './state.js';

export function attachInput(game, renderer, sound) {
  const board = renderer.boardEl;

  /** The cell under a pointer event, or null. */
  function cellFromEvent(event) {
    const target = event.target.closest('.cell');
    if (!target) return null;
    return { row: Number(target.dataset.row), col: Number(target.dataset.col) };
  }

  /** A left click on a cell: coin on an empty cell, coin off a coin, mark off a mark. */
  function onCellClick(event) {
    if (game.screen !== SCREEN_PLAY) return;
    const cell = cellFromEvent(event);
    if (!cell) return;
    const key = `${cell.row},${cell.col}`;
    if (game.markMode) {
      if (game.toggleMark(cell.row, cell.col)) sound.click();
      renderer.paintBoard();
      return;
    }
    if (game.placed.has(key)) {
      if (game.removeCoin(cell.row, cell.col)) sound.click();
      renderer.paintBoard();
      renderer.updateHud();
      return;
    }
    if (game.marks.has(key)) {
      game.toggleMark(cell.row, cell.col);
      sound.click();
      renderer.paintBoard();
      return;
    }
    const result = game.placeCoin(cell.row, cell.col);
    if (result.ok) {
      sound.place();
      renderer.announce(`Coin placed. ${game.placed.size} of ${game.n}.`);
    } else {
      sound.error();
      renderer.flashViolation();
      renderer.announce(`Not there. Mistake ${game.mistakes} of 3.`);
    }
    renderer.paintBoard();
    renderer.updateHud();
    if (game.screen !== SCREEN_PLAY) renderer.show();
  }

  /** A right click marks a cell (and never opens the browser menu here). */
  function onCellRightClick(event) {
    if (game.screen !== SCREEN_PLAY) return;
    event.preventDefault();
    const cell = cellFromEvent(event);
    if (!cell) return;
    if (game.toggleMark(cell.row, cell.col)) sound.click();
    renderer.paintBoard();
  }

  function onCellHover(event) {
    const cell = cellFromEvent(event);
    if (!cell || game.screen !== SCREEN_PLAY) {
      renderer.clearPreview();
      return;
    }
    renderer.previewCell(cell.row, cell.col);
  }

  board.addEventListener('click', onCellClick);
  board.addEventListener('contextmenu', onCellRightClick);
  board.addEventListener('mouseover', onCellHover);
  board.addEventListener('mouseleave', () => renderer.clearPreview());

  /** Wire a button by id, playing a click first. */
  function on(id, fn) {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', () => {
      sound.click();
      fn();
    });
  }

  /** The first level not yet cleared (or the last one). */
  function firstUncleared() {
    for (let i = 0; i < 30; i += 1) {
      if (!(game.progress.stars[i] > 0)) return Math.min(i, game.unlockedCount() - 1);
    }
    return 29;
  }

  on('btn-play', () => {
    game.startLevel(firstUncleared());
    renderer.buildBoard();
    renderer.show();
    renderer.announce(`Level ${game.levelIndex + 1}. Find ${game.n} coins.`);
  });
  on('btn-howto', () => {
    game.screen = SCREEN_HOWTO;
    renderer.show();
  });
  on('btn-close-howto', () => {
    game.screen = SCREEN_TITLE;
    renderer.show();
  });
  on('btn-hint', () => {
    const hint = game.useHint();
    if (hint) {
      sound.hint();
      renderer.announce(`Hint: a coin hides in row ${hint.row + 1}, column ${hint.col + 1}.`);
    }
    renderer.paintBoard();
    renderer.updateHud();
    if (game.screen !== SCREEN_PLAY) renderer.show();
  });
  on('btn-undo', () => {
    if (game.undo()) sound.click();
    renderer.paintBoard();
    renderer.updateHud();
  });
  on('btn-restart', () => {
    game.startLevel(game.levelIndex);
    renderer.buildBoard();
    renderer.show();
    renderer.announce(`Level ${game.levelIndex + 1} restarted.`);
  });
  on('btn-mark', () => {
    game.markMode = !game.markMode;
    renderer.updateHud();
    renderer.announce(game.markMode ? 'Mark tool on: tap a cell to cross it out.' : 'Mark tool off.');
  });
  on('btn-menu', () => {
    game.toTitle();
    renderer.show();
  });
  on('btn-sound', () => {
    game.toggleMute();
    sound.setMuted(game.muted);
    renderer.updateHud();
  });
  on('btn-next', () => {
    if (game.levelIndex + 1 < 30) {
      game.startLevel(game.levelIndex + 1);
      renderer.buildBoard();
      renderer.show();
    }
  });
  on('btn-replay', () => {
    game.startLevel(game.levelIndex);
    renderer.buildBoard();
    renderer.show();
  });
  on('btn-win-menu', () => {
    game.toTitle();
    renderer.show();
  });
  on('btn-retry', () => {
    game.startLevel(game.levelIndex);
    renderer.buildBoard();
    renderer.show();
  });
  on('btn-fail-menu', () => {
    game.toTitle();
    renderer.show();
  });

  /** The level grid on the title screen (event delegation). */
  document.getElementById('level-grid').addEventListener('click', (event) => {
    const button = event.target.closest('.level-btn');
    if (!button || button.disabled) return;
    sound.click();
    game.startLevel(Number(button.dataset.level));
    renderer.buildBoard();
    renderer.show();
    renderer.announce(`Level ${game.levelIndex + 1}. Find ${game.n} coins.`);
  });

  document.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    if (game.screen === SCREEN_PLAY) {
      if (key === 'h') document.getElementById('btn-hint').click();
      else if (key === 'u') document.getElementById('btn-undo').click();
      else if (key === 'r') document.getElementById('btn-restart').click();
      else if (key === 'm') document.getElementById('btn-sound').click();
      else if (key === 'escape') document.getElementById('btn-menu').click();
    } else if (game.screen === SCREEN_WIN) {
      if (key === 'n') document.getElementById('btn-next').click();
      else if (key === 'r') document.getElementById('btn-replay').click();
      else if (key === 'escape') document.getElementById('btn-win-menu').click();
    } else if (game.screen === SCREEN_FAIL) {
      if (key === 'r') document.getElementById('btn-retry').click();
      else if (key === 'escape') document.getElementById('btn-fail-menu').click();
    } else if (game.screen === SCREEN_TITLE) {
      if (key === 'enter') document.getElementById('btn-play').click();
    } else if (game.screen === SCREEN_HOWTO) {
      if (key === 'escape' || key === 'enter') document.getElementById('btn-close-howto').click();
    }
  });
}
