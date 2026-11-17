// Where Is My Coin — the renderer: every screen is built once as DOM and
// shown or hidden; the board is a grid of buttons, one per cell, coloured by
// region with a thick outline where the region changes. Coins are gold
// circles with the ₿ glyph, marks are an ×, conflicts flash red.

import { PALETTE, PAR_TIME } from './config.js';
import { cellKey, levelList, SCREEN_FAIL, SCREEN_HOWTO, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './state.js';
import { regionAt } from './puzzle.js';

/** A small padlock, drawn as inline SVG, for locked levels. */
const LOCK_SVG = '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><rect x="5" y="10" width="14" height="10" rx="2" fill="currentColor"/><path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2.5"/></svg>';

/** Three stars as text, filled per the count. */
function starsText(count) {
  return '★★★'.slice(0, count) + '☆☆☆'.slice(0, 3 - count);
}

/** mm:ss for a seconds count. */
export function formatTime(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/** Thousands separators for a sats count. */
export function formatSats(value) {
  return value.toLocaleString('en-US');
}

export function createRenderer(app, game) {
  const status = document.getElementById('status');

  app.innerHTML = `
  <div id="screen-title" class="screen">
    <div class="title-wrap">
      <div class="title-coin" aria-hidden="true">₿</div>
      <h1>Where Is My Coin</h1>
      <p class="tagline">Ten coins are hiding in the vault. Find them all — one per row,
        one per column, one per colour, never touching.</p>
      <div class="title-stats">
        <span id="title-sats">0 sats</span>
        <span id="title-cleared">0 / 30 cleared</span>
      </div>
      <div class="title-buttons">
        <button id="btn-play" class="btn btn-big">Play</button>
        <button id="btn-howto" class="btn">How to Play</button>
      </div>
      <h2>Levels</h2>
      <div id="level-grid" class="level-grid"></div>
      <p class="keys">Keys: <b>H</b> hint · <b>U</b> undo · <b>R</b> restart · <b>M</b> sound · right-click a cell to mark it ×</p>
    </div>
  </div>
  <div id="screen-howto" class="screen overlay" hidden>
    <div class="panel">
      <h2>How to Play</h2>
      <p>Tap a cell to hide a coin there. Hide every coin and the vault opens.</p>
      <div id="howto-rules"></div>
      <ul class="howto-notes">
        <li>Right-click (or the Mark × tool) crosses out a cell that cannot hold a coin.</li>
        <li>A coin that breaks a rule is refused and costs a mistake. Three mistakes lock the vault.</li>
        <li><b>H</b> reveals one true coin (3 per level). <b>U</b> undoes a move. <b>R</b> restarts the level.</li>
        <li>Beat the par time with no mistakes for 3 stars — and more sats.</li>
      </ul>
      <button id="btn-close-howto" class="btn btn-big">Got it</button>
    </div>
  </div>
  <div id="screen-play" class="screen" hidden>
    <div class="play-wrap">
      <div class="hud">
        <div class="hud-item"><span class="hud-label">Level</span><span id="hud-level">1</span></div>
        <div class="hud-item"><span class="hud-label">Time</span><span id="hud-time">00:00</span></div>
        <div class="hud-item"><span class="hud-label">Sats</span><span id="hud-sats">0</span></div>
        <div class="hud-item"><span class="hud-label">Hints</span><span id="hud-hints">3</span></div>
        <div class="hud-item"><span class="hud-label">Mistakes</span><span id="hud-mistakes" class="mistakes"></span></div>
      </div>
      <div id="board" class="board" role="grid" aria-label="Coin board"></div>
      <p id="rule-line" class="rule-line">One coin per row, column and colour — and no two coins may touch, not even diagonally.</p>
      <div class="controls">
        <button id="btn-hint" class="btn">Hint <span id="hint-count">3</span></button>
        <button id="btn-undo" class="btn">Undo</button>
        <button id="btn-restart" class="btn">Restart</button>
        <button id="btn-mark" class="btn" aria-pressed="false">Mark ×</button>
        <button id="btn-menu" class="btn">Menu</button>
        <button id="btn-sound" class="btn">Sound On</button>
      </div>
    </div>
  </div>
  <div id="screen-win" class="screen overlay" hidden>
    <div class="panel">
      <div id="win-stars" class="win-stars">★★★</div>
      <h2>Vault Open!</h2>
      <p id="win-line">Every coin found.</p>
      <div class="win-stats">
        <div><span class="hud-label">Time</span><span id="win-time">00:00</span></div>
        <div><span class="hud-label">Sats earned</span><span id="win-sats">0</span></div>
        <div><span class="hud-label">Par</span><span id="win-par">00:00</span></div>
      </div>
      <div class="panel-buttons">
        <button id="btn-next" class="btn btn-big">Next Level →</button>
        <button id="btn-replay" class="btn">Replay</button>
        <button id="btn-win-menu" class="btn">Menu</button>
      </div>
    </div>
  </div>
  <div id="screen-fail" class="screen overlay" hidden>
    <div class="panel">
      <div class="fail-mark" aria-hidden="true">×</div>
      <h2>The Vault Locks</h2>
      <p id="fail-line">Three mistakes — the coins stay hidden this time.</p>
      <div class="panel-buttons">
        <button id="btn-retry" class="btn btn-big">Try Again</button>
        <button id="btn-fail-menu" class="btn">Menu</button>
      </div>
    </div>
  </div>`;

  const screens = {
    [SCREEN_TITLE]: document.getElementById('screen-title'),
    [SCREEN_HOWTO]: document.getElementById('screen-howto'),
    [SCREEN_PLAY]: document.getElementById('screen-play'),
    [SCREEN_WIN]: document.getElementById('screen-win'),
    [SCREEN_FAIL]: document.getElementById('screen-fail'),
  };
  const boardEl = document.getElementById('board');
  let cells = [];

  /** Announce a change for screen readers. */
  function announce(message) {
    status.textContent = message;
  }

  /** Border classes: a thick edge where the region changes or the board ends. */
  function borderClasses(n, regions, row, col) {
    const classes = [];
    const region = regionAt(regions, n, row, col);
    if (row === 0 || regionAt(regions, n, row - 1, col) !== region) classes.push('b-top');
    if (row === n - 1 || regionAt(regions, n, row + 1, col) !== region) classes.push('b-bottom');
    if (col === 0 || regionAt(regions, n, row, col - 1) !== region) classes.push('b-left');
    if (col === n - 1 || regionAt(regions, n, row, col + 1) !== region) classes.push('b-right');
    return classes.join(' ');
  }

  /** Build the board grid for the current level. */
  function buildBoard() {
    const n = game.n;
    boardEl.style.setProperty('--cols', n);
    boardEl.innerHTML = '';
    cells = [];
    for (let row = 0; row < n; row += 1) {
      for (let col = 0; col < n; col += 1) {
        const cell = document.createElement('button');
        cell.className = `cell ${borderClasses(n, game.regions, row, col)}`;
        cell.dataset.row = row;
        cell.dataset.col = col;
        cell.style.background = PALETTE.regions[regionAt(game.regions, n, row, col)];
        cell.setAttribute('role', 'gridcell');
        cell.setAttribute('aria-label', `Row ${row + 1}, column ${col + 1}`);
        boardEl.appendChild(cell);
        cells.push(cell);
      }
    }
    paintBoard();
  }

  /** Paint coins and marks from the state onto the cells. */
  function paintBoard() {
    const n = game.n;
    for (const cell of cells) {
      const row = Number(cell.dataset.row);
      const col = Number(cell.dataset.col);
      const key = cellKey(row, col);
      const coin = game.placed.get(key);
      cell.classList.remove('has-coin', 'has-mark', 'hint-coin');
      cell.innerHTML = '';
      if (coin) {
        cell.classList.add('has-coin');
        if (coin.byHint) cell.classList.add('hint-coin');
        const coinEl = document.createElement('span');
        coinEl.className = 'coin';
        coinEl.textContent = '₿';
        cell.appendChild(coinEl);
      } else if (game.marks.has(key)) {
        cell.classList.add('has-mark');
        const markEl = document.createElement('span');
        markEl.className = 'mark';
        markEl.textContent = '×';
        cell.appendChild(markEl);
      }
    }
  }

  /** The HUD numbers for the play screen. */
  function updateHud() {
    document.getElementById('hud-level').textContent = `${game.levelIndex + 1} · ${game.n}×${game.n}`;
    document.getElementById('hud-time').textContent = formatTime(game.elapsed);
    document.getElementById('hud-sats').textContent = formatSats(game.sats);
    document.getElementById('hud-hints').textContent = game.hintsLeft;
    document.getElementById('hint-count').textContent = game.hintsLeft;
    const mistakesEl = document.getElementById('hud-mistakes');
    mistakesEl.innerHTML = '';
    for (let i = 0; i < 3; i += 1) {
      const dot = document.createElement('span');
      dot.className = `mistake-dot${i < game.mistakes ? ' spent' : ''}`;
      mistakesEl.appendChild(dot);
    }
    document.getElementById('btn-mark').setAttribute('aria-pressed', game.markMode ? 'true' : 'false');
    document.getElementById('btn-mark').classList.toggle('active', game.markMode);
    document.getElementById('btn-sound').textContent = game.muted ? 'Sound Off' : 'Sound On';
  }

  /** The level grid on the title screen, with stars and locks. */
  function renderTitle() {
    const cleared = game.progress.stars.filter((s) => s > 0).length;
    document.getElementById('title-sats').textContent = `${formatSats(game.totalSats())} sats`;
    document.getElementById('title-cleared').textContent = `${cleared} / 30 cleared`;
    const grid = document.getElementById('level-grid');
    grid.innerHTML = '';
    for (const level of levelList(game)) {
      const button = document.createElement('button');
      button.className = `level-btn${level.locked ? ' locked' : ''}${level.index === game.selectedLevel ? ' selected' : ''}`;
      button.disabled = level.locked;
      button.dataset.level = level.index;
      button.innerHTML = level.locked
        ? `${LOCK_SVG}<span class="level-num">${level.index + 1}</span>`
        : `<span class="level-num">${level.index + 1}</span><span class="level-stars">${starsText(level.stars)}</span>`;
      button.setAttribute('aria-label', `Level ${level.index + 1}, ${level.n} by ${level.n}${level.locked ? ', locked' : level.stars ? `, ${level.stars} stars` : ''}`);
      grid.appendChild(button);
    }
  }

  /** Four mini rule diagrams for the How to Play screen. Each is a 4x4 grid
   * with its own region layout, showing two coins that break exactly the
   * named rule (and no other): same row, same column, same colour, touching. */
  function renderHowto() {
    const rules = [
      {
        title: 'One per row',
        regions: [[0, 1, 2, 3], [1, 2, 3, 0], [2, 3, 0, 1], [3, 0, 1, 2]],
        coins: [[0, 0], [0, 2]],
      },
      {
        title: 'One per column',
        regions: [[0, 1, 2, 3], [1, 2, 3, 0], [2, 3, 0, 1], [3, 0, 1, 2]],
        coins: [[0, 1], [2, 1]],
      },
      {
        title: 'One per colour',
        regions: [[0, 1, 2, 3], [1, 0, 3, 2], [2, 3, 0, 1], [3, 2, 1, 0]],
        coins: [[0, 0], [2, 2]],
      },
      {
        title: 'Never touch — not even diagonally',
        regions: [[0, 1, 2, 3], [1, 2, 3, 0], [2, 3, 0, 1], [3, 0, 1, 2]],
        coins: [[1, 1], [2, 2]],
      },
    ];
    const host = document.getElementById('howto-rules');
    host.innerHTML = '';
    for (const rule of rules) {
      const block = document.createElement('div');
      block.className = 'howto-rule';
      const grid = document.createElement('div');
      grid.className = 'mini-grid';
      for (let row = 0; row < 4; row += 1) {
        for (let col = 0; col < 4; col += 1) {
          const cell = document.createElement('span');
          cell.className = 'mini-cell';
          cell.style.background = PALETTE.regions[rule.regions[row][col]];
          if (rule.coins.some(([r, c]) => r === row && c === col)) {
            cell.classList.add('mini-bad');
            const coin = document.createElement('span');
            coin.className = 'mini-coin';
            coin.textContent = '₿';
            cell.appendChild(coin);
          }
          grid.appendChild(cell);
        }
      }
      const label = document.createElement('p');
      label.textContent = rule.title;
      block.appendChild(grid);
      block.appendChild(label);
      host.appendChild(block);
    }
  }

  /** The win overlay: stars, sats, time, par. */
  function renderWin() {
    document.getElementById('win-stars').textContent = starsText(game.stars);
    document.getElementById('win-line').textContent =
      game.stars === 3
        ? 'Every coin found — a perfect vault run.'
        : 'Every coin found. The vault is yours.';
    document.getElementById('win-time').textContent = formatTime(game.elapsed);
    document.getElementById('win-sats').textContent = `${formatSats(game.sats)} sats`;
    document.getElementById('win-par').textContent = formatTime(PAR_TIME[game.n]);
    document.getElementById('btn-next').style.display = game.levelIndex + 1 < 30 ? '' : 'none';
  }

  /** Show one screen (the win/fail overlays sit over the play screen). */
  function show() {
    const screen = game.screen;
    for (const [name, el] of Object.entries(screens)) {
      el.hidden = name !== screen && !(screen === SCREEN_WIN && name === SCREEN_PLAY) && !(screen === SCREEN_FAIL && name === SCREEN_PLAY);
    }
    if (screen === SCREEN_TITLE) renderTitle();
    if (screen === SCREEN_HOWTO) renderHowto();
    if (screen === SCREEN_PLAY || screen === SCREEN_WIN || screen === SCREEN_FAIL) {
      updateHud();
      paintBoard();
    }
    if (screen === SCREEN_WIN) renderWin();
  }

  /** Flash a refused placement red, with its conflicting coins. */
  let flashTimer = null;
  function flashViolation() {
    const violation = game.violation;
    if (!violation) return;
    // A fresh flash cancels the previous one's timer and clears its marks,
    // so an old timeout can never wipe a newer message or leave a cell red.
    if (flashTimer !== null) window.clearTimeout(flashTimer);
    for (const cell of cells) cell.classList.remove('flash', 'conflict');
    const n = game.n;
    const cell = cells[violation.row * n + violation.col];
    if (cell) cell.classList.add('flash');
    for (const coin of violation.conflicts) {
      const other = cells[coin.row * n + coin.col];
      if (other) other.classList.add('conflict');
    }
    const ruleLine = document.getElementById('rule-line');
    ruleLine.textContent = `Not there — ${violation.rule === 'row' ? 'that row already has a coin' : violation.rule === 'column' ? 'that column already has a coin' : violation.rule === 'region' ? 'that colour already has a coin' : 'coins cannot touch, not even diagonally'}.`;
    ruleLine.classList.add('rule-bad');
    flashTimer = window.setTimeout(() => {
      flashTimer = null;
      if (cell) cell.classList.remove('flash');
      for (const coin of violation.conflicts) {
        const other = cells[coin.row * n + coin.col];
        if (other) other.classList.remove('conflict');
      }
      ruleLine.textContent = 'One coin per row, column and colour — and no two coins may touch, not even diagonally.';
      ruleLine.classList.remove('rule-bad');
    }, 900);
  }

  /** Hover preview: tint the row, column and region; redden coins this cell would clash with. */
  function previewCell(row, col) {
    clearPreview();
    if (game.screen !== SCREEN_PLAY) return;
    const n = game.n;
    const region = regionAt(game.regions, n, row, col);
    for (let r = 0; r < n; r += 1) {
      for (let c = 0; c < n; c += 1) {
        const cell = cells[r * n + c];
        if (r === row || c === col) cell.classList.add('preview-line');
        if (regionAt(game.regions, n, r, c) === region) cell.classList.add('preview-region');
      }
    }
    for (const coin of game.placed.values()) {
      if (coin.row === row || coin.col === col || regionAt(game.regions, n, coin.row, coin.col) === region ||
          (Math.abs(coin.row - row) <= 1 && Math.abs(coin.col - col) <= 1)) {
        cells[coin.row * n + coin.col].classList.add('preview-clash');
      }
    }
  }

  function clearPreview() {
    for (const cell of cells) cell.classList.remove('preview-line', 'preview-region', 'preview-clash');
  }

  return {
    show,
    buildBoard,
    paintBoard,
    updateHud,
    renderTitle,
    flashViolation,
    previewCell,
    clearPreview,
    announce,
    boardEl,
    cells: () => cells,
  };
}
