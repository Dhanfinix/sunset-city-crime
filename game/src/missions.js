// Original story chain with characters, plus repeatable side activities.

import { CELL } from './config.js';

export const MISSIONS = [
  {
    title: 'A Bay Like Yours', by: 'NIA VALE',
    intro: 'Nia Vale: Sunset Bay belongs to the people who live here. Start by getting noticed.',
    steps: [
      { type: 'drive', text: 'Steal a ride from the street', done: (g) => g.stats.carsStolen >= 1 },
      { type: 'go', text: 'Reach the Neon Row marker', x: 9 * CELL + 128, y: 4 * CELL + 128, radius: 90 },
      { type: 'speak', text: 'Meet Nia at the club', x: 9 * CELL + 128, y: 4 * CELL + 128, radius: 90 },
    ],
    reward: 500,
  },
  {
    title: 'Ratings War', by: 'NIA VALE',
    intro: 'Nia Vale: The Nightjar pays the bills. Make some noise on the strip.',
    steps: [
      { type: 'crime', text: 'Raise a 2-star wanted level', done: (g) => g.police.stars >= 2 },
      { type: 'survive', text: 'Escape the patrols', done: (g) => g.police.stars === 0, after: true },
    ],
    reward: 900,
  },
  {
    title: 'Harbour Light', by: 'SAM ORTIZ',
    intro: 'Sam Ortiz: My boat is at the docks. Lose the tail and bring it home.',
    steps: [
      { type: 'go', text: 'Get to the marina', x: 6 * CELL + 128, y: 10 * CELL + 128, radius: 110 },
      { type: 'deliver', text: 'Deliver the package downtown', x: 6 * CELL + 128, y: 5 * CELL + 128, radius: 100 },
    ],
    reward: 1400,
  },
  {
    title: 'Glass & Gravel', by: 'NIA VALE',
    intro: 'Nia Vale: Glass Tower wants the whole bay. Show them our strength.',
    steps: [
      { type: 'race', text: 'Win the street race', done: (g) => g.stats.racesWon >= 1 },
      { type: 'crime', text: 'Take out three patrol cars', done: (g) => g.stats.copsDown >= 3 },
    ],
    reward: 2500,
  },
  {
    title: 'Sunset Bay', by: 'NIA VALE',
    intro: 'Nia Vale: One last run. Four stars, and disappear into the night.',
    steps: [
      { type: 'crime', text: 'Reach 4 wanted stars', done: (g) => g.police.stars >= 4 },
      { type: 'survive', text: 'Escape with four stars', done: (g) => g.police.stars === 0, after: true },
      { type: 'go', text: 'Return to the club', x: 9 * CELL + 128, y: 4 * CELL + 128, radius: 100 },
    ],
    reward: 5000,
  },
];

export function createMissions() {
  return { index: 0, step: 0, active: true, timer: 0, dialogue: null, dialogueTimer: 0, done: false, side: null };
}

export function currentMarker(m) {
  if (!m.active || m.done) return null;
  const mission = MISSIONS[m.index];
  const step = mission.steps[m.step];
  if (!step) return null;
  if (step.x !== undefined) return { x: step.x, y: step.y, label: step.text, radius: step.radius || 90 };
  return null;
}

export function currentObjective(m) {
  if (m.done) return 'Story complete — the bay is yours.';
  const mission = MISSIONS[m.index];
  const step = mission.steps[m.step];
  return step ? step.text : 'Mission complete';
}

function finishStep(g) {
  const m = g.mission;
  m.step += 1;
  const mission = MISSIONS[m.index];
  if (m.step >= mission.steps.length) {
    g.player.money += mission.reward;
    g.notify(`MISSION PASSED  +$${mission.reward}`);
    g.stats.missionsPassed += 1;
    m.dialogue = `${mission.by}: Beautiful. Here's your cut.`;
    m.dialogueTimer = 6;
    m.index += 1;
    m.step = 0;
    if (m.index >= MISSIONS.length) { m.done = true; m.active = false; }
  } else {
    g.notify('Objective complete.');
  }
}

export function updateMissions(g, dt) {
  const m = g.mission;
  if (m.dialogueTimer > 0) { m.dialogueTimer -= dt; if (m.dialogueTimer <= 0) m.dialogue = null; }
  if (!m.active || m.done) return;
  const mission = MISSIONS[m.index];
  const step = mission.steps[m.step];
  if (!step) return;
  if (step.type === 'go' || step.type === 'speak' || step.type === 'deliver') {
    if (Math.hypot(g.player.x - step.x, g.player.y - step.y) < (step.radius || 90)) {
      if (step.type === 'speak') { m.dialogue = mission.intro; m.dialogueTimer = 6; }
      finishStep(g);
    }
  } else if (step.done && step.done(g)) {
    finishStep(g);
  }

  // Side activities: taxi fares, courier runs and the street race.
  if (g.side && g.side.kind === 'taxi') {
    if (Math.hypot(g.player.x - g.side.tx, g.player.y - g.side.ty) < 70 && g.player.inVehicle) {
      g.player.money += 120; g.notify('Fare paid  +$120'); g.startTaxi();
    }
  }
  if (g.side && g.side.kind === 'race') {
    const next = g.side.checkpoints[g.side.cp];
    if (next && Math.hypot(g.player.x - next.x, g.player.y - next.y) < 80) {
      g.side.cp += 1;
      g.side.time += 6;
      if (g.side.cp >= g.side.checkpoints.length) {
        g.player.money += 750; g.stats.racesWon += 1;
        g.notify('STREET RACE WON  +$750'); g.side = null;
      } else g.notify('Checkpoint! +6s');
    }
    g.side.time -= dt;
    if (g.side && g.side.time <= 0) { g.notify('Race failed — out of time.'); g.side = null; }
  }
}

export function startStreetRace(g) {
  const baseX = 3 * CELL + 128, baseY = 7 * CELL + 128;
  g.side = {
    kind: 'race', cp: 0, time: 45,
    checkpoints: [
      { x: 3 * CELL + 128, y: 3 * CELL + 128 },
      { x: 9 * CELL + 128, y: 3 * CELL + 128 },
      { x: 9 * CELL + 128, y: 8 * CELL + 128 },
      { x: baseX, y: baseY },
    ],
  };
  g.notify('Street race! Hit the checkpoints.');
}
