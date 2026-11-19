// Wanted level 1-5, pursuit cruisers, foot officers, roadblocks, shootouts and arrests.
import { PALETTE, WORLD_SIZE } from './config.js';
import { createVehicle, drawVehicle } from './vehicles.js';

export function createPoliceManager(world, vehicles, rng) {
  const officers = [];
  const roadblocks = [];
  let stars = 0;
  let wanted = 0;
  let arrestProgress = 0;
  let lastSeen = 0;
  let spawnTimer = 0;
  let shootTimer = 0;

  function isHidden(player) {
    // A building line-of-sight break and time without crime make the wanted level decay.
    return world.solidAt(player.x + Math.cos(player.angle) * 30, player.y + Math.sin(player.angle) * 30);
  }

  return {
    officers, roadblocks,
    get stars() { return stars; },
    get wanted() { return wanted; },
    crime(x, y, severity = 1) {
      stars = Math.min(5, Math.max(stars, severity));
      wanted = Math.max(wanted, 22 + stars * 9);
      lastSeen = 0;
      for (const p of officers) if (Math.hypot(p.x - x, p.y - y) < 600) p.alert = 1;
    },
    setStars(n) { stars = Math.max(0, Math.min(5, n)); wanted = stars ? 30 + stars * 10 : 0; },
    clear() { stars = 0; wanted = 0; arrestProgress = 0; },

    update(dt, player, effects, audio) {
      if (wanted > 0) {
        wanted -= dt;
        if (isHidden(player)) wanted -= dt * 1.6;
        if (wanted <= 0) {
          stars = 0;
          for (const v of vehicles.vehicles) if (v.isPolice) v.ai = true;
          officers.length = 0;
          roadblocks.length = 0;
        }
      }
      lastSeen += dt;
      spawnTimer -= dt;
      if (stars > 0 && spawnTimer <= 0) {
        spawnTimer = Math.max(2.5, 7 - stars);
        this.spawnUnit(player);
      }

      // Pursuing cruisers steer straight at the player, ram, and shed smoke on impact.
      for (const v of vehicles.vehicles) {
        if (!v.isPolice) continue;
        const dx = player.x - v.x, dy = player.y - v.y;
        const dist = Math.hypot(dx, dy) || 1;
        let diff = ((Math.atan2(dy, dx) - v.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        v.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
        v.speed += Math.min(160 * dt, Math.max(0, 260 - v.speed));
        if (dist < 70) v.speed = Math.min(v.speed, 150);
        v.x += Math.cos(v.angle) * v.speed * dt;
        v.y += Math.sin(v.angle) * v.speed * dt;
        v.x = Math.max(20, Math.min(WORLD_SIZE - 20, v.x));
        v.y = Math.max(20, Math.min(WORLD_SIZE - 20, v.y));
        if (dist < 34 && v.speed > 60) {
          effects.sparks(v.x, v.y, 6);
          if (!player.inVehicle) player.health -= 4;
          else player.inVehicle.damage += 3;
        }
      }

      // Foot officers approach and fire when close.
      shootTimer -= dt;
      for (const o of officers) {
        const dx = player.x - o.x, dy = player.y - o.y;
        const dist = Math.hypot(dx, dy) || 1;
        o.angle = Math.atan2(dy, dx);
        if (dist > 60) {
          o.x += dx / dist * 70 * dt;
          o.y += dy / dist * 70 * dt;
        } else if (shootTimer <= 0 && stars >= 2) {
          shootTimer = 0.5 + rng.next() * 0.7;
          const hit = rng.chance(0.45);
          effects.muzzle(o.x, o.y, o.angle);
          if (audio) audio.shot(false);
          if (hit) {
            if (player.armour > 0) { player.armour -= 6; if (player.armour < 0) player.armour = 0; }
            else player.health -= 7;
            effects.sparks(player.x, player.y, 4);
          }
        }
        if (dist < 24 && !player.inVehicle && player.speed < 40) arrestProgress += dt;
      }

      // Roadblocks appear at 4-5 stars, just ahead of the player's heading.
      if (stars >= 4 && roadblocks.length < 2 && lastSeen > 4) {
        const bx = player.x + Math.cos(player.angle) * 420;
        const by = player.y + Math.sin(player.angle) * 420;
        const block = { x: bx, y: by, life: 16 };
        for (let i = -1; i <= 1; i += 1) {
          const v = createVehicle('cruiser', bx + Math.cos(player.angle + Math.PI / 2) * i * 46,
            by + Math.sin(player.angle + Math.PI / 2) * i * 46, player.angle + Math.PI / 2, { ai: false });
          vehicles.add(v);
          block.cars = block.cars || [];
          block.cars.push(v);
        }
        roadblocks.push(block);
        lastSeen = 0;
      }
      for (let i = roadblocks.length - 1; i >= 0; i -= 1) {
        roadblocks[i].life -= dt;
        if (roadblocks[i].life <= 0) {
          for (const v of roadblocks[i].cars || []) vehicles.remove(v);
          roadblocks.splice(i, 1);
        }
      }
    },

    spawnUnit(player) {
      const a = rng.next() * Math.PI * 2;
      const dist = 520 + rng.next() * 180;
      const x = Math.max(40, Math.min(WORLD_SIZE - 40, player.x + Math.cos(a) * dist));
      const y = Math.max(40, Math.min(WORLD_SIZE - 40, player.y + Math.sin(a) * dist));
      const car = createVehicle('cruiser', x, y, a, { ai: false });
      car.siren = true;
      vehicles.add(car);
      if (stars >= 2 && officers.length < stars + 1) {
        officers.push({ x: x + 30, y: y + 30, angle: a, alert: 1 });
      }
    },

    arrestReady() { return arrestProgress > 1.2; },
    resetArrest() { arrestProgress = 0; },

    drawOfficers(ctx, cam) {
      for (const o of officers) {
        if (Math.abs(o.x - cam.x) > cam.width / 2 || Math.abs(o.y - cam.y) > cam.height / 2) continue;
        ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(o.angle + Math.PI / 2);
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath(); ctx.ellipse(2, 4, 8, 4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#1c2f57';
        ctx.beginPath(); ctx.arcTo(-7, -9, 7, 10, 4); ctx.fill();
        ctx.beginPath(); ctx.rect(-7, -4, 14, 14); ctx.fill();
        ctx.fillStyle = '#e8c9a6'; ctx.beginPath(); ctx.arc(0, -12, 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#111827'; ctx.fillRect(-7, -18, 14, 4);
        ctx.fillStyle = PALETTE.neonCyan;
        ctx.shadowColor = PALETTE.neonCyan; ctx.shadowBlur = 10;
        ctx.fillRect(-4, 6, 8, 3);
        ctx.restore();
      }
    },
  };
}
