// The chase camera and the valley it sees: sky, sun, clouds, terrain,
// river, town, runway and rings, all projected from the same pinhole
// camera, all drawn on one canvas with no images and no libraries.
import { CONFIG } from './config.js';
import { clamp, lerp } from './random.js';
import { terrainHeight, terrainColour, RINGS, CLOUDS, TOWN } from './world.js';

// A tiny 3D vector helper, kept local so the file reads on its own.
function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function norm(a) {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}

export function makeCamera(w, h) {
  const f = (h / 2) / Math.tan((CONFIG.fov * Math.PI) / 360);
  return { w, h, f, cx: w / 2, cy: h / 2, pos: [0, 0, 0], right: [1, 0, 0], up: [0, 1, 0], fwd: [0, 0, 1] };
}

// Aim the chase camera behind and above the plane, smoothed so it never
// fights the pilot, and look a little ahead of the nose.
export function aimCamera(cam, p, dt, smooth) {
  const fx = Math.sin(p.heading), fz = Math.cos(p.heading);
  const back = CONFIG.chaseDistance;
  const tx = p.x - fx * back, tz = p.z - fz * back;
  const ty = p.y + CONFIG.chaseHeight + Math.max(0, p.pitch) * 4;
  const k = 1 - Math.pow(0.0001, dt); // frame-rate independent smoothing
  smooth.x = lerp(smooth.x, tx, k);
  smooth.y = lerp(smooth.y, ty, k);
  smooth.z = lerp(smooth.z, tz, k);
  cam.pos = [smooth.x, smooth.y, smooth.z];
  const look = [p.x + fx * 60, p.y + Math.sin(p.pitch) * 30, p.z + fz * 60];
  cam.fwd = norm(sub(look, cam.pos));
  const worldUp = [0, 1, 0];
  cam.right = norm(cross(cam.fwd, worldUp));
  cam.up = cross(cam.right, cam.fwd);
}

// Slide the camera sideways along its own right axis without turning it:
// the subject drifts across the frame, which is how the title and results
// shots keep the plane out from behind their panels.
export function panCamera(cam, metres) {
  cam.pos = [
    cam.pos[0] + cam.right[0] * metres,
    cam.pos[1] + cam.right[1] * metres,
    cam.pos[2] + cam.right[2] * metres,
  ];
}

export function project(cam, x, y, z) {
  const d = sub([x, y, z], cam.pos);
  const cz = dot(d, cam.fwd);
  if (cz < 0.8) return null;
  const cx = dot(d, cam.right), cy = dot(d, cam.up);
  return { x: cam.cx + (cx * cam.f) / cz, y: cam.cy - (cy * cam.f) / cz, d: cz };
}

// The ground-plane projection: like project, but a corner that falls just
// behind the camera is clamped instead of dropped, so the near field
// under the camera never leaves a hole in the terrain.
export function projectGround(cam, x, y, z) {
  const d = sub([x, y, z], cam.pos);
  const cz = Math.max(1.2, dot(d, cam.fwd));
  const cx = dot(d, cam.right), cy = dot(d, cam.up);
  return { x: cam.cx + (cx * cam.f) / cz, y: cam.cy - (cy * cam.f) / cz, d: cz };
}

function drawSky(ctx, cam, time) {
  const g = ctx.createLinearGradient(0, 0, 0, cam.h);
  g.addColorStop(0, CONFIG.skyTop);
  g.addColorStop(0.55, CONFIG.skyMid);
  g.addColorStop(0.78, CONFIG.skyHorizon);
  g.addColorStop(1, '#9db98a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, cam.w, cam.h);
  // Low sun, north-west, so the valley has long light.
  const sun = project(cam, cam.pos[0] - 2600, cam.pos[1] + 900, cam.pos[2] - 3200);
  if (sun) {
    const r = 46;
    const glow = ctx.createRadialGradient(sun.x, sun.y, 4, sun.x, sun.y, r * 3);
    glow.addColorStop(0, 'rgba(255, 244, 200, 0.95)');
    glow.addColorStop(0.25, 'rgba(255, 226, 150, 0.55)');
    glow.addColorStop(1, 'rgba(255, 226, 150, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(sun.x, sun.y, r * 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff6cf';
    ctx.beginPath(); ctx.arc(sun.x, sun.y, r * 0.55, 0, Math.PI * 2); ctx.fill();
  }
  void time;
}

function drawClouds(ctx, cam, time) {
  ctx.save();
  for (const c of CLOUDS) {
    const cx = c.x + time * c.drift;
    const s = project(cam, cx, c.y, c.z);
    if (!s || s.d > 3200) continue;
    const r = (c.r * cam.f) / s.d;
    if (r < 4) continue;
    ctx.fillStyle = 'rgba(255,255,255,0.82)';
    // Each puff is its own fill: one path of overlapping ellipses leaves
    // sharp triangular gaps where the fills cross.
    for (const [ox, oy, rx, ry] of [[0, 0, 1, 0.32], [-0.5, 0.08, 0.6, 0.22], [0.5, 0.06, 0.65, 0.24]]) {
      ctx.beginPath();
      ctx.ellipse(s.x + ox * r, s.y + oy * r, rx * r, ry * r, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

// Terrain as quads, far to near. Only cells inside the view cone and the
// view distance are drawn, and each quad is shaded by height and slope.
function drawTerrain(ctx, cam, p) {
  const CELL = CONFIG.cellSize, N = CONFIG.gridCells;
  const HALF = CONFIG.halfWorld;
  const view = CONFIG.viewDistance;
  const fx = Math.sin(p.heading), fz = Math.cos(p.heading);
  const quads = [];
  const i0 = Math.max(0, Math.floor((p.x - view + HALF) / CELL));
  const i1 = Math.min(N - 1, Math.ceil((p.x + view + HALF) / CELL));
  const j0 = Math.max(0, Math.floor((p.z - view + HALF) / CELL));
  const j1 = Math.min(N - 1, Math.ceil((p.z + view + HALF) / CELL));
  for (let j = j0; j < j1; j++) {
    for (let i = i0; i < i1; i++) {
      const x0 = -HALF + i * CELL, z0 = -HALF + j * CELL;
      const cx = x0 + CELL / 2, cz = z0 + CELL / 2;
      const dx = cx - p.x, dz = cz - p.z;
      const along = dx * fx + dz * fz;
      if (along < -80 || along > view) continue;
      const dist2 = dx * dx + dz * dz;
      if (dist2 > view * view) continue;
      quads.push({ i, j, x0, z0, d: dist2 });
    }
  }
  quads.sort((a, b) => b.d - a.d);
  for (const q of quads) {
    const x0 = q.x0, z0 = q.z0, x1 = x0 + CELL, z1 = z0 + CELL;
    const h00 = terrainHeight(x0, z0), h10 = terrainHeight(x1, z0);
    const h01 = terrainHeight(x0, z1), h11 = terrainHeight(x1, z1);
    const p00 = projectGround(cam, x0, h00, z0), p10 = projectGround(cam, x1, h10, z0);
    const p01 = projectGround(cam, x0, h01, z1), p11 = projectGround(cam, x1, h11, z1);
    const hAvg = (h00 + h10 + h01 + h11) / 4;
    const slope = Math.abs(h10 - h00) + Math.abs(h01 - h00);
    let colour = terrainColour(x0 + CELL / 2, z0 + CELL / 2, hAvg);
    // Slope shading: steeper faces read darker, so ridges stand out.
    const shade = clamp(1 - slope * 0.012, 0.78, 1);
    ctx.fillStyle = shadeColour(colour, shade);
    ctx.beginPath();
    ctx.moveTo(p00.x, p00.y); ctx.lineTo(p10.x, p10.y);
    ctx.lineTo(p11.x, p11.y); ctx.lineTo(p01.x, p01.y);
    ctx.closePath(); ctx.fill();
  }
}

function shadeColour(hex, f) {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${Math.round(r * f)},${Math.round(g * f)},${Math.round(b * f)})`;
}

function drawRunway(ctx, cam) {
  const rw = CONFIG.runway;
  const h = (rw.heading * Math.PI) / 180;
  const dx = Math.sin(h), dz = Math.cos(h);
  const sx = Math.cos(h), sz = -Math.sin(h);
  const halfL = rw.length / 2, halfW = rw.width / 2;
  const corners = [
    [rw.x - dx * halfL - sx * halfW, rw.z - dz * halfL - sz * halfW],
    [rw.x + dx * halfL - sx * halfW, rw.z + dz * halfL - sz * halfW],
    [rw.x + dx * halfL + sx * halfW, rw.z + dz * halfL + sz * halfW],
    [rw.x - dx * halfL + sx * halfW, rw.z - dz * halfL + sz * halfW],
  ];
  // Ground projection: the strip runs under the camera at the threshold,
  // so a corner behind the camera must stretch, not drop the whole strip.
  const pts = corners.map(([x, z]) => projectGround(cam, x, 58.4, z));
  ctx.fillStyle = '#4a4a48';
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < 4; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath(); ctx.fill();
  // Centreline dashes and the "27" threshold numerals' ground paint.
  ctx.fillStyle = '#f2f0e4';
  for (let t = -halfL + 40; t < halfL - 30; t += 52) {
    const a = projectGround(cam, rw.x + dx * t - sx * 1.2, 58.6, rw.z + dz * t - sz * 1.2);
    const b = projectGround(cam, rw.x + dx * (t + 26) - sx * 1.2, 58.6, rw.z + dz * (t + 26) - sz * 1.2);
    const c = projectGround(cam, rw.x + dx * (t + 26) + sx * 1.2, 58.6, rw.z + dz * (t + 26) + sz * 1.2);
    const d = projectGround(cam, rw.x + dx * t + sx * 1.2, 58.6, rw.z + dz * t + sz * 1.2);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y);
    ctx.closePath(); ctx.fill();
  }
}

function drawTown(ctx, cam) {
  for (const b of TOWN) {
    const g = terrainHeight(b.x, b.z);
    const top = g + b.h;
    const c = [
      [b.x - b.w / 2, b.z - b.d / 2], [b.x + b.w / 2, b.z - b.d / 2],
      [b.x + b.w / 2, b.z + b.d / 2], [b.x - b.w / 2, b.z + b.d / 2],
    ];
    const base = c.map(([x, z]) => projectGround(cam, x, g, z));
    const roof = c.map(([x, z]) => projectGround(cam, x, top, z));
    ctx.fillStyle = '#d8c9a8';
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      ctx.beginPath();
      ctx.moveTo(base[i].x, base[i].y); ctx.lineTo(base[j].x, base[j].y);
      ctx.lineTo(roof[j].x, roof[j].y); ctx.lineTo(roof[i].x, roof[i].y);
      ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = b.roof ? '#a5503c' : '#7a6a55';
    ctx.beginPath();
    ctx.moveTo(roof[0].x, roof[0].y);
    for (let i = 1; i < 4; i++) ctx.lineTo(roof[i].x, roof[i].y);
    ctx.closePath(); ctx.fill();
  }
}

// Rings: a glowing hoop plus a light pillar, so the next target reads from
// a kilometre away. Cleared rings show green and dim.
function drawRings(ctx, cam, ringsCleared, time) {
  for (let i = 0; i < RINGS.length; i++) {
    const r = RINGS[i];
    const done = i < ringsCleared;
    const next = i === ringsCleared;
    const c = project(cam, r.x, r.y, r.z);
    if (!c) continue;
    const radius = (CONFIG.ringRadius * cam.f) / c.d;
    if (radius < 2) continue;
    const pulse = next ? 0.75 + Math.sin(time * 4) * 0.25 : 0.5;
    ctx.save();
    ctx.globalAlpha = done ? 0.35 : 0.95;
    ctx.strokeStyle = done ? '#37d67a' : next ? '#ffb02e' : '#ff5a3c';
    ctx.lineWidth = Math.max(2, radius * 0.09);
    ctx.shadowColor = ctx.strokeStyle;
    ctx.shadowBlur = next ? 26 * pulse + 8 : 10;
    ctx.beginPath(); ctx.arc(c.x, c.y, radius, 0, Math.PI * 2); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = done ? 0.2 : 0.8;
    ctx.beginPath(); ctx.arc(c.x, c.y, Math.max(2, radius * 0.06), 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // The number plate under the next ring.
    if (next && radius > 14) {
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${Math.round(clamp(radius * 0.5, 13, 30))}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(String(i + 1), c.x, c.y + radius + 26);
    }
  }
}

// The Kutilang-9, drawn as a small solid model from its own vertices so it
// banks, pitches and catches the light like a built aircraft, not a sprite.
const PLANE_VERTS = [
  [0, 0.4, 7.5], [0.5, 0.1, 5.5], [-0.5, 0.1, 5.5], // nose
  [0.7, 0.2, 0.5], [-0.7, 0.2, 0.5], // cabin
  [0.5, 0.1, -6.5], [-0.5, 0.1, -6.5], // tail
  [5.2, -0.1, 1.2], [-5.2, -0.1, 1.2], // wingtips
  [5.2, -0.1, -0.6], [-5.2, -0.1, -0.6],
  [1.9, 0.5, -6.2], [-1.9, 0.5, -6.2], // tailplane
  [0, 1.6, -6.0], [0, 0.3, -6.8], // fin
];
const PLANE_FACES = [
  { v: [0, 1, 3, 5], c: '#d8433a' }, // fuselage right
  { v: [0, 5, 6, 2], c: '#b03028' }, // fuselage left
  { v: [1, 2, 6, 5], c: '#8f241f' }, // belly
  { v: [3, 4, 6, 5], c: '#e8604f' }, // cabin top
  { v: [7, 9, 5, 3], c: '#f4f1e6' }, // right wing
  { v: [8, 4, 6, 10], c: '#ddd8c6' }, // left wing
  { v: [11, 12, 6, 5], c: '#f4f1e6' }, // tailplane
  { v: [13, 14, 6], c: '#d8433a' }, // fin
];

function rotatePlane(v, heading, pitch, roll) {
  // Local axes: +z forward, +y up, +x right. Apply roll, then pitch, then
  // heading (yaw), so the model follows the flight state exactly.
  let [x, y, z] = v;
  const cr = Math.cos(roll), sr = Math.sin(roll);
  [x, y] = [x * cr - y * sr, x * sr + y * cr];
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  [y, z] = [y * cp - z * sp, y * sp + z * cp];
  const ch = Math.cos(heading), sh = Math.sin(heading);
  [x, z] = [x * ch + z * sh, -x * sh + z * ch];
  return [x, y, z];
}

export function drawPlane(ctx, cam, p) {
  const projected = PLANE_VERTS.map((v) => {
    const [x, y, z] = rotatePlane(v, p.heading, p.pitch, p.roll);
    return project(cam, p.x + x, p.y + y, p.z + z);
  });
  if (projected.some((q) => !q)) return;
  // Painters: far faces first, by average depth.
  const faces = PLANE_FACES.map((f) => {
    const depth = f.v.reduce((s, i) => s + projected[i].d, 0) / f.v.length;
    return { ...f, depth };
  }).sort((a, b) => b.depth - a.depth);
  for (const f of faces) {
    ctx.fillStyle = f.c;
    ctx.beginPath();
    ctx.moveTo(projected[f.v[0]].x, projected[f.v[0]].y);
    for (let i = 1; i < f.v.length; i++) ctx.lineTo(projected[f.v[i]].x, projected[f.v[i]].y);
    ctx.closePath(); ctx.fill();
  }
  // Spinning prop disc at the nose: a faint blur, not a bubble.
  const nose = projected[0];
  const propR = Math.max(2, (1.6 * cam.f) / projected[0].d);
  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = '#cfd6da';
  ctx.beginPath(); ctx.arc(nose.x, nose.y, propR, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

export function drawScene(ctx, cam, p, time, smooth) {
  drawSky(ctx, cam, time);
  drawClouds(ctx, cam, time);
  drawTerrain(ctx, cam, p);
  drawRunway(ctx, cam);
  drawTown(ctx, cam);
  drawRings(ctx, cam, p.ringsCleared, time);
  drawPlane(ctx, cam, p);
  void smooth;
}
