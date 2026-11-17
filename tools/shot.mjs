// Screenshot one URL: node tools/shot.mjs <url> <out.png> [width] [height]
// Waits for window.__shotReady (set by the game's shot mode), then captures
// the viewport — 1280x720 by default, the gate's long-side cap — and prints
// the console errors it saw, if any.

import { openTab } from './cdp.mjs';

const [,, url, out, widthArg, heightArg] = process.argv;
if (!url || !out) {
  console.error('usage: node tools/shot.mjs <url> <out.png> [width] [height]');
  process.exit(2);
}
const width = Number(widthArg) || 1280;
const height = Number(heightArg) || 720;
const tab = await openTab(url, width, height);
try {
  try {
    await tab.waitFor('window.__shotReady === true', 5000);
  } catch {
    // A plain page sets no __shotReady; the game does. Capture anyway.
    await new Promise((r) => setTimeout(r, 1500));
  }
  // The title screen shows saved progress: clear it first so the cover is a
  // fresh player's view, then reload and wait for the staged scene again.
  if (url.includes('shot=start')) {
    await tab.evaluate('localStorage.clear()');
    await tab.send('Page.navigate', { url });
    await tab.waitFor('window.__shotReady === true', 15000);
  }
  await new Promise((r) => setTimeout(r, 300));
  await tab.screenshot(out);
  console.log('wrote', out);
  const errors = tab.consoleMessages.filter((m) => m.startsWith('error') || m.startsWith('exception'));
  if (errors.length > 0) console.log('console errors:\n' + errors.join('\n'));
  if (tab.failedRequests.length > 0) console.log('failed requests:\n' + tab.failedRequests.join('\n'));
} finally {
  tab.close();
}
process.exit(0);
