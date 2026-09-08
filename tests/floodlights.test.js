import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {Scene, Vector3, Quaternion} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {FLOODLIGHT} from '../src/build/floodlight-definition.js';
import {createFloodlights, floodlightFixture, floodlightFade} from '../src/build/floodlights.js';
import {setBuildOpacity, setBuildPowered, disposeBuildVisual} from '../src/build/visuals.js';

const bytes = fs.readFileSync(new URL('../public/models/base/floodlight.glb', import.meta.url));
const manifest = JSON.parse(fs.readFileSync(new URL('../assets/build-floodlight/manifest.json', import.meta.url)));
const load = async () => (await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')).scene;
test('native floodlight export retains measured geometry, UVs, materials and functional anchors', async () => {
  assert.equal(manifest.sha256, createHash('sha256').update(bytes).digest('hex'));
  assert.equal(manifest.bytes, bytes.length);
  assert.ok(bytes.length < 1e6);
  assert.ok(fs.statSync(new URL('../assets/build-floodlight/floodlight.blend', import.meta.url)).size > 100000);
  const scene = await load(); scene.updateMatrixWorld(true);
  let triangles = 0, draws = 0;
  scene.traverse(o => {
    if (!o.isMesh) return;
    draws++; triangles += o.geometry.index.count / 3;
    assert.ok(o.geometry.getAttribute('uv'), o.name);
    assert.ok(o.geometry.getAttribute('color'), o.name);
    assert.equal(o.material.map, null);
    const positions = o.geometry.getAttribute('position');
    for (let i = 0; i < positions.count; i++) {
      const p = new Vector3().fromBufferAttribute(positions, i).applyMatrix4(o.matrixWorld).toArray();
      assert.ok(FLOODLIGHT.colliders.some(b => p.every((n, j) => n >= b.min[j] - .001 && n <= b.max[j] + .001)), `${o.name} outside collision: ${p}`);
    }
  });
  assert.equal(draws, 5); assert.equal(draws, manifest.drawPrimitives);
  assert.equal(triangles, manifest.triangles); assert.ok(triangles < 10000);
  for (const [name, expected] of Object.entries(manifest.anchors)) {
    const p = scene.getObjectByName(name)?.getWorldPosition(new Vector3());
    assert.ok(p && p.distanceTo(new Vector3(...expected)) < 1e-5, name);
  }
});
test('off switch extinguishes lenses without changing another copy of the mast', async () => {
  const source = await load(), a = source.clone(true), b = source.clone(true);
  setBuildOpacity(a, 1); setBuildOpacity(b, 1);
  const lenses = root => root.getObjectByName('Floodlight_WarmTaskLight').material;
  const initial = lenses(b).emissiveIntensity;
  assert.ok(initial > 0);
  setBuildPowered(a, false);
  assert.equal(lenses(a).emissiveIntensity, 0); assert.equal(lenses(b).emissiveIntensity, initial);
  setBuildPowered(a, true); assert.equal(lenses(a).emissiveIntensity, initial);
  disposeBuildVisual(a); disposeBuildVisual(b);
});
test('light origins and beam targets retain centimetres at star-system coordinates', () => {
  const scene = new Scene(), rig = createFloodlights(scene);
  const q = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), .81);
  const claim = {id: 'pyre', origin: [22000000000.123, -1234567.89, 791245621.234], quaternion: q.toArray()};
  const piece = {id: 'mast', position: [22.5, 3.623, 54.5], rotation: Math.PI / 2};
  const fixture = floodlightFixture(claim, piece), origin = new Vector3(...claim.origin);
  rig.update([fixture], origin, origin);
  const entry = rig.diagnostics.fixtures[0];
  const expected = new Vector3(...FLOODLIGHT.emitter).applyAxisAngle(new Vector3(0, 1, 0), piece.rotation).add(new Vector3(...piece.position)).applyQuaternion(q);
  assert.ok(new Vector3(...entry.position).distanceTo(expected) < .00001);
  assert.ok(new Vector3(...entry.position).distanceTo(new Vector3(...entry.target)) > 18);
  assert.ok(entry.position.every(n => Math.abs(n) < 100));
  const shifted = origin.clone().add(new Vector3(12.25, -7.5, .125));
  rig.update([fixture], shifted, shifted);
  assert.ok(new Vector3(...rig.diagnostics.fixtures[0].position).distanceTo(expected.sub(new Vector3(12.25, -7.5, .125))) < .00001);
  rig.dispose(); assert.equal(scene.children.length, 0);
});
test('many base owners share six lights and two persistent shadow resources; removal clears stale light', () => {
  const scene = new Scene(), a = createFloodlights(scene), b = createFloodlights(scene), zero = new Vector3();
  const fixtures = Array.from({length: 12}, (_, i) => ({id: `mast-${i}`, position: new Vector3(i * 10, 6, 0), target: new Vector3(i * 10, 0, -18)}));
  a.update(fixtures.slice(0, 4), zero, zero); b.update(fixtures.slice(4), zero, zero);
  assert.equal(scene.children.filter(o => o.isSpotLight).length, 6);
  assert.equal(a.diagnostics.active, 6); assert.equal(b.diagnostics.shadows, 2);
  assert.deepEqual(a.diagnostics.fixtures.map(f => f.id), fixtures.slice(0, 6).map(f => f.id));
  const resources = scene.children.filter(o => o.isSpotLight).map(l => l.shadow);
  a.dispose(); assert.equal(b.diagnostics.active, 6);
  assert.ok(b.diagnostics.fixtures.every(f => !fixtures.slice(0, 4).some(x => x.id === f.id)));
  assert.deepEqual(scene.children.filter(o => o.isSpotLight).map(l => l.shadow), resources);
  b.update([], zero, zero); assert.equal(b.diagnostics.active, 0);
  b.dispose(); b.dispose(); assert.equal(scene.children.length, 0);
});
test('approach illumination fades smoothly and distant planets never consume light slots', () => {
  assert.equal(floodlightFade(180), 1); assert.equal(floodlightFade(220), .5); assert.equal(floodlightFade(260), 0);
  const scene = new Scene(), rig = createFloodlights(scene), zero = new Vector3();
  rig.update([{id: 'distant', position: new Vector3(25000000000, 6, 0), target: zero}], zero, zero);
  assert.equal(rig.diagnostics.active, 0); assert.equal(rig.diagnostics.shadows, 0); rig.dispose();
});
