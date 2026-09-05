// Terrain v2 — multi-scale procedural relief for the quarter-Earth planet.
//
// Design: a chain of band-limited noise terms, each responsible for one octave
// band of the landscape, composed so that something is visible at every altitude
// from orbit (continents, 1000+ km) down to a walking camera (0.4 m boulders at
// 7 m spacing). All terms are smooth compositions of value noise, so the field
// stays C0 (and almost everywhere C1) — safe for finite-difference normals.
//
// Frequency -> ground scale on this planet: one noise lattice cell at frequency
// f measures RADIUS / f metres, RADIUS = 1_592_750 m.
//   f =      3  -> 530 km   continents
//   f =      9  -> 177 km   mountain belts / coast character
//   f =    145  ->  11 km   ridged multifractal base (6 octaves -> down to 260 m)
//   f =    560  ->  2.8 km  rolling hills (4 octaves -> down to 350 m)
//   f =   4200  ->  380 m   mid detail (3 octaves -> down to 90 m)
//   f =  17000  ->   94 m   coarse ground roughness
//   f =  72000  ->   22 m   ground roughness
//   f = 225000  ->    7 m   boulder-scale roughness
//
// hash/noise/fbm/smoothstep/clamp are imported from world.js so the world seed
// stays shared with everything else in the app.
import { clamp, smoothstep, hash, noise, fbm } from './world.js';

export const TERRAIN_VERSION = 2;

/** Continental-field value that maps to sea level; tuned for ~49% ocean. */
const SEA = 0.5075;
/** Peak amplitude of the ridged mountain term, metres. */
const MOUNTAIN_AMP = 3900;

const snoise = (x, y, z) => noise(x, y, z) * 2 - 1;

/**
 * Quintic-interpolated value noise over the same integer lattice (and therefore
 * the same world seed) as world.js `noise`. world.js interpolates with
 * smoothstep, which is only C1: at metre scale that leaves visible creases
 * along the axis-aligned cell walls. The quintic 6t^5-15t^4+10t^3 is C2, so the
 * lattice stops showing up as square seams on a hillshade.
 */
function qnoise(x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  let fx = x - ix, fy = y - iy, fz = z - iz;
  fx = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
  fy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
  fz = fz * fz * fz * (fz * (fz * 6 - 15) + 10);
  const a = hash(ix, iy, iz), b = hash(ix + 1, iy, iz), c = hash(ix, iy + 1, iz), d = hash(ix + 1, iy + 1, iz);
  const e = hash(ix, iy, iz + 1), f = hash(ix + 1, iy, iz + 1), g = hash(ix, iy + 1, iz + 1), k = hash(ix + 1, iy + 1, iz + 1);
  return ((a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy) * (1 - fz)
       + ((e + (f - e) * fx) * (1 - fy) + (g + (k - g) * fx) * fy) * fz;
}

// A fixed orthonormal rotation applied between octaves. Without it every octave
// shares the same axis-aligned lattice orientation and the cell walls reinforce
// each other into straight seams and square blocks on the hillshade.
const R0 = 0.00, R1 = 0.80, R2 = 0.60;
const R3 = -0.80, R4 = 0.36, R5 = -0.48;
const R6 = -0.60, R7 = -0.48, R8 = 0.64;

/**
 * Rotated fractal brownian motion, signed and roughly in -0.5..0.5. Same shared
 * hash lattice as world.js fbm, but each octave is rotated as well as scaled.
 */
function fbmR(x, y, z, octaves, lacunarity = 2.03, gain = 0.5) {
  let sum = 0, norm = 0, amp = 1;
  for (let i = 0; i < octaves; i++) {
    sum += amp * (qnoise(x, y, z) - 0.5);
    norm += amp;
    amp *= gain;
    const px = x * lacunarity + 17.1, py = y * lacunarity + 9.2, pz = z * lacunarity - 13.7;
    x = R0 * px + R1 * py + R2 * pz;
    y = R3 * px + R4 * py + R5 * pz;
    z = R6 * px + R7 * py + R8 * pz;
  }
  return sum / norm;
}

/**
 * Ridged multifractal. `1 - |signed noise|` turns each octave's zero crossings
 * into crest lines; squaring sharpens them, and weighting each octave by the
 * previous one keeps fine crests only where a coarse crest already runs, which
 * is what produces spurs hanging off a main ridgeline instead of uniform mush.
 * Octaves are rotated as well as scaled. Returns roughly 0..1.
 */
function ridged(x, y, z, octaves, lacunarity = 2.09, gain = 0.53, sharpness = 2.2) {
  let sum = 0, norm = 0, amp = 1, weight = 1;
  for (let i = 0; i < octaves; i++) {
    let n = 1 - Math.abs(qnoise(x, y, z) * 2 - 1);
    n *= n;
    n *= weight;
    weight = clamp(n * sharpness, 0, 1);
    sum += n * amp;
    norm += amp;
    amp *= gain;
    const px = x * lacunarity + 19.31, py = y * lacunarity - 7.77, pz = z * lacunarity + 31.13;
    x = R0 * px + R1 * py + R2 * pz;
    y = R3 * px + R4 * py + R5 * pz;
    z = R6 * px + R7 * py + R8 * pz;
  }
  return sum / norm;
}

/** One quintic noise octave sampled in a rotated frame, signed -1..1. */
function rot1(x, y, z, freq, ox, oy, oz) {
  const px = x * freq + ox, py = y * freq + oy, pz = z * freq + oz;
  return qnoise(R0 * px + R1 * py + R2 * pz, R3 * px + R4 * py + R5 * pz, R6 * px + R7 * py + R8 * pz) * 2 - 1;
}

/** Same, in the doubly-rotated frame, so consecutive bands never share axes. */
function rot2(x, y, z, freq, ox, oy, oz) {
  const ax = x * freq + ox, ay = y * freq + oy, az = z * freq + oz;
  const px = R0 * ax + R1 * ay + R2 * az, py = R3 * ax + R4 * ay + R5 * az, pz = R6 * ax + R7 * ay + R8 * az;
  return qnoise(R0 * px + R1 * py + R2 * pz, R3 * px + R4 * py + R5 * pz, R6 * px + R7 * py + R8 * pz) * 2 - 1;
}

/** Continuous soft terracing — flattens `h` toward multiples of `size`. */
function terrace(h, size, amount) {
  if (amount <= 0) return h;
  const p = h / size, i = Math.floor(p), f = p - i;
  const stepped = (i + smoothstep(0.28, 0.72, f)) * size;
  return h + (stepped - h) * amount;
}

/**
 * Height above sea level, metres, for a unit direction. Deterministic and pure.
 * Ocean floor continues below 0; highest peaks land near 5 km.
 */
export function terrainHeight(x, y, z) {
  // ---- continents: domain-warped fbm so coastlines are not blobby ----------
  const wx = snoise(x * 2.1 + 11.3, y * 2.1 - 4.7, z * 2.1 + 8.9);
  const wy = snoise(x * 2.1 - 21.7, y * 2.1 + 13.1, z * 2.1 - 3.3);
  const wz = snoise(x * 2.1 + 5.5, y * 2.1 + 27.9, z * 2.1 + 19.4);
  const W = 0.15;
  const continent = fbm((x + wx * W) * 3.05 + 8, (y + wy * W) * 3.05, (z + wz * W) * 3.05 + 3, 5);
  const q = continent - SEA; // > 0 land, < 0 ocean, in continental-field units

  // ---- large-scale hypsometry ---------------------------------------------
  const coastalPlain = smoothstep(0, 0.055, q);
  const interior = smoothstep(0.030, 0.200, q);
  const shelf = smoothstep(0, 0.016, -q);
  const abyss = smoothstep(0.012, 0.080, -q);
  const landMask = smoothstep(-0.004, 0.030, q);

  // ---- mountain belts ------------------------------------------------------
  // A 2-octave ridged field at 177 km cells yields long curvilinear filaments;
  // narrowing it with smoothstep gives ranges ~10-25 km wide and 100+ km long.
  const beltRaw = ridged(x * 9.2 + 31.7, y * 9.2 - 12.3, z * 9.2 + 7.1, 2, 2.11, 0.5);
  const belt = smoothstep(0.60, 0.94, beltRaw);
  const uplift = belt * landMask;

  // 6-octave ridged multifractal: ridgelines, spurs and valleys from 11 km
  // down to 260 m — the band that was completely missing in v1. The smoothstep
  // flattens valley floors (lower plateau) and caps summit plateaus (upper).
  const mr = ridged(x * 145 + 3.7, y * 145 + 21.3, z * 145 - 9.1, 6);
  const relief = smoothstep(0.10, 0.88, mr);

  // ---- rolling hills (2.8 km .. 350 m) and mid detail (380 m .. 90 m) ------
  const hills = fbmR(x * 560 + 5.3, y * 560 - 3.1, z * 560 + 9.7, 4);
  const mid = fbmR(x * 4200 + 2.7, y * 4200 + 8.3, z * 4200 - 4.9, 3, 2.17);

  // Land elevation is built as a non-negative stack so that erosion, which is
  // multiplicative, can never dig an inland basin below sea level.
  let land = coastalPlain * 230 + interior * 640
    + smoothstep(0.22, 0.66, beltRaw) * landMask * 340   // foothill apron
    + uplift * relief * MOUNTAIN_AMP
    + landMask * relief * (150 + 260 * interior);        // drainage relief on plains
  // Valley carving: the inverse of the crest network, strongest in the ranges.
  const carve = 1 - relief;
  land *= 1 - (0.34 + 0.42 * uplift) * carve * carve;
  land += hills * (170 + 520 * uplift + 120 * interior) * landMask;
  land += mid * (85 + 260 * uplift) * landMask;
  // ---- highland terracing --------------------------------------------------
  land = terrace(land, 130, uplift * smoothstep(1100, 2500, land) * 0.42);
  land = Math.max(land, coastalPlain * 6);

  let h = land - shelf * 190 - abyss * 3800;
  // Seamounts and mid-ocean rises keep the sea floor from being a bowl.
  h += (noise(x * 26 + 3.1, y * 26 - 9.4, z * 26 + 17.2) - 0.42) * 900 * abyss;

  // ---- coasts: cliffs or beaches, chosen by a 218 km "coast type" field ----
  const coastType = noise(x * 7.3 + 55.1, y * 7.3 - 21.6, z * 7.3 + 13.4);
  const cliffiness = smoothstep(0.40, 0.70, coastType);
  // Wiggle the cliff line with the hill field so it is not a contour of q.
  const cq = q + hills * 0.0016;
  const shoreBand = 1 - smoothstep(0, 0.0045, Math.abs(cq));
  // Sharp drop just seaward of the shoreline: 0.00035 in q ~ 270 m of ground.
  h -= cliffiness * (25 + 95 * coastType) * (1 - smoothstep(-0.00035, 0.00035, cq)) * shoreBand;
  // Beaches: flatten the profile near shore where the coast is not cliffy,
  // which also widens the shallow shelf offshore.
  h *= 1 - 0.55 * shoreBand * (1 - cliffiness);

  // ---- metre-scale roughness ----------------------------------------------
  // A single rotated 5-octave band spanning 94 m down to 3.3 m. Isolated
  // octaves at these frequencies read as a regular dot lattice; stacking and
  // rotating them gives irregular metre-scale ground instead.
  const micro = fbmR(x * 17000 + 1.3, y * 17000 + 7.7, z * 17000 - 2.1, 5, 2.31);
  const dry = smoothstep(-30, 4, h);
  const rough = 0.8 + 1.5 * uplift + 0.45 * smoothstep(150, 1300, h);
  h += micro * 15 * rough * dry;

  // Dunes: ripples on the first ~12 m of a beach, at 17 m and finer.
  const duneW = shoreBand * (1 - cliffiness) * smoothstep(0.4, 3, h) * (1 - smoothstep(8, 17, h));
  if (duneW > 0) h += duneW * fbmR(x * 90000 - 5.1, y * 90000 + 2.9, z * 90000 + 11.3, 3, 2.41) * 5;

  // ---- polar ice sheets ----------------------------------------------------
  const polar = smoothstep(0.79, 0.90, Math.abs(y));
  if (polar > 0) {
    const iceMask = polar * smoothstep(-0.004, 0.014, q);
    const ice = 780 + hills * 340 + mid * 90;
    h = h * (1 - iceMask) + iceMask * Math.max(h * 0.35 + ice, 45);
  }

  return h;
}

/** 0..1 humidity. Cheap: 5 noise lookups plus latitude bands. */
export function moisture(x, y, z) {
  const base = fbm(x * 11 + 60, y * 11, z * 11, 3);
  const detail = fbm(x * 95 + 7.1, y * 95 - 3.4, z * 95 + 5.6, 2) - 0.5;
  const a = Math.abs(y);
  // Wet equator and temperate belt, dry subtropics, dry poles.
  const bands = 0.085 * Math.cos((a - 0.05) * 11.5) - 0.17 * smoothstep(0.70, 0.95, a);
  return clamp(base * 1.06 + detail * 0.13 + bands - 0.015, 0, 1);
}

export function biomeAt(x, y, z, height = terrainHeight(x, y, z)) {
  if (Math.abs(y) > 0.86 || height > 4200) return 'POLAR ICE';
  if (height < 0) return 'OPEN OCEAN';
  if (height < 85) return 'COASTLAND';
  if (height > 2200) return 'ALPINE HIGHLANDS';
  if (moisture(x, y, z) > 0.46) return 'TEMPERATE FOREST';
  return 'GRASSLAND';
}

/**
 * Terrain slope in radians. Two extra height samples; pass the already-known
 * centre height to keep it to two.
 */
export function slopeAt(x, y, z, h = terrainHeight(x, y, z), step = 9) {
  const RAD = 6_371_000 / 4;
  let tx = z, tz = -x;
  let len = Math.hypot(tx, tz);
  if (len < 0.01) { tx = 1; tz = 0; len = 1; }
  tx /= len; tz /= len;
  const bx = y * tz, by = z * tx - x * tz, bz = -y * tx;
  const e = step / RAD;
  const sample = (ax, ay, az) => {
    const nx = x + ax * e, ny = y + ay * e, nz = z + az * e;
    const l = Math.hypot(nx, ny, nz);
    return terrainHeight(nx / l, ny / l, nz / l);
  };
  const dt = (sample(tx, 0, tz) - h) / step;
  const db = (sample(bx, by, bz) - h) / step;
  return Math.atan(Math.hypot(dt, db));
}

/**
 * Linear-RGB albedo in 0..1 for a surface point. `slope` is in radians; when it
 * is omitted it is measured with two extra height samples.
 */
export function surfaceColor(x, y, z, h, slope = slopeAt(x, y, z, h)) {
  const m = moisture(x, y, z);
  const n = noise(x * 350, y * 350, z * 350);
  const fine = rot1(x, y, z, 9000, 4.4, -1.2, 6.6) * 0.5 + 0.5;
  const a = Math.abs(y);
  let c;

  if (h < 0) {
    // Sea floor: light sand on the shelf, darkening into the abyss.
    const deep = smoothstep(-40, -2, h);
    c = [0.055 + 0.20 * deep, 0.095 + 0.19 * deep, 0.105 + 0.11 * deep];
  } else if (h < 4) {
    // Beach, with a darker wet band right at the waterline.
    const wet = 1 - smoothstep(0.2, 1.5, h);
    c = [0.44 - 0.19 * wet, 0.395 - 0.185 * wet, 0.255 - 0.115 * wet];
  } else {
    const green = smoothstep(0.39, 0.60, m);
    const dryland = [0.235, 0.225, 0.105];
    const forest = [0.055, 0.115, 0.045];
    c = [0, 1, 2].map((i) => dryland[i] + (forest[i] - dryland[i]) * green);
    // Sand persists a little above the beach on dry, low ground.
    const sandy = (1 - smoothstep(4, 22, h)) * (1 - green * 0.7);
    c = [0, 1, 2].map((i) => c[i] + ([0.44, 0.395, 0.255][i] - c[i]) * sandy);
    // Thin, stony alpine ground above the treeline.
    const alpine = smoothstep(1900, 3100, h);
    c = [0, 1, 2].map((i) => c[i] + ([0.27, 0.255, 0.225][i] - c[i]) * alpine);
  }

  // Exposed rock on steep ground, with a warm/cool tint drift.
  const rock = smoothstep(0.52, 0.72, slope) * (h > -6 ? 1 : 0); // 30deg..41deg
  const warm = (n - 0.5) * 2;
  const rockColor = [0.235 + warm * 0.045, 0.222 + warm * 0.018, 0.212 - warm * 0.03];
  // Scree fans below the cliffs: moderate slopes next to steep ones.
  const scree = smoothstep(0.34, 0.50, slope) * (1 - smoothstep(0.52, 0.66, slope)) * smoothstep(0.45, 0.75, fine);
  const screeColor = [0.30, 0.285, 0.255];
  c = [0, 1, 2].map((i) => {
    let v = c[i] + (screeColor[i] - c[i]) * scree * 0.75;
    return v + (rockColor[i] - v) * rock;
  });

  // Latitude-dependent snowline; snow will not hold on very steep faces.
  const snowline = 3500 - 3900 * smoothstep(0.25, 0.94, a);
  const snow = smoothstep(snowline, snowline + 550 + (n - 0.5) * 260, h) * (1 - smoothstep(0.62, 0.86, slope)) * (h > 0 ? 1 : 0);
  // Polar ice cap.
  const ice = Math.max(snow, smoothstep(0.815, 0.885, a + (n - 0.5) * 0.02) * (h > -1 ? 1 : 0));
  const variation = 0.88 + n * 0.24;
  const iceColor = [0.79, 0.86, 0.90];
  return c.map((v, i) => clamp(v * variation * (1 - ice) + iceColor[i] * ice, 0, 1));
}
