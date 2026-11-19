// Hitscan gunfire, melee, reloads, armour absorption and bullet tracers.
import { PALETTE, WEAPONS } from './config.js';

export function createCombat(world, vehicles, peds, police, effects, audio) {
  const bullets = [];

  function consumeAmmo(player) {
    if (player.ammo <= 0) { reload(player); return false; }
    player.ammo -= 1;
    return true;
  }

  function fire(player, aimX, aimY) {
    const weapon = WEAPONS[player.weapon];
    if (player.fireTimer > 0 || player.reloadTimer > 0 || player.weapon === 'fists') return;
    if (!consumeAmmo(player)) return;
    player.fireTimer = weapon.rate;
    const ang = Math.atan2(aimY - player.y, aimX - player.x);
    player.angle = ang;
    const spread = (Math.random() - 0.5) * 0.08;
    const dx = Math.cos(ang + spread), dy = Math.sin(ang + spread);
    let endX = player.x + dx * weapon.range, endY = player.y + dy * weapon.range;
    let hit = null;

    // Test peds.
    for (const p of peds.peds) {
      if (p.dead) continue;
      const t = projection(player.x, player.y, dx, dy, p.x, p.y);
      if (t > 0 && t < weapon.range && distanceToRay(player.x, player.y, dx, dy, p.x, p.y) < 12 && (!hit || t < hit.t)) hit = { t, type: 'ped', target: p };
    }
    // Test officers.
    for (const o of police.officers) {
      const t = projection(player.x, player.y, dx, dy, o.x, o.y);
      if (t > 0 && t < weapon.range && distanceToRay(player.x, player.y, dx, dy, o.x, o.y) < 12 && (!hit || t < hit.t)) hit = { t, type: 'cop', target: o };
    }
    // Test vehicles.
    for (const v of vehicles.vehicles) {
      const t = projection(player.x, player.y, dx, dy, v.x, v.y);
      if (t > 0 && t < weapon.range && distanceToRay(player.x, player.y, dx, dy, v.x, v.y) < Math.max(v.w, v.h) * 0.55 && (!hit || t < hit.t)) hit = { t, type: 'car', target: v };
    }
    // Buildings stop bullets.
    for (let d = 20; d < weapon.range; d += 14) {
      if (world.solidAt(player.x + dx * d, player.y + dy * d)) {
        if (!hit || d < hit.t) hit = { t: d, type: 'wall', target: null };
        break;
      }
    }
    if (hit) { endX = player.x + dx * hit.t; endY = player.y + dy * hit.t; }

    bullets.push({ x: player.x, y: player.y, ex: endX, ey: endY, life: 0.12 });
    effects.muzzle(player.x + dx * 18, player.y + dy * 18, ang);
    if (audio) audio.shot(true);
    if (hit) {
      effects.sparks(endX, endY, 8);
      if (hit.type === 'ped') {
        hit.target.health -= weapon.damage;
        if (hit.target.health <= 0) {
          hit.target.dead = true;
          player.money += hit.target.wallet;
          effects.blood(endX, endY);
        }
      } else if (hit.type === 'cop') {
        const idx = police.officers.indexOf(hit.target);
        if (idx >= 0) police.officers.splice(idx, 1);
        effects.blood(endX, endY);
      } else if (hit.type === 'car') {
        hit.target.damage += weapon.damage * 0.6;
      }
    }
    // Firing in public is a crime.
    police.crime(player.x, player.y, 2);
  }

  function melee(player, aimX, aimY) {
    if (player.meleeTimer > 0) return;
    player.meleeTimer = WEAPONS.fists.rate;
    const ang = Math.atan2(aimY - player.y, aimX - player.x);
    player.angle = ang;
    const tx = player.x + Math.cos(ang) * 26, ty = player.y + Math.sin(ang) * 26;
    let target = peds.nearest(tx, ty, 30);
    if (!target) {
      let bd = 32;
      for (const o of police.officers) {
        const d = Math.hypot(o.x - tx, o.y - ty);
        if (d < bd) { bd = d; target = o; }
      }
    }
    if (target) {
      target.health = (target.health || 40) - WEAPONS.fists.damage;
      effects.sparks(target.x, target.y, 4);
      if (target.health <= 0) {
        if (peds.peds.includes(target)) { target.dead = true; player.money += target.wallet || 10; }
        else { const i = police.officers.indexOf(target); if (i >= 0) police.officers.splice(i, 1); }
      }
      police.crime(player.x, player.y, 1);
    }
  }

  function reload(player) {
    if (player.weapon === 'fists' || player.reloadTimer > 0 || player.ammo === WEAPONS[player.weapon].ammo) return;
    const need = WEAPONS[player.weapon].ammo - player.ammo;
    const take = Math.min(need, player.reserve);
    if (take <= 0) return;
    player.reloadTimer = 1.1;
    player.pendingReload = take;
    if (audio) audio.reload();
  }

  function finishReload(player) {
    if (player.pendingReload) {
      player.ammo += player.pendingReload;
      player.reserve -= player.pendingReload;
      player.pendingReload = 0;
    }
  }

  function update(dt, player) {
    if (player.fireTimer > 0) player.fireTimer -= dt;
    if (player.meleeTimer > 0) player.meleeTimer -= dt;
    if (player.reloadTimer > 0) {
      player.reloadTimer -= dt;
      if (player.reloadTimer <= 0) finishReload(player);
    }
    for (let i = bullets.length - 1; i >= 0; i -= 1) {
      bullets[i].life -= dt;
      if (bullets[i].life <= 0) bullets.splice(i, 1);
    }
  }

  function draw(ctx, cam) {
    ctx.save();
    ctx.strokeStyle = PALETTE.neonGold;
    ctx.lineWidth = 2;
    ctx.shadowColor = PALETTE.neonGold;
    ctx.shadowBlur = 8;
    for (const b of bullets) {
      ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.ex, b.ey); ctx.stroke();
    }
    ctx.restore();
  }

  return { bullets, fire, melee, reload, update, draw };
}

function projection(ox, oy, dx, dy, px, py) { return (px - ox) * dx + (py - oy) * dy; }
function distanceToRay(ox, oy, dx, dy, px, py) {
  const t = projection(ox, oy, dx, dy, px, py);
  return Math.hypot(px - (ox + dx * t), py - (oy + dy * t));
}
