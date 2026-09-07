import test from 'node:test';
import assert from 'node:assert/strict';
import { Scene, Vector3 } from 'three';
import { createDensity, carve, meshVolume, mineral, rockColor, normalizeResourceWeights, MINERAL_GLSL } from '../src/mining/volume.js';
import { MineableRock } from '../src/mining/rock.js';
import { MOON_POSITION, MOON_RADIUS, RESOURCE_PROVINCES, moonResources } from '../src/moon-world.js';

const field = createDensity();
const disk = () => { const data = new Map(); return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) }; };
const worker = () => ({ postMessage(job) { this.job = job; }, terminate() {} });

test('resource profiles normalize safely and pure provinces classify actual discrete minerals', () => {
  assert.deepEqual(normalizeResourceWeights([0, 7, 0]), [0, 1, 0]);
  assert.equal(normalizeResourceWeights(null), null);
  for (const bad of [[0, 0, 0], [1, NaN, 0], [-1, 1, 1], [1, 2]]) assert.throws(() => normalizeResourceWeights(bad), RangeError);
  for (let type = 0; type < 3; type++) {
    const weights = [0, 0, 0]; weights[type] = 1;
    for (let x = -1.8; x < 1.8; x += .31) for (let y = -1.4; y < 1.4; y += .39) assert.equal(mineral(x, y, -.27, weights), type);
  }
  // A mixed rock contains spatially distinct, repeatable seams, not a fractional reward at every point.
  const profile = [.3, .4, .3], kinds = new Set();
  for (let x = -1.7; x < 1.7; x += .04) kinds.add(mineral(x, .17, -.31, profile));
  assert.equal(kinds.size, 3);
  assert.equal(mineral(.77, -.91, .43, profile), mineral(.77, -.91, .43, profile));
});

test('near-pure regional rocks yield over eighty percent of their advertised mineral across face cuts', () => {
  const profiles = [[.965, .015, .02], [.045, .935, .02], [.025, .015, .96]];
  const points = [[0, 0, 1.35], [1.5, 0, 0], [-1.5, 0, 0], [0, 1.3, 0], [0, -1.4, 0], [0, 0, -1.35]];
  for (let type = 0; type < 3; type++) {
    const totals = [0, 0, 0];
    for (const point of points) {
      const result = carve(field, point, .035, .48, profiles[type]);
      assert.ok(result.removed > 0 && result.removed <= .0350001);
      result.yieldVolume.forEach((n, index) => { totals[index] += n; });
      // Changing resource classification does not alter saved density geometry.
      assert.deepEqual(result.field, carve(field, point, .035).field);
    }
    assert.ok(totals[type] / totals.reduce((a, b) => a + b, 0) > .8, `${type}: ${totals}`);
  }
});

test('weighted mesher colors identify the same mineral that a pure-profile cut collects', () => {
  for (const weights of [[0, 1, 0], [0, 0, 1]]) {
    const result = carve(field, [0, 0, 1.35], .035, .48, weights), type = weights.indexOf(1);
    assert.ok(result.yieldVolume[type] > .03);
    assert.equal(result.yieldVolume.filter((_, index) => index !== type).reduce((a, b) => a + b, 0), 0);
    const mesh = meshVolume(result.field, weights);
    for (let i = 0; i < mesh.positions.length; i += 333) {
      const expected = rockColor(...mesh.positions.slice(i, i + 3), weights);
      for (let channel = 0; channel < 3; channel++) assert.ok(Math.abs(mesh.colors[i + channel] - expected[channel]) < 2e-6);
    }
  }
});

test('surface rocks sample authoritative moon-centered resources while space retains legacy bands', () => {
  const scene = new Scene(), province = RESOURCE_PROVINCES.find(p => p.resource === 'ice');
  const position = new Vector3(...MOON_POSITION).addScaledVector(new Vector3(...province.direction), MOON_RADIUS + 50);
  const surfaceWorker = worker(), surface = new MineableRock(scene, disk(), { worker: surfaceWorker, position });
  assert.deepEqual(surface.resourceWeights, normalizeResourceWeights(moonResources(...province.direction).weights));
  assert.ok(surface.resourceWeights[2] > .8);
  assert.deepEqual(surfaceWorker.job.resourceWeights, surface.resourceWeights);
  const shader = { uniforms: {}, vertexShader: '#include <common>\n#include <begin_vertex>', fragmentShader: '#include <common>\n#include <color_fragment>' };
  surface.material.onBeforeCompile(shader);
  assert.equal(shader.uniforms.uRockResourceProfile.value, true);
  assert.deepEqual(shader.uniforms.uRockResourceWeights.value.toArray(), surface.resourceWeights);
  assert.ok(shader.fragmentShader.includes(MINERAL_GLSL), 'material embeds the shared CPU-profile GLSL rather than fixed copper/ice bands');
  const spaceWorker = worker(), space = new MineableRock(scene, disk(), { worker: spaceWorker, space: true });
  assert.equal(space.resourceWeights, null); assert.equal(spaceWorker.job.resourceWeights, null);
  const explicit = new MineableRock(scene, disk(), { worker: worker(), space: true, resourceWeights: [0, 2, 0] });
  assert.deepEqual(explicit.resourceWeights, [0, 1, 0]);
  for (const rock of [surface, space, explicit]) rock.dispose();
});

test('worker carries resource weights through both rewards and returned vertex colors', async () => {
  const previous = globalThis.self, replies = [];
  globalThis.self = { postMessage: reply => replies.push(reply) };
  try {
    await import('../src/mining/worker.js?resource-profile-test');
    const resourceWeights = [0, 0, 1];
    self.onmessage({ data: { id: 12, field, point: [0, 0, 1.35], budget: .03, resourceWeights } });
    const result = replies[0];
    assert.equal(result.id, 12); assert.equal(result.error, undefined);
    assert.equal(result.yieldVolume[0], 0); assert.equal(result.yieldVolume[1], 0); assert.ok(result.yieldVolume[2] > .029);
    assert.ok(result.colors[2] > result.colors[0]);
    assert.deepEqual(result.yieldVolume, carve(field, [0, 0, 1.35], .03, .48, resourceWeights).yieldVolume);
  } finally { if (previous === undefined) delete globalThis.self; else globalThis.self = previous; }
});

test('nonprimary surface deposits respect the shared save cap before submitting a cut job', () => {
  const scene = new Scene(), fakeWorker = worker(), rock = new MineableRock(scene, disk(), { worker: fakeWorker, rockId: 'selene-surface-profile-test', initialField: field });
  rock.ready = true; rock.pending = false; rock.store.canEditRock = () => false;
  const job = fakeWorker.job;
  rock.onMine({ point: rock.position, dt: .1 }, new Vector3(0, 0, -1));
  assert.equal(fakeWorker.job, job); assert.match(rock.store.warning, /^Survey save full/);
  rock.dispose();
});
