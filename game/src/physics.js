// The flight model for the Kutilang-9: an arcade model with honest bones.
// Throttle sets speed, speed makes lift, bank turns the heading, and below
// the stall speed the wing quits and the nose drops. Fuel and damage turn
// a sortie into decisions instead of a joyride.
import { CONFIG } from './config.js';
import { clamp, wrapAngle } from './random.js';
import { terrainHeight } from './world.js';

export function newFlight() {
  const rw = CONFIG.runway;
  const heading = (rw.heading * Math.PI) / 180;
  return {
    // Parked at the runway threshold, engine warm, ready to roll.
    x: rw.x - Math.sin(heading) * (rw.length / 2 - 30),
    z: rw.z - Math.cos(heading) * (rw.length / 2 - 30),
    y: 58,
    heading,
    pitch: 0,
    roll: 0,
    speed: 0,
    throttle: 0,
    fuel: CONFIG.startFuel,
    damage: 0,
    ringsCleared: 0,
    score: 0,
    time: 0,
    airborne: false,
    stalled: false,
    landed: false,
    crashed: false,
    crashReason: '',
    verticalSpeed: 0,
    // Per-frame input, filled by input.js.
    pitchInput: 0,
    rollInput: 0,
    throttleInput: 0,
    brake: false,
  };
}

// One fixed step of flight. Returns an event string ('ring', 'landed',
// 'crashed', 'fuel-empty') or '' when nothing notable happened.
export function stepFlight(p, dt, rings) {
  if (p.crashed || p.landed) return '';
  p.time += dt;
  const ground = terrainHeight(p.x, p.z);

  // Throttle: W/S (or Shift/Ctrl) move it; fuel burns faster at full power.
  p.throttle = clamp(p.throttle + p.throttleInput * dt * 0.9, 0, 1);
  const burning = p.throttle > 0.02;
  if (burning) p.fuel = Math.max(0, p.fuel - (CONFIG.fuelBurnIdle + p.throttle * CONFIG.fuelBurn) * dt);
  if (p.fuel <= 0 && p.throttle > 0) { p.throttle = 0; }

  // Speed chases the throttle's target, faster with power, slower climbing.
  const targetSpeed = p.throttle * CONFIG.maxSpeed;
  const climbPenalty = Math.max(0, p.pitch) * 14;
  const accel = p.speed < targetSpeed ? 7 + p.throttle * 6 : 5;
  p.speed += clamp(targetSpeed - climbPenalty - p.speed, -accel * dt, accel * dt);
  if (p.brake && !p.airborne) p.speed = Math.max(0, p.speed - 26 * dt);
  p.speed = clamp(p.speed, 0, CONFIG.maxSpeed);

  // Stall: below the stall speed the wing cannot hold the nose up.
  p.stalled = p.airborne && p.speed < CONFIG.stallSpeed;
  const pitchTarget = p.stalled ? -0.35 : clamp(p.pitchInput, -1, 1) * 0.5;
  p.pitch += clamp(pitchTarget - p.pitch, -CONFIG.pitchRate * dt, CONFIG.pitchRate * dt);
  p.roll += clamp(clamp(p.rollInput, -1, 1) - p.roll, -CONFIG.rollRate * dt, CONFIG.rollRate * dt) * 0.9;
  // Bank turns the heading, harder at speed.
  p.heading += -p.roll * CONFIG.turnAuthority * clamp(p.speed / 60, 0.25, 1) * dt;
  p.heading = wrapAngle(p.heading);

  // Vertical speed: lift grows with speed squared; climb only when fast
  // enough, sink when slow or power off.
  const lift = (p.speed * p.speed) / (CONFIG.cruiseSpeed * CONFIG.cruiseSpeed);
  let vs = (lift - 1) * CONFIG.climbRate - (1 - p.throttle) * CONFIG.sinkRate * 0.4;
  vs += Math.sin(p.pitch) * p.speed * 0.5;
  if (p.stalled) vs -= 9;
  p.verticalSpeed = vs;
  p.y += vs * dt;

  // Move forward along the heading.
  const forward = Math.cos(p.pitch);
  p.x += Math.sin(p.heading) * forward * p.speed * dt;
  p.z += Math.cos(p.heading) * forward * p.speed * dt;

  // Takeoff: rolling fast on the strip lifts the wheels. The speed is set
  // near cruise, so the wing can hold the plane the moment it leaves the
  // ground: lifting off slower sinks straight back onto the strip.
  if (!p.airborne && p.speed > 58 && p.y <= ground + 2) {
    p.airborne = true;
    p.y = ground + 2;
  }
  if (!p.airborne) p.y = ground;

  // Ring check: inside the hoop's disc while crossing its plane.
  if (p.ringsCleared < rings.length) {
    const ring = rings[p.ringsCleared];
    const dx = p.x - ring.x, dy = p.y - ring.y, dz = p.z - ring.z;
    const dist = Math.hypot(dx, dy, dz);
    if (dist < CONFIG.ringRadius) {
      p.ringsCleared += 1;
      p.score += CONFIG.ringPoints;
      return 'ring';
    }
  }

  // Ground contact.
  const clearance = p.y - ground;
  if (clearance <= 0.5 && p.airborne) {
    const onRunway = runwayDistance(p) < CONFIG.runway.width / 2 + 4;
    const gentle = p.verticalSpeed > -4.5 && Math.abs(p.roll) < 0.35 && p.speed < 70;
    if (onRunway && gentle && p.ringsCleared >= rings.length) {
      p.landed = true;
      p.y = ground;
      p.score += CONFIG.landingBonus;
      p.score += Math.max(0, Math.round((CONFIG.parTime - p.time) * CONFIG.timeBonusPerSecond));
      p.score += Math.round(p.fuel);
      return 'landed';
    }
    if (onRunway && gentle) {
      // A soft touch before the course is done: bounce, keep flying.
      p.y = ground + 1;
      p.verticalSpeed = 2;
      p.damage += 5;
      return 'bounce';
    }
    p.crashed = true;
    p.y = ground;
    p.crashReason = onRunway ? 'Hard landing — the strip forgave nothing' : 'Terrain strike';
    return 'crashed';
  }

  // Out of fuel over the valley: a dead-stick glide, not an instant crash.
  // Announced once, so the HUD is not spammed every frame.
  if (p.fuel <= 0 && p.airborne && p.speed < CONFIG.stallSpeed + 4 && !p.fuelEmptyAnnounced) {
    p.fuelEmptyAnnounced = true;
    return 'fuel-empty';
  }
  // Leaving the valley: turn back, the world ends at the fence.
  if (Math.abs(p.x) > CONFIG.halfWorld - 60 || Math.abs(p.z) > CONFIG.halfWorld - 60) {
    p.heading = wrapAngle(p.heading + Math.PI);
    return 'edge';
  }
  return '';
}

// Signed distance across the runway centreline, in metres.
export function runwayDistance(p) {
  const rw = CONFIG.runway;
  const h = (rw.heading * Math.PI) / 180;
  const dx = p.x - rw.x, dz = p.z - rw.z;
  const along = dx * Math.sin(h) + dz * Math.cos(h);
  const across = Math.abs(dx * Math.cos(h) - dz * Math.sin(h));
  if (Math.abs(along) > rw.length / 2 + 40) return across + 1000;
  return across;
}

export function speedKnots(p) { return Math.round(p.speed * 1.94384); }
export function altitudeFeet(p) { return Math.round((p.y - 58) * 3.28084); }
export function headingDegrees(p) {
  let d = (p.heading * 180) / Math.PI;
  return Math.round(((d % 360) + 360) % 360);
}
