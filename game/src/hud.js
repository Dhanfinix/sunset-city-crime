// The heads-up display: bars, wanted stars, compass, objective, notifications and live minimap.

import { FIELD, COLORS, CELL, GRID, WORLD } from './config.js';
import { currentObjective, currentMarker } from './missions.js';

function panel(ctx, x, y, w, h, alpha = 0.55) {
  ctx.fillStyle = `rgba(8,12,22,${alpha})`;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 8); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.10)'; ctx.lineWidth = 1; ctx.stroke();
}

function bar(ctx, x, y, w, h, value, color, label) {
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color; ctx.fillRect(x, y, w * Math.max(0, Math.min(1, value)), h);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1; ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = '#fff'; ctx.font = '600 11px system-ui, sans-serif'; ctx.textAlign = 'left';
  ctx.fillText(label, x + 5, y + h - 4);
}

function star(ctx, x, y, r, filled) {
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.45;
    const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = filled ? COLORS.star : 'rgba(255,255,255,0.16)';
  if (filled) { ctx.shadowColor = COLORS.star; ctx.shadowBlur = 10; }
  ctx.fill(); ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1; ctx.stroke();
}

function drawMinimap(ctx, g) {
  const S = 186, pad = 16, x = pad, y = FIELD.height - S - pad;
  ctx.save();
  ctx.beginPath(); ctx.roundRect(x, y, S, S, 10); ctx.clip();
  ctx.fillStyle = '#0e1526'; ctx.fillRect(x, y, S, S);
  const scale = S / (CELL * 6);
  const cx = g.player.x, cy = g.player.y;
  const toMap = (wx, wy) => ({ x: x + S / 2 + (wx - cx) * scale, y: y + S / 2 + (wy - cy) * scale });

  // Water, parks and road grid straight from the world data.
  ctx.fillStyle = COLORS.water;
  for (const wc of g.world.waterCells) {
    const p = toMap(wc.x, wc.y); ctx.fillRect(p.x, p.y, wc.w * scale, wc.h * scale);
  }
  ctx.strokeStyle = '#394456'; ctx.lineWidth = Math.max(1, 12 * scale);
  for (let k = 0; k <= GRID; k += 1) {
    let a = toMap(k * CELL, 0), b = toMap(k * CELL, WORLD);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    a = toMap(0, k * CELL); b = toMap(WORLD, k * CELL);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  ctx.fillStyle = '#586174';
  for (const b of g.world.buildings) {
    const p = toMap(b.x, b.y);
    ctx.fillRect(p.x, p.y, Math.max(1, b.w * scale), Math.max(1, b.h * scale));
  }
  // POIs.
  for (const poi of g.world.pois) {
    const p = toMap(poi.x, poi.y);
    ctx.fillStyle = '#7de0ff'; ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
  }
  // Mission marker.
  const marker = (g.markers && g.markers[0]) || currentMarker(g.mission);
  if (marker) {
    const p = toMap(marker.x, marker.y);
    ctx.fillStyle = '#ffd23f'; ctx.shadowColor = '#ffd23f'; ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, 6.28); ctx.fill(); ctx.shadowBlur = 0;
  }
  // Police blips.
  for (const u of g.police.units) {
    const p = toMap(u.x, u.y);
    ctx.fillStyle = '#4d9bff'; ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, 6.28); ctx.fill();
  }
  // Player arrow.
  const pc = toMap(g.player.x, g.player.y);
  const ang = g.player.inVehicle ? g.player.vehicle.angle : g.player.aimAngle;
  ctx.save(); ctx.translate(pc.x, pc.y); ctx.rotate(ang);
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-6, -5); ctx.lineTo(-6, 5); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(x, y, S, S, 10); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.65)'; ctx.font = '600 10px system-ui, sans-serif'; ctx.textAlign = 'left';
  ctx.fillText(g.world.streetName(g.player.x, g.player.y).toUpperCase(), x + 8, y + 16);
}

export function drawHUD(ctx, g) {
  const W = FIELD.width, H = FIELD.height;
  // Top-left status panel.
  panel(ctx, 16, 16, 244, 78, 0.5);
  bar(ctx, 28, 28, 220, 16, g.player.health / 100, COLORS.health, 'HEALTH');
  bar(ctx, 28, 50, 220, 16, g.player.armour / 100, COLORS.armour, 'ARMOUR');
  ctx.fillStyle = COLORS.money; ctx.font = '700 22px system-ui, sans-serif'; ctx.textAlign = 'left';
  ctx.shadowColor = '#000'; ctx.shadowBlur = 6;
  ctx.fillText(`$${g.player.money.toLocaleString()}`, 28, 92); ctx.shadowBlur = 0;

  // Compass.
  const heading = ((g.player.inVehicle ? g.player.vehicle.angle : g.player.aimAngle) * 180 / Math.PI + 90 + 360) % 360;
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const label = dirs[Math.round(heading / 45) % 8];
  ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.font = '700 20px system-ui, sans-serif';
  ctx.shadowColor = '#000'; ctx.shadowBlur = 8;
  ctx.fillText(label, W / 2, 40);
  ctx.font = '600 11px system-ui, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillText('SUNSET BAY', W / 2, 58); ctx.shadowBlur = 0;

  // Wanted stars.
  for (let i = 0; i < 5; i += 1) star(ctx, W - 42 - i * 36, 42, 13, i < g.police.stars);

  // Objective banner.
  const objective = currentObjective(g.mission);
  const marker = (g.markers && g.markers[0]) || currentMarker(g.mission);
  panel(ctx, W / 2 - 210, 74, 420, 40, 0.45);
  ctx.textAlign = 'center'; ctx.fillStyle = '#ffd23f'; ctx.font = '700 13px system-ui, sans-serif';
  ctx.fillText('CURRENT OBJECTIVE', W / 2, 90);
  ctx.fillStyle = '#fff'; ctx.font = '600 14px system-ui, sans-serif';
  ctx.fillText(objective, W / 2, 108);
  if (marker) {
    const dist = Math.round(Math.hypot(g.player.x - marker.x, g.player.y - marker.y));
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = '11px system-ui, sans-serif';
    ctx.fillText(`${dist} m`, W / 2, 124);
  }

  // Weapon and ammo.
  panel(ctx, W - 230, H - 104, 214, 88, 0.5);
  ctx.textAlign = 'right'; ctx.fillStyle = '#fff'; ctx.font = '700 15px system-ui, sans-serif';
  ctx.fillText('SIDEARM', W - 30, H - 76);
  ctx.fillStyle = g.combat.clip > 0 ? '#fff' : '#ff6b6b'; ctx.font = '700 34px system-ui, sans-serif';
  ctx.fillText(`${g.combat.clip}`, W - 92, H - 40);
  ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.font = '600 16px system-ui, sans-serif';
  ctx.fillText(`/ ${g.combat.reserve}`, W - 30, H - 40);
  if (g.combat.reloadTimer > 0) {
    ctx.fillStyle = '#ffd23f'; ctx.font = '11px system-ui, sans-serif';
    ctx.fillText('RELOADING', W - 30, H - 24);
  }

  drawMinimap(ctx, g);

  // Notifications.
  let ny = H - 232;
  for (const n of g.notifications.slice(-4)) {
    const a = Math.min(1, n.t * 2);
    ctx.globalAlpha = a;
    ctx.textAlign = 'center'; ctx.font = '700 15px system-ui, sans-serif';
    ctx.fillStyle = '#000'; ctx.fillText(n.text, W / 2 + 2, ny + 2);
    ctx.fillStyle = '#fff'; ctx.fillText(n.text, W / 2, ny);
    ctx.globalAlpha = 1; ny -= 26;
  }

  // Dialogue.
  if (g.mission.dialogue) {
    panel(ctx, W / 2 - 300, H - 150, 600, 52, 0.72);
    ctx.textAlign = 'left'; ctx.fillStyle = '#ffd23f'; ctx.font = '700 12px system-ui, sans-serif';
    ctx.fillText('DIALOGUE', W / 2 - 284, H - 130);
    ctx.fillStyle = '#fff'; ctx.font = '600 14px system-ui, sans-serif';
    ctx.fillText(g.mission.dialogue, W / 2 - 284, H - 110);
  }

  // Side activity (race timer).
  if (g.side && g.side.kind === 'race') {
    panel(ctx, W / 2 - 110, H - 200, 220, 34, 0.6);
    ctx.textAlign = 'center'; ctx.fillStyle = '#31e0ff'; ctx.font = '700 15px system-ui, sans-serif';
    ctx.fillText(`STREET RACE  ${Math.max(0, g.side.time).toFixed(1)}s  CP ${g.side.cp + 1}/${g.side.checkpoints.length}`, W / 2, H - 178);
  }

  // Crosshair.
  if (!g.player.inVehicle) {
    const mx = g.input.mouse.x, my = g.input.mouse.y;
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(mx, my, 9, 0, 6.28); ctx.moveTo(mx - 14, my); ctx.lineTo(mx - 5, my);
    ctx.moveTo(mx + 5, my); ctx.lineTo(mx + 14, my); ctx.moveTo(mx, my - 14); ctx.lineTo(mx, my - 5);
    ctx.moveTo(mx, my + 5); ctx.lineTo(mx, my + 14); ctx.stroke();
  }

  // Enter-vehicle prompt.
  if (!g.player.inVehicle && g.nearVehicle) {
    ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.font = '700 14px system-ui, sans-serif';
    ctx.shadowColor = '#000'; ctx.shadowBlur = 6;
    ctx.fillText('[E]  STEAL / DRIVE', W / 2, H / 2 + 54); ctx.shadowBlur = 0;
  }

  // Map overlay.
  if (g.mapOpen) {
    ctx.fillStyle = 'rgba(6,10,20,0.86)'; ctx.fillRect(0, 0, W, H);
    const s = 600, ox = (W - s) / 2, oy = (H - s) / 2, sc = s / WORLD;
    ctx.strokeStyle = '#4d5a72'; ctx.lineWidth = 9;
    for (let k = 0; k <= GRID; k += 1) {
      ctx.beginPath(); ctx.moveTo(ox + k * CELL * sc, oy); ctx.lineTo(ox + k * CELL * sc, oy + s); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(ox, oy + k * CELL * sc); ctx.lineTo(ox + s, oy + k * CELL * sc); ctx.stroke();
    }
    ctx.fillStyle = '#7d879c';
    for (const b of g.world.buildings) ctx.fillRect(ox + b.x * sc, oy + b.y * sc, Math.max(1, b.w * sc), Math.max(1, b.h * sc));
    ctx.fillStyle = COLORS.water;
    for (const wc of g.world.waterCells) ctx.fillRect(ox + wc.x * sc, oy + wc.y * sc, wc.w * sc, wc.h * sc);
    const p = { x: ox + g.player.x * sc, y: oy + g.player.y * sc };
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, 6.28); ctx.fill();
    ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.font = '700 24px system-ui, sans-serif';
    ctx.fillText('SUNSET BAY  —  CITY MAP', W / 2, oy - 18);
    ctx.font = '12px system-ui, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText('[M] close map', W / 2, oy + s + 26);
  }
}
