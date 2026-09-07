import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { readFile } from 'node:fs/promises';
import { gearStep, GEAR_FLIGHT } from '../src/gear-flight.js';
import { Navigation } from '../src/navigation.js';
import { SHIP_LAYOUT, constrainShipStep, interactionAt } from '../src/boarding.js';
import { ShipCamera } from '../src/ship-camera.js';
import { MiningStore } from '../src/mining/store.js';
import { ShipInventory } from '../src/ship-inventory.js';
import { nomadCargoState } from '../src/nomad-cabin.js';
import { FREIGHTER_LAYOUT } from '../src/freighter-layout.js';
import { RADIUS } from '../src/world.js';
import { findDestinations } from '../src/world.js';
import { mountTransformFromAsset } from '../src/weapon-mounts.js';
import { readGLBGeometry } from './helpers/gltf-geometry.js';

const v = (x, z, y = 2.75) => new THREE.Vector3(x, y, z);
const near = (a, b, message) => assert.ok(a.distanceTo(b) < 1e-6, `${message}: ${a.toArray()} / ${b.toArray()}`);
function setup(t) {
  const previous = { document: globalThis.document, window: globalThis.window };
  const listeners = new Map();
  const surface = { addEventListener(type, callback) { listeners.set(type, callback); } };
  globalThis.document = { ...surface, hidden: false, querySelector: () => null, body: { classList: { toggle() {} } } };
  globalThis.window = surface;
  t.after(() => Object.assign(globalThis, previous));
  const nav = new Navigation(surface, () => {});nav.gamepad.read = () => [];
  nav.shipPosition = new THREE.Vector3(0, RADIUS + 100000, 0);nav.shipOrientation.identity();
  nav.mode = 'walk';nav.insideShip = true;nav.position.copy(nav.fromShipLocal(v(-.30, .55)));
  const advance = (seconds = 1) => { for (let i = 0; i < Math.ceil(seconds * 60); i++) nav.update(1 / 60); };
  return { nav, advance };
}

test('Nomad furniture has swept capsule collision while the central boarding aisle stays continuous', () => {
  for (const [from, to] of [[v(0, .55), v(-1.1, .55)], [v(-.3, -1.3), v(-1, 1.6)], [v(0, 2.7), v(-1.3, 2.7)]]) {
    near(constrainShipStep(from, to, true), from, 'solid berth or rack');
  }
  near(constrainShipStep(v(0, -1.2), v(0, 7), true), v(0, 7), 'full centre route');
  near(constrainShipStep(v(-.3, .55), v(0, .55), true), v(0, .55), 'berth stand clearance');
  assert.equal(interactionAt(v(-.3, .55), false), 'berth');
  assert.equal(interactionAt(v(-.3, 2.7), false), 'storage');
  assert.equal(interactionAt(v(0, 1.15), false), 'storage', 'existing starboard supplies access');
  assert.equal(interactionAt(v(0, 2.7), false), 'door', 'centre F remains a hatch control');
  assert.equal(interactionAt(v(-2, .55), false), null, 'no berth access through hull');
});

test('berth entry and exit ease locally, ignore locomotion and restore a clear standing location', t => {
  const { nav, advance } = setup(t);const start = nav.toShipLocal();
  nav.embark();assert.equal(nav.berthRest, true);assert.ok(nav.berthTransition);
  near(nav.toShipLocal(), start, 'entry begins at physical approach');
  advance(.25);
  assert.ok(nav.toShipLocal().distanceTo(start) > .1);
  assert.ok(nav.toShipLocal().distanceTo(new THREE.Vector3(...SHIP_LAYOUT.berth.eye)) > .1);
  advance();assert.equal(nav.berthTransition, null);
  near(nav.toShipLocal(), new THREE.Vector3(...SHIP_LAYOUT.berth.eye), 'rest eye');
  nav.keys.add('KeyW');nav.keys.add('Space');advance();
  near(nav.toShipLocal(), new THREE.Vector3(...SHIP_LAYOUT.berth.eye), 'rest ignores walking and jumping');
  assert.equal(nav.mode, 'walk');assert.equal(nav.insideShip, true);
  nav.embark();advance();
  assert.equal(nav.berthRest, false);near(nav.toShipLocal(), new THREE.Vector3(...SHIP_LAYOUT.berth.stand), 'standing eye');
});

for (const flightAssist of [true, false]) test(`rest stays attached to ${flightAssist ? 'assisted' : 'rotating inertial'} cabin flight`, t => {
  const { nav, advance } = setup(t);
  nav.orbit();nav.orientation.identity();nav.position.set(0, RADIUS * 3, 0);nav.flightAssist = flightAssist;
  nav.velocity.set(50, 0, -80);nav.angularVelocity.set(0, 0, flightAssist ? 0 : .12);nav.embark();
  nav.position.copy(nav.fromShipLocal(v(-.3, .55)));nav.embark();advance();
  const hull = nav.shipPosition.clone();const speed = nav.shipSpeed;
  nav.keys.add('KeyW');nav.keys.add('KeyQ');advance(2);
  assert.ok(nav.shipPosition.distanceTo(hull) > 100);assert.ok(nav.shipSpeed > 50);
  if (flightAssist) assert.ok(Math.abs(nav.shipSpeed - speed) < .2);
  near(nav.toShipLocal(), new THREE.Vector3(...SHIP_LAYOUT.berth.eye), 'ship-local rest eye');
  assert.equal(nav.berthRest, true);assert.equal(nav.cabinFlight, true);
  nav.embark();advance();near(nav.toShipLocal(), new THREE.Vector3(...SHIP_LAYOUT.berth.stand), 'safe stand after flight');
});

test('berth access is local, Atlas cannot use it, and explicit travel clears the posture', t => {
  const { nav, advance } = setup(t);
  nav.position.copy(nav.fromShipLocal(v(0, -1.2)));assert.equal(nav.useBerth(true), false);
  nav.position.copy(nav.fromShipLocal(v(-.3, .55)));nav.embark();advance();
  nav.orbit();assert.equal(nav.berthRest, false);assert.equal(nav.berthTransition, null);assert.equal(nav.mode, 'flight');
  nav.layout = FREIGHTER_LAYOUT;nav.mode = 'walk';assert.equal(nav.useBerth(true), false);
});

test('a resting passenger follows soft touchdown and crash recovery clears the berth posture', t => {
  const { nav, advance } = setup(t);const direction = findDestinations().coast;
  nav.transit(direction, 5);nav.flightAssist = false;nav.velocity.fromArray(direction).multiplyScalar(-2);nav.embark();
  nav.position.copy(nav.fromShipLocal(v(-.3, .55)));nav.embark();advance(3);
  assert.equal(nav.cabinFlight, false);assert.equal(nav.berthRest, true);assert.equal(nav.mode, 'walk');
  near(nav.toShipLocal(), new THREE.Vector3(...SHIP_LAYOUT.berth.eye), 'rest posture through touchdown');
  assert.equal(nav.gearProgress, 1);
  nav.orbit();nav.embark();nav.position.copy(nav.fromShipLocal(v(-.3, .55)));nav.embark();advance();
  nav.mode = 'flight';nav.crashAt({ crashed: true, impactSpeed: 50, surface: 'terrain' }, nav.normal);
  assert.equal(nav.berthRest, false);assert.equal(nav.berthTransition, null);assert.equal(nav.mode, 'crashed');
});

test('rest uses first person and restores the selected external walking camera after standing', t => {
  const { nav, advance } = setup(t);const camera = new ShipCamera();camera.playerExternal = true;
  nav.embark();advance();camera.update(nav, { surfaceRadius: () => 0 });
  assert.equal(camera.active, false);assert.equal(camera.playerExternal, true);near(camera.position, nav.position, 'physical berth eye');
  nav.embark();advance();camera.update(nav, { surfaceRadius: () => 0 });assert.equal(camera.active, true);
});

test('physical rack metadata follows persistent installed boxes, transfers and exact supply/mineral limits', () => {
  const values = new Map(), disk = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
  const inventory = new ShipInventory(disk), store = new MiningStore(disk);store.bindManifest(inventory);
  const before = nomadCargoState(store);assert.equal(before.boxes, 4);assert.equal(before.slots, 32);assert.equal(before.supplies, 33);
  assert.equal(store.transfer('repair', 'ship', 'pack', 1).ok, true);
  assert.equal(nomadCargoState(store).supplies, 29);
  assert.equal(store.addBox('ship').ok, true);
  const after = nomadCargoState(store);assert.equal(after.boxes, 5);assert.equal(after.slots, 40);
  assert.equal(after.supplyLimit, 120);assert.equal(after.mineralLimit, 60);
  const restored = new MiningStore(disk);restored.bindManifest(new ShipInventory(disk));assert.deepEqual(nomadCargoState(restored), after);
});

test('authored berth and cargo sockets match navigation, cabin fits, and the textured ship stays in budget', async () => {
  const url = new URL('../public/models/nomad.glb', import.meta.url), { scene } = await readGLBGeometry(url);
  for (const [name, point] of [['BerthEye', SHIP_LAYOUT.berth.eye], ['BerthStand', SHIP_LAYOUT.berth.stand], ['CargoRackAccess', [-.85, 2.75, 2.7]]]) {
    const node = scene.getObjectByName(name);assert.ok(node, name);near(node.getWorldPosition(new THREE.Vector3()), new THREE.Vector3(...point), name);
  }
  for (let i = 1; i <= 8; i++) assert.ok(scene.getObjectByName(`CargoBox_${i}`), `box ${i}`);
  for (const spec of SHIP_LAYOUT.hardpoints) {
    const node = scene.getObjectByName(spec.name);assert.ok(node, spec.name);
    const matrix = mountTransformFromAsset(scene, { node: spec.name, size: 1 }, { size: 1 });
    near(new THREE.Vector3().setFromMatrixPosition(matrix), new THREE.Vector3(...spec.position), 'S1 fitting origin');
    const outward = new THREE.Vector3(0, 1, 0).transformDirection(matrix);
    near(outward, new THREE.Vector3(Math.sign(spec.position[0]), 0, 0), '+Y is outward');
    near(new THREE.Vector3(0, 0, -1).transformDirection(matrix), new THREE.Vector3(0, 0, -1), 'bore faces forward');
    assert.equal(node.userData.size, 1);assert.equal(node.userData.socketOnly, true);assert.equal(node.userData.installedWeapon, null);
    assert.throws(() => mountTransformFromAsset(scene, { node: spec.name, size: 1 }, { size: 3 }), /does not fit/);
  }
  for (const spec of SHIP_LAYOUT.gear.legs) {
    const node = scene.getObjectByName(spec.name);assert.ok(node, spec.name);
    near(node.position, new THREE.Vector3(...spec.pivot), 'deployed gear pivot');
    for (let step = 0; step <= 10; step++) {
      const fold = step / 10;node.position.fromArray(spec.pivot).addScaledVector(new THREE.Vector3(...spec.retractOffset), fold);node.rotation.z = spec.retractAngle * fold;
      const box = new THREE.Box3().setFromObject(node, true);
      assert.ok(box.min.y > -1e-5, 'gear never sweeps below its deployed foot plane');
      for (const [axis, key] of ['x','y','z'].entries()) {
        assert.ok(box.min[key] >= SHIP_LAYOUT.flightBounds.min[axis] - 1e-5);
        assert.ok(box.max[key] <= SHIP_LAYOUT.flightBounds.max[axis] + 1e-5);
      }
      if (fold === 1) assert.ok(box.min.y > .8, 'stowed feet clear the landing plane');
    }
    node.position.fromArray(spec.pivot);node.rotation.z = 0;
  }
  const data = await readFile(url), json = JSON.parse(data.subarray(20, 20 + data.readUInt32LE(12)));
  const triangles = json.meshes.reduce((total, mesh) => total + mesh.primitives.reduce((n, p) => n + json.accessors[p.indices].count / 3, 0), 0);
  assert.ok(triangles < 58000, `${triangles} authored triangles; browser also checks the complete <60k runtime assembly`);
  assert.ok(data.length <= 4_000_000, `${data.length} bytes`);
  assert.ok(json.images?.length >= 4, 'local baked hull/cabin albedo and packed PBR maps');
  assert.ok(json.images.every(image => image.mimeType === 'image/webp' && image.bufferView !== undefined), 'all textures embedded WebP');
  const sightline = new THREE.Raycaster(new THREE.Vector3(...SHIP_LAYOUT.seatEye), new THREE.Vector3(0, 0, -1), 0, 8);
  assert.equal(sightline.intersectObject(scene, true).length, 0, 'cockpit sightline remains clear');
});

// Manual selection must survive approach/ascent and an in-flight cabin visit.
test('canonical gear clock preserves the pilot selection and stops without power', t => {
  const { nav, advance } = setup(t);nav.orbit();
  assert.equal(nav.gearProgress, 0);assert.equal(nav.gearDeployed, false);
  assert.equal(nav.toggleGear(), true);advance(.9);assert.ok(Math.abs(nav.gearProgress-.5)<.01);
  advance(1);assert.equal(nav.gearProgress, 1);
  nav.velocity.copy(nav.normal).multiplyScalar(20);advance(.5);assert.equal(nav.gearDeployed,true);
  nav.toggleGear();advance(.6);const paused=nav.gearProgress;nav.togglePower();advance(1);assert.equal(nav.gearProgress,paused);
  nav.togglePower();advance(2);assert.equal(nav.gearProgress,0);
  nav.embark();advance(1);assert.equal(nav.cabinFlight,true);assert.equal(nav.gearDeployed,false);
  for(const hz of [15,30,60,120]){let p=0;for(let f=0;f<hz*GEAR_FLIGHT.seconds;f++)p=gearStep(p,true,1/hz);assert.ok(Math.abs(p-1)<1e-12);}
});

test('power-off soft contact lowers gear on the emergency bus and completes touchdown', t => {
  const { nav, advance } = setup(t);
  nav.transit(findDestinations().coast, 3.21);nav.flightAssist=false;nav.powered=false;
  nav.velocity.copy(nav.normal).multiplyScalar(-.5);
  advance(.1);
  assert.equal(nav.mode,'flight');assert.equal(nav.gearContactHold,true);
  assert.ok(nav.gearProgress<.1,'contact does not snap the gear into place');
  advance(.8);assert.ok(nav.gearProgress>.4&&nav.gearProgress<.6);
  advance(1.2);
  assert.equal(nav.mode,'landed');assert.equal(nav.powered,false);
  assert.equal(nav.gearProgress,1);assert.equal(nav.gearContactHold,false);
});
