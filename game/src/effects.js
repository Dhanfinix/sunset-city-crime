// Particles, tyre marks, muzzle flashes and collisions — all drawn in code.

export function createEffects() {
  return { particles: [], marks: [] };
}

function push(e, p) { if (e.particles.length < 420) e.particles.push(p); }

export function spawnParticle(e, x, y, color, vx, vy, life, size, glow = false) {
  push(e, { x, y, vx, vy, life, max: life, color, size, glow });
}

export function burst(e, x, y, color, count) {
  for (let i = 0; i < count; i += 1) {
    const a = Math.random() * Math.PI * 2, s = 60 + Math.random() * 240;
    spawnParticle(e, x, y, color, Math.cos(a) * s, Math.sin(a) * s, 0.4 + Math.random() * 0.7, 2 + Math.random() * 4, true);
  }
}

export function sparks(e, x, y) { burst(e, x, y, '#ffcf5e', 7); }
export function smoke(e, x, y) {
  spawnParticle(e, x, y, 'rgba(180,190,205,0.45)', (Math.random() - 0.5) * 20, -20 - Math.random() * 20, 1.2, 8 + Math.random() * 10);
}

export function muzzle(e, x, y, angle) {
  for (let i = 0; i < 5; i += 1) {
    const a = angle + (Math.random() - 0.5) * 0.5, s = 180 + Math.random() * 180;
    spawnParticle(e, x, y, i === 0 ? '#fff6c8' : '#ffb43c', Math.cos(a) * s, Math.sin(a) * s, 0.12 + Math.random() * 0.1, 3 + Math.random() * 4, true);
  }
}

export function addTyre(e, x, y, angle) {
  if (e.marks.length > 900) e.marks.shift();
  e.marks.push({ x, y, angle, life: 6 });
}

export function updateEffects(e, dt) {
  for (let i = e.particles.length - 1; i >= 0; i -= 1) {
    const p = e.particles[i];
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vx *= 0.96; p.vy *= 0.96;
    p.life -= dt;
    if (p.life <= 0) e.particles.splice(i, 1);
  }
  for (let i = e.marks.length - 1; i >= 0; i -= 1) {
    e.marks[i].life -= dt;
    if (e.marks[i].life <= 0) e.marks.splice(i, 1);
  }
}

// Exposed as methods on the effects object for convenient calls from other modules.
export function attachEffects(e) {
  e.sparks = (x, y) => sparks(e, x, y);
  e.burst = (x, y, c, n) => burst(e, x, y, c, n);
  e.muzzle = (x, y, a) => muzzle(e, x, y, a);
  e.smoke = (x, y) => smoke(e, x, y);
  e.addTyre = (x, y, a) => addTyre(e, x, y, a);
  return e;
}
