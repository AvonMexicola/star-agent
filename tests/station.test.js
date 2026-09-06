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

test('cached door bounds ignore world rebasing and track cinematic, mixer and geometry changes',async t=>{
  const {station}=await createStation();t.after(()=>station.dispose());
  const check=()=>{
    station.updateDoorColliders();station.group.updateMatrixWorld(true);
    const inverse=station.group.matrixWorld.clone().invert();
    station.doors.forEach((door,i)=>{
      const expected=new THREE.Box3();door.traverse(mesh=>{if(mesh.isMesh){mesh.geometry.computeBoundingBox();expected.union(mesh.geometry.boundingBox.clone().applyMatrix4(inverse.clone().multiply(mesh.matrixWorld)));}});
      nearVector(station.doorBoxes[i].min,expected.min,1e-7);nearVector(station.doorBoxes[i].max,expected.max,1e-7);
    });
  };
  station.beginOpening();station.setOpeningProgress(.25);check();
  const boxes=station.doorBoxes.map(box=>box.clone()),references=[...station.doorBoxes];
  let traversals=0;const update=station.group.updateMatrixWorld;
  station.group.updateMatrixWorld=function(...args){traversals++;return update.apply(this,args);};
  station.group.position.set(25000000,-1900000,5000000);station.group.rotation.set(.3,.7,.2);
  station.updateDoorColliders();
  assert.equal(traversals,0,'rebasing never traverses the hidden hero model for local door collision');
  station.doorBoxes.forEach((box,i)=>{assert.equal(box,references[i]);assert.ok(box.equals(boxes[i]),'local doubles stay exactly unchanged');});
  station.setOpeningProgress(.75);check();assert.ok(!station.doorBoxes[0].equals(boxes[0]));
  station.endOpening();station.closeDoors();station.doorMixer.update(1);check();
  const leaf=station.doors[0];let mesh;leaf.traverse(node=>{if(node.isMesh&&!mesh)mesh=node;});
  mesh.geometry=mesh.geometry.clone();const position=mesh.geometry.attributes.position;
  position.setX(0,position.getX(0)+20);position.needsUpdate=true;check();
  mesh.position.y+=.7;check();
  const addition=new THREE.Mesh(new THREE.BoxGeometry(80,.5,.5),mesh.material);leaf.add(addition);check();
  leaf.remove(addition);check();addition.geometry.dispose();
  station.attach(await loadStationGltf());check();
});

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
  press('KeyB');
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

  press('KeyB');
  assert.equal(navigation.mode, 'flight');
  assert.equal(navigation.dockedAtStation, false);
  assert.equal(navigation.stationLift, true, 'launch begins with controlled vertical clearance');
  assert.equal(navigation.shipPosition, null);
  advanceUntil(() => !navigation.stationLift, 3, 'launch reaches safe bay clearance');
  near(navigation.deckClearance, SHIP_LAYOUT.seatEye[1]+1, 1e-5, 'launch lifts landing gear only one metre');
  assert.ok(navigation.stationLocal.y < station.interiorBox.max.y, 'launch remains inside the hangar clear volume');
});

test('Atlas docks at its own eye height, carries a rider to the hangar deck and interlocks launch', async t => {
  const {station}=await createStation();t.after(()=>station.dispose());
  const {navigation:nav,press,advance,advanceUntil,walkUntil}=setupNavigation(t,station);
  nav.shipId='atlas';nav.layout=FREIGHTER_LAYOUT;nav.freighter=new FreighterSystems();
  const centre=station.interiorBox.getCenter(new THREE.Vector3());
  nav.position.copy(localToWorld(station,centre.x,station.interiorBox.min.y+7,centre.z+FREIGHTER_LAYOUT.seatEye[2]));
  nav.orientation.copy(station.quaternion);
  press('KeyB');advance(8);assert.equal(nav.mode,'landed',JSON.stringify({canDock:nav.canDock,clearance:nav.deckClearance,local:nav.stationLocal.toArray(),box:station.interiorBox,autoland:nav.autoland}));
  near(nav.deckClearance,5.55);press('KeyF');
  walkUntil('KeyW',()=>nav.toShipLocal().z>.8);press('KeyF');
  advanceUntil(()=>nav.freighter.lifts[0].y===0,7,'main lift lowers');
  near(nav.toShipLocal().y,1.75);walkUntil('KeyW',()=>nav.toShipLocal().z>10.5);
  assert.equal(nav.insideShip,false);near(nav.deckClearance,1.75);
  walkUntil('KeyS',()=>nav.toShipLocal().z<1.2);press('KeyF');
  advanceUntil(()=>nav.freighter.lifts[0].y===4,7,'main lift raises rider');near(nav.toShipLocal().y,5.75);
  walkUntil('KeyS',()=>nav.toShipLocal().z<-9);press('KeyF');assert.equal(nav.mode,'landed');
  nav.freighter.toggle('port');press('KeyB');assert.equal(nav.mode,'landed','cannot launch with moving cargo lift');
  advance(6);press('KeyB');assert.equal(nav.mode,'landed','cannot launch with raised cargo lift');
  nav.freighter.toggle('port');advance(6);press('KeyB');assert.equal(nav.mode,'flight');
  advanceUntil(()=>!nav.stationLift,3,'Atlas lifts clear of deck');
  assert.ok(nav.deckClearance>=6.5);assert.ok(nav.deckClearance+9.8-5.55<station.interiorBox.max.y-station.interiorBox.min.y);
});

for(const layout of [SHIP_LAYOUT,FREIGHTER_LAYOUT])test(`${layout===SHIP_LAYOUT?'Nomad':'Atlas'} lifts without overshoot and departs at 20 m/s`,async t=>{
  const {station}=await createStation();t.after(()=>station.dispose());
  const {navigation:nav,press,keyDown,keyUp,advanceUntil}=setupNavigation(t,station);
  nav.layout=layout;
  if(layout===FREIGHTER_LAYOUT){nav.shipId='atlas';nav.freighter=new FreighterSystems();}
  nav.position.copy(station.toWorld(new THREE.Vector3(station.padLocal.x,station.interiorBox.min.y+layout.seatEye[1],station.padLocal.z+layout.seatEye[2]),new THREE.Vector3()));
  nav.orientation.copy(station.padQuaternion);nav.dock();assert.equal(nav.mode,'landed');
  press('KeyB');assert.equal(station.doorCommand,'open','launch requests an open exit');
  station.doorMixer.update(6);station.updateDoorColliders();
  // A long simulation frame must stop at the same height as a high-FPS launch.
  nav.advanceFlight(.4);nav.advanceFlight(.4);
  near(nav.deckClearance,layout.seatEye[1]+1,1e-5);
  assert.equal(nav.stationLift,false);
  let contacts=0;const constrain=station.constrainStep.bind(station);
  station.constrainStep=(...args)=>{const result=constrain(...args);if(result.hit)contacts++;return result;};
  keyDown('KeyW');
  advanceUntil(()=>nav.stationLocal.z < -100,7,'full hull clears the open bay at useful departure speed');
  keyUp('KeyW');
  assert.ok(nav.speed>19&&nav.speed<=20.001,`departure speed ${nav.speed}`);
  assert.equal(contacts,0,'departure does not scrape the deck, ceiling or door frame');
  near(nav.deckClearance,layout.seatEye[1]+1,1e-4,'departure remains level');
});

test('obstructed automatic lift stops once and releases pilot translation',async t=>{
  const {station}=await createStation();t.after(()=>station.dispose());
  const {navigation:nav,press,keyDown,advance}=setupNavigation(t,station);
  nav.position.copy(station.toWorld(new THREE.Vector3(0,station.interiorBox.min.y+SHIP_LAYOUT.seatEye[1],station.padLocal.z+SHIP_LAYOUT.seatEye[2]),new THREE.Vector3()));
  nav.orientation.copy(station.padQuaternion);nav.dock();press('KeyB');
  station.doorMixer.update(6);station.updateDoorColliders();
  // A low obstruction above the docked hull reproduces contact during lift.
  const ceiling=station.interiorBox.min.y+SHIP_LAYOUT.flightBounds.max[1]+.3;
  station.doorBoxes.push(new THREE.Box3(new THREE.Vector3(-8,ceiling,-12),new THREE.Vector3(8,ceiling+.2,12)));
  advance(1);
  assert.equal(nav.stationLift,false,'contact cannot leave launch assist permanently active');
  assert.equal(nav.speed,0);
  const start=nav.position.clone();keyDown('KeyW');advance(.3);
  assert.ok(nav.position.distanceTo(start)>1,'forward input works after the interrupted lift');
});

test('a shallow downward departure is not captured by the planetary landing threshold',async t=>{
  const {station}=await createStation();t.after(()=>station.dispose());
  const {navigation:nav,press}=setupNavigation(t,station);
  nav.position.copy(station.toWorld(new THREE.Vector3(0,station.interiorBox.min.y+SHIP_LAYOUT.seatEye[1],station.padLocal.z+SHIP_LAYOUT.seatEye[2]),new THREE.Vector3()));
  nav.orientation.copy(station.padQuaternion);nav.dock();press('KeyB');
  station.doorMixer.update(6);station.updateDoorColliders();nav.advanceFlight(.4);nav.advanceFlight(.1);
  nav.look(0,-Math.PI/90);
  for(let i=0;i<50;i++)nav.advanceFlight(1/60,{moveForward:1});
  assert.ok(nav.deckClearance<3.2,'fixture crosses the old planetary capture height');
  assert.equal(nav.mode,'flight','small nose-down correction cannot re-dock a departing ship');
  assert.ok(nav.speed>17);
});
