import test from 'node:test';
import assert from 'node:assert/strict';
import { PYRE_POSITION, PYRE_RADIUS, pyreLatLon, pyreSurfaceBody, fromPyreBody, toPyreBody, VOLCANOES, LAVA_FIELDS } from '../src/pyre-world.js';
import { PYREBEAR_HABITAT, PYREBEAR_HABITAT_VERSION, samplePyrebearHabitat, samplePyrebearFooting, enumeratePyrebearSpawns } from '../src/fauna/pyrebear-habitat.js';

const qaDirection = pyreLatLon(5, 90);
const surfacePosition = (d, clearance = 0) => fromPyreBody(...d.map(v => v * (PYRE_RADIUS + pyreSurfaceBody(...d).height + clearance))).map((v, i) => v + PYRE_POSITION[i]);
const dist = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
const normalize = a => { const length = Math.hypot(...a); return a.map(v => v / length); };

test('real dry terminator site has stable seeded population, independent of query history', () => {
  assert.equal(PYREBEAR_HABITAT_VERSION, 1);
  const p = surfacePosition(qaDirection), first = enumeratePyrebearSpawns(p);
  assert.equal(first.length, 3);
  assert.equal(first[0].id, 'pyrebear-v1:7291:9961,872,0');
  for (const d of [pyreLatLon(-70, 90), pyreLatLon(5, -90), [0, 1, 0]]) enumeratePyrebearSpawns(surfacePosition(d), { seed: 912 });
  assert.deepEqual(enumeratePyrebearSpawns(p), first);
  assert.deepEqual(enumeratePyrebearSpawns({ x: p[0], y: p[1], z: p[2] }), first);
  assert.notDeepEqual(enumeratePyrebearSpawns(p, { seed: 42 }), first);
  // The query owns no returned mutable objects; consumer edits cannot poison it.
  first[0].position[0] = 0;
  assert.notEqual(enumeratePyrebearSpawns(p)[0].position[0], 0);
});

test('overlapping queries retain identical anchors and phases regardless of traversal order', () => {
  const p = surfacePosition(qaDirection), shift = fromPyreBody(0, 60, 0);
  const a = enumeratePyrebearSpawns(p), b = enumeratePyrebearSpawns(p.map((v, i) => v + shift[i]));
  const common = a.filter(s => b.some(t => t.id === s.id));
  assert.ok(common.length >= 2);
  for (const spawn of common) assert.deepEqual(b.find(s => s.id === spawn.id), spawn);
  assert.deepEqual(enumeratePyrebearSpawns(p), a);
  assert.equal(new Set(b.map(s => s.id)).size, b.length);
});

test('anchors use canonical terrain doubles, dry 2m/5m footprints and finite unit normals', () => {
  const p = surfacePosition(qaDirection), spawns = enumeratePyrebearSpawns(p);
  for (const spawn of spawns) {
    const h = samplePyrebearHabitat(spawn.bodyDirection);
    assert.ok(h);
    assert.deepEqual(h.position, spawn.position);
    assert.equal(h.region, 'BASALT PLAINS');
    assert.ok(h.activity < .08 && h.fresh < .08 && Math.abs(spawn.bodyDirection[2]) <= .04);
    assert.ok(h.slope <= Math.tan(18 * Math.PI / 180));
    const relative = spawn.position.map((v, i) => v - PYRE_POSITION[i]);
    assert.ok(Math.abs(Math.hypot(...relative) - PYRE_RADIUS - pyreSurfaceBody(...spawn.bodyDirection).height) < 1e-5);
    assert.ok(dist(normalize(toPyreBody(...relative)), spawn.bodyDirection) < 1e-10);
    assert.ok(Math.abs(Math.hypot(...spawn.normal) - 1) < 1e-12);
    assert.ok(dist(spawn.position, p) <= PYREBEAR_HABITAT.defaultRadius);
    assert.ok(spawn.heading >= 0 && spawn.heading < 2 * Math.PI && spawn.phase >= 0 && spawn.phase < 1);
    // Independent footprint check, including both opposite directions.
    const d = spawn.bodyDirection, east = normalize([-d[2], 0, d[0]]);
    const north = [d[1]*east[2]-d[2]*east[1],d[2]*east[0]-d[0]*east[2],d[0]*east[1]-d[1]*east[0]];
    for (const metres of [2, 5]) for (const t of [east, north]) for (const sign of [-1, 1]) {
      const q = normalize(d.map((v, i) => v + sign*t[i]*metres/(PYRE_RADIUS+h.height)));
      const s = pyreSurfaceBody(...q);
      assert.equal(s.region, 'BASALT PLAINS');
      assert.ok(s.activity < .08 && s.fresh < .08);
      assert.ok(Math.abs(s.height-h.height)/metres <= PYREBEAR_HABITAT.maxSlope);
    }
  }
});

test('lava, caldera, illuminated/dark hemispheres and invalid habitat directions are excluded', () => {
  for (const landmark of [...VOLCANOES, ...LAVA_FIELDS]) assert.equal(samplePyrebearHabitat(landmark.direction), null);
  for (const d of [[0, 0, 1], [0, 0, -1], [0, 0, 0], [NaN, 1, 0], null]) assert.equal(samplePyrebearHabitat(d), null);
  assert.ok(samplePyrebearHabitat(qaDirection));
});

test('a real dry basalt rock edge is excluded by footprint slope, not just its biome', () => {
  const d = [.9962026390400648, .08706477009324627, -.0001666679952135143];
  const center = pyreSurfaceBody(...d);
  assert.equal(center.region, 'BASALT PLAINS');
  assert.equal(center.fresh, 0);
  const q = normalize(d.map((v, i) => v - (i === 1 ? 2/(PYRE_RADIUS+center.height) : 0)));
  assert.ok(Math.abs(pyreSurfaceBody(...q).height-center.height)/2 > .5);
  assert.equal(samplePyrebearHabitat(d), null);
});

test('Cartesian sign seam and negative cell coordinates neither duplicate nor move anchors', () => {
  const p = surfacePosition(qaDirection);
  const sides = [-1e-9, 1e-9].map(z => enumeratePyrebearSpawns(surfacePosition(normalize([qaDirection[0], qaDirection[1], z]))));
  assert.deepEqual(sides[0], sides[1]);
  assert.ok(sides[0].some(s => s.id.endsWith(',-1')));
  const negative = enumeratePyrebearSpawns(surfacePosition(pyreLatLon(-70, 90)));
  assert.ok(negative.some(s => s.id.includes(',-9397,')));
  assert.deepEqual(enumeratePyrebearSpawns(p), sides[0]);
});

test('pole, face-boundary and maximum-radius queries have a hard cell/count bound', () => {
  const directions = [[0, 1, 0], [0, -1, 0], qaDirection, pyreLatLon(45, 90), pyreLatLon(-45, -90)];
  for (let i = 0; i < 36; i++) directions.push(pyreLatLon(-89 + i * 5, i % 2 ? -90 : 90));
  let maxCells = 0;
  for (const d of directions) {
    const diagnostics = {}, p = surfacePosition(d), spawns = enumeratePyrebearSpawns(p, { radius: 500, diagnostics });
    assert.ok(diagnostics.visitedCells <= PYREBEAR_HABITAT.maxVisitedCells);
    assert.ok(diagnostics.terrainCandidates <= diagnostics.visitedCells);
    assert.ok(spawns.length <= PYREBEAR_HABITAT.maxSpawns);
    assert.equal(new Set(spawns.map(s => s.id)).size, spawns.length);
    for (const s of spawns) assert.ok(dist(s.position, p) <= 500);
    maxCells = Math.max(maxCells, diagnostics.visitedCells);
  }
  assert.ok(maxCells > 0);
});

test('non-Pyre, deep interior and high-flight positions activate no population', () => {
  for (const p of [[0, 0, 0], [1592750, 0, 0], PYRE_POSITION, surfacePosition(qaDirection, 100_000), surfacePosition(qaDirection, 1000)]) {
    assert.deepEqual(enumeratePyrebearSpawns(p), []);
  }
  for (const radius of [0, -1, 501, Infinity, NaN]) assert.throws(() => enumeratePyrebearSpawns(surfacePosition(qaDirection), { radius }), RangeError);
  assert.throws(() => enumeratePyrebearSpawns([1, 2]), TypeError);
  assert.throws(() => enumeratePyrebearSpawns([0, NaN, 0]), TypeError);
  assert.throws(() => enumeratePyrebearSpawns(surfacePosition(qaDirection), { seed: 1.5 }), TypeError);
});

test('bear locomotion uses canonical body-sized footing without changing spawning or lava exclusions', () => {
  const spawn = samplePyrebearHabitat(qaDirection), footing = samplePyrebearFooting(qaDirection);
  assert.ok(footing);
  assert.deepEqual(footing.position, spawn.position);
  assert.equal(footing.height, spawn.height);
  assert.ok(footing.slope <= PYREBEAR_HABITAT.maxSlope);
  assert.deepEqual(PYREBEAR_HABITAT.footprintRadii, [2, 5]);
  assert.deepEqual(PYREBEAR_HABITAT.footingRadii, [.75, 1.6]);
  for (const landmark of [...VOLCANOES, ...LAVA_FIELDS]) assert.equal(samplePyrebearFooting(landmark.direction), null);
  assert.equal(samplePyrebearFooting([0, 0, 1]), null);
  assert.equal(samplePyrebearFooting([0, 0, -1]), null);
});
