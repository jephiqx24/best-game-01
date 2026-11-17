// A 10x10 win in a real browser: open level 7, click its 10 solution coins,
// and confirm the win screen. Run: node tools/e2e-10x10.mjs

import { openTab } from './cdp.mjs';

const GAME = 'file:///home/hatch/workspace/makefun/best-game-01/game/index.html?level=7';
let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
}

const tab = await openTab(GAME, 1280, 720);
try {
  await tab.waitFor('document.querySelectorAll(".cell").length === 100', 15000);
  const sol = await tab.evaluate('__game.solution.slice()');
  for (let row = 0; row < 10; row++) {
    const [x, y] = await tab.evaluate(`(() => { const el = document.querySelector('.cell[data-row="${row}"][data-col="${sol[row]}"]'); const b = el.getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2]; })()`);
    await tab.clickAt(x, y);
    await new Promise((r) => setTimeout(r, 120));
  }
  const s = await tab.evaluate(`({ screen: __game.screen, placed: __game.placed.size, stars: __game.stars, sats: __game.sats })`);
  check('10x10 win screen after all 10 coins', s.screen === 'win' && s.placed === 10, JSON.stringify(s));
  check('stars awarded', s.stars >= 1, `stars=${s.stars}`);
  const errors = tab.consoleMessages.filter((m) => m.startsWith('error') || m.startsWith('exception'));
  check('zero console errors', errors.length === 0, errors.join(' | '));
} finally {
  tab.close();
}
console.log(failures === 0 ? '10x10 E2E: ALL PASS' : `10x10 E2E: ${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
