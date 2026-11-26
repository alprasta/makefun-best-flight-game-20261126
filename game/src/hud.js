// The lit instruments: speed and altitude tapes, compass, attitude ball,
// fuel, rings, timer — plus the title, pause and results screens. All of
// it is drawn on the canvas so a screenshot always shows the whole game.
import { CONFIG } from './config.js';
import { clamp } from './random.js';
import { speedKnots, altitudeFeet, headingDegrees } from './physics.js';
import { RINGS } from './world.js';

const PANEL = 'rgba(10, 18, 26, 0.72)';
const GLOW = '#7dffb0';
const AMBER = '#ffb02e';
const RED = '#ff5a3c';

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = PANEL;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 8); ctx.fill();
  ctx.strokeStyle = 'rgba(125,255,176,0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function tape(ctx, x, y, w, h, value, step, unit, label) {
  // Tapes never show negative readings: a parked plane reads 0, not -20.
  value = Math.max(0, value);
  panel(ctx, x, y, w, h);
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '12px system-ui, sans-serif';
  ctx.textAlign = 'left';
  const centre = y + h / 2;
  const pxPerUnit = h / (step * 6);
  const base = Math.floor(value / step) * step;
  for (let v = Math.max(0, base - step * 3); v <= base + step * 3; v += step) {
    const yy = centre - (v - value) * pxPerUnit;
    if (yy < y + 8 || yy > y + h - 8) continue;
    ctx.fillRect(x + 6, yy, 10, 1);
    ctx.fillText(String(v), x + 20, yy + 4);
  }
  ctx.restore();
  // The readout box.
  ctx.fillStyle = '#0a121a';
  ctx.fillRect(x - 4, centre - 13, w + 8, 26);
  ctx.strokeStyle = GLOW; ctx.strokeRect(x - 4, centre - 13, w + 8, 26);
  ctx.fillStyle = GLOW;
  ctx.font = 'bold 17px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(String(Math.round(value)), x + w / 2, centre + 6);
  // The unit label sits under the panel, clear of the tick numbers.
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillText(label + ' ' + unit, x + w / 2, y + h + 16);
}

export function drawHud(ctx, w, h, p, time, message) {
  // Compass tape across the top.
  const hdg = headingDegrees(p);
  panel(ctx, w / 2 - 190, 12, 380, 34);
  ctx.save();
  ctx.beginPath(); ctx.rect(w / 2 - 190, 12, 380, 34); ctx.clip();
  ctx.fillStyle = '#fff';
  ctx.font = '12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  const pxPerDeg = 380 / 120;
  for (let d = Math.floor((hdg - 60) / 10) * 10; d <= hdg + 60; d += 10) {
    const dd = ((d % 360) + 360) % 360;
    const xx = w / 2 + (d - hdg) * pxPerDeg;
    ctx.fillRect(xx, 16, 1, 8);
    // Labels every 30 degrees only: a label on every tick crowds the tape.
    if (dd % 30 !== 0) continue;
    const names = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' };
    ctx.fillText(names[dd] || String(dd).padStart(3, '0'), xx, 38);
  }
  ctx.restore();
  ctx.fillStyle = AMBER;
  ctx.beginPath();
  ctx.moveTo(w / 2, 12); ctx.lineTo(w / 2 - 6, 4); ctx.lineTo(w / 2 + 6, 4);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = GLOW;
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.fillText(String(hdg).padStart(3, '0') + '°', w / 2, 62);

  // Speed tape (left), altitude tape (right).
  tape(ctx, 16, 70, 92, 190, speedKnots(p), 10, 'KT', 'SPD');
  tape(ctx, w - 108, 70, 92, 190, altitudeFeet(p), 100, 'FT', 'ALT');
  // Vertical speed under the altitude tape, clear of its unit label.
  ctx.fillStyle = p.verticalSpeed > 1 ? GLOW : p.verticalSpeed < -3 ? RED : '#fff';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  const vs = Math.round(p.verticalSpeed * 196.85);
  ctx.fillText((vs >= 0 ? '+' : '') + vs + ' FPM', w - 62, 296);

  // Attitude indicator, bottom left: a ball that rolls and pitches.
  const ax = 78, ay = h - 78, ar = 54;
  ctx.save();
  ctx.beginPath(); ctx.arc(ax, ay, ar, 0, Math.PI * 2); ctx.clip();
  ctx.translate(ax, ay);
  ctx.rotate(-p.roll);
  ctx.translate(0, p.pitch * 90);
  ctx.fillStyle = '#2f6fb4'; ctx.fillRect(-ar, -ar * 2, ar * 2, ar * 2);
  ctx.fillStyle = '#8a6a42'; ctx.fillRect(-ar, 0, ar * 2, ar * 2);
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-ar, 0); ctx.lineTo(ar, 0); ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = GLOW; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(ax, ay, ar, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = AMBER;
  ctx.beginPath();
  ctx.moveTo(ax - 16, ay); ctx.lineTo(ax + 16, ay); ctx.lineTo(ax, ay + 6);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = '11px system-ui, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('ATTITUDE', ax, ay + ar + 16);

  // Throttle bar, bottom centre-left.
  panel(ctx, 150, h - 46, 170, 26);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(158, h - 38, 120, 10);
  ctx.fillStyle = p.fuel <= 0 ? RED : GLOW;
  ctx.fillRect(158, h - 38, 120 * clamp(p.throttle, 0, 1), 10);
  ctx.fillStyle = '#fff'; ctx.font = '11px system-ui, sans-serif'; ctx.textAlign = 'left';
  ctx.fillText('THR ' + Math.round(p.throttle * 100) + '%', 284, h - 28);

  // Fuel gauge, bottom centre.
  panel(ctx, w / 2 - 70, h - 46, 140, 26);
  ctx.fillStyle = p.fuel < 20 ? RED : AMBER;
  ctx.fillRect(w / 2 - 62, h - 38, 84 * clamp(p.fuel / 100, 0, 1), 10);
  ctx.fillStyle = '#fff'; ctx.font = '11px system-ui, sans-serif'; ctx.textAlign = 'left';
  ctx.fillText('FUEL ' + Math.round(p.fuel) + '%', w / 2 + 30, h - 28);

  // Mission block, top right: rings, score, clock.
  panel(ctx, w - 208, 12, 192, 86);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 15px system-ui, sans-serif'; ctx.textAlign = 'left';
  ctx.fillText('RINGS  ' + p.ringsCleared + ' / ' + RINGS.length, w - 196, 34);
  ctx.fillText('SCORE  ' + p.score, w - 196, 56);
  const t = Math.max(0, CONFIG.missionTimeLimit - p.time);
  ctx.fillStyle = t < 60 ? RED : '#fff';
  ctx.fillText('LEFT  ' + fmtTime(t), w - 196, 78);
  if (p.stalled) {
    ctx.fillStyle = RED; ctx.font = 'bold 20px system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('STALL — NOSE DOWN, ADD POWER', w / 2, h - 110);
  }
  if (p.fuel <= 0 && !p.landed) {
    ctx.fillStyle = RED; ctx.font = 'bold 18px system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('FUEL EMPTY — GLIDING', w / 2, h - 84);
  }

  // Next-ring pointer: a chevron at the screen edge when the ring is off-view.
  if (p.ringsCleared < RINGS.length && !p.landed && !p.crashed) {
    const r = RINGS[p.ringsCleared];
    const dx = r.x - p.x, dz = r.z - p.z;
    const bearing = Math.atan2(dx, dz);
    let rel = bearing - p.heading;
    while (rel > Math.PI) rel -= Math.PI * 2;
    while (rel < -Math.PI) rel += Math.PI * 2;
    const dist = Math.round(Math.hypot(dx, dz));
    ctx.fillStyle = AMBER; ctx.font = 'bold 14px system-ui, sans-serif'; ctx.textAlign = 'center';
    const arrow = rel > 0.15 ? '▶ RING ' + dist + 'm — TURN RIGHT' : rel < -0.15 ? '◀ RING ' + dist + 'm — TURN LEFT' : '▲ RING ' + dist + 'm AHEAD';
    ctx.fillText(arrow, w / 2, 84);
  } else if (!p.landed && !p.crashed) {
    // Course done: point the pilot at the strip, with its bearing.
    const rw = CONFIG.runway;
    const dx = rw.x - p.x, dz = rw.z - p.z;
    const bearing = Math.atan2(dx, dz);
    let rel = bearing - p.heading;
    while (rel > Math.PI) rel -= Math.PI * 2;
    while (rel < -Math.PI) rel += Math.PI * 2;
    const dist = Math.round(Math.hypot(dx, dz));
    ctx.fillStyle = GLOW; ctx.font = 'bold 15px system-ui, sans-serif'; ctx.textAlign = 'center';
    const arrow = rel > 0.15 ? '▶ STRIP ' + dist + 'm — TURN RIGHT' : rel < -0.15 ? '◀ STRIP ' + dist + 'm — TURN LEFT' : '▲ STRIP ' + dist + 'm — LINE UP AND LAND';
    ctx.fillText(arrow, w / 2, 84);
  }

  // Centre message line (ring cleared, bounce, edge of valley...).
  if (message && message.until > time) {
    ctx.fillStyle = message.colour || '#fff';
    ctx.font = 'bold 22px system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(message.text, w / 2, h * 0.3);
  }
}

export function fmtTime(s) {
  const m = Math.floor(s / 60), ss = Math.floor(s % 60);
  return String(m).padStart(2, '0') + ':' + String(ss).padStart(2, '0');
}

function screenPanel(ctx, w, h, title, lines, accent) {
  ctx.fillStyle = 'rgba(8, 14, 20, 0.55)';
  ctx.fillRect(0, 0, w, h);
  const bw = 620, bh = 92 + lines.length * 30;
  const bx = w / 2 - bw / 2, by = h / 2 - bh / 2;
  ctx.fillStyle = 'rgba(10, 18, 26, 0.88)';
  ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 14); ctx.fill();
  ctx.strokeStyle = accent; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = accent;
  ctx.font = 'bold 34px system-ui, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(title, w / 2, by + 52);
  ctx.fillStyle = '#e8f2e8';
  ctx.font = '16px system-ui, sans-serif';
  lines.forEach((line, i) => ctx.fillText(line, w / 2, by + 92 + i * 30));
}

export function drawTitle(ctx, w, h) {
  screenPanel(ctx, w, h, 'MERAPI RIDGE RUN', [
    'Bush pilot of the Kutilang-9 — fly the Aruna valley, thread six rings,',
    'then bring her home to the grass strip at Kalibaru Field.',
    '',
    '↑ ↓  pitch      ← →  bank & turn      Shift / Ctrl  throttle      B  brake',
    'P  pause      M  sound      R  restart      Mouse: click to start',
    '',
    'Watch your fuel: full throttle drinks it. Stall below 50 knots.',
    'Land on the strip only after all six rings — gently, or she breaks.',
    '',
    'Press ENTER or click to take off',
  ], GLOW);
}

export function drawResults(ctx, w, h, p) {
  const landed = p.landed;
  const lines = landed ? [
    'All six rings threaded, wheels on the grass at Kalibaru.',
    '',
    'Time  ' + fmtTime(p.time) + '     Rings  ' + p.ringsCleared + ' / 6     Fuel left  ' + Math.round(p.fuel) + '%',
    'Landing bonus  +' + CONFIG.landingBonus + '     Time bonus  +' + Math.max(0, Math.round((CONFIG.parTime - p.time) * CONFIG.timeBonusPerSecond)),
    '',
    'FINAL SCORE  ' + p.score,
    '',
    'Press R to fly the valley again',
  ] : [
    p.crashReason || 'The valley wins this one.',
    '',
    'Rings cleared  ' + p.ringsCleared + ' / 6     Score  ' + p.score,
    'Time in the air  ' + fmtTime(p.time),
    '',
    'Press R to try the course again',
  ];
  screenPanel(ctx, w, h, landed ? 'LANDED — WELCOME HOME' : 'CRASHED', lines, landed ? GLOW : RED);
}

export function drawPaused(ctx, w, h) {
  screenPanel(ctx, w, h, 'PAUSED', ['Press P to keep flying', 'Press R to restart the sortie'], AMBER);
}
