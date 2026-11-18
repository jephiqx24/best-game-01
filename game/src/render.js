// Where Is My Coin — the renderer: every screen is built once as DOM and
// shown or hidden; the board is a grid of buttons, one per cell, coloured by
// region with a thick outline where the region changes. Coins are fragments:
// each level hides one coin, split into as many pie slices as there are coins
// to find; a placed coin shows its slice, and the slice flies to the
// collection panel, where the coin is assembled piece by piece.

import { PALETTE, PAR_TIME } from './config.js';
import { applyCoinStyle, coinForLevel, sliceClip } from './coins.js';
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
      <div class="title-coin" id="title-coin" aria-hidden="true"></div>
      <h1>Where Is My Coin</h1>
      <p class="tagline">A coin hides in the vault, broken into pieces. Find them all — one per row,
        one per column, one per colour, never touching — and the coin is yours.</p>
      <div class="title-stats">
        <span id="title-sats">0 sats</span>
        <span id="title-cleared">0 / 30 cleared</span>
      </div>
      <div class="collection-progress">
        <span id="collection-progress-text">0 / 30 coins collected</span>
        <div class="collection-progress-bar"><div id="collection-progress-fill"></div></div>
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
      <p>Tap a cell to place a piece of the coin there. Find every piece and the coin is whole.</p>
      <div id="howto-rules"></div>
      <ul class="howto-notes">
        <li>Right-click (or the Mark × tool) crosses out a cell that cannot hold a coin.</li>
        <li>A coin that breaks a rule is refused and costs a mistake. Three mistakes lock the vault.</li>
        <li><b>H</b> reveals one true coin (3 per level). <b>U</b> undoes a move. <b>R</b> restarts the level.</li>
        <li>Beat the par time with no mistakes for 3 stars — and more sats.</li>
        <li>Every level hides a different coin — Bitcoin waits on level 30.</li>
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
      <div id="collection" class="collection">
        <div id="assembly" class="assembly" aria-label="Coin being assembled"></div>
        <div class="collection-info">
          <span id="collection-name" class="collection-name"></span>
          <span id="collection-count" class="collection-count"></span>
          <div class="collection-bar"><div id="collection-fill"></div></div>
        </div>
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
      <div id="win-coin" class="win-coin" aria-hidden="true"></div>
      <p id="win-coin-name" class="win-coin-name"></p>
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
  const assemblyEl = document.getElementById('assembly');
  let cells = [];
  /** The assembly slices: one pie-slice element per row, built per level. */
  let assemblySlices = [];
  /** Rows whose piece is mid-flight to the collection panel: their assembly
   *  slice stays hidden until the piece lands. */
  const pendingFly = new Set();

  /** A coin face: a metallic circle in the coin's brand colour, with its glyph. */
  function coinFaceEl(coin, extraClass = '') {
    const el = document.createElement('span');
    el.className = `coin-face${extraClass ? ` ${extraClass}` : ''}`;
    applyCoinStyle(el, coin);
    el.textContent = coin.glyph;
    return el;
  }

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

  /** Build the board grid for the current level, and the empty coin assembly
   *  (one pie slice per row) for the collection panel. */
  function buildBoard() {
    const n = game.n;
    boardEl.style.setProperty('--cols', n);
    boardEl.innerHTML = '';
    cells = [];
    // A fresh board cancels any piece still flying to the panel.
    pendingFly.clear();
    for (const fly of document.querySelectorAll('.fly-piece')) fly.remove();
    for (let row = 0; row < n; row += 1) {
      for (let col = 0; col < n; col += 1) {
        const cell = document.createElement('button');
        cell.className = `cell ${borderClasses(n, game.regions, row, col)}`;
        cell.dataset.row = row;
        cell.dataset.col = col;
        cell.style.background = `linear-gradient(180deg, rgba(255,255,255,0.07), rgba(0,0,0,0.10)), ${PALETTE.regions[regionAt(game.regions, n, row, col)]}`;
        cell.setAttribute('role', 'gridcell');
        cell.setAttribute('aria-label', `Row ${row + 1}, column ${col + 1}`);
        boardEl.appendChild(cell);
        cells.push(cell);
      }
    }
    // The assembly: the level's coin, split into n slices, each hidden until
    // its row's coin is found.
    assemblyEl.innerHTML = '';
    assemblySlices = [];
    for (let k = 0; k < n; k += 1) {
      const slice = coinFaceEl(game.coin, 'assembly-slice');
      slice.style.clipPath = sliceClip(k, n);
      assemblyEl.appendChild(slice);
      assemblySlices.push(slice);
    }
    paintBoard();
    updateCollection();
  }

  /** The collection panel: the coin name, how many pieces are found, and the
   *  assembly circle with the found slices filled in. */
  function updateCollection() {
    const n = game.n;
    if (!n || assemblySlices.length !== n) return;
    const coin = game.coin;
    document.getElementById('collection-name').textContent = `${coin.name} (${coin.ticker})`;
    const rowsFound = new Set([...game.placed.values()].map((c) => c.row));
    const found = rowsFound.size;
    document.getElementById('collection-count').textContent = `${found} / ${n} pieces`;
    document.getElementById('collection-fill').style.width = `${(found / n) * 100}%`;
    for (let k = 0; k < n; k += 1) {
      const slice = assemblySlices[k];
      const visible = rowsFound.has(k) && !pendingFly.has(k);
      slice.classList.toggle('found', visible);
    }
    assemblyEl.classList.toggle('complete', found === n);
  }

  /** Fly a found piece from its board cell to the collection panel. The
   *  assembly slice for that row stays hidden until the piece lands. */
  function flyPiece(row, col) {
    const n = game.n;
    const cell = cells[row * n + col];
    if (!cell || !assemblyEl) return;
    const from = cell.getBoundingClientRect();
    const to = assemblyEl.getBoundingClientRect();
    const fly = document.createElement('div');
    fly.className = 'fly-piece';
    const face = coinFaceEl(game.coin);
    face.style.clipPath = sliceClip(row, n);
    fly.appendChild(face);
    fly.style.left = `${from.x + from.width / 2}px`;
    fly.style.top = `${from.y + from.height / 2}px`;
    document.body.appendChild(fly);
    pendingFly.add(row);
    const dx = (to.x + to.width / 2) - (from.x + from.width / 2);
    const dy = (to.y + to.height / 2) - (from.y + from.height / 2);
    const anim = fly.animate([
      { transform: 'translate(-50%, -50%) scale(1) rotate(0deg)', opacity: 1 },
      { transform: `translate(calc(-50% + ${dx * 0.5}px), calc(-50% + ${dy * 0.5 - 40}px)) scale(0.8) rotate(140deg)`, opacity: 1, offset: 0.55 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.45) rotate(260deg)`, opacity: 0.85 },
    ], { duration: 600, easing: 'cubic-bezier(0.3, 0.7, 0.4, 1)' });
    const land = () => {
      fly.remove();
      pendingFly.delete(row);
      updateCollection();
    };
    anim.onfinish = land;
    // If the animation never finishes (tab hidden), land anyway.
    window.setTimeout(() => {
      if (fly.isConnected) land();
    }, 900);
  }

  /** Paint coins and marks from the state onto the cells. A placed coin shows
   *  its pie slice of the level's coin (slice = its row, so a finished board
   *  holds every slice exactly once). */
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
        const coinEl = coinFaceEl(game.coin, 'coin');
        coinEl.style.clipPath = sliceClip(row, n);
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
    updateCollection();
  }

  /** The level grid on the title screen, with stars and locks. Each level
   *  shows its own coin, so levels are told apart at a glance. */
  function renderTitle() {
    const cleared = game.progress.stars.filter((s) => s > 0).length;
    document.getElementById('title-sats').textContent = `${formatSats(game.totalSats())} sats`;
    document.getElementById('title-cleared').textContent = `${cleared} / 30 cleared`;
    document.getElementById('collection-progress-text').textContent = `${cleared} / 30 coins collected`;
    document.getElementById('collection-progress-fill').style.width = `${(cleared / 30) * 100}%`;
    // The big coin up top is the selected level's coin (the last one played,
    // or Dogecoin on a fresh visit) — Bitcoin only appears on level 30.
    const titleCoin = document.getElementById('title-coin');
    const showcase = coinForLevel(game.selectedLevel);
    titleCoin.textContent = showcase.glyph;
    applyCoinStyle(titleCoin, showcase);
    const grid = document.getElementById('level-grid');
    grid.innerHTML = '';
    for (const level of levelList(game)) {
      const coin = coinForLevel(level.index);
      const button = document.createElement('button');
      button.className = `level-btn${level.locked ? ' locked' : ''}${level.index === game.selectedLevel ? ' selected' : ''}`;
      button.disabled = level.locked;
      button.dataset.level = level.index;
      const coinEl = coinFaceEl(coin, 'level-coin');
      const coinHtml = coinEl.outerHTML;
      button.innerHTML = level.locked
        ? `${LOCK_SVG}<span class="level-num">${level.index + 1}</span>`
        : `${coinHtml}<span class="level-num">${level.index + 1}</span><span class="level-stars">${starsText(level.stars)}</span>`;
      button.setAttribute('aria-label', `Level ${level.index + 1}, ${level.n} by ${level.n}, ${coin.name}${level.locked ? ', locked' : level.stars ? `, ${level.stars} stars` : ''}`);
      grid.appendChild(button);
    }
  }

  /** Four mini rule diagrams for the How to Play screen. Each is a 4x4 grid
   * with its own region layout, showing two coins that break exactly the
   * named rule (and no other): same row, same column, same colour, touching.
   * The coins are the selected level's coin. */
  function renderHowto() {
    const coin = coinForLevel(game.selectedLevel);
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
            const miniCoin = coinFaceEl(coin, 'mini-coin');
            cell.appendChild(miniCoin);
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

  /** The win overlay: the assembled coin, stars, sats, time, par. */
  function renderWin() {
    const coin = game.coin;
    const winCoin = document.getElementById('win-coin');
    winCoin.innerHTML = '';
    winCoin.appendChild(coinFaceEl(coin, 'win-coin-face'));
    document.getElementById('win-coin-name').textContent =
      game.levelIndex === 29
        ? `The Bitcoin is yours — every coin in the vault is found.`
        : `${coin.name} (${coin.ticker}) — complete!`;
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
    updateCollection,
    flyPiece,
    renderTitle,
    flashViolation,
    previewCell,
    clearPreview,
    announce,
    boardEl,
    cells: () => cells,
  };
}
