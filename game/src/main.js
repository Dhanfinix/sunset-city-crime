// SUNSET BAY - boot, fixed-step loop, screen state machine and deterministic screenshot mode.
import { STEP } from './config.js';
import { createInput, ACTION_CONFIRM, ACTION_CONTINUE, ACTION_PAUSE } from './input.js';
import { createGame } from './game.js';
import { createRenderer, SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSED, SCREEN_BUSTED, SCREEN_WASTED } from './render.js';

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 4242;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const renderer = createRenderer(canvas);
const game = createGame(canvas, seed);

function announce(text) { if (status) status.textContent = text; }

// Publish live state for the capture helper and any dev tooling.
window.__sunsetBay = game;
game.shotMode = shot || null;

if (shot) {
  game.stageShot(shot);
  document.title = `SUNSET BAY - ${shot}`;
  announce(`Sunset Bay screenshot scene: ${shot}`);
  let painted = 0;
  function paint() {
    window.__sbMouse = { x: renderer.canvas.width / 2 + 120, y: renderer.canvas.height / 2 - 40 };
    renderer.draw(game, SCREEN_PLAY);
    painted += 1;
    if (painted < 3) requestAnimationFrame(paint);
    else window.__sunsetBayReady = true;
  }
  requestAnimationFrame(paint);
} else {
  document.title = 'SUNSET BAY';
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let accumulator = 0;
  let last = performance.now();

  canvas.addEventListener('mousedown', () => game.audio.resume());
  window.addEventListener('keydown', () => game.audio.resume(), { once: true });

  function actionsThisFrame() {
    return input.consume();
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, 0.25);
    last = now;
    const { actions } = actionsThisFrame();
    window.__sbMouse = { x: input.mouse.x, y: input.mouse.y };

    if (screen === SCREEN_TITLE) {
      if (actions.has(ACTION_CONFIRM)) {
        screen = SCREEN_PLAY; game.state.started = true;
        announce('New game. Find Rina downtown.');
      } else if (actions.has(ACTION_CONTINUE)) {
        if (game.load()) { game.state.started = true; screen = SCREEN_PLAY; announce('Continue. Welcome back.'); }
        else announce('No saved game found. Press ENTER for a new game.');
      }
    } else if (screen === SCREEN_PLAY) {
      if (actions.has(ACTION_PAUSE)) { screen = SCREEN_PAUSED; announce('Paused.'); }
      else {
        let guard = 0;
        while (accumulator >= STEP && guard < 5) {
          game.step(STEP, input, actions, screen);
          accumulator -= STEP; guard += 1;
          if (game.state.dead || game.state.busted) break;
        }
        if (game.state.dead) { screen = SCREEN_WASTED; announce('Wasted.'); }
        else if (game.state.busted) { screen = SCREEN_BUSTED; announce('Busted.'); }
      }
    } else if (screen === SCREEN_PAUSED) {
      if (actions.has(ACTION_PAUSE) || actions.has(ACTION_CONFIRM)) { screen = SCREEN_PLAY; announce('Playing.'); }
    } else {
      if (actions.has(ACTION_CONFIRM)) { game.respawn(); screen = SCREEN_PLAY; announce('Back on the street.'); }
    }
    if (screen !== SCREEN_PLAY) accumulator = 0;
    renderer.draw(game, screen);
  }
  announce('SUNSET BAY. Press ENTER for a new game, C to continue.');
  requestAnimationFrame(frame);
}
