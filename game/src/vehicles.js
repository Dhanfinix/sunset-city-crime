// Vehicles: original types with distinct handling, traffic AI that follows the grid and dodges,
// collision damage, tyre smoke hooks, and the top-down painter.
import { PALETTE, VEHICLE_TYPES, WORLD_SIZE } from './config.js';

let nextId = 1;

export function createVehicle(type, x, y, angle = 0, optional = {}) {
  const spec = VEHICLE_TYPES[type];
  return {
    id: nextId++, type, x, y, angle,
    speed: 0, steer: 0, damage: 0,
    color: optional.color || spec.color,
    w: spec.w, h: spec.h, value: spec.value,
    isPolice: type === 'cruiser',
    owned: !!optional.owned,
    ai: optional.ai !== false,
    targetSpeed: 100 + Math.random() * 40,
    lane: optional.lane ?? 0,
    siren: false, horn: 0,
    occupant: null,
  };
}

export function createVehicleManager(world, rng) {
  const vehicles = [];
  function seedTraffic() {
    for (let i = 0; i < 26; i += 1) {
      const p = world.roadPoint(rng);
      const type = rng.pick(['sedan', 'sedan', 'taxi', 'sports', 'truck']);
      const v = createVehicle(type, p.x, p.y, p.dir, { ai: true });
      v.targetSpeed = type === 'truck' ? 90 : 130 + rng.next() * 70;
      vehicles.push(v);
    }
  }
  seedTraffic();

  return {
    vehicles,
    add(v) { vehicles.push(v); return v; },
    remove(v) { const i = vehicles.indexOf(v); if (i >= 0) vehicles.splice(i, 1); },
    // --- physics for the player-controlled car: acceleration, steering, momentum, grip ---
    drive(v, input, dt) {
      const spec = VEHICLE_TYPES[v.type];
      if (input.throttle > 0) v.speed += spec.accel * dt;
      else if (input.throttle < 0) v.speed -= spec.accel * 1.5 * dt;
      else v.speed -= Math.sign(v.speed) * Math.min(Math.abs(v.speed), 60 * dt) * 1.6;
      v.speed = Math.max(-spec.topSpeed * 0.35, Math.min(spec.topSpeed, v.speed));
      const steerPower = input.steer * (1.9 - Math.min(1.3, Math.abs(v.speed) / spec.topSpeed)) * (v.speed >= 0 ? 1 : -1);
      v.angle += steerPower * dt * 2.4;
      v.steer = input.steer;
      move(v, dt);
      collideWorld(v, world, 0.65);
    },
    // --- civilian traffic: follow the road centre, brake for cars and the player ---
    update(dt, player, crimes) {
      for (const v of vehicles) {
        if (!v.ai) continue;
        const spec = VEHICLE_TYPES[v.type];
        let desired = v.targetSpeed;
        // Look ahead for anything in the lane.
        const ax = v.x + Math.cos(v.angle) * 90;
        const ay = v.y + Math.sin(v.angle) * 90;
        for (const other of vehicles) {
          if (other === v) continue;
          const d = Math.hypot(ax - other.x, ay - other.y);
          if (d < 70) desired = Math.min(desired, other.speed * 0.7);
        }
        // Panic at crimes: speed up and flash hazards.
        for (const c of crimes) {
          if (Math.hypot(v.x - c.x, v.y - c.y) < 260) { desired = spec.topSpeed * 0.9; v.horn = 0.6; break; }
        }
        if (v.horn > 0) v.horn -= dt;
        v.speed += Math.max(-spec.accel * dt, Math.min(spec.accel * dt, desired - v.speed));
        v.angle += (targetRoadAngle(v, world) - v.angle) * Math.min(1, dt * 1.5);
        move(v, dt);
        collideWorld(v, world, 0.5);
      }
    },
    draw(ctx, cam, night) {
      for (const v of vehicles) {
        if (Math.abs(v.x - cam.x) > cam.width / 2 + 80 || Math.abs(v.y - cam.y) > cam.height / 2 + 80) continue;
        drawVehicle(ctx, v, night);
      }
    },
  };
}

function targetRoadAngle(v, world) {
  // Snap toward the nearest road centre line; at intersections prefer the current heading.
  const cx = Math.round(v.x / 324) * 324;
  const cy = Math.round(v.y / 324) * 324;
  const dx = v.x - cx, dy = v.y - cy;
  if (Math.abs(dx) < 40) return Math.PI / 2;
  if (Math.abs(dy) < 40) return 0;
  // Pull toward the closest centre line with a proportional turn.
  const wantVertical = Math.abs(dx) < Math.abs(dy);
  const base = wantVertical ? Math.PI / 2 : 0;
  let diff = ((base - v.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  return v.angle + diff * 0.35;
}

function move(v, dt) {
  v.x += Math.cos(v.angle) * v.speed * dt;
  v.y += Math.sin(v.angle) * v.speed * dt;
  if (v.x < -200 || v.x > WORLD_SIZE + 200 || v.y < -200 || v.y > WORLD_SIZE + 200) {
    v.x = Math.max(40, Math.min(WORLD_SIZE - 40, v.x));
    v.y = Math.max(40, Math.min(WORLD_SIZE - 40, v.y));
    v.angle += Math.PI;
  }
}

function collideWorld(v, world, bounce) {
  const r = Math.max(v.w, v.h) * 0.42;
  const pts = [
    [v.x + Math.cos(v.angle) * r, v.y + Math.sin(v.angle) * r],
    [v.x - Math.cos(v.angle) * r, v.y - Math.sin(v.angle) * r],
  ];
  for (const [px, py] of pts) {
    if (world.solidAt(px, py)) {
      v.speed *= -bounce;
      v.angle += 0.7;
      v.damage += 6;
      return true;
    }
  }
  return false;
}

export function damageVehicle(v, amount) {
  v.damage += amount;
  return v.damage >= 100;
}

export function drawVehicle(ctx, v, night) {
  const { x, y, w, h } = v;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(v.angle + Math.PI / 2);
  ctx.fillStyle = 'rgba(0,0,0,0.34)';
  roundRect(ctx, -w / 2 + 4, -h / 2 + 6, w, h, 6); ctx.fill();
  // Body.
  ctx.fillStyle = v.damage > 60 ? shade(v.color, 0.6) : v.color;
  roundRect(ctx, -w / 2, -h / 2, w, h, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1; ctx.stroke();
  // Windscreen and roof.
  ctx.fillStyle = night > 0.4 ? 'rgba(160,210,255,0.55)' : '#2c3e4b';
  roundRect(ctx, -w / 2 + 4, -h * 0.14, w - 8, h * 0.34, 3); ctx.fill();
  ctx.fillStyle = shade(v.color, 0.85);
  roundRect(ctx, -w / 2 + 3, h * 0.12, w - 6, h * 0.3, 3); ctx.fill();
  // Wheels.
  ctx.fillStyle = '#15181c';
  ctx.fillRect(-w / 2 - 3, -h / 2 + 9, 5, 12);
  ctx.fillRect(w / 2 - 2, -h / 2 + 9, 5, 12);
  ctx.fillRect(-w / 2 - 3, h / 2 - 21, 5, 12);
  ctx.fillRect(w / 2 - 2, h / 2 - 21, 5, 12);
  // Headlights.
  ctx.fillStyle = night > 0.3 ? '#fff6c8' : '#d8e6ee';
  ctx.fillRect(-w / 2 + 4, -h / 2 - 2, 6, 3);
  ctx.fillRect(w / 2 - 10, -h / 2 - 2, 6, 3);
  ctx.fillStyle = '#c0392b';
  ctx.fillRect(-w / 2 + 4, h / 2 - 1, 6, 3);
  ctx.fillRect(w / 2 - 10, h / 2 - 1, 6, 3);
  // Taxi sign / police stripe / sports accent.
  if (v.type === 'taxi') {
    ctx.fillStyle = '#1a1a1a'; ctx.fillRect(-8, -h/2 - 6, 16, 6);
    ctx.fillStyle = '#ffe57a'; ctx.font = '5px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('TAXI', 0, -h/2 - 1);
  }
  if (v.isPolice) {
    ctx.fillStyle = '#1f3a6b'; ctx.fillRect(-w / 2, -6, w, 12);
    ctx.fillStyle = '#dfe6ee'; ctx.fillRect(-w / 2, -1, w, 2);
    if (v.siren || night > 0.2) {
      const c = (Math.floor(Date.now() / 180) % 2) ? '#ff3b5c' : '#3b8bff';
      ctx.save(); ctx.shadowColor = c; ctx.shadowBlur = 16;
      ctx.fillStyle = c; ctx.fillRect(-8, -h/2 - 5, 16, 5); ctx.restore();
    }
  }
  ctx.restore();
}

function shade(hex, f) {
  const p = parseInt(hex.slice(1), 16);
  return `rgb(${Math.min(255, (p >> 16) * f | 0)},${Math.min(255, ((p >> 8) & 255) * f | 0)},${Math.min(255, (p & 255) * f | 0)})`;
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
