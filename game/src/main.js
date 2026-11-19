// Boot, the fixed-step loop, menus and the deterministic ?shot= scenes used for screenshots.

import { FIELD, STEP, BEST_KEY } from './config.js';
import { createInput, ACTIONS } from './input.js';
import { createGame, updateGame, setupShot, tickShot, saveGame, loadGame, hasSave } from './game.js';
import { render } from './render.js';

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 20261117;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
canvas.width = FIELD.width; canvas.height = FIELD.height;
const ctx = canvas.getContext('2d');

const game = createGame(seed);
window.__sunsetBay = game;

function announce(text) { if (status) status.textContent = text; }

// ---- Deterministic screenshot mode -------------------------------------------------------
if (shotName && ['cover', 'foot', 'drive', 'chase'].includes(shotName)) {
  setupShot(game, shotName);
  game.input = { mouse: { x: 940, y: 330 }, isDown: () => false, move: () => ({ x: 0, y: 0 }), takeActions: () => 0, takeClicked: () => false };
  let frames = 0;
  function shotFrame() {
    tickShot(game, STEP);
    render(ctx, game);
    frames += 1;
    if (frames >= 3) window.__sunsetBayReady = true;
    requestAnimationFrame(shotFrame);
  }
  announce('Sunset Bay screenshot scene ready.');
  requestAnimationFrame(shotFrame);
} else {
  runInteractive();
}

function runInteractive() {
  const input = createInput(canvas);
  game.input = input;
  let screen = 'title';
  let choice = 0;
  let endedAt = 0;
  let accumulator = 0;
  let last = performance.now();
  const menuItems = ['NEW GAME', 'CONTINUE', 'CONTROLS'];
  let controlsPage = false;

  function startNew() {
    const fresh = createGame(Math.floor(Math.random() * 4294967296));
    for (const k of Object.keys(game)) delete game[k];
    Object.assign(game, fresh);
    game.input = input;
    screen = 'play';
    game.audio.resume();
    announce('New game in Sunset Bay.');
  }
  function continueGame() {
    loadGame(game);
    game.input = input;
    screen = 'play';
    game.audio.resume();
    announce('Game continued.');
  }
  function toTitle() { screen = 'title'; choice = 0; controlsPage = false; }

  function menuAction() {
    if (controlsPage) { controlsPage = false; return; }
    if (choice === 0) startNew();
    else if (choice === 1) { if (hasSave()) continueGame(); }
    else controlsPage = true;
  }

  function handleUI() {
    const a = input.takeActions();
    if (screen === 'title' || screen === 'paused' || screen === 'busted' || screen === 'wasted') {
      if (a & ACTIONS.CONFIRM) {
        if (screen === 'title') menuAction();
        else if (screen === 'paused') { screen = 'play'; announce('Resumed.'); }
        else { if (choice === 0) { startNew(); } else toTitle(); }
      }
      if (screen === 'title' && !controlsPage) {
        if (input.isDown('KeyW') || input.isDown('ArrowUp')) { if (!window.__upHeld) { choice = (choice + 2) % 3; window.__upHeld = true; } }
        else window.__upHeld = false;
        if (input.isDown('KeyS') || input.isDown('ArrowDown')) { if (!window.__downHeld) { choice = (choice + 1) % 3; window.__downHeld = true; } }
        else window.__downHeld = false;
      }
      if (screen !== 'paused' && (screen === 'busted' || screen === 'wasted')) {
        if (input.isDown('KeyA') || input.isDown('ArrowLeft')) choice = 0;
        if (input.isDown('KeyD') || input.isDown('ArrowRight')) choice = 1;
      }
      if (input.takeClicked()) {
        if (screen === 'title') menuAction();
        else if (screen === 'paused') screen = 'play';
        else if (choice === 0) startNew(); else toTitle();
      }
    }
    if (a & ACTIONS.PAUSE) {
      if (screen === 'play') { screen = 'paused'; announce('Paused.'); }
      else if (screen === 'paused') { screen = 'play'; announce('Resumed.'); }
    }
  }

  function drawTitle() {
    render(ctx, game);
    ctx.fillStyle = 'rgba(6,10,22,0.72)'; ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff3d6e'; ctx.font = '900 82px system-ui, sans-serif';
    ctx.shadowColor = '#ff3d6e'; ctx.shadowBlur = 30;
    ctx.fillText('SUNSET BAY', FIELD.width / 2, 250); ctx.shadowBlur = 0;
    ctx.fillStyle = '#31e0ff'; ctx.font = '600 18px system-ui, sans-serif';
    ctx.fillText('AN ORIGINAL OPEN-WORLD CRIME STORY', FIELD.width / 2, 282);
    if (controlsPage) {
      ctx.fillStyle = 'rgba(10,16,30,0.85)'; ctx.fillRect(360, 320, 560, 270);
      ctx.fillStyle = '#fff'; ctx.font = '600 17px system-ui, sans-serif';
      const lines = [
        'WASD / arrows — walk & drive    SHIFT — sprint',
        'MOUSE — aim     LEFT CLICK — fire    F — melee',
        'E — enter / exit vehicle     R — reload',
        'M — city map     N — day / night     V — mute',
        'Commit crimes to raise 1–5 wanted stars.',
        'Obey the yellow marker. Follow the story.',
      ];
      lines.forEach((l, i) => ctx.fillText(l, FIELD.width / 2, 360 + i * 34));
      ctx.fillStyle = '#ffd23f'; ctx.font = '700 15px system-ui, sans-serif';
      ctx.fillText('[ENTER] BACK', FIELD.width / 2, 572);
      return;
    }
    menuItems.forEach((label, i) => {
      const y = 380 + i * 62;
      const disabled = label === 'CONTINUE' && !hasSave();
      ctx.fillStyle = i === choice ? '#ffd23f' : disabled ? 'rgba(255,255,255,0.3)' : '#fff';
      ctx.font = `${i === choice ? 800 : 600} 28px system-ui, sans-serif`;
      ctx.fillText(label, FIELD.width / 2, y);
      if (i === choice) {
        ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 2;
        ctx.strokeRect(FIELD.width / 2 - 170, y - 28, 340, 44);
      }
    });
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '14px system-ui, sans-serif';
    ctx.fillText('↑↓ choose    ENTER / CLICK select    ESC pause', FIELD.width / 2, 660);
  }

  function drawOverlay(title, subtitle) {
    render(ctx, game);
    ctx.fillStyle = 'rgba(20,4,8,0.66)'; ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff5a5a'; ctx.font = '900 76px system-ui, sans-serif';
    ctx.shadowColor = '#000'; ctx.shadowBlur = 20;
    ctx.fillText(title, FIELD.width / 2, 300); ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff'; ctx.font = '600 18px system-ui, sans-serif';
    ctx.fillText(subtitle, FIELD.width / 2, 340);
    ['RESTART', 'MAIN MENU'].forEach((label, i) => {
      ctx.fillStyle = i === choice ? '#ffd23f' : '#fff';
      ctx.font = `${i === choice ? 800 : 600} 24px system-ui, sans-serif`;
      ctx.fillText(label, FIELD.width / 2 - 120 + i * 240, 430);
    });
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, 0.25);
    last = now;
    handleUI();

    if (screen === 'play') {
      while (accumulator >= STEP) { updateGame(game, STEP, input); accumulator -= STEP; }
      if (game.dead || game.busted) {
        if (!endedAt) { endedAt = now; choice = 0; }
        if (now - endedAt > 1600) screen = game.dead ? 'wasted' : 'busted';
      } else endedAt = 0;
      if (game.dead || game.busted) {
        // Freeze the simulation but keep the visuals alive while the overlay appears.
      }
      render(ctx, game);
    } else if (screen === 'title') {
      game.time += STEP; drawTitle();
    } else if (screen === 'paused') {
      render(ctx, game);
      ctx.fillStyle = 'rgba(6,10,22,0.7)'; ctx.fillRect(0, 0, FIELD.width, FIELD.height);
      ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.font = '800 54px system-ui, sans-serif';
      ctx.fillText('PAUSED', FIELD.width / 2, 330);
      ctx.fillStyle = '#ffd23f'; ctx.font = '600 18px system-ui, sans-serif';
      ctx.fillText(saveGame(game) ? 'Progress saved' : '', FIELD.width / 2, 372);
      ctx.fillStyle = '#fff'; ctx.font = '16px system-ui, sans-serif';
      ctx.fillText('ENTER / ESC — resume    M — map    N — day/night', FIELD.width / 2, 420);
    } else if (screen === 'wasted') {
      drawOverlay('WASTED', 'Sunset Bay is unforgiving.');
    } else if (screen === 'busted') {
      drawOverlay('BUSTED', 'The Bay Patrol got you.');
    }
  }
  announce('Sunset Bay. Choose NEW GAME to begin.');
  requestAnimationFrame(frame);
}
