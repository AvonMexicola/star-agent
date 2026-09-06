import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Station } from '../src/station.js';
import { Navigation } from '../src/navigation.js';
import { SHIP_LAYOUT } from '../src/boarding.js';
import { FREIGHTER_LAYOUT, FreighterSystems } from '../src/freighter-layout.js';

if (!globalThis.ProgressEvent) {
  globalThis.ProgressEvent = class ProgressEvent {
    constructor(type, init = {}) { this.type = type; Object.assign(this, init); }
  };
}

const MODEL_URL = new URL('../public/models/station.glb', import.meta.url);
const FIXED_DIRECTION = new THREE.Vector3(0.23, 0.91, 0.34).normalize();
const EPSILON = 1e-5;
let modelBytes;

async function loadStationGltf() {
  modelBytes ??= await readFile(MODEL_URL);
  const arrayBuffer = modelBytes.buffer.slice(modelBytes.byteOffset, modelBytes.byteOffset + modelBytes.byteLength);
  return new GLTFLoader().parseAsync(arrayBuffer, '');
}

async function createStation() {
  const scene = new THREE.Scene();
  const gltf = await loadStationGltf();
  const station = new Station(scene, { gltf, lodUrl: null, direction: FIXED_DIRECTION });
  await station.readyPromise;
  return { gltf, scene, station };
}

function localToWorld(station, x, y, z) {
  return station.toWorld(new THREE.Vector3(x, y, z), new THREE.Vector3());
}

function worldToLocal(station, point) {
  return station.toLocal(point, new THREE.Vector3());
}

function near(actual, expected, tolerance = EPSILON, description = 'value') {
  assert.ok(Math.abs(actual - expected) <= tolerance,
    `${description}: ${actual} differs from ${expected} by more than ${tolerance}`);
}

function nearVector(actual, expected, tolerance = EPSILON, description = 'vector') {
  for (let axis = 0; axis < 3; axis++) {
    near(actual.getComponent(axis), expected.getComponent(axis), tolerance, `${description} axis ${axis}`);
  }
}

class EventSurface {
  constructor() { this.listeners = new Map(); }
  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(listener);
  }
  dispatch(type, event = {}) {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
}

function setupNavigation(t, station) {
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const document = new EventSurface();
  document.querySelector = () => null;
  document.body = { classList: { toggle() {} } };
  Object.defineProperty(globalThis, 'document', { configurable: true, value: document });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: new EventSurface() });
  t.after(() => {
    if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument);
    else delete globalThis.document;
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
    else delete globalThis.window;
  });

  const canvas = new EventSurface();
  canvas.requestPointerLock = async () => {
    document.pointerLockElement = canvas;
    document.dispatch('pointerlockchange');
  };
  const notices = [];
  const navigation = new Navigation(canvas, message => notices.push(message));
  navigation.station = station;
  const keyDown = code => document.dispatch('keydown', { code, repeat: false, preventDefault() {} });
  const keyUp = code => document.dispatch('keyup', { code });
  const press = code => { keyDown(code); keyUp(code); };
  const advance = (seconds, check = () => {}) => {
    for (let frame = 0; frame < Math.ceil(seconds * 60); frame++) {
      navigation.update(1 / 60);
      check();
    }
  };
  const advanceUntil = (predicate, seconds, description) => {
    let frames = 0;
    while (!predicate() && frames++ < Math.ceil(seconds * 60)) navigation.update(1 / 60);
    assert.ok(predicate(), `${description} within ${seconds} seconds`);
  };
  const walkUntil = (code, predicate, seconds = 20) => {
    keyDown(code);
    let frames = 0;
    while (!predicate() && frames++ < Math.ceil(seconds * 60)) navigation.update(1 / 60);
    keyUp(code);
    assert.ok(predicate(), `walking ${code} reached its target within ${seconds} seconds; ship local ${navigation.toShipLocal()?.toArray()}`);
  };
  return { navigation, notices, press, keyDown, keyUp, advance, advanceUntil, walkUntil };
}

test('the production station asset retains its authored deck, bay, anchors and door animation', async t => {
  const { gltf, station } = await createStation();
  t.after(() => station.dispose());
  const model = gltf.scene;
  model.updateMatrixWorld(true);

  const fullSize = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
  nearVector(fullSize, new THREE.Vector3(149.9, 39.45, 89.6), 0.02, 'full station dimensions');

  const deck = model.getObjectByName('LandingDeck');
  assert.ok(deck?.isMesh, 'the production GLB has a mesh named LandingDeck');
  const deckBox = new THREE.Box3().setFromObject(deck);
  nearVector(deckBox.getSize(new THREE.Vector3()), new THREE.Vector3(42, 0.4, 48), 0.001, 'landing deck dimensions');
  near(deckBox.max.y, -8, 0.001, 'deck surface height');

  nearVector(station.interiorBox.getSize(new THREE.Vector3()), new THREE.Vector3(42, 15.65, 48), 0.01,
    'clear hangar dimensions derived from the GLB');
  nearVector(station.padLocal, new THREE.Vector3(0, -8, 2), 0.001, 'landing pad anchor');
  nearVector(station.approachLocal, new THREE.Vector3(0, -4.8, -112), 0.001, 'approach anchor');
  nearVector(station.triggerLocal, new THREE.Vector3(0, -4.8, -272), 0.001, 'door trigger anchor');

  const doorClip = THREE.AnimationClip.findByName(gltf.animations, 'DoorsOpen');
  assert.ok(doorClip, 'the production GLB contains DoorsOpen');
  near(doorClip.duration, 5.0416665, 0.001, 'door animation duration');
  assert.deepEqual(doorClip.tracks.map(track => track.name).sort(),
    ['HangarDoor_L.position', 'HangarDoor_R.position']);

  const sample = localToWorld(station, 7.25, -3.5, 11.75);
  nearVector(worldToLocal(station, sample), new THREE.Vector3(7.25, -3.5, 11.75), 1e-8,
    'double precision station round trip');
  const supported = station.deckPoint(sample, SHIP_LAYOUT.eyeHeight);
  near(worldToLocal(station, supported).y, deckBox.max.y + SHIP_LAYOUT.eyeHeight, 1e-8,
    'deckPoint uses the authored deck surface');
  assert.equal(station.deckPoint(localToWorld(station, 21, -3.5, 0), SHIP_LAYOUT.eyeHeight), null,
    'walking support stops short of the physical side wall');
});

test('closed doors stop a swept ship while fully open doors admit it into the bay', async t => {
  const { station } = await createStation();
  t.after(() => station.dispose());
  const deckY = station.interiorBox.min.y;
  const eyeY = deckY + 3.2;
  const start = localToWorld(station, 0, eyeY, -60);
  const end = localToWorld(station, 0, eyeY, station.padLocal.z);
  const orientation = station.padQuaternion.clone();
  const startCopy = start.clone(), endCopy = end.clone(), orientationCopy = orientation.clone();

  const sealed = station.constrainStep(start, end, orientation);
  assert.equal(sealed.hit, true, 'closed doors intercept the complete ship envelope');
  assert.ok(worldToLocal(station, sealed.point).z < station.openingZ,
    'the cockpit is stopped outside the doorway when the rear of the ship reaches the doors');
  nearVector(start, startCopy, 0, 'sweep start is not mutated');
  nearVector(end, endCopy, 0, 'sweep end is not mutated');
  assert.ok(orientation.equals(orientationCopy), 'sweep orientation is not mutated');

  station.openDoors();
  station.update(station.doorTriggerWorldPosition, station.worldPosition, new THREE.Vector3(1, 0, 0), 6);
  near(station.doorsOpen, 1, EPSILON, 'door openness');
  const admitted = station.constrainStep(start, end, orientation);
  assert.equal(admitted.hit, false, 'the authored opening clears the full flight bounds');
  nearVector(admitted.point, end, 1e-8, 'open-door traversal reaches the landing bay');

  station.closeDoors();
  const farFromTrigger = station.doorTriggerWorldPosition.clone().addScaledVector(station.up, 2_000);
  station.update(farFromTrigger, station.worldPosition, new THREE.Vector3(1, 0, 0), 6);
  near(station.doorsOpen, 0, EPSILON, 'closed door openness');
  assert.equal(station.constrainStep(start, end, orientation).hit, true, 'closing restores the doorway collision');
});

test('swept station collision catches high-speed ships and walking capsules at the bay boundary', async t => {
  const { station } = await createStation();
  t.after(() => station.dispose());
  const deckY = station.interiorBox.min.y;
  const orientation = station.padQuaternion.clone();

  const flightStart = localToWorld(station, 0, deckY + 3.2, 0);
  const flightEnd = localToWorld(station, 0, deckY + 3.2, 10_000);
  const flightHit = station.constrainStep(flightStart, flightEnd, orientation);
  assert.equal(flightHit.hit, true, 'a 10 km step cannot tunnel through the rear of the station');
  const stoppedShip = worldToLocal(station, flightHit.point);
  assert.ok(stoppedShip.z < station.interiorBox.max.z,
    `ship remains before the back wall (${stoppedShip.z} < ${station.interiorBox.max.z})`);

  const walkerStart = localToWorld(station, 0, deckY + SHIP_LAYOUT.eyeHeight, 8);
  const walkerEnd = localToWorld(station, 1_000, deckY + SHIP_LAYOUT.eyeHeight, 8);
  const walkingHit = station.constrainStep(walkerStart, walkerEnd, station.quaternion, true);
  assert.equal(walkingHit.hit, true, 'a walking capsule cannot cross the side wall in one update');
  const stoppedWalker = worldToLocal(station, walkingHit.point);
  assert.ok(stoppedWalker.x <= station.interiorBox.max.x - SHIP_LAYOUT.capsuleRadius + 0.02,
    'walking collision retains capsule clearance from the wall');
  near(stoppedWalker.y, deckY + SHIP_LAYOUT.eyeHeight, 1e-8, 'walking collision preserves eye height');
});

test('L docks in the bay, then the cabin, hatch, ramp, deck, return and launch remain physical', async t => {
  const { station } = await createStation();
  t.after(() => station.dispose());
  const { navigation, press, advance, advanceUntil, walkUntil } = setupNavigation(t, station);
  const deckY = station.interiorBox.min.y;

  navigation.position.copy(localToWorld(station, station.padLocal.x, deckY + 6, station.padLocal.z));
  navigation.orientation.copy(station.padQuaternion);
  navigation.velocity.set(0, 0, 0);
  navigation.mode = 'flight';
  assert.equal(station.canDock(navigation.position), true, 'fixture starts over the central landing pad');
  press('KeyL');
  assert.equal(navigation.autoland, true, 'L engages docking assist inside the bay');
  advanceUntil(() => navigation.mode === 'landed', 8, 'docking assist settles on the deck');
  assert.equal(navigation.dockedAtStation, true);
  assert.equal(navigation.autoland, false);
  near(navigation.deckClearance, SHIP_LAYOUT.seatEye[1], 1e-6, 'pilot eye height after docking');
  nearVector(navigation.toShipLocal(), new THREE.Vector3(...SHIP_LAYOUT.seatEye), 1e-6, 'docked pilot position');
  const parkedShip = navigation.shipPosition.clone();

  press('KeyF');
  assert.equal(navigation.mode, 'walk');
  assert.equal(navigation.insideShip, true);
  nearVector(navigation.toShipLocal(), new THREE.Vector3(...SHIP_LAYOUT.stand), 1e-6, 'standing cabin position');
  walkUntil('KeyW', () => navigation.toShipLocal().z >= 2.3);
  press('KeyF');
  assert.equal(navigation.doorOpen, true, 'F opens the ship hatch');
  advance(1.2);
  near(navigation.doorProgress, 1, 1e-6, 'ship hatch and ramp animation');
  walkUntil('KeyW', () => navigation.toShipLocal().z > SHIP_LAYOUT.ramp.maxZ + 0.5);
  assert.equal(navigation.insideShip, false, 'walking crossed the hatch and complete ramp');
  assert.ok(navigation.shipPosition.equals(parkedShip), 'walking leaves the docked ship fixed on its pad');
  assert.equal(station.isInsideHangar(navigation.position), true, 'walker is physically on the hangar deck');
  near(navigation.deckClearance, SHIP_LAYOUT.eyeHeight, 1e-5, 'station deck supports the walker');

  walkUntil('KeyS', () => navigation.toShipLocal().z <= 2);
  assert.equal(navigation.insideShip, true, 'walking back up the ramp re-enters the cabin');
  press('KeyF');
  assert.equal(navigation.doorOpen, false, 'hatch closes only after returning inside');
  walkUntil('KeyS', () => navigation.toShipLocal().z <= -1.3);
  press('KeyF');
  assert.equal(navigation.mode, 'landed', 'F at the chair sits down');
  nearVector(navigation.toShipLocal(), new THREE.Vector3(...SHIP_LAYOUT.seatEye), 1e-6, 'returned pilot position');

  press('KeyL');
  assert.equal(navigation.mode, 'flight');
  assert.equal(navigation.dockedAtStation, false);
  assert.equal(navigation.stationLift, true, 'launch begins with controlled vertical clearance');
  assert.equal(navigation.shipPosition, null);
  advanceUntil(() => !navigation.stationLift, 3, 'launch reaches safe bay clearance');
  assert.ok(navigation.deckClearance >= 6 - 0.05, 'launch stops its vertical lift below the ceiling');
  assert.ok(navigation.stationLocal.y < station.interiorBox.max.y, 'launch remains inside the hangar clear volume');
});

test('Atlas docks at its own eye height, carries a rider to the hangar deck and interlocks launch', async t => {
  const {station}=await createStation();t.after(()=>station.dispose());
  const {navigation:nav,press,advance,advanceUntil,walkUntil}=setupNavigation(t,station);
  nav.shipId='atlas';nav.layout=FREIGHTER_LAYOUT;nav.freighter=new FreighterSystems();
  const centre=station.interiorBox.getCenter(new THREE.Vector3());
  nav.position.copy(localToWorld(station,centre.x,station.interiorBox.min.y+7,centre.z+FREIGHTER_LAYOUT.seatEye[2]));
  nav.orientation.copy(station.quaternion);
  press('KeyL');advance(8);assert.equal(nav.mode,'landed',JSON.stringify({canDock:nav.canDock,clearance:nav.deckClearance,local:nav.stationLocal.toArray(),box:station.interiorBox,autoland:nav.autoland}));
  near(nav.deckClearance,5.55);press('KeyF');
  walkUntil('KeyW',()=>nav.toShipLocal().z>.8);press('KeyF');
  advanceUntil(()=>nav.freighter.lifts[0].y===0,7,'main lift lowers');
  near(nav.toShipLocal().y,1.75);walkUntil('KeyW',()=>nav.toShipLocal().z>10.5);
  assert.equal(nav.insideShip,false);near(nav.deckClearance,1.75);
  walkUntil('KeyS',()=>nav.toShipLocal().z<1.2);press('KeyF');
  advanceUntil(()=>nav.freighter.lifts[0].y===4,7,'main lift raises rider');near(nav.toShipLocal().y,5.75);
  walkUntil('KeyS',()=>nav.toShipLocal().z<-9);press('KeyF');assert.equal(nav.mode,'landed');
  nav.freighter.toggle('port');press('KeyL');assert.equal(nav.mode,'landed','cannot launch with moving cargo lift');
  advance(6);press('KeyL');assert.equal(nav.mode,'landed','cannot launch with raised cargo lift');
  nav.freighter.toggle('port');advance(6);press('KeyL');assert.equal(nav.mode,'flight');
  advanceUntil(()=>!nav.stationLift,3,'Atlas lifts clear of deck');
  assert.ok(nav.deckClearance>=6.5);assert.ok(nav.deckClearance+9.8-5.55<station.interiorBox.max.y-station.interiorBox.min.y);
});
