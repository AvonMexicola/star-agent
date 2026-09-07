import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { authRequest, consumeResetToken, inventoryCommand, inventoryRows, normalizeMultiplayerState, signOutSession, validateAuth } from '../src/multiplayer/ui.js';
import { FreighterSystems } from '../src/freighter-layout.js';
import { createShipMFDs } from '../src/ship-mfd.js';
import { applyAuthoritativePeer, MultiplayerClient, reviveTravel, websocketURL } from '../src/multiplayer/client.js';

test('auth validation enforces callsigns and 12–128 Unicode-character passwords without real-name fields', () => {
  assert.match(validateAuth('register', { email: 'pilot@example.test', callsign: 'bad space', password: 'twelve-chars!' }), /Callsign/);
  assert.match(validateAuth('register', { email: 'pilot@example.test', callsign: 'NOMAD_7', password: 'short' }), /12–128/);
  assert.equal(validateAuth('register', { email: 'pilot@example.test', callsign: 'NOMAD_7', password: '🚀'.repeat(12) }), '');
  assert.equal(validateAuth('login', { email: 'pilot@example.test', password: 'x' }), '');
  assert.match(validateAuth('forgot', { email: 'invalid' }), /email/);
});

test('auth requests use same-origin cookies and exact endpoint payloads without retaining secrets', async () => {
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push({ url, options });
    return { ok: true, async json() { return { account: { id: 'a1', callsign: 'NOMAD_7' } }; } };
  };
  const credentials = { email: 'pilot@example.test', callsign: 'NOMAD_7', password: 'long secret value' };
  assert.deepEqual(await authRequest('register', credentials, fetcher), { account: { id: 'a1', callsign: 'NOMAD_7' } });
  await authRequest('session', null, fetcher);
  assert.equal(calls[0].url, '/api/auth/register');
  assert.equal(calls[0].options.credentials, 'same-origin');
  assert.deepEqual(JSON.parse(calls[0].options.body), credentials);
  assert.deepEqual(calls[1], { url: '/api/auth/session', options: { method: 'GET', credentials: 'same-origin', headers: undefined, body: undefined } });
  assert.equal(Object.hasOwn(globalThis, 'multiplayerPassword'), false);
});

test('sign out clears the server session before leaving and reloading connected play', async () => {
  const events = [];
  let completeLogout;
  const fetcher = async (url, options) => {
    events.push(`request:${url}:${options.method}`);
    await new Promise(resolve => { completeLogout = resolve; });
    events.push('logout-complete');
    return { ok: true, async json() { return { message: 'Signed out.' }; } };
  };
  const signingOut = signOutSession({
    connected: true,
    fetcher,
    onSignedOut: () => events.push('session-cleared'),
    onLeave: async () => { events.push('leave-and-reload'); },
  });
  await Promise.resolve();
  assert.deepEqual(events, ['request:/api/auth/logout:POST']);
  completeLogout();
  assert.deepEqual(await signingOut, { message: 'Signed out.' });
  assert.deepEqual(events, ['request:/api/auth/logout:POST', 'logout-complete', 'session-cleared', 'leave-and-reload']);
});

test('reset token is consumed once and removed from URL history before account requests', () => {
  let replacement = null;
  const token = consumeResetToken(
    { href: 'https://staragent.info/?seed=7291&reset=secret-token#flight' },
    { state: { view: 'flight' }, replaceState: (state, title, url) => { replacement = { state, title, url }; } },
  );
  assert.equal(token, 'secret-token');
  assert.deepEqual(replacement, { state: { view: 'flight' }, title: '', url: '/?seed=7291#flight' });
});

test('multiplayer state and inventory rows reflect only authoritative snapshot values', () => {
  const raw = {
    connected: true, account: { id: 'self', callsign: 'NOMAD_7' }, ownId: 'self',
    players: [{ id: 'self', callsign: 'NOMAD_7' }], maxPlayers: 10,
    hangar: { id: 'H-04', status: 'assigned', pad: [1, 2, 3] },
    inventory: { revision: 8, containers: { pack: { ice: 2 }, ship: { copper: 3 }, station: {} }, capacity: { pack: 20, ship: 120, station: 10000 }, health: 84 },
  };
  const state = normalizeMultiplayerState(raw);
  assert.equal(state.connected, true);
  assert.equal(state.health, 84);
  assert.equal(state.maxPlayers, 10);
  assert.deepEqual(inventoryRows(state.inventory).map(row => [row.item.id, row.amounts]), [
    ['copper', { pack: 0, ship: 3, station: 0 }],
    ['ice', { pack: 2, ship: 0, station: 0 }],
  ]);
  const pending = normalizeMultiplayerState({ connected: true });
  assert.equal(pending.inventory, null);
  assert.equal(pending.health, null);
  assert.equal(pending.maxPlayers, null);
});

test('inventory commands carry the server revision and never mutate the source snapshot', () => {
  const inventory = { revision: 14, containers: { pack: { ice: 2 }, ship: { 'rifle-laser': 1 }, station: {} } };
  const before = structuredClone(inventory);
  assert.deepEqual(inventoryCommand('pack-ship', 'ice', inventory), {
    method: 'transfer', payload: { from: 'pack', to: 'ship', item: 'ice', quantity: 1, revision: 14 },
  });
  assert.deepEqual(inventoryCommand('drop-pack', 'ice', inventory), {
    method: 'drop', payload: { item: 'ice', quantity: 1, revision: 14 },
  });
  assert.equal(inventoryCommand('ship-station', 'ice', inventory), null);
  assert.equal(inventoryCommand('pack-ship', 'unknown', inventory), null);
  assert.deepEqual(inventory, before);
});

function canvasDocument() {
  const context = { setTransform() {}, fillRect() {}, fillText() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {} };
  return { createElement(name) { assert.equal(name, 'canvas'); return { width: 0, height: 0, getContext: type => type === '2d' ? context : null }; } };
}

test('physical third MFD becomes actionable COMMS and paints truthful link, roster, and hangar state', t => {
  const previousDocument = globalThis.document; globalThis.document = canvasDocument();
  t.after(() => { globalThis.document = previousDocument; });
  const mfds = createShipMFDs();
  t.after(() => mfds.traverse(object => { object.geometry?.dispose(); object.material?.map?.dispose(); object.material?.dispose(); }));
  let opens = 0;
  const nav = {
    powered: true, shipSpeed: 0, speed: 0, cabinFlight: false, velocity: new THREE.Vector3(), orientation: new THREE.Quaternion(),
    flightEnvironment: { regime: 'VACUUM', atmosphereFraction: 0 }, normal: new THREE.Vector3(0, 1, 0), altitude: 50,
    mode: 'landed', flightAssist: true, freighter: null, doorOpen: false, doorProgress: 0, boost: false, position: new THREE.Vector3(),
    multiplayer: { connected: true, account: { id: 'self', callsign: 'NOMAD_7' }, players: [{ id: 'self' }, { id: 'peer' }], maxPlayers: 10, hangar: { id: 'H-04', status: 'assigned' }, inventory: { containers: { pack: { ice: 2 }, ship: { ration: 4 } }, capacity: { pack: 20, ship: 120 } } },
    openComms() { opens++; },
  };
  const inventory = { mass: () => 0, capacity: { ship: 120, pack: 20 } };
  mfds.update(1, nav, inventory, null);
  const page = mfds.snapshot()[2];
  assert.equal(page.title, 'COMMS');
  assert.ok(page.values.includes('LINK: CONNECTED'));
  assert.ok(page.values.includes('PILOTS: 2 / 10'));
  assert.ok(page.values.includes('HANGAR: H-04 / ASSIGNED'));
  assert.ok(mfds.snapshot()[3].values.includes('BACKPACK: 2.0 / 20 kg'));
  const screen = mfds.getObjectByName('MFD 3 / COMMS');
  assert.equal(screen.userData.actionId, 'comms'); screen.userData.action(); assert.equal(opens, 1);

  nav.multiplayer = null; mfds.update(1, nav, inventory, null);
  assert.equal(mfds.snapshot()[2].title, 'SYSTEMS');
  assert.equal(screen.userData.action, undefined);
});

test('client uses the same-origin /ws endpoint and revives travel vectors for existing HUD sampling', () => {
  assert.equal(websocketURL({ protocol: 'https:', host: 'staragent.info' }), 'wss://staragent.info/ws');
  const travel = reviveTravel({ elapsed: 2, targetId: 'pyre', plan: { kind: 'travel', start: [1, 2, 3], end: [4, 5, 6], direction: [0, 0, -1], duration: 9, distance: 8 } });
  assert.equal(travel.plan.start.isVector3, true);
  assert.deepEqual(travel.plan.end.toArray(), [4, 5, 6]);
  assert.equal(reviveTravel({ elapsed: 1, plan: { kind: 'free', start: { x: 1, y: 2, z: 3 }, direction: { x: 0, y: 0, z: -1 }, duration: null } }).plan.duration, Infinity);
});

test('authoritative reconciliation distinguishes always-rendered hull pose from parked ship ownership', () => {
  const nav = {
    mode: 'flight', position: new THREE.Vector3(), orientation: new THREE.Quaternion(), velocity: new THREE.Vector3(), angularVelocity: new THREE.Vector3(),
    shipPosition: null, shipOrientation: new THREE.Quaternion(), shipVelocity: new THREE.Vector3(), shipAngularVelocity: new THREE.Vector3(), keys: new Set(),
  };
  const peer = {
    mode: 'flight', position: [10, 20, 30], orientation: [0, 0, 0, 1], velocity: [1, 2, 3], angularVelocity: [0, 0, 0],
    shipPosition: [8, 18, 32], parkedShipPosition: null, shipOrientation: [0, 0, 0, 1], shipVelocity: [4, 5, 6], shipAngularVelocity: [0, 0, 0],
    health: 80, travelTarget: 'pyre', travel: null,
  };
  applyAuthoritativePeer(nav, peer, { snap: true });
  assert.equal(nav.shipPosition, null);
  assert.deepEqual(nav.multiplayerShipPosition.toArray(), [8, 18, 32]);
  assert.deepEqual(nav.position.toArray(), [10, 20, 30]);
  assert.equal(nav.travelTarget, 'pyre');
  peer.parkedShipPosition = [7, 8, 9]; peer.health = 0;
  applyAuthoritativePeer(nav, peer, { snap: true });
  assert.deepEqual(nav.shipPosition.toArray(), [7, 8, 9]);
  assert.equal(nav.multiplayerDead, true);
});

test('authoritative frame changes snap across the boundary even when walking mode is unchanged',()=>{
  const nav={mode:'walk',position:new THREE.Vector3(0,2,0),orientation:new THREE.Quaternion(),authoritativePhysicsFrame:'hangar:1'};
  applyAuthoritativePeer(nav,{mode:'walk',position:[3,2,0],physicsFrame:'hangar:2',health:100,shipHealth:100});
  assert.deepEqual(nav.position.toArray(),[3,2,0]);
  assert.equal(nav.authoritativePhysicsFrame,'hangar:2');
  applyAuthoritativePeer(nav,{mode:'walk',position:[4,2,0],physicsFrame:'hangar:2',health:100,shipHealth:100});
  assert.ok(nav.position.x>3&&nav.position.x<4,'same-frame prediction still blends');
});

test('reconciliation retains exact vector blending, quaternion normalization and invalid-field handling', () => {
  for (const blend of [0, .38, 1]) for (const offset of [.125, 100, 100.125]) {
    const nav = {
      mode: 'walk', position: new THREE.Vector3(25_000_000_000, 4, -8),
      orientation: new THREE.Quaternion().setFromEuler(new THREE.Euler(.2, -.3, .1)),
      velocity: new THREE.Vector3(1, 2, 3),
    };
    const snapshot = {
      mode: 'walk', position: [25_000_000_000 + offset, 4, -8], orientation: [.1, -.4, .25, 2],
      velocity: [NaN, 1, 2], angularVelocity: [0, 0, 0], health: 100, shipHealth: 100,
    };
    const retained = { position: nav.position, orientation: nav.orientation, velocity: nav.velocity };
    const expectedPosition = nav.position.clone(), source = new THREE.Vector3().fromArray(snapshot.position);
    if (expectedPosition.distanceToSquared(source) > 10000) expectedPosition.copy(source);
    else expectedPosition.lerp(source, blend);
    const expectedOrientation = nav.orientation.clone().slerp(new THREE.Quaternion().fromArray(snapshot.orientation).normalize(), blend).normalize();
    const before = structuredClone(snapshot);
    applyAuthoritativePeer(nav, snapshot, { blend });
    assert.equal(nav.position, retained.position);
    assert.equal(nav.orientation, retained.orientation);
    assert.equal(nav.velocity, retained.velocity);
    assert.deepEqual(nav.position.toArray(), expectedPosition.toArray());
    assert.deepEqual(nav.orientation.toArray(), expectedOrientation.toArray());
    assert.deepEqual(nav.velocity.toArray(), [1, 2, 3]);
    assert.deepEqual(nav.angularVelocity.toArray(), [0, 0, 0]);
    assert.deepEqual(snapshot, before, 'the authoritative snapshot remains unmodified');
  }
});

test('requests wait for an authoritative acknowledgement and carry exact equip fields', async t => {
  class Socket {
    constructor() { this.readyState = 1; this.sent = []; this.listeners = {}; Socket.instance = this; }
    addEventListener(type, listener) { (this.listeners[type] ??= []).push(listener); }
    send(value) { this.sent.push(JSON.parse(value)); }
    close() { this.readyState = 3; }
    emit(type, value) { for (const listener of this.listeners[type] ?? []) listener(value); }
  }
  const client = new MultiplayerClient({ url: 'ws://test/ws', WebSocketImpl: Socket, requestTimeout: 100 });
  const cleared = [];
  client.remotePlayers = { sync: (...args) => cleared.push(['peers', ...args]) };
  client.station = { setMultiplayerState: value => cleared.push(['station', value]) };
  t.after(() => client.dispose());
  const joining = client.connect({ id: 'account', callsign: 'NOMAD_7' });
  Socket.instance.emit('message', { data: JSON.stringify({ type: 'welcome', id: 'self', seed: 7291, maxPlayers: 10, players: [] }) });
  await joining;
  const pending = client.equip({ weapon: 'rifle-laser' });
  const wire = Socket.instance.sent.at(-1);
  assert.deepEqual(wire, { type: 'request', requestId: '1', action: 'equip', weapon: 'rifle-laser' });
  let settled = false; pending.finally(() => { settled = true; }); await Promise.resolve(); assert.equal(settled, false);
  Socket.instance.emit('message', { data: JSON.stringify({ type: 'ack', requestId: '1', ok: true }) });
  assert.equal((await pending).ok, true);
  client.disconnect();
  assert.deepEqual(cleared.slice(-2), [['peers', [], null], ['station', null]]);
});

test('a destroyed own hull offers recovery even when suit health remains positive',()=>{
  const alive={connected:true,ownId:'self',health:100,players:[{id:'self',shipHealth:100},{id:'other',shipHealth:0}]};
  assert.equal(normalizeMultiplayerState(alive).needsRespawn,false);
  assert.equal(normalizeMultiplayerState({...alive,players:[{id:'self',shipHealth:0}]}).needsRespawn,true);
  assert.equal(normalizeMultiplayerState({...alive,health:0}).needsRespawn,true);
  assert.equal(normalizeMultiplayerState({connected:true,health:null}).needsRespawn,false);
});

test('network travel commands respect the targeted-drive adapter and retain untargeted heading travel',t=>{
 const savedDocument=Object.getOwnPropertyDescriptor(globalThis,'document'),savedWindow=Object.getOwnPropertyDescriptor(globalThis,'window');
 Object.defineProperty(globalThis,'document',{configurable:true,value:new EventTarget()});
 Object.defineProperty(globalThis,'window',{configurable:true,value:new EventTarget()});
 t.after(()=>{if(savedDocument)Object.defineProperty(globalThis,'document',savedDocument);else delete globalThis.document;if(savedWindow)Object.defineProperty(globalThis,'window',savedWindow);else delete globalThis.window;});
 const client=new MultiplayerClient({url:'ws://test/ws'}),sent=[];let gates=0;
 const nav={gamepad:{poll:()=>({})},beginTravel:()=>true,beginFreeTravel:()=>true,cancelTravel:()=>true,targeting:{hasTarget:true,engage(){gates++;return false;}}};
 client.action=action=>{sent.push(action);return true;};client.state.connected=true;client.attach({nav});
 assert.equal(nav.beginTravel(),false);assert.equal(nav.beginFreeTravel(),false);assert.equal(gates,2);assert.deepEqual(sent,[]);
 nav.targeting.hasTarget=false;assert.equal(nav.beginFreeTravel(),true);nav.cancelTravel();assert.deepEqual(sent,['travel','cancelTravel']);
 client.detach();
});


test('authoritative Atlas reconciliation carries real ramp, crew lift and gear state',()=>{
  const source=new FreighterSystems(),nav={freighter:new FreighterSystems(),mode:'walk',position:new THREE.Vector3(),orientation:new THREE.Quaternion(),keys:new Set()};
  source.operate('ramp:aft',null);source.update(1.2);source.setGear(.37,false);
  source.toggleElevator(new THREE.Vector3(5.5,4.35,-4));source.update(.5);
  const snapshot=source.snapshot;
  applyAuthoritativePeer(nav,{mode:'walk',shipId:'atlas',freighter:snapshot,health:100,shipHealth:100},{snap:true});
  assert.deepEqual(nav.freighter.snapshot,snapshot);
  assert.equal(nav.freighter.lifts.length,1);
  assert.equal(nav.freighter.elevator.id,'crew');
  applyAuthoritativePeer(nav,{freighter:[{id:'main',y:0,target:0}]});
  assert.deepEqual(nav.freighter.snapshot,snapshot,'retired elevator arrays cannot reintroduce a platform');
});
