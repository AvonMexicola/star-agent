import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Navigation } from '../src/navigation.js';
import { SHIP_LAYOUT } from '../src/boarding.js';
import { RADIUS } from '../src/world.js';
import { Station, stationQuaternion } from '../src/station.js';

if (!globalThis.ProgressEvent) {
  globalThis.ProgressEvent = class ProgressEvent {
    constructor(type, init = {}) { this.type = type; Object.assign(this, init); }
  };
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

function installDom(t) {
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
  return document;
}

const MODEL_URL = new URL('../public/models/station.glb', import.meta.url);
const STATION_DIRECTION = new THREE.Vector3(.23, .91, .34).normalize();
let modelBytes;

async function loadStationGltf() {
  modelBytes ??= await readFile(MODEL_URL);
  const buffer = modelBytes.buffer.slice(modelBytes.byteOffset, modelBytes.byteOffset + modelBytes.byteLength);
  return new GLTFLoader().parseAsync(buffer, '');
}

async function setupOpening(t) {
  const document = installDom(t);
  const radial = stationQuaternion(STATION_DIRECTION, new THREE.Quaternion());
  const orientation = radial.multiply(
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), THREE.MathUtils.degToRad(20)),
  ).normalize();
  const station = new Station(new THREE.Scene(), {
    gltf: await loadStationGltf(), lodUrl: null, direction: STATION_DIRECTION, orientation,
  });
  await station.readyPromise;
  t.after(() => station.dispose());
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
  const step = (dt = 1 / 60) => {
    station.update(navigation.position, navigation.position, new THREE.Vector3(1, 0, 0), dt);
    navigation.update(dt);
  };
  const advance = seconds => {
    for (let frame = 0; frame < Math.ceil(seconds * 60); frame++) step();
  };
  const until = (predicate, seconds, description) => {
    let frame = 0;
    while (!predicate() && frame++ < Math.ceil(seconds * 60)) step();
    assert.ok(predicate(), `${description} within ${seconds}s; ship local=${navigation.toShipLocal()?.toArray()}`);
  };
  const moveUntil = (code, predicate, seconds, description) => {
    keyDown(code);
    until(predicate, seconds, description);
    keyUp(code);
    press('KeyX');
  };
  return { navigation, station, notices, keyDown, keyUp, press, step, advance, until, moveUntil };
}

const near = (actual, expected, tolerance = 1e-6) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
const nearVector = (actual, expected, tolerance = 1e-6) =>
  assert.ok(actual.distanceTo(expected) <= tolerance, `${actual.toArray()} != ${expected.toArray()}`);

test('normal Navigation construction retains the existing orbital start', t => {
  installDom(t);
  const navigation = new Navigation(new EventSurface(), () => {});
  near(navigation.position.length(), RADIUS * 2.8, 1e-8);
  assert.equal(navigation.mode, 'flight');
  assert.equal(navigation.dockedAtStation, false);
  assert.equal(navigation.shipPosition, null);
  assert.equal(Boolean(navigation.openingActive), false);
});

test('station opening spawn remains gated, then supports a physical board and launch journey', async t => {
  const { navigation, station, press, keyDown, keyUp, step, advance, until, moveUntil } = await setupOpening(t);
  const radialUp = STATION_DIRECTION;
  assert.ok(station.up.distanceTo(radialUp) > .1, 'fixture uses the supplied non-radial station orientation');

  navigation.startStation();
  station.beginOpening();
  const spawn = navigation.position.clone();
  const spawnLocal = navigation.toShipLocal();
  assert.equal(navigation.mode, 'walk');
  assert.equal(navigation.dockedAtStation, true);
  assert.equal(navigation.insideShip, false);
  assert.equal(navigation.doorOpen, false);
  assert.equal(navigation.doorProgress, 0);
  nearVector(navigation.shipPosition, station.padWorldPosition, 1e-8);
  near(navigation.deckClearance, SHIP_LAYOUT.eyeHeight, 1e-8);
  assert.equal(station.isInsideHangar(navigation.position), true);
  assert.ok(Math.abs(spawnLocal.x) > SHIP_LAYOUT.interior.maxX && spawnLocal.z < SHIP_LAYOUT.interior.minZ,
    'character starts on deck outside the forward side of the cabin');
  const shipNose = new THREE.Vector3(0, 0, -1).applyQuaternion(navigation.shipOrientation);
  const towardDoors = station.doorTriggerWorldPosition.clone().sub(navigation.shipPosition).normalize();
  assert.ok(shipNose.dot(towardDoors) > .99, 'parked ship nose points toward the hangar doors');

  navigation.openingActive = true;
  navigation.onOpeningKey = event => event.preventDefault();
  keyDown('KeyD');
  for (let frame = 0; frame < 120; frame++) step();
  keyUp('KeyD');
  assert.ok(navigation.position.equals(spawn), 'movement input cannot move Navigation during the opening');
  assert.equal(navigation.velocity.length(), 0);

  station.setOpeningProgress(1);
  station.endOpening();
  navigation.openingActive = false;
  navigation.onOpeningKey = null;
  // Walk around the complete parked-ship envelope before approaching its aft hatch.
  moveUntil('KeyD', () => navigation.toShipLocal().x > SHIP_LAYOUT.flightBounds.max[0] + .5,
    3, 'walk clears the starboard wing');
  moveUntil('KeyS', () => navigation.toShipLocal().z > SHIP_LAYOUT.flightBounds.max[2] + 1,
    5, 'walk reaches the aft side outside the ship');
  assert.ok(navigation.toShipLocal().x > SHIP_LAYOUT.flightBounds.max[0], 'aft walk stayed outside the ship envelope');
  moveUntil('KeyA', () => navigation.toShipLocal().x < .2, 3, 'walk reaches the rear hatch centreline');
  assert.match(navigation.interaction, /OPEN HATCH/);
  assert.equal(navigation.insideShip, false);
  near(navigation.deckClearance, SHIP_LAYOUT.eyeHeight, 1e-5);

  press('KeyF');
  assert.equal(navigation.doorOpen, true);
  advance(1.2);
  near(navigation.doorProgress, 1, 1e-6);
  moveUntil('KeyW', () => navigation.toShipLocal().z < 3.2, 3, 'walk crosses the deployed ramp into the cabin');
  assert.equal(navigation.insideShip, true);
  assert.match(navigation.interaction, /CLOSE HATCH/);
  press('KeyF');
  assert.equal(navigation.doorOpen, false);
  advance(1.2);
  near(navigation.doorProgress, 0, 1e-6);

  moveUntil('KeyW', () => navigation.toShipLocal().z < -1.35, 3, 'walk reaches the pilot chair');
  assert.match(navigation.interaction, /PILOT CHAIR/);
  press('KeyF');
  assert.equal(navigation.mode, 'landed');
  nearVector(navigation.toShipLocal(), new THREE.Vector3(...SHIP_LAYOUT.seatEye), 1e-8);

  press('KeyL');
  assert.equal(navigation.mode, 'flight');
  assert.equal(navigation.dockedAtStation, false);
  assert.equal(navigation.stationLift, true);
  assert.equal(navigation.shipPosition, null);
  until(() => !navigation.stationLift, 3, 'undocking lift reaches safe deck clearance');
  assert.ok(navigation.deckClearance >= 6 - .05);

  const openingZ = station.openingZ;
  keyDown('KeyW');
  until(() => navigation.stationLocal.z < openingZ - 8, 15, 'ordinary thrust flies through the open hangar doors');
  keyUp('KeyW');
  assert.equal(navigation.mode, 'flight');
  assert.equal(navigation.stationLift, false);
  assert.ok(navigation.stationLocal.z < openingZ);
});
