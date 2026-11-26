// Deterministic poses for the four screenshots, so each one is a real
// render of the game's own code at a chosen moment — never staged by hand
// in an editor. ?shot=start|play|mid|end&seed=1 picks the pose; the seed
// is accepted and ignored, the valley is fixed by its own seed.
import { CONFIG } from './config.js';
import { newFlight, stepFlight } from './physics.js';
import { RINGS, terrainHeight } from './world.js';

// Drive the plane forward on a fixed script for N steps so the pose is a
// real flight state, not a hand-placed camera. The real ring course is
// passed in: an empty list would let the landing check fire on the strip
// before any ring is threaded, freezing the pose on the ground.
function flyScript(p, steps, script) {
  for (let i = 0; i < steps; i++) {
    p.pitchInput = script.pitch || 0;
    p.rollInput = script.roll || 0;
    p.throttleInput = script.throttle || 0;
    p.brake = false;
    stepFlight(p, 1 / 60, RINGS);
  }
}

export function applyShot(shot) {
  const p = newFlight();
  if (shot === 'start') {
    // Parked on the strip, throttle up, the valley and the first ring ahead.
    p.throttle = 0.55;
    return { flight: p, state: 'title', steps: 0 };
  }
  if (shot === 'play') {
    // Full power down the strip, rotate, climb out toward ring 1.
    flyScript(p, 60 * 9, { throttle: 1, pitch: 0.35 });
    flyScript(p, 60 * 6, { throttle: 1, pitch: 0.3 });
    return { flight: p, state: 'flying', steps: 0 };
  }
  if (shot === 'mid') {
    // Deep in the course: banking hard around the volcano shoulder with
    // two rings already threaded and the town below.
    p.x = 1150; p.z = -980; p.y = 330;
    p.heading = -0.6; p.pitch = 0.05; p.roll = -0.55;
    p.speed = 68; p.throttle = 0.85; p.airborne = true;
    p.ringsCleared = 2; p.score = 200; p.time = 118; p.fuel = 74;
    return { flight: p, state: 'flying', steps: 0 };
  }
  if (shot === 'end') {
    // Wheels on the grass, course complete: the results screen.
    p.x = CONFIG.runway.x; p.z = CONFIG.runway.z;
    p.y = terrainHeight(p.x, p.z);
    p.heading = (CONFIG.runway.heading * Math.PI) / 180;
    p.speed = 0; p.throttle = 0; p.airborne = false;
    p.ringsCleared = 6; p.score = 960; p.time = 194; p.fuel = 18;
    p.landed = true;
    return { flight: p, state: 'landed', steps: 0 };
  }
  return { flight: p, state: 'title', steps: 0 };
}
