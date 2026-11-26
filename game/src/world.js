// The valley of Aruna: one seeded heightmap, a river, a grass runway, a
// little town, and six glowing rings hung along a ridge-running course.
// Everything here is deterministic — same seed, same valley, every run.
import { CONFIG, COLOURS } from './config.js';
import { fbmNoise, valueNoise, clamp, lerp, mulberry32 } from './random.js';

const N = CONFIG.gridCells + 1; // vertices per side
const CELL = CONFIG.cellSize;
const HALF = CONFIG.halfWorld;

// A volcanic cone on the north-east shoulder, so the horizon always has a
// recognisable peak to fly around.
const VOLCANO = { x: 1500, z: -1750, radius: 900, height: 520 };

function baseHeight(x, z) {
  // Broad rolling hills, then a ridge line that climbs to the north.
  let h = fbmNoise(x * 0.00045 + 31, z * 0.00045 + 17, CONFIG.terrainSeed, 4);
  h = h * h * 150; // 0..150 m of rolling ground
  const north = clamp((-z - 400) / 2200, 0, 1); // the north wall climbs
  h += north * north * 190;
  // The volcano cone, with a crater dip at its summit.
  const dv = Math.hypot(x - VOLCANO.x, z - VOLCANO.z);
  const cone = Math.max(0, 1 - dv / VOLCANO.radius);
  h += cone * cone * VOLCANO.height;
  if (dv < 150) h -= (1 - dv / 150) * 90; // crater bowl
  // A river valley carving south-west to north-east through the middle.
  const riverDist = Math.abs((x - z * 0.35) * 0.92);
  const carve = Math.max(0, 1 - riverDist / 260);
  h -= carve * carve * 34;
  return h;
}

// The heightmap, built once at load. The runway strip is flattened to the
// valley floor so landings are fair, and the town sits on a level pad.
const heights = new Float32Array(N * N);
for (let j = 0; j < N; j++) {
  for (let i = 0; i < N; i++) {
    const x = -HALF + i * CELL;
    const z = -HALF + j * CELL;
    heights[j * N + i] = baseHeight(x, z);
  }
}

const RW = CONFIG.runway;
const runwayHeadingRad = (RW.heading * Math.PI) / 180;
const runwayDir = { x: Math.sin(runwayHeadingRad), z: Math.cos(runwayHeadingRad) };
const runwaySide = { x: Math.cos(runwayHeadingRad), z: -Math.sin(runwayHeadingRad) };
// Flatten the strip: every vertex near the runway centreline is pulled to
// the strip's own ground level.
const stripLevel = 58;
for (let j = 0; j < N; j++) {
  for (let i = 0; i < N; i++) {
    const x = -HALF + i * CELL;
    const z = -HALF + j * CELL;
    const along = (x - RW.x) * runwayDir.x + (z - RW.z) * runwayDir.z;
    const across = Math.abs((x - RW.x) * runwaySide.x + (z - RW.z) * runwaySide.z);
    if (Math.abs(along) < RW.length / 2 + 90 && across < RW.width / 2 + 90) {
      const edge = clamp((RW.width / 2 + 90 - across) / 90, 0, 1);
      const t = clamp(edge * 1.4, 0, 1);
      heights[j * N + i] = lerp(heights[j * N + i], stripLevel, t);
    }
  }
}

export function terrainHeight(x, z) {
  const gx = clamp((x + HALF) / CELL, 0, CONFIG.gridCells - 0.001);
  const gz = clamp((z + HALF) / CELL, 0, CONFIG.gridCells - 0.001);
  const i = Math.floor(gx), j = Math.floor(gz);
  const fx = gx - i, fz = gz - j;
  const a = heights[j * N + i], b = heights[j * N + i + 1];
  const c = heights[(j + 1) * N + i], d = heights[(j + 1) * N + i + 1];
  return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
}

export function terrainColour(x, z, h) {
  // Colour by height and by noise: fields, forest patches, rock, snow.
  const n = fbmNoise(x * 0.004 + 7, z * 0.004 + 3, CONFIG.terrainSeed + 5, 3);
  const riverDist = Math.abs((x - z * 0.35) * 0.92);
  if (riverDist < 26 && h < 96) return h < 70 ? COLOURS.waterDeep : COLOURS.water;
  if (h > 300) return COLOURS.snow;
  if (h > 210) return COLOURS.rock;
  if (n > 0.62) return COLOURS.forest;
  if (n > 0.52) return COLOURS.fieldGold;
  return h < 90 ? COLOURS.grassLow : COLOURS.grassHigh;
}

// The ring course: a tour of the valley — down the river, around the
// volcano shoulder, over the town, and back to the runway threshold.
export const RINGS = [
  { x: -180, z: 620, y: 150 },
  { x: 420, z: -120, y: 210 },
  { x: 1050, z: -760, y: 300 },
  { x: 1750, z: -1200, y: 300 },
  { x: 300, z: -1900, y: 400 },
  { x: -260, z: -900, y: 260 },
];

export function ringCentre(i) { return RINGS[i]; }

// Clouds: a few dozen soft billboards drifting slowly over the valley.
const cloudRand = mulberry32(77);
export const CLOUDS = [];
for (let i = 0; i < 42; i++) {
  CLOUDS.push({
    x: (cloudRand() - 0.5) * 4800,
    z: (cloudRand() - 0.5) * 4800,
    y: 420 + cloudRand() * 260,
    r: 90 + cloudRand() * 170,
    drift: 1.5 + cloudRand() * 2,
  });
}

// The town of Kalibaru: a cluster of small blocks beside the runway, for
// the eye to recognise from the air.
const townRand = mulberry32(911);
export const TOWN = [];
for (let i = 0; i < 26; i++) {
  const a = townRand() * Math.PI * 2;
  const d = 120 + townRand() * 260;
  TOWN.push({
    x: RW.x + 260 + Math.cos(a) * d * 0.7,
    z: RW.z + 420 + Math.sin(a) * d * 0.55,
    w: 14 + townRand() * 22,
    d: 12 + townRand() * 18,
    h: 8 + townRand() * 16,
    roof: townRand() > 0.5,
  });
}

export function worldBounds(x, z) {
  return Math.abs(x) < HALF && Math.abs(z) < HALF;
}
