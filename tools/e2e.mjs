// End-to-end browser test for Where Is My Coin (gate 3 + part of gate 2):
// drives level 1 in a real browser via CDP clicks — violation cases (row,
// column, region, diagonal touch), the 3-mistake fail, retry, hint, undo,
// restart, a full win, and a keyboard undo — and asserts zero console
// errors and zero network (http/https) requests throughout.
// Run: node tools/e2e.mjs

import { openTab } from './cdp.mjs';

const GAME = 'file:///home/hatch/workspace/makefun/best-game-01/game/index.html?level=1';
let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
}

const tab = await openTab(GAME, 1440, 900);
try {
  await tab.waitFor('document.querySelectorAll(".cell").length === 64', 15000);
  await new Promise((r) => setTimeout(r, 500));

  const state = () => tab.evaluate(`({ screen: __game.screen, placed: __game.placed.size, mistakes: __game.mistakes, hints: __game.hintsLeft, sats: __game.sats, stars: __game.stars, n: __game.n })`);
  const cellCenter = (row, col) =>
    tab.evaluate(`(() => { const el = document.querySelector('.cell[data-row="${row}"][data-col="${col}"]'); const r = el.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()`);
  const clickCell = async (row, col) => {
    const [x, y] = await cellCenter(row, col);
    await tab.clickAt(x, y);
    await new Promise((r) => setTimeout(r, 150));
  };
  const clickButton = async (id) => {
    await tab.evaluate(`document.getElementById('${id}').click()`);
    await new Promise((r) => setTimeout(r, 150));
  };

  const sol = await tab.evaluate('__game.solution.slice()');
  const regions = await tab.evaluate('__game.regions.slice()');
  const n = 8;
  const regionAt = (r, c) => regions[r * n + c];

  // --- Initial state ---
  let s = await state();
  check('play screen with 64 cells', s.screen === 'play' && s.n === 8, JSON.stringify(s));

  // --- Violation 1: region. Find a solution coin whose region has another
  // cell in a different row and column, place the coin, then try that cell. ---
  let pr = -1, pc = -1, regionCell = null;
  outer: for (let r = 0; r < n; r++) {
    const region = regionAt(r, sol[r]);
    for (let r2 = 0; r2 < n; r2++) {
      for (let c2 = 0; c2 < n; c2++) {
        // Same region, different row and column: the region rule fires before
        // the touch rule, so diagonal adjacency does not matter here.
        if (regionAt(r2, c2) === region && r2 !== r && c2 !== sol[r]) {
          pr = r; pc = sol[r]; regionCell = [r2, c2];
          break outer;
        }
      }
    }
  }
  check('found a solution coin with a non-trivial same-region cell', pr >= 0, JSON.stringify([pr, pc, regionCell]));
  await clickCell(pr, pc);
  s = await state();
  check('solution coin placed (sats 100)', s.placed === 1 && s.sats === 100, JSON.stringify(s));
  await clickCell(regionCell[0], regionCell[1]);
  s = await state();
  check('region violation rejected (mistake 1, coin not placed)', s.mistakes === 1 && s.placed === 1, JSON.stringify(s));
  const rule = await tab.evaluate(`document.getElementById('rule-line').textContent`);
  check('rule line names the region rule', /colour/.test(rule), rule);

  // --- Violation 2: row ---
  const otherCol = (pc + 3) % n;
  await clickCell(pr, otherCol);
  s = await state();
  check('row violation rejected (mistake 2)', s.mistakes === 2 && s.placed === 1, JSON.stringify(s));

  // --- Violation 3: column -> fail screen ---
  await clickCell((pr + 2) % n, pc);
  s = await state();
  check('column violation rejected (mistake 3 -> fail screen)', s.mistakes === 3 && s.screen === 'fail', JSON.stringify(s));
  check('fail overlay visible', await tab.evaluate(`!document.getElementById('screen-fail').hidden`));

  // --- Retry resets the level ---
  await clickButton('btn-retry');
  s = await state();
  check('retry restarts level (0 mistakes, 0 coins)', s.screen === 'play' && s.mistakes === 0 && s.placed === 0, JSON.stringify(s));

  // --- Diagonal-touch violation (fresh board): a diagonal neighbour that is NOT in the same region ---
  await clickCell(0, sol[0]);
  const region0 = regionAt(0, sol[0]);
  const diag = [[1, 1], [1, -1]]
    .map(([dr, dc]) => [0 + dr, sol[0] + dc])
    .find(([r, c]) => r >= 0 && r < n && c >= 0 && c < n && regionAt(r, c) !== region0);
  check('found a diagonal neighbour outside the region', !!diag, JSON.stringify(diag));
  await clickCell(diag[0], diag[1]);
  const touchRule = await tab.evaluate(`document.getElementById('rule-line').textContent`);
  check('rule line names the touch rule', /^Not there — coins cannot touch/.test(touchRule), touchRule);
  s = await state();
  check('diagonal-touch violation rejected', s.mistakes === 1 && s.placed === 1, JSON.stringify(s));
  await clickButton('btn-restart');
  s = await state();
  check('restart clears board', s.placed === 0 && s.mistakes === 0, JSON.stringify(s));

  // --- Hint places a true coin; undo takes it back and refunds the hint ---
  await clickButton('btn-hint');
  s = await state();
  check('hint places one coin, hints 3 -> 2', s.placed === 1 && s.hints === 2, JSON.stringify(s));
  const hintCoin = await tab.evaluate(`[...__game.placed.values()].map(c => c.byHint).join()`);
  check('hint coin is marked byHint', hintCoin === 'true', hintCoin);
  await clickButton('btn-undo');
  s = await state();
  check('undo removes hint coin, hints back to 3', s.placed === 0 && s.hints === 3, JSON.stringify(s));

  // --- Keyboard undo: place a coin by click, press U ---
  await clickCell(0, sol[0]);
  await tab.pressKey('u');
  await new Promise((r) => setTimeout(r, 150));
  s = await state();
  check('keyboard U undoes a placement', s.placed === 0, JSON.stringify(s));

  // --- Full win: click every solution coin ---
  for (let row = 0; row < n; row++) await clickCell(row, sol[row]);
  s = await state();
  check('win screen after all 8 coins', s.screen === 'win' && s.placed === 8, JSON.stringify(s));
  check('3 stars (no mistakes, under par)', s.stars === 3, `stars=${s.stars}`);
  check('sats = 8x100 + win bonus (1300..2050)', s.sats >= 1300 && s.sats <= 2050, `sats=${s.sats}`);
  check('win overlay visible', await tab.evaluate(`!document.getElementById('screen-win').hidden`));
  check('progress saved (level 1 has 3 stars)', await tab.evaluate(`JSON.parse(localStorage.getItem('where-is-my-coin.progress.v1')).stars[0] === 3`));

  // --- Next Level goes to level 2 ---
  await clickButton('btn-next');
  s = await state();
  check('next level opens level 2', s.screen === 'play' && s.n === 8, JSON.stringify(s));

  // --- No console errors, no network requests ---
  const errors = tab.consoleMessages.filter((m) => m.startsWith('error') || m.startsWith('exception'));
  check('zero console errors', errors.length === 0, errors.join(' | '));
  const net = tab.requests.filter((u) => u.startsWith('http://') || u.startsWith('https://'));
  check('zero http/https requests', net.length === 0, net.join(' | '));
  check('no failed requests', tab.failedRequests.length === 0, tab.failedRequests.join(' | '));
  console.log('all requests:', [...new Set(tab.requests.map((u) => u.split('/').slice(0, 3).join('/')))].join(', '));
} finally {
  tab.close();
}
console.log(failures === 0 ? 'E2E: ALL PASS' : `E2E: ${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
