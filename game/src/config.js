// Tunable constants for Merapi Ridge Run. Everything that shapes the flight
// model, the valley and the mission lives here so the rest of the game reads
// as plain behaviour, not magic numbers.
export const CONFIG = {
  // World: a 5.2 km square valley, 1 unit = 1 metre.
  worldSize: 5200,
  halfWorld: 2600,
  terrainSeed: 20261126,
  // Heightmap grid: cells of 65 m, 80 x 80 vertices.
  gridCells: 80,
  cellSize: 65,
  // Flight model (arcade, but honest: speed, lift and drag all matter).
  maxSpeed: 92, // m/s, about 179 kt at full throttle, level
  cruiseSpeed: 62,
  stallSpeed: 26, // below this the wing stops flying and the nose drops
  maxThrottle: 1,
  climbRate: 9.5, // m/s at full power, level, clean
  sinkRate: 6.5, // m/s gliding, power off
  rollRate: 1.9, // rad/s at full stick
  pitchRate: 0.9,
  turnAuthority: 0.55, // how much bank turns the heading
  // Mission.
  ringCount: 6,
  ringRadius: 26, // metres; fly through the glowing hoop
  startFuel: 100, // percent; full throttle burns ~0.55 %/s
  fuelBurn: 0.55,
  fuelBurnIdle: 0.12,
  missionTimeLimit: 360, // seconds; the sortie is scored on the clock too
  // Runway: Kalibaru Field, a grass strip on the valley floor.
  runway: { x: -350, z: 1150, heading: 171, length: 620, width: 34 },
  // Camera.
  chaseDistance: 26,
  chaseHeight: 5.0,
  fov: 68, // degrees, vertical
  // Rendering.
  viewDistance: 1500, // metres of terrain drawn ahead
  skyTop: '#2f6fb4',
  skyMid: '#7fb2dd',
  skyHorizon: '#cfe4ef',
  // Scoring.
  ringPoints: 100,
  landingBonus: 250,
  timeBonusPerSecond: 2, // seconds under the par time pay out
  parTime: 240,
};

export const COLOURS = {
  grassLow: '#6a9448',
  grassHigh: '#7fa653',
  fieldGold: '#a89a5a',
  forest: '#476b35',
  rock: '#93816c',
  snow: '#eef2f5',
  sand: '#c9b489',
  water: '#3f7fa8',
  waterDeep: '#2c5f86',
  runway: '#4a4a48',
  runwayLine: '#f2f0e4',
  townRoof: '#a5503c',
  townWall: '#d8c9a8',
};
