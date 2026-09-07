import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Station } from '../src/station.js';
import { SHIP_LAYOUT } from '../src/boarding.js';
import { FREIGHTER_LAYOUT } from '../src/freighter-layout.js';
import { fleetHangarAsset, FLEET_HANGAR } from '../src/station-fleet-hangar.js';

const assetURL = name => new URL(`../public/models/${name}.glb`, import.meta.url);
async function load(name) {
  const bytes = await readFile(assetURL(name));
  return new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
}
async function fixture(t, { fleet = false } = {}) {
  const [source, props] = await Promise.all([load('station'), load('station-props')]);
  const gltf = fleet ? fleetHangarAsset(source) : source;
  gltf.scene.add(props.scene);
  const station = new Station(new THREE.Scene(), { gltf, lodUrl: null, direction: new THREE.Vector3(.23, .91, .34).normalize() });
  await station.readyPromise;
  t.after(() => station.dispose());
  return { station, props: props.scene, model: gltf.scene };
}
const toWorld = (station, point) => station.toWorld(new THREE.Vector3(...point), new THREE.Vector3());
function clearSweep(station, a, b, walking = true, layout = SHIP_LAYOUT) {
  const end = toWorld(station, b);
  const result = station.constrainStep(toWorld(station, a), end, station.quaternion, walking, layout);
  assert.equal(result.hit, false, `clear ${walking ? 'walking' : 'ship'} path ${a} -> ${b}; stopped at ${station.toLocal(result.point, new THREE.Vector3()).toArray()}`);
  assert.ok(result.point.distanceTo(end) < 1e-7, 'sweep actually reaches its destination');
}

test('finished prop asset remains correctly scaled within its measured service zones', async () => {
  const props = (await load('station-props')).scene;
  props.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(props);
  assert.ok(bounds.min.y >= -8.011, 'no prop penetrates more than the fitted 1 cm jamb seal below the deck');
  assert.ok(bounds.max.y <= 3.81, 'the elevated gallery stays below the original upper wall panels');
  assert.ok(bounds.min.x >= -20.3 && bounds.max.x <= 20.3, 'storage skins retain at least 70 cm clearance from structural side walls');
  assert.ok(bounds.min.z >= 12 && bounds.max.z <= 25.4, 'no prop enters the forward docking area or back wall');
  const manifest = JSON.parse(await readFile(new URL('../assets/station/props-manifest.json', import.meta.url), 'utf8'));
  const assemblies = new Map(manifest.assemblies.map(assembly => [assembly.name, assembly]));
  const gallery = assemblies.get('OperationsGallery');
  assert.ok(gallery, 'the elevated operations gallery is tracked separately from floor props');
  assert.ok(gallery.bounds.min[1] >= .29 && gallery.bounds.max[1] <= 3.81, 'gallery fittings remain 8.29 m above the walking deck');
  assert.ok(gallery.bounds.min[0] >= -12.2 && gallery.bounds.max[0] <= 12.2);
  assert.ok(gallery.bounds.min[2] >= 23.7 && gallery.bounds.max[2] <= 24.4, 'gallery occupies only the shallow window recess');
  for (const assembly of manifest.assemblies) if (assembly.name !== 'OperationsGallery') {
    assert.ok(assembly.bounds.max[1] <= -4.59, `${assembly.name} retains the original 3.41 m service height limit`);
  }
  // Both vehicles must stand in front of the old crate stacks, not intersect them.
  // Original stacks begin at Z=18.9; fitted skins begin slightly forward at 18.84.
  for (const name of ['CargoDolly', 'StrappedPallet']) {
    assert.ok(assemblies.get(name).bounds.max[2] < 18.8, `${name} clears the original stack and new storage skin`);
  }
  for (const [name, side] of [['LeftStorage', -1], ['RightStorage', 1]]) {
    const box = assemblies.get(name)?.bounds;
    assert.ok(box, `${name} is measured in the manifest`);
    assert.ok(box.min[2] >= 18.8 && box.max[2] <= 21.2, `${name} fits around its original stack`);
    assert.ok(side < 0 ? box.max[0] <= -17.8 : box.min[0] >= 17.8, `${name} including inward pull handles stays inside its wall-side service zone`);
  }
  const allowed = manifest.assemblies.map(({ bounds: box }) => new THREE.Box3(new THREE.Vector3(...box.min), new THREE.Vector3(...box.max)).expandByScalar(.002));
  let meshes = 0, triangles = 0, glazing = 0;
  const point = new THREE.Vector3();
  props.traverse(mesh => {
    if (!mesh.isMesh) return;
    meshes++;
    if (mesh.material.name === 'FinishGlass') glazing++;
    const geometry = mesh.geometry, positions = geometry.getAttribute('position');
    triangles += (geometry.index?.count ?? positions.count) / 3;
    for (let i = 0; i < positions.count; i++) {
      point.fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld);
      assert.ok(allowed.some(box => box.containsPoint(point)), `exported vertex ${point.toArray()} exceeds all assembly bounds`);
    }
  });
  assert.equal(triangles, manifest.triangles, 'manifest reflects the actual exported triangle count');
  assert.equal(meshes, 9, 'opaque assemblies remain eight shared primitives, with one separate glazing batch');
  assert.equal(glazing, 1, 'all gallery panes share one transparent draw primitive');
  for (const assembly of manifest.assemblies) assert.ok(assembly.triangles <= 10_000, `${assembly.name} stays under the individual prop triangle budget`);
});

test('finished props preserve side aisles, rear crosswalk, cargo approach and open elevator entry', async t => {
  const { station, props, model } = await fixture(t);
  const eye = station.interiorBox.min.y + SHIP_LAYOUT.eyeHeight;
  for (const x of [-12, 12]) clearSweep(station, [x, eye, -16], [x, eye, 20]);
  clearSweep(station, [-12, eye, 20], [12, eye, 20]);
  clearSweep(station, [-12, eye, 20], [-12, eye, 20.7]);
  clearSweep(station, [0, eye, 20], [0, eye, 24]);
  // The pedestal is still physical after the approach; decoration cannot turn it into a ghost.
  assert.equal(station.constrainStep(toWorld(station, [-12, eye, 20.7]), toWorld(station, [-12, eye, 23]), station.quaternion, true).hit, true);
  // Rays use model-local coordinates, unaffected by the distant planet-centred station frame.
  model.updateMatrixWorld(true);
  for (const [x, z] of [[-12, 15], [12, 15], [-6, 20], [6, 20], [0, 24]]) {
    const ray = new THREE.Raycaster(new THREE.Vector3(x, eye, z), new THREE.Vector3(0, -1, 0), 0, 3);
    assert.equal(ray.intersectObject(props, true).length, 0, `no decorative prop becomes a second floor at ${x},${z}`);
    const support = ray.intersectObject(station.deck, true)[0];
    assert.ok(support, 'authored landing deck supports the clear path');
    assert.ok(Math.abs(support.point.y + 8) < .001);
  }
});

test('Atlas complete flight envelope docks and launches past the finished service props', async t => {
  const { station, props } = await fixture(t, { fleet: true });
  const floor = station.interiorBox.min.y;
  assert.ok(station.padLocal.distanceTo(new THREE.Vector3(...FLEET_HANGAR.pad))<1e-6);
  assert.deepEqual(props.scale.toArray(),[1,1,1],'human service props remain outside the enlarged shell frame');
  assert.equal(props.parent,station.model);
  const seatX = station.padLocal.x + FREIGHTER_LAYOUT.seatEye[0];
  const seatZ = station.padLocal.z + FREIGHTER_LAYOUT.seatEye[2];
  const docked = floor + FREIGHTER_LAYOUT.seatEye[1], hover = docked + 1;
  const outside = station.openingZ + FREIGHTER_LAYOUT.seatEye[2] - FREIGHTER_LAYOUT.flightBounds.max[2] - 5;
  const approach = [seatX, hover, outside], overPad = [seatX, hover, seatZ];
  assert.equal(station.constrainStep(toWorld(station, approach), toWorld(station, overPad), station.quaternion, false, FREIGHTER_LAYOUT).hit, true, 'closed hangar door still intercepts the full Atlas');
  station.openDoors(); station.doorMixer.update(6); station.updateDoorColliders();
  assert.equal(station.doorsOpen, 1);
  clearSweep(station, approach, overPad, false, FREIGHTER_LAYOUT);
  assert.equal(station.canDock(toWorld(station, overPad), FREIGHTER_LAYOUT, station.quaternion), true);
  clearSweep(station, overPad, [seatX, docked, seatZ], false, FREIGHTER_LAYOUT);
  clearSweep(station, [seatX, docked, seatZ], overPad, false, FREIGHTER_LAYOUT);
  clearSweep(station, overPad, approach, false, FREIGHTER_LAYOUT);
});

test('workbench dressing sits above the original counter and leaves the terminal screen unobstructed', async t => {
  const { model, props } = await fixture(t);
  model.updateMatrixWorld(true);
  const interior = model.getObjectByName('HangarInterior');
  const counterRay = new THREE.Raycaster(new THREE.Vector3(-18.6, -6, 14), new THREE.Vector3(0, -1, 0), 0, 2);
  const original = counterRay.intersectObject(interior, true)[0];
  const finished = counterRay.intersectObject(props, true)[0];
  assert.ok(original && finished, 'both original counter and fitted overlay exist');
  const separation = finished.point.y - original.point.y;
  assert.ok(separation > .03 && separation < .08, `counter overlay clears original top without floating: ${separation} m`);
  for (const x of [-12.8, -12, -11.2]) for (const y of [-6.78, -6.28, -5.78]) {
    const ray = new THREE.Raycaster(new THREE.Vector3(x, y, 21.5), new THREE.Vector3(0, 0, 1), 0, 1.19);
    assert.equal(ray.intersectObject(props, true).length, 0, `terminal print remains visible through bezel at ${x},${y}`);
  }
});
