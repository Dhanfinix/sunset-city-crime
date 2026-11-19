// SUNSET BAY — every tuning number, colour and original name lives here.
// The world is a grid of CELL tiles; roads run along the tile seams.

export const FIELD = { width: 1280, height: 720 };
export const STEP = 1 / 60;

export const CELL = 256;
export const ROAD = 68;
export const GRID = 12;
export const WORLD = CELL * GRID;

export const COLORS = {
  night: '#0b1020',
  asphalt: '#242a38',
  asphaltLine: '#c9b45a',
  sidewalk: '#5b6172',
  sidewalkEdge: '#767d90',
  crosswalk: '#cfd6e2',
  sand: '#d9bd82',
  sandDark: '#c2a568',
  grass: '#3f7d4e',
  grassDark: '#356a41',
  water: '#123a5c',
  waterLight: '#1b527d',
  pier: '#6b4f33',
  building: ['#7a5c58', '#6d6a7a', '#846b52', '#5c6d72', '#7d6470', '#6b7358'],
  house: ['#b96b5a', '#c99a5b', '#8a9b6c', '#a8748a', '#7d94ad'],
  window: '#ffd98a',
  windowDark: '#33425e',
  neon: ['#ff4fa3', '#31e0ff', '#b56bff', '#ffd23f', '#4dffa1'],
  taxi: '#f2c531',
  police: '#dfe6f2',
  player: '#e8443c',
  skin: '#e2b18a',
  health: '#4ad06a',
  armour: '#4aa8e0',
  money: '#f4d35e',
  star: '#ffcf47',
};

// Original vehicle classes with distinct handling. mass damps collisions; grip shapes steering.
export const VEHICLE_TYPES = {
  compact: { label: 'Kestrel', top: 235, accel: 165, brake: 260, turn: 2.7, grip: 7.5, mass: 1.0, w: 40, h: 20 },
  sedan: { label: 'Meridian', top: 260, accel: 175, brake: 280, turn: 2.3, grip: 7.0, mass: 1.25, w: 46, h: 22 },
  taxi: { label: 'Sunset Cab', top: 240, accel: 160, brake: 270, turn: 2.4, grip: 7.2, mass: 1.2, w: 46, h: 22 },
  sports: { label: 'Vermilion GT', top: 360, accel: 285, brake: 340, turn: 3.0, grip: 9.5, mass: 0.9, w: 42, h: 19 },
  van: { label: 'Hauler', top: 190, accel: 120, brake: 210, turn: 1.8, grip: 5.5, mass: 1.9, w: 54, h: 26 },
  truck: { label: 'Big Rig', top: 165, accel: 90, brake: 175, turn: 1.3, grip: 4.2, mass: 2.8, w: 64, h: 30 },
  police: { label: 'Bay Patrol', top: 285, accel: 195, brake: 300, turn: 2.6, grip: 8.0, mass: 1.3, w: 46, h: 22 },
};

export const TRAFFIC_COLORS = ['#c94f4f', '#4f7fc9', '#d8d2c0', '#3f9c7a', '#8a6fc0', '#d98f3d', '#5d6675', '#b5446f'];

export const STREET_NAMES = ['Palm Vista', 'Coral Ave', 'Neon Row', 'Dockside', 'Old Harbor', 'Cedar Walk', 'Sunset Blvd', 'Marina Way', 'Glass St', 'Verdant Ln'];
export const SHOP_NAMES = ['Bayside Diner', 'Neon Noodles', 'Palm & Paddle', 'Coral Motors', 'Nightjar Club', 'Tidepool Market', 'Aurora Towers', 'Rusty Anchor', 'Sunset Arcade', 'Lotus Pharmacy'];

export const PLAYER_STATS = {
  walk: 150,
  sprint: 250,
  maxHealth: 100,
  maxArmour: 100,
  ammo: 90,
  clip: 12,
  meleeRange: 34,
  meleeDamage: 24,
  bulletDamage: 26,
  fireDelay: 0.11,
  reloadTime: 1.35,
};

export const WANTED = {
  decayHidden: 8, // seconds hidden before a star clears
  speeds: [0, 0.7, 1.0, 1.25, 1.5, 1.8], // police pursuit aggression by star
};

export const DAY_LENGTH = 180; // seconds for a full day/night cycle

export const SAVE_KEY = 'sunset-bay.save.v1';
export const BEST_KEY = 'sunset-bay.best.v1';
