import test from 'node:test';
import assert from 'node:assert/strict';
import { Scene, Vector3 } from 'three';
import { MOON_POSITION } from '../src/moon-world.js';
import { RING_RADIUS, RING_WIDTH, RING_THICKNESS, RING_ROTATION, RING_NORMAL } from '../src/ring-world.js';
import { RingIce, ringIcePresence, iceCellAt, iceParticlesForCell, sampleRingIce, ICE_MAX_PARTICLES, ICE_RADIUS, ICE_INNER_RADIUS } from '../src/ring-ice.js';
const ringPoint = (radius = RING_RADIUS, height = 0) => new Vector3(radius, 0, height).applyQuaternion(RING_ROTATION).add(new Vector3(...MOON_POSITION));

test('ice occupies the canonical belt and softly disappears at radial and vertical edges', () => {
  assert.equal(ringIcePresence(ringPoint()), 1);
  for (const offset of [-RING_WIDTH / 2 - 1, RING_WIDTH / 2 + 1, 20000]) assert.equal(ringIcePresence(ringPoint(RING_RADIUS + offset)), 0);
  assert.equal(ringIcePresence(ringPoint(RING_RADIUS, RING_THICKNESS / 2 + 1)), 0);
  const edge = ringIcePresence(ringPoint(RING_RADIUS + RING_WIDTH / 2 - 40)); assert.ok(edge > 0 && edge < 1);
  assert.equal(sampleRingIce(new Vector3(), 10).length, 0);
});
test('hashed cells and nearby ice samples are deterministic, bounded and sparse', () => {
  assert.deepEqual(iceParticlesForCell([20, -7, 4]), iceParticlesForCell([20, -7, 4]));
  assert.notDeepEqual(iceParticlesForCell([20, -7, 4]), iceParticlesForCell([21, -7, 4]));
  const origin = ringPoint(), a = sampleRingIce(origin, 12), b = sampleRingIce(origin, 12);
  assert.deepEqual(a, b); assert.ok(a.length > 300 && a.length <= ICE_MAX_PARTICLES);
  assert.equal(new Set(a.map(p => p.id)).size, a.length);
  for (const p of a) { assert.ok(p.distance < ICE_RADIUS && p.distance >= ICE_INNER_RADIUS); assert.ok(p.fade > 0 && p.fade <= 1); }
});
test('camera translation and hash-cell crossing preserve world anchors and gentle motion', () => {
  const origin = ringPoint(), next = origin.clone().add(new Vector3(33, 0, 0));
  assert.notDeepEqual(iceCellAt(origin), iceCellAt(next));
  const a = sampleRingIce(origin, 25), b = new Map(sampleRingIce(next, 25).map(p => [p.id, p]));
  const shared = a.filter(p => b.has(p.id)); assert.ok(shared.length > 100);
  for (const p of shared) assert.deepEqual(p.position, b.get(p.id).position);
  const later = new Map(sampleRingIce(origin, 26).map(p => [p.id, p]));
  for (const p of a.filter(p => later.has(p.id))) {
    const distance = new Vector3(...p.position).distanceTo(new Vector3(...later.get(p.id).position));
    assert.ok(distance > 0 && distance < .06, 'motion is a slow world-space drift, not frame-dependent respawning');
  }
});
test('one noncolliding Points object uploads only local coordinates and vanishes outside the ring', () => {
  const scene = new Scene(), ice = new RingIce(scene), origin = ringPoint(); ice.update(origin, 25);
  assert.equal(scene.children.length, 1); assert.equal(ice.points.isPoints, true); assert.ok(ice.count > 0 && ice.count <= ICE_MAX_PARTICLES);
  for (const n of ice.geometry.attributes.position.array.subarray(0, ice.count * 3)) assert.ok(Number.isFinite(n) && Math.abs(n) < ICE_RADIUS);
  assert.equal(ice.material.depthWrite, false); assert.equal(ice.material.depthTest, true);
  assert.ok(ice.material.vertexShader.includes('#include <logdepthbuf_vertex>'));
  assert.ok(ice.material.fragmentShader.includes('#include <logdepthbuf_fragment>'));
  ice.update(origin.clone().addScaledVector(new Vector3(...RING_NORMAL), 20000), 25);
  assert.equal(ice.points.visible, false); assert.equal(ice.geometry.drawRange.count, 0);
  ice.dispose(); assert.equal(scene.children.length, 0);
});
