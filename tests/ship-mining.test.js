import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createStratum } from '../src/stratum.js';
import { STRATUM_LAYOUT as L } from '../src/stratum-layout.js';
import { createShipMining, SHIP_MINING_PROFILE } from '../src/ship-mining.js';
import { MiningStore } from '../src/mining/store.js';
import { MineableRock } from '../src/mining/rock.js';
import { createDensity, carve, meshVolume } from '../src/mining/volume.js';
import { emptyItems, MATERIAL_IDS } from '../src/inventory/containers.js';

// Decode actual exported triangles/rig. Texture stubs are CPU-only; this makes
// no claim about WebP decoding, shader compilation or visible beam quality.
const bytes = fs.readFileSync(new URL('../public/models/stratum.glb', import.meta.url));
const loader = new GLTFLoader();
loader.register(parser => {
  parser.loadTextureImage = async index => { const t = new THREE.Texture(); parser.associations.set(t, { textures: index }); return t; };
  return { name: 'ShipMiningGeometryTest' };
});
let asset;
before(async () => {
  asset = await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
});
const near = (a, b, epsilon = 1e-5) => assert.ok(Math.abs(a - b) <= epsilon, `${a} != ${b}`);
const vectorNear = (a, b, epsilon = 1e-5) => near(a.distanceTo(b), 0, epsilon);
const mass = items => MATERIAL_IDS.reduce((sum, id) => sum + (items[id] ?? 0), 0);

async function fixture(options = {}) {
  const scene = new THREE.Scene(), calls = [], queries = [], inspected = [], ctx = {};
  const ship = createStratum({ loader: { loadAsync: async () => ({ scene: asset.scene.clone(true) }) } });
  await ship.readyPromise;
  const pose = { position: new THREE.Vector3(25e9, 180, -700), quaternion: new THREE.Quaternion().setFromEuler(new THREE.Euler(.07, .4, -.13)) };
  const nav = { shipId: 'stratum', mode: 'landed', powered: true, enabled: true, focused: true,
    position: new THREE.Vector3(...L.interior.pilotEye).applyQuaternion(pose.quaternion).add(pose.position),
    orientation: pose.quaternion.clone(), shipPosition: pose.position.clone(), shipOrientation: pose.quaternion.clone(),
    normal: new THREE.Vector3(0, 1, 0), layout: { seatEye: L.interior.pilotEye }, doorProgress: 0 };
  // Deliberately stale render placement and attitude, independent of nav doubles.
  ship.position.set(200, -70, 900); ship.quaternion.setFromEuler(new THREE.Euler(.6, -.9, .8)); scene.add(ship);
  const rocks = [0, 1].map(i => ({ rockId: `fixture-rock-${i}`, budget: 0, budgetDestination: 'pack' }));
  const store = { blocked: false, freeFor: id => id === 'stratum-ore' ? 384 : 0 };
  const mining = { store, inspectTarget: (...args) => inspected.push(args),
    onMine(data) { calls.push(data); data.target.budgetDestination = data.destination; data.target.budget += data.dt * data.rate; },
    set budget(value) { assert.fail('A ship cutter must not reset every other mining tool/rock budget'); } };
  const ray = (start, direction, origin, range) => {
    queries.push({ start: start.clone(), direction: direction.clone(), origin: origin.clone(), range });
    if (start.distanceTo(nav.position) < .01) return null;
    const local = start.clone().sub(pose.position).applyQuaternion(pose.quaternion.clone().invert());
    const rock = rocks[local.x < 0 ? 0 : 1]; mining.target = rock;
    return { point: start.clone().addScaledVector(direction, 8), normal: direction.clone().negate(), distance: 8, rock };
  };
  const origin = pose.position.clone().add(new THREE.Vector3(10, 15, 7));
  const runtime = createShipMining({ scene, nav, mining, getShip: () => ship, context: () => ctx,
    targetRay: options.defaultRay ? undefined : ray, ...options });
  const frame = (trigger = false, { armed = true, source = 'keyboard', dt = .02 } = {}) => {
    runtime.input({ trigger, armed, source }); return runtime.update(dt, origin);
  };
  return { scene, ship, nav, pose, origin, calls, queries, inspected, rocks, mining, ctx, runtime, frame };
}

test('actual articulated muzzle nodes drive two world-double cuts and camera-relative Plasma, even with stale render transforms', async () => {
  const f = await fixture(); f.frame(false); f.frame(true);
  assert.equal(f.runtime.state.active, true); assert.equal(f.calls.length, 2);
  assert.equal(f.runtime.state.beams.length, 2); assert.equal(f.queries.length, 4);
  for (let i = 0; i < 2; i++) {
    const node = f.ship.getObjectByName(L.mining.booms[i].muzzle);
    const local = f.ship.worldToLocal(node.getWorldPosition(new THREE.Vector3()));
    const expected = local.clone().applyQuaternion(f.pose.quaternion).add(f.pose.position);
    const beam = f.runtime.state.beams[i], call = f.calls[i];
    vectorNear(beam.start, expected); assert.ok(beam.start.distanceTo(f.nav.position) > 4);
    assert.ok(local.distanceTo(new THREE.Vector3(...L.mining.booms[i].muzzlePosition)) > .2, 'gimbal motion changes the actual origin');
    vectorNear(call.point, beam.end); vectorNear(call.direction, beam.direction);
    assert.equal(call.target, f.rocks[i], 'explicit target survives the second head overwriting MiningField.target');
    assert.equal(call.destination, 'stratum-ore'); near(call.rate, .22); near(call.dt, .02);
    near(beam.start.distanceTo(beam.end), 8);
    const plasma = f.scene.children.filter(x => x.isMesh)[i];
    vectorNear(plasma.position, expected.clone().sub(f.origin)); near(plasma.scale.z, 8);
    assert.equal(plasma.visible, true);
  }
  assert.equal(f.ship.snapshot().gearProgress, 1); assert.equal(f.ship.snapshot().rampProgress, 0);
  assert.ok(f.inspected.every(x => x[2] === 40 && x[3].distanceTo(f.nav.position) > 3));
  f.runtime.dispose();
});

test('flying pose derives the same physical origin from pilot eye when there is no parked shipPosition', async () => {
  const f = await fixture(); f.nav.mode = 'flight'; f.nav.shipPosition = null;
  f.frame(false); f.frame(true); assert.equal(f.calls.length, 2);
  for (let i = 0; i < 2; i++) {
    const local = f.ship.muzzle(i, { local: true });
    vectorNear(f.runtime.state.beams[i].start, local.position.applyQuaternion(f.pose.quaternion).add(f.pose.position));
  }
  f.runtime.dispose();
});

test('actual ship triangles block the nearest barrel without erasing the other head, even when hidden and back-facing', async () => {
  const f = await fixture(); f.frame(false);
  const tip = f.ship.muzzle(0), panel = new THREE.Mesh(new THREE.PlaneGeometry(.8, .8), new THREE.MeshBasicMaterial());
  panel.position.copy(tip.position).addScaledVector(tip.direction, 1);
  panel.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tip.direction);
  panel.visible = false; f.ship.add(panel); f.ship.visible = false;
  f.frame(true);
  assert.equal(f.calls.length, 1); assert.equal(f.calls[0].target, f.rocks[1]);
  assert.equal(f.runtime.state.beams[0].occluded, true);
  near(f.runtime.state.beams[0].start.distanceTo(f.runtime.state.beams[0].end), 1);
  assert.equal(panel.material.side, THREE.FrontSide); assert.equal(panel.visible, false, 'query never rewrites source state');
  f.runtime.dispose(); panel.geometry.dispose(); panel.material.dispose();
});

test('the shared target resolver honors nearer world geometry before a mineable rock', async () => {
  const f = await fixture({ defaultRay: true });
  f.mining.raycast = (start, direction) => ({ point: start.clone().addScaledVector(direction, 8), distance: 8, rock: f.rocks[0] });
  f.nav.buildingRaycast = (start, direction) => ({ point: start.clone().addScaledVector(direction, 2), distance: 2, normal: direction.clone().negate() });
  f.frame(false); f.frame(true);
  assert.equal(f.calls.length, 0); assert.equal(f.runtime.state.beams.length, 2);
  assert.ok(f.runtime.state.beams.every(x => x.occluded && x.start.distanceTo(x.end) <= 2.00001));
  f.runtime.dispose();
});

test('unsafe modes, power, menus, online play, motion assists and unavailable ore bins reject mining and held-input resumption', async () => {
  const f = await fixture();
  const cases = [
    [f.nav, 'shipId', 'gannet'], [f.nav, 'mode', 'walk'], [f.nav, 'mode', 'eva'], [f.nav, 'mode', 'destroyed'],
    [f.nav, 'powered', false], [f.nav, 'enabled', false], [f.nav, 'focused', false],
    [f.nav, 'roverOccupied', true], [f.nav, 'cabinFlight', true], [f.nav, 'berthRest', true],
    [f.nav, 'travel', {}], [f.nav, 'openingActive', true], [f.nav, 'autoland', true], [f.nav, 'stationLift', true],
    [f.nav, 'doorOpen', true], [f.nav, 'doorProgress', .1], [f.ctx, 'online', true], [f.ctx, 'blocked', true],
    [f.ship.userData, 'assetStatus', 'loading'], [f.mining.store, 'blocked', true], [f.mining.store, 'freeFor', () => 0],
  ];
  for (const [object, key, value] of cases) {
    f.frame(false); f.frame(true); assert.equal(f.runtime.state.active, true, key);
    const previous = object[key], count = f.calls.length, charge = f.runtime.state.charge;
    object[key] = value; f.frame(false); assert.equal(f.runtime.state.eligible, false, key);
    f.frame(true); assert.equal(f.calls.length, count, key); near(f.runtime.state.charge, charge);
    object[key] = previous; f.frame(true); assert.equal(f.runtime.state.active, false, `release after ${key}`);
    f.frame(false); f.frame(true); assert.equal(f.calls.length, count + 2, `new press after ${key}`);
  }
  f.runtime.dispose();
});

test('missing samples, suppressed pad zeros, device/context changes and clear all require a new physical neutral', async () => {
  const f = await fixture(); f.frame(true); assert.equal(f.calls.length, 0);
  f.frame(false); f.frame(true); assert.equal(f.calls.length, 2);
  f.runtime.update(.02, f.origin); f.frame(true); assert.equal(f.calls.length, 2);
  f.frame(false, { source: 'controller', armed: false }); f.frame(true, { source: 'controller' });
  assert.equal(f.calls.length, 2, 'modal-zeroed unarmed pad never rearms a held trigger');
  f.frame(false, { source: 'controller' }); f.frame(true, { source: 'controller' }); assert.equal(f.calls.length, 4);
  f.frame(true, { source: 'touch' }); assert.equal(f.calls.length, 4);
  f.frame(false, { source: 'touch' }); f.frame(true, { source: 'touch' }); assert.equal(f.calls.length, 6);
  f.ctx.inputContext = 'new-panel'; f.frame(true, { source: 'touch' }); assert.equal(f.calls.length, 6);
  f.frame(false); f.frame(true); assert.equal(f.calls.length, 8);
  f.rocks[0].pending = true; f.runtime.clear();
  assert.equal(f.rocks[0].budget, 0); assert.equal(f.rocks[0].pending, true);
  assert.equal(f.runtime.state.active, false); assert.equal(f.scene.children.filter(x => x.isMesh).some(x => x.visible), false);
  f.frame(true); assert.equal(f.calls.length, 8);
  f.runtime.dispose(); f.runtime.input({ trigger: false }); f.runtime.update(.1, f.origin);
  assert.equal(f.scene.children.filter(x => x.isMesh).length, 0); assert.equal(f.runtime.state.reason, 'disposed');
});

test('actual head limits and a hard 40m barrel range remain effective for an unreachable sight target', async () => {
  let nav;
  const f = await fixture({ profile: { ...SHIP_MINING_PROFILE, range: 500 }, targetRay(start, direction) {
    if (nav && start.distanceTo(nav.position) < .01) return { point: start.clone().addScaledVector(direction, 1), distance: 1 };
    return { point: start.clone().addScaledVector(direction, 45), distance: 45, rock: { rockId: 'too-far' } };
  } }); nav = f.nav;
  f.nav.orientation.setFromEuler(new THREE.Euler(.8, 1.1, .1)); f.frame(false); f.frame(true);
  assert.equal(f.runtime.state.range, 40); assert.equal(f.calls.length, 0);
  assert.ok(f.runtime.state.aim.some(x => Math.abs(x.yaw) === L.mining.yawLimit));
  for (let i = 0; i < 2; i++) {
    const aim = f.ship.snapshot().aim[i];
    assert.ok(aim.yaw >= -.2 && aim.yaw <= .2 && aim.pitch >= -.12 && aim.pitch <= .14);
    const beam = f.runtime.state.beams[i], actual = f.ship.muzzle(i).direction.applyQuaternion(f.pose.quaternion);
    vectorNear(beam.direction, actual); assert.ok(beam.start.distanceTo(beam.end) <= 40.00001);
    assert.ok(beam.direction.angleTo(new THREE.Vector3(0, 0, -1).applyQuaternion(f.nav.orientation)) > .4);
  }
  f.runtime.dispose();
});

test('power and cut budgets use bounded time, stop at depletion and recharge only after a release', async () => {
  const f = await fixture({ profile: { ...SHIP_MINING_PROFILE, continuousSeconds: .2, rechargeSeconds: .2 } });
  f.frame(false); f.frame(true, { dt: 8 }); near(f.runtime.state.charge, .5); near(f.calls[0].dt, .1);
  f.frame(true, { dt: .1 }); near(f.runtime.state.charge, 0); assert.equal(f.calls.length, 4, 'last powered fraction reaches the real pipeline');
  f.frame(true, { dt: .1 }); assert.equal(f.calls.length, 4); near(f.runtime.state.charge, 0);
  f.frame(false, { dt: .1 }); near(f.runtime.state.charge, .5);
  f.frame(true, { dt: NaN }); assert.equal(f.calls.length, 4); assert.equal(f.runtime.state.reason, 'invalid-frame');
  f.frame(true); assert.equal(f.calls.length, 4); f.frame(false); f.frame(true); assert.equal(f.calls.length, 6);
  f.runtime.dispose();
});

test('missing actual muzzle transforms fail closed instead of mining from layout placeholders', async () => {
  const f = await fixture(); f.ship.muzzle = () => null;
  f.frame(false); f.frame(true); assert.equal(f.calls.length, 0); assert.equal(f.runtime.state.reason, 'muzzle-unavailable');
  assert.equal(f.runtime.state.eligible, false); assert.equal(f.runtime.state.active, false); f.runtime.dispose();
});

test('two actual muzzle hits submit voxel jobs to the real atomic store; only accepted replies change Stratum ore and collision', async () => {
  const f = await fixture(), data = new Map();
  const disk = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
  const store = new MiningStore(disk);
  assert.equal(store.registerContainer({ id: 'stratum-ore', name: 'Stratum ore', kind: 'ship', boxes: 8 }), true);
  near(store.freeFor('stratum-ore'), 384);
  assert.equal(store.write(store.withItems(store.state, 'pack', { ...emptyItems(), basalt: 48 })), true);
  f.runtime.dispose(); // Replace only the injected field with real rock/worker/store collaborators.
  const field = createDensity(), initial = meshVolume(field), rocks = [], workers = [];
  for (let i = 0; i < 2; i++) {
    const tip = f.ship.muzzle(i), start = tip.position.applyQuaternion(f.pose.quaternion).add(f.pose.position);
    const direction = tip.direction.applyQuaternion(f.pose.quaternion);
    const worker = { jobs: [], postMessage(job) { this.jobs.push(job); }, terminate() {} };
    const rock = new MineableRock(f.scene, null, { store, worker, initialField: field, rockId: `stratum-pipeline-${i}`,
      space: true, position: start.addScaledVector(direction, 10), quaternion: f.pose.quaternion.clone() });
    rock.receive({ id: worker.jobs[0].id, field: rock.snapshot.field, ...initial, meshMs: 0 });
    rocks.push(rock); workers.push(worker);
  }
  const mining = { store, raycast(start, direction, range) {
    return rocks.map(rock => { const hit = rock.raycast(start, direction, range); return hit && { ...hit, rock }; }).filter(Boolean).sort((a, b) => a.distance - b.distance)[0] ?? null;
  }, onMine(data) { data.target.onMine(data); } };
  const runtime = createShipMining({ scene: f.scene, nav: f.nav, mining, getShip: () => f.ship });
  const step = trigger => { runtime.input({ trigger }); runtime.update(.02, f.origin); };
  step(false); for (let i = 0; i < 8; i++) step(true);
  assert.ok(rocks.every(rock => rock.pending && rock.job.carving));
  assert.ok(rocks.every(rock => rock.job.destination === 'stratum-ore'));
  near(mass(store.container('stratum-ore').items), 0); near(store.mass, 48);
  const oldGeometry = rocks.map(r => r.mesh.geometry), oldCollision = rocks.map(r => r.collision);
  runtime.clear(); assert.ok(rocks.every(rock => rock.pending), 'release never cancels a submitted transaction');
  const result = i => { const job = workers[i].jobs.at(-1); const cut = carve(job.field, job.point, job.budget, .48, job.resourceWeights); assert.ok(cut.removed > 0); return { id: job.id, ...cut, ...meshVolume(cut.field, job.resourceWeights), meshMs: 0 }; };
  const accepted = result(0); rocks[0].receive(accepted);
  assert.notEqual(rocks[0].mesh.geometry, oldGeometry[0]); assert.notEqual(rocks[0].collision, oldCollision[0]);
  near(mass(store.container('stratum-ore').items), accepted.removed); near(store.mass, 48);
  assert.equal(store.state.rocks[rocks[0].rockId].revision, 1);
  const before = store.state; disk.setItem = () => { throw Error('quota'); };
  rocks[1].receive(result(1)); assert.equal(store.state, before);
  assert.equal(rocks[1].mesh.geometry, oldGeometry[1]); assert.equal(rocks[1].collision, oldCollision[1]);
  rocks[0].receive(accepted); near(mass(store.container('stratum-ore').items), accepted.removed);
  const reload = new MiningStore(disk); near(mass(reload.container('stratum-ore').items), accepted.removed); near(reload.mass, 48);
  runtime.dispose(); for (const rock of rocks) rock.dispose();
});
