// Smooth follow camera with velocity look-ahead and decaying screen shake.

import { FIELD } from './config.js';

export function createCamera() {
  return { x: 0, y: 0, shake: 0, ox: 0, oy: 0, zoom: 1.2 };
}

export function updateCamera(cam, g, dt) {
  const p = g.player;
  const focus = p.inVehicle ? p.vehicle : p;
  const lead = p.inVehicle ? 0.6 : 0.35;
  const tx = focus.x + (focus.vx || focus.speed * Math.cos(focus.angle) || 0) * lead;
  const ty = focus.y + (focus.vy || focus.speed * Math.sin(focus.angle) || 0) * lead;
  const k = Math.min(1, dt * 4.5);
  cam.x += (tx - cam.x) * k;
  cam.y += (ty - cam.y) * k;
  cam.shake = Math.max(0, cam.shake - dt * 26);
  cam.ox = (Math.random() - 0.5) * cam.shake;
  cam.oy = (Math.random() - 0.5) * cam.shake;
}

export function addShake(cam, amount) { cam.shake = Math.min(24, cam.shake + amount); }

export function worldToScreen(cam, x, y) {
  return { x: x - cam.x + FIELD.width / 2 + cam.ox, y: y - cam.y + FIELD.height / 2 + cam.oy };
}
