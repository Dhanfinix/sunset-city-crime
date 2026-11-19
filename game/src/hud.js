// The full HUD: bars, wanted stars, money, ammo, compass, objective, dialogue and a live minimap.
import { CELL, DISTRICT_LABEL, GRID, PALETTE, WEAPONS, WORLD_SIZE, districtAt } from './config.js';

export function drawHUD(ctx, g, w, h) {
  const p = g.state.player;
  ctx.save();
  ctx.textBaseline = 'middle';

  // --- health, armour and money (top-left) ---
  panel(ctx, 18, 18, 286, 104);
  label(ctx, 'HEALTH', 32, 38, 11, '#9fb0c4');
  bar(ctx, 32, 50, 122, 10, p.health / 100, PALETTE.health);
  label(ctx, 'ARMOUR', 164, 38, 11, '#9fb0c4');
  bar(ctx, 164, 50, 122, 10, p.armour / 100, PALETTE.armour);
  label(ctx, `$${Math.floor(p.money).toLocaleString()}`, 32, 82, 24, PALETTE.star, 'left', true);
  label(ctx, p.inVehicle ? 'IN VEHICLE' : 'ON FOOT', 300, 84, 11, '#9fb0c4', 'right');

  // --- wanted stars (top-centre) ---
  if (g.police.stars > 0) {
    for (let i = 0; i < 5; i += 1) {
      const x = w / 2 + (i - 2) * 30;
      star(ctx, x, 34, 12, i < g.police.stars ? PALETTE.star : 'rgba(255,255,255,0.18)');
    }
    label(ctx, 'WANTED', w / 2, 58, 12, PALETTE.star, 'center', true);
  }

  // --- compass (top-centre, beneath stars) ---
  const heading = ((g.state.heading * 180 / Math.PI) % 360 + 360) % 360;
  const cardinal = heading < 45 || heading >= 315 ? 'N' : heading < 135 ? 'E' : heading < 225 ? 'S' : 'W';
  label(ctx, cardinal, w / 2, g.police.stars > 0 ? 82 : 34, 22, PALETTE.text, 'center', true);

  drawMinimap(ctx, g, w - 232, 18, 214);

  // --- weapon / ammo (bottom-left) ---
  panel(ctx, 18, h - 92, 260, 74);
  const weapon = WEAPONS[p.weapon];
  label(ctx, weapon.name, 32, h - 70, 13, PALETTE.neonCyan, 'left', true);
  if (p.weapon === 'fists') {
    label(ctx, 'MELEE', 32, h - 44, 22, PALETTE.text, 'left', true);
  } else {
    label(ctx, `${p.ammo} / ${p.reserve}`, 32, h - 42, 28, p.ammo === 0 ? '#ff6b6b' : PALETTE.text, 'left', true);
    if (p.reloadTimer > 0) label(ctx, 'RELOADING...', 250, h - 44, 11, PALETTE.neonGold, 'right');
  }

  // --- objective + district (bottom-centre) ---
  const district = districtAt(Math.max(0, Math.min(WORLD_SIZE - 1, p.x)) / CELL | 0,
    Math.max(0, Math.min(WORLD_SIZE - 1, p.y)) / CELL | 0);
  ctx.textAlign = 'center';
  const obj = g.missions.objective;
  const objW = Math.min(560, Math.max(320, obj.length * 8.2));
  panel(ctx, (w - objW) / 2, h - 62, objW, 44);
  if (g.missions.missionTitle) label(ctx, g.missions.missionTitle, w / 2, h - 50, 11, PALETTE.neonGold, 'center', true);
  label(ctx, obj, w / 2, h - 32, 14, PALETTE.text, 'center');

  // --- dialogue box (left-centre) ---
  if (g.missions.dialogue) {
    ctx.textAlign = 'left';
    const lines = wrap(ctx, g.missions.dialogue, 430, '15px sans-serif');
    const dh = 30 + lines.length * 21;
    panel(ctx, 18, h / 2 - dh / 2, 466, dh);
    label(ctx, 'RADIO', 34, h / 2 - dh / 2 + 16, 11, PALETTE.neonPink, 'left', true);
    lines.forEach((line, i) => label(ctx, line, 34, h / 2 - dh / 2 + 40 + i * 21, 15, PALETTE.text));
  }

  // --- notifications (upper-left, beneath bars) ---
  g.notifications.forEach((n, i) => {
    const a = Math.max(0, Math.min(1, n.life));
    ctx.globalAlpha = a;
    panel(ctx, 18, 132 + i * 34, Math.min(460, n.text.length * 8 + 40), 28);
    label(ctx, n.text, 32, 146 + i * 34, 13, PALETTE.neonGold);
    ctx.globalAlpha = 1;
  });

  // District name + clock (bottom-right, above the map corner).
  label(ctx, DISTRICT_LABEL[district] || 'SUNSET BAY', w - 26, h - 62, 12, PALETTE.neonCyan, 'right', true);
  const hh = String(Math.floor(g.state.clock * 24) % 24).padStart(2, '0');
  const mm = String(Math.floor((g.state.clock * 24 % 1) * 60)).padStart(2, '0');
  label(ctx, `${hh}:${mm}  ${g.state.rain ? 'RAIN' : 'CLEAR'}`, w - 26, h - 42, 11, '#9fb0c4', 'right');
  label(ctx, 'WASD move/steer · SHIFT sprint · E enter · click fire · R reload · Q weapon · T rain · P pause',
    w - 26, h - 20, 10, 'rgba(220,230,240,0.55)', 'right');

  ctx.restore();
}

function drawMinimap(ctx, g, x, y, size) {
  const p = g.state.player;
  const range = 1050;
  const scale = size / (range * 2);
  const cx = x + size / 2, cy = y + size / 2;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, size, size);
  ctx.clip();
  ctx.fillStyle = 'rgba(14,20,34,0.92)';
  ctx.fillRect(x, y, size, size);

  // Roads from the same grid data as the world.
  ctx.strokeStyle = 'rgba(150,170,190,0.35)';
  ctx.lineWidth = 2;
  for (let i = 0; i <= GRID; i += 1) {
    const gx = cx + (i * CELL - p.x) * scale;
    const gy = cy + (i * CELL - p.y) * scale;
    ctx.beginPath(); ctx.moveTo(gx, y); ctx.lineTo(gx, y + size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x + size, gy); ctx.stroke();
  }

  // Points of interest.
  for (const poi of g.world.pois) {
    const mx = cx + (poi.x - p.x) * scale, my = cy + (poi.y - p.y) * scale;
    if (mx < x || mx > x + size || my < y || my > y + size) continue;
    ctx.fillStyle = 'rgba(120,220,255,0.6)';
    ctx.fillRect(mx - 2, my - 2, 4, 4);
  }
  // Mission markers.
  for (const m of g.missions.markers) {
    const mx = cx + (m.x - p.x) * scale, my = cy + (m.y - p.y) * scale;
    if (mx < x - 10 || mx > x + size + 10 || my < y - 10 || my > y + size + 10) continue;
    ctx.save(); ctx.shadowColor = PALETTE.neonGold; ctx.shadowBlur = 8;
    star(ctx, mx, my, m.kind === 'mission' ? 8 : 6, m.kind === 'collect' ? PALETTE.neonCyan : PALETTE.neonGold);
    ctx.restore();
  }
  // Police blips.
  for (const v of g.vehicles.vehicles) {
    if (!v.isPolice) continue;
    const mx = cx + (v.x - p.x) * scale, my = cy + (v.y - p.y) * scale;
    if (mx < x || mx > x + size || my < y || my > y + size) continue;
    ctx.fillStyle = '#ff4a6a';
    ctx.beginPath(); ctx.arc(mx, my, 4, 0, Math.PI * 2); ctx.fill();
  }
  for (const o of g.police.officers) {
    const mx = cx + (o.x - p.x) * scale, my = cy + (o.y - p.y) * scale;
    ctx.fillStyle = '#7fb8ff';
    ctx.beginPath(); ctx.arc(mx, my, 3, 0, Math.PI * 2); ctx.fill();
  }
  // Traffic (faint dots).
  for (const v of g.vehicles.vehicles) {
    if (v.isPolice) continue;
    const mx = cx + (v.x - p.x) * scale, my = cy + (v.y - p.y) * scale;
    if (mx < x || mx > x + size || my < y || my > y + size) continue;
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(mx - 1.5, my - 1.5, 3, 3);
  }
  // Player arrow.
  ctx.save();
  ctx.translate(cx, cy); ctx.rotate(p.angle + Math.PI / 2);
  ctx.fillStyle = PALETTE.neonCyan;
  ctx.shadowColor = PALETTE.neonCyan; ctx.shadowBlur = 10;
  ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(6, 7); ctx.lineTo(0, 3); ctx.lineTo(-6, 7); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.restore();

  ctx.strokeStyle = 'rgba(120,180,220,0.6)';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, size - 2, size - 2);
  ctx.textAlign = 'center';
  label(ctx, 'N', cx, y + 10, 11, '#cfe6ff', 'center', true);
}

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = PALETTE.hudPanel;
  roundRect(ctx, x, y, w, h, 8); ctx.fill();
  ctx.strokeStyle = 'rgba(120,180,220,0.22)'; ctx.lineWidth = 1; ctx.stroke();
}
function bar(ctx, x, y, w, h, frac, color) {
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  roundRect(ctx, x, y, w, h, h / 2); ctx.fill();
  ctx.fillStyle = color;
  roundRect(ctx, x, y, Math.max(0, w * Math.max(0, Math.min(1, frac))), h, h / 2); ctx.fill();
}
function label(ctx, text, x, y, size, color, align = 'left', bold = false) {
  ctx.font = `${bold ? 'bold ' : ''}${size}px "Trebuchet MS", sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.fillText(text, x, y);
}
function star(ctx, cx, cy, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const a = -Math.PI / 2 + i * Math.PI / 5;
    const rr = i % 2 ? r * 0.45 : r;
    const px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath(); ctx.fill();
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function wrap(ctx, text, maxWidth, font) {
  ctx.font = font;
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const t = line ? line + ' ' + word : word;
    if (ctx.measureText(t).width > maxWidth && line) { lines.push(line); line = word; }
    else line = t;
  }
  if (line) lines.push(line);
  return lines;
}
