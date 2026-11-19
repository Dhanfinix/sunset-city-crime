// Story chain, mission stages, markers, timers, dialogue, rewards and side activities.
import { DISTRICT_LABEL, PALETTE } from './config.js';

const STAGES = [
  {
    title: '01 - FIRST IMPRESSION',
    from: 'Fixer Rina: "Welcome to Sunset Bay. Prove you can move."',
    steps: [
      { type: 'goto', x: 3 * 324 + 160, y: 3 * 324 + 160, text: 'Meet Rina downtown', radius: 70 },
      { type: 'steal', text: 'Steal any sports car (E to enter)', radius: 0 },
      { type: 'goto', x: 2 * 324 + 160, y: 5 * 324 + 160, text: 'Bring it to the safehouse', radius: 80 },
    ],
    reward: 700,
  },
  {
    title: '02 - NEON RUN',
    from: 'Rina: "The Neon Quarter has a new crew. Thin them out."',
    steps: [
      { type: 'goto', x: 7 * 324 + 150, y: 5 * 324 + 150, text: 'Reach the Neon Quarter', radius: 90 },
      { type: 'eliminate', count: 3, text: 'Take out 3 rivals', radius: 0 },
      { type: 'escape', x: 6 * 324 + 160, y: 3 * 324 + 160, text: 'Lose the heat at the overpass', radius: 90 },
    ],
    reward: 1500,
  },
  {
    title: '03 - HARBOR HEIST',
    from: 'Dock boss Sal: "A truck is waiting. Move it before the cops do."',
    steps: [
      { type: 'goto', x: 8 * 324 + 150, y: 2 * 324 + 150, text: 'Get to Sunset Harbour', radius: 100 },
      { type: 'steal', wantType: 'truck', text: 'Steal a delivery truck', radius: 0 },
      { type: 'goto', x: 1 * 324 + 160, y: 1 * 324 + 160, text: 'Deliver it to the ironworks', radius: 100, timer: 90 },
    ],
    reward: 2800,
  },
  {
    title: '04 - PALMSTRAND SPRINT',
    from: 'Racer Kai: "Four checkpoints. No brakes. Make the beach your own."',
    steps: [
      { type: 'goto', x: 1 * 324 + 150, y: 4 * 324 + 150, text: 'Reach the beach start line', radius: 90 },
      { type: 'race', text: 'Hit 4 checkpoints before time runs out', count: 4, timer: 75 },
    ],
    reward: 3500,
  },
  {
    title: '05 - SUNSET SHOWDOWN',
    from: 'Rina: "Finish it. Light up the precinct and disappear."',
    steps: [
      { type: 'goto', x: 6 * 324 + 150, y: 4 * 324 + 150, text: 'Go to the Neon Quarter', radius: 100 },
      { type: 'eliminateCops', count: 5, text: 'Take down 5 officers', radius: 0 },
      { type: 'escape', x: 0 * 324 + 160, y: 7 * 324 + 160, text: 'Escape to Palms strand', radius: 100 },
    ],
    reward: 9000,
  },
];

export function createMissionManager(world, rng, hooks) {
  const markers = [];
  const collectibles = [];
  const side = [];
  const messages = [];
  let chain = 0;
  let stage = 0;
  let active = false;
  let completed = false;
  let stepTimer = 0;
  let progress = 0;
  let dialogue = '';
  let dialogueTimer = 0;
  let raceChecks = [];

  // Side activities seeded around the city: taxi fares, deliveries and golden stars.
  for (let i = 0; i < 7; i += 1) {
    const lot = rng.pick(world.cells);
    collectibles.push({ x: lot.x + 120, y: lot.y + 120, taken: false, kind: 'star' });
  }
  for (let i = 0; i < 4; i += 1) {
    const a = rng.pick(world.cells);
    const b = rng.pick(world.cells);
    side.push({
      kind: i % 2 ? 'delivery' : 'taxi',
      x: a.x + 130, y: a.y + 130,
      tx: b.x + 130, ty: b.y + 130,
      phase: 0, active: false,
    });
  }

  function say(text, secs = 5) {
    dialogue = text;
    dialogueTimer = secs;
    messages.push(text);
    if (messages.length > 5) messages.shift();
    if (hooks.notify) hooks.notify(text);
  }

  function begin(index) {
    if (index < 0 || index >= STAGES.length) return;
    chain = index; stage = 0; active = true; completed = false; progress = 0;
    const def = STAGES[index];
    say(def.from, 7);
    setMarker(def.steps[0]);
    if (hooks.audio) hooks.audio.ui();
  }

  function currentStep() {
    return active ? STAGES[chain].steps[stage] : null;
  }

  function setMarker(step) {
    markers.length = 0;
    if (!step) return;
    if (step.type === 'goto' || step.type === 'escape') {
      markers.push({ x: step.x, y: step.y, label: step.text, kind: 'mission' });
    } else if (step.type === 'race') {
      markers.push({ x: raceChecks[0].x, y: raceChecks[0].y, label: 'CHECKPOINT', kind: 'race' });
    }
  }

  function advance(ctx) {
    stage += 1;
    progress = 0;
    const def = STAGES[chain];
    if (stage >= def.steps.length) {
      active = false; completed = true;
      markers.length = 0;
      hooks.reward?.(def.reward);
      say(`${def.title} COMPLETE  +$${def.reward}`, 7);
      if (hooks.audio) hooks.audio.cash();
      if (hooks.onComplete) hooks.onComplete(chain);
      return;
    }
    const next = def.steps[stage];
    stepTimer = next.timer || 0;
    if (next.type === 'race') {
      raceChecks = [];
      const cx = ctx.player.x, cy = ctx.player.y;
      for (let i = 0; i < next.count; i += 1) {
        const a = (i / next.count) * Math.PI * 2;
        raceChecks.push({ x: cx + Math.cos(a) * 420, y: cy + Math.sin(a) * 420, hit: false });
      }
    }
    setMarker(next);
    say(next.text, 4);
    if (hooks.audio) hooks.audio.ui();
  }

  function onVehicleEntered(vehicle, ctx) {
    const step = currentStep();
    if (!step || step.type !== 'steal') return;
    if (step.wantType && vehicle.type !== step.wantType) return;
    advance(ctx);
  }

  function onKill(ctx, isCop) {
    const step = currentStep();
    if (!step) return;
    if (step.type === 'eliminate' && !isCop) {
      progress += 1;
      if (progress >= step.count) advance(ctx);
    } else if (step.type === 'eliminateCops' && isCop) {
      progress += 1;
      if (progress >= step.count) advance(ctx);
      else setMarker({ type: 'goto', x: ctx.player.x + 200, y: ctx.player.y + 120, text: `${progress}/${step.count} officers down` });
    }
  }

  function update(dt, ctx) {
    if (dialogueTimer > 0) dialogueTimer -= dt;
    const step = currentStep();
    if (step) {
      if (step.timer && stepTimer > 0) stepTimer -= dt;
      const px = ctx.player.x, py = ctx.player.y;
      if (step.type === 'goto' && Math.hypot(px - step.x, py - step.y) < step.radius) advance(ctx);
      else if (step.type === 'escape') {
        if (Math.hypot(px - step.x, py - step.y) < step.radius && ctx.police.stars > 0) advance(ctx);
        else if (Math.hypot(px - step.x, py - step.y) < step.radius) say('The heat is off - provoke the police first.', 3);
      } else if (step.type === 'race') {
        if (!raceChecks.length) {
          raceChecks = [];
          for (let i = 0; i < step.count; i += 1) {
            const a = (i / step.count) * Math.PI * 2;
            raceChecks.push({ x: px + Math.cos(a) * 420, y: py + Math.sin(a) * 420, hit: false });
          }
        }
        const next = raceChecks.find((c) => !c.hit) || raceChecks[0];
        markers.length = 0;
        markers.push({ x: next.x, y: next.y, label: 'CHECKPOINT', kind: 'race' });
        if (Math.hypot(px - next.x, py - next.y) < 70) {
          next.hit = true;
          progress += 1;
          if (raceChecks.every((c) => c.hit)) advance(ctx);
          else say(`Checkpoint ${progress}/${step.count}`, 2);
        }
        if (step.timer && stepTimer <= 0) {
          say('RACE FAILED - out of time. Try again.', 5);
          stage = 1; progress = 0; stepTimer = step.timer; raceChecks = [];
        }
      }
    }

    // Collectibles.
    for (const c of collectibles) {
      if (c.taken) continue;
      if (Math.hypot(ctx.player.x - c.x, ctx.player.y - c.y) < 40) {
        c.taken = true;
        hooks.reward?.(150);
        say('GOLDEN STAR +$150', 3);
        if (hooks.audio) hooks.audio.cash();
      }
      markers.push({ x: c.x, y: c.y, kind: 'collect', label: '★' });
    }

    // Taxi fares and deliveries.
    for (const s of side) {
      if (!s.active && Math.hypot(ctx.player.x - s.x, ctx.player.y - s.y) < 46 && ctx.player.inVehicle) {
        s.active = true; s.phase = 1;
        markers.push({ x: s.tx, y: s.ty, kind: 'side', label: s.kind === 'taxi' ? 'FARE' : 'DELIVERY' });
        say(s.kind === 'taxi' ? 'FARE: take the passenger to the marker.' : 'DELIVERY: drop the package at the marker.', 4);
      }
      if (s.active && Math.hypot(ctx.player.x - s.tx, ctx.player.y - s.ty) < 60) {
        s.active = false; s.phase = 0;
        const pay = s.kind === 'taxi' ? 320 : 240;
        hooks.reward?.(pay);
        say(`${s.kind === 'taxi' ? 'FARE' : 'DELIVERY'} PAID +$${pay}`, 4);
        if (hooks.audio) hooks.audio.cash();
        const a = rng.pick(world.cells);
        s.x = a.x + 130; s.y = a.y + 130;
        const b = rng.pick(world.cells);
        s.tx = b.x + 130; s.ty = b.y + 130;
      }
      if (!s.active) markers.push({ x: s.x, y: s.y, kind: s.kind, label: s.kind === 'taxi' ? 'T' : 'D' });
    }
  }

  return {
    markers, messages, collectibles, side,
    get chain() { return chain; },
    get stage() { return stage; },
    get active() { return active; },
    get completed() { return completed; },
    get dialogue() { return dialogueTimer > 0 ? dialogue : ''; },
    get objective() {
      if (!active) return completed ? 'All missions complete - free roam' : 'Head to the downtown marker to start a job';
      const s = currentStep();
      let text = s.text;
      if (s.timer) text += `  ${Math.max(0, Math.ceil(stepTimer))}s`;
      if (progress && (s.type === 'eliminate' || s.type === 'eliminateCops' || s.type === 'race')) text += `  ${progress}/${s.count}`;
      return text;
    },
    get missionTitle() { return active ? STAGES[chain].title : ''; },
    begin, update, onVehicleEntered, onKill,
    startNext() { begin(chain + 1); },
    restart() { begin(chain); },
    serialise() { return { chain, stage, completed, taken: collectibles.map((c) => c.taken) }; },
    restore(data) {
      if (!data) return;
      chain = data.chain || 0; stage = data.stage || 0; completed = !!data.completed;
      (data.taken || []).forEach((t, i) => { if (collectibles[i]) collectibles[i].taken = t; });
      if (chain < STAGES.length && !completed) begin(chain); else active = false;
    },
  };
}
