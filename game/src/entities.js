// On-foot player and pedestrian crowds, with panic behaviour around crimes.
import { PALETTE, WEAPONS } from './config.js';

export function createPlayer(x, y) {
  return {
    x, y, angle: -Math.PI / 2, vx: 0, vy: 0,
    health: 100, armour: 0, money: 250,
    weapon: 'pistol', ammo: WEAPONS.pistol.ammo, reserve: 36,
    fireTimer: 0, reloadTimer: 0, meleeTimer: 0,
    inVehicle: null, sprinting: false, footstep: 0,
    dead: false, busted: false,
  };
}

export function createPedManager(world, rng) {
  const peds = [];
  const COLORS = ['#d96a6a', '#6a9bd9', '#e0b95c', '#7bc98a', '#b987d6', '#e08c5c', '#8fe0d6'];
  function spawnOne() {
    const lot = rng.pick(world.cells);
    const edge = rng.int(0, 3);
    const x = edge === 0 ? lot.x + 8 : edge === 1 ? lot.x + lot.w - 8 : lot.x + rng.next() * lot.w;
    const y = edge === 2 ? lot.y + 8 : edge === 3 ? lot.y + lot.h - 8 : lot.y + rng.next() * lot.h;
    peds.push({
      x, y, angle: rng.next() * Math.PI * 2, speed: 22 + rng.next() * 26,
      color: rng.pick(COLORS), panic: 0, health: 40, dead: false,
      turn: (rng.next() - 0.5) * 0.6, timer: rng.next() * 3,
      wallet: rng.int(5, 40),
    });
  }
  for (let i = 0; i < 46; i += 1) spawnOne();

  return {
    peds,
    update(dt, player, crimes) {
      for (const p of peds) {
        if (p.dead) continue;
        if (p.timer > 0) p.timer -= dt; else { p.turn = (rng.next() - 0.5) * 1.4; p.timer = 1 + rng.next() * 3; }
        p.angle += p.turn * dt;
        // Panic: a recent crime nearby makes pedestrians flee and alert the police.
        let fear = 0;
        for (const c of crimes) {
          const d = Math.hypot(p.x - c.x, p.y - c.y);
          if (d < 340) fear = Math.max(fear, 1 - d / 340);
        }
        p.panic = Math.max(p.panic - dt * 0.5, fear);
        const spd = p.speed * (1 + p.panic * 3);
        const nx = p.x + Math.cos(p.angle) * spd * dt;
        const ny = p.y + Math.sin(p.angle) * spd * dt;
        if (!world.solidAt(nx, ny) && nx > 4 && ny > 4 && nx < world.size - 4 && ny < world.size - 4) {
          p.x = nx; p.y = ny;
        } else {
          p.angle += Math.PI * (0.6 + rng.next() * 0.8);
        }
      }
    },
    nearest(x, y, radius) {
      let best = null, bd = radius * radius;
      for (const p of peds) {
        if (p.dead) continue;
        const d = (p.x - x) ** 2 + (p.y - y) ** 2;
        if (d < bd) { bd = d; best = p; }
      }
      return best;
    },
    draw(ctx, cam) {
      for (const p of peds) {
        if (p.dead) continue;
        if (Math.abs(p.x - cam.x) > cam.width / 2 + 40 || Math.abs(p.y - cam.y) > cam.height / 2 + 40) continue;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.fillStyle = 'rgba(0,0,0,0.28)';
        ctx.beginPath(); ctx.ellipse(2, 4, 8, 4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.rotate(p.angle + Math.PI / 2);
        ctx.fillStyle = p.color;
        roundRect(ctx, -6, -8, 12, 15, 4); ctx.fill();
        ctx.fillStyle = '#e8c9a6';
        ctx.beginPath(); ctx.arc(0, -11, 5, 0, Math.PI * 2); ctx.fill();
        if (p.panic > 0.3) {
          ctx.fillStyle = PALETTE.star;
          ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center';
          ctx.fillText('!', 0, -22);
        }
        ctx.restore();
      }
    },
  };
}

export function drawPlayer(ctx, player, cam, muzzle) {
  if (player.inVehicle) return;
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.fillStyle = 'rgba(0,0,0,0.32)';
  ctx.beginPath(); ctx.ellipse(3, 6, 11, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.rotate(player.angle + Math.PI / 2);
  // Body, vest and head.
  ctx.fillStyle = '#243a5e';
  roundRect(ctx, -9, -10, 18, 20, 5); ctx.fill();
  ctx.fillStyle = '#101a2c';
  roundRect(ctx, -7, -2, 14, 8, 3); ctx.fill();
  ctx.fillStyle = '#e8c9a6';
  ctx.beginPath(); ctx.arc(0, -13, 6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#37251c';
  ctx.beginPath(); ctx.arc(0, -15, 6, Math.PI, 0); ctx.fill();
  // Weapon in the aim direction.
  const weapon = WEAPONS[player.weapon];
  if (player.weapon !== 'fists') {
    ctx.fillStyle = '#22262d';
    const wl = player.weapon === 'smg' ? 22 : 16;
    ctx.fillRect(-3, -10 - wl, 6, wl);
    if (muzzle > 0) {
      ctx.fillStyle = PALETTE.neonGold;
      ctx.beginPath(); ctx.moveTo(-5, -10 - wl); ctx.lineTo(0, -20 - wl); ctx.lineTo(5, -10 - wl); ctx.fill();
    }
  } else if (player.meleeTimer > 0) {
    ctx.fillStyle = '#e8c9a6';
    ctx.fillRect(6, -14, 12, 6);
  }
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
