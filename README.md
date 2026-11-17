# Where Is My Coin

[![make.fun bounty](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01)
[![rank](https://make.fun/badge/best-game-01/jephiqx24/best-game-01/rank.svg)](https://make.fun/bounty/best-game-01)
[![reward](https://make.fun/badge/best-game-01/jephiqx24/best-game-01/reward.svg)](https://make.fun/bounty/best-game-01)

A BTC-themed logic puzzle: ten coins are hiding in the vault. Find them all —
one per row, one per column, one per colour region, and no two coins touching,
not even diagonally. 30 levels, each with exactly one solution.

## How to play

- **Click / tap a cell** to hide a coin there; click a coin again to take it back.
- **Right-click a cell** (or the Mark × tool) to cross it out — a cell that
  cannot hold a coin.
- A coin that breaks a rule is refused and costs a **mistake**. Three mistakes
  lock the vault and the level starts over.
- **Hint** reveals one true coin (3 per level). **Undo** takes a move back.
  **Restart** clears the board.
- Clear the board to open the vault: stars for speed and accuracy, sats for
  every coin found and for beating the par time.
- Keyboard: **H** hint, **U** undo, **R** restart, **M** sound, **N** next level
  after a win. Levels unlock as you clear them; best stars and sats are saved
  in your browser.

## How to run

No build step, no network: plain static files.

```sh
node serve.ts          # serves game/ at http://localhost:8080
```

or open `game/index.html` through any static server. The game plays offline —
it makes zero network requests.

## Layout

- `game/` — the game itself: `index.html` plus `src/` (plain ES modules, no
  framework). `src/puzzle.js` holds the solver and the level generator,
  `src/levels.js` the 30 generated levels, `src/state.js` the game state,
  `src/render.js` the screens and the board, `src/input.js` the controls,
  `src/sound.js` WebAudio beeps, `src/shots.js` the screenshot scenes.
- `screenshots/` — four real renders in desktop Chrome: title, mid-play,
  win, fail. The first by name is the cover.
- `main.ts` — hands the entry in: copies `game/` and `screenshots/` to
  `/output` and writes `/output/dossier.json` with `buildDossier` from
  `vendor/makefun-game.ts` (vendored, unchanged). `MAKEFUN_OUTPUT_DIR`
  stands in for `/output` outside the grader.
- `tools/` — the verification kit: `verify.mjs` (re-proves every level and
  the file caps), `e2e.mjs` + `e2e-10x10.mjs` (scripted browser play),
  `generate-levels.mjs` (regenerates `game/src/levels.js`), `shot.mjs` /
  `cdp.mjs` (real-render screenshots over CDP).

See `BUILD_NOTES.md` for the design, the level generation, and the full
verification results.
