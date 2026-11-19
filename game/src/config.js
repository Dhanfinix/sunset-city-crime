// SUNSET BAY - global tuning constants and the original colour palette.
// The whole city is generated from these numbers, so every screen is reproducible.

export const CELL = 324;          // one city block + its surrounding roads
export const BLOCK = 260;         // buildable lot inside a cell
export const ROAD = CELL - BLOCK; // street width around each lot
export const GRID = 9;            // GRID x GRID cells
export const WORLD_SIZE = GRID * CELL;
export const STEP = 1 / 60;

export const PALETTE = {
  asphalt:     '#3a3f4b',
  asphaltDark: '#2c3038',
  lane:        '#e8c46a',
  sidewalk:    '#9aa3ad',
  sidewalkDark:'#7e8791',
  grass:       '#5f8a4a',
  sand:        '#e6cf99',
  water:       '#2f7f9e',
  waterDeep:   '#1d5e78',
  roofDay:     '#b8b3a8',
  wallDay:     '#9a9385',
  nightSky:    '#141a33',
  daySky:      '#7fc4e8',
  neonPink:    '#ff4fa3',
  neonCyan:    '#38e6ff',
  neonGold:    '#ffcf5c',
  text:        '#f7f3e8',
  hudPanel:    'rgba(12,16,28,0.74)',
  health:      '#4ce07a',
  armour:      '#54a8ff',
  star:        '#ffd34d',
};

// Districts are chosen by cell position, giving the city distinct neighbourhoods.
export function districtAt(col, row) {
  if (row === 0 || (col >= 6 && row === 1)) return 'docks';
  if (col === GRID - 1 && row <= 4) return 'harbour';
  if (col === 0) return 'beach';
  if (col >= GRID - 3 && row >= 3 && row <= 6) return 'nightlife';
  if (col >= 3 && col <= 5 && row >= 2 && row <= 5) return 'downtown';
  return 'suburbs';
}

export const DISTRICT_LABEL = {
  docks: 'IRONWORKS DOCKS',
  harbour: 'SUNSET HARBOUR',
  beach: 'PALMSTRAND BEACH',
  nightlife: 'NEON QUARTER',
  downtown: 'DOWNTOWN',
  suburbs: 'CYPRESS HEIGHTS',
};

// Original street names, used for the district signs on the minimap and HUD.
export const STREET_NAMES = [
  'MARINA BLVD', 'CORAL AVE', 'SUNSET DR', 'PALM ST', 'CYPRESS LN',
  'NEON WAY', 'HARBOR RD', 'BAYVIEW ST', 'DOLPHIN CT', 'ORCHID AVE',
];

export const SHOP_NAMES = [
  'RAMDAN MART', 'BAY BAKERY', 'SUNSET MOTEL', 'NEON NOODLES', 'CORAL COFFEE',
  'PIER 9 SEAFOOD', 'CYPRESS AUTO', 'PALM LAUNDRY', 'HARBOR GOODS', 'STARLIGHT BAR',
];

export const VEHICLE_TYPES = {
  sedan:   { topSpeed: 250, accel: 150, grip: 4.6, mass: 1.0, color: '#c94f4f', w: 26, h: 46, value: 900 },
  sports:  { topSpeed: 390, accel: 250, grip: 5.4, mass: 0.8, color: '#ff9f2e', w: 24, h: 44, value: 2400 },
  taxi:    { topSpeed: 250, accel: 140, grip: 4.2, mass: 1.2, color: '#f2c33b', w: 27, h: 48, value: 1100 },
  truck:   { topSpeed: 200, accel: 105, grip: 3.2, mass: 2.0, color: '#8a97a6', w: 32, h: 64, value: 1800 },
  cruiser: { topSpeed: 320, accel: 190, grip: 5.0, mass: 1.1, color: '#dfe6ee', w: 26, h: 48, value: 0 },
};

export const WEAPONS = {
  fists:   { name: 'FISTS',   damage: 12, rate: 0.36, range: 34, ammo: Infinity },
  pistol:  { name: 'PISTOL',  damage: 26, rate: 0.16, range: 460, ammo: 12 },
  smg:     { name: 'SMG',     damage: 16, rate: 0.075, range: 400, ammo: 40 },
};

export const SHOT_SCENES = ['cover', 'foot', 'drive', 'chase'];
