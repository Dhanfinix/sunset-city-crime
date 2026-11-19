// The city itself: a deterministic road grid with five distinct districts, building collision,
// and the painter that renders ground, roads, facades, neon, furniture and water.
import { BLOCK, CELL, GRID, PALETTE, STREET_NAMES, WORLD_SIZE, districtAt, SHOP_NAMES } from './config.js';
import { hash2 } from './random.js';

const COLORS = ['#b7a08c', '#a38f7b', '#c2b6a6', '#9fb0b0', '#b59a9a', '#a9a58f', '#8fa3b8'];
const NEON = [PALETTE.neonPink, PALETTE.neonCyan, PALETTE.neonGold, '#8b5cff'];

export function createWorld(rng) {
  const cells = [];
  const pois = [];
  for (let row = 0; row < GRID; row += 1) {
    for (let col = 0; col < GRID; col += 1) {
      const district = districtAt(col, row);
      const lot = {
        col, row, district,
        x: col * CELL + (CELL - BLOCK) / 2,
        y: row * CELL + (CELL - BLOCK) / 2,
        w: BLOCK, h: BLOCK,
        buildings: [], props: [],
        shop: rng.chance(0.32) ? rng.pick(SHOP_NAMES) : null,
        street: STREET_NAMES[(col + row * 3) % STREET_NAMES.length],
      };
      buildLot(lot, rng);
      cells.push(lot);
      if (rng.chance(0.22)) {
        pois.push({ x: lot.x + BLOCK / 2, y: lot.y + BLOCK / 2, label: lot.shop || district, district });
      }
    }
  }
  const water = [
    { x: -900, y: -900, w: 900, h: WORLD_SIZE + 1800 },
    { x: -900, y: -900, w: WORLD_SIZE + 1800, h: 900 },
    { x: WORLD_SIZE, y: -900, w: 900, h: WORLD_SIZE + 1800 },
  ];
  return {
    cells, pois, water, size: WORLD_SIZE,
    cellAt(x, y) {
      const col = Math.floor(x / CELL);
      const row = Math.floor(y / CELL);
      if (col < 0 || row < 0 || col >= GRID || row >= GRID) return null;
      return cells[row * GRID + col];
    },
    solidAt(x, y) {
      const lot = this.cellAt(x, y);
      if (!lot) return false;
      for (const b of lot.buildings) {
        if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return true;
      }
      return false;
    },
    roadPoint(rng2) {
      const alongVertical = rng2.chance(0.5);
      const line = rng2.int(1, GRID - 1) * CELL;
      const pos = rng2.next() * WORLD_SIZE;
      return alongVertical ? { x: line, y: pos, dir: Math.PI / 2 } : { x: pos, y: line, dir: 0 };
    },
  };
}

function buildLot(lot, rng) {
  const { x, y, w, h, district } = lot;
  const edge = 26; // sidewalk band eaten off the lot for public walkway
  const ix = x + edge, iy = y + edge, iw = w - edge * 2, ih = h - edge * 2;

  if (district === 'beach') {
    makeBeach(lot, rng, ix, iy, iw, ih);
  } else if (district === 'docks' || district === 'harbour') {
    makeDocks(lot, rng, ix, iy, iw, ih);
  } else if (district === 'downtown') {
    makeTower(lot, rng, ix, iy, iw, ih);
  } else if (district === 'nightlife') {
    makeNightlife(lot, rng, ix, iy, iw, ih);
  } else {
    makeSuburb(lot, rng, ix, iy, iw, ih);
  }
  // Street furniture along both road-facing edges.
  const furniture = district === 'beach' ? 'palm' : (district === 'suburbs' ? 'tree' : 'lamp');
  const count = rng.int(2, 4);
  for (let i = 0; i < count; i += 1) {
    const t = (i + 0.5) / count;
    lot.props.push({ type: furniture, x: x + 8 + t * (w - 16), y: y + 8 });
    if (rng.chance(0.6)) lot.props.push({ type: furniture, x: x + 8, y: y + 8 + t * (h - 16) });
  }
  if (rng.chance(0.35)) lot.props.push({ type: 'bench', x: x + w / 2, y: y + h - 12 });
  if (district !== 'beach' && rng.chance(0.4)) lot.props.push({ type: 'hydrant', x: x + w - 12, y: y + h / 2 });
}

function addBuilding(lot, x, y, w, h, rng, kind) {
  const district = lot.district;
  const height = kind === 'tower' ? rng.int(70, 150)
    : kind === 'house' ? rng.int(20, 34) : rng.int(38, 78);
  lot.buildings.push({
    x, y, w, h, height, kind,
    color: COLORS[Math.floor(rng.next() * COLORS.length)],
    lit: rng.chance(0.75),
    cols: Math.max(2, Math.floor(w / 26)),
    rows: Math.max(2, Math.floor(height / 26)),
    neon: district === 'nightlife' && rng.chance(0.8) ? rng.pick(NEON) : null,
    sign: district === 'nightlife' && rng.chance(0.5) ? rng.pick(SHOP_NAMES) : null,
  });
}

function makeTower(lot, rng, ix, iy, iw, ih) {
  if (rng.chance(0.25)) {
    addBuilding(lot, ix, iy, iw * 0.56, ih, rng, 'tower');
    addBuilding(lot, ix + iw * 0.6, iy + ih * 0.3, iw * 0.4, ih * 0.7, rng, 'tower');
  } else {
    addBuilding(lot, ix + 10, iy + 10, iw - 20, ih - 20, rng, 'tower');
  }
}

function makeNightlife(lot, rng, ix, iy, iw, ih) {
  addBuilding(lot, ix + 12, iy + 12, iw - 24, ih - 24, rng, 'block');
  for (let i = 0; i < 3; i += 1) {
    lot.props.push({ type: 'neon', x: ix + 18 + i * (iw - 36) / 2, y: iy + 16 + rng.next() * 20, color: rng.pick(NEON) });
  }
}

function makeSuburb(lot, rng, ix, iy, iw, ih) {
  const split = rng.chance(0.5);
  if (split) {
    addBuilding(lot, ix + 12, iy + 12, iw * 0.44 - 12, ih - 24, rng, 'house');
    addBuilding(lot, ix + iw * 0.5, iy + 12, iw * 0.44 - 12, ih - 24, rng, 'house');
  } else {
    addBuilding(lot, ix + 24, iy + 20, iw - 48, ih - 40, rng, 'house');
  }
  if (rng.chance(0.5)) lot.props.push({ type: 'driveway', x: ix + iw / 2, y: iy + ih - 10 });
}

function makeBeach(lot, rng, ix, iy, iw, ih) {
  lot.props.push({ type: 'boardwalk', x: ix, y: iy + ih * 0.35, w: iw, h: 30 });
  for (let i = 0; i < 3; i += 1) lot.props.push({ type: 'palm', x: ix + 20 + i * (iw - 40) / 2, y: iy + 30 });
  if (rng.chance(0.6)) addBuilding(lot, ix + iw * 0.25, iy + ih * 0.5, iw * 0.5, ih * 0.35, rng, 'shop');
  lot.props.push({ type: 'umbrella', x: ix + iw * 0.3, y: iy + ih * 0.85, color: rng.pick(NEON) });
}

function makeDocks(lot, rng, ix, iy, iw, ih) {
  for (let i = 0; i < 3; i += 1) {
    lot.props.push({ type: 'container', x: ix + 10 + i * 54, y: iy + 30 + rng.next() * 30, color: rng.pick(['#c0553f', '#3f7bc0', '#d3a731', '#4d9b78']) });
  }
  if (rng.chance(0.4)) addBuilding(lot, ix + iw * 0.2, iy + ih * 0.55, iw * 0.6, ih * 0.35, rng, 'block');
  if (rng.chance(0.5)) lot.props.push({ type: 'crane', x: ix + iw / 2, y: iy + 20 });
}

// ---------- rendering ----------

export function drawWorld(ctx, world, cam, opts) {
  const night = opts.night || 0;
  const view = { x0: cam.x - cam.width / 2 - 60, y0: cam.y - cam.height / 2 - 60,
                 x1: cam.x + cam.width / 2 + 60, y1: cam.y + cam.height / 2 + 60 };
  ctx.save();
  ctx.translate(cam.width / 2 - cam.x, cam.height / 2 - cam.y);

  // Water first, with a slow shimmering band pattern.
  ctx.fillStyle = mix(PALETTE.water, PALETTE.waterDeep, night);
  for (const w of world.water) ctx.fillRect(w.x, w.y, w.w, w.h);
  if (opts.time) {
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = '#bfe9ff';
    for (let i = 0; i < 26; i += 1) {
      const yy = ((i * 97 + opts.time * 14) % 1800) - 900;
      ctx.fillRect(-900, yy, WORLD_SIZE + 1800, 3);
    }
    ctx.globalAlpha = 1;
  }

  // Ground slab under the whole grid.
  ctx.fillStyle = mix('#6f8a5a', '#39443c', night);
  ctx.fillRect(0, 0, world.size, world.size);

  for (const lot of world.cells) {
    if (lot.x + lot.w < view.x0 || lot.x > view.x1 || lot.y + lot.h < view.y0 || lot.y > view.y1) continue;
    drawLot(ctx, lot, night, opts.time || 0);
  }

  // Road network: asphalt strips, lane dashes and crosswalks at intersections.
  drawRoads(ctx, world, night);

  for (const lot of world.cells) {
    if (lot.x + lot.w < view.x0 || lot.x > view.x1 || lot.y + lot.h < view.y0 || lot.y > view.y1) continue;
    for (const p of lot.props) drawProp(ctx, p, night, opts.time || 0);
    for (const b of lot.buildings) drawBuilding(ctx, b, night);
  }

  ctx.restore();
}

function mix(a, b, t) {
  // Cheap hex mix for the day/night ground tint.
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const r = Math.round((pa >> 16) * (1 - t) + (pb >> 16) * t);
  const g = Math.round(((pa >> 8) & 255) * (1 - t) + ((pb >> 8) & 255) * t);
  const bl = Math.round((pa & 255) * (1 - t) + (pb & 255) * t);
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1);
}

function drawRoads(ctx, world, night) {
  const asphalt = mix(PALETTE.asphalt, '#323b52', night);
  for (let i = 0; i <= GRID; i += 1) {
    const p = i * CELL;
    const start = Math.max(0, p - CELL / 2);
    ctx.fillStyle = asphalt;
    ctx.fillRect(p - ROAD_HALF, 0, ROAD_WIDTH, world.size);
    ctx.fillRect(0, p - ROAD_HALF, world.size, ROAD_WIDTH);
    ctx.fillStyle = withAlpha(PALETTE.lane, 0.8 - night * 0.4);
    for (let y = start; y < start + CELL; y += 56) {
      if (y >= 0 && y <= world.size) ctx.fillRect(p - 2, y, 4, 26);
    }
    for (let x = start; x < start + CELL; x += 56) {
      if (x >= 0 && x <= world.size) ctx.fillRect(x, p - 2, 26, 4);
    }
  }
  // Crosswalks.
  ctx.fillStyle = withAlpha('#e9edf2', 0.5 - night * 0.2);
  for (let i = 1; i < GRID; i += 1) {
    for (let j = 1; j < GRID; j += 1) {
      const x = i * CELL, y = j * CELL;
      for (let k = 0; k < 5; k += 1) {
        ctx.fillRect(x - 24 + k * 11, y - ROAD_HALF - 6, 7, 6);
        ctx.fillRect(x - 24 + k * 11, y + ROAD_HALF, 7, 6);
      }
    }
  }
}
const ROAD_WIDTH = CELL - BLOCK;
const ROAD_HALF = ROAD_WIDTH / 2;

function drawLot(ctx, lot, night, time) {
  const { x, y, w, h, district } = lot;
  if (district === 'beach') {
    ctx.fillStyle = mix('#d9c896', '#6b6650', night);
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = withAlpha('#fff3c4', 0.25);
    ctx.fillRect(x, y + h * 0.34, w, 4);
    return;
  }
  if (district === 'docks' || district === 'harbour') {
    ctx.fillStyle = mix('#6a6f73', '#30353d', night);
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = withAlpha('#d7d2c4', 0.18);
    for (let i = 0; i < 4; i += 1) ctx.fillRect(x + 10, y + 20 + i * 52, w - 20, 2);
    return;
  }
  // Sidewalk band and inner lot.
  ctx.fillStyle = mix(PALETTE.sidewalk, '#4d5666', night);
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = district === 'suburbs' ? mix('#6f9a55', '#334a35', night) : mix('#8f8a80', '#484a52', night);
  ctx.fillRect(x + 26, y + 26, w - 52, h - 52);
  // Lot name decal on the sidewalk (district identity, readable from above).
  if (!night) {
    ctx.fillStyle = 'rgba(20,30,40,0.22)';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(lot.street, x + 6, y - 5);
  }
}

function drawBuilding(ctx, b, night) {
  const ex = b.height * 0.30, ey = -b.height * 0.52;
  const { x, y, w, h } = b;
  // Long low-sun shadow to the south-east.
  ctx.fillStyle = `rgba(8,12,22,${0.22 + night * 0.18})`;
  ctx.fillRect(x + 14 + ex * 0.5, y + 16 - ey * 0.3, w, h);

  const shade = (hex, f) => {
    const p = parseInt(hex.slice(1), 16);
    const r = Math.min(255, Math.round((p >> 16) * f));
    const g = Math.min(255, Math.round(((p >> 8) & 255) * f));
    const bl = Math.min(255, Math.round((p & 255) * f));
    return `rgb(${r},${g},${bl})`;
  };
  const base = mix(b.color, '#68738f', night);
  // East wall.
  ctx.fillStyle = shade(base, 0.78);
  quad(ctx, x + w, y, x + w + ex, y + ey, x + w + ex, y + ey + h, x + w, y + h);
  // South wall.
  ctx.fillStyle = shade(base, 0.94);
  quad(ctx, x, y + h, x + w, y + h, x + w + ex, y + ey + h, x + ex, y + ey + h);
  // Roof.
  ctx.fillStyle = shade(base, 1.12);
  ctx.fillRect(x + ex, y + ey, w, h);
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + ex + 0.5, y + ey + 0.5, w - 1, h - 1);

  // Windows on the south and east faces; they glow at night.
  const litAlpha = 0.12 + night * 0.82;
  const wc = b.lit ? withAlpha(night > 0.4 ? PALETTE.neonGold : '#cfe8ff', litAlpha) : 'rgba(20,26,34,0.5)';
  ctx.fillStyle = wc;
  const cw = 6, ch = 7, gap = 10;
  for (let r = 0; r < Math.min(b.rows, 9); r += 1) {
    for (let c = 0; c < Math.min(b.cols, 9); c += 1) {
      const wx = x + ex + 8 + c * gap;
      const wy = y + ey + h - 12 - r * gap;
      if (wy > y + ey + 2) ctx.fillRect(wx, wy, cw, ch);
      const gx = x + w + ex * (1 - r / Math.max(1, b.rows)) - 6;
      const gy = y + ey + 10 + c * gap;
      if (gy < y + ey + h - 6 && r < 6) ctx.fillRect(gx, gy, Math.max(3, ex * 0.22), 6);
    }
  }
  // Rooftop detail.
  ctx.fillStyle = shade(base, 0.7);
  ctx.fillRect(x + ex + w * 0.2, y + ey + h * 0.3, w * 0.25, h * 0.22);
  if (b.kind === 'house') {
    ctx.fillStyle = '#7a4a34';
    ctx.fillRect(x + ex + w * 0.1, y + ey - 6, w * 0.8, 8);
  }
  if (b.neon && night > 0.25) {
    ctx.save();
    ctx.shadowColor = b.neon;
    ctx.shadowBlur = 18;
    ctx.fillStyle = b.neon;
    ctx.fillRect(x + ex + 4, y + ey - 10, w - 8, 5);
    if (b.sign) {
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(b.sign, x + ex + w / 2, y + ey + h + 20);
    }
    ctx.restore();
  }
}

function quad(ctx, x1, y1, x2, y2, x3, y3, x4, y4) {
  ctx.beginPath();
  ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.lineTo(x4, y4);
  ctx.closePath(); ctx.fill();
}

function withAlpha(hex, a) {
  if (hex.startsWith('rgb')) return hex;
  const p = parseInt(hex.slice(1), 16);
  return `rgba(${p >> 16},${(p >> 8) & 255},${p & 255},${a})`;
}

function drawProp(ctx, p, night, time) {
  switch (p.type) {
    case 'lamp': {
      const glow = night > 0.3;
      ctx.fillStyle = '#39424c';
      ctx.fillRect(p.x - 2, p.y - 26, 4, 26);
      ctx.fillStyle = glow ? withAlpha(PALETTE.neonGold, 0.9) : '#d9dde0';
      ctx.beginPath(); ctx.arc(p.x, p.y - 27, 5, 0, Math.PI * 2); ctx.fill();
      if (glow) {
        ctx.fillStyle = withAlpha(PALETTE.neonGold, 0.07);
        ctx.beginPath(); ctx.arc(p.x, p.y - 27, 30, 0, Math.PI * 2); ctx.fill();
      }
      break;
    }
    case 'tree': case 'palm': {
      ctx.fillStyle = p.type === 'palm' ? '#8a6b43' : '#5c4630';
      ctx.fillRect(p.x - 3, p.y - 22, 6, 22);
      ctx.fillStyle = withAlpha(p.type === 'palm' ? '#2f8f5a' : '#3f7d3e', 0.95 - night * 0.4);
      if (p.type === 'palm') {
        for (let i = 0; i < 6; i += 1) {
          const a = i * Math.PI / 3;
          ctx.beginPath();
          ctx.ellipse(p.x + Math.cos(a) * 16, p.y - 24 + Math.sin(a) * 7, 16, 4, a, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        ctx.beginPath(); ctx.arc(p.x, p.y - 26, 15, 0, Math.PI * 2); ctx.fill();
      }
      break;
    }
    case 'bench':
      ctx.fillStyle = '#7c5a3c';
      ctx.fillRect(p.x - 18, p.y - 4, 36, 7);
      ctx.fillStyle = '#4a4f56'; ctx.fillRect(p.x - 16, p.y + 3, 4, 6); ctx.fillRect(p.x + 12, p.y + 3, 4, 6);
      break;
    case 'hydrant':
      ctx.fillStyle = '#d04343'; ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2); ctx.fill();
      break;
    case 'container':
      ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, 48, 24);
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      for (let i = 1; i < 6; i += 1) { ctx.beginPath(); ctx.moveTo(p.x + i * 8, p.y); ctx.lineTo(p.x + i * 8, p.y + 24); ctx.stroke(); }
      break;
    case 'crane':
      ctx.strokeStyle = '#e0a33c'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x, p.y - 70); ctx.lineTo(p.x + 80, p.y - 60); ctx.stroke();
      ctx.lineWidth = 1;
      break;
    case 'boardwalk':
      ctx.fillStyle = '#a87a4e'; ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.strokeStyle = 'rgba(60,40,20,0.35)';
      for (let xx = p.x; xx < p.x + p.w; xx += 12) { ctx.beginPath(); ctx.moveTo(xx, p.y); ctx.lineTo(xx, p.y + p.h); ctx.stroke(); }
      break;
    case 'umbrella':
      ctx.fillStyle = p.color || '#ff5f7a';
      ctx.beginPath(); ctx.arc(p.x, p.y, 12, Math.PI, 0); ctx.fill();
      break;
    case 'driveway':
      ctx.fillStyle = '#8d8b84'; ctx.fillRect(p.x - 16, p.y, 32, 24);
      break;
    case 'neon':
      if (night > 0.2) {
        ctx.save(); ctx.shadowColor = p.color; ctx.shadowBlur = 16;
        ctx.strokeStyle = p.color; ctx.lineWidth = 3;
        ctx.strokeRect(p.x, p.y, 34, 14); ctx.restore();
      }
      break;
    default: break;
  }
}
