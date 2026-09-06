import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { Navigation } from '../src/navigation.js';
import { findDestinations, latLonDirection } from '../src/world.js';
import { TRAVEL_TARGETS, sampleTravel } from '../src/travel-model.js';

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
  return { navigation, notices, press, keyDown, keyUp };
}

const destinations = findDestinations();
const near = (actual, expected, tolerance = 1e-7) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
const nearVector = (actual, expected, tolerance = 1e-7) =>
  assert.ok(actual.distanceTo(expected) <= tolerance, `${actual.toArray()} != ${expected.toArray()}`);

test('selecting and plotting a target never moves the ship, while ground starts are rejected', t => {
  const { navigation, notices, press } = setup(t);
  const orbitalPosition = navigation.position.clone();
  navigation.travelTarget = 'selene';
  assert.ok(navigation.position.equals(orbitalPosition));
  const route = navigation.travelRoute();
  assert.equal(route.ok, true, route.reason);
  assert.equal(navigation.travel, null);
  assert.ok(navigation.position.equals(orbitalPosition));

  navigation.transit(destinations.coast, 100);
  const groundPosition = navigation.position.clone();
  assert.equal(navigation.travelRoute().ok, false);
  assert.match(navigation.travelRoute().reason, /Aeon.*exclusion/i);
  press('KeyJ');
  assert.equal(navigation.travel, null);
  assert.ok(navigation.position.equals(groundPosition));
  assert.match(notices.at(-1), /Aeon.*exclusion/i);
});

test('J engages travel, active controls cannot perturb it, and X begins continuous braking', t => {
  const { navigation, notices, press, keyDown, keyUp } = setup(t);
  navigation.travelTarget = 'selene';
  const initialPosition = navigation.position.clone();
  press('KeyJ');
  assert.equal(navigation.travel?.plan.kind, 'travel');
  assert.ok(navigation.position.equals(initialPosition));
  assert.equal(navigation.velocity.length(), 0);
  assert.match(notices.at(-1), /spooling/i);

  const plan = navigation.travel.plan;
  const orientation = navigation.orientation.clone();
  const noticeCount = notices.length;
  navigation.look(.4, -.2);
  for (const code of ['ArrowLeft', 'KeyB', 'KeyF', 'KeyV']) press(code);
  assert.equal(navigation.orientation.angleTo(orientation), 0);
  assert.equal(navigation.flightAssist, true);
  assert.equal(navigation.autoland, false);
  assert.equal(navigation.mode, 'flight');
  assert.equal(notices.length, noticeCount);

  keyDown('KeyW');
  navigation.update(3.25);
  keyUp('KeyW');
  const analytical = sampleTravel(plan, 3.25);
  nearVector(navigation.position, analytical.position);
  near(navigation.speed, analytical.speed);
  assert.ok(navigation.keys.size === 0 || !navigation.keys.has('KeyW'));

  const positionBeforeAbort = navigation.position.clone();
  const speedBeforeAbort = navigation.speed;
  press('KeyX');
  assert.equal(navigation.travel.plan.kind, 'abort');
  assert.equal(navigation.travel.elapsed, 0);
  assert.ok(navigation.position.equals(positionBeforeAbort));
  const abortStart = navigation.travelState;
  nearVector(new Vector3(...abortStart.position), positionBeforeAbort);
  near(abortStart.speed, speedBeforeAbort);
  assert.equal(abortStart.aborting, true);

  const abortEndpoint = navigation.travel.plan.end.clone();
  navigation.update(navigation.travel.plan.duration + 1);
  assert.equal(navigation.travel, null);
  nearVector(navigation.position, abortEndpoint);
  assert.ok(navigation.position.distanceTo(positionBeforeAbort) > 0);
  assert.equal(navigation.speed, 0);
  assert.match(notices.at(-1), /normal flight restored/i);
});

test('map-style pause freezes travel, and a long frame lands exactly at a safe approach', t => {
  const { navigation, press } = setup(t);
  navigation.travelTarget = 'selene';
  press('KeyJ');
  navigation.update(.5);
  const elapsed = navigation.travel.elapsed;
  const position = navigation.position.clone();
  const orientation = navigation.orientation.clone();

  navigation.enabled = false;
  navigation.update(300);
  assert.equal(navigation.travel.elapsed, elapsed);
  assert.ok(navigation.position.equals(position));
  assert.equal(navigation.orientation.angleTo(orientation), 0);

  navigation.enabled = true;
  const endpoint = navigation.travel.plan.end.clone();
  navigation.update(navigation.travel.plan.duration + 300);
  assert.equal(navigation.travel, null);
  assert.equal(navigation.travelState, null);
  nearVector(navigation.position, endpoint);
  assert.equal(navigation.speed, 0);
  assert.equal(navigation.mode, 'flight');

  const selene = TRAVEL_TARGETS.find(target => target.id === 'selene');
  const center = new Vector3(...selene.center);
  near(navigation.position.distanceTo(center), selene.arrivalRadius, 1e-6);
  assert.ok(navigation.position.distanceTo(center) > selene.exclusionRadius);

  assert.equal(navigation.flightAssist, true);
  press('KeyV');
  assert.equal(navigation.flightAssist, false, 'ordinary flight controls resume after arrival');
});

test('orbit and surface transit cancel active travel and discard held controls', t => {
  const { navigation, press } = setup(t);
  navigation.travelTarget = 'selene';
  press('KeyJ');
  navigation.update(3.1);
  navigation.keys.add('KeyW');
  navigation.orbit();
  assert.equal(navigation.travel, null);
  assert.equal(navigation.keys.size, 0);
  assert.equal(navigation.mode, 'flight');
  assert.equal(navigation.speed, 0);

  press('KeyJ');
  assert.ok(navigation.travel);
  navigation.keys.add('ShiftLeft');
  const direction = latLonDirection(18, 28);
  navigation.transit(direction, 250);
  assert.equal(navigation.travel, null);
  assert.equal(navigation.keys.size, 0);
  assert.equal(navigation.mode, 'flight');
  assert.equal(navigation.speed, 0);
  assert.ok(navigation.position.clone().normalize().distanceTo(new Vector3(...direction)) < 1e-12);
});

test('N requires an outward safe heading, spools without a target and N drops out continuously', t=>{
  const {navigation:n,press,notices}=setup(t);
  n.transit(destinations.coast,19_000);
  const up=n.normal;n.orientToward(n.position.clone().add(up),up.clone().set(up.y,up.z,up.x));
  press('KeyN');assert.equal(n.travel,null);assert.match(notices.at(-1),/20 km/);
  n.position.addScaledVector(up,1100);
  n.orientToward(n.position.clone().sub(up),new Vector3(0,1,0));
  press('KeyN');assert.equal(n.travel,null);assert.match(notices.at(-1),/away/);
  n.orientToward(n.position.clone().add(up),new Vector3(0,1,0));
  press('KeyN');assert.ok(n.travel);assert.equal(n.travel.manual,true);assert.equal(n.travelTarget,null);
  const start=n.position.clone();n.updateTravel(2);nearVector(n.position,start);assert.equal(n.travelState.phase,'spooling');
  n.updateTravel(2);assert.ok(n.position.distanceTo(start)>1_000_000);
  const before=n.position.clone(),speed=n.speed;press('KeyN');nearVector(n.position,before);assert.equal(n.travelState.aborting,true);
  n.updateTravel(.1);assert.ok(n.speed<speed);assert.ok(n.position.distanceTo(before)>0);
  n.updateTravel(100);assert.equal(n.travel,null);assert.equal(n.speed,0);
});

test('G and L are contextual utilities; landing assist deploys gear; B retains launch',t=>{
  const {navigation:n,press}=setup(t);
  press('KeyG');assert.equal(n.gearDeployed,false);
  press('KeyL');assert.equal(n.shipLightsOn,true);assert.equal(n.autoland,false);
  n.transit(destinations.coast,100);press('KeyB');assert.equal(n.autoland,true);assert.equal(n.gearDeployed,true);
  press('KeyG');assert.equal(n.gearDeployed,true);
  n.mode='walk';press('KeyL');assert.equal(n.flashlightOn,true);assert.equal(n.shipLightsOn,true);
  press('KeyL');assert.equal(n.flashlightOn,false);
});
