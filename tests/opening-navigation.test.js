import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Navigation } from '../src/navigation.js';
import { SHIP_LAYOUT } from '../src/boarding.js';
import { RADIUS } from '../src/world.js';
import { Station, stationQuaternion } from '../src/station.js';
import { Fleet, FLEET_KEY } from '../src/fleet.js';
import { FREIGHTER_LAYOUT, FreighterSystems } from '../src/freighter-layout.js';
import { fleetHangarAsset } from '../src/station-fleet-hangar.js';
import { ATLAS_RAMP_CALLS } from '../src/atlas-gameplay.js';

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

async function setupOpening(t, { fleet = false } = {}) {
  const document = installDom(t);
  const radial = stationQuaternion(STATION_DIRECTION, new THREE.Quaternion());
  const orientation = radial.multiply(
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), THREE.MathUtils.degToRad(20)),
  ).normalize();
  const gltf = await loadStationGltf();
  const station = new Station(new THREE.Scene(), {
    gltf: fleet ? fleetHangarAsset(gltf) : gltf, lodUrl: null, direction: STATION_DIRECTION, orientation,
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

test('saved Atlas selection starts on the large bay deck and boards through its loading ramp and crew lift', async t => {
  const { navigation, station, press, advance, moveUntil } = await setupOpening(t, { fleet: true });
  const saved=JSON.stringify({version:1,surfaceVisited:true,unlocked:true,active:'atlas'});
  const fleet=new Fleet({getItem:key=>key===FLEET_KEY?saved:null});
  navigation.shipId=fleet.active;navigation.layout=FREIGHTER_LAYOUT;navigation.freighter=new FreighterSystems();
  // The complex tracks a parked berth independently from its current hub/pod view.
  station.location='hub';station.activeIndex=7;station.parkedPod=0;
  navigation.startStation();
  station.beginOpening();station.setOpeningProgress(1);station.endOpening();
  assert.equal(navigation.shipId,'atlas');assert.equal(fleet.active,'atlas');
  assert.equal(navigation.layout,FREIGHTER_LAYOUT);
  assert.equal(station.location,'hangar');assert.equal(station.parkedPod,7);
  const local=navigation.toShipLocal(),shipPosition=navigation.shipPosition.clone();
  assert.ok(local.z<FREIGHTER_LAYOUT.flightBounds.min[2]-.25,'spawn is ahead of the complete cockpit overhang');
  near(local.y,FREIGHTER_LAYOUT.eyeHeight);
  near(navigation.deckClearance,FREIGHTER_LAYOUT.eyeHeight);
  assert.equal(navigation.freighter.floorAt(local),null);
  const call=ATLAS_RAMP_CALLS.find(c=>c.id==='front'),ramp=navigation.freighter.ramps.find(r=>r.id==='front'),lift=navigation.freighter.elevator;
  moveUntil('KeyD',()=>navigation.toShipLocal().x>call.approach[0],3,'walk around the loading ramp toe');
  moveUntil('KeyS',()=>navigation.toShipLocal().z>call.approach[2],4,'reach the visible ground call panel');
  assert.equal(navigation.shipInteraction(navigation.toShipLocal()),'ramp:front');press('KeyF');advance(4);
  near(ramp.angle,ramp.openAngle);
  moveUntil('KeyW',()=>navigation.toShipLocal().z<-33,4,'walk outside the complete open ramp');
  moveUntil('KeyA',()=>navigation.toShipLocal().x<0,4,'return to the loading centreline');
  moveUntil('KeyS',()=>navigation.toShipLocal().z>-20,7,'physically climb the authored loading ramp');
  assert.equal(navigation.insideShip,true);near(navigation.toShipLocal().y,FREIGHTER_LAYOUT.floorY+FREIGHTER_LAYOUT.eyeHeight,1e-5);
  moveUntil('KeyS',()=>navigation.toShipLocal().z>-4,8,'walk down the cargo deck to the crew lift');
  moveUntil('KeyD',()=>navigation.toShipLocal().x>5.5,4,'enter the open crew lift gate');
  assert.equal(navigation.shipInteraction(navigation.toShipLocal()),'elevator:crew');press('KeyF');advance(8);
  near(navigation.toShipLocal().y,lift.high+FREIGHTER_LAYOUT.eyeHeight,1e-5);
  moveUntil('KeyA',()=>navigation.toShipLocal().x<0,4,'leave the upper crew lift gate');
  moveUntil('KeyW',()=>navigation.toShipLocal().z<-19,8,'walk along the upper deck');
  moveUntil('KeyA',()=>navigation.toShipLocal().x<-2.1,2,'reach the pilot lane');
  moveUntil('KeyW',()=>navigation.toShipLocal().z<-20.5,2,'approach the Atlas pilot chair');
  assert.equal(navigation.shipInteraction(navigation.toShipLocal()),'seat');
  press('KeyF');assert.equal(navigation.mode,'landed');
  nearVector(navigation.toShipLocal(),new THREE.Vector3(...FREIGHTER_LAYOUT.seatEye));
  nearVector(navigation.shipPosition,shipPosition);
});

test('station service actions coexist with travel input gating', t => {
  installDom(t);
  const nav=new Navigation(new EventSurface(),()=>{});let actions=0;
  nav.mode='walk';nav.stationAction=()=>{actions++;return true;};
  nav.travel={};nav.embark();assert.equal(actions,0,'travel cannot open station services');
  nav.travel=null;nav.embark();assert.equal(actions,1,'walking F still dispatches cargo/elevator services');
});

test('travel excludes the complete modular station centre even when another berth is active', t => {
  installDom(t);
  const nav=new Navigation(new EventSurface(),()=>{});nav.travelTarget='selene';
  const route=nav.travelRoute();assert.equal(route.ok,true,route.reason);
  const centre=route.plan.start.clone().lerp(route.plan.end,.5);
  const sideways=new THREE.Vector3().crossVectors(route.plan.direction,new THREE.Vector3(0,1,0)).normalize().multiplyScalar(3000);
  nav.station={ready:true,centre,worldPosition:centre.clone().add(sideways)};
  const guarded=nav.travelRoute();assert.equal(guarded.ok,false);
  assert.match(guarded.reason,/Aeon Orbital.*exclusion/);
});

test('tilted station walking keeps one deck plane beyond the ship boundary', async t => {
  const { navigation, station, keyDown, keyUp, step } = await setupOpening(t);
  navigation.startStation();
  station.beginOpening();
  station.setOpeningProgress(1);
  station.endOpening();

  // Begin clear of the parked ship and walk diagonally across the former 25 m
  // ship-local cutoff. Both sampled bands are supported by the authored deck.
  const initialLocal = new THREE.Vector3(14, SHIP_LAYOUT.eyeHeight, 16);
  navigation.position.copy(navigation.fromShipLocal(initialLocal));
  navigation.orientation.copy(navigation.shipOrientation).multiply(
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 4),
  );
  const supported = station.deckPoint(navigation.position, SHIP_LAYOUT.eyeHeight);
  nearVector(supported, navigation.position, 1e-8);

  const expectedDirection = new THREE.Vector2(1, 1).normalize();
  const nearSteps = [], farSteps = [];
  keyDown('KeyS');
  for (let frame = 0; frame < 150 && farSteps.length < 20; frame++) {
    const before = navigation.toShipLocal();
    step();
    const after = navigation.toShipLocal();
    const radius = (before.length() + after.length()) / 2;
    const delta = new THREE.Vector2(after.x - before.x, after.z - before.z);
    near(after.y, SHIP_LAYOUT.eyeHeight, 1e-6);
    if (radius > 23.5 && radius < 24.5) nearSteps.push(delta);
    if (radius > 25.5 && radius < 26.5) farSteps.push(delta);
  }
  keyUp('KeyS');

  assert.ok(nearSteps.length >= 8 && farSteps.length >= 8,
    `captured motion on both sides of 25 m (${nearSteps.length} near, ${farSteps.length} far)`);
  const average = samples => samples.reduce((sum, delta) => sum.add(delta), new THREE.Vector2()).multiplyScalar(1 / samples.length);
  const nearMotion = average(nearSteps), farMotion = average(farSteps);
  assert.ok(nearMotion.clone().normalize().dot(expectedDirection) > .99999,
    `near motion follows the intended deck heading: ${nearMotion.toArray()}`);
  assert.ok(farMotion.clone().normalize().dot(expectedDirection) > .99999,
    `far motion has no lateral drift: ${farMotion.toArray()}`);
  near(farMotion.length(), nearMotion.length(), nearMotion.length() * .01);
  assert.ok(navigation.toShipLocal().length() > 25, 'walking crossed the former ship-local boundary physically');
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

  press('KeyB');
  assert.equal(navigation.mode, 'flight');
  assert.equal(navigation.dockedAtStation, false);
  assert.equal(navigation.stationLift, true);
  assert.equal(navigation.shipPosition, null);
  until(() => !navigation.stationLift, 3, 'undocking lift reaches safe deck clearance');
  assert.ok(Math.abs(navigation.deckClearance - (SHIP_LAYOUT.seatEye[1] + 1)) < 1e-5);

  const openingZ = station.openingZ;
  keyDown('KeyW');
  until(() => navigation.stationLocal.z < openingZ - 8, 15, 'ordinary thrust flies through the open hangar doors');
  keyUp('KeyW');
  assert.equal(navigation.mode, 'flight');
  assert.equal(navigation.stationLift, false);
  assert.ok(navigation.stationLocal.z < openingZ);
});
