import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { fleetHangarAsset, FLEET_HANGAR } from '../src/station-fleet-hangar.js';
import { Station } from '../src/station.js';
import { constrainStationSweep } from '../src/station-collision.js';

globalThis.ProgressEvent ??= class { constructor(type, init) { Object.assign(this, init); } };
const source = await readFile(new URL('../public/models/station.glb', import.meta.url));
const load = () => new GLTFLoader().parseAsync(source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength), '');
const near = (a, b) => a.forEach((v, i) => assert.ok(Math.abs(v - b[i]) < 1e-5, `${a} != ${b}`));
const layout = JSON.parse(await readFile(new URL('../assets/atlas-mark-ii/layout.json', import.meta.url)));

test('fleet refit preserves source geometry, service floor and back wall while enlarging both asset levels', async () => {
  for (const name of ['station', 'station_lod1']) {
    const bytes = await readFile(new URL(`../public/models/${name}.glb`, import.meta.url));
    const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
    gltf.scene.updateMatrixWorld(true);
    const before = new THREE.Box3().setFromObject(gltf.scene);
    const next = fleetHangarAsset(gltf);
    assert.notEqual(next.scene, gltf.scene);
    assert.ok(new THREE.Box3().setFromObject(gltf.scene).equals(before));
    const frame = next.scene.getObjectByName('Fleet hangar shell frame');
    near(frame.localToWorld(new THREE.Vector3(...FLEET_HANGAR.anchor)).toArray(), FLEET_HANGAR.anchor);
    const sourceMeshes = [], nextMeshes = [];
    gltf.scene.traverse(m => { if (m.isMesh) sourceMeshes.push(m); });
    next.scene.traverse(m => { if (m.isMesh) nextMeshes.push(m); });
    sourceMeshes.forEach((m, i) => assert.equal(m.geometry, nextMeshes[i].geometry, 'immutable geometry is shared'));
  }
});

test('full authored Atlas clears deck, maintenance equipment and open doors at launch height', async t => {
  const station = new Station(new THREE.Scene(), { gltf: fleetHangarAsset(await load()), lodUrl: null });
  await station.readyPromise; t.after(() => station.dispose());
  near(station.padLocal.toArray(), FLEET_HANGAR.pad);
  near(station.interiorBox.min.toArray(), FLEET_HANGAR.deckMin);
  assert.ok(station.interiorBox.max.y - station.interiorBox.min.y > 25);
  const start = station.padLocal.clone().add(new THREE.Vector3(0, 3.2, 0));
  const end = start.clone().add(new THREE.Vector3(0, 0, -400));
  const min = new THREE.Vector3(...layout.hull.min), max = new THREE.Vector3(...layout.hull.max);
  station.beginOpening(); station.setOpeningProgress(0);
  const closed = constrainStationSweep(station.colliders, station.doorBoxes, start, end, min, max);
  assert.equal(closed.hit, true);
  assert.ok(closed.point.distanceTo(start) > 5, 'parked ship starts clear of all static structures');
  station.setOpeningProgress(1);
  assert.equal(constrainStationSweep(station.colliders, station.doorBoxes, start, end, min, max).hit, false);
  assert.equal(constrainStationSweep(station.colliders, station.doorBoxes, end, start, min, max).hit, false);
  for (const ramp of layout.ramps) {
    // Complete ramp/ground caller region remains over the bay's real deck.
    const p = station.padLocal.clone().add(new THREE.Vector3(ramp.control[0], 1.75, ramp.pivot[2] + Math.sign(ramp.pivot[2]) * 9));
    assert.ok(station.deckPoint(station.toWorld(p, new THREE.Vector3()), 1.75));
  }
});

test('animated door collision includes the refit frame and is invariant under world rebasing', async t => {
  const station = new Station(new THREE.Scene(), { gltf: fleetHangarAsset(await load()), lodUrl: null });
  await station.readyPromise; t.after(() => station.dispose()); station.beginOpening();
  for (const openness of [0, .25, .6, 1]) {
    station.setOpeningProgress(openness); station.group.updateMatrixWorld(true);
    const inverse = station.group.matrixWorld.clone().invert();
    station.doors.forEach((door, i) => {
      const box = new THREE.Box3(); door.traverse(mesh => {
        if (!mesh.isMesh) return;
        mesh.geometry.computeBoundingBox();
        box.union(mesh.geometry.boundingBox.clone().applyMatrix4(inverse.clone().multiply(mesh.matrixWorld)));
      });
      near(station.doorBoxes[i].min.toArray(), box.min.toArray()); near(station.doorBoxes[i].max.toArray(), box.max.toArray());
    });
    const boxes = station.doorBoxes.map(b => b.clone());
    station.group.position.set(25e9, -4e9, 9e9); station.group.rotation.set(.3, .5, .1); station.updateDoorColliders();
    station.doorBoxes.forEach((b, i) => assert.ok(b.equals(boxes[i])));
    station.group.position.set(0, 0, 0); station.group.rotation.set(0, 0, 0);
  }
});
