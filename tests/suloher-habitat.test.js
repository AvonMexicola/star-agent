import test from 'node:test';
import assert from 'node:assert/strict';
import { MIASMA_POSITION, MIASMA_RADIUS, MIASMA_SITES, miasmaSurface } from '../src/miasma-world.js';
import { PYRE_POSITION } from '../src/pyre-world.js';
import { SULOHER_HABITAT, SULOHER_HABITAT_VERSION, sampleSuloherHabitat, sampleSuloherFooting, enumerateSuloherSpawns } from '../src/fauna/suloher-habitat.js';
import { createHostileSimulation } from '../src/fauna/hostile-simulation.js';

const normalize = a => { const length = Math.hypot(...a); return a.map(v => v / length); };
const position = (d, clearance = 0) => d.map((v, i) => MIASMA_POSITION[i] + v * (MIASMA_RADIUS + miasmaSurface(...d).height + clearance));
const distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));

test('real sulphur-upland fixture has deterministic, independently seeded Suloher anchors', () => {
  assert.equal(SULOHER_HABITAT_VERSION, 1);
  const p = position([1, 0, 0]), before = enumerateSuloherSpawns(p);
  assert.equal(before.length, 4);
  assert.equal(before[0].id, 'suloher-v1:7291:2833,-1,-2');
  enumerateSuloherSpawns(position([0, -1, 0]), { seed: 42 });
  assert.deepEqual(enumerateSuloherSpawns(p), before);
  assert.notDeepEqual(enumerateSuloherSpawns(p, { seed: 42 }), before);
  assert.deepEqual(enumerateSuloherSpawns({ x: p[0], y: p[1], z: p[2] }), before);
});

test('world-frame canonical floor, metre footprint and normal match at actual spawns', () => {
  const p = position([1, 0, 0]);
  for (const spawn of enumerateSuloherSpawns(p)) {
    const habitat = sampleSuloherHabitat(spawn.bodyDirection);
    assert.ok(habitat);
    assert.equal(habitat.region, 'SULPHUR UPLANDS');
    assert.ok(habitat.fresh < .08 && habitat.slope <= SULOHER_HABITAT.maxSlope);
    assert.deepEqual(spawn.position, habitat.position);
    assert.deepEqual(spawn.normal, habitat.bodyNormal); // Miasma has no body-frame rotation.
    const local = spawn.position.map((v, i) => v - MIASMA_POSITION[i]);
    assert.ok(distance(normalize(local), spawn.bodyDirection) < 1e-10);
    assert.ok(Math.abs(Math.hypot(...local) - MIASMA_RADIUS - miasmaSurface(...spawn.bodyDirection).height) < 1e-5);
    assert.ok(Math.abs(Math.hypot(...spawn.normal) - 1) < 1e-12);
    assert.ok(distance(spawn.position, p) <= 420);
    assert.ok(spawn.heading >= 0 && spawn.heading < 2*Math.PI && spawn.phase >= 0 && spawn.phase < 1);
  }
});

test('named mineral seas and crater basins do not seed upland dogs', () => {
  for (const site of MIASMA_SITES) {
    assert.equal(sampleSuloherHabitat(site.direction), null);
    assert.deepEqual(enumerateSuloherSpawns(position(site.direction)), []);
  }
  const habitat = sampleSuloherHabitat([1, 0, 0]);
  assert.ok(habitat && habitat.fresh === 0);
});

test('a real dry upland slope above the footprint threshold rejects a dog anchor', () => {
  const d = [.9999996539794183, -.0005882350905761284, -.0005882350905761284];
  const center = miasmaSurface(...d);
  assert.equal(center.region, 'SULPHUR UPLANDS');
  assert.equal(center.fresh, 0);
  const q = normalize(d.map((v, i) => v + (i === 2 ? 5/(MIASMA_RADIUS+center.height) : 0)));
  assert.ok(Math.abs(miasmaSurface(...q).height-center.height)/5 > SULOHER_HABITAT.maxSlope);
  assert.equal(sampleSuloherHabitat(d), null);
});

test('crossing sign seams, revisiting and reversing traversal preserves anchors', () => {
  const tinyOffsets = [-1e-9, 1e-9].map(z => enumerateSuloherSpawns(position(normalize([1, 0, z]))));
  assert.deepEqual(tinyOffsets[0], tinyOffsets[1]);
  const p = position([1, 0, 0]), original = enumerateSuloherSpawns(p);
  const away = enumerateSuloherSpawns(p.map((v, i) => v + (i === 1 ? 60 : 0)));
  const common = original.filter(a => away.some(b => b.id === a.id));
  assert.ok(common.length >= 2);
  for (const a of common) assert.deepEqual(away.find(b => b.id === a.id), a);
  assert.deepEqual(enumerateSuloherSpawns(p), original);
});

test('poles, negative coordinates and spherical face boundaries have bounded work', () => {
  const directions = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1], normalize([1, 1, 1]), normalize([-1, -1, -1])];
  for (let i = 0; i < 40; i++) {
    const y = 1 - 2*(i+.5)/40, a = i*2.39996, r = Math.sqrt(1-y*y);
    directions.push([r*Math.sin(a), y, r*Math.cos(a)]);
  }
  for (const d of directions) {
    const diagnostics = {}, p = position(d), results = enumerateSuloherSpawns(p, { radius: 500, diagnostics });
    assert.ok(diagnostics.visitedCells <= SULOHER_HABITAT.maxVisitedCells);
    assert.ok(results.length <= 6);
    assert.equal(new Set(results.map(s => s.id)).size, results.length);
    for (const spawn of results) assert.ok(distance(spawn.position, p) <= 500);
  }
});

test('other planets, high flight and malformed queries cannot activate dogs', () => {
  for (const p of [[0, 0, 0], PYRE_POSITION, MIASMA_POSITION, position([1, 0, 0], 50_000), position([1, 0, 0], 1000)]) assert.deepEqual(enumerateSuloherSpawns(p), []);
  for (const radius of [0, -1, 501, Infinity, NaN]) assert.throws(() => enumerateSuloherSpawns(position([1, 0, 0]), { radius }), RangeError);
  assert.equal(sampleSuloherHabitat([0, 0, 0]), null);
  assert.throws(() => enumerateSuloherSpawns([Infinity, 0, 0]), TypeError);
});

test('saved controller failure: body-sized footing crosses safe ground rejected by broad spawn clearance', () => {
  // Actual failure.json from the injected-controller Miasma route,2026-09-07.
  // The dog stopped5.69817m away at60Hz before canMove was ever evaluated.
  const saved = {
    id: 'suloher-v1:7291:2833,-2,-1',
    position: [18213298202.002514, 7555869155.985128, 11680089167.175568],
    normal: [.9982160255210091, .02048686299224457, .05608078849104309],
    home: [18213298203.030884, 7555869142.172175, 11680089154.546507],
    phase: .4102632491849363, heading: .44704461776543925,
  };
  const player = { position: [18213298203.520435, 7555869160.909151, 11680089169.608473], active: true, health: 100 };
  const replay = sample => {
    let rejectedGround = 0, obstacleCalls = 0, bites = 0;
    const sim = createHostileSimulation({
      sampleGround: (_species, p) => {
        const h = sample(normalize(p.map((v, i) => v-MIASMA_POSITION[i])));
        if (!h) rejectedGround++;
        return h;
      },
      canMove: () => { obstacleCalls++; return true; }, lineOfSight: () => true, onBite: () => bites++,
    });
    // First register beyond no-pop radius, then restore the recorded chase pose.
    sim.reconcile([saved], 'suloher', saved.position.map((v, i) => v+(i===1?100:0)));
    Object.assign(sim.entities[0], structuredClone(saved), { state: 'chase' });
    for (let frame = 0; frame < 180; frame++) sim.update(1/60, player);
    return { rejectedGround, obstacleCalls, bites, entity: sim.entities[0] };
  };
  const old = replay(sampleSuloherHabitat);
  assert.equal(old.rejectedGround, 180);
  assert.equal(old.obstacleCalls, 0); // Neither discontinuity nor world blockers caused the stop.
  assert.equal(old.bites, 0);
  assert.deepEqual(old.entity.position, saved.position);
  const corrected = replay(sampleSuloherFooting);
  assert.equal(corrected.rejectedGround, 0);
  assert.ok(corrected.obstacleCalls > 0);
  assert.equal(corrected.bites, 1);
  assert.ok(distance(corrected.entity.position, saved.position) > 3);
  const d = normalize(corrected.entity.position.map((v, i) => v-MIASMA_POSITION[i]));
  assert.ok(Math.abs(distance(corrected.entity.position, MIASMA_POSITION)-MIASMA_RADIUS-miasmaSurface(...d).height) < 1e-5);
  for (const site of MIASMA_SITES) assert.equal(sampleSuloherFooting(site.direction), null);
});
