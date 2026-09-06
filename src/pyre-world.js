import { Vector3 } from 'three';
import { SUN_DIRECTION, SUN_DISTANCE } from './world.js';

// Pyre: the hot inner planet. 1 200 km radius on a circular 10 M km orbit around
// the star, tidally locked, thin CO2 atmosphere, basalt plains, shield volcanoes
// and glowing lava fields. Positions stay in Aeon-centred metres (doubles).
// The surface sampler is evaluated in the orbital (body) frame, so the day side,
// the terminator and every landmark are fixed on the ground for the session.
export const PYRE_RADIUS = 1_200_000;
export const PYRE_ORBIT_RADIUS = 10_000_000_000;
export const PYRE_GRAVITY = 7.6;
export const PYRE_MAX_HEIGHT = 9_000;
export const PYRE_GENERATOR_VERSION = 1;
export const PYRE_NAME = 'Pyre';
export const PYRE_DAY_TEMPERATURE = 400;
/** Aeon's assumed year; Pyre's period follows from Kepler's third law. */
export const AEON_YEAR_SECONDS = 120 * 86400;
export const PYRE_PERIOD_SECONDS = AEON_YEAR_SECONDS * (PYRE_ORBIT_RADIUS / SUN_DISTANCE) ** 1.5;
/** Thin CO2 air: density, scale heights and scattering coefficients in SI units. */
export const PYRE_ATMOSPHERE = Object.freeze({
  height: 45_000, planeHeight: 12_000, seaLevelDensity: .09, scaleHeight: 6_000, mieScaleHeight: 2_600,
  betaR: Object.freeze([2.4e-6, 4.2e-6, 8.0e-6]), betaM: Object.freeze([1.7e-5, 1.15e-5, 6.2e-6]), g: .70, gain: 11,
});
export const PYRE_LIGHTING = Object.freeze({ sky: 0x9c6a48, ground: 0x2b1510, ambientNight: .06, ambientDay: .24, environment: .05 });

const STAR = new Vector3(...SUN_DIRECTION).multiplyScalar(SUN_DISTANCE);
// Ecliptic normal: perpendicular to the star direction, as close to Aeon's north as possible.
const ORBIT_NORMAL = new Vector3(0, 1, 0).addScaledVector(new Vector3(...SUN_DIRECTION), -SUN_DIRECTION[1]).normalize();
const ORBIT_X = new Vector3(...SUN_DIRECTION).negate();          // from the star toward Aeon
const ORBIT_Y = new Vector3().crossVectors(ORBIT_NORMAL, ORBIT_X);
const PHASE_AT_EPOCH_ZERO = 1.0;

/** Circular Keplerian position at wall-clock milliseconds (Aeon-centred metres). */
export function pyreOrbitPosition(ms) {
  const phase = PHASE_AT_EPOCH_ZERO + 2 * Math.PI * ((ms / 1000) / PYRE_PERIOD_SECONDS);
  return STAR.clone().addScaledVector(ORBIT_X, PYRE_ORBIT_RADIUS * Math.cos(phase)).addScaledVector(ORBIT_Y, PYRE_ORBIT_RADIUS * Math.sin(phase));
}
/** Tidally locked body frame: +Z toward the star, +Y the orbit normal, +X east (leading). */
export function pyreFrameAt(ms) {
  const position = pyreOrbitPosition(ms);
  const z = STAR.clone().sub(position).normalize(), y = ORBIT_NORMAL.clone(), x = new Vector3().crossVectors(y, z).normalize();
  return { position: position.toArray(), x: x.toArray(), y: y.toArray(), z: z.toArray() };
}
function initialEpoch() {
  try {
    const value = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('epoch');
    if (value !== null && /^\d+$/.test(value)) return Number(value);
  } catch { /* fall through */ }
  return Date.now();
}
export let PYRE_EPOCH = initialEpoch();
let frame = pyreFrameAt(PYRE_EPOCH);
export const PYRE_POSITION = Object.freeze([...frame.position]);
/** Workers and tests call this so their body frame matches the page's epoch. */
export function setPyreEpoch(ms) { PYRE_EPOCH = ms; frame = pyreFrameAt(ms); }
export function pyreFrame() { return frame; }
export function toPyreBody(x, y, z) {
  const { x: bx, y: by, z: bz } = frame;
  return [x * bx[0] + y * bx[1] + z * bx[2], x * by[0] + y * by[1] + z * by[2], x * bz[0] + y * bz[1] + z * bz[2]];
}
export function fromPyreBody(x, y, z) {
  const { x: bx, y: by, z: bz } = frame;
  return [x * bx[0] + y * by[0] + z * bz[0], x * bx[1] + y * by[1] + z * bz[1], x * bx[2] + y * by[2] + z * bz[2]];
}
/** Body-frame direction from latitude/longitude; longitude 0 is the sub-stellar point, -90 the dusk terminator. */
export function pyreLatLon(lat, lon) { const a = lat * Math.PI / 180, b = lon * Math.PI / 180; return [Math.cos(a) * Math.sin(b), Math.sin(a), Math.cos(a) * Math.cos(b)]; }

// ---- deterministic noise, independent of Aeon's ?seed --------------------
const SEED = 0x50595245;
const hash = (x, y, z) => { let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 2147483647) ^ SEED; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function qnoise(x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  let fx = x - ix, fy = y - iy, fz = z - iz;
  fx = fx * fx * fx * (fx * (fx * 6 - 15) + 10); fy = fy * fy * fy * (fy * (fy * 6 - 15) + 10); fz = fz * fz * fz * (fz * (fz * 6 - 15) + 10);
  const a = hash(ix, iy, iz), b = hash(ix + 1, iy, iz), c = hash(ix, iy + 1, iz), d = hash(ix + 1, iy + 1, iz);
  const e = hash(ix, iy, iz + 1), f = hash(ix + 1, iy, iz + 1), g = hash(ix, iy + 1, iz + 1), k = hash(ix + 1, iy + 1, iz + 1);
  return ((a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy) * (1 - fz) + ((e + (f - e) * fx) * (1 - fy) + (g + (k - g) * fx) * fy) * fz;
}
const R = [0, .8, .6, -.8, .36, -.48, -.6, -.48, .64];
const rotate = (x, y, z) => [R[0] * x + R[1] * y + R[2] * z, R[3] * x + R[4] * y + R[5] * z, R[6] * x + R[7] * y + R[8] * z];
/** Rotated fbm, signed, about -0.5..0.5. */
function fbm(x, y, z, octaves, lacunarity = 2.03, gain = .5) {
  let sum = 0, norm = 0, amp = 1;
  for (let i = 0; i < octaves; i++) {
    sum += amp * (qnoise(x, y, z) - .5); norm += amp; amp *= gain;
    [x, y, z] = rotate(x * lacunarity + 17.1, y * lacunarity + 9.2, z * lacunarity - 13.7);
  }
  return sum / norm;
}
/** Ridged multifractal, 0..1; crests follow the zero crossings. */
function ridged(x, y, z, octaves, lacunarity = 2.09, gain = .53) {
  let sum = 0, norm = 0, amp = 1, weight = 1;
  for (let i = 0; i < octaves; i++) {
    let n = 1 - Math.abs(qnoise(x, y, z) * 2 - 1); n *= n; n *= weight; weight = Math.max(0, Math.min(1, n * 2.2));
    sum += n * amp; norm += amp; amp *= gain;
    [x, y, z] = rotate(x * lacunarity + 19.31, y * lacunarity - 7.77, z * lacunarity + 31.13);
  }
  return sum / norm;
}

// ---- hero landmarks (body frame) -----------------------------------------
const feature = (lat, lon, radiusKm, extra) => {
  const direction = pyreLatLon(lat, lon);
  const up = Math.abs(direction[1]) < .9 ? [0, 1, 0] : [1, 0, 0];
  const east = [up[1] * direction[2] - up[2] * direction[1], up[2] * direction[0] - up[0] * direction[2], up[0] * direction[1] - up[1] * direction[0]];
  const l = Math.hypot(...east); east[0] /= l; east[1] /= l; east[2] /= l;
  const north = [direction[1] * east[2] - direction[2] * east[1], direction[2] * east[0] - direction[0] * east[2], direction[0] * east[1] - direction[1] * east[0]];
  return Object.freeze({ lat, lon, direction: Object.freeze(direction), east: Object.freeze(east), north: Object.freeze(north), radius: radiusKm * 1000 / PYRE_RADIUS, ...extra });
};
/** Shield volcanoes: four on the northern hemisphere, three on the southern. */
export const VOLCANOES = Object.freeze([
  feature(16, -90, 45, { name: 'CINDER THRONE', height: 5200, active: true }),
  feature(38, -30, 60, { name: 'SULPHUR CROWN', height: 6400, active: true }),
  feature(8, 140, 30, { name: 'EMBER DOME', height: 3200, active: true }),
  feature(55, 60, 24, { name: 'GREY SHIELD', height: 2400, active: false }),
  feature(-22, -112, 50, { name: 'TWIN FURNACE', height: 5600, active: true }),
  feature(-48, 20, 36, { name: 'OLD BASALT', height: 3000, active: false }),
  feature(-9, -72, 20, { name: 'DUSK CALDERA', height: 2600, active: true }),
]);
/** Active lava fields: cracked crust glowing through, strongest on the night side. */
export const LAVA_FIELDS = Object.freeze([
  feature(4, -135, 260, { name: 'NIGHTFIRE PLAIN' }),
  feature(12, -96, 95, { name: 'THRONE FLOWS' }),
  feature(-28, -140, 160, { name: 'FURNACE FLOWS' }),
  feature(30, 160, 130, { name: 'EMBER FIELD' }),
  feature(-14, 95, 150, { name: 'FAR SCAR' }),
  feature(44, -22, 70, { name: 'CROWN FLOWS' }),
]);
let seed = SEED;
const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
/** Impact craters, the same bowl + rim formulation as Selene (moon-world.js). */
export const CRATERS = Object.freeze(Array.from({ length: 56 }, () => {
  const y = random() * 2 - 1, angle = random() * Math.PI * 2, r = Math.sqrt(1 - y * y);
  const radius = .0028 + random() ** 2 * .032;
  return Object.freeze({ direction: Object.freeze([r * Math.cos(angle), y, r * Math.sin(angle)]), radius, depth: radius * PYRE_RADIUS * .07 });
}));
/** Body-frame landing site: on the dusk terminator in the Throne Flows, 104 km from Cinder Throne. */
export const PYRE_LANDING_BODY_DIRECTION = Object.freeze(pyreLatLon(13.5, -94.5));
export const PYRE_ARRIVAL_ALTITUDE = 60_000;
/** World-frame landing direction for the current epoch. */
export function pyreLandingDirection() { return fromPyreBody(...PYRE_LANDING_BODY_DIRECTION); }

// ---- the canonical surface -------------------------------------------------
const chord = (d, c) => { const dot = d[0] * c[0] + d[1] * c[1] + d[2] * c[2]; return Math.sqrt(Math.max(0, 2 - 2 * dot)); };
/** Body-frame sampler. Returns metres above the reference sphere plus material fields. */
export function pyreSurfaceBody(x, y, z) {
  const broad = fbm(x * 3.3 + 5.1, y * 3.3 - 2.2, z * 3.3 + 7.9, 4);
  const highland = smooth(-.02, .16, broad);
  const plains = 1 - highland;
  const ridge = ridged(x * 41 + 3.1, y * 41 - 8.7, z * 41 + 2.4, 4);
  let height = broad * 2600 + highland * ridge * 900 + (broad + .5) * 400 - 300;
  height += fbm(x * 700 + 1.3, y * 700 + 4.4, z * 700 - 9.1, 4) * (90 + 260 * highland);
  height += fbm(x * 5000 - 2.7, y * 5000 + 6.1, z * 5000 + 1.9, 3) * (35 + 60 * highland);
  // Wrinkle (pressure) ridges on the plains: long, low crests at ~1.3 km.
  const wrinkle = ridged(x * 900 + 12.1, y * 900 - 3.3, z * 900 + 5.5, 3);
  height += smooth(.55, .95, wrinkle) * 26 * plains;
  // Sinuous rilles: single-octave crest lines inverted into lava channels.
  const rille = 1 - Math.abs(qnoise(x * 260 + 8.8, y * 260 + 1.2, z * 260 - 4.6) * 2 - 1);
  height -= smooth(.905, .985, rille) * 55 * plains;
  // Fault scarps along an iso-line of a broad field, where a regional mask allows.
  const fault = qnoise(x * 14 + 21.3, y * 14 - 6.6, z * 14 + 9.9) - .5, faultMask = smooth(.42, .62, qnoise(x * 7.3 - 3.1, y * 7.3 + 2.9, z * 7.3 - 7.7));
  height += smooth(-.012, .012, fault) * 140 * faultMask;
  let activity = 0, fresh = 0, sulphur = 0, region = 'BASALT PLAINS', volcanic = 0, calderaHeat = 0;
  for (const v of VOLCANOES) {
    const dot = x * v.direction[0] + y * v.direction[1] + z * v.direction[2];
    if (dot < 1 - v.radius * v.radius * 1.2) continue;
    const u = (x * v.east[0] + y * v.east[1] + z * v.east[2]), w = (x * v.north[0] + y * v.north[1] + z * v.north[2]);
    const angle = Math.atan2(w, u);
    // Flank gullies and lobes: modulate the radius by angle so the cone is not a lathe.
    const lobes = 1 + .14 * Math.sin(angle * 5 + 1.7) + .07 * Math.cos(angle * 11 + .4) + .05 * (qnoise(x * 400 + 3, y * 400, z * 400) - .5);
    const r = chord([x, y, z], v.direction) / (v.radius * lobes);
    if (r > 1.25) continue;
    // Shield profile: flat summit, gentle flanks (max slope ~10 deg), toes fading into the plain.
    const s = Math.max(0, 1 - r), shield = s * s * (3 - 2 * s) * (1 - .12 * ridged(x * 300 + 5, y * 300 - 2, z * 300 + 9, 2));
    const caldera = -(1 - smooth(.045, .085, r)) * .13 + Math.exp(-(((r - .075) / .018) ** 2)) * .035;
    // Radial lava channels down the active flanks.
    const channel = smooth(.86, .99, 1 - Math.abs(Math.sin(angle * 7 + qnoise(x * 900, y * 900, z * 900) * 3))) * smooth(.1, .3, r) * (1 - smooth(.8, 1.05, r));
    const gullies = (1 - ridged(x * 1800 + 4, y * 1800 - 6, z * 1800 + 2, 2)) * smooth(.12, .5, r) * (1 - smooth(.8, 1.05, r));
    height += v.height * (shield + caldera - channel * .012 - gullies * .035 * shield);
    volcanic = Math.max(volcanic, 1 - smooth(.9, 1.2, r));
    if (v.active) {
      calderaHeat = Math.max(calderaHeat, 1 - smooth(.03, .07, r));
      activity = Math.max(activity, channel * (1 - smooth(.45, .95, r)) * .9);
      fresh = Math.max(fresh, (1 - smooth(.35, 1.05, r)) * smooth(.35, .6, qnoise(x * 120 + 7, y * 120 - 3, z * 120 + 1)));
      sulphur = Math.max(sulphur, (1 - smooth(.05, .22, r)) * smooth(.52, .8, qnoise(x * 1500 + 2, y * 1500 + 4, z * 1500 - 3)) * .85);
    }
    if (r < .09) region = 'CALDERA'; else if (r < 1.05) region = v.name;
  }
  for (const c of CRATERS) {
    const dot = x * c.direction[0] + y * c.direction[1] + z * c.direction[2];
    if (dot < 1 - c.radius * c.radius * 1.2) continue;
    const r = chord([x, y, z], c.direction) / c.radius;
    height += -c.depth * (1 - smooth(.15, .94, r)) + c.depth * .36 * Math.exp(-(((r - .98) / .12) ** 2));
  }
  for (const f of LAVA_FIELDS) {
    const dot = x * f.direction[0] + y * f.direction[1] + z * f.direction[2];
    if (dot < 1 - f.radius * f.radius * 1.4) continue;
    const r = chord([x, y, z], f.direction) / f.radius;
    const edge = 1 + .35 * (qnoise(x * 60 + 4, y * 60 - 1, z * 60 + 6) - .5);
    const field = (1 - smooth(.55, 1.05, r * edge)) * (1 - .6 * highland);
    if (field <= 0) continue;
    // Lava lakes (5 km patches) and rivers (bright ridged channels) give the glow structure at every range.
    const lakes = smooth(.5, .74, fbm(x * 230 + 1, y * 230 + 2, z * 230 + 3, 3) + .5);
    const rivers = smooth(.62, .96, ridged(x * 760 + 9, y * 760 - 4, z * 760 + 7, 2));
    activity = Math.max(activity, field * Math.max(rivers, lakes * .85, .16));
    fresh = Math.max(fresh, field * smooth(.3, .7, lakes + rivers * .5));
    if (field > .3) region = f.name;
  }
  activity = Math.max(activity, calderaHeat);
  fresh = Math.max(fresh, calderaHeat);
  // Oxidised ochre plains, away from fresh flows and the highlands.
  const oxide = smooth(.46, .66, qnoise(x * 23 + 9.4, y * 23 - 5.5, z * 23 + 2.2) + (broad) * .3) * plains * (1 - fresh);
  // Metre-scale relief: 30 m and 8 m bands, rougher (a'a clinker) on fresh flows.
  const rough = 1 + 1.6 * fresh + .6 * highland;
  height += fbm(x * 40000 + 3.7, y * 40000 - 1.1, z * 40000 + 6.3, 3, 2.27) * 3.0 * rough;
  height += fbm(x * 150000 + 8.1, y * 150000 + 2.6, z * 150000 - 4.4, 2, 2.41) * .7 * rough;
  // Tumuli: lava blisters on the fields, from a stable 60 m cell lattice.
  if (activity > .05 || fresh > .05) {
    const gx = x * PYRE_RADIUS / 60, gy = y * PYRE_RADIUS / 60, gz = z * PYRE_RADIUS / 60;
    const cx = Math.floor(gx), cy = Math.floor(gy), cz = Math.floor(gz);
    for (let i = 0; i < 8; i++) {
      const ox = cx + (i & 1), oy = cy + ((i >> 1) & 1), oz = cz + (i >> 2);
      if (hash(ox, oy + 71, oz) < .55) continue;
      const dx = gx - ox - hash(ox, oy, oz + 3), dy = gy - oy - hash(ox + 5, oy, oz), dz = gz - oz - hash(ox, oy + 9, oz);
      const radius = .12 + hash(ox + 11, oy, oz) * .25, dist = Math.sqrt(dx * dx + dy * dy + dz * dz) / radius;
      if (dist < 1) height += (1 - dist * dist) * radius * 60 * .28 * Math.max(activity, fresh);
    }
  }
  if (region === 'BASALT PLAINS' && highland > .55) region = 'BASALT HIGHLANDS';
  else if (region === 'BASALT PLAINS' && oxide > .5) region = 'OXIDISED PLAINS';
  // Palette (linear RGB): charcoal basalt, ochre oxidation, sulphur, glassy fresh flows.
  const tone = .8 + .4 * qnoise(x * 350 + 2, y * 350 + 7, z * 350 - 5);
  const basalt = [.082, .076, .07].map(v => v * tone);
  const rego = [.16, .135, .112].map(v => v * tone);
  const ochre = [.28, .12, .048], yellow = [.56, .43, .09], glass = [.032, .03, .032];
  let color = basalt.map((v, i) => v * (1 - highland) + rego[i] * highland);
  color = color.map((v, i) => v * (1 - oxide) + ochre[i] * oxide);
  color = color.map((v, i) => v * (1 - fresh) + glass[i] * fresh);
  color = color.map((v, i) => v * (1 - sulphur) + yellow[i] * sulphur);
  return { height, color, activity, fresh, sulphur, oxide, region };
}
/** World-frame sampler: rendering, contact and walking all use this one. */
export function pyreSurface(x, y, z) { return pyreSurfaceBody(...toPyreBody(x, y, z)); }
export function pyreRegion(x, y, z) {
  const b = toPyreBody(x, y, z);
  return `${b[2] > .04 ? 'DAY SIDE' : b[2] < -.04 ? 'NIGHT SIDE' : 'TERMINATOR'} · ${pyreSurfaceBody(...b).region}`;
}

export function pyreOffset(position) { return position.clone().sub(new Vector3(...PYRE_POSITION)); }
export function pyreAltitude(position) { return pyreOffset(position).length() - PYRE_RADIUS; }
/** Hull heat 0..1: sun exposure at low altitude. Damage is a Phase 4 concern. */
export function pyreHeat(position, sunDirection = null) {
  const local = pyreOffset(position), r = local.length();
  if (r > PYRE_RADIUS * 8) return 0;
  const altitude = Math.max(0, r - PYRE_RADIUS), normal = local.divideScalar(r);
  const toStar = sunDirection ? sunDirection : STAR.clone().sub(position).normalize();
  const exposure = smooth(-.12, .45, normal.dot(toStar));
  const low = 1 - smooth(25_000, 160_000, altitude);
  const sample = pyreSurface(normal.x, normal.y, normal.z);
  const lava = sample.activity * (1 - smooth(20, 400, altitude)) * .45;
  return Math.min(1, low * (.12 + .88 * exposure) + lava);
}

/** Swept contact against the heightfield (same scheme as constrainMoonStep). */
export function constrainPyreStep(previous, proposed, clearance = 3.2) {
  const center = new Vector3(...PYRE_POSITION), start = previous.clone().sub(center), delta = proposed.clone().sub(previous);
  const length = delta.length(), bound = PYRE_RADIUS + PYRE_MAX_HEIGHT + clearance;
  const distanceAt = t => {
    const local = start.clone().addScaledVector(delta, t), r = local.length();
    if (r < 1) return -PYRE_RADIUS;
    local.divideScalar(r); return r - PYRE_RADIUS - pyreSurface(local.x, local.y, local.z).height - clearance;
  };
  const contact = t => {
    const d = start.clone().addScaledVector(delta, t); if (d.lengthSq() < 1) d.set(0, 0, 1); d.normalize();
    return { point: d.clone().multiplyScalar(PYRE_RADIUS + pyreSurface(d.x, d.y, d.z).height + clearance).add(center), hit: true, t };
  };
  if (start.length() < bound && distanceAt(0) <= 0) return contact(0);
  if (length === 0) return { point: proposed, hit: false };
  const ray = delta.clone().divideScalar(length), b = start.dot(ray), c = start.lengthSq() - bound * bound, disc = b * b - c;
  if (disc < 0) return { point: proposed, hit: false };
  const root = Math.sqrt(disc), entry = Math.max(0, (-b - root) / length), exit = Math.min(1, (-b + root) / length);
  if (exit < entry || exit < 0 || entry > 1) return { point: proposed, hit: false };
  let t = entry, last = t;
  for (let i = 0; i < 4096 && t <= exit; i++) {
    const height = distanceAt(t);
    if (height <= .002) {
      let lo = last, hi = t;
      for (let j = 0; j < 24; j++) { const mid = (lo + hi) / 2; if (distanceAt(mid) > 0) lo = mid; else hi = mid; }
      return contact(hi);
    }
    if (t === exit) break;
    last = t; t = Math.min(exit, t + Math.min(250, height / 20) / length);
  }
  if (t < exit) return { point: previous.clone().addScaledVector(delta, t), hit: false, limited: true };
  return { point: proposed, hit: false };
}

/** Equirectangular identity map in the body frame: activity, fresh flows, sulphur, oxide. */
export function bakePyreMaps(width = 1024, height = 512) {
  const data = new Uint8Array(width * height * 4);
  for (let row = 0; row < height; row++) {
    const theta = (1 - row / (height - 1)) * Math.PI, sin = Math.sin(theta), y = Math.cos(theta);
    for (let col = 0; col < width; col++) {
      const phi = (col / width - .5) * Math.PI * 2, x = Math.sin(phi) * sin, z = Math.cos(phi) * sin;
      const s = pyreSurfaceBody(x, y, z), i = (row * width + col) * 4;
      data[i] = Math.round(255 * Math.min(1, s.activity)); data[i + 1] = Math.round(255 * Math.min(1, s.fresh));
      data[i + 2] = Math.round(255 * Math.min(1, s.sulphur)); data[i + 3] = Math.round(255 * Math.min(1, s.oxide));
    }
  }
  return { width, height, data };
}
