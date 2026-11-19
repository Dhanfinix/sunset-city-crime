// Top-level painter: lighting, the camera transform, all entities, weather and the HUD.
import { PALETTE } from './config.js';
import { drawWorld } from './world.js';
import { drawPlayer } from './entities.js';
import { drawVehicle } from './vehicles.js';
import { drawHUD } from './hud.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WASTED = 'wasted';

// A cyan pool of light under the player's car so it reads at a glance in a busy chase.
function drawVehicleGlow(ctx, v) {
  ctx.save();
  ctx.translate(v.x, v.y);
  ctx.rotate(v.angle);
  ctx.fillStyle = 'rgba(56,230,255,0.16)';
  ctx.beginPath(); ctx.ellipse(0, 0, 36, 56, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(56,230,255,0.55)'; ctx.lineWidth = 2; ctx.stroke();
  const beam = ctx.createLinearGradient(10, 0, 320, 0);
  beam.addColorStop(0, 'rgba(255,246,196,0.20)');
  beam.addColorStop(1, 'rgba(255,246,196,0)');
  ctx.fillStyle = beam;
  ctx.beginPath(); ctx.moveTo(14, -10); ctx.lineTo(320, -95); ctx.lineTo(320, 95); ctx.lineTo(14, 10); ctx.closePath(); ctx.fill();
  ctx.restore();
}

// A pulsing gold beacon in the world marks the active objective (matched on the minimap).
function drawWorldMarker(ctx, m, time) {
  const pulse = 0.5 + 0.5 * Math.sin(time * 4);
  ctx.save();
  ctx.translate(m.x, m.y);
  ctx.strokeStyle = m.kind === 'collect' ? PALETTE.neonCyan : PALETTE.neonGold;
  ctx.globalAlpha = 0.55 + pulse * 0.35;
  ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = 18;
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(0, 0, 26 + pulse * 6, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, -44); ctx.lineTo(0, -64); ctx.stroke();
  if (m.label && m.kind === 'mission') {
    ctx.font = 'bold 13px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.neonGold;
    ctx.fillText(m.label, 0, -74);
  }
  ctx.restore();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  function resize() {
    canvas.width = Math.max(640, window.innerWidth | 0);
    canvas.height = Math.max(480, window.innerHeight | 0);
  }
  resize();
  window.addEventListener('resize', resize);

  function drawScene(g) {
    const { camera, world, state } = g;
    camera.width = canvas.width; camera.height = canvas.height;
    const night = g.night();
    const w = canvas.width, h = canvas.height;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = night > 0.5 ? PALETTE.nightSky : PALETTE.daySky;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    const shakeX = (Math.random() - 0.5) * g.effects.shake;
    const shakeY = (Math.random() - 0.5) * g.effects.shake;
    ctx.translate(w / 2 + shakeX, h / 2 + shakeY);
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(-w / 2, -h / 2);

    drawWorld(ctx, world, camera, { night, time: state.time, rain: state.rain });
    // Re-assert the exact world transform before dynamic entities (robust against any nested save state).
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.translate(w / 2 + shakeX, h / 2 + shakeY);
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(-camera.x, -camera.y);
    g.effects.draw(ctx, camera);
    if (state.player.inVehicle) drawVehicleGlow(ctx, state.player.inVehicle);
    for (const v of g.vehicles.vehicles) {
      if (Math.abs(v.x - camera.x) > w / 2 + 90 || Math.abs(v.y - camera.y) > h / 2 + 90) continue;
      drawVehicle(ctx, v, night);
    }
    g.peds.draw(ctx, camera);
    g.police.drawOfficers(ctx, camera);
    drawPlayer(ctx, state.player, camera, state.player.fireTimer > 0.03 ? 1 : 0);
    g.combat.draw(ctx, camera);
    for (const m of g.missions.markers) drawWorldMarker(ctx, m, state.time);

    // Headlight cones at night, anchored to the player's aim.
    if (night > 0.35 && !state.player.inVehicle) {
      const p = state.player;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.angle);
      const grad = ctx.createLinearGradient(0, 0, 240, 0);
      grad.addColorStop(0, `rgba(255,246,200,${0.14 * night})`);
      grad.addColorStop(1, 'rgba(255,246,200,0)');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(240, -70); ctx.lineTo(240, 70); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    ctx.restore();

    // Night tint and vignette in screen space.
    if (night > 0.02) {
      ctx.fillStyle = `rgba(10,14,40,${night * 0.16})`;
      ctx.fillRect(0, 0, w, h);
    }
    const vg = ctx.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, h * 0.85);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.34)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);

    g.effects.drawRain(ctx, camera, state.rain, state.time);
    drawHUD(ctx, g, w, h);
  }

  function drawOverlay(screen, g) {
    const w = canvas.width, h = canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (screen === SCREEN_PLAY) return;
    ctx.fillStyle = screen === SCREEN_BUSTED ? 'rgba(10,26,60,0.72)'
      : screen === SCREEN_WASTED ? 'rgba(60,10,10,0.72)' : 'rgba(6,10,22,0.78)';
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center';
    if (screen === SCREEN_TITLE) {
      ctx.save();
      ctx.shadowColor = PALETTE.neonPink; ctx.shadowBlur = 26;
      ctx.fillStyle = PALETTE.neonPink;
      ctx.font = 'bold 78px "Trebuchet MS", sans-serif';
      ctx.fillText('SUNSET BAY', w / 2, h / 2 - 92);
      ctx.restore();
      ctx.fillStyle = PALETTE.neonCyan;
      ctx.font = 'bold 20px "Trebuchet MS", sans-serif';
      ctx.fillText('A SUN-SOAKED CRIME CITY', w / 2, h / 2 - 52);
      ctx.fillStyle = PALETTE.text;
      ctx.font = '16px "Trebuchet MS", sans-serif';
      ctx.fillText('NEW GAME  [ENTER]        CONTINUE  [C]', w / 2, h / 2 + 14);
      ctx.fillStyle = '#a9b7c8';
      ctx.font = '14px "Trebuchet MS", sans-serif';
      [
        'WASD move · SHIFT sprint · mouse aim · click fire · Q switch weapon · R reload',
        'E enter/exit vehicles · T toggle rain · F6 save · P pause',
        'Steal cars, take jobs from Rina, and lose the cops before the stars fill.',
      ].forEach((line, i) => ctx.fillText(line, w / 2, h / 2 + 58 + i * 26));
    } else if (screen === SCREEN_PAUSED) {
      ctx.fillStyle = PALETTE.text;
      ctx.font = 'bold 56px "Trebuchet MS", sans-serif';
      ctx.fillText('PAUSED', w / 2, h / 2 - 20);
      ctx.fillStyle = '#a9b7c8';
      ctx.font = '18px "Trebuchet MS", sans-serif';
      ctx.fillText('Press P or ESC to resume  ·  F6 to save', w / 2, h / 2 + 26);
    } else if (screen === SCREEN_BUSTED || screen === SCREEN_WASTED) {
      ctx.save();
      ctx.shadowColor = screen === SCREEN_BUSTED ? '#4aa3ff' : '#ff5a5a';
      ctx.shadowBlur = 22;
      ctx.fillStyle = PALETTE.text;
      ctx.font = 'bold 72px "Trebuchet MS", sans-serif';
      ctx.fillText(screen === SCREEN_BUSTED ? 'BUSTED' : 'WASTED', w / 2, h / 2 - 16);
      ctx.restore();
      ctx.fillStyle = '#cbd6e2';
      ctx.font = '18px "Trebuchet MS", sans-serif';
      ctx.fillText('Press ENTER to respawn at the hospital', w / 2, h / 2 + 34);
    }
  }

  return {
    canvas, ctx,
    draw(g, screen) { drawScene(g); drawOverlay(screen, g); },
    drawScene,
  };
}
