// Where Is My Coin — boot and the one loop: the timer ticks once a second
// while the play screen is up, and the renderer paints what is there. The
// game moves between five screens: title, how to play, play, win and fail.
//
// ?shot=start|play|win|fail (with &seed=N) stages that scene instead of
// running the loop, paints it twice and sets window.__shotReady for a
// screenshot. ?level=N opens that level (1-based) straight away.

import { createGame } from './state.js';
import { createRenderer } from './render.js';
import { createSound } from './sound.js';
import { attachInput } from './input.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const levelParam = Number.parseInt(params.get('level') ?? '', 10);

const app = document.getElementById('app');
const game = createGame();
window.__game = game;
const sound = createSound(game.muted);
const renderer = createRenderer(app, game);
attachInput(game, renderer, sound);

function runShot(name) {
  stageShot(name, game, renderer);
  let painted = 0;
  function paint() {
    renderer.show();
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  if (Number.isInteger(levelParam) && levelParam >= 1 && levelParam <= 30) {
    game.startLevel(levelParam - 1);
    renderer.buildBoard();
  }
  renderer.show();
  renderer.announce('Where Is My Coin. Find the hidden coins — one per row, column and colour, never touching.');

  // The timer: one tick a second, only while playing.
  let lastTick = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    if (game.screen === 'play' && now - lastTick >= 1000) {
      game.elapsed += Math.floor((now - lastTick) / 1000);
      lastTick = now;
      renderer.updateHud();
    } else if (game.screen !== 'play') {
      lastTick = now;
    }
  }
  requestAnimationFrame(frame);

  // Leaving the tab stops the clock rather than letting it run unseen.
  document.addEventListener('visibilitychange', () => {
    lastTick = performance.now();
  });
}

if (shot) runShot(shot);
else runGame();
