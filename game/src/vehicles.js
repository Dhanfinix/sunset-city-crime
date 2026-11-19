// Vehicles: original classes, lane-following traffic, and the physics used when the player drives.

import { CELL, GRID, WORLD, TRAFFIC_COLORS, VEHICLE_TYPES } from './config.js';

export function createVehicle(rng, type, x, y, axis, dir, color) {
  const spec = VEHICLE_TYPES[type] || VEHICLE_TYPES.compact;
  return {
    type, spec, x, y, angle: axis === 'h' ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2),
    axis, dir, speed: spec.top * 0.45, vx: 0, vy: 0, steer: 0,
    color: color || rng.pick(TRAFFIC_COLORS), damage: 0,
    health: 100, occupant: null, siren: false, flash: 0,
    wobble: rng.range(0, 6.28),
  };
}

export function createVehicles(world, rng) {
  const vehicles = [];
  const types = ['compact', 'sedan', 'taxi', 'sports', 'van', 'truck'];
  for (let n = 0; n < 30; n += 1) {
    const axis = rng.chance(0.5) ? 'h' : 'v';
    const line = rng.int(0, GRID) * CELL;
    const along = rng.range(CELL, WORLD - CELL);
    const lane = (rng.chance(0.5) ? 1 : -1) * 17;
    const x = axis === 'h' ? along : line + lane;
    const y = axis === 'h' ? line + lane : along;
    if (world.blocked(x, y)) continue;
    vehicles.push(createVehicle(rng, rng.pick(types), x, y, axis, rng.chance(0.5) ? 1 : -1));
  }
  return { vehicles };
}

// Advance one traffic car along its lane, turning at intersections and braking for the player.
function driveTraffic(v, g, dt) {
  const target = v.spec.top * (0.42 + 0.16 * Math.sin(g.time * 0.3 + v.wobble));
  const pv = g.player.vehicle;
  let brake = 1;
  if (pv && !g.player.inVehicle) {
    const d = Math.hypot(pv.x - v.x, pv.y - v.y);
    if (d < 130) {
      const ahead = ((pv.x - v.x) * Math.cos(v.angle) + (pv.y - v.y) * Math.sin(v.angle));
      if (ahead > 0) brake = 0.25;
    }
  }
  const want = target * brake;
  v.speed += (want - v.speed) * Math.min(1, dt * 2.2);

  const step = v.speed * v.dir * dt;
  if (v.axis === 'h') v.x += step; else v.y += step;
  if (v.x < -100) v.x = WORLD + 100;
  if (v.x > WORLD + 100) v.x = -100;
  if (v.y < -100) v.y = WORLD + 100;
  if (v.y > WORLD + 100) v.y = -100;

  // At a crossing, sometimes turn onto the perpendicular road.
  const cross = v.axis === 'h' ? v.x : v.y;
  const nearCross = Math.abs(cross / CELL - Math.round(cross / CELL)) * CELL < 6;
  if (nearCross && g.rng.chance(dt * 1.4)) {
    v.axis = v.axis === 'h' ? 'v' : 'h';
    if (v.axis === 'h') { v.y = Math.round(v.y / CELL) * CELL + (v.dir > 0 ? 17 : -17); }
    else { v.x = Math.round(v.x / CELL) * CELL + (v.dir > 0 ? -17 : 17); }
    v.angle = v.axis === 'h' ? (v.dir > 0 ? 0 : Math.PI) : (v.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
  }
  v.angle = v.axis === 'h' ? (v.dir > 0 ? 0 : Math.PI) : (v.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
}

export function updateTraffic(system, g, dt) {
  for (const v of system.vehicles) {
    if (v.siren) continue; // police run their own steering
    driveTraffic(v, g, dt);
  }
}

// Free-form physics for the car the player is driving.
export function updateDrivenVehicle(v, g, input, dt) {
  const move = input ? input.move() : { x: 0, y: 0 };
  const gas = input && (input.isDown('KeyW') || input.isDown('ArrowUp'));
  const brake = input && (input.isDown('KeyS') || input.isDown('ArrowDown'));
  const steerInput = gas || brake ? move.x : 0;
  const spec = v.spec;

  if (gas) v.speed += spec.accel * dt;
  else if (brake) v.speed -= spec.brake * dt;
  else v.speed -= Math.sign(v.speed) * Math.min(Math.abs(v.speed), 46 * dt);
  v.speed = Math.max(-spec.top * 0.35, Math.min(spec.top, v.speed));

  const turnRate = spec.turn * Math.min(1, Math.abs(v.speed) / 60);
  v.angle += steerInput * turnRate * dt * Math.sign(v.speed || 1);
  v.steer = steerInput;

  const nx = v.x + Math.cos(v.angle) * v.speed * dt;
  const ny = v.y + Math.sin(v.angle) * v.speed * dt;
  if (!g.world.blocked(nx, v.y)) v.x = nx;
  else { v.speed *= -0.25; v.damage += Math.abs(v.speed) * 0.05; v.health -= Math.abs(v.speed) * 0.12; }
  if (!g.world.blocked(v.x, ny)) v.y = ny;
  else { v.speed *= -0.25; v.damage += Math.abs(v.speed) * 0.05; v.health -= Math.abs(v.speed) * 0.12; }

  // Tyre marks and collision sparks while drifting hard.
  if (Math.abs(steerInput) > 0.4 && Math.abs(v.speed) > 110) {
    g.effects.addTyre(v.x - Math.cos(v.angle) * 14, v.y - Math.sin(v.angle) * 14, v.angle);
    g.effects.addTyre(v.x + Math.cos(v.angle) * 14, v.y + Math.sin(v.angle) * 14, v.angle);
  }
  if (v.health <= 0) {
    g.effects.burst(v.x, v.y, '#ff9a3c', 26);
    g.notify('Vehicle wrecked!');
    exitVehicle(g);
  }
}

export function enterVehicle(g, v) {
  if (!v || g.player.inVehicle) return false;
  g.player.inVehicle = true;
  g.player.vehicle = v;
  v.occupant = 'player';
  if (v.siren) return true;
  if (!v.stolen) {
    v.stolen = true;
    g.crime('vehicle theft', v.x, v.y, 1);
    g.notify('Carjacking! Wanted level up.');
  }
  return true;
}

export function exitVehicle(g) {
  const v = g.player.vehicle;
  if (!v) return;
  const ox = v.x + Math.cos(v.angle + Math.PI / 2) * 34;
  const oy = v.y + Math.sin(v.angle + Math.PI / 2) * 34;
  if (!g.world.blocked(ox, oy)) { g.player.x = ox; g.player.y = oy; }
  g.player.inVehicle = false;
  g.player.vehicle = null;
  v.occupant = null;
  v.speed *= 0.4;
}

export function nearestVehicle(system, x, y, radius = 74) {
  let best = null, bd = radius;
  for (const v of system.vehicles) {
    const d = Math.hypot(v.x - x, v.y - y);
    if (d < bd) { bd = d; best = v; }
  }
  return best;
}
