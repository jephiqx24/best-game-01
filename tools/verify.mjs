// Independent verification of the shipped game. Reads the levels as WRITTEN in
// game/src/levels.js (not the generator's memory) and re-proves each one:
// exactly one solution, connected regions, and a solution that satisfies all
// four rules. Also checks the file caps, the no-symlink rule, and that game/
// contains no http:// or https:// reference. Run: node tools/verify.mjs

import { readdirSync, readFileSync, statSync, lstatSync } from 'node:fs';
import { join, relative } from 'node:path';
import { LEVELS } from '../game/src/levels.js';
import { countSolutions, regionsAreConnected, cellIsFree } from '../game/src/puzzle.js';

let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
}

// --- 1. Every level: exactly one solution, connected, valid solution --------
let totalNodes = 0;
for (let i = 0; i < LEVELS.length; i += 1) {
  const level = LEVELS[i];
  const { n, regions, solution } = level;
  const { count, nodes } = countSolutions(n, regions, 2);
  totalNodes += nodes;
  let ok = count === 1;
  let why = `solutions=${count}, nodes=${nodes}`;
  if (!regionsAreConnected(n, regions)) { ok = false; why += ', regions disconnected'; }
  // The stored solution must satisfy all four rules.
  const placed = [];
  for (let row = 0; row < n; row += 1) {
    const col = solution[row];
    const rule = cellIsFree(n, regions, placed, row, col);
    if (rule) { ok = false; why += `, solution breaks ${rule} at (${row},${col})`; break; }
    placed.push({ row, col });
  }
  if (placed.length !== n) { ok = false; why += ', solution incomplete'; }
  // One solution coin per region.
  const seenRegions = new Set(placed.map(({ row, col }) => regions[row * n + col]));
  if (seenRegions.size !== n) { ok = false; why += ', solution regions not distinct'; }
  check(`level ${i + 1} (${n}x${n}): exactly one solution, connected, valid`, ok, why);
}
console.log(`solver nodes across all 30 levels: ${totalNodes}`);

// --- 2. File caps: game/ <=993 entries, <=48 MiB; index.html <=1 MiB --------
const GAME = new URL('../game/', import.meta.url).pathname;
let entries = 0;
let bytes = 0;
let symlinks = 0;
const stack = [GAME];
while (stack.length > 0) {
  const dir = stack.pop();
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const st = lstatSync(path);
    entries += 1;
    if (st.isSymbolicLink()) symlinks += 1;
    if (st.isDirectory()) stack.push(path);
    else bytes += st.size;
  }
}
check('game/ entries <= 993', entries <= 993, `${entries} entries`);
check('game/ bytes <= 48 MiB', bytes <= 48 * 1024 * 1024, `${bytes} bytes`);
const indexBytes = statSync(join(GAME, 'index.html')).size;
check('game/index.html <= 1 MiB', indexBytes <= 1024 * 1024, `${indexBytes} bytes`);
check('no symlinks under game/', symlinks === 0, `${symlinks} symlinks`);

// --- 3. No external references in game/ -------------------------------------
const textFiles = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const st = lstatSync(path);
    if (st.isDirectory()) walk(path);
    else if (/\.(html|js|css|json)$/.test(name)) textFiles.push(path);
  }
})(GAME);
const bad = [];
for (const path of textFiles) {
  const text = readFileSync(path, 'utf8');
  if (/https?:\/\//.test(text)) bad.push(relative(GAME, path));
}
check('no http:// or https:// references in game/', bad.length === 0, bad.join(', ') || `${textFiles.length} text files scanned`);

console.log(failures === 0 ? 'VERIFY: ALL PASS' : `VERIFY: ${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
