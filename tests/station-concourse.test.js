import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createConcourse, attachConcourse } from '../src/station-concourse.js';
import { createPressureElevator, attachPressureElevator } from '../src/station-elevator.js';
import { updateElevator, elevatorBoxes } from '../src/station-architecture.js';
import { constrainStationSweep } from '../src/station-collision.js';
import { SHIP_LAYOUT } from '../src/boarding.js';

const vector = point => new THREE.Vector3(...point);
const extentMin = new THREE.Vector3(-.25, -SHIP_LAYOUT.eyeHeight, -.25);
const extentMax = new THREE.Vector3(.25, .15, .25);
const sign = () => null; // Canvas typography is exercised by the browser suite.
const loaded = new Map();
function load(name) {
  if (!loaded.has(name)) loaded.set(name, (async () => {
    const bytes = await readFile(new URL(`../public/models/${name}.glb`, import.meta.url));
    const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
    return { ...gltf, bytes: bytes.length };
  })());
  return loaded.get(name);
}
function sweep(boxes, a, b, blocked = false) {
  const end = vector(b);
  const result = constrainStationSweep(null, boxes, vector(a), end, extentMin, extentMax);
  assert.equal(result.hit, blocked, `${a} -> ${b} should be ${blocked ? 'blocked' : 'clear'}`);
  if (blocked) assert.ok(result.point.distanceTo(end) > .01, 'physical obstruction stops movement before the endpoint');
  else assert.ok(result.point.distanceTo(end) < 1e-7, 'clear path reaches its endpoint');
  return result;
}
function close(actual, expected, message) {
  assert.ok(Math.abs(actual - expected) < 1e-5, `${message}: ${actual} versus ${expected}`);
}

test('actual concourse and elevator exports fit their assembly budgets and measured bounds', async () => {
  let totalDraws = 0;
  for (const name of ['station-concourse', 'station-elevator']) {
    const asset = await load(name), scene = asset.scene;
    scene.updateMatrixWorld(true);
    const manifest = JSON.parse(scene.userData.assetManifest);
    assert.ok(manifest.length >= 4, 'scene carries the measured independent assembly manifest');
    const allowed = manifest.map(({ bounds }) => new THREE.Box3(vector(bounds.min), vector(bounds.max)).expandByScalar(.002));
    let triangles = 0, meshes = 0;
    const point = new THREE.Vector3();
    scene.traverse(mesh => {
      if (!mesh.isMesh) return;
      meshes++;
      const geometry = mesh.geometry, positions = geometry.attributes.position;
      triangles += (geometry.index?.count ?? positions.count) / 3;
      for (let i = 0; i < positions.count; i++) {
        point.fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld);
        assert.ok(allowed.some(box => box.containsPoint(point)), `${name} vertex ${point.toArray()} lies outside its manifest`);
      }
    });
    assert.equal(triangles, manifest.reduce((sum, assembly) => sum + assembly.triangles, 0), 'manifest total matches actual index data');
    for (const assembly of manifest) {
      assert.ok(assembly.triangles > 0 && assembly.triangles <= 10_000, `${assembly.name} triangle budget`);
      // Builder measures actual standalone GLBs, including their own metadata;
      // a shared aggregate buffer is never counted again for every assembly.
      assert.ok(assembly.standaloneBytes > 0 && assembly.standaloneBytes <= 1_000_000, `${assembly.name} byte budget`);
    }
    assert.ok(asset.bytes <= manifest.reduce((sum, assembly) => sum + assembly.standaloneBytes, 0), 'batching is smaller than the complete individual exports');
    assert.equal(meshes, name === 'station-concourse' ? 6 : 18, 'static materials batch independently from moving leaves');
    totalDraws += meshes;
    const bounds = new THREE.Box3().setFromObject(scene);
    if (name === 'station-concourse') {
      assert.ok(bounds.min.x > -20 && bounds.max.x < 20);
      assert.ok(bounds.min.y >= -8.001 && bounds.max.y < -4);
      assert.ok(bounds.min.z >= -12.23 && bounds.max.z < 11, 'directory feet fit the far-end furniture zone');
      for (const [id, x] of [['DirectoryNorth', -5.5], ['DirectorySouth', 5.5]]) {
        const pylon = manifest.find(assembly => assembly.name === id + 'Pylon');
        assert.ok(pylon, `${id} has its own measured prop budget`);
        assert.ok(pylon.bounds.max[0] - pylon.bounds.min[0] <= .901);
        assert.ok(pylon.bounds.max[2] - pylon.bounds.min[2] <= .451);
        close(pylon.bounds.max[1], -5.55, 'directory top is 2.45 m above the floor');
        const anchor = scene.getObjectByName(id);
        assert.ok(anchor, `${id} retains its runtime display anchor`);
        const position = anchor.getWorldPosition(new THREE.Vector3());
        close(position.x, x, 'directory anchor X');
        close(position.y, -6.59, 'directory anchor Y');
        close(position.z, -11.792, 'directory anchor Z');
        const ray = new THREE.Raycaster(position.clone().add(new THREE.Vector3(0, 0, .1)), new THREE.Vector3(0, 0, -1), 0, .5);
        const face = ray.intersectObject(scene, true)[0];
        assert.ok(face, 'directory print has a visible physical backing');
        assert.ok(position.z > face.point.z && position.z - face.point.z < .012, 'directory anchor faces +Z just ahead of its display inset');
      }
    } else {
      assert.ok(bounds.min.y >= -.025 && bounds.max.y < 3.6);
      close(bounds.max.z, 3.4, 'elevator fits its cabin depth');
    }
  }
  assert.ok(totalDraws <= 60, 'combined concourse and elevator kit retains its draw budget');
});

test('attached shop collision preserves central circulation and access but stops at real counters and seating', async () => {
  const hub = createConcourse({ sign });
  attachConcourse(hub, await load('station-concourse'), { sign });
  assert.ok(hub.staticBoxes.length > 10, 'actual authored collision pieces were attached');
  const eye = -8 + SHIP_LAYOUT.eyeHeight;
  for (const x of [-3.4, 0, 3.4]) sweep(hub.staticBoxes, [x, eye, -17], [x, eye, 13.5]);
  hub.group.updateMatrixWorld(true);
  for (const side of [-1, 1]) {
    sweep(hub.staticBoxes, [0, eye, 0], [side * 10.7, eye, 0]);
    sweep(hub.staticBoxes, [side * 10.7, eye, 0], [side * 13, eye, 0], true);
    sweep(hub.staticBoxes, [side * 10.7, eye, 0], [side * 10.7, eye, 4]);
    sweep(hub.staticBoxes, [side * 10.7, eye, 4], [side * 17, eye, 4]);
    sweep(hub.staticBoxes, [side * 6, eye, 8], [side * 6, eye, 12], true);
    const ray = new THREE.Raycaster(new THREE.Vector3(side * 10.7, -7.4, 0), new THREE.Vector3(side, 0, 0), 0, 3);
    assert.ok(ray.intersectObject(hub.props, true).length > 0, 'counter collision corresponds to visible GLB geometry');
    const seatRay = new THREE.Raycaster(new THREE.Vector3(side * 6, -6.5, 10.46), new THREE.Vector3(0, -1, 0), 0, 2);
    const seat = seatRay.intersectObject(hub.props, true)[0];
    assert.ok(seat, 'waiting seat has a physical cushion surface');
    close(seat.point.y, -7.54, 'seat surface is 0.46 m above the concourse floor');
  }
});

test('elevator cabins preserve entry and block their actual rear and side walls at both station placements', async () => {
  const asset = await load('station-elevator');
  // Both game placements and a translated floor catch hard-coded Y assumptions.
  for (const [floor, z] of [[-8, 14.3], [-8, 22.3], [-11.25, 22.3]]) {
    const parent = new THREE.Group(), lift = createPressureElevator(parent, z, floor);
    attachPressureElevator(lift, asset, { sign });
    const eye = floor + SHIP_LAYOUT.eyeHeight;
    assert.ok(lift.staticBoxes.length > 10);
    // The 0.5 m body must stop before the handrail at local Z=2.88.
    sweep(lift.staticBoxes, [0, eye, z - .8], [0, eye, z + 2.5]);
    sweep(lift.staticBoxes, [0, eye, z + 1.8], [0, eye, z + 4], true);
    for (const side of [-1, 1]) sweep(lift.staticBoxes, [0, eye, z + 1.8], [side * 3, eye, z + 1.8], true);
    parent.updateMatrixWorld(true);
    const ray = new THREE.Raycaster(new THREE.Vector3(0, eye, z + 1.8), new THREE.Vector3(0, 0, 1), 0, 3);
    const wall = ray.intersectObject(lift.group, true)[0];
    assert.ok(wall, 'rear collision is a visible cabin wall');
    assert.ok(wall.point.z > z + 2.98 && wall.point.z < z + 3.07, 'usable rear surface stays ahead of the inherited vestibule wall');
  }
});

test('authored rear cabin lining and handrail remain visible in front of the original station vestibule', async () => {
  const original = (await load('station')).scene.clone(true);
  const parent = new THREE.Group();
  parent.add(original);
  const lift = createPressureElevator(parent, 22.3, -8);
  attachPressureElevator(lift, await load('station-elevator'), { sign });
  lift.open = true;
  updateElevator(lift, 1);
  parent.updateMatrixWorld(true);
  for (const [x, y, surface] of [[-.49, -6.25, 'lining'], [.49, -6.25, 'lining'], [0, -6.98, 'handrail']]) {
    const ray = new THREE.Raycaster(new THREE.Vector3(x, y, 23.95), new THREE.Vector3(0, 0, 1), 0, 3);
    const inherited = ray.intersectObject(original, true)[0];
    const first = ray.intersectObject(parent, true)[0];
    assert.ok(inherited && first, `both original vestibule and ${surface} exist`);
    const ancestry = [];
    for (let object = first.object; object; object = object.parent) ancestry.push(object);
    assert.ok(ancestry.includes(lift.group), `${surface} is the first visible surface in the combined real assets`);
    assert.ok(first.distance + .07 < inherited.distance, `${surface} clears the old wall instead of being hidden by it`);
    assert.ok(first.point.z < 25.33);
  }
});

test('independent elevator leaves match collision through closed, partial, open and closed-again poses', async () => {
  const asset = await load('station-elevator');
  const lifts = [14.3, 22.3].map(z => {
    const lift = createPressureElevator(new THREE.Group(), z, -8);
    attachPressureElevator(lift, asset, { sign });
    return lift;
  });
  assert.notEqual(lifts[0].leaves[0], lifts[1].leaves[0], 'each placement owns independent animation transforms');
  function checkPose(lift, blocked) {
    lift.group.updateMatrixWorld(true);
    const analytic = elevatorBoxes(lift);
    for (const [i, leaf] of lift.leaves.entries()) {
      const actual = new THREE.Box3().setFromObject(leaf);
      for (const key of ['min', 'max']) for (const axis of ['x', 'y', 'z']) close(actual[key][axis], analytic[i][key][axis], `${leaf.name} ${key}.${axis}`);
      close(leaf.position.y, 1.55, 'leaf origin remains at mid-height');
      close(leaf.position.z, 0, 'leaf origin stays on the door plane');
    }
    const eye = lift.floor + SHIP_LAYOUT.eyeHeight;
    sweep([...lift.staticBoxes, ...analytic], [0, eye, lift.z - .8], [0, eye, lift.z + 2.5], blocked);
  }
  for (const lift of lifts) {
    checkPose(lift, true);
    lift.open = true;
    updateElevator(lift, .1);
    checkPose(lift, true); // Partial opening is still narrower than the 0.5 m body.
    updateElevator(lift, 1);
    assert.equal(lift.progress, 1);
    checkPose(lift, false);
    for (const [i, leaf] of lift.leaves.entries()) close(leaf.position.x, (i ? 1 : -1) * 3.09, 'full door travel');
    if (lift === lifts[0]) assert.equal(lifts[1].progress, 0, 'opening one cabin leaves the other closed');
    lift.open = false;
    updateElevator(lift, 1);
    assert.equal(lift.progress, 0);
    checkPose(lift, true);
  }
});
