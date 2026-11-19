// SUNSET BAY - the game object. Owns the world, all systems, one update path and screenshot staging.
import { ACTION_INTERACT, ACTION_RELOAD, ACTION_RAIN, ACTION_SAVE, ACTION_WEAPON } from './input.js';
import { CELL, VEHICLE_TYPES, WORLD_SIZE } from './config.js';
import { createRandom } from './random.js';
import { createWorld } from './world.js';
import { createPlayer, createPedManager } from './entities.js';
import { createVehicle, createVehicleManager } from './vehicles.js';
import { createPoliceManager } from './police.js';
import { createCombat } from './combat.js';
import { createMissionManager } from './missions.js';
import { createEffects } from './effects.js';
import { createCamera } from './camera.js';
import { createAudio } from './audio.js';

const SAVE_KEY = 'sunset-bay-save-v1';

export function createGame(canvas, seed = 4242) {
  const rng = createRandom(seed);
  const world = createWorld(rng);
  const state = {
    player: createPlayer(4 * CELL + 150, 4 * CELL + 150),
    time: 0, clock: 0.62, heading: 0, rain: false,
    dead: false, busted: false, started: false,
  };
  const vehicles = createVehicleManager(world, rng);
  const peds = createPedManager(world, rng);
  const effects = createEffects();
  const audio = createAudio();
  const camera = createCamera(canvas.width, canvas.height);
  camera.snap(state.player.x, state.player.y);
  const police = createPoliceManager(world, vehicles, rng);
  const notifications = [];
  const crimes = [];

  function notify(text) { notifications.push({ text, life: 4.2 }); if (notifications.length > 4) notifications.shift(); }
  const missions = createMissionManager(world, rng, {
    notify,
    reward(amount) { state.player.money += amount; },
    audio,
    onComplete(index) { if (index === 4) notify('SUNSET BAY IS YOURS. Free roam unlocked.'); },
  });

  const combat = createCombat(world, vehicles, peds, police, effects, audio);

  const g = {
    world, state, vehicles, peds, police, missions, combat, effects, camera, audio,
    notifications, crimes,
    markers: missions.markers,
    night() {
      const c = state.clock;
      if (c < 0.22 || c >= 0.80) return 1;
      if (c < 0.30) return (0.30 - c) / 0.08;
      if (c < 0.70) return 0;
      return (c - 0.70) / 0.10;
    },
    ctx() { return { player: state.player, police, world, vehicles }; },
  };

  // ---- input / simulation ----
  function aimPoint() {
    const p = state.player;
    if (p.inVehicle) {
      return { x: p.x + Math.cos(p.angle) * 200, y: p.y + Math.sin(p.angle) * 200 };
    }
    const m = window.__sbMouse || { x: camera.width / 2 + 100, y: camera.height / 2 };
    return {
      x: camera.x + (m.x - camera.width / 2) / camera.zoom,
      y: camera.y + (m.y - camera.height / 2) / camera.zoom,
    };
  }

  function interact() {
    const p = state.player;
    if (p.inVehicle) {
      const v = p.inVehicle;
      const side = v.angle + Math.PI / 2;
      p.x = v.x + Math.cos(side) * 40;
      p.y = v.y + Math.sin(side) * 40;
      p.inVehicle = null; v.occupant = null;
      notify('Left vehicle');
    } else {
      let best = null, bd = 72;
      for (const v of vehicles.vehicles) {
        if (v.isPolice) continue;
        const d = Math.hypot(v.x - p.x, v.y - p.y);
        if (d < bd) { bd = d; best = v; }
      }
      if (best) {
        p.inVehicle = best; best.occupant = p; best.ai = false;
        p.x = best.x; p.y = best.y; p.angle = best.angle;
        missions.onVehicleEntered(best, g.ctx());
        if (!best.owned) { police.crime(best.x, best.y, 1); notify('Vehicle stolen - police alerted'); }
        else notify(`Entered ${best.type}`);
      } else notify('No vehicle nearby');
    }
    audio.ui();
  }

  g.step = function step(dt, input, actions, screen) {
    const p = state.player;
    state.time += dt;
    state.clock = (state.clock + dt / 420) % 1;
    for (let i = crimes.length - 1; i >= 0; i -= 1) { crimes[i].life -= dt; if (crimes[i].life <= 0) crimes.splice(i, 1); }
    for (let i = notifications.length - 1; i >= 0; i -= 1) { notifications[i].life -= dt; if (notifications[i].life <= 0) notifications.splice(i, 1); }

    if (actions) {
      for (const a of actions) {
        if (a === ACTION_INTERACT) interact();
        else if (a === ACTION_RELOAD) combat.reload(p);
        else if (a === ACTION_WEAPON) {
          p.weapon = p.weapon === 'pistol' ? 'smg' : p.weapon === 'smg' ? 'fists' : 'pistol';
          p.ammo = p.weapon === 'fists' ? Infinity : 0;
          combat.reload(p);
          if (p.weapon === 'fists') p.ammo = Infinity;
          notify(`Weapon: ${p.weapon.toUpperCase()}`);
        } else if (a === ACTION_RAIN) { state.rain = !state.rain; notify(state.rain ? 'Rain on' : 'Rain off'); }
        else if (a === ACTION_SAVE) { g.save(); notify('Game saved'); }
      }
    }

    if (p.inVehicle) {
      const v = p.inVehicle;
      vehicles.drive(v, input ? input.drive() : { steer: 0, throttle: 0 }, dt);
      p.x = v.x; p.y = v.y; p.angle = v.angle;
      p.speed = v.speed;
      if (Math.abs(v.speed) > 60 && Math.random() < 0.4) effects.tyre(v.x - Math.cos(v.angle) * 18, v.y - Math.sin(v.angle) * 18, v.angle);
      if (v.damage > 40 && Math.random() < 0.25) effects.smoke(v.x, v.y, 1);
      if (v.damage >= 100) {
        const wreck = v;
        p.inVehicle = null;
        vehicles.remove(wreck);
        effects.sparks(p.x, p.y, 20);
        p.health -= 20;
        notify('Vehicle wrecked!');
        audio.crash();
      }
      audio.engine(v.speed, true);
      audio.siren(police.stars > 0);
    } else {
      const ax = input ? input.axis() : { x: 0, y: 0 };
      const mag = Math.hypot(ax.x, ax.y) || 1;
      const sprint = input && input.isDown('ShiftLeft');
      const speed = sprint ? 215 : 135;
      p.sprinting = !!sprint;
      const nx = p.x + (ax.x / mag) * speed * dt;
      const ny = p.y + (ax.y / mag) * speed * dt;
      if (!world.solidAt(nx, p.y)) p.x = Math.max(8, Math.min(WORLD_SIZE - 8, nx));
      if (!world.solidAt(p.x, ny)) p.y = Math.max(8, Math.min(WORLD_SIZE - 8, ny));
      p.speed = mag > 0.1 ? speed : 0;
      if (p.speed > 0 && sprint) {
        p.footstep -= dt;
        if (p.footstep <= 0) { p.footstep = 0.22; audio.footstep(); }
      }
      const aim = aimPoint();
      p.angle = Math.atan2(aim.y - p.y, aim.x - p.x);
      if (input && input.mouse.down) {
        if (p.weapon === 'fists') combat.melee(p, aim.x, aim.y);
        else combat.fire(p, aim.x, aim.y);
      }
    }

    combat.update(dt, p);
    vehicles.update(dt, p, crimes);
    peds.update(dt, p, crimes);
    police.update(dt, p, effects, audio);
    missions.update(dt, g.ctx());
    effects.update(dt);
    audio.music(dt);

    const followX = p.inVehicle ? p.x + Math.cos(p.angle) * p.speed * 0.4 : p.x;
    const followY = p.inVehicle ? p.y + Math.sin(p.angle) * p.speed * 0.4 : p.y;
    camera.follow(followX, followY, p.inVehicle ? Math.cos(p.angle) * p.speed : 0,
      p.inVehicle ? Math.sin(p.angle) * p.speed : 0, dt);
    state.heading = p.angle;

    if (p.health <= 0) state.dead = true;
    if (police.arrestReady()) {
      p.money = Math.max(0, p.money - 250);
      state.busted = true;
    }
  };

  g.respawn = function respawn() {
    const p = state.player;
    p.inVehicle = null; p.health = 100; p.armour = 0;
    p.x = 2 * CELL + 150; p.y = 6 * CELL + 150;
    p.angle = -Math.PI / 2;
    state.dead = false; state.busted = false;
    police.clear();
    camera.snap(p.x, p.y);
    notify('Released - back on the street');
  };

  g.save = function save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        money: state.player.money, health: state.player.health,
        clock: state.clock, x: state.player.x, y: state.player.y,
        missions: missions.serialise(),
      }));
    } catch { /* storage may be disabled */ }
  };
  g.load = function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const d = JSON.parse(raw);
      state.player.money = d.money ?? 250;
      state.player.health = d.health ?? 100;
      state.clock = d.clock ?? 0.62;
      state.player.x = d.x ?? 4 * CELL; state.player.y = d.y ?? 4 * CELL;
      missions.restore(d.missions);
      camera.snap(state.player.x, state.player.y);
      return true;
    } catch { return false; }
  };
  g.hasSave = function hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch { return false; } };

  // ---- deterministic screenshot staging, using the game's own systems ----
  g.stageShot = function stageShot(name) {
    const p = state.player;
    const center = { x: 4 * CELL, y: 4 * CELL };
    p.inVehicle = null; p.dead = false; p.busted = false;
    p.health = 100; p.armour = 60; p.money = 4820;

    const car = createVehicle('sports', center.x, center.y, -Math.PI / 4, { owned: true, ai: false });
    vehicles.add(car);

    if (name === 'foot') {
      state.clock = 0.5;
      p.x = center.x + 130; p.y = center.y + 120;
      p.angle = -0.9; p.inVehicle = null; p.weapon = 'smg'; p.ammo = 28; p.reserve = 60;
      police.setStars(1);
      missions.begin(0);
      const taxi = createVehicle('taxi', center.x - 120, center.y + 40, 0.2, { ai: true }); vehicles.add(taxi);
      const sedan = createVehicle('sedan', center.x + 220, center.y - 90, Math.PI, { ai: true }); vehicles.add(sedan);
      for (let i = 0; i < 5; i += 1) {
        const ped = peds.peds[i];
        if (ped) { ped.x = center.x + (i - 2) * 48; ped.y = center.y + 170 + (i % 2) * 30; ped.panic = 0.4; }
      }
      crimes.push({ x: p.x, y: p.y, life: 4 });
      effects.muzzle(p.x + Math.cos(p.angle) * 24, p.y + Math.sin(p.angle) * 24, p.angle);
    } else if (name === 'drive') {
      state.clock = 0.52;
      p.inVehicle = car; p.x = car.x; p.y = car.y; p.angle = car.angle;
      car.speed = 260; car.damage = 8;
      police.setStars(0);
      missions.begin(0);
      for (let i = 0; i < 4; i += 1) {
        const v = createVehicle(['sedan', 'taxi', 'truck', 'sports'][i],
          center.x + 180 + i * 90, center.y - 160 + i * 70, i * 0.8, { ai: true });
        vehicles.add(v);
      }
      effects.tyre(car.x - 30, car.y + 10, car.angle);
    } else if (name === 'chase') {
      state.clock = 0.82;
      p.inVehicle = car; p.x = car.x; p.y = car.y; p.angle = car.angle;
      car.speed = 310; car.damage = 42;
      police.setStars(5);
      missions.begin(2);
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * Math.PI * 2 + 0.6;
        const pv = createVehicle('cruiser', center.x + Math.cos(a) * (170 + i * 22),
          center.y + Math.sin(a) * (170 + i * 22), a + Math.PI, { ai: false });
        pv.siren = true; pv.speed = 220;
        vehicles.add(pv);
      }
      for (let i = 0; i < 3; i += 1) police.officers.push({ x: center.x + 90 + i * 26, y: center.y - 100, angle: 1, alert: 1 });
      effects.sparks(center.x + 40, center.y - 20, 14);
      effects.smoke(center.x + 10, center.y + 30, 6);
      effects.addShake(6);
      crimes.push({ x: p.x, y: p.y, life: 6 });
    } else {
      // cover: a dusk chase with wanted stars, a mission objective and the full HUD.
      state.clock = 0.765;
      p.inVehicle = car; p.x = car.x; p.y = car.y; p.angle = car.angle;
      car.speed = 280; car.damage = 18;
      police.setStars(4);
      missions.begin(0);
      for (let i = 0; i < 5; i += 1) {
        const a = (i / 5) * Math.PI * 2 + 0.4;
        const pv = createVehicle('cruiser', center.x + Math.cos(a) * (200 + i * 18),
          center.y + Math.sin(a) * (200 + i * 18), a + Math.PI, { ai: false });
        pv.siren = true; pv.speed = 200;
        vehicles.add(pv);
      }
      police.officers.push({ x: center.x + 130, y: center.y - 120, angle: 2, alert: 1 });
      effects.sparks(center.x + 70, center.y - 40, 10);
      effects.smoke(center.x + 20, center.y + 20, 4);
      crimes.push({ x: p.x, y: p.y, life: 6 });
    }

    camera.zoom = name === 'foot' ? 1.18 : 1.0;
    camera.snap(p.x, p.y);
    notify(name === 'cover' ? 'WANTED - lose the cops!' : 'SUNSET BAY');
    return g;
  };

  return g;
}
