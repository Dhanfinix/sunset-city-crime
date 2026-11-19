// SUNSET BAY — game state and the one update function that advances every system.

import { FIELD, DAY_LENGTH, VEHICLE_TYPES, CELL, WORLD, SAVE_KEY } from './config.js';
import { createRandom } from './random.js';
import { createWorld } from './world.js';
import { createPeds, updatePeds, panicNear } from './entities.js';
import { createVehicles, updateTraffic, updateDrivenVehicle, enterVehicle, exitVehicle, nearestVehicle, createVehicle } from './vehicles.js';
import { createPolice, updatePolice, addCrime } from './police.js';
import { createMissions, updateMissions, currentMarker } from './missions.js';
import { createCombat, updateCombat, playerShoot, playerMelee, startReload } from './combat.js';
import { createEffects } from './effects.js';
import { createCamera, updateCamera, addShake } from './camera.js';
import { createAudio } from './audio.js';
import { ACTIONS } from './input.js';

export function createGame(seed = 1) {
  const rng = createRandom(seed);
  const world = createWorld(rng);
  const g = {
    seed, rng, world, time: 0, dayPhase: 0.78,
    player: {
      x: 5 * CELL + CELL / 2, y: 5 * CELL + CELL / 2, aimAngle: -Math.PI / 4,
      health: 100, armour: 100, inVehicle: false, vehicle: null, hidden: false, vx: 0, vy: 0,
    },
    vehicles: createVehicles(world, rng),
    peds: createPeds(world, rng),
    police: createPolice(),
    mission: createMissions(),
    combat: createCombat(),
    effects: createEffects(),
    camera: createCamera(),
    audio: createAudio(),
    stats: { carsStolen: 0, copsDown: 0, racesWon: 0, missionsPassed: 0, crimes: 0 },
    notifications: [], markers: [], nearVehicle: null, mapOpen: false,
    rain: false, hitFlash: 0, dead: false, busted: false, shotMode: null,
    crimePos: { x: 0, y: 0 }, input: null,
  };
  // Convenience methods bound to this game instance.
  g.effects.sparks = (x, y) => importSparks(g.effects, x, y);
  g.effects.burst = (x, y, c, n) => importBurst(g.effects, x, y, c, n);
  g.effects.muzzle = (x, y, a) => importMuzzle(g.effects, x, y, a);
  g.effects.smoke = (x, y) => importSmoke(g.effects, x, y);
  g.effects.addTyre = (x, y, a) => importTyre(g.effects, x, y, a);

  g.notify = (text) => {
    g.notifications.push({ text, t: 3.2 });
    if (g.notifications.length > 6) g.notifications.shift();
  };
  g.crime = (type, x, y, severity = 1) => {
    g.crimePos = { x, y };
    g.stats.crimes += 1;
    if (type === 'vehicle theft') g.stats.carsStolen += 1;
    panicNear(g.peds, x, y, 240);
    addCrime(g.police, severity, x, y);
  };
  g.wasted = () => {
    if (g.dead) return;
    g.dead = true; g.audio.crash();
    g.effects.burst(g.player.x, g.player.y, '#ff5a3c', 30);
    addShake(g.camera, 18);
  };
  g.bust = () => {
    if (g.busted) return;
    g.busted = true; g.notify('BUSTED!');
    addShake(g.camera, 10);
  };
  g.respawn = () => {
    g.player.x = 5 * CELL + CELL / 2; g.player.y = 5 * CELL + CELL / 2;
    g.player.health = 100; g.player.armour = 50;
    g.player.inVehicle = false; g.player.vehicle = null;
    g.police.stars = 0; g.police.units.length = 0; g.police.officers.length = 0;
    g.dead = false; g.busted = false;
    g.combat.clip = VEHICLE_TYPES ? 12 : 12; g.combat.reserve = 90;
    g.notify('Back on the street.');
  };
  g.startTaxi = () => {
    const x = rng.range(CELL, WORLD - CELL), y = rng.range(CELL, WORLD - CELL);
    g.side = { kind: 'taxi', tx: x, ty: y, x, y };
    g.notify('New fare: pick up the passenger.');
  };
  return g;
}

// Tiny local wrappers keep effects.js free of cross-module imports.
import { sparks as importSparks, burst as importBurst, muzzle as importMuzzle, smoke as importSmoke, addTyre as importTyre } from './effects.js';

export function playerWorldAim(g) {
  const m = g.input.mouse;
  return Math.atan2(g.camera.y + (m.y - FIELD.height / 2) - g.player.y,
    g.camera.x + (m.x - FIELD.width / 2) - g.player.x);
}

export function updateGame(g, dt, input) {
  g.input = input;
  if (g.dead || g.busted || g.mapOpen) {
    g.time += dt;
    updateCamera(g.camera, g, dt);
    return;
  }
  g.time += dt;
  g.dayPhase = (g.dayPhase + dt / DAY_LENGTH) % 1;
  g.hitFlash = Math.max(0, g.hitFlash - dt * 2);
  g.audio.music(g.time);

  const actions = input.takeActions();
  if (actions & ACTIONS.ENTER) {
    if (g.player.inVehicle) exitVehicle(g);
    else if (g.nearVehicle) enterVehicle(g, g.nearVehicle);
  }
  if (actions & ACTIONS.RELOAD) startReload(g);
  if (actions & ACTIONS.MAP) g.mapOpen = !g.mapOpen;
  if (actions & ACTIONS.NIGHT) g.dayPhase = (g.dayPhase + 0.5) % 1;
  if (actions & ACTIONS.MUTE) g.audio.toggleMute();

  g.player.aimAngle = playerWorldAim(g);
  if (g.player.inVehicle) {
    const v = g.player.vehicle;
    updateDrivenVehicle(v, g, input, dt);
    g.player.x = v.x; g.player.y = v.y;
    g.player.vx = Math.cos(v.angle) * v.speed; g.player.vy = Math.sin(v.angle) * v.speed;
    g.audio.setEngine(v.speed, true);
  } else {
    const move = input.move();
    const speed = input.sprint() ? 250 : 150;
    const nx = g.player.x + move.x * speed * dt;
    const ny = g.player.y + move.y * speed * dt;
    if (!g.world.blocked(nx, g.player.y)) g.player.x = nx;
    if (!g.world.blocked(g.player.x, ny)) g.player.y = ny;
    g.player.vx = move.x * speed; g.player.vy = move.y * speed;
    g.audio.setEngine(0, false);
    if (input.isDown('KeyF')) playerMelee(g, g.player.aimAngle);
    if (input.mouse.down) playerShoot(g, g.player.aimAngle);
  }

  g.nearVehicle = g.player.inVehicle ? null : nearestVehicle(g.vehicles, g.player.x, g.player.y, 74);

  // Hidden from the police when no unit is close and the player is off the streets a bit.
  if (g.police.stars > 0) {
    let nearest = Infinity;
    for (const u of g.police.units) nearest = Math.min(nearest, Math.hypot(u.x - g.player.x, u.y - g.player.y));
    for (const o of g.police.officers) if (!o.dead) nearest = Math.min(nearest, Math.hypot(o.x - g.player.x, o.y - g.player.y));
    g.player.hidden = nearest > (g.player.inVehicle ? 420 : 300);
  } else g.player.hidden = true;

  updateTraffic(g.vehicles, g, dt);
  updatePeds(g.peds, g, dt);
  updatePolice(g.police, g, dt);
  updateCombat(g, dt);
  updateMissions(g, dt);
  updateEffectsLocal(g, dt);
  updateCamera(g.camera, g, dt);
  g.audio.setSiren(g.police.stars > 0 && g.police.units.length > 0, g.time);

  for (let i = g.notifications.length - 1; i >= 0; i -= 1) {
    g.notifications[i].t -= dt;
    if (g.notifications[i].t <= 0) g.notifications.splice(i, 1);
  }
  const marker = currentMarker(g.mission);
  g.markers = marker ? [marker] : [];

  // Clean up wrecked police cars.
  for (let i = g.police.units.length - 1; i >= 0; i -= 1) {
    const u = g.police.units[i];
    if (u.health <= 0) {
      g.effects.burst(u.x, u.y, '#ff8a3c', 18);
      g.stats.copsDown += 1;
      g.notify('Patrol car down!');
      const vi = g.vehicles.vehicles.indexOf(u);
      if (vi >= 0) g.vehicles.vehicles.splice(vi, 1);
      g.police.units.splice(i, 1);
    }
  }
}

function updateEffectsLocal(g, dt) {
  const e = g.effects;
  for (let i = e.particles.length - 1; i >= 0; i -= 1) {
    const p = e.particles[i];
    p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.96; p.vy *= 0.96; p.life -= dt;
    if (p.life <= 0) e.particles.splice(i, 1);
  }
  for (let i = e.marks.length - 1; i >= 0; i -= 1) { e.marks[i].life -= dt; if (e.marks[i].life <= 0) e.marks.splice(i, 1); }
}

// Deterministic, rich scenes for ?shot=cover|foot|drive|chase.
export function setupShot(g, name) {
  const r = createRandom(1337);
  g.shotMode = name;
  g.dayPhase = name === 'drive' ? 0.42 : 0.98; // night for cover/foot/chase, dusk for drive
  g.camera.x = g.player.x; g.camera.y = g.player.y;
  g.notifications = []; g.hitFlash = 0;

  if (name === 'foot') {
    g.player.x = 9 * CELL + 128; g.player.y = 4 * CELL + 128;
    g.player.aimAngle = 2.4; g.police.stars = 2;
    g.effects.muzzle(g.player.x + Math.cos(2.4) * 20, g.player.y + Math.sin(2.4) * 20, 2.4);
    g.effects.burst(g.player.x + 40, g.player.y - 20, '#ffcf5e', 12);
  } else {
    // Driving scenes. Put the player on a wide boulevard at speed.
    const car = createVehicle(r, 'sports', 6 * CELL + 34, 6 * CELL + 200, 'h', 1, '#e8443c');
    car.speed = name === 'drive' ? 250 : 190;
    car.stolen = true;
    g.vehicles.vehicles.push(car);
    g.player.vehicle = car; g.player.inVehicle = true;
    g.player.x = car.x; g.player.y = car.y;
    g.police.stars = name === 'cover' ? 5 : name === 'chase' ? 4 : 0;
    g.effects.muzzle(car.x + 30, car.y, 0);
    g.effects.burst(car.x - 20, car.y + 10, '#ffcf5e', 14);
    g.effects.addTyre(car.x - 12, car.y + 8, 0);
  }

  if (g.police.stars > 0) {
    const count = name === 'cover' ? 5 : name === 'chase' ? 4 : 2;
    for (let i = 0; i < count; i += 1) {
      const a = (i / count) * Math.PI * 2 + 0.6;
      const rad = 190 + i * 46;
      const x = Math.max(CELL, Math.min(WORLD - CELL, g.player.x + Math.cos(a) * rad));
      const y = Math.max(CELL, Math.min(WORLD - CELL, g.player.y + Math.sin(a) * rad));
      const u = createVehicle(r, 'police', x, y, 'h', 1, '#dfe6f2');
      u.siren = true; u.flash = i * 1.3; u.speed = 120;
      u.angle = Math.atan2(g.player.y - y, g.player.x - x);
      g.police.units.push(u); g.vehicles.vehicles.push(u);
    }
    for (let i = 0; i < Math.min(3, g.police.stars); i += 1) {
      g.police.officers.push({ x: g.player.x + 70 + i * 34, y: g.player.y - 90 + i * 20, angle: 2.2, phase: i, fire: 0.5, dead: false });
    }
  }

  g.player.money = 12450;
  g.combat.clip = 9; g.combat.reserve = 78;
  g.mission.step = 1; // show a location objective alongside the chase
  g.notifications.push({ text: name === 'cover' ? 'WANTED — 5 STARS' : 'MISSION ACTIVE', t: 3.2 });
  if (name === 'cover') g.notifications.push({ text: 'MISSION PASSED  +$500', t: 3.2 });
  g.markers = [{ x: g.player.x + 230, y: g.player.y - 150, label: 'Reach the safehouse', radius: 84 }];
  g.camera.x = g.player.x; g.camera.y = g.player.y;
  return g;
}

export function tickShot(g, dt) {
  g.time += dt;
  for (const u of g.police.units) u.flash += dt * 9;
  const e = g.effects;
  for (let i = e.particles.length - 1; i >= 0; i -= 1) {
    const p = e.particles[i];
    p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.97; p.vy *= 0.97; p.life -= dt;
    if (p.life <= 0) e.particles.splice(i, 1);
  }
  // Re-seed a few flashes so the frozen chase still crackles.
  if (g.rng.chance(dt * 6) && g.police.stars > 0) {
    g.effects.sparks(g.player.x + g.rng.range(-60, 60), g.player.y + g.rng.range(-40, 40));
  }
}

export function saveGame(g) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      money: g.player.money, health: g.player.health, armour: g.player.armour,
      missionIndex: g.mission.index, stats: g.stats, dayPhase: g.dayPhase,
    }));
    return true;
  } catch { return false; }
}

export function loadGame(g) {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const d = JSON.parse(raw);
    g.player.money = d.money ?? g.player.money;
    g.player.health = d.health ?? 100;
    g.player.armour = d.armour ?? 100;
    g.mission.index = d.missionIndex ?? 0;
    g.stats = { ...g.stats, ...(d.stats || {}) };
    g.dayPhase = d.dayPhase ?? g.dayPhase;
    return true;
  } catch { return false; }
}

export function hasSave() {
  try { return !!window.localStorage.getItem(SAVE_KEY); } catch { return false; }
}
