import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Navigation } from '../src/navigation.js';
import { step as stepFlight } from '../src/flight-model.js';
import { RADIUS, findDestinations } from '../src/world.js';
import { SHIP_LAYOUT } from '../src/boarding.js';
import { FREIGHTER_LAYOUT, FreighterSystems } from '../src/freighter-layout.js';

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

function setup(t) {
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const document = new EventSurface();
  document.hidden = false;
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
  const advance = seconds => {
    for (let frame = 0; frame < Math.ceil(seconds * 60); frame++) navigation.update(1 / 60);
  };
  return { navigation, notices, keyDown, keyUp, press, advance };
}

const near = (actual, expected, tolerance = 1e-7, description = 'value') => {
  assert.ok(Math.abs(actual - expected) <= tolerance,
    `${description}: ${actual} differs from ${expected} by more than ${tolerance}`);
};
const nearVector = (actual, expected, tolerance = 1e-7, description = 'vector') => {
  for (let axis = 0; axis < 3; axis++) {
    near(actual.getComponent(axis), expected.getComponent(axis), tolerance, `${description} axis ${axis}`);
  }
};

test('power is pilot-controlled and an unpowered ship coasts under physics without thrust, boost, brakes, launch or drive', t => {
  const { navigation: nav, notices, keyDown, keyUp, press } = setup(t);
  assert.equal(nav.powered, true);
  assert.equal(nav.canTogglePower, true);

  nav.autoland = true;
  nav.stationLift = true;
  nav.togglePower();
  assert.equal(nav.powered, false);
  assert.equal(nav.autoland, false, 'power loss cancels landing automation');
  assert.equal(nav.stationLift, false, 'power loss cancels controlled station lift');

  nav.position.set(0, RADIUS + 100_000, 0);
  nav.orientation.identity();
  nav.velocity.set(120, 15, -300);
  nav.angularVelocity.set(.1, -.2, .05);
  const initial = {
    velocity: nav.velocity.clone(),
    orientation: nav.orientation.clone(),
    angularVelocity: nav.angularVelocity.clone(),
  };
  const dt = 1 / 60;
  const expected = stepFlight(initial, {}, nav.flightEnvironment, dt);
  keyDown('KeyW');
  keyDown('ShiftLeft');
  press('KeyX');
  nav.update(dt);
  keyUp('KeyW');
  keyUp('ShiftLeft');
  nearVector(nav.velocity, expected.velocity, 1e-9, 'unpowered velocity');
  near(nav.orientation.angleTo(expected.orientation), 0, 1e-9, 'unpowered attitude');
  nearVector(nav.angularVelocity, expected.angularVelocity, 1e-9, 'unpowered angular velocity');
  assert.equal(nav.boost, false);
  assert.ok(nav.speed > 100, 'X cannot freeze an unpowered moving ship');

  nav.travelTarget = 'selene';
  assert.equal(nav.beginTravel(), false, 'power off blocks relativistic travel');
  assert.equal(nav.travel, null);

  nav.mode = 'landed';
  nav.velocity.set(0, 0, 0);
  const parked = nav.position.clone();
  nav.landOrLaunch();
  assert.equal(nav.mode, 'landed', 'power off blocks launch');
  assert.ok(nav.position.equals(parked));
  assert.ok(notices.some(message => /power/i.test(message)), 'blocked actions explain the power requirement');

  assert.equal(nav.canTogglePower, true, 'a seated landed pilot can restore power');
  nav.togglePower();
  assert.equal(nav.powered, true);
  nav.mode = 'walk';
  assert.equal(nav.canTogglePower, false);
  nav.togglePower();
  assert.equal(nav.powered, true, 'walking cannot toggle pilot power controls');
});

test('leaving and retaking the Nomad seat preserves the moving hull and walking input never pilots it', t => {
  const { navigation: nav, keyDown, keyUp, press, advance } = setup(t);
  nav.position.set(0, RADIUS + 120_000, 0);
  nav.orientation.setFromEuler(new THREE.Euler(.12, -.35, .08));
  nav.velocity.set(180, -4, 75);
  nav.angularVelocity.set(0, 0, 0);
  nav.flightAssist = true;

  const seatedPosition = nav.position.clone();
  const hullOrientation = nav.orientation.clone();
  const velocity = nav.velocity.clone();
  const expectedHull = seatedPosition.clone()
    .sub(new THREE.Vector3(...SHIP_LAYOUT.seatEye).applyQuaternion(hullOrientation));
  press('KeyF');
  assert.equal(nav.mode, 'walk');
  assert.equal(nav.cabinFlight, true);
  assert.equal(nav.insideShip, true);
  nearVector(nav.shipPosition, expectedHull, 1e-8, 'Nomad hull origin');
  near(nav.shipOrientation.angleTo(hullOrientation), 0, 1e-10, 'Nomad hull attitude');
  nearVector(nav.shipVelocity, velocity, 1e-10, 'captured cruise velocity');
  nearVector(nav.toShipLocal(), new THREE.Vector3(...SHIP_LAYOUT.stand), 1e-8, 'standing position');

  const startHull = nav.shipPosition.clone();
  const startAttitude = nav.shipOrientation.clone();
  const startView = nav.orientation.clone();
  keyDown('ArrowLeft');
  advance(.5);
  keyUp('ArrowLeft');
  nearVector(nav.shipVelocity, velocity, 1e-8, 'unattended assisted cruise');
  near(nav.shipOrientation.angleTo(startAttitude), 0, 1e-9, 'walking steering does not rotate hull');
  assert.ok(nav.orientation.angleTo(startView) > .1, 'arrow key still turns the walking view');
  nearVector(nav.shipPosition, startHull.clone().addScaledVector(velocity, .5), 1e-5, 'moving hull');

  press('KeyX');
  advance(.1);
  nearVector(nav.shipVelocity, velocity, 1e-8, 'walking brake input does not stop hull');
  nav.position.copy(nav.fromShipLocal(new THREE.Vector3(0, SHIP_LAYOUT.floorY + SHIP_LAYOUT.eyeHeight, 3.2)));
  press('KeyF');
  assert.equal(nav.doorOpen, false, 'exterior hatch remains secured during cabin flight');
  nav.position.copy(nav.fromShipLocal(new THREE.Vector3(...SHIP_LAYOUT.stand)));
  const currentHull = nav.shipPosition.clone();
  press('KeyF');
  assert.equal(nav.mode, 'flight');
  assert.equal(nav.cabinFlight, false);
  nearVector(nav.position, currentHull.clone().add(new THREE.Vector3(...SHIP_LAYOUT.seatEye).applyQuaternion(nav.shipOrientation)), 1e-7, 'reseated eye');
  nearVector(nav.velocity, velocity, 1e-8, 'reseating preserves velocity');

  for (let cycle = 0; cycle < 3; cycle++) {
    press('KeyF');
    assert.equal(nav.cabinFlight, true, `cycle ${cycle} enters cabin flight`);
    nearVector(nav.toShipLocal(), new THREE.Vector3(...SHIP_LAYOUT.stand), 1e-7, `cycle ${cycle} stand`);
    press('KeyF');
    assert.equal(nav.mode, 'flight', `cycle ${cycle} returns to pilot seat`);
    nearVector(nav.velocity, velocity, 1e-8, `cycle ${cycle} velocity`);
  }
});

test('landing, undocking and relativistic-drive transients must finish before the pilot leaves the seat', t => {
  const { navigation: nav, press, advance } = setup(t);
  nav.position.set(0, RADIUS + 100_000, 0);
  nav.autoland = true;
  press('KeyF');
  assert.equal(nav.mode, 'flight');
  assert.equal(nav.cabinFlight, false);

  nav.autoland = false;
  nav.stationLift = true;
  press('KeyF');
  assert.equal(nav.mode, 'flight');
  assert.equal(nav.cabinFlight, false);

  nav.stationLift = false;
  nav.orbit();
  nav.travelTarget = 'selene';
  assert.equal(nav.beginTravel(), true);
  press('KeyF');
  assert.equal(nav.cabinFlight, false, 'drive prevents leaving the pilot seat');
  nav.togglePower();
  assert.equal(nav.powered, true, 'power switching is refused while the drive is active');
  nav.cancelTravel();
  advance(1);
  assert.equal(nav.travel, null, 'drive abort completes before cabin access');
  press('KeyF');
  assert.equal(nav.cabinFlight, true);
});

test('Atlas cabin flight keeps double-precision local support, permits interior lifts and contains walking in the rotating hull', t => {
  const { navigation: nav, keyDown, keyUp, press, advance } = setup(t);
  nav.shipId = 'atlas';
  nav.layout = FREIGHTER_LAYOUT;
  nav.freighter = new FreighterSystems();
  nav.position.set(40_000_000_000, 1_000_000_000, -30_000_000_000);
  nav.orientation.setFromEuler(new THREE.Euler(.17, -.43, .11));
  nav.velocity.set(1_250, -35, 480);
  nav.angularVelocity.set(.02, -.015, .01);
  nav.flightAssist = false;
  press('KeyF');
  assert.equal(nav.cabinFlight, true);
  nearVector(nav.toShipLocal(), new THREE.Vector3(...FREIGHTER_LAYOUT.stand), 3e-5, 'large-world Atlas stand');
  nearVector(nav.shipVelocity, new THREE.Vector3(1_250, -35, 480), 1e-10, 'Atlas velocity handoff');
  nearVector(nav.shipAngularVelocity, new THREE.Vector3(.02, -.015, .01), 1e-10, 'Atlas rotation handoff');

  nav.position.copy(nav.fromShipLocal(new THREE.Vector3(-4.8, 5.75, -3.8)));
  press('KeyF');
  const port = nav.freighter.lifts.find(lift => lift.id === 'port');
  assert.equal(port.target, port.high, 'interior port cargo lift operates in flight');
  for (let frame = 0; frame < 320; frame++) {
    nav.update(1 / 60);
    const local = nav.toShipLocal();
    near(local.y, port.y + FREIGHTER_LAYOUT.eyeHeight, 4e-5, 'moving lift carries rider in moving hull');
    assert.equal(nav.freighter.floorAt(local), port.y);
  }
  assert.equal(port.y, port.high);

  const main = nav.freighter.lifts.find(lift => lift.id === 'main');
  nav.position.copy(nav.fromShipLocal(new THREE.Vector3(0, 5.75, -1)));
  press('KeyF');
  assert.equal(main.target, main.high, 'exterior belly elevator remains secured during flight');

  nav.position.copy(nav.fromShipLocal(new THREE.Vector3(5.5, 5.75, -8.8)));
  nav.orientation.copy(nav.shipOrientation);
  keyDown('KeyD');
  advance(2);
  keyUp('KeyD');
  const againstWall = nav.toShipLocal();
  assert.ok(againstWall.x <= FREIGHTER_LAYOUT.interior.maxX - FREIGHTER_LAYOUT.capsuleRadius + 4e-5,
    `walker remains inside starboard wall: ${againstWall.toArray()}`);
  near(againstWall.y, FREIGHTER_LAYOUT.floorY + FREIGHTER_LAYOUT.eyeHeight, 4e-5, 'Atlas deck support');
  assert.ok(nav.shipPosition.length() > 49_000_000_000, 'hull remains in large world coordinates');
  assert.ok(nav.shipOrientation.angleTo(new THREE.Quaternion().setFromEuler(new THREE.Euler(.17, -.43, .11))) > .02,
    'unattended inertial hull continues rotating');
});

test('an unseated passenger follows the ship through touchdown into a stable parked cabin', t => {
  const { navigation: nav, press } = setup(t);
  const coast = findDestinations().coast;
  const approach = new THREE.Vector3(...coast);
  nav.transit(coast, 5);
  nav.flightAssist = false;
  nav.velocity.copy(approach).multiplyScalar(-2);
  press('KeyF');
  assert.equal(nav.cabinFlight, true);
  const localPassenger = nav.toShipLocal().clone();

  let frames = 0;
  while (nav.cabinFlight && frames++ < 180) nav.update(1 / 60);
  assert.equal(nav.cabinFlight, false, 'ground contact ends cabin flight');
  assert.equal(nav.mode, 'walk', 'passenger remains standing after the hull parks');
  assert.equal(nav.insideShip, true);
  nearVector(nav.toShipLocal(), localPassenger, 1e-6, 'passenger local position across touchdown');
  near(nav.shipVelocity.length(), 0);
  near(nav.shipAngularVelocity.length(), 0);
  assert.ok(nav.shipPosition.length() > RADIUS, 'parked hull remains at the terrain surface, not the planet centre');
  assert.ok(nav.shipPosition.clone().normalize().dot(approach) > .999999, 'touchdown stays on the approach hemisphere');
  const parkedHull = nav.shipPosition.clone();
  for (let frame = 0; frame < 30; frame++) nav.update(1 / 60);
  nearVector(nav.shipPosition, parkedHull, 1e-9, 'parked hull');
  nearVector(nav.toShipLocal(), localPassenger, 1e-6, 'parked passenger');
});

test('explicit transit resets cabin-flight state without changing the selected power state', t => {
  const { navigation: nav, press } = setup(t);
  nav.position.set(0, RADIUS + 100_000, 0);
  nav.velocity.set(90, 0, -40);
  nav.togglePower();
  assert.equal(nav.powered, false);
  press('KeyF');
  assert.equal(nav.cabinFlight, true, 'an unpowered coasting pilot may leave the seat');
  assert.ok(nav.shipPosition);

  nav.transit(findDestinations().coast, 100);
  assert.equal(nav.cabinFlight, false);
  assert.equal(nav.mode, 'flight');
  assert.equal(nav.shipPosition, null);
  near(nav.shipVelocity.length(), 0);
  near(nav.shipAngularVelocity.length(), 0);
  assert.equal(nav.powered, false, 'quick transit does not silently change main power');
});

for (const shipId of ['nomad', 'atlas']) {
  for (const assisted of [true, false]) {
    test(`${shipId}: Q/LB bank left and E/RB bank right in ${assisted ? 'assisted' : 'inertial'} flight`, t => {
      const { navigation: nav, keyDown, keyUp, advance } = setup(t);
      nav.shipId = shipId;
      nav.layout = shipId === 'atlas' ? FREIGHTER_LAYOUT : SHIP_LAYOUT;
      nav.freighter = shipId === 'atlas' ? new FreighterSystems() : null;
      const pad = { id: 'Roll direction pad', index: 0, connected: true, mapping: 'standard',
        axes: [0, 0, 0, 0], buttons: Array.from({length: 17}, () => ({pressed: false, value: 0})) };
      nav.gamepad.read = () => [pad];
      for (const [label, key, button, rightWingSign] of [
        ['Q', 'KeyQ', null, 1], ['E', 'KeyE', null, -1],
        ['LB', null, 4, 1], ['RB', null, 5, -1],
      ]) {
        nav.orbit();nav.position.set(0, RADIUS * 3, 0);nav.orientation.identity();
        nav.flightAssist = assisted;
        nav.gamepad.poll();
        if (key) keyDown(key);
        else pad.buttons[button] = {pressed: true, value: 1};
        advance(.25);
        const rightWing = new THREE.Vector3(1, 0, 0).applyQuaternion(nav.orientation);
        assert.ok(rightWing.y * rightWingSign > .04,
          `${label}: bank ${rightWingSign > 0 ? 'left (right wing rises)' : 'right (right wing drops)'}, actual wing y=${rightWing.y}`);
        nearVector(new THREE.Vector3(0, 0, -1).applyQuaternion(nav.orientation),
          new THREE.Vector3(0, 0, -1), 1e-8, `${label}: roll leaves nose direction unchanged`);
        if (key) keyUp(key);
        else pad.buttons[button] = {pressed: false, value: 0};
      }
    });
  }
}
