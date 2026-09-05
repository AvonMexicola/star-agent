import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TERRAIN_VERSION, terrainHeight, moisture, biomeAt, surfaceColor, slopeAt,
} from '../src/terrain-v2.js';

const RADIUS = 6_371_000 / 4;

/** Deterministic LCG so every run samples exactly the same directions. */
function randomDirections(count, seed) {
  let state = seed >>> 0;
  const next = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const out = [];
  for (let i = 0; i < count; i++) {
    const y = next() * 2 - 1;
    const angle = next() * Math.PI * 2;
    const r = Math.sqrt(1 - y * y);
    out.push([r * Math.cos(angle), y, r * Math.sin(angle)]);
  }
  return out;
}

const latLon = (lat, lon) => {
  const a = lat * Math.PI / 180, b = lon * Math.PI / 180;
  return [Math.cos(a) * Math.sin(b), Math.sin(a), Math.cos(a) * Math.cos(b)];
};

/** Terrain slope in degrees from central differences `step` metres apart. */
function slopeDegrees(direction, step = 10) {
  const [x, y, z] = direction;
  let tx = z, tz = -x;
  let len = Math.hypot(tx, tz);
  if (len < 0.01) { tx = 1; tz = 0; len = 1; }
  tx /= len; tz /= len;
  const bx = y * tz, by = z * tx - x * tz, bz = -y * tx;
  const e = step / RADIUS;
  const sample = (ax, ay, az) => {
    const nx = x + ax * e, ny = y + ay * e, nz = z + az * e;
    const l = Math.hypot(nx, ny, nz);
    return terrainHeight(nx / l, ny / l, nz / l);
  };
  const dt = (sample(tx, 0, tz) - sample(-tx, 0, -tz)) / (2 * step);
  const db = (sample(bx, by, bz) - sample(-bx, -by, -bz)) / (2 * step);
  return Math.atan(Math.hypot(dt, db)) * 180 / Math.PI;
}

// A single shared sample reused by the statistical tests, so the whole file
// stays well under a second.
const SAMPLE = randomDirections(50_000, 20260905);
const HEIGHTS = SAMPLE.map((d) => terrainHeight(...d));

test('exports version 2', () => {
  assert.equal(TERRAIN_VERSION, 2);
});

test('terrainHeight is deterministic', () => {
  for (const d of randomDirections(500, 11)) {
    const first = terrainHeight(...d);
    assert.equal(terrainHeight(...d), first);
    assert.equal(terrainHeight(...d), first);
  }
  // Order of evaluation must not matter either.
  const probes = randomDirections(50, 12);
  const forward = probes.map((d) => terrainHeight(...d));
  const backward = [...probes].reverse().map((d) => terrainHeight(...d)).reverse();
  assert.deepEqual(backward, forward);
});

test('terrainHeight is finite everywhere, including the poles and axes', () => {
  for (const h of HEIGHTS) assert.ok(Number.isFinite(h), 'height must be finite');
  const singular = [[0, 1, 0], [0, -1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]];
  for (const d of singular) {
    assert.ok(Number.isFinite(terrainHeight(...d)), `height at ${d} must be finite`);
    assert.ok(Number.isFinite(slopeAt(...d)), `slope at ${d} must be finite`);
  }
});

test('terrainHeight is C0: a 1e-7 direction step moves the surface only centimetres to decimetres', () => {
  // 1e-7 of a unit direction is 0.16 m of ground. A discontinuity would show up
  // as a jump of many metres; genuine cliffs still only give ~1 m over that.
  let worst = 0;
  for (const [x, y, z] of randomDirections(4000, 13)) {
    const h0 = terrainHeight(x, y, z);
    for (const [dx, dy, dz] of [[1e-7, 0, 0], [0, 1e-7, 0], [0, 0, 1e-7]]) {
      const nx = x + dx, ny = y + dy, nz = z + dz;
      const l = Math.hypot(nx, ny, nz);
      worst = Math.max(worst, Math.abs(terrainHeight(nx / l, ny / l, nz / l) - h0));
    }
  }
  assert.ok(worst < 5, `max |dh| over a 1e-7 step was ${worst.toFixed(3)} m`);
});

test('terrainHeight converges as the step shrinks (no hidden steps)', () => {
  // Shrinking the step by 10x must shrink the height difference by roughly 10x.
  // Individual samples can sit near a local extremum, where the coarse step
  // happens to land back at the same height, so compare the totals instead.
  let coarseTotal = 0, fineTotal = 0;
  for (const [x, y, z] of randomDirections(2000, 14)) {
    const h0 = terrainHeight(x, y, z);
    const at = (s) => {
      const nx = x + s, ny = y + s * 0.5, nz = z - s * 0.3;
      const l = Math.hypot(nx, ny, nz);
      return Math.abs(terrainHeight(nx / l, ny / l, nz / l) - h0);
    };
    coarseTotal += at(1e-6);
    fineTotal += at(1e-7);
  }
  const ratio = fineTotal / coarseTotal;
  assert.ok(ratio < 0.3, `aggregate fine/coarse height delta ratio was ${ratio.toFixed(3)}`);
});

test('height range stays inside (-9000, 6000) metres', () => {
  let min = Infinity, max = -Infinity;
  for (const h of HEIGHTS) { if (h < min) min = h; if (h > max) max = h; }
  assert.ok(min > -9000, `deepest point was ${min.toFixed(0)} m`);
  assert.ok(max < 6000, `highest point was ${max.toFixed(0)} m`);
  // The planet must actually use its range: real ocean basins and real peaks.
  assert.ok(min < -2500, `deepest point was only ${min.toFixed(0)} m`);
  assert.ok(max > 4000, `highest point was only ${max.toFixed(0)} m`);
});

test('ocean covers between 45% and 75% of the surface', () => {
  const ocean = HEIGHTS.filter((h) => h < 0).length / HEIGHTS.length;
  assert.ok(ocean > 0.45 && ocean < 0.75, `ocean fraction was ${(ocean * 100).toFixed(1)}%`);
});

test('land carries genuinely steep ground', () => {
  const land = [];
  for (let i = 0; i < SAMPLE.length && land.length < 3000; i++) {
    if (HEIGHTS[i] > 5) land.push(SAMPLE[i]);
  }
  const slopes = land.map((d) => slopeDegrees(d));
  const steep = slopes.filter((s) => s > 35).length;
  assert.ok(steep >= 60, `only ${steep} of ${slopes.length} land samples exceeded 35 degrees`);
  // ...but most of the planet must still be walkable, not a field of spikes.
  const median = slopes.slice().sort((a, b) => a - b)[slopes.length >> 1];
  assert.ok(median < 20, `median land slope was ${median.toFixed(1)} degrees`);
  // And it must not be a plane either: v1's median was 2.6 degrees.
  assert.ok(median > 4, `median land slope was only ${median.toFixed(1)} degrees`);
});

test('metre-scale roughness makes the ground non-planar when walking', () => {
  // Sample a 40 m line on gentle land; a plane would give a perfectly linear
  // profile, so measure the deviation from the straight line through the ends.
  const centre = latLon(31.2, 15.6);
  const [x, y, z] = centre;
  let tx = z, tz = -x;
  const len = Math.hypot(tx, tz); tx /= len; tz /= len;
  const heights = [];
  for (let i = 0; i <= 40; i++) {
    const s = (i - 20) * 2 / RADIUS;
    const nx = x + tx * s, ny = y, nz = z + tz * s;
    const l = Math.hypot(nx, ny, nz);
    heights.push(terrainHeight(nx / l, ny / l, nz / l));
  }
  let deviation = 0;
  for (let i = 0; i <= 40; i++) {
    const line = heights[0] + (heights[40] - heights[0]) * (i / 40);
    deviation = Math.max(deviation, Math.abs(heights[i] - line));
  }
  assert.ok(deviation > 0.15, `an 80 m walking profile deviated only ${deviation.toFixed(3)} m from a straight line`);
});

test('moisture stays in 0..1 and is deterministic', () => {
  let below = 0;
  for (const d of SAMPLE) {
    const m = moisture(...d);
    assert.ok(m >= 0 && m <= 1, `moisture ${m} outside 0..1`);
    if (m > 0.5) below++;
  }
  // Both wet and dry regions have to exist, or forests/grassland collapse.
  const wet = below / SAMPLE.length;
  assert.ok(wet > 0.2 && wet < 0.8, `fraction with moisture > 0.5 was ${(wet * 100).toFixed(1)}%`);
  const probe = latLon(19, 22);
  assert.equal(moisture(...probe), moisture(...probe));
});

test('biomeAt returns polar ice near the poles and ocean below sea level', () => {
  for (const lat of [87, 80, -83, -89]) {
    for (const lon of [-160, -40, 15, 120]) {
      assert.equal(biomeAt(...latLon(lat, lon)), 'POLAR ICE', `lat ${lat} lon ${lon}`);
    }
  }
  const names = new Set(SAMPLE.map((d, i) => biomeAt(...d, HEIGHTS[i])));
  for (const expected of ['OPEN OCEAN', 'COASTLAND', 'GRASSLAND', 'TEMPERATE FOREST', 'ALPINE HIGHLANDS', 'POLAR ICE']) {
    assert.ok(names.has(expected), `biome ${expected} never occurs`);
  }
  for (let i = 0; i < SAMPLE.length; i += 7) {
    if (HEIGHTS[i] < 0 && Math.abs(SAMPLE[i][1]) <= 0.86) {
      assert.equal(biomeAt(...SAMPLE[i], HEIGHTS[i]), 'OPEN OCEAN');
    }
  }
});

test('polar ice sheets are gently undulating, not spiky', () => {
  for (const lon of [-120, -30, 45, 150]) {
    const d = latLon(78, lon);
    assert.ok(slopeAt(...d) * 180 / Math.PI < 45, `polar slope too steep at lon ${lon}`);
  }
});

test('surfaceColor returns linear RGB inside [0,1]', () => {
  for (let i = 0; i < SAMPLE.length; i += 11) {
    const c = surfaceColor(...SAMPLE[i], HEIGHTS[i]);
    assert.equal(c.length, 3);
    for (const v of c) assert.ok(v >= 0 && v <= 1 && Number.isFinite(v), `channel ${v} outside 0..1`);
  }
  // Explicit slope argument must be honoured and must not break the range.
  for (const slope of [0, 0.3, 0.7, 1.2, Math.PI / 2]) {
    for (const d of randomDirections(40, 15)) {
      const c = surfaceColor(...d, terrainHeight(...d), slope);
      for (const v of c) assert.ok(v >= 0 && v <= 1, `channel ${v} outside 0..1 at slope ${slope}`);
    }
  }
  // Steep ground reads as grey rock rather than green.
  const [r, g, b] = surfaceColor(...latLon(24.8, 60.6), 3238, 1.1);
  assert.ok(Math.abs(r - g) < 0.12 && Math.abs(g - b) < 0.12, `steep ground was not neutral: ${[r, g, b]}`);
});

test('findDestinations-style search still finds coast, forest and mountain', () => {
  // Mirrors world.js findDestinations() exactly, run against terrain v2.
  const result = {};
  let coastScore = Infinity, forestScore = Infinity, mountainScore = Infinity;
  for (let lat = -48; lat <= 65; lat += 1.4) {
    for (let lon = -85; lon <= 85; lon += 1.4) {
      const d = latLon(lat, lon), h = terrainHeight(...d), m = moisture(...d);
      const bias = Math.abs(lat - 19) * 0.3 + Math.abs(lon - 22) * 0.14;
      if (h > 20 && h < 180) { const s = Math.abs(h - 55) + bias; if (s < coastScore) { coastScore = s; result.coast = h; } }
      if (h > 150 && h < 1500 && m > 0.5) { const s = Math.abs(h - 450) * 0.06 + bias; if (s < forestScore) { forestScore = s; result.forest = h; } }
      if (h > 2600 && h < 4200) { const s = Math.abs(h - 3300) * 0.015 + bias; if (s < mountainScore) { mountainScore = s; result.mountain = h; } }
    }
  }
  assert.ok(result.coast > 20 && result.coast < 180, `coast height ${result.coast}`);
  assert.ok(result.forest > 150 && result.forest < 1500, `forest height ${result.forest}`);
  assert.ok(result.mountain > 2600 && result.mountain < 4200, `mountain height ${result.mountain}`);
});

test('terrainHeight cost stays within 4x of world.js', async () => {
  const { terrainHeight: v1 } = await import('../src/world.js');
  const probes = randomDirections(60_000, 16);
  const time = (fn) => {
    let acc = 0;
    for (const d of probes) acc += fn(d[0], d[1], d[2]); // warm up
    const t0 = process.hrtime.bigint();
    for (const d of probes) acc += fn(d[0], d[1], d[2]);
    const t1 = process.hrtime.bigint();
    assert.ok(Number.isFinite(acc));
    return Number(t1 - t0);
  };
  time(v1); time(terrainHeight);
  const ratio = Math.min(
    time(terrainHeight) / time(v1),
    time(terrainHeight) / time(v1),
    time(terrainHeight) / time(v1),
  );
  assert.ok(ratio < 4, `terrain v2 cost ${ratio.toFixed(2)}x of world.js terrainHeight`);
});
