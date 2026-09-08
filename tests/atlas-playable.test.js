import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ATLAS_LAYOUT, AtlasGameplaySystems, ATLAS_RAMP_CALLS } from '../src/atlas-gameplay.js';
import { createFreighter, createAtlasFallback } from '../src/freighter.js';
import { describeAtlasControl } from '../src/atlas-mark-ii-controls.js';
import { Navigation } from '../src/navigation.js';
import { playerUp } from '../src/ship-camera.js';
import { readGLBGeometry } from './helpers/gltf-geometry.js';

const p = (x, y, z) => new THREE.Vector3(x, y, z);
const close = (a, b, tolerance = 1e-7) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);
const settle = (systems, rider) => {
  for (let i = 0; i < 900; i++) {
    const carry = systems.update(1 / 60, rider);if (rider) rider.y += carry;
    if (!systems.ramps.some(r => r.moving) && !systems.elevator.moving && !systems.gates.some(g => g.moving)) return;
  }
  assert.fail('mechanisms did not settle');
};
function walk(systems, from, target) {
  const distance = Math.hypot(target.x - from.x, target.z - from.z), steps = Math.ceil(distance / .045);
  for (let i = 0; i < steps; i++) {
    const proposed = from.clone().lerp(p(target.x, from.y, target.z), 1 / (steps - i));
    const next = systems.constrain(from, proposed);
    assert.ok(next.distanceTo(proposed) < 1e-7, `route blocked at ${from.toArray()} toward ${target.toArray()}`);
    const floor = systems.floorAt(next), previousY = from.y;
    next.y = (floor ?? 0) + systems.eyeHeight;
    assert.ok(Math.abs(next.y - previousY) < .025, `boarding height jumped from ${previousY} to ${next.y}`);
    from.copy(next);
  }
  return from;
}
const model = await readGLBGeometry(new URL('../public/models/atlas-mark-ii/atlas-mark-ii.glb', import.meta.url));

test('new fleet Atlas has full scale, one real crew lift and physical ground call panels', () => {
  const systems = new AtlasGameplaySystems();
  assert.deepEqual(ATLAS_LAYOUT.flightBounds, { min: [-18, 0, -32], max: [18, 16, 32] });
  assert.deepEqual(ATLAS_LAYOUT.seatEye, [-2.1, 11.05, -21.25]);
  assert.deepEqual(systems.lifts.map(l => l.id), ['crew']);assert.equal(systems.toggle('main'), false);
  for (const call of ATLAS_RAMP_CALLS) {
    const point = p(...call.approach);
    assert.equal(systems.interaction(point), `ramp:${call.id}`);
    const control = describeAtlasControl(systems, point);
    close(p(...control.anchor).distanceTo(p(...call.anchor)), 0);
    assert.equal(control.enabled, true);assert.equal(control.action, 'Open ramp');
    assert.equal(systems.interaction(point.clone().add(p(0, 2.6, 0))), null, 'ground calls are height gated');
  }
});

test('both loading ramps support a continuous walk from ground to cargo and crew lift to bridge', () => {
  for (const id of ['front', 'aft']) {
    const systems = new AtlasGameplaySystems(), ramp = systems.ramps.find(r => r.id === id);
    const call = ATLAS_RAMP_CALLS.find(c => c.id === id);
    assert.equal(systems.operate(`ramp:${id}`, p(...call.approach)).ok, true);settle(systems);
    const rider = p(0, 1.75, ramp.outward * 33);
    walk(systems, rider, p(0, 0, ramp.outward * 20));
    close(rider.y, 4.35);assert.equal(systems.contains(rider), true);
    walk(systems, rider, p(0, 0, -4));walk(systems, rider, p(5.5, 0, -4));
    assert.equal(systems.interaction(rider), 'elevator:crew');
    assert.equal(systems.operate('elevator:crew', rider).ok, true);
    const start = rider.clone();assert.deepEqual(systems.constrain(start, start.clone().add(p(-3, 0, 0))), start);
    settle(systems, rider);close(rider.y, 11.25);assert.equal(systems.contains(rider), true);
    walk(systems, rider, p(0, 0, -4));walk(systems, rider, p(0, 0, -19));walk(systems, rider, p(-2.1, 0, -20.5));
    assert.equal(systems.interaction(rider), 'seat');
  }
});

test('ramps and crew lift reject unpowered commands; occupied and in-flight ramps remain secured', () => {
  const systems = new AtlasGameplaySystems(), call = p(...ATLAS_RAMP_CALLS[1].approach);
  assert.equal(systems.operate('ramp:aft', call, { powered: false }).ok, false);
  assert.equal(systems.operate('ramp:aft', call, { inFlight: true }).ok, false);
  assert.equal(systems.secured, true);systems.operate('ramp:aft', call);settle(systems);
  assert.equal(systems.secured, false);
  assert.equal(systems.operate('ramp:aft', p(0, 3, 28)).ok, false);
  systems.rampObstructed = () => true;assert.equal(systems.operate('ramp:aft', call).ok, false);
  systems.rampObstructed = () => false;systems.operate('ramp:aft', call);settle(systems);assert.equal(systems.secured, true);
  const rider = p(5.5, 4.35, -4);systems.operate('elevator:crew', rider);settle(systems, rider);
  assert.equal(systems.secured, true);close(systems.floorAt(rider), 9.5);
  assert.equal(systems.operate('elevator:crew', rider, { powered: false }).ok, false);
});

test('one authoritative 4.5 s gear clock pauses without power and renders all six real assemblies', () => {
  const systems = new AtlasGameplaySystems().bind(model.scene.clone(true));
  const nav = Object.assign(Object.create(Navigation.prototype), { mode: 'flight', powered: true, layout: ATLAS_LAYOUT,
    freighter: systems, gearProgress: 1, gearDeployed: false, gearContactHold: false, autoland: false });
  for (let i = 0; i < 90; i++) { nav.updateLandingGear(1 / 60);systems.update(1 / 60); }
  close(nav.gearProgress, 2 / 3);close(systems.gear.progress, nav.gearProgress);
  nav.powered = false;for (let i = 0; i < 60; i++) nav.updateLandingGear(1 / 60);
  close(nav.gearProgress, 2 / 3);
  nav.powered = true;for (let i = 0; i < 181; i++) nav.updateLandingGear(1 / 60);
  close(nav.gearProgress, 0);assert.equal(systems.gear.legs.length, 6);
  for (const leg of systems.gear.legs) close(Math.abs(leg.nodeObject.rotation.x), Math.PI / 2);
});

test('snapshots reproduce all real mechanisms and reset rejects the retired elevator array', () => {
  const systems = new AtlasGameplaySystems();systems.toggleRamp('front');systems.toggleElevator(p(5.5, 4.35, -4));
  for (let i = 0; i < 70; i++) systems.update(1 / 60);
  systems.setGear(.43, false);
  const copy = new AtlasGameplaySystems();assert.equal(copy.applySnapshot(systems.snapshot), true);
  assert.deepEqual(copy.snapshot, systems.snapshot);
  copy.reset();assert.equal(copy.secured, true);assert.equal(copy.gear.progress, 1);
  assert.equal(copy.applySnapshot([{ id: 'main', y: 0, target: 0 }]), false);
  assert.deepEqual(copy.snapshot.ramps.map(r => r.progress), [0, 0]);assert.equal(copy.lifts.length, 1);
});

test('EVA cannot cross closed loading doors or side walls and can attach only to an open slow ramp', () => {
  const systems = new AtlasGameplaySystems();
  assert.equal(systems.constrainEVA(p(0, 4.35, 26), p(0, 4.35, 23)).hit, true);
  assert.equal(systems.constrainEVA(p(6, 4.35, 0), p(8, 4.35, 0)).hit, true);
  systems.toggleRamp('aft');settle(systems);
  assert.equal(systems.constrainEVA(p(0, 4.35, 25), p(0, 4.35, 23)).hit, false);
  const point = p(0, systems.layout.cargo.floor - 4 * Math.tan(systems.ramps[1].openAngle) + 1.75, 28);
  assert.equal(systems.canAttachRamp(point, 3), true);assert.equal(systems.canAttachRamp(point, 5), false);
  assert.equal(systems.contains(point), false);
  const support = systems.surfaceAt(point);assert.equal(support.source, 'atlas-ramp:aft');assert.ok(support.normal.z > .3);
});

test('collision parts enclose the actual full-scale asset throughout gear folding without filling the underbody', () => {
  const scene = model.scene.clone(true), systems = new AtlasGameplaySystems().bind(scene), point = new THREE.Vector3();
  for (const progress of [1, .75, .5, .25, 0]) {
    systems.setGear(progress, false);scene.updateMatrixWorld(true);
    scene.traverse(mesh => {
      if (!mesh.isMesh) return;
      const position = mesh.geometry.attributes.position;
      for (let i = 0; i < position.count; i++) {
        point.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld);
        assert.ok(ATLAS_LAYOUT.flightParts.some(part => point.toArray().every((v, axis) => v >= part.min[axis] - .002 && v <= part.max[axis] + .002)),
          `${mesh.name} at ${point.toArray()} escapes collision at gear=${progress}`);
      }
    });
  }
  assert.equal(ATLAS_LAYOUT.flightParts.some(part => [0, .5, 0].every((v, axis) => v > part.min[axis] && v < part.max[axis])), false);
});

function canvasDocument() {
  const ctx = { setTransform() {}, fillRect() {}, fillText() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {} };
  return { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) };
}
test('playable loader uses authored MFDs, controls and geometry with real flight/inventory telemetry', async t => {
  const old = globalThis.document;globalThis.document = canvasDocument();t.after(() => { globalThis.document = old; });
  const systems = new AtlasGameplaySystems(), ship = createFreighter(systems, { gltf: { scene: model.scene.clone(true) } });
  await ship.readyPromise;assert.equal(ship.userData.assetStatus, 'ready');
  assert.equal(ship.getObjectByName('MainLift'), undefined);assert.equal(ship.getObjectByName('Atlas 64 m physical fallback'), undefined);
  assert.ok(ship.getObjectByName('AtlasGroundRampCall_aft'));assert.equal(ship.userData.layout, ATLAS_LAYOUT);
  const nav = { shipId: 'atlas', mode: 'landed', powered: true, freighter: systems, speed: 0, altitude: 100,
    multiplayer: { state: { connected: false, maxPlayers: 10 } }, gearProgress: 1, normal: p(0, 1, 0), velocity: p(0, 0, 0), orientation: new THREE.Quaternion(),
    flightEnvironment: { regime: 'AIRLESS', atmosphereFraction: 0 }, position: p(0, 0, 0) };
  ship.updateDisplays(.2, nav, { mass: id => id === 'ship' ? 42 : 3, capacity: { ship: 2400, pack: 18 } });
  assert.ok(ship.displayState()[2].values.includes('CREW LIFT: CARGO DECK'));
  assert.ok(ship.displayState()[3].values.includes('SHIP STORAGE: 42.0 / 2400 kg'));
  assert.equal(ship.displayState().some(page => page.values.some(value => value.includes('NOT CONNECTED'))), false);
  ship.updateGear(0, false, .5);assert.equal(ship.userData.gearAssemblies, 6);close(systems.gear.progress, .5);
  nav.powered = false;ship.syncFlight(nav);assert.ok(ship.children.filter(child => child.isLight).every(light => !light.visible));
  const fallback = createAtlasFallback(new AtlasGameplaySystems());
  assert.doesNotThrow(() => new AtlasGameplaySystems().bind(fallback));
  let invalid = false;fallback.traverse(mesh => { if (mesh.isMesh && !Number.isFinite(mesh.geometry.attributes.position.array[0])) invalid = true; });
  assert.equal(invalid, false);
});

test('third-person up follows the full-scale Atlas ramp toe on a rotated hull', () => {
  const orientation = new THREE.Quaternion().setFromAxisAngle(p(1, 0, 0), .6), nav = { mode: 'walk', layout: ATLAS_LAYOUT,
    shipOrientation: orientation, normal: p(0, 1, 0), toShipLocal: () => p(0, 1.75, 31.5) };
  close(playerUp(nav).distanceTo(p(0, 1, 0).applyQuaternion(orientation)), 0);
  nav.toShipLocal = () => p(0, 1.75, 100);assert.deepEqual(playerUp(nav), nav.normal);
});
