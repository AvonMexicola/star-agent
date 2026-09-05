import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Navigation } from '../src/navigation.js';
import { RADIUS, terrainHeight, findDestinations, latLonDirection } from '../src/world.js';
import { SHIP_LAYOUT } from '../src/boarding.js';

class EventSurface {
  constructor() { this.listeners = new Map(); }
  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(listener);
  }
  dispatch(type, event = {}) {
    for (const listener of this.listeners.get(type) || []) listener(event);
  }
}

function setup(t) {
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
  const keyDown = code => document.dispatch('keydown', { code, repeat: false, preventDefault() {} });
  const keyUp = code => document.dispatch('keyup', { code });
  const press = code => { keyDown(code); keyUp(code); };
  const advance = (seconds, check = () => {}) => {
    for (let frame = 0; frame < Math.round(seconds * 60); frame++) {
      navigation.update(1 / 60);
      check();
    }
  };
  const walkUntil = (code, predicate, check = () => {}) => {
    keyDown(code);
    let frames = 0;
    while (!predicate() && frames++ < 1200) {
      navigation.update(1 / 60);
      check();
    }
    keyUp(code);
    assert.ok(predicate(), `walking ${code} reached its target within 20 seconds; local=${navigation.toShipLocal()?.toArray()}`);
  };
  return { navigation, notices, press, keyDown, keyUp, advance, walkUntil };
}

const destinations = findDestinations();
const near = (actual, expected, tolerance = 1e-6) => {
  assert.ok(Math.abs(actual - expected) < tolerance, `${actual} should be within ${tolerance} of ${expected}`);
};

test('coast landing, physical cabin and hatch traversal, return to chair and launch work together', t => {
  const { navigation, press, advance, walkUntil } = setup(t);
  navigation.transit(destinations.coast, 100);
  press('KeyL');
  assert.equal(navigation.autoland, true);
  advance(20);
  assert.equal(navigation.mode, 'landed');
  assert.equal(navigation.autoland, false);
  navigation.toShipLocal().toArray().forEach((value, axis) => near(value, SHIP_LAYOUT.seatEye[axis]));
  near(navigation.speed, 0);
  const shipPosition = navigation.shipPosition.clone();

  press('KeyF');
  assert.equal(navigation.mode, 'walk');
  assert.equal(navigation.insideShip, true);
  navigation.toShipLocal().toArray().forEach((value, axis) => near(value, SHIP_LAYOUT.stand[axis]));
  const localForward = new THREE.Vector3(0, 0, -1).applyQuaternion(navigation.orientation)
    .applyQuaternion(navigation.shipOrientation.clone().invert());
  assert.ok(localForward.z > 0.999, 'standing faces aft toward the hatch');
  walkUntil('KeyW', () => navigation.toShipLocal().z >= 2.3, () => near(navigation.toShipLocal().y, 2.75));
  press('KeyF');
  assert.equal(navigation.doorOpen, true);
  advance(1.2);
  near(navigation.doorProgress, 1);
  walkUntil('KeyW', () => navigation.toShipLocal().z > 8);
  assert.equal(navigation.insideShip, false);
  near(navigation.altitude, 1.75);
  assert.ok(navigation.shipPosition.equals(shipPosition), 'parked ship stays in place');
  const outsidePosition = navigation.position.clone();
  press('KeyF');
  assert.equal(navigation.mode, 'walk', 'F outside does not teleport into the ship');
  assert.ok(navigation.position.equals(outsidePosition));
  press('KeyL');
  assert.equal(navigation.mode, 'walk', 'launch is unavailable on foot');

  walkUntil('KeyS', () => navigation.toShipLocal().z <= 2);
  assert.equal(navigation.insideShip, true);
  near(navigation.toShipLocal().y, 2.75);
  press('KeyF');
  assert.equal(navigation.doorOpen, false, 'hatch can close after stepping into the cabin');
  walkUntil('KeyS', () => navigation.toShipLocal().z <= -1.3);
  press('KeyF');
  assert.equal(navigation.mode, 'landed');
  navigation.toShipLocal().toArray().forEach((value, axis) => near(value, SHIP_LAYOUT.seatEye[axis]));
  press('KeyL');
  assert.equal(navigation.mode, 'flight');
  assert.equal(navigation.shipPosition, null);
  assert.ok(navigation.velocity.dot(navigation.normal) > 0, 'launch velocity points away from ground');
  assert.ok(navigation.altitude > 10);
});

test('polar landing and walking use sea-level ice above submerged terrain', t => {
  const { navigation, press, keyDown, keyUp, advance, walkUntil } = setup(t);
  // The featured polar destination may be an elevated glacier on a new seed.
  // Find sea-level polar ice explicitly so this still exercises the hover floor.
  let submerged;
  for (let longitude = -180; longitude < 180 && !submerged; longitude += 5) {
    const direction = latLonDirection(77, longitude);
    if (terrainHeight(...direction) < -20) submerged = direction;
  }
  assert.ok(submerged, 'fixture exercises submerged polar terrain');
  navigation.transit(submerged, 100);
  press('KeyL');
  assert.equal(navigation.autoland, true);
  advance(20);
  assert.equal(navigation.mode, 'landed');
  near(navigation.shipPosition.length(), RADIUS);
  navigation.toShipLocal().toArray().forEach((value, axis) => near(value, SHIP_LAYOUT.seatEye[axis]));
  assert.ok(navigation.position.length() > RADIUS + 2.5);
  press('KeyF');
  assert.equal(navigation.mode, 'walk');
  walkUntil('KeyW', () => navigation.toShipLocal().z >= 2.3);
  press('KeyF');
  advance(1.2);
  walkUntil('KeyW', () => navigation.toShipLocal().z > 8);
  assert.equal(navigation.insideShip, false);
  keyDown('KeyW');
  advance(2, () => near(navigation.position.length(), RADIUS + 1.75));
  keyUp('KeyW');
});

test('walking cannot pass through a closed hatch or either cabin side wall', t => {
  const { navigation, press, keyDown, keyUp, advance } = setup(t);
  navigation.transit(destinations.coast, 100);
  press('KeyL');
  advance(20);
  press('KeyF');
  keyDown('KeyW');
  advance(4);
  keyUp('KeyW');
  assert.equal(navigation.doorOpen, false);
  assert.ok(navigation.toShipLocal().z <= 3.75 + 1e-6, 'closed rear door stops the walking capsule');
  assert.ok(navigation.toShipLocal().z > 3.5, 'walker reached the rear door');
  for (const key of ['KeyD', 'KeyA']) {
    keyDown(key);
    advance(4);
    keyUp(key);
    assert.ok(Math.abs(navigation.toShipLocal().x) <= 1.4 + 1e-6, 'side wall includes capsule clearance');
    assert.ok(Math.abs(navigation.toShipLocal().x) > 1.2, 'walker reached a side wall');
    assert.equal(navigation.insideShip, true);
    near(navigation.toShipLocal().y, 2.75);
  }
});

test('open ocean rejects landing assistance and disembarking', t => {
  const { navigation, press, advance } = setup(t);
  let ocean;
  for (let latitude = -40; latitude <= 40 && !ocean; latitude += 10) {
    for (let longitude = -180; longitude < 180; longitude += 10) {
      const direction = latLonDirection(latitude, longitude);
      if (terrainHeight(...direction) < -100) { ocean = direction; break; }
    }
  }
  assert.ok(ocean, 'planet has open ocean away from polar caps');
  navigation.transit(ocean, 100);
  press('KeyL');
  assert.equal(navigation.autoland, false);
  advance(20);
  assert.equal(navigation.mode, 'flight');
  near(navigation.altitude, 100);
  press('KeyF');
  assert.equal(navigation.mode, 'flight');
});

test('high-speed downward travel collides with the near surface without tunnelling through the planet', t => {
  const { navigation } = setup(t);
  const normal = new THREE.Vector3(...destinations.coast);
  navigation.transit(destinations.coast, 1000);
  // The maximum supported cruise, speed multiplier and boost can reach 224 Mm/s.
  // At 60 Hz this would travel farther than the planet diameter in one frame.
  navigation.velocity.copy(normal).multiplyScalar(-4_000_000 * 8 * 7);
  navigation.update(1 / 60);
  assert.equal(navigation.mode, 'landed');
  navigation.toShipLocal().toArray().forEach((value, axis) => near(value, SHIP_LAYOUT.seatEye[axis]));
  assert.ok(navigation.normal.dot(normal) > 0.999999, 'collision remains on the approach hemisphere');
  assert.ok(navigation.position.length() >= RADIUS);
  near(navigation.speed, 0);
});
