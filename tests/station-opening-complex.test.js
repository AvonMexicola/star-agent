import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { StationComplex } from '../src/station-complex.js';
import { stationQuaternion } from '../src/station.js';
import { POD_LAYOUT } from '../src/station-architecture.js';
import { SHIP_LAYOUT } from '../src/boarding.js';
import { FREIGHTER_LAYOUT } from '../src/freighter-layout.js';
import { RADIUS } from '../src/world.js';

const DIRECTION = new THREE.Vector3(.23, .91, .34).normalize();
const TILT = stationQuaternion(DIRECTION, new THREE.Quaternion()).multiply(
  new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 9),
).normalize();
const SUN = new THREE.Vector3(1, 0, 0);
async function assets() {
  return Promise.all(['station', 'station_lod1'].map(async name => {
    const bytes = await readFile(new URL(`../public/models/${name}.glb`, import.meta.url));
    return new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  }));
}
async function create(options = {}, beforeReady = () => {}) {
  const [gltf, lod] = await assets();
  const station = new StationComplex(new THREE.Scene(), { gltf, lod, direction: DIRECTION, orientation: TILT, ...options });
  beforeReady(station);
  await station.readyPromise;
  return station;
}
function nearVector(actual, expected, message, tolerance = 1e-8) {
  assert.ok(actual.distanceTo(expected) < tolerance, `${message}: ${actual.toArray()} != ${expected.toArray()}`);
}
const world = (station, point) => station.toWorld(new THREE.Vector3(...point), new THREE.Vector3());

test('twenty bays and hub share the supplied tilted opening frame without rotating pod offsets by berth yaw', async () => {
  const direction = DIRECTION.clone(), orientation = TILT.clone(), altitude = 123456;
  const station = await create({ direction, orientation, altitude }, () => { direction.set(0, 1, 0); orientation.identity(); });
  const centre = DIRECTION.clone().multiplyScalar(RADIUS + altitude);
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(TILT).normalize();
  nearVector(station.centre, centre, 'station option direction was cloned');
  nearVector(station.up, up, 'complex exposes the tilted deck normal');
  assert.ok(station.up.distanceTo(station.direction) > .1, 'fixture exercises a non-radial deck');
  assert.equal(station.pods.length, 20);
  for (const [i, pod] of station.pods.entries()) {
    const spec = POD_LAYOUT[i];
    nearVector(pod.worldPosition, centre.clone().add(new THREE.Vector3(...spec.offset).applyQuaternion(TILT)), `bay ${i + 1} offset`);
    const expected = TILT.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), spec.yaw));
    assert.ok(pod.quaternion.angleTo(expected) < 1e-7, `bay ${i + 1} retains its own door yaw`);
    nearVector(pod.up, up, 'pod and complex deck normals agree');
    nearVector(new THREE.Vector3(0, 1, 0).applyQuaternion(pod.padQuaternion), up, 'landed ship follows the true deck normal');
    assert.equal(pod.colliders, station.pods[0].colliders, 'tilt does not duplicate the shared local collision BVH');
  }
  station.location = 'hub';
  nearVector(station.worldPosition, centre, 'hub remains at the common centre');
  const eye = world(station, [3, -6.25, 2]);
  nearVector(station.deckPoint(eye, SHIP_LAYOUT.eyeHeight), eye, 'tilted hub keeps authored deck support');
  nearVector(station.up, up, 'hub uses the same deck normal');
  const origin = station.pods[19].worldPosition.clone().add(new THREE.Vector3(3, 4, 5));
  station.rebase(origin);
  for (const pod of station.pods) nearVector(pod.group.position, pod.worldPosition.clone().sub(origin), 'pod uploads only camera-relative position');
  nearVector(station.hub.group.position, centre.clone().sub(origin), 'hub rebases from doubles');
});

test('opening delegates retain one bay and deterministic door collision until cinematic control is released', async () => {
  const station = await create({}, station => { station.beginOpening(); station.setOpeningProgress(.4); });
  assert.equal(station.openingControlled, true);
  assert.equal(station.active.openingControlled, true);
  assert.ok(Math.abs(station.doorsOpen - .4) < 1e-8, 'a requested pose survives asynchronous shared-asset setup');
  station.nav = { mode: 'flight', openingActive: true };
  const introPod = station.active, other = station.pods[19];
  const doorPose = introPod.doors.map(door => door.position.toArray());
  const collisionPose = introPod.doorBoxes.map(box => [...box.min.toArray(), ...box.max.toArray()]);
  station.update(other.worldPosition, other.worldPosition, SUN, 6);
  assert.equal(station.active, introPod, 'camera near another bay cannot change the intro bay');
  assert.deepEqual(introPod.doors.map(door => door.position.toArray()), doorPose, 'proximity automation leaves controlled clip time unchanged');
  const rebasedPose = introPod.doorBoxes.map(box => [...box.min.toArray(), ...box.max.toArray()]);
  for (let door = 0; door < collisionPose.length; door++) for (let axis = 0; axis < 6; axis++) {
    assert.ok(Math.abs(rebasedPose[door][axis] - collisionPose[door][axis]) < 1e-8, 'rebasing preserves the controlled local collision pose');
  }
  const start = world(station, [0, -4.8, -60]), end = world(station, [0, -4.8, 2]);
  station.setOpeningProgress(0);
  assert.equal(introPod.constrainStep(start, end, introPod.padQuaternion).hit, true);
  station.setOpeningProgress(1);
  assert.equal(introPod.constrainStep(start, end, introPod.padQuaternion).hit, false, 'fully evaluated opening clears the physical flight envelope');
  assert.equal(station.endOpening(), 1);
  assert.equal(station.openingControlled, false);
  assert.equal(introPod.openingControlled, false);
  station.update(other.worldPosition, other.worldPosition, SUN, 0);
  assert.equal(station.active, introPod, 'the camera/control handover retains the same bay after doors finish');
  station.nav.openingActive = false;
  station.update(other.worldPosition, other.worldPosition, SUN, 0);
  assert.equal(station.active, other, 'free flight resumes nearest-bay selection');
});

test('physical player selects the berth while the cinematic camera controls LOD, and tilted Atlas remains dockable', async () => {
  const station = await create();
  station.nav = { mode: 'flight', openingActive: false };
  const physical = station.pods[0].padWorldPosition.clone();
  const camera = physical.clone().addScaledVector(station.up, 1000);
  station.update(physical, camera, SUN, 0);
  assert.equal(station.activeIndex, 0);
  assert.ok(station.active.cameraDistance > 900, 'LOD uses the final camera rather than physical player position');
  nearVector(station.active.group.position, station.active.worldPosition.clone().sub(camera), 'camera-relative render position');
  const seatZ = station.padLocal.z + FREIGHTER_LAYOUT.seatEye[2];
  const hover = world(station, [0, -1.45, seatZ]);
  assert.equal(station.canDock(hover, FREIGHTER_LAYOUT, station.quaternion), true, 'complete Atlas envelope fits the tilted bay');
  const onDeck = world(station, [0, -8 + FREIGHTER_LAYOUT.seatEye[1], seatZ]);
  assert.equal(station.active.constrainStep(hover, onDeck, station.quaternion, false, FREIGHTER_LAYOUT).hit, false, 'Atlas can descend along the tilted deck normal');
});

test('exterior and pod render horizon follows the camera while hidden station collision and hub location remain intact', async () => {
  const station=await create();station.nav={mode:'flight',openingActive:false};
  const pod=station.pods[0],near=pod.padWorldPosition.clone();
  const far=station.centre.clone().addScaledVector(station.up,650000);
  station.update(near,far,SUN,0);
  assert.equal(station.activeIndex,0,'physical player still selects the occupied berth');
  assert.equal(station.exterior.group.visible,false,'rings and spine are culled outside the 600 km camera horizon');
  assert.equal(station.lodGroup.visible,false);
  assert.ok(station.pods.every(p=>!p.group.visible),'nearby physical player cannot retain distant-camera pod geometry');
  const start=pod.toWorld(new THREE.Vector3(-40,-4,0),new THREE.Vector3());
  const end=pod.toWorld(new THREE.Vector3(0,-4,0),new THREE.Vector3());
  assert.equal(station.constrainStep(start,end,pod.quaternion).hit,true,'render culling does not disable swept station collision');

  station.update(far,near,SUN,0);
  assert.equal(station.exterior.group.visible,true,'near cinematic camera restores exterior even when physical player is far away');
  assert.equal(station.lodGroup.visible,true);
  assert.equal(pod.model.visible,true,'near cinematic camera also selects detailed pod geometry');
  nearVector(station.exterior.group.position,station.centre.clone().sub(near),'restored exterior uses final camera-relative doubles');

  station.nav.mode='walk';station.location='hub';
  station.update(station.centre,far,SUN,0);
  assert.equal(station.location,'hub');
  assert.equal(station.exterior.group.visible,false,'walking in the hub cannot override a distant camera cutoff');
  assert.equal(station.hub.group.visible,false);
  station.update(station.centre,station.centre,SUN,0);
  assert.equal(station.exterior.group.visible,true,'returning the camera to the hub restores the visible rings');
  assert.equal(station.hub.group.visible,true);
  assert.equal(station.exterior.hubShell.visible,false,'near hub interior retains its clear window views');
});
