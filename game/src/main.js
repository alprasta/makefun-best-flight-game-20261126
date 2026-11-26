// Merapi Ridge Run: the game loop. Title, flying, paused, landed and
// crashed are the only states; the loop is fixed-step physics with a
// smoothed chase camera, and ?shot=… renders one deterministic pose for
// the screenshots instead of starting the loop.
import { CONFIG } from './config.js';
import { newFlight, stepFlight } from './physics.js';
import { RINGS } from './world.js';
import { makeCamera, aimCamera, panCamera, drawScene } from './render.js';
import { drawHud, drawTitle, drawResults, drawPaused } from './hud.js';
import { makeAudio } from './audio.js';
import { makeInput } from './input.js';
import { applyShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const params = new URLSearchParams(location.search);
const shotName = params.get('shot');

const audio = makeAudio();
const input = makeInput();
input.attach();

let flight = newFlight();
let state = 'title'; // title | flying | paused | landed | crashed
let message = null;
let time = 0;
let last = performance.now();
let cam = makeCamera(canvas.width, canvas.height);
let smoothCam = { x: flight.x, y: flight.y + 8, z: flight.z - 20 };

function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  cam = makeCamera(canvas.width, canvas.height);
}
window.addEventListener('resize', resize);
resize();

function showMessage(text, colour, seconds) {
  message = { text, colour: colour || '#ffffff', until: time + (seconds || 2.5) };
}

function resetFlight() {
  flight = newFlight();
  state = 'title';
  smoothCam = { x: flight.x, y: flight.y + 8, z: flight.z - 24 };
  statusEl.textContent = 'Merapi Ridge Run. Press Enter to take off.';
}

function render() {
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  const dt = 1 / 60;
  aimCamera(cam, flight, dt, smoothCam);
  // On the panel shots the camera slides sideways after aiming, so the
  // plane sits clear of the title and results panels (aiming again would
  // undo the slide, so this runs here, inside the render, every frame).
  if (shotName === 'start' || shotName === 'end') panCamera(cam, 16);
  drawScene(ctx, cam, flight, time, smoothCam);
  if (state === 'title') drawTitle(ctx, w, h);
  else if (state === 'paused') { drawHud(ctx, w, h, flight, time, message); drawPaused(ctx, w, h); }
  else if (state === 'landed' || state === 'crashed') { drawHud(ctx, w, h, flight, time, message); drawResults(ctx, w, h, flight); }
  else drawHud(ctx, w, h, flight, time, message);
}

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  time += dt;
  input.poll();
  const flags = input.consumeFlags();
  if (flags.mute) audio.toggleMute();
  if (flags.restart) { resetFlight(); }
  if (state === 'title' && flags.started) {
    state = 'flying';
    audio.ensure();
    showMessage('Full throttle — rotate at 110 knots', '#7dffb0', 3);
    statusEl.textContent = 'Flying. Thread the rings, then land on the strip.';
  } else if (state === 'flying' && flags.pause) {
    state = 'paused';
  } else if (state === 'paused' && flags.pause) {
    state = 'flying';
  }
  if (state === 'flying') {
    flight.pitchInput = input.pitch;
    flight.rollInput = input.roll;
    flight.throttleInput = input.throttle;
    flight.brake = input.brake;
    const event = stepFlight(flight, dt, RINGS);
    if (event === 'ring') {
      audio.ring();
      showMessage('RING ' + flight.ringsCleared + ' OF ' + RINGS.length + '  +100', '#ffb02e', 2);
      statusEl.textContent = 'Ring ' + flight.ringsCleared + ' of ' + RINGS.length + ' cleared.';
    } else if (event === 'landed') {
      state = 'landed';
      audio.thud();
      statusEl.textContent = 'Landed at Kalibaru Field. Final score ' + flight.score + '.';
    } else if (event === 'crashed') {
      state = 'crashed';
      audio.crash();
      statusEl.textContent = 'Crashed. ' + flight.crashReason + '.';
    } else if (event === 'bounce') {
      audio.thud();
      showMessage('TOUCHDOWN — TOO EARLY, KEEP FLYING', '#ffb02e', 2);
    } else if (event === 'edge') {
      showMessage('EDGE OF THE VALLEY — TURNING BACK', '#ffb02e', 2);
    } else if (event === 'fuel-empty') {
      showMessage('FUEL EMPTY — GLIDE TO THE STRIP', '#ff5a3c', 2);
    }
    audio.update(flight.throttle, flight.speed, flight.airborne);
    if (flight.time > CONFIG.missionTimeLimit && !flight.landed) {
      flight.crashed = true;
      flight.crashReason = 'Out of time — the sortie clock ran out';
      state = 'crashed';
    }
  }
  render();
  requestAnimationFrame(frame);
}

if (shotName) {
  // Screenshot mode: one deterministic pose, rendered once, no loop.
  const pose = applyShot(shotName);
  flight = pose.flight;
  state = pose.state === 'landed' ? 'landed' : pose.state === 'title' ? 'title' : 'flying';
  time = flight.time || 0;
  smoothCam = { x: flight.x - Math.sin(flight.heading) * 21, y: flight.y + 7.5, z: flight.z - Math.cos(flight.heading) * 21 };
  // Let the camera settle, then paint the frame.
  for (let i = 0; i < 40; i++) aimCamera(cam, flight, 1 / 60, smoothCam);
  render();
  document.title = 'Merapi Ridge Run — shot ' + shotName;
} else {
  requestAnimationFrame(frame);
}
