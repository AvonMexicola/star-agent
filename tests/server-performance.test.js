import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createRoom, playerSnapshot } from '../server/room.js';
import { createMemoryStore } from '../server/database.js';
import { SHIP_LAYOUT } from '../src/boarding.js';
import { FREIGHTER_LAYOUT, FreighterSystems } from '../src/freighter-layout.js';

function fixtureWorld() {
  const center = new THREE.Vector3(25_000_000_000, 1_900_000, -100_000_000);
  const pods = Array.from({ length: 20 }, (_, i) => {
    const pad = center.clone().add(new THREE.Vector3(i * 160, 0, 0));
    const quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(i * .17, i * .29, i * .11));
    const inverse = quaternion.clone().invert();
    return { id: i + 1, padWorldPosition: pad, padQuaternion: quaternion,
      approachWorldPosition: new THREE.Vector3(0, 0, 100).applyQuaternion(quaternion).add(pad),
      interiorBox: new THREE.Box3(new THREE.Vector3(-30, -5, -80), new THREE.Vector3(30, 15, 0)), openingZ: 0,
      toLocal(point, out) { return out.copy(point).sub(pad).applyQuaternion(inverse); },
      toWorld(point, out) { return out.copy(point).applyQuaternion(quaternion).add(pad); },
      isInsideHangar(point) { return this.interiorBox.containsPoint(this.toLocal(point, new THREE.Vector3())); } };
  });
  return { pods, center, station: { direction: new THREE.Vector3(0, 1, 0), baseQuaternion: new THREE.Quaternion(), altitude: 400000 },
    doors() {}, adapter() { return {}; }, createNavigation(slot) {
      const n = { position: pods[slot].approachWorldPosition.clone(), orientation: pods[slot].padQuaternion.clone(),
        shipOrientation: pods[slot].padQuaternion.clone(), shipPosition: null, body: { id: 'aeon' }, mode: 'flight',
        shipId: 'nomad', layout: SHIP_LAYOUT, gamepad: {}, look() {}, beginFrame() {}, update() {},
        travel: null, travelTarget: null, crash: null };
      for (const key of ['velocity', 'shipVelocity', 'angularVelocity', 'shipAngularVelocity']) n[key] = new THREE.Vector3();
      for (const key of ['gearDeployed', 'powered', 'cabinFlight', 'insideShip', 'dockedAtStation', 'stationLift', 'doorOpen', 'shipLightsOn', 'flashlightOn', 'flightAssist', 'combatMode', 'spaceParked', 'autoland']) n[key] = false;
      for (const key of ['gearProgress', 'doorProgress', 'speedScale', 'jumpHeight', 'jumpVelocity']) n[key] = 0;
      return n;
    } };
}

async function setup(t, count = 10) {
  const world = fixtureWorld(), store = createMemoryStore(), messages = new Map();
  const room = createRoom({ world, store, autoStart: false, now: () => 100000,
    onError(error) { assert.fail(error.stack); } });
  t.after(() => room.close());
  for (let i = 0; i < count; i++) {
    const account = await store.createAccount({ email: `performance${i}@example.test`, callsign: `Performance${i}`, passwordHash: 'fixture' });
    messages.set(account.id, []);
    await room.join(account, message => messages.get(account.id).push(message));
  }
  for (const list of messages.values()) list.length = 0;
  return { room, world, messages, players: [...room.players.values()] };
}

test('one broadcast samples each pilot once while retaining full wire state and recipient privacy', async t => {
  const { room, world, players, messages } = await setup(t);
  players[0].nav.travel = { phase: 'cruise', progress: .375, target: { id: 'selene', position: [1, 2, 3] } };
  players[0].nav.physicsFrame = 'hangar:1';
  players[0].nav.stationPhysics = { up: new THREE.Vector3(.2, .9, -.3).normalize() };
  players[1].nav.shipId = 'atlas'; players[1].nav.layout = FREIGHTER_LAYOUT;
  players[1].nav.freighter = new FreighterSystems();
  for (const [i, p] of players.entries()) room.trading.state.accounts[p.id].credits = 1500 + i;
  const base = players[0].nav.position;
  for (const [id, offset] of [['near', 0], ['edge', 500], ['inside', 499.999], ['outside', 500.001]]) {
    room.drops.set(id, { id, item: 'bandage', quantity: 1, position: [base.x, base.y + offset, base.z], expiresAt: 200000 });
  }
  const expectedPlayers = players.map(playerSnapshot);
  const expected = new Map(players.map(p => [p.id, structuredClone(room.state(p))]));
  let sampled = 0;
  for (const p of players) {
    const toArray = p.nav.position.toArray.bind(p.nav.position);
    p.nav.position.toArray = (...args) => { sampled++; return toArray(...args); };
  }
  room.tick();
  assert.equal(sampled, 0, '30 Hz simulation retains the 15 Hz snapshot cadence');
  assert.ok([...messages.values()].every(list => list.length === 0));
  room.tick();
  assert.equal(sampled, players.length, 'sample the public pilot poses once per broadcast, not once per recipient');
  for (const [i, p] of players.entries()) {
    const actual = messages.get(p.id)[0], before = expected.get(p.id);
    before.doors = { ...room.doors };
    assert.deepEqual(JSON.parse(JSON.stringify(actual)), JSON.parse(JSON.stringify(before)));
    assert.deepEqual(actual.players, expectedPlayers);
    assert.equal(actual.commerce.account.credits, 1500 + i);
    assert.equal(actual.inventory, p.inventory);
    assert.equal(actual.hangar.id, p.hangarId);
  }
  const previous = messages.get(players[0].id)[0];
  assert.deepEqual(previous.drops.map(d => d.id), ['near', 'inside'], '500 m visibility remains exclusive');
  const retained = structuredClone(previous);
  players[0].nav.position.x += 13;
  players[0].nav.travel.target.position[0] = 999;
  world.station.baseQuaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), .2);
  room.tick(); room.tick();
  assert.deepEqual(previous, retained, 'later ticks must not mutate a retained public snapshot');
  assert.notDeepEqual(messages.get(players[0].id)[1].players, retained.players);
  players[0].nav.position.x += 1;
  assert.equal(room.state(players[0]).players[0].position[0], players[0].nav.position.x, 'an immediate request reads live state');
});

// Deliberately retain the original allocating collision calculation as an
// independent reference for the scratch-vector implementation. The authored
// eight-corner hull and pilot sensor must classify every doorway identically.
function referenceOccupied(pod, players) {
  return players.some(p => {
    const n = p.nav;
    if (n.position.distanceToSquared(pod.padWorldPosition) > 250000 && (!n.shipPosition || n.shipPosition.distanceToSquared(pod.padWorldPosition) > 250000)) return false;
    if (pod.isInsideHangar(n.position) || n.shipPosition && pod.isInsideHangar(n.shipPosition)) return true;
    if (n.shipPosition || ['flight', 'landed', 'crashed'].includes(n.mode)) {
      const q = n.shipPosition ? n.shipOrientation : n.orientation;
      const root = n.shipPosition ?? n.position.clone().sub(new THREE.Vector3(...n.layout.seatEye).applyQuaternion(q));
      const bounds = new THREE.Box3(), shape = n.layout.flightBounds;
      for (let i = 0; i < 8; i++) {
        const corner = new THREE.Vector3(...shape.min);
        for (let axis = 0; axis < 3; axis++) if (i & (1 << axis)) corner.setComponent(axis, shape.max[axis]);
        bounds.expandByPoint(pod.toLocal(corner.applyQuaternion(q).add(root), corner));
      }
      const opening = new THREE.Box3(new THREE.Vector3(pod.interiorBox.min.x - 1, pod.interiorBox.min.y - 1, pod.openingZ - 1),
        new THREE.Vector3(pod.interiorBox.max.x + 1, pod.interiorBox.max.y + 1, pod.openingZ + 1));
      if (bounds.intersectsBox(opening)) return true;
    }
    const local = pod.toLocal(n.position, new THREE.Vector3());
    return Math.abs(local.x) < pod.interiorBox.max.x + 12 && Math.abs(local.z - pod.openingZ) < 18 && local.y > pod.interiorBox.min.y - 5 && local.y < pod.interiorBox.max.y + 5;
  });
}

test('door optimisation matches original hull and suit occupancy across rotated distant-world poses', async t => {
  const { room, world, players } = await setup(t);
  room.leases.clear();
  for (const p of players) { p.hangarId = null; p.send = () => {}; }
  let seed = 7291;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  for (let sample = 0; sample < 240; sample++) {
    for (const p of players) {
      const n = p.nav, pod = world.pods[Math.floor(random() * world.pods.length)];
      n.mode = ['flight', 'walk', 'eva', 'landed', 'crashed'][Math.floor(random() * 5)];
      n.layout = random() < .5 ? SHIP_LAYOUT : FREIGHTER_LAYOUT;
      pod.toWorld(new THREE.Vector3((random() - .5) * 120, (random() - .5) * 60, (random() - .5) * 160), n.position);
      n.orientation.setFromEuler(new THREE.Euler(random() * 6, random() * 6, random() * 6));
      n.shipOrientation.setFromEuler(new THREE.Euler(random() * 6, random() * 6, random() * 6));
      n.shipPosition = random() < .5 ? pod.toWorld(new THREE.Vector3((random() - .5) * 100, (random() - .5) * 40, (random() - .5) * 140), new THREE.Vector3()) : null;
    }
    const dt = [.001, 1 / 30, .1][sample % 3], expected = {};
    for (const pod of world.pods) {
      room.doors[pod.id] = [0, .01, .5, .99, 1][Math.floor(random() * 5)];
      const occupied = referenceOccupied(pod, players);
      expected[pod.id] = Math.max(0, Math.min(1, room.doors[pod.id] + (occupied ? 1 : -1) * dt / 3));
    }
    const poses = players.map(p => ({ position: p.nav.position.clone(), shipPosition: p.nav.shipPosition?.clone() ?? null }));
    room.tick(dt);
    assert.deepEqual(room.doors, expected, `doorway classification at deterministic sample ${sample}`);
    for (const [i, p] of players.entries()) {
      assert.deepEqual(p.nav.position, poses[i].position);
      assert.deepEqual(p.nav.shipPosition, poses[i].shipPosition, 'scratch work cannot alter authoritative hull poses');
    }
  }
});

test('leased doors open without repeating the occupancy sensor', async t => {
  const { room, world, players } = await setup(t, 1);
  players[0].hangarId = null;
  for (const pod of world.pods) {
    room.leases.set(pod.id, { id: pod.id, owner: 'fixture', status: 'approach', expiresAt: 200000 });
    pod.isInsideHangar = pod.toLocal = () => assert.fail('a lease already guarantees this door opens');
  }
  room.tick();
  for (const progress of Object.values(room.doors)) assert.equal(progress, (1 / 30) / 3);
});
