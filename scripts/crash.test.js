import { GEAR_FLIGHT } from '../src/gear-flight.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Navigation } from '../src/navigation.js';
import { CRASH_LIMITS, assessImpact, terrainSurfaceNormal } from '../src/impact.js';
import { FLIGHT, step as stepFlight } from '../src/flight-model.js';
import { RADIUS, findDestinations, latLonDirection, terrainHeight } from '../src/world.js';

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
  const notices = [];
  const navigation = new Navigation(canvas, message => notices.push(message));
  const keyDown = code => document.dispatch('keydown', { code, repeat: false, preventDefault() {} });
  const keyUp = code => document.dispatch('keyup', { code });
  const press = code => { keyDown(code); keyUp(code); };
  return { navigation, notices, keyDown, keyUp, press };
}

const destinations = findDestinations();
const near = (actual, expected, tolerance = 1e-8) => {
  assert.ok(Math.abs(actual - expected) <= tolerance,
    `${actual} should be within ${tolerance} of ${expected}`);
};

function surfacePoint(position, east, north, eastOffset, northOffset) {
  const direction = position.clone()
    .addScaledVector(east, eastOffset)
    .addScaledVector(north, northOffset)
    .normalize();
  return direction.multiplyScalar(RADIUS + Math.max(0, terrainHeight(...direction.toArray())));
}

function stageImpact(navigation, direction, speed, clearance = 3.25) {
  navigation.transit(direction, clearance);
  navigation.flightAssist = false;
  navigation.angularVelocity.set(0, 0, 0);
  const normal = terrainSurfaceNormal(navigation.position);
  navigation.velocity.copy(normal).multiplyScalar(-speed);
  return normal;
}

function findOceanDirection() {
  for (let latitude = -40; latitude <= 40; latitude += 10) {
    for (let longitude = -180; longitude < 180; longitude += 10) {
      const direction = latLonDirection(latitude, longitude);
      if (terrainHeight(...direction) < -100) return direction;
    }
  }
  return null;
}

function findSeaIceDirection() {
  for (let longitude = -180; longitude < 180; longitude += 5) {
    const direction = latLonDirection(77, longitude);
    if (terrainHeight(...direction) < -20) return direction;
  }
  return null;
}

test('impact threshold uses closing normal speed rather than tangential or receding speed', () => {
  assert.equal(CRASH_LIMITS.groundSpeed, 12);
  const normal = new THREE.Vector3(0, 1, 0);

  const soft = assessImpact(new THREE.Vector3(30, -11.999, 40), normal);
  assert.equal(soft.crashed, false);
  near(soft.impactSpeed, 11.999);
  near(soft.totalSpeed, Math.hypot(30, 11.999, 40));

  const threshold = assessImpact(new THREE.Vector3(30, -12, 40), normal, 'ice');
  assert.equal(threshold.crashed, true, 'the documented threshold is inclusive');
  near(threshold.impactSpeed, 12);
  assert.equal(threshold.surface, 'ice');

  const tangent = assessImpact(new THREE.Vector3(3000, 0, -4000), normal);
  assert.equal(tangent.crashed, false);
  near(tangent.impactSpeed, 0);
  near(tangent.totalSpeed, 5000);

  const receding = assessImpact(new THREE.Vector3(0, 80, 0), normal);
  assert.equal(receding.crashed, false);
  near(receding.impactSpeed, 0);
});

test('terrain normal is deterministic and follows the shared terrain floor slope', () => {
  // This fixed mountainside is steep enough that a radial-only normal cannot pass.
  const radial = new THREE.Vector3(...latLonDirection(-46, -47));
  const position = radial.clone().multiplyScalar(RADIUS + Math.max(0, terrainHeight(...radial.toArray())));
  const pole = Math.abs(radial.y) < .9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const east = new THREE.Vector3().crossVectors(pole, radial).normalize();
  const north = new THREE.Vector3().crossVectors(radial, east).normalize();
  const eastSweep = surfacePoint(position, east, north, 1, 0)
    .sub(surfacePoint(position, east, north, -1, 0));
  const northSweep = surfacePoint(position, east, north, 0, 1)
    .sub(surfacePoint(position, east, north, 0, -1));
  const expected = new THREE.Vector3().crossVectors(eastSweep, northSweep).normalize();
  if (expected.dot(radial) < 0) expected.negate();

  const first = terrainSurfaceNormal(position);
  const second = terrainSurfaceNormal(position.clone());
  near(first.length(), 1);
  assert.deepEqual(first.toArray(), second.toArray());
  assert.ok(first.dot(expected) > 1 - 1e-12, 'normal agrees with metre-scale shared-height tangents');
  assert.ok(first.dot(radial) < .5, 'fixture proves the terrain slope, rather than accepting a radial normal');
});

test('real inertial contact touches down softly and crashes at hard terrain speed', t => {
  const { navigation } = setup(t);

  stageImpact(navigation, destinations.forest, 6);
  navigation.update(1 / 60);
  assert.equal(navigation.mode, 'flight', 'soft contact holds conservative clearance while the gear deploys');
  assert.equal(navigation.autoland, true);
  assert.ok(navigation.gearProgress < 1);
  near(navigation.velocity.length(), 0);
  for (let frame = 0; frame < (GEAR_FLIGHT.seconds + .3) * 60; frame++) navigation.update(1 / 60);
  assert.equal(navigation.mode, 'landed');
  assert.equal(navigation.crash, null);
  near(navigation.velocity.length(), 0);

  const normal = stageImpact(navigation, destinations.forest, 20);
  const predictedVelocity = stepFlight(navigation, {
    assist: false,
    translation: new THREE.Vector3(),
    rotation: new THREE.Vector3(),
    boost: false,
    maxSpeed: FLIGHT.travelSpeed,
  }, navigation.flightEnvironment, 1 / 60).velocity;
  const events = [];
  const crashAt = navigation.crashAt.bind(navigation);
  navigation.crashAt = (impact, contactNormal) => {
    events.push({ impact: { ...impact }, normal: contactNormal.clone() });
    return crashAt(impact, contactNormal);
  };
  navigation.update(1 / 60);

  assert.equal(navigation.mode, 'crashed');
  assert.equal(events.length, 1, 'hard contact emits one terminal event');
  assert.equal(navigation.crash.surface, 'terrain');
  assert.ok(navigation.crash.impactSpeed >= CRASH_LIMITS.groundSpeed);
  near(navigation.crash.impactSpeed,
    assessImpact(predictedVelocity, events[0].normal).impactSpeed, 1e-8);
  near(navigation.crash.totalSpeed, predictedVelocity.length(), 1e-8);
  assert.ok(events[0].normal.dot(normal) > .999, 'contact uses the local terrain normal');
  near(navigation.velocity.length(), 0);
  near(navigation.angularVelocity.length(), 0);
  assert.deepEqual(navigation.crash.position, navigation.position.toArray());
  assert.deepEqual(navigation.crash.normal, events[0].normal.toArray());
  navigation.update(1 / 60);
  assert.equal(events.length, 1, 'latched crash does not emit again on later frames');
});

test('hard ground contacts classify terrain, polar ice and open water', t => {
  const { navigation } = setup(t);
  const seaIce = findSeaIceDirection();
  const ocean = findOceanDirection();
  assert.ok(seaIce, 'fixture includes submerged polar ice');
  assert.ok(ocean, 'fixture includes open ocean');

  for (const [surface, direction] of [
    ['terrain', destinations.forest],
    ['ice', seaIce],
    ['water', ocean],
  ]) {
    stageImpact(navigation, direction, 25);
    navigation.update(1 / 60);
    assert.equal(navigation.mode, 'crashed');
    assert.equal(navigation.crash.surface, surface);
    assert.ok(navigation.crash.impactSpeed >= CRASH_LIMITS.groundSpeed);
  }
});

test('high-speed inertial descent cannot tunnel through the surface', t => {
  const { navigation } = setup(t);
  const approach = new THREE.Vector3(...destinations.forest);
  stageImpact(navigation, destinations.forest, FLIGHT.travelSpeed, 4);
  navigation.update(1 / 60);

  assert.equal(navigation.mode, 'crashed');
  assert.ok(navigation.normal.dot(approach) > .999999, 'contact stays on the approach hemisphere');
  assert.ok(navigation.position.length() >= RADIUS);
  near(navigation.altitude, 3.2, 1e-6);
  near(navigation.velocity.length(), 0);
});

test('crash state latches controls, then orbit and transit permit a second crash and recovery', t => {
  const { navigation, keyDown, keyUp, press } = setup(t);
  stageImpact(navigation, destinations.forest, 30);
  navigation.angularVelocity.set(.5, -.25, .75);
  navigation.update(1 / 60);
  assert.equal(navigation.mode, 'crashed');
  const firstCrash = navigation.crash;
  const firstCrashSnapshot = structuredClone(firstCrash);
  const stoppedAt = navigation.position.clone();

  for (const code of ['KeyB', 'KeyF', 'KeyV']) press(code);
  keyDown('KeyW');
  keyDown('Space');
  keyDown('ArrowLeft');
  // A stale input set cannot bypass the update guard either.
  navigation.keys.add('KeyW');
  navigation.keys.add('Space');
  for (let frame = 0; frame < 120; frame++) navigation.update(1 / 60);
  keyUp('KeyW');
  keyUp('Space');
  keyUp('ArrowLeft');
  assert.equal(navigation.mode, 'crashed');
  assert.strictEqual(navigation.crash, firstCrash);
  assert.deepEqual(navigation.crash, firstCrashSnapshot);
  assert.ok(navigation.position.equals(stoppedAt));
  near(navigation.velocity.length(), 0);
  near(navigation.angularVelocity.length(), 0);

  navigation.orbit();
  assert.equal(navigation.mode, 'flight');
  assert.equal(navigation.crash, null);

  stageImpact(navigation, destinations.forest, 30);
  navigation.update(1 / 60);
  assert.equal(navigation.mode, 'crashed', 'a reset ship can crash a second time');
  assert.notStrictEqual(navigation.crash, firstCrash, 'the second crash records a new terminal event');

  navigation.transit(destinations.coast, 100);
  assert.equal(navigation.mode, 'flight');
  assert.equal(navigation.crash, null);
  near(navigation.velocity.length(), 0);
});

test('crashed hull remains stationary while controller recovery menus still receive input',t=>{
  const {navigation}=setup(t);stageImpact(navigation,findDestinations().forest,30);navigation.update(1/60);
  assert.equal(navigation.mode,'crashed');const position=navigation.position.clone();let polls=0;
  navigation.onControllerInput=()=>polls++;
  navigation.update(1/60);assert.equal(polls,1);assert.ok(navigation.position.equals(position));
});
