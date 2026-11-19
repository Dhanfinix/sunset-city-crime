// Pedestrians and the on-foot player figure. Peds stroll the sidewalks and panic at crimes.

import { CELL, ROAD, WORLD, PLAYER_STATS } from './config.js';

const SKIN = ['#e2b18a', '#c88d63', '#f0c39f', '#8d5a3c', '#d9a37c'];
const CLOTHES = ['#c94f6d', '#4f8ac9', '#e0a23f', '#5aa879', '#8f6fc0', '#d9d2c0'];

export function createPed(rng, x, y) {
  return {
    x, y, angle: rng.range(0, Math.PI * 2), speed: rng.range(28, 52),
    skin: rng.pick(SKIN), clothes: rng.pick(CLOTHES), age: rng.range(0, 8),
    panic: 0, phase: rng.range(0, 6.28), dead: false,
  };
}

export function createPeds(world, rng) {
  const peds = [];
  for (let n = 0; n < 46; n += 1) {
    const vertical = rng.chance(0.5);
    const line = rng.int(1, 11) * CELL;
    const along = rng.range(ROAD, WORLD - ROAD);
    const lane = (rng.chance(0.5) ? 1 : -1) * (ROAD * 0.36);
    const x = vertical ? line + lane : along;
    const y = vertical ? along : line + lane;
    if (!world.blocked(x, y)) peds.push(createPed(rng, x, y));
  }
  return { peds };
}

function reroute(ped, world, rng) {
  const options = [0, Math.PI / 2, -Math.PI / 2, Math.PI];
  const choice = rng.pick(options);
  ped.angle = ped.phase > 0 ? choice : ped.angle + (rng.chance(0.5) ? 0.4 : -0.4);
  const nx = ped.x + Math.cos(ped.angle) * 22;
  const ny = ped.y + Math.sin(ped.angle) * 22;
  if (world.blocked(nx, ny) || world.isRoad(nx, ny)) ped.angle += Math.PI;
}

export function updatePeds(system, g, dt) {
  const { peds } = system;
  for (const ped of peds) {
    if (ped.dead) continue;
    ped.phase += dt * (ped.panic > 0 ? 11 : 5);
    let speed = ped.speed;
    let target = ped.angle;
    if (ped.panic > 0) {
      ped.panic -= dt;
      speed *= 2.4;
      // Run away from the last crime scene.
      const dx = ped.x - g.crimePos.x, dy = ped.y - g.crimePos.y;
      if (Math.hypot(dx, dy) > 1) target = Math.atan2(dy, dx);
    }
    const step = speed * dt;
    let nx = ped.x + Math.cos(target) * step;
    let ny = ped.y + Math.sin(target) * step;
    if (worldBlocked(g, nx, ny) || (ped.panic <= 0 && g.world.isRoad(nx, ny))) {
      reroute(ped, g.world, g.rng);
    } else {
      ped.x = nx; ped.y = ny; ped.angle = target;
    }
    if (g.rng.chance(dt * 0.25)) reroute(ped, g.world, g.rng);
  }
}

function worldBlocked(g, x, y) { return g.world.blocked(x, y); }

export function panicNear(system, x, y, radius) {
  for (const ped of system.peds) {
    if (Math.hypot(ped.x - x, ped.y - y) < radius) ped.panic = Math.max(ped.panic, 3 + Math.random() * 2);
  }
}
