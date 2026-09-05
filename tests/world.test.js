import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RADIUS, SUN_DISTANCE, GRID, MAX_LEVEL, hash, noise, fbm, terrainHeight, moisture, biomeAt,
  surfaceColor, cubeDirection, latLonDirection, generatePatch, findDestinations,
} from '../src/world.js';

const near = (actual, expected, tolerance, description) => {
  assert.ok(Math.abs(actual - expected) <= tolerance,
    `${description}: ${actual} differs from ${expected} by more than ${tolerance}`);
};

test('terrain remains deterministic across unrelated queries and contains land and ocean', () => {
  const samples = [];
  for (let latitude = -80; latitude <= 80; latitude += 20) {
    for (let longitude = -180; longitude < 180; longitude += 30) {
      const direction = latLonDirection(latitude, longitude);
      samples.push({ direction, height: terrainHeight(...direction) });
    }
  }
  for (const { direction, height } of samples.toReversed()) {
    assert.equal(terrainHeight(...direction), height);
    assert.ok(Number.isFinite(height));
  }
  assert.ok(samples.some(({ height }) => height < -100));
  assert.ok(samples.some(({ height }) => height > 2200));
});

test('all cube faces meet on the same unit directions and terrain elevations', () => {
  const boundaries = new Map();
  const coordinates = [-1, -0.75, 0, 0.75, 1];
  for (let face = 0; face < 6; face++) {
    for (const u of coordinates) for (const v of coordinates) {
      const direction = cubeDirection(face, u, v);
      near(Math.hypot(...direction), 1, 1e-14, 'unit direction');
      if (Math.abs(u) !== 1 && Math.abs(v) !== 1) continue;
      const key = direction.map(value => value.toFixed(12)).join(',');
      if (!boundaries.has(key)) boundaries.set(key, []);
      boundaries.get(key).push({ face, direction, height: terrainHeight(...direction) });
    }
  }
  assert.equal(boundaries.size, 44, '12 edges with three internal samples, plus eight corners');
  for (const samples of boundaries.values()) {
    assert.ok(samples.length === 2 || samples.length === 3, 'every boundary has adjacent faces');
    assert.equal(new Set(samples.map(sample => sample.face)).size, samples.length);
    for (const sample of samples.slice(1)) {
      sample.direction.forEach((value, axis) => near(value, samples[0].direction[axis], 1e-14, 'seam direction'));
      near(sample.height, samples[0].height, 1e-8, 'seam elevation');
    }
  }
});

test('patch geometry reconstructs the same globe from local Float32 positions at every LOD', () => {
  for (const level of [0, 8, MAX_LEVEL]) for (let face = 0; face < 6; face++) {
    const tiles = 2 ** level;
    const ix = Math.floor(tiles * 0.4), iy = Math.floor(tiles * 0.6);
    const patch = generatePatch({ face, level, ix, iy });
    const vertexCount = patch.positions.length / 3;
    assert.ok(patch.positions instanceof Float32Array);
    assert.ok(patch.indices instanceof Uint16Array);
    assert.equal(patch.indices.length % 3, 0);
    assert.ok(patch.indices.length > GRID * GRID * 6, 'skirts supplement the surface');
    for (const index of patch.indices) assert.ok(index >= 0 && index < vertexCount);
    for (const field of ['positions', 'waterPositions', 'normals', 'directions', 'colors', 'heights']) {
      for (const value of patch[field]) assert.ok(Number.isFinite(value), `${field} is finite on face ${face}`);
    }
    for (let vertex = 0; vertex < vertexCount; vertex++) {
      const k = vertex * 3;
      const normal = patch.normals.subarray(k, k + 3);
      near(Math.hypot(...normal), 1, 1e-6, 'normal length');
      assert.ok(normal.reduce((sum, value, axis) => sum + value * patch.directions[k + axis], 0) > 0,
        'surface normal points outward');
    }
    for (let j = 0; j <= GRID; j++) for (let i = 0; i <= GRID; i++) {
      const direction = cubeDirection(face, -1 + (ix + i / GRID) * 2 / tiles,
        -1 + (iy + j / GRID) * 2 / tiles);
      const radius = RADIUS + terrainHeight(...direction);
      const k = (j * (GRID + 1) + i) * 3;
      for (let axis = 0; axis < 3; axis++) {
        const local = patch.positions[k + axis];
        const tolerance = Math.max(1e-6, Math.abs(local) * 2 ** -23);
        near(patch.center[axis] + local, direction[axis] * radius, tolerance, 'terrain position');
        const waterLocal = patch.waterPositions[k + axis];
        near(patch.center[axis] + waterLocal, direction[axis] * RADIUS,
          Math.max(1e-6, Math.abs(waterLocal) * 2 ** -23), 'sea-level position');
        if (level === MAX_LEVEL) {
          near(patch.center[axis] + local, direction[axis] * radius, 0.001, 'ground LOD millimetre precision');
        }
      }
    }
    // Triangle winding must face space on every cube face, including the poles.
    for (let triangle = 0; triangle < GRID * GRID * 6; triangle += 3) {
      const [a, b, c] = patch.indices.subarray(triangle, triangle + 3);
      const ab = [0, 1, 2].map(axis => patch.positions[b * 3 + axis] - patch.positions[a * 3 + axis]);
      const ac = [0, 1, 2].map(axis => patch.positions[c * 3 + axis] - patch.positions[a * 3 + axis]);
      const cross = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
      assert.ok(cross.reduce((sum, value, axis) => sum + value * patch.directions[a * 3 + axis], 0) > 0,
        `triangle faces outward at level ${level}, face ${face}`);
    }
  }
});

test('destination shortcuts lead to their advertised procedural biomes', () => {
  const destinations = findDestinations();
  assert.deepEqual(findDestinations(), destinations, 'destination search is deterministic');
  for (const [name, direction] of Object.entries(destinations)) {
    near(Math.hypot(...direction), 1, 1e-14, `${name} unit direction`);
  }
  const coastHeight = terrainHeight(...destinations.coast);
  assert.ok(coastHeight > 0 && coastHeight < 85, 'coast is exposed beach');
  assert.equal(biomeAt(...destinations.coast), 'COASTLAND');
  const forestHeight = terrainHeight(...destinations.forest);
  assert.ok(forestHeight > 150 && forestHeight < 1500);
  assert.ok(moisture(...destinations.forest) > 0.5, 'forest has sufficient moisture');
  assert.equal(biomeAt(...destinations.forest), 'TEMPERATE FOREST');
  const mountainHeight = terrainHeight(...destinations.mountain);
  assert.ok(mountainHeight > 2600 && mountainHeight < 4200);
  assert.equal(biomeAt(...destinations.mountain), 'ALPINE HIGHLANDS');
  assert.ok(Math.abs(destinations.polar[1]) > 0.86);
  assert.equal(biomeAt(...destinations.polar), 'POLAR ICE');
});

test('quarter-Earth world and distant sun retain centimetres through CPU origin subtraction', () => {
  assert.equal(RADIUS * 4, 6_371_000);
  assert.equal(SUN_DISTANCE / 1000, 25_000_000);
  for (const offset of [0.01, -0.01, 1.23, 123.45]) {
    const cameraPosition = SUN_DISTANCE;
    const objectPosition = SUN_DISTANCE + offset;
    const gpuRelativePosition = Math.fround(objectPosition - cameraPosition);
    near(gpuRelativePosition, offset, 0.00001, 'subtract in doubles before converting to GPU floats');
  }
  assert.equal(Math.fround(SUN_DISTANCE + 0.01), Math.fround(SUN_DISTANCE),
    'absolute GPU Float32 coordinates cannot represent a centimetre at solar distance');
});

// ---------------------------------------------------------------------------
// Unit-level coverage of the primitives the patch pipeline is built from.
// ---------------------------------------------------------------------------

const BIOMES = new Set([
  'POLAR ICE', 'OPEN OCEAN', 'COASTLAND', 'ALPINE HIGHLANDS', 'TEMPERATE FOREST', 'GRASSLAND',
]);

// Small deterministic LCG so "random" sampling stays reproducible across runs.
function makeRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}
function randomDirection(random) {
  for (;;) {
    const x = random() * 2 - 1, y = random() * 2 - 1, z = random() * 2 - 1;
    const length = Math.hypot(x, y, z);
    if (length > 1e-3 && length <= 1) return [x / length, y / length, z / length];
  }
}

test('constants describe a quarter-Earth planet 25 million kilometres from its star', () => {
  assert.equal(RADIUS, 6_371_000 / 4);
  assert.equal(SUN_DISTANCE, 25e9);
});

test('hash is a deterministic integer hash bounded to the unit interval', () => {
  const inputs = [[0, 0, 0], [1, 2, 3], [-1, -2, -3], [-7, 13, -2048], [123456, -654321, 99],
    [2147483647, -2147483648, 5], [-1, 0, 0], [0, -1, 0], [0, 0, -1]];
  const seen = new Map();
  for (const [x, y, z] of inputs) {
    const value = hash(x, y, z);
    assert.ok(Number.isFinite(value), `hash(${x},${y},${z}) is finite`);
    assert.ok(value >= 0 && value <= 1, `hash(${x},${y},${z}) = ${value} is inside [0,1]`);
    assert.equal(hash(x, y, z), value, 'hash is deterministic');
    seen.set(`${x},${y},${z}`, value);
  }
  assert.equal(new Set(seen.values()).size, inputs.length, 'distinct lattice points hash differently');
  assert.notEqual(hash(-1, -2, -3), hash(1, 2, 3), 'sign of the input matters');
});

test('noise and fbm stay in the unit interval, are deterministic and C0-continuous', () => {
  const random = makeRandom(0xC0FFEE);
  for (let sample = 0; sample < 400; sample++) {
    const x = random() * 200 - 100, y = random() * 200 - 100, z = random() * 200 - 100;
    for (const [name, fn] of [['noise', noise], ['fbm', fbm]]) {
      const value = fn(x, y, z);
      assert.ok(value >= 0 && value <= 1, `${name}(${x},${y},${z}) = ${value} is inside [0,1]`);
      assert.equal(fn(x, y, z), value, `${name} is deterministic`);
      // Continuity: an offset of a micrometre may not produce a visible seam.
      const nudged = fn(x + 1e-6, y + 1e-6, z + 1e-6);
      assert.ok(Math.abs(nudged - value) < 1e-3,
        `${name} is C0-continuous near (${x},${y},${z}): ${value} vs ${nudged}`);
    }
  }
  // Continuity must also hold when the nudge steps across an integer lattice plane.
  for (const base of [0, 1, -1, 5, -12]) {
    const before = noise(base - 5e-7, base + 0.25, base - 0.25);
    const after = noise(base + 5e-7, base + 0.25, base - 0.25);
    assert.ok(Math.abs(after - before) < 1e-3, `noise is continuous across the lattice plane x=${base}`);
  }
  assert.notEqual(fbm(0.3, 0.7, 1.1), fbm(4.3, 0.7, 1.1), 'fbm varies with position');
});

test('terrainHeight is finite, deterministic, and carves both ocean floor and dry land', () => {
  const random = makeRandom(0x5EED);
  let below = 0, above = 0, minimum = Infinity, maximum = -Infinity;
  for (let sample = 0; sample < 500; sample++) {
    const direction = randomDirection(random);
    const height = terrainHeight(...direction);
    assert.ok(Number.isFinite(height), `terrainHeight${JSON.stringify(direction)} is finite`);
    assert.equal(terrainHeight(...direction), height, 'terrainHeight is deterministic');
    // Amplitude ceiling of the generator: 19 km continent band + 4 km ridges + detail.
    assert.ok(height > -20_000 && height < 14_000,
      `terrainHeight${JSON.stringify(direction)} = ${height} is a plausible elevation`);
    if (height < 0) below++; else above++;
    minimum = Math.min(minimum, height);
    maximum = Math.max(maximum, height);
  }
  assert.ok(below > 0, `some samples are ocean (min ${minimum})`);
  assert.ok(above > 0, `some samples are land (max ${maximum})`);
});

test('biomeAt classifies every direction into a known biome', () => {
  const random = makeRandom(0xB10);
  for (let sample = 0; sample < 400; sample++) {
    const direction = randomDirection(random);
    assert.ok(BIOMES.has(biomeAt(...direction)), `biomeAt${JSON.stringify(direction)} is a known biome`);
  }
  for (const latitude of [-90, -88, -75, 75, 88, 90]) {
    for (const longitude of [-160, -30, 0, 45, 175]) {
      const direction = latLonDirection(latitude, longitude);
      assert.ok(Math.abs(direction[1]) > 0.9, 'high latitude means a high |y|');
      assert.equal(biomeAt(...direction), 'POLAR ICE', `latitude ${latitude} is ice`);
    }
  }
  // Below sea level away from the caps is open water, whatever the underlying noise says.
  for (const direction of [[0, 0, 1], [1, 0, 0], [0, 0.5, Math.sqrt(0.75)], [-0.6, -0.8, 0]]) {
    assert.ok(Math.abs(direction[1]) <= 0.86, 'sample sits outside the polar cap');
    assert.equal(biomeAt(...direction, -1), 'OPEN OCEAN');
    assert.equal(biomeAt(...direction, -3200), 'OPEN OCEAN');
  }
});

test('surfaceColor returns three displayable channels', () => {
  const random = makeRandom(0xC010);
  for (let sample = 0; sample < 300; sample++) {
    const direction = randomDirection(random);
    for (const height of [terrainHeight(...direction), -4000, 0, 60, 900, 3000, 6000]) {
      const color = surfaceColor(...direction, height);
      assert.equal(color.length, 3);
      for (const channel of color) {
        assert.equal(typeof channel, 'number');
        assert.ok(channel >= 0 && channel <= 1.2,
          `channel ${channel} is displayable at height ${height}`);
      }
    }
  }
});

test('cubeDirection maps the cube onto the sphere with matching face centres and corners', () => {
  const centers = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  for (let face = 0; face < 6; face++) {
    centers[face].forEach((expected, axis) =>
      near(cubeDirection(face, 0, 0)[axis], expected, 1e-15, `face ${face} centre axis ${axis}`));
    for (const u of [-1, -0.6, -1 / 3, 0, 0.25, 0.9, 1]) for (const v of [-1, -0.9, 0, 0.5, 1]) {
      near(Math.hypot(...cubeDirection(face, u, v)), 1, 1e-14, `face ${face} (${u},${v}) is a unit vector`);
    }
  }
  // Face 0 is +x with y=v, z=-u; face 2 is +y with x=u, z=-v: they share the (1,1,1) corner.
  const corner = cubeDirection(0, -1, 1);
  cubeDirection(2, 1, -1).forEach((value, axis) =>
    near(value, corner[axis], 1e-15, 'faces 0 and 2 share the +x+y+z corner'));
  near(corner[0], 1 / Math.sqrt(3), 1e-15, 'corner is the normalised cube corner');
  // Every one of the eight cube corners is produced by exactly three faces.
  const corners = new Map();
  for (let face = 0; face < 6; face++) for (const u of [-1, 1]) for (const v of [-1, 1]) {
    const key = cubeDirection(face, u, v).map(value => value.toFixed(12)).join(',');
    corners.set(key, (corners.get(key) ?? 0) + 1);
  }
  assert.equal(corners.size, 8, 'the cube has eight corners');
  for (const [key, count] of corners) assert.equal(count, 3, `corner ${key} is shared by three faces`);
});

test('latLonDirection is a unit vector with +z at the origin and +y at the pole', () => {
  for (const latitude of [-90, -61, -30, 0, 17, 45, 90]) {
    for (const longitude of [-180, -90, -14, 0, 60, 180]) {
      const direction = latLonDirection(latitude, longitude);
      near(Math.hypot(...direction), 1, 1e-14, `(${latitude},${longitude}) is a unit vector`);
      near(direction[1], Math.sin(latitude * Math.PI / 180), 1e-14, 'y encodes latitude');
    }
  }
  latLonDirection(0, 0).forEach((value, axis) => near(value, [0, 0, 1][axis], 1e-15, 'origin points at +z'));
  for (const longitude of [-120, 0, 33, 180]) {
    latLonDirection(90, longitude).forEach((value, axis) =>
      near(value, [0, 1, 0][axis], 1e-15, `north pole at longitude ${longitude} points at +y`));
  }
});

test('generatePatch emits consistent, unit-normalled, sphere-anchored buffers with sunken skirts', () => {
  const SURFACE = (GRID + 1) ** 2;
  for (const parameters of [
    { face: 0, level: 0, ix: 0, iy: 0 },
    { face: 3, level: 4, ix: 5, iy: 11 },
    { face: 5, level: 12, ix: 1234, iy: 3000 },
    { face: 2, level: MAX_LEVEL, ix: 2 ** MAX_LEVEL - 1, iy: 0 },
  ]) {
    const patch = generatePatch(parameters);
    const label = JSON.stringify(parameters);
    const vertexCount = patch.heights.length;
    assert.equal(patch.positions.length, vertexCount * 3, `positions length ${label}`);
    assert.equal(patch.normals.length, patch.positions.length, `normals length ${label}`);
    assert.equal(patch.colors.length, patch.positions.length, `colors length ${label}`);
    assert.equal(patch.directions.length, patch.positions.length, `directions length ${label}`);
    assert.equal(patch.waterPositions.length, patch.positions.length, `waterPositions length ${label}`);
    assert.equal(vertexCount, SURFACE + 4 * (GRID + 1), `surface grid plus four skirts ${label}`);

    assert.equal(patch.indices.length % 3, 0, `triangle list ${label}`);
    assert.ok(patch.indices.length >= GRID * GRID * 6, `at least the surface quads ${label}`);
    for (const index of patch.indices) {
      assert.ok(Number.isInteger(index) && index >= 0 && index < vertexCount,
        `index ${index} addresses a vertex ${label}`);
    }

    const centerRadius = Math.hypot(...patch.center);
    near(centerRadius / RADIUS, 1, 1e-6, `patch centre sits on the sphere ${label}`);

    const size = 2 / 2 ** parameters.level;
    const skirtDepth = Math.max(4, size * RADIUS * 0.045);
    for (let vertex = 0; vertex < vertexCount; vertex++) {
      const k = vertex * 3;
      near(Math.hypot(patch.normals[k], patch.normals[k + 1], patch.normals[k + 2]), 1, 1e-3,
        `normal ${vertex} is unit length ${label}`);
      near(Math.hypot(patch.directions[k], patch.directions[k + 1], patch.directions[k + 2]), 1, 1e-6,
        `direction ${vertex} is unit length ${label}`);
      // Float32 locals lose the low bits of a large offset; scale the tolerance with them.
      const waterRadius = Math.hypot(...[0, 1, 2].map(axis => patch.center[axis] + patch.waterPositions[k + axis]));
      const tolerance = Math.max(0.01, Math.hypot(patch.waterPositions[k], patch.waterPositions[k + 1],
        patch.waterPositions[k + 2]) * 2 ** -20);
      const expected = vertex < SURFACE ? RADIUS : RADIUS - skirtDepth;
      near(waterRadius, expected, tolerance, `water vertex ${vertex} sits at sea level ${label}`);
      near(Math.hypot(...[0, 1, 2].map(axis => patch.center[axis] + patch.positions[k + axis])),
        RADIUS + patch.heights[vertex] - (vertex < SURFACE ? 0 : skirtDepth),
        Math.max(0.01, Math.hypot(patch.positions[k], patch.positions[k + 1], patch.positions[k + 2]) * 2 ** -20),
        `terrain vertex ${vertex} sits at its own elevation ${label}`);
    }

    // The four skirts are written edge by edge, in the same order as the source edge loops.
    const edges = [
      Array.from({ length: GRID + 1 }, (_, i) => i),
      Array.from({ length: GRID + 1 }, (_, j) => j * (GRID + 1) + GRID),
      Array.from({ length: GRID + 1 }, (_, i) => GRID * (GRID + 1) + GRID - i),
      Array.from({ length: GRID + 1 }, (_, j) => (GRID - j) * (GRID + 1)),
    ];
    let skirt = SURFACE;
    for (const edge of edges) for (const source of edge) {
      const radiusOf = index => Math.hypot(...[0, 1, 2].map(axis =>
        patch.center[axis] + patch.positions[index * 3 + axis]));
      const drop = radiusOf(source) - radiusOf(skirt);
      assert.ok(drop > 0, `skirt vertex ${skirt} hangs below surface vertex ${source} ${label}`);
      near(drop, skirtDepth, Math.max(0.05, skirtDepth * 1e-4), `skirt depth at ${skirt} ${label}`);
      for (let axis = 0; axis < 3; axis++) {
        near(patch.directions[skirt * 3 + axis], patch.directions[source * 3 + axis], 1e-6,
          `skirt vertex ${skirt} keeps the direction of ${source} ${label}`);
      }
      skirt++;
    }
    assert.equal(skirt, vertexCount, `every skirt vertex is accounted for ${label}`);
  }
});

test('generatePatch is bit-for-bit reproducible', () => {
  for (const parameters of [{ face: 1, level: 6, ix: 20, iy: 41 }, { face: 4, level: 0, ix: 0, iy: 0 }]) {
    const first = generatePatch(parameters);
    const second = generatePatch(parameters);
    assert.deepEqual(second.center, first.center);
    for (const field of ['positions', 'normals', 'colors', 'directions', 'waterPositions', 'heights', 'indices']) {
      assert.deepEqual(Array.from(second[field]), Array.from(first[field]),
        `${field} is identical between two identical calls`);
    }
  }
});

test('findDestinations returns unit vectors inside their advertised elevation bands', () => {
  const destinations = findDestinations();
  for (const name of ['coast', 'forest', 'mountain', 'polar']) {
    assert.ok(Array.isArray(destinations[name]), `${name} destination exists`);
    assert.equal(destinations[name].length, 3);
    near(Math.hypot(...destinations[name]), 1, 1e-14, `${name} is a unit vector`);
  }
  const heights = {
    coast: terrainHeight(...destinations.coast),
    forest: terrainHeight(...destinations.forest),
    mountain: terrainHeight(...destinations.mountain),
  };
  const bands = { coast: [20, 180], forest: [150, 1500], mountain: [2600, 4200] };
  for (const [name, [low, high]] of Object.entries(bands)) {
    assert.ok(heights[name] > low && heights[name] < high,
      `${name} elevation ${heights[name]} is inside (${low}, ${high})`);
  }
});
