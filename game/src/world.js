// SUNSET BAY's city: a road grid over five distinct districts, generated once from a seed.
// Roads run along tile seams at multiples of CELL; buildings, parks and water fill the lots.

import { CELL, ROAD, GRID, WORLD, COLORS, SHOP_NAMES, STREET_NAMES } from './config.js';

export const DISTRICT = { DOWNTOWN: 'downtown', BEACH: 'beach', NIGHTLIFE: 'nightlife', DOCKS: 'docks', SUBURBS: 'suburbs', PARK: 'park' };

export function districtAt(ix, iy) {
  if (iy >= GRID - 2) return DISTRICT.DOCKS;
  if (ix <= 2 && iy <= 2) return DISTRICT.BEACH;
  if ((ix === 3 && iy === 5) || (ix === 4 && iy === 9) || (ix === 9 && iy === 9)) return DISTRICT.PARK;
  if (ix >= 4 && ix <= 7 && iy >= 3 && iy <= 7) return DISTRICT.DOWNTOWN;
  if (ix >= 8 && iy >= 2 && iy <= 7) return DISTRICT.NIGHTLIFE;
  return DISTRICT.SUBURBS;
}

export function districtAtPoint(x, y) {
  return districtAt(Math.max(0, Math.min(GRID - 1, Math.floor(x / CELL))), Math.max(0, Math.min(GRID - 1, Math.floor(y / CELL))));
}

const inLot = (v) => v + ROAD / 2;
const lotEnd = (v) => v + CELL - ROAD / 2;

export function createWorld(rng) {
  const buildings = [];
  const props = [];
  const pois = [];
  const waterCells = [];
  const half = ROAD / 2;

  for (let iy = 0; iy < GRID; iy += 1) {
    for (let ix = 0; ix < GRID; ix += 1) {
      const district = districtAt(ix, iy);
      const x0 = inLot(ix * CELL), x1 = lotEnd(ix * CELL);
      const y0 = inLot(iy * CELL), y1 = lotEnd(iy * CELL);

      if (district === DISTRICT.DOCKS) {
        waterCells.push({ x: ix * CELL, y: iy * CELL, w: CELL, h: CELL });
        if (ix % 2 === 0) {
          props.push({ kind: 'pier', x: x0, y: iy * CELL + CELL / 2, w: CELL - ROAD, h: 26 });
          if (rng.chance(0.6)) pois.push({ kind: 'boat', x: ix * CELL + CELL / 2 + rng.range(-40, 40), y: iy * CELL + rng.range(20, 90) });
        }
        continue;
      }
      if (district === DISTRICT.BEACH) {
        props.push({ kind: 'sand', x: ix * CELL, y: iy * CELL, w: CELL, h: CELL });
        for (let p = 0; p < 3; p += 1) props.push({ kind: 'palm', x: rng.range(x0, x1), y: rng.range(y0, y1) });
        if (iy === 2) props.push({ kind: 'boardwalk', x: ix * CELL, y: y1 - 16, w: CELL, h: 22 });
        continue;
      }
      if (district === DISTRICT.PARK) {
        props.push({ kind: 'park', x: ix * CELL, y: iy * CELL, w: CELL, h: CELL });
        for (let p = 0; p < 6; p += 1) props.push({ kind: rng.chance(0.5) ? 'tree' : 'bench', x: rng.range(x0, x1), y: rng.range(y0, y1) });
        pois.push({ kind: 'collectible', x: (x0 + x1) / 2, y: (y0 + y1) / 2 });
        continue;
      }

      // Subdivide the lot into a small set of facades so streets feel hand-built.
      const cols = district === DISTRICT.DOWNTOWN || district === DISTRICT.NIGHTLIFE ? 2 : rng.int(1, 2);
      const rows = district === DISTRICT.DOWNTOWN ? 2 : rng.int(1, 2);
      const gap = 6;
      const cw = (x1 - x0) / cols, ch = (y1 - y0) / rows;
      for (let c = 0; c < cols; c += 1) {
        for (let r = 0; r < rows; r += 1) {
          if (district === DISTRICT.SUBURBS && rng.chance(0.18)) {
            props.push({ kind: 'tree', x: x0 + cw * (c + 0.5), y: y0 + ch * (r + 0.5) });
            continue;
          }
          const bx = x0 + c * cw + gap, by = y0 + r * ch + gap;
          const bw = cw - gap * 2, bh = ch - gap * 2;
          const tower = district === DISTRICT.DOWNTOWN;
          const house = district === DISTRICT.SUBURBS;
          const floors = tower ? rng.int(4, 9) : house ? 1 : rng.int(2, 4);
          const neon = district === DISTRICT.NIGHTLIFE || (tower && rng.chance(0.35));
          buildings.push({
            x: bx, y: by, w: bw, h: bh, floors, tower, house,
            color: house ? rng.pick(COLORS.house) : rng.pick(COLORS.building),
            neon: neon ? rng.pick(COLORS.neon) : null,
            sign: neon ? rng.pick(SHOP_NAMES) : null,
            winColor: rng.chance(0.7) ? COLORS.window : COLORS.windowDark,
            winSeed: rng.int(0, 9999),
          });
        }
      }
      if (district === DISTRICT.NIGHTLIFE && rng.chance(0.5)) {
        pois.push({ kind: 'business', x: (x0 + x1) / 2, y: (y0 + y1) / 2, label: rng.pick(SHOP_NAMES) });
      }
      if (district === DISTRICT.SUBURBS && rng.chance(0.4)) {
        props.push({ kind: 'tree', x: rng.range(x0, x1), y: rng.range(y0, y1) });
      }
    }
  }

  // Waterfront road furniture and lamps along the main boulevard.
  for (let k = 0; k <= GRID; k += 1) {
    for (let s = 2; s < GRID * CELL - 200; s += 190) {
      props.push({ kind: 'lamp', x: k * CELL + half - 4, y: s });
      props.push({ kind: 'lamp', x: s, y: k * CELL + half - 4 });
    }
  }
  pois.push({ kind: 'garage', x: 5 * CELL + CELL / 2, y: 4 * CELL + CELL / 2, label: 'Bay Auto' });
  pois.push({ kind: 'deal', x: 9 * CELL + CELL / 2, y: 4 * CELL + CELL / 2, label: 'Nightjar Club' });

  const world = {
    buildings, props, pois, waterCells,
    half,
    streetName: (x, y) => STREET_NAMES[(Math.floor(x / CELL) + Math.floor(y / CELL) * 3) % STREET_NAMES.length],
    isRoad(x, y) {
      if (x < 0 || y < 0 || x > WORLD || y > WORLD) return false;
      const gx = ((x % CELL) + CELL) % CELL;
      const gy = ((y % CELL) + CELL) % CELL;
      return Math.min(gx, CELL - gx) < half || Math.min(gy, CELL - gy) < half;
    },
    isWater(x, y) {
      const ix = Math.floor(x / CELL), iy = Math.floor(y / CELL);
      return iy >= GRID - 2 && ix >= 0 && ix < GRID;
    },
    // Solid rectangles that stop the player and cars: buildings and open water.
    blocked(x, y) {
      if (this.isWater(x, y)) return true;
      if (x < 12 || y < 12 || x > WORLD - 12 || y > WORLD - 12) return true;
      for (let i = 0; i < buildings.length; i += 1) {
        const b = buildings[i];
        if (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) return true;
      }
      return false;
    },
    // Nearest road centre line coordinate along an axis, plus a usable lane offset.
    laneOn(axis, coord) {
      const nearest = Math.round(coord / CELL) * CELL;
      const lane = (coord - nearest) >= 0 ? ROAD * 0.24 : -ROAD * 0.24;
      return { center: nearest, lane };
    },
  };
  return world;
}
