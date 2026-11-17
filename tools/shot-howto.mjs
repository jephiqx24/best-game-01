import { openTab } from './cdp.mjs';
const tab = await openTab('file:///home/hatch/workspace/makefun/best-game-01/game/index.html', 1280, 720);
await tab.waitFor('document.getElementById("btn-howto")', 15000);
await tab.evaluate(`document.getElementById('btn-howto').click()`);
await new Promise((r) => setTimeout(r, 500));
await tab.screenshot('/tmp/shot-howto.png');
console.log('wrote /tmp/shot-howto.png');
tab.close();
process.exit(0);
