// Shooting, melee, reload and damage for both sides.

import { PLAYER_STATS } from './config.js';

export function createCombat() {
  return { bullets: [], fireTimer: 0, reloadTimer: 0, clip: PLAYER_STATS.clip, reserve: PLAYER_STATS.ammo };
}

export function playerShoot(g, aimAngle) {
  const c = g.combat;
  if (g.player.inVehicle || g.dead || g.busted) return;
  if (c.reloadTimer > 0 || c.fireTimer > 0 || c.clip <= 0) return;
  c.fireTimer = PLAYER_STATS.fireDelay;
  c.clip -= 1;
  const sp = 900;
  c.bullets.push({ x: g.player.x + Math.cos(aimAngle) * 18, y: g.player.y + Math.sin(aimAngle) * 18,
    vx: Math.cos(aimAngle) * sp, vy: Math.sin(aimAngle) * sp, life: 0.9, enemy: false });
  g.effects.muzzle(g.player.x + Math.cos(aimAngle) * 20, g.player.y + Math.sin(aimAngle) * 20, aimAngle);
  g.audio.shot();
  g.crime('shooting', g.player.x, g.player.y, 1);
  if (c.clip <= 0) g.notify('Press R to reload.');
}

export function playerMelee(g, aimAngle) {
  if (g.player.inVehicle || g.dead) return;
  const reach = PLAYER_STATS.meleeRange;
  for (const ped of g.peds.peds) {
    const dx = ped.x - g.player.x, dy = ped.y - g.player.y;
    const d = Math.hypot(dx, dy);
    if (d < reach && Math.cos(aimAngle) * dx + Math.sin(aimAngle) * dy > 0) {
      ped.dead = true; g.effects.sparks(ped.x, ped.y); g.notify('Knocked out a pedestrian.'); g.crime('assault', ped.x, ped.y, 1);
    }
  }
  for (const o of g.police.officers) {
    if (o.dead) continue;
    const dx = o.x - g.player.x, dy = o.y - g.player.y;
    if (Math.hypot(dx, dy) < reach) { o.dead = true; g.effects.sparks(o.x, o.y); g.crime('assault on officer', o.x, o.y, 2); }
  }
  g.audio.punch();
}

export function startReload(g) {
  const c = g.combat;
  if (c.reloadTimer > 0 || c.clip >= PLAYER_STATS.clip || c.reserve <= 0) return;
  c.reloadTimer = PLAYER_STATS.reloadTime;
  g.notify('Reloading…');
}

export function damagePlayer(g, amount) {
  if (g.dead || g.busted) return;
  const p = g.player;
  if (p.armour > 0) {
    const absorbed = Math.min(p.armour, amount);
    p.armour -= absorbed; amount -= absorbed;
  }
  p.health -= amount;
  g.hitFlash = 0.3;
  if (p.health <= 0) { p.health = 0; g.wasted(); }
}

export function updateCombat(g, dt) {
  const c = g.combat;
  c.fireTimer = Math.max(0, c.fireTimer - dt);
  if (c.reloadTimer > 0) {
    c.reloadTimer -= dt;
    if (c.reloadTimer <= 0) {
      const need = PLAYER_STATS.clip - c.clip;
      const give = Math.min(need, c.reserve);
      c.clip += give; c.reserve -= give;
    }
  }
  for (let i = c.bullets.length - 1; i >= 0; i -= 1) {
    const b = c.bullets[i];
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    let hit = false;
    if (g.world.blocked(b.x, b.y)) hit = true;
    if (!hit && !b.enemy) {
      for (const o of g.police.officers) {
        if (!o.dead && Math.hypot(o.x - b.x, o.y - b.y) < 16) {
          o.dead = true; g.effects.sparks(b.x, b.y); g.police.stars = Math.min(5, g.police.stars + 1); hit = true; break;
        }
      }
      if (!hit) for (const v of g.police.units) {
        if (Math.hypot(v.x - b.x, v.y - b.y) < 18) {
          v.health -= PLAYER_STATS.bulletDamage; g.effects.sparks(b.x, b.y); hit = true; break;
        }
      }
    }
    if (!hit && b.enemy) {
      const p = g.player;
      if (Math.hypot(p.x - b.x, p.y - b.y) < 16 && !p.inVehicle) { damagePlayer(g, 7); hit = true; }
      else if (p.inVehicle && Math.hypot(p.x - b.x, p.y - b.y) < 22) { p.vehicle.health -= 4; hit = true; }
    }
    if (hit || b.life <= 0) c.bullets.splice(i, 1);
  }
}
