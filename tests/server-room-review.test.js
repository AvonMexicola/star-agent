import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createRoom } from '../server/room.js';
import { createMemoryStore } from '../server/database.js';
import { initialInventory, restoreInventory, transferInventory } from '../server/inventory.js';
import { SHIP_LAYOUT } from '../src/boarding.js';
import { FREIGHTER_LAYOUT } from '../src/freighter-layout.js';

function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }
const flush = () => new Promise(resolve => setImmediate(resolve));
function fakeWorld() {
  const center = new THREE.Vector3(0, 1_900_000, 0);
  const pods = Array.from({ length: 10 }, (_, index) => {
    const pad = center.clone().add(new THREE.Vector3(index * 100, 0, 0));
    return { id: index + 1, padWorldPosition: pad, approachWorldPosition: pad.clone().add(new THREE.Vector3(0, 0, 100)),
      up: new THREE.Vector3(0, 1, 0), openingZ: 0,
      interiorBox: new THREE.Box3(new THREE.Vector3(-30, -5, -80), new THREE.Vector3(30, 15, 0)),
      toLocal: (point, out) => out.copy(point).sub(pad),
      isInsideHangar: p => { const local = p.clone().sub(pad); return Math.abs(local.x) < 30 && local.y > -5 && local.y < 15 && local.z < 0 && local.z > -80; } };
  });
  return { pods, center, doors() {}, adapter() { return {}; }, createNavigation(slot) {
    const n = { position: pods[slot].approachWorldPosition.clone(), orientation: new THREE.Quaternion(), shipOrientation: new THREE.Quaternion(),
      shipPosition: null, normal: new THREE.Vector3(0, 1, 0), body: { id: 'aeon' }, mode: 'flight', shipId: 'nomad', layout: SHIP_LAYOUT,
      gamepad: {}, look() {}, beginFrame() {}, update() {}, travel: null, travelTarget: null, crash: null };
    for (const key of ['velocity', 'shipVelocity', 'angularVelocity', 'shipAngularVelocity']) n[key] = new THREE.Vector3();
    for (const key of ['gearDeployed', 'powered', 'cabinFlight', 'insideShip', 'dockedAtStation', 'stationLift', 'doorOpen', 'shipLightsOn', 'flashlightOn', 'flightAssist', 'spaceParked', 'autoland']) n[key] = false;
    for (const key of ['gearProgress', 'doorProgress', 'speedScale', 'jumpHeight', 'jumpVelocity']) n[key] = 0;
    return n;
  } };
}
async function setup(t, count = 2) {
  const world = fakeWorld(), store = createMemoryStore(), messages = new Map();
  const accounts = await Promise.all(Array.from({ length: count }, (_, i) => store.createAccount({ email: `review${i}@example.test`, callsign: `Review${i}`, passwordHash: 'fixture' })));
  const room = createRoom({ world, store, autoStart: false, now: () => 100000 });
  t.after(() => room.close());
  for (const a of accounts) { messages.set(a.id, []); await room.join(a, m => messages.get(a.id).push(m)); }
  let serial = 0;
  return { room, store, world, accounts, messages, async request(id, body) {
    const requestId = String(++serial); await room.receive(id, { type: 'request', requestId, ...body });
    return messages.get(id).findLast(m => m.type === 'ack' && m.requestId === requestId);
  } };
}

test('reconnect cannot load stale ammo while leave waits for another account inventory write', async t => {
  const { room, store, accounts, request } = await setup(t);
  const [a, b] = accounts.map(a => room.players.get(a.id));
  // A has fired once since the periodic checkpoint. Its authoritative live
  // inventory must survive any disconnect/rejoin ordering.
  a.inventory.containers.pack['carbine-charge']--;
  a.inventory.revision++;
  const gate = deferred(), entered = deferred();
  const save = store.savePlayerState.bind(store);
  store.savePlayerState = async (id, data) => {
    if (id === b.id) { entered.resolve(); await gate.promise; }
    return save(id, data);
  };
  const otherTransfer = request(b.id, { action: 'transfer', from: 'pack', to: 'ship', item: 'bandage', quantity: 1, revision: 0 });
  await entered.promise;
  const leaving = room.leave(a.id);
  let joined = false;
  const rejoining = room.join(accounts[0], () => {}).then(() => { joined = true; });
  await flush();
  const completedBeforeFinalWrite = joined;
  gate.resolve();
  await Promise.all([otherTransfer, leaving, rejoining]);
  assert.equal(completedBeforeFinalWrite, false, 'admission must wait for the departing session final checkpoint');
  assert.equal(room.players.get(a.id).inventory.containers.pack['carbine-charge'], 59, 'rejoin must not replenish a spent round');
});

test('failed equip persistence does not change the live weapon despite a negative ack', async t => {
  const { room, store, accounts, request } = await setup(t, 1);
  const p = room.players.get(accounts[0].id), before = p.weapon;
  const save = store.savePlayerState;
  store.savePlayerState = async () => { throw new Error('storage unavailable'); };
  const ack = await request(p.id, { action: 'equip', weapon: 'sidearm-pistol' });
  store.savePlayerState = save;
  assert.equal(ack.ok, false);
  assert.equal(p.weapon, before, 'a rejected equip action must leave the authoritative weapon unchanged');
});

test('failed respawn persistence leaves death and navigation state intact', async t => {
  const { room, store, accounts, request } = await setup(t, 1);
  const p = room.players.get(accounts[0].id);
  p.health = 0; p.shipHealth = 0; p.nav.mode = 'crashed';
  const previousNav = p.nav, save = store.savePlayerState;
  const previousHangar=p.hangarId,previousLease=structuredClone(room.leases.get(previousHangar));
  store.savePlayerState = async () => { throw new Error('storage unavailable'); };
  const ack = await request(p.id, { action: 'respawn' });
  store.savePlayerState = save;
  assert.equal(ack.ok, false);
  assert.equal(p.health, 0, 'a rejected respawn must not grant live health');
  assert.equal(p.shipHealth, 0);
  assert.equal(p.nav, previousNav);
  assert.equal(p.hangarId,previousHangar);assert.deepEqual(room.leases.get(previousHangar),previousLease);
});

test('transfer cannot create a manifest that restoreInventory later discards', () => {
  const before = initialInventory();
  before.containers.station['carbine-charge'] = 9999;
  assert.deepEqual(restoreInventory(before), before, 'the starting manifest is valid and restorable');
  const action = { from: 'pack', to: 'station', item: 'carbine-charge', quantity: 2, revision: 0 };
  let next;
  try { next = transferInventory(before, action); } catch { return; }
  assert.deepEqual(restoreInventory(next), next, 'accepted transfers must remain within the authoritative per-item resource cap');
});


test('departing Atlas hull holds an unleased door open after its pilot clears the threshold', async t => {
  const { room, world, accounts } = await setup(t, 1);
  const p = room.players.get(accounts[0].id), pod = world.pods[0];
  room.leases.delete(p.hangarId);p.hangarId=null;
  p.nav.shipId = 'atlas'; p.nav.layout = FREIGHTER_LAYOUT;
  p.nav.orientation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
  p.nav.position.copy(pod.padWorldPosition).add(new THREE.Vector3(0, 5.55, 23));
  // Atlas pilot is 23 m outside, but its aft hull extends 24.5 m behind
  // that eye: 1.5 m of the ship still overlaps the physical doorway.
  assert.equal(p.nav.shipPosition, null, 'flight hull root is derived from the pilot eye');
  assert.equal(pod.isInsideHangar(p.nav.position), false);
  room.doors[pod.id] = 1;
  room.tick(.1);
  assert.equal(room.doors[pod.id], 1, 'door must test the authored flight hull, not just pilot distance');
});

test('failed disconnect checkpoint cannot silently admit an older inventory on retry', async t => {
  const { room, store, accounts } = await setup(t, 1);
  const p = room.players.get(accounts[0].id);
  p.inventory.containers.pack['carbine-charge']--;
  p.inventory.revision++;
  const save = store.savePlayerState;
  store.savePlayerState = async () => { throw new Error('temporary storage outage'); };
  await assert.rejects(room.leave(p.id));
  await flush();
  store.savePlayerState = save;
  try { await room.join(accounts[0], () => {}); }
  catch { return; } // Refusing stale admission is safe until the checkpoint can be retried.
  assert.equal(room.players.get(p.id).inventory.containers.pack['carbine-charge'], 59,
    'a failed departure must preserve/retry its latest snapshot before admitting a reconnect');
});

test('hostile JSON cannot equip an array that fires as a gun but hides the remote weapon model', async t => {
  const { room, accounts, request } = await setup(t, 1);
  const p = room.players.get(accounts[0].id), before = p.weapon;
  // Object property lookup coerces this array to 'sidearm-pistol', whereas
  // remote HELD_ITEMS.includes uses strict string identity and renders no gun.
  const ack = await request(p.id, { action: 'equip', weapon: ['sidearm-pistol'] });
  assert.equal(ack.ok, false, 'weapon identifiers must be a string or null before dictionary lookup');
  assert.equal(p.weapon, before);
});

test('a pilot outside the station cannot release a lease while their parked ship remains inside', async t => {
  const { room, world, accounts, request } = await setup(t, 1);
  const p = room.players.get(accounts[0].id);
  assert.equal((await request(p.id, { action: 'hangar' })).ok, true);
  const id = p.hangarId, pod = world.pods[id - 1];
  p.nav.mode = 'eva'; p.nav.dockedAtStation = false;
  p.nav.shipPosition = pod.padWorldPosition.clone().add(new THREE.Vector3(0, 2, -5));
  p.nav.position.copy(pod.approachWorldPosition);
  assert.equal(pod.isInsideHangar(p.nav.position), false);
  assert.equal(pod.isInsideHangar(p.nav.shipPosition), true);
  const ack = await request(p.id, { action: 'cancelHangar' });
  assert.equal(ack.ok, false);
  assert.equal(p.hangarId, id);
  assert.equal(room.leases.has(id), true);
});

test('fractional resource capacity tolerance matches the persistence restore invariant', () => {
  const before = initialInventory();
  before.containers.pack = { basalt: 19.5 };
  before.containers.ship = { basalt: 1 };
  const action = { from: 'ship', to: 'pack', item: 'basalt', quantity: .50000005, revision: 0 };
  let next;
  try { next = transferInventory(before, action); } catch { return; }
  assert.deepEqual(restoreInventory(next), next,
    'a transfer accepted within weight epsilon must not erase the manifest on reconnect');
});

test('failed admission releases its reserved hangar before another account joins',async t=>{
  const {room,store}=await setup(t,0),save=store.savePlayerState;
  const a=await store.createAccount({email:'failed@example.test',callsign:'Failed',passwordHash:'fixture'});
  store.savePlayerState=async()=>{throw new Error('storage unavailable');};
  await assert.rejects(room.join(a,()=>{}));
  assert.equal(room.leases.size,0);assert.equal(room.players.size,0);
  store.savePlayerState=save;
  await room.join(a,()=>{});
  assert.equal(room.leases.size,1);assert.equal(room.players.get(a.id).hangarId,1);
});

test('new admission does not equate a reused suit colour with another pilot occupied hangar',async t=>{
  const {room,store,accounts}=await setup(t,2);
  const a=room.players.get(accounts[0].id),b=room.players.get(accounts[1].id);
  await room.leave(a.id);
  room.leases.delete(b.hangarId);b.hangarId=1;
  room.leases.set(1,{id:1,owner:b.id,status:'occupied',expiresAt:200000});
  const c=await store.createAccount({email:'replacement@example.test',callsign:'Replacement',passwordHash:'fixture'});
  await room.join(c,()=>{});
  assert.equal(room.players.get(c.id).colorIndex,0);
  assert.equal(room.players.get(c.id).hangarId,2);
  assert.equal(room.leases.get(1).owner,b.id);
});

test('disconnect during a failed respawn does not resurrect an orphaned hangar lease',async t=>{
  const {room,store,accounts,request}=await setup(t,1),p=room.players.get(accounts[0].id);
  p.health=0;p.shipHealth=0;p.nav.mode='crashed';
  const save=store.savePlayerState,gate=deferred(),entered=deferred();let first=true;
  store.savePlayerState=async(...args)=>{
    if(first){first=false;entered.resolve();await gate.promise;throw new Error('write failed');}
    return save(...args);
  };
  const respawning=request(p.id,{action:'respawn'});await entered.promise;
  const leaving=room.leave(p.id);gate.resolve();
  assert.equal((await respawning).ok,false);await leaving;
  assert.equal(room.players.size,0);assert.equal(room.leases.size,0);
});
