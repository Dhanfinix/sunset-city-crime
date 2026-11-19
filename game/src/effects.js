// Particles, muzzle flashes, tyre marks, rain and camera shake - all drawn in code.
import { PALETTE } from './config.js';

export function createEffects() {
  const particles = [];
  const marks = [];
  let shake = 0;

  function push(x, y, vx, vy, life, color, size, gravity = 0) {
    particles.push({ x, y, vx, vy, life, max: life, color, size, gravity });
  }
  return {
    particles, marks,
    get shake() { return shake; },
    addShake(v) { shake = Math.min(22, shake + v); },
    sparks(x, y, n = 6) {
      for (let i = 0; i < n; i += 1) {
        const a = Math.random() * Math.PI * 2, s = 40 + Math.random() * 140;
        push(x, y, Math.cos(a) * s, Math.sin(a) * s, 0.25 + Math.random() * 0.3, PALETTE.neonGold, 2 + Math.random() * 2);
      }
      this.addShake(2);
    },
    muzzle(x, y, angle) {
      push(x, y, Math.cos(angle) * 30, Math.sin(angle) * 30, 0.09, PALETTE.neonGold, 9);
      for (let i = 0; i < 4; i += 1) {
        const a = angle + (Math.random() - 0.5) * 0.8;
        push(x, y, Math.cos(a) * 120, Math.sin(a) * 120, 0.18, '#ffb347', 3);
      }
      this.addShake(1.5);
    },
    smoke(x, y, n = 1) {
      for (let i = 0; i < n; i += 1) push(x, y, (Math.random() - 0.5) * 20, -20 - Math.random() * 20, 0.9 + Math.random() * 0.6, 'rgba(180,185,195,0.5)', 6 + Math.random() * 6);
    },
    blood(x, y) {
      for (let i = 0; i < 10; i += 1) {
        const a = Math.random() * Math.PI * 2, s = 30 + Math.random() * 90;
        push(x, y, Math.cos(a) * s, Math.sin(a) * s, 0.5, '#b8324a', 2 + Math.random() * 3);
      }
    },
    tyre(x, y, angle) {
      marks.push({ x, y, angle, life: 6 });
      if (marks.length > 300) marks.shift();
    },
    update(dt) {
      shake *= Math.pow(0.02, dt);
      for (let i = particles.length - 1; i >= 0; i -= 1) {
        const p = particles[i];
        p.life -= dt;
        if (p.life <= 0) { particles.splice(i, 1); continue; }
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.vy += p.gravity * dt;
        p.vx *= 0.96; p.vy *= 0.96;
      }
      for (let i = marks.length - 1; i >= 0; i -= 1) {
        marks[i].life -= dt;
        if (marks[i].life <= 0) marks.splice(i, 1);
      }
    },
    draw(ctx, cam) {
      ctx.save();
      for (const m of marks) {
        ctx.globalAlpha = Math.min(0.5, m.life / 6 * 0.5);
        ctx.fillStyle = '#15171c';
        ctx.save(); ctx.translate(m.x, m.y); ctx.rotate(m.angle);
        ctx.fillRect(-7, -2, 14, 4); ctx.restore();
      }
      ctx.globalAlpha = 1;
      for (const p of particles) {
        ctx.globalAlpha = Math.max(0, Math.min(1, p.life / p.max));
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    },
    drawRain(ctx, cam, enabled, time) {
      if (!enabled) return;
      ctx.save();
      ctx.strokeStyle = 'rgba(170,205,240,0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < 160; i += 1) {
        const x = (i * 137 + time * 620) % (cam.width + 200) - 100;
        const y = (i * 271 + time * 1100) % (cam.height + 100) - 50;
        ctx.moveTo(x, y); ctx.lineTo(x - 6, y + 18);
      }
      ctx.stroke();
      ctx.restore();
    },
  };
}
