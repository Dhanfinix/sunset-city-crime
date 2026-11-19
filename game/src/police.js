// Wanted level, pursuit AI, foot officers, roadblocks and busts.

import { CELL, GRID, WORLD, WANTED, VEHICLE_TYPES } from './config.js';
import { createVehicle } from './vehicles.js';

export function createPolice() {
  return {
    stars: 0, hiddenFor: 0, units: [], officers: [], roadblocks: [],
    fireTimer: 0, bustTimer: 0, spawnTimer: 0,
  };
}

export function addCrime(police, severity, x, y) {
  police.stars = Math.min(5, police.stars + severity);
  police.hiddenFor = 0;
  police.lastCrime = { x, y, t: 0 };
}

// Police cars steer toward the player with a little separation and a speed edge by star.
function driveUnit(u, g, dt) {
  const p = g.player;
  const px = p.x, py = p.y;
  const dx = px - u.x, dy = py - u.y;
  const dist = Math.hypot(dx, dy) || 1;
  const desired = Math.atan2(dy, dx);
  let diff = ((desired - u.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  u.angle += Math.max(-u.spec.turn, Math.min(u.spec.turn, diff * 2.2)) * dt;
  const aggression = WANTED.speeds[g.police.stars] || 1;
  const want = u.spec.top * Math.min(1, aggression) * (dist > 220 ? 1 : 0.8);
  u.speed += (want - u.speed) * Math.min(1, dt * 2.5);

  let nx = u.x + Math.cos(u.angle) * u.speed * dt;
  let ny = u.y + Math.sin(u.angle) * u.speed * dt;
  if (g.world.blocked(nx, u.y)) { u.angle += (g.rng.chance(0.5) ? 1 : -1) * 1.4; nx = u.x; }
  if (g.world.blocked(u.x, ny)) { u.angle += (g.rng.chance(0.5) ? 1 : -1) * 1.4; ny = u.y; }
  u.x = Math.max(10, Math.min(WORLD - 10, nx));
  u.y = Math.max(10, Math.min(WORLD - 10, ny));
  u.flash += dt * 9;

  if (dist < 46 && p.inVehicle) {
    u.health -= dt * 12;
    p.vehicle.health -= dt * 16;
    g.effects.sparks((u.x + px) / 2, (u.y + py) / 2);
  }
}

function spawnUnit(g) {
  const angle = g.rng.range(0, Math.PI * 2);
  const r = 480 + g.rng.range(0, 160);
  let x = g.player.x + Math.cos(angle) * r;
  let y = g.player.y + Math.sin(angle) * r;
  x = Math.max(CELL, Math.min(WORLD - CELL, x));
  y = Math.max(CELL, Math.min(WORLD - CELL, y));
  if (g.world.blocked(x, y)) { x = g.player.x + CELL; y = g.player.y; }
  const v = createVehicle(g.rng, 'police', x, y, 'h', 1, '#dfe6f2');
  v.siren = true;
  v.spec = VEHICLE_TYPES.police;
  g.police.units.push(v);
  g.vehicles.vehicles.push(v);
}

function spawnOfficer(g) {
  const angle = g.rng.range(0, Math.PI * 2);
  const x = g.player.x + Math.cos(angle) * 180;
  const y = g.player.y + Math.sin(angle) * 180;
  g.police.officers.push({ x, y, angle: 0, phase: g.rng.range(0, 6), fire: g.rng.range(0.5, 1.5), dead: false });
}

function spawnRoadblock(g) {
  const roadY = Math.round(g.player.y / CELL) * CELL;
  for (let lane = -1; lane <= 1; lane += 1) {
    const x = g.player.x + 340 + lane * 26;
    const y = roadY + lane * 4;
    if (g.world.blocked(x, y)) continue;
    const v = createVehicle(g.rng, 'police', x, y, 'v', 1, '#dfe6f2');
    v.siren = true; v.speed = 0; v.block = true;
    v.spec = VEHICLE_TYPES.police;
    g.police.units.push(v);
    g.vehicles.vehicles.push(v);
  }
}

export function updatePolice(system, g, dt) {
  if (system.stars <= 0) {
    system.hiddenFor = 0;
    // Retire units once the heat is gone.
    system.units.length = 0;
    system.officers.length = 0;
    system.roadblocks.length = 0;
    return;
  }
  const seen = !g.player.hidden;
  if (!seen) system.hiddenFor += dt;
  else system.hiddenFor = 0;
  if (system.hiddenFor > WANTED.decayHidden) {
    system.stars -= 1;
    system.hiddenFor = 0;
    g.notify('Lost the cops. Wanted level down.');
  }

  system.spawnTimer -= dt;
  const cap = system.stars + 1;
  if (system.spawnTimer <= 0 && system.units.length < cap) {
    spawnUnit(g);
    system.spawnTimer = Math.max(1.4, 4 - system.stars * 0.5);
  }
  if (system.stars >= 3 && system.officers.length < system.stars - 1 && g.rng.chance(dt * 0.4)) spawnOfficer(g);
  if (system.stars >= 4 && system.roadblocks.length === 0 && g.rng.chance(dt * 0.08)) {
    spawnRoadblock(g);
    system.roadblocks.push({ t: g.time });
    g.notify('Roadblock ahead!');
  }

  for (const u of system.units) {
    if (u.block) { u.flash += dt * 9; continue; }
    driveUnit(u, g, dt);
  }

  system.fireTimer -= dt;
  if (system.fireTimer <= 0 && (system.officers.length > 0 || system.units.length > 0)) {
    system.fireTimer = Math.max(0.25, 0.9 - system.stars * 0.12);
    const shooters = system.officers.filter((o) => !o.dead && Math.hypot(o.x - g.player.x, o.y - g.player.y) < 360);
    for (const o of shooters) {
      const a = Math.atan2(g.player.y - o.y, g.player.x - o.x) + g.rng.range(-0.12, 0.12);
      g.combat.enemyBullet(o.x, o.y, a);
    }
    // Occupied police cars fire too at higher heat.
    if (system.stars >= 2) {
      for (const u of system.units) {
        if (u.block) continue;
        const d = Math.hypot(u.x - g.player.x, u.y - g.player.y);
        if (d < 300 && g.rng.chance(0.5)) {
          const a = Math.atan2(g.player.y - u.y, g.player.x - u.x) + g.rng.range(-0.15, 0.15);
          g.combat.enemyBullet(u.x, u.y, a);
        }
      }
    }
  }

  for (const o of system.officers) {
    if (o.dead) continue;
    const dx = g.player.x - o.x, dy = g.player.y - o.y;
    const d = Math.hypot(dx, dy) || 1;
    o.angle = Math.atan2(dy, dx);
    o.phase += dt * 9;
    if (d > 60 && !g.world.blocked(o.x + dx / d * 60 * dt, o.y + dy / d * 60 * dt)) {
      o.x += dx / d * 60 * dt; o.y += dy / d * 60 * dt;
    }
  }

  // Bust when on foot and surrounded.
  system.bustTimer -= dt;
  const near = system.officers.filter((o) => !o.dead && Math.hypot(o.x - g.player.x, o.y - g.player.y) < 34).length;
  if (!g.player.inVehicle && near > 0 && system.bustTimer <= 0) {
    system.bustTimer = 3;
    g.bust();
  }
}
