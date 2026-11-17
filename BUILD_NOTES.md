# BUILD_NOTES — Where Is My Coin (best-game-01)

## What it is

A BTC-themed Queens logic puzzle, built from scratch in this session. Ten
coins hide in the vault; the player finds them all — exactly one coin per row,
one per column, one per colour region, and no two coins touching, not even
diagonally. 30 levels, each with exactly one solution. No framework, no
external images, fonts, or network requests; all art is code-drawn (CSS/SVG,
the ₿ glyph on a gold circle). Desktop-first, plays at 1440×900 and 1280×720.

## Files

- `game/index.html` — the shell (368 bytes): title, screens, HUD, board.
- `game/src/config.js` — palette (dark vault, gold #f7931a, 10 muted region
  tints), par times (8×8: 150 s, 10×10: 300 s), scoring (coin 100, win 500,
  speed 5 per second under par), 3 mistakes fail, 3 hints per level.
- `game/src/puzzle.js` (339 lines) — the solver (`countSolutions`, returns
  witnesses), the region generator, and the level generator (`generateLevel`).
- `game/src/levels.js` — the 30 generated levels (n, regions, solution).
- `game/src/state.js` (269 lines) — screens, place/remove/mark/hint/undo/
  restart/finish, stars, sats, progress in localStorage (best stars + best
  sats per level; total sats is the sum of bests, so replays never farm).
- `game/src/render.js` (366 lines) — screens, board grid with region-border
  classes, ₿ coins, × marks, HUD, win/fail overlays, hover preview, violation
  flash, How-to-Play mini diagrams.
- `game/src/input.js` — click, right-click mark, buttons, keyboard
  (H hint, U undo, R restart, M sound, N next level, Esc/Enter).
- `game/src/sound.js` — WebAudio beeps only (place/error/hint/win/fail/
  click), mute persisted.
- `game/src/shots.js` — deterministic staged scenes for screenshots
  (`?shot=start|play|win|fail`): play is level 7 with 5 coins, 2 marks,
  1 mistake, 2 hints, 87 s; win is level 1, all 8 coins, 95 s, 3 stars;
  fail is 3 refused placements.
- `game/src/main.js` — boot, 1 s timer tick, `?shot=` / `?level=` support,
  exposes `window.__game` for testing.
- `main.ts` — copies `game/` + `screenshots/` to `/output`, writes
  `/output/dossier.json` via `buildDossier` from `vendor/makefun-game.ts`
  (vendored, byte-identical to the kit, sha256
  `dc67187521b24025ff952f8c231485a6eb92d6d71d29edd2a08154ffb4376129`).
  Respects `MAKEFUN_OUTPUT_DIR`.
- `serve.ts` — static server for local play (port 8080).
- `tools/` — `generate-levels.mjs`, `verify.mjs`, `e2e.mjs`,
  `e2e-10x10.mjs`, `shot.mjs`, `cdp.mjs`, `shot-howto.mjs`.

## Level generation and the solver

The hard problem: random region boards almost never have a unique solution.
A probe of 200 random boards found 0 with a unique solution; full solution
counts were 8×8 median 467 (min 161, max 641) and 10×10 median 11,562
(min 5,715, max 17,844). The solver was verified correct against brute
force on 5×5 (solver 5 = brute 5).

Dead ends (do not retry): a plain fix-up loop (stuck after ~3 rounds);
snake/winding regions (median 412, no help); greedy repair with a capped
count (the cap saturates at cap+1, no gradient); connectivity-checked greedy
(8×8 2/10, 10×10 0/10); leaf-only moves (0/10).

Working method (`game/src/puzzle.js`, `generateLevel`):

1. **Greedy repair** — take the solver's first alternative solution, try
   moving each of its cells (never a planted-solution cell) into a
   neighbouring region, keep the move leaving the fewest solutions (full
   counts, cap 1,000,000); up to 12 random sideways moves when stuck.
2. **Connectivity repair** — reattach each stray region component whole to
   an adjacent region, keeping the move only if the solver still finds
   exactly 1 solution.

Measured: phase 1 success 7/10 (8×8), 4/10 (10×10); phase 2 succeeds 100%
when phase 1 succeeds. Disconnection is mild (1–4 regions, 1–15 stray cells).

`tools/generate-levels.mjs` draws a pool per board size, sorts by solver node
count, and assigns levels in increasing order — a monotonic difficulty ramp.
All 30 levels were generated in 86.4 s, each verified exactly one solution,
connected regions, one solution coin per region. Pools: 8×8 5 boards in
6 draws; 10×10 25 boards in 62 draws.

Solver node counts (a heuristic difficulty proxy — see Known gaps):

| L1–5 (8×8) | L6–10 (10×10) | L11–15 | L16–20 | L21–25 | L26–30 |
|---|---|---|---|---|---|
| 496, 619, 959, 1430, 2323 | 247, 462, 738, 1058, 1075 | 1147, 1749, 2479, 2480, 2687 | 3804, 7758, 8166, 10991, 11836 | 15329, 17383, 19132, 20255, 22027 | 26542, 29165, 42267, 79859, 90672 |

Total solver nodes across all 30 levels: 425,135.

## Verification gates

Run: `node tools/verify.mjs` (levels + caps), `node tools/e2e.mjs`,
`node tools/e2e-10x10.mjs`, `MAKEFUN_OUTPUT_DIR=/tmp/out1 node main.ts`
twice + `diff -r`, dossier recompute via `buildDossier`.

1. **Loads, zero console errors, zero network requests** — PASS. E2E runs
   report zero console errors, zero `http://`/`https://` requests, all
   requests `file://`. A grep of `game/` finds no `http://` or `https://`
   reference in any of its 12 text files.
2. **Puzzle correctness** — PASS. `tools/verify.mjs` re-proves all 30 levels
   from the written `levels.js` (not the generator's memory): exactly one
   solution each (count with limit 2 returns 1), connected regions, and the
   stored solution satisfies all four rules with one coin per region.
   Scripted playthroughs reach the win screen on 8×8 (level 1) and 10×10
   (level 7). Violation cases each tested in the browser: region ("Not
   there — that colour already has a coin."), row, column, diagonal touch
   ("Not there — coins cannot touch, not even diagonally.") — all refused,
   mistake counted, coin not placed.
3. **End-to-end browser play** — PASS. `tools/e2e.mjs`: **22/22**.
   64-cell board, solution coin placed (sats 100), region/row/column
   violations rejected (3rd mistake → fail screen), fail overlay, retry
   restarts the level, diagonal-touch violation rejected with the touch rule
   named, restart clears the board, hint places a true coin (3→2) and is
   marked byHint, undo refunds the hint (back to 3), keyboard U undoes a
   placement, full win (8 coins, 3 stars, sats 2040), win overlay, progress
   saved (localStorage stars[0] === 3), Next Level opens level 2, zero
   console errors, zero network requests. `tools/e2e-10x10.mjs`: **3/3** —
   level 7 win with all 10 coins (3 stars, 2995 sats), zero console errors.
   Sats math verified: level 1 win 1,575 = 8×100 + (500 + (150−95)×5).
4. **File caps** — PASS. `game/`: 13 entries, 71,699 bytes (≤993, ≤48 MiB);
   `game/index.html`: 368 bytes (≤1 MiB); no symlinks. `/output`:
   21 entries, 618,333 bytes (≤1000, ≤64 MiB).
5. **dossier_matches** — PASS. `buildDossier` recomputed from the output
   dir is byte-identical to the written `dossier.json` (344,683 bytes,
   `Buffer.equals` true). Note: comparing the recomputed Uint8Array's byte
   length to the file's string length looks like an 84-byte gap — it is
   not; the file holds multi-byte UTF-8 ( ₿, —, ★, × ), so byte length ≠
   character length. Compare bytes to bytes.
6. **Determinism** — PASS. `main.ts` run twice to two output dirs gives
   byte-identical output (`diff -r` clean).
7. **Screenshots are real renders, visually inspected** — PASS. Four PNGs
   at 1280×720, each ≤256 KiB, taken over CDP from the game's own code
   (see `tools/shot.mjs`, `tools/cdp.mjs`):
   - `1-start.png` (63,984 bytes) — title: gold ₿ coin, "Where Is My Coin",
     tagline, 0 sats, 0/30 cleared, Play / How to Play, level grid 1–30
     with only level 1 unlocked, keys line. Fresh-player view (localStorage
     cleared before the shot).
   - `2-play.png` (45,348 bytes) — level 7, 10×10, 5 coins, 2 × marks,
     HUD (Level 7·10×10, 01:27, 500 sats, hints 2, 1 mistake dot), rule
     line, and all controls (Hint 2, Undo, Restart, Mark ×, Menu, Sound On)
     visible in one 720 px viewport.
   - `3-win.png` (50,785 bytes) — "Vault Open!", 3 stars, 01:35,
     1,575 sats, par 02:30, Next Level / Replay / Menu, board dimmed behind.
   - `4-fail.png` (41,834 bytes) — "The Vault Locks", "Three mistakes —
     the coins stay hidden this time.", Try Again / Menu, 3 red mistake dots.

## Bugs found and fixed during verification

- **Violation-flash race** (real bug): `flashViolation` set a 900 ms timer to
  restore the rule line without cancelling the previous one, so a fast
  second mistake's message was wiped by the first timer, and the old
  `flash`/`conflict` cell classes could linger red. Fixed: one timer,
  cleared on each new flash, and all flash/conflict classes cleared first.
  The E2E then went 21/22 → 22/22.
- **How-to-Play diagrams** (real bug): the mini grids used one region layout
  for all four rules, so the "one per colour" pair sat in different colours
  and the "one per column" pair shared a colour. Fixed: each rule now has
  its own explicit 4×4 region layout, and each pair breaks exactly the
  named rule and no other.
- **Play screen overflow at 720 px**: the board was 620 px wide, so the
  controls fell below the fold at 1280×720. Fixed: board width capped at
  `min(100%, 62vh)`; the whole loop now fits in one viewport.
- **Title screenshot showed test progress** (2/30 cleared, 5,035 sats from
  the E2E runs' localStorage). Fixed: `tools/shot.mjs` clears localStorage
  and reloads before the start shot.

## Environment notes (reuse, do not re-derive)

- Chrome is `/opt/meta-chromium/chrome` v157.0.8103.81. It will not start
  headless without the Hatch WebGL policy: system file
  `/var/lib/hatch-browser/rootfs-base/usr/share/hatch/chromium/webgl-allowed-domains.txt`
  (27 bytes, `hatch-webgl-all-origins-v1` + trailing newline; a file without
  the trailing newline fails). Pass `--hatch-webgl-allowed-domains-file` +
  `--hatch-webgl-allowed-domains-sha256`.
- `--screenshot` CLI produces no file. Use CDP with a long-lived Chrome on
  port 9222 (`/tmp/launch-chrome.sh`, `--user-data-dir=/tmp/chrome-profile`,
  `--window-size=1440,900`).
- Local Network Access check blocks navigation to `http://localhost:8080` /
  `127.0.0.1` from about:blank tabs in this sandbox, even with the LNA
  features disabled. Browser tests therefore run over `file://` URLs with
  `--allow-file-access-from-files` (needed for ES modules over file://).
  The game itself is HTTP-servable and makes no network requests, so this is
  a sandbox-Chrome quirk, not a game defect.
- `pkill -f` with the pattern in the command string kills the exec shell
  itself (self-match) — use `pkill -x chrome` instead.
- ₿ (U+20BF) verified rendering in sandbox Chromium (system-ui and
  DejaVu Sans).

## Known gaps

- Region sizes are uneven (min 1, max up to 36–37 cells). Size-1 regions
  are forced coins — a legitimate mechanic, but a smoother size distribution
  would look better.
- Solver node count is a heuristic difficulty proxy, not a proven
  human-difficulty measure; the ramp is monotonic in nodes, not in tested
  solve times.
- The level generator was run once to produce `levels.js`; generator
  determinism (same seed → same level on a second run) was not re-verified.
  The shipped `levels.js` is what matters and is re-proved independently
  by `tools/verify.mjs`.
- Sound is beeps only; there is no music, no animation beyond the coin
  pop and the violation flash, and no mobile touch layout beyond tap.
- The `?shot=` scenes are staged states for screenshots only; they are
  not a cheat path (they run the real game code with fixed inputs).
