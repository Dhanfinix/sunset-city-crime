// All canvas painting: the city, its districts, actors, lighting and the HUD.

import { FIELD, CELL, ROAD, GRID, WORLD, COLORS, VEHICLE_TYPES } from './config.js';
import { worldToScreen } from './camera.js';
import { drawHUD } from './hud.js';
import { currentMarker } from './missions.js';

function darkness(g) {
  // 0 at midday, 1 deep night, from the game's day phase.
  const p = g.dayPhase;
  return Math.max(0, Math.min(1, 0.5 - 0.5 * Math.cos(p * Math.PI * 2) - 0.15));
}

function visible(g, pad = 120) {
  const hw = FIELD.width / 2 + pad, hh = FIELD.height / 2 + pad;
  return { x0: g.camera.x - hw, x1: g.camera.x + hw, y0: g.camera.y - hh, y1: g.camera.y + hh };
}

function beginWorld(ctx, g) {
  ctx.save();
  ctx.translate(FIELD.width / 2, FIELD.height / 2);
  ctx.scale(g.camera.zoom || 1, g.camera.zoom || 1);
  ctx.translate(-g.camera.x + g.camera.ox, -g.camera.y + g.camera.oy);
}

function drawGround(ctx, g, v) {
  ctx.fillStyle = '#1d2430'; ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);
  // Water with horizontal wave bands.
  ctx.fillStyle = COLORS.water;
  for (const wc of g.world.waterCells) {
    if (wc.x + wc.w < v.x0 || wc.x > v.x1 || wc.y + wc.h < v.y0 || wc.y > v.y1) continue;
    ctx.fillRect(wc.x, wc.y, wc.w, wc.h);
    ctx.fillStyle = COLORS.waterLight;
    for (let y = wc.y + 12; y < wc.y + wc.h; y += 22) {
      const off = Math.sin(g.time * 1.5 + y * 0.05) * 8;
      ctx.fillRect(wc.x + 20 + off, y, wc.w - 60, 3);
    }
    ctx.fillStyle = COLORS.water;
  }
  // Sand, parks and boardwalk.
  for (const p of g.world.props) {
    if (p.x + (p.w || 40) < v.x0 || p.x > v.x1 || p.y + (p.h || 40) < v.y0 || p.y > v.y1) continue;
    if (p.kind === 'sand') {
      ctx.fillStyle = COLORS.sand; ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.fillStyle = COLORS.sandDark;
      for (let d = 0; d < 4; d += 1) ctx.fillRect(p.x, p.y + 30 + d * 46, p.w, 4);
    } else if (p.kind === 'park') {
      ctx.fillStyle = COLORS.grass; ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.fillStyle = COLORS.grassDark;
      ctx.fillRect(p.x + 10, p.y + 10, p.w - 20, 10);
      ctx.fillRect(p.x + 10, p.y + p.h - 20, p.w - 20, 10);
    } else if (p.kind === 'boardwalk') {
      ctx.fillStyle = '#a8794a'; ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.strokeStyle = '#7a5636'; ctx.lineWidth = 2;
      for (let x = p.x; x < p.x + p.w; x += 14) { ctx.beginPath(); ctx.moveTo(x, p.y); ctx.lineTo(x, p.y + p.h); ctx.stroke(); }
    }
  }
}

function drawRoads(ctx, g, v) {
  const half = ROAD / 2;
  ctx.strokeStyle = COLORS.asphalt; ctx.lineWidth = ROAD;
  for (let k = 0; k <= GRID; k += 1) {
    const c = k * CELL;
    ctx.beginPath(); ctx.moveTo(c, v.y0 - 200); ctx.lineTo(c, v.y1 + 200); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(v.x0 - 200, c); ctx.lineTo(v.x1 + 200, c); ctx.stroke();
  }
  // Sidewalks: thin light strips at the road edges.
  ctx.strokeStyle = COLORS.sidewalk; ctx.lineWidth = 6;
  for (let k = 0; k <= GRID; k += 1) {
    const c = k * CELL;
    for (const e of [-half, half]) {
      ctx.beginPath(); ctx.moveTo(c + e, v.y0 - 200); ctx.lineTo(c + e, v.y1 + 200); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(v.x0 - 200, c + e); ctx.lineTo(v.x1 + 200, c + e); ctx.stroke();
    }
  }
  // Dashed centre lines.
  ctx.strokeStyle = COLORS.asphaltLine; ctx.lineWidth = 2; ctx.setLineDash([16, 20]);
  for (let k = 0; k <= GRID; k += 1) {
    const c = k * CELL;
    ctx.beginPath(); ctx.moveTo(c, v.y0 - 200); ctx.lineTo(c, v.y1 + 200); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(v.x0 - 200, c); ctx.lineTo(v.x1 + 200, c); ctx.stroke();
  }
  ctx.setLineDash([]);
  // Crosswalks near some intersections.
  ctx.fillStyle = COLORS.crosswalk;
  for (let ix = 1; ix < GRID; ix += 1) for (let iy = 1; iy < GRID; iy += 1) {
    const cx = ix * CELL, cy = iy * CELL;
    if (cx < v.x0 - 60 || cx > v.x1 + 60 || cy < v.y0 - 60 || cy > v.y1 + 60) continue;
    if ((ix + iy) % 2) continue;
    for (let s = -2; s <= 2; s += 1) {
      ctx.fillRect(cx - half - 12 + s * 9, cy - half - 8, 5, 16);
      ctx.fillRect(cx - half - 8, cy - half - 12 + s * 9, 16, 5);
    }
  }
}

function drawBuildings(ctx, g, v, dark) {
  for (const b of g.world.buildings) {
    if (b.x + b.w < v.x0 || b.x > v.x1 || b.y + b.h < v.y0 || b.y > v.y1) continue;
    const lift = b.tower ? Math.min(26, b.floors * 3) : b.house ? 5 : 10;
    // Drop shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(b.x + 7, b.y + 7, b.w, b.h);
    // Raised side faces give a 2.5D extrusion.
    ctx.fillStyle = shade(b.color, -0.35);
    ctx.fillRect(b.x, b.y - lift, b.w, b.h + lift);
    ctx.fillStyle = shade(b.color, -0.15);
    ctx.fillRect(b.x - lift, b.y - lift, lift, b.h + lift);
    // Roof / front face.
    ctx.fillStyle = b.color; ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = shade(b.color, -0.5); ctx.lineWidth = 1; ctx.strokeRect(b.x, b.y, b.w, b.h);

    const step = b.tower ? 11 : 14;
    const cols = Math.max(1, Math.floor((b.w - 8) / step));
    const rows = Math.max(1, Math.floor((b.h - 8) / step));
    for (let r = 0; r < rows; r += 1) for (let c = 0; c < cols; c += 1) {
      const lit = ((c * 31 + r * 17 + b.winSeed) % 7) < (dark > 0.4 ? 5 : 3);
      ctx.fillStyle = lit ? (dark > 0.25 ? b.winColor : '#bcd2e6') : COLORS.windowDark;
      if (lit && dark > 0.25) { ctx.shadowColor = b.winColor; ctx.shadowBlur = 6; }
      ctx.fillRect(b.x + 6 + c * step, b.y + 6 + r * step, step - 5, step - 6);
      ctx.shadowBlur = 0;
    }
    if (b.neon) {
      ctx.fillStyle = b.neon; ctx.shadowColor = b.neon; ctx.shadowBlur = 14 + dark * 14;
      ctx.fillRect(b.x + 4, b.y - lift - 4, b.w - 8, 5);
      if (b.sign && b.w > 60) {
        ctx.font = '700 10px system-ui, sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(b.sign.toUpperCase().slice(0, 12), b.x + b.w / 2, b.y - lift - 10);
      }
      ctx.shadowBlur = 0;
    }
  }
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const f = (v) => Math.max(0, Math.min(255, Math.round(v + (amt > 0 ? (255 - v) * amt : v * amt))));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

function drawProps(ctx, g, v, dark) {
  for (const p of g.world.props) {
    if (p.x < v.x0 - 60 || p.x > v.x1 + 60 || p.y < v.y0 - 60 || p.y > v.y1 + 60) continue;
    if (p.kind === 'pier') {
      ctx.fillStyle = COLORS.pier; ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.strokeStyle = '#4d3722'; ctx.lineWidth = 1;
      for (let x = p.x; x < p.x + p.w; x += 12) { ctx.beginPath(); ctx.moveTo(x, p.y); ctx.lineTo(x, p.y + p.h); ctx.stroke(); }
    } else if (p.kind === 'boat') {
      ctx.fillStyle = '#e6e9ef'; ctx.beginPath(); ctx.ellipse(p.x, p.y, 26, 12, 0, 0, 6.28); ctx.fill();
      ctx.fillStyle = '#3b6a94'; ctx.fillRect(p.x - 8, p.y - 9, 16, 10);
    } else if (p.kind === 'palm' || p.kind === 'tree') {
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(p.x + 5, p.y + 6, 12, 5, 0, 0, 6.28); ctx.fill();
      ctx.fillStyle = p.kind === 'palm' ? '#8a6b45' : '#6b4a30'; ctx.fillRect(p.x - 2, p.y - 4, 4, 10);
      ctx.fillStyle = p.kind === 'palm' ? '#3f9a5c' : '#4f8f4a'; ctx.shadowColor = '#000'; ctx.shadowBlur = 4;
      ctx.beginPath(); ctx.arc(p.x, p.y - 8, p.kind === 'palm' ? 11 : 13, 0, 6.28); ctx.fill(); ctx.shadowBlur = 0;
    } else if (p.kind === 'bench') {
      ctx.fillStyle = '#8a6b45'; ctx.fillRect(p.x - 10, p.y - 3, 20, 6);
    } else if (p.kind === 'lamp') {
      ctx.fillStyle = '#3a4356'; ctx.fillRect(p.x - 1, p.y - 1, 3, 3);
      if (dark > 0.2) {
        ctx.fillStyle = '#ffe6a3'; ctx.shadowColor = '#ffd98a'; ctx.shadowBlur = 14 * dark;
        ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, 6.28); ctx.fill(); ctx.shadowBlur = 0;
        const grd = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, 70);
        grd.addColorStop(0, `rgba(255,220,150,${0.16 * dark})`); grd.addColorStop(1, 'rgba(255,220,150,0)');
        ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(p.x, p.y, 70, 0, 6.28); ctx.fill();
      }
    }
  }
}

function drawMarker(ctx, g, v, dark) {
  const m = (g.markers && g.markers[0]) || currentMarker(g.mission);
  if (!m) return;
  const pulse = 1 + Math.sin(g.time * 4) * 0.12;
  const r = (m.radius || 80) * pulse;
  ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 4; ctx.shadowColor = '#ffd23f'; ctx.shadowBlur = 20;
  ctx.beginPath(); ctx.ellipse(m.x, m.y, r, r * 0.42, 0, 0, 6.28); ctx.stroke();
  ctx.globalAlpha = 0.18; ctx.fillStyle = '#ffd23f'; ctx.fill(); ctx.globalAlpha = 1;
  const h = 52 + Math.sin(g.time * 3) * 6;
  ctx.beginPath(); ctx.moveTo(m.x, m.y - h); ctx.lineTo(m.x - 14, m.y - h + 16); ctx.lineTo(m.x + 14, m.y - h + 16); ctx.closePath(); ctx.fill();
  ctx.shadowBlur = 0;
  if (g.side && g.side.kind === 'race') {
    const cp = g.side.checkpoints[g.side.cp];
    if (cp) {
      ctx.strokeStyle = '#31e0ff'; ctx.lineWidth = 5; ctx.shadowColor = '#31e0ff'; ctx.shadowBlur = 16;
      ctx.beginPath(); ctx.arc(cp.x, cp.y, 40, 0, 6.28); ctx.stroke(); ctx.shadowBlur = 0;
    }
  }
}

function drawVehicle(ctx, v, g, dark) {
  const spec = v.spec || VEHICLE_TYPES.compact;
  ctx.save(); ctx.translate(v.x, v.y); ctx.rotate(v.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.roundRect(-spec.w / 2 + 4, -spec.h / 2 + 5, spec.w, spec.h, 6); ctx.fill();
  ctx.fillStyle = v.color;
  ctx.beginPath(); ctx.roundRect(-spec.w / 2, -spec.h / 2, spec.w, spec.h, 6); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath(); ctx.roundRect(-spec.w / 6, -spec.h / 2 + 3, spec.w / 2.4, spec.h - 6, 4); ctx.fill();
  ctx.fillStyle = '#bcd6ea';
  ctx.fillRect(spec.w / 8, -spec.h / 2 + 3, spec.w / 5, spec.h - 6);
  // Headlights and tail lights.
  ctx.fillStyle = '#fff6c8'; ctx.shadowColor = '#fff2b0'; ctx.shadowBlur = dark * 12;
  ctx.fillRect(spec.w / 2 - 4, -spec.h / 2 + 2, 4, 5); ctx.fillRect(spec.w / 2 - 4, spec.h / 2 - 7, 4, 5);
  ctx.shadowBlur = 0; ctx.fillStyle = '#ff4d4d';
  ctx.fillRect(-spec.w / 2, -spec.h / 2 + 2, 3, 5); ctx.fillRect(-spec.w / 2, spec.h / 2 - 7, 3, 5);
  if (v.type === 'taxi') {
    ctx.fillStyle = '#1a1a1a'; ctx.fillRect(-3, -12, 14, 5);
    ctx.fillStyle = '#f2c531'; ctx.fillRect(-2, -11, 12, 3);
  }
  if (v.siren) {
    const on = Math.sin(v.flash) > 0;
    const c = on ? '#ff3b3b' : '#3b7bff';
    ctx.fillStyle = c; ctx.shadowColor = c; ctx.shadowBlur = 18;
    ctx.fillRect(-3, -7, 6, 14); ctx.shadowBlur = 0;
  }
  if (v.health < 60 && g.rng && Math.sin(g.time * 12) > 0.6) {
    g.effects.smoke(v.x, v.y - 8);
  }
  ctx.restore();
}

function drawPerson(ctx, x, y, angle, clothes, skin, phase, dark, gun) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle + Math.PI / 2);
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(3, 5, 10, 5, 0, 0, 6.28); ctx.fill();
  const sway = Math.sin(phase) * 2;
  ctx.fillStyle = '#2b3448';
  ctx.fillRect(-5 + sway, 4, 4, 8); ctx.fillRect(2 - sway, 4, 4, 8);
  ctx.fillStyle = clothes; ctx.beginPath(); ctx.roundRect(-7, -7, 14, 14, 4); ctx.fill();
  ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(0, -10, 5.5, 0, 6.28); ctx.fill();
  ctx.fillStyle = '#2a2320'; ctx.beginPath(); ctx.arc(0, -11, 5.5, Math.PI, 0); ctx.fill();
  if (gun) {
    ctx.fillStyle = '#20242e'; ctx.fillRect(3, -3, 15, 4);
    ctx.fillStyle = '#3a4150'; ctx.fillRect(3, -5, 6, 3);
  }
  ctx.restore();
}

function drawActors(ctx, g, dark) {
  for (const p of g.peds.peds) {
    if (p.dead) {
      ctx.fillStyle = 'rgba(120,40,40,0.6)'; ctx.beginPath(); ctx.ellipse(p.x, p.y, 9, 5, 0.4, 0, 6.28); ctx.fill(); continue;
    }
    drawPerson(ctx, p.x, p.y, p.angle, p.panic > 0 ? '#ff6b6b' : p.clothes, p.skin, p.phase, dark, false);
    if (p.panic > 0) {
      ctx.fillStyle = '#ffd23f'; ctx.font = '700 14px system-ui, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('!', p.x, p.y - 20);
    }
  }
  for (const o of g.police.officers) {
    if (o.dead) { ctx.fillStyle = 'rgba(40,50,80,0.6)'; ctx.beginPath(); ctx.ellipse(o.x, o.y, 9, 5, 0.4, 0, 6.28); ctx.fill(); continue; }
    drawPerson(ctx, o.x, o.y, o.angle, '#20408a', '#e2b18a', o.phase, dark, true);
    ctx.fillStyle = Math.sin(g.time * 8) > 0 ? '#ff3b3b' : '#3b7bff';
    ctx.fillRect(o.x - 2, o.y - 22, 4, 4);
  }
  if (!g.player.inVehicle) {
    drawPerson(ctx, g.player.x, g.player.y, g.player.aimAngle, COLORS.player, COLORS.skin, g.time * 6, dark, true);
    if (g.player.armour > 0) {
      ctx.strokeStyle = 'rgba(74,168,224,0.6)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(g.player.x, g.player.y, 14, 0, 6.28); ctx.stroke();
    }
  }
}

function drawProjectiles(ctx, g, dark) {
  ctx.lineCap = 'round';
  for (const b of g.combat.bullets) {
    ctx.strokeStyle = b.enemy ? '#ff8a5c' : '#fff3b0'; ctx.lineWidth = 2.5;
    ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - b.vx * 0.012, b.y - b.vy * 0.012); ctx.stroke();
  }
  ctx.shadowBlur = 0;
}

function drawParticles(ctx, g) {
  for (const m of g.effects.marks) {
    ctx.globalAlpha = Math.min(1, m.life / 6) * 0.5; ctx.strokeStyle = '#0b0d12'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(m.x - Math.cos(m.angle) * 12, m.y - Math.sin(m.angle) * 12); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  for (const p of g.effects.particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillStyle = p.color;
    if (p.glow) { ctx.shadowColor = p.color; ctx.shadowBlur = 8; }
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, 6.28); ctx.fill(); ctx.shadowBlur = 0;
  }
  ctx.globalAlpha = 1;
}

export function render(ctx, g) {
  const W = FIELD.width, H = FIELD.height;
  const dark = darkness(g);
  // Sky/ground base before the world transform.
  const sky = dark > 0.5 ? '#0b1020' : '#8fb6cf';
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
  const v = visible(g);
  beginWorld(ctx, g);
  drawGround(ctx, g, v);
  drawRoads(ctx, g, v);
  drawProps(ctx, g, v, dark);
  drawBuildings(ctx, g, v, dark);
  drawMarker(ctx, g, v, dark);
  drawParticles(ctx, g);
  for (const veh of g.vehicles.vehicles) drawVehicle(ctx, veh, g, dark);
  drawActors(ctx, g, dark);
  drawProjectiles(ctx, g, dark);
  // Night tint with a cool vignette.
  if (dark > 0.05) {
    ctx.fillStyle = `rgba(9,14,34,${dark * 0.5})`; ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);
    const grd = ctx.createRadialGradient(g.camera.x, g.camera.y, 180, g.camera.x, g.camera.y, 900);
    grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(1, `rgba(0,0,0,${dark * 0.35})`);
    ctx.fillStyle = grd; ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);
  }
  ctx.restore();

  if (g.rain) {
    ctx.strokeStyle = 'rgba(180,210,255,0.25)'; ctx.lineWidth = 1;
    for (let i = 0; i < 90; i += 1) {
      const x = (i * 137 + g.time * 420) % W, y = (i * 91 + g.time * 700) % H;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 4, y + 14); ctx.stroke();
    }
  }
  if (g.hitFlash > 0) { ctx.fillStyle = `rgba(200,30,30,${g.hitFlash * 0.4})`; ctx.fillRect(0, 0, W, H); }
  drawHUD(ctx, g);
}
