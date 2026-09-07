import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Station } from '../src/station.js';
import { Navigation } from '../src/navigation.js';
import { SHIP_LAYOUT } from '../src/boarding.js';
import { FREIGHTER_LAYOUT, FreighterSystems } from '../src/freighter-layout.js';
import { fleetHangarAsset } from '../src/station-fleet-hangar.js';
import { ATLAS_RAMP_CALLS } from '../src/atlas-gameplay.js';

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

async function createStation({ fleet = false } = {}) {
  const scene = new THREE.Scene();
  const source = await loadStationGltf(), gltf = fleet ? fleetHangarAsset(source) : source;
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

test('full-size Atlas docks, walks ground-to-ramp-to-crew-lift-to-seat, and interlocks launch', async t => {
  const {station}=await createStation({fleet:true});t.after(()=>station.dispose());
  const {navigation:nav,press,keyDown,keyUp,advance,advanceUntil}=setupNavigation(t,station);
  nav.shipId='atlas';nav.layout=FREIGHTER_LAYOUT;nav.freighter=new FreighterSystems();
  const pilot=station.padWorldPosition.clone().add(new THREE.Vector3(...FREIGHTER_LAYOUT.seatEye).applyQuaternion(station.padQuaternion));
  nav.position.copy(pilot).addScaledVector(station.up,4);nav.orientation.copy(station.padQuaternion);
  assert.equal(station.canDock(nav.position,nav.layout,nav.orientation),true,'complete 64 m hull fits over the fleet pad');
  press('KeyB');advanceUntil(()=>nav.mode==='landed',8,'Atlas docking assist settles at its own pilot height');
  near(nav.deckClearance,FREIGHTER_LAYOUT.seatEye[1]);nearVector(nav.shipPosition,station.padWorldPosition,1e-6);
  const parked=nav.shipPosition.clone(),front=nav.freighter.ramps.find(r=>r.id==='front'),lift=nav.freighter.elevator;
  assert.deepEqual(nav.freighter.lifts.map(l=>l.id),['crew'],'no retired main/side cargo elevator is simulated');
  press('KeyF');nearVector(nav.toShipLocal(),new THREE.Vector3(...FREIGHTER_LAYOUT.stand),1e-6);

  // Only dispatched movement/interaction keys move this walker after the initial
  // docking setup. X brakes at waypoints; no local-position assignment skips a
  // ramp, deck or shaft. The heading flips naturally when leaving the chair.
  function walkAxis(axis,target,check=()=>{}){
    const start=nav.toShipLocal()[axis],sign=Math.sign(target-start);if(Math.abs(target-start)<.035)return;
    const positive=axis==='x'?'KeyD':'KeyW',negative=axis==='x'?'KeyA':'KeyS';
    const direction=new THREE.Vector3(axis==='x'?1:0,0,axis==='z'?-1:0).applyQuaternion(nav.orientation).applyQuaternion(nav.shipOrientation.clone().invert())[axis];
    const code=Math.sign(direction)===sign?positive:negative;
    keyDown(code);let frames=0;
    while(sign*(nav.toShipLocal()[axis]-target)<0&&frames++<60*35){nav.update(1/60);check();}
    keyUp(code);press('KeyX');
    assert.ok(sign*(nav.toShipLocal()[axis]-target)>=0,`physical ${code} route to ${axis}=${target} stopped at ${nav.toShipLocal().toArray()}`);
    nearVector(nav.shipPosition,parked,1e-6,'walking never moves the parked hull');
  }
  const waitLift=destination=>advanceUntil(()=>Math.abs(lift.y-destination)<1e-9&&!lift.moving&&!nav.freighter.gates.some(g=>g.moving),8,'crew lift and destination gates settle');
  const useLift=destination=>{
    assert.equal(nav.shipInteraction(nav.toShipLocal()),'elevator:crew');press('KeyF');
    assert.equal(lift.target,destination);waitLift(destination);
    near(nav.toShipLocal().y,destination+FREIGHTER_LAYOUT.eyeHeight,1e-6,'real platform carries its rider');
  };
  const reachLift=()=>{walkAxis('x',0);walkAxis('z',-4);walkAxis('x',5.5);};
  const reachSeat=()=>{walkAxis('x',0);walkAxis('z',-19);walkAxis('x',-2.1);walkAxis('z',-20.5);assert.equal(nav.shipInteraction(nav.toShipLocal()),'seat');press('KeyF');assert.equal(nav.mode,'landed');};
  const reachFrontControl=()=>{walkAxis('x',0);walkAxis('z',-21.5);walkAxis('x',-4.3);assert.equal(nav.shipInteraction(nav.toShipLocal()),'ramp:front');};
  const waitRamp=angle=>advanceUntil(()=>front.angle===angle&&!front.moving,4,'front loading ramp settles');

  // Call the initially absent lift from its actual upper-deck pedestal, enter
  // through the opened gate, then descend to the cargo deck.
  walkAxis('x',0);walkAxis('z',-6.3);walkAxis('x',3.4);
  assert.equal(nav.shipInteraction(nav.toShipLocal()),'elevator:crew');press('KeyF');waitLift(lift.high);
  walkAxis('z',-4);walkAxis('x',5.5);useLift(lift.low);
  reachFrontControl();press('KeyF');waitRamp(front.openAngle);walkAxis('x',0);
  let height=nav.toShipLocal().y;
  const continuousHeight=()=>{const next=nav.toShipLocal().y;assert.ok(Math.abs(next-height)<.04,`ramp height jumped ${height} -> ${next}`);height=next;};
  walkAxis('z',-33,continuousHeight);assert.equal(nav.insideShip,false);near(nav.deckClearance,FREIGHTER_LAYOUT.eyeHeight,1e-5);
  assert.equal(station.isInsideHangar(nav.position),true,'entire ramp exits onto the real station deck');

  // The closed hull is boardable from ground via its reachable visible call
  // panel. Walk around the toe instead of crossing an open ramp side rail.
  const call=ATLAS_RAMP_CALLS.find(c=>c.id==='front');
  walkAxis('x',call.approach[0]);walkAxis('z',call.approach[2]);
  assert.equal(nav.shipInteraction(nav.toShipLocal()),'ramp:front');press('KeyF');waitRamp(front.closedAngle);
  press('KeyF');waitRamp(front.openAngle);
  walkAxis('z',-33);walkAxis('x',0);height=nav.toShipLocal().y;walkAxis('z',-20,continuousHeight);
  assert.equal(nav.insideShip,true);near(nav.toShipLocal().y,FREIGHTER_LAYOUT.floorY+FREIGHTER_LAYOUT.eyeHeight,1e-6);
  reachLift();useLift(lift.high);reachSeat();
  nearVector(nav.toShipLocal(),new THREE.Vector3(...FREIGHTER_LAYOUT.seatEye),1e-6);
  press('KeyB');assert.equal(nav.mode,'landed','an open loading ramp prevents launch');

  // Walk back through both decks to secure the same ramp, then regain the seat.
  press('KeyF');reachLift();useLift(lift.low);reachFrontControl();press('KeyF');waitRamp(front.closedAngle);
  reachLift();useLift(lift.high);reachSeat();assert.equal(nav.freighter.secured,true);
  nav.freighter.toggleElevator();press('KeyB');assert.equal(nav.mode,'landed','a moving crew lift also prevents launch');
  waitLift(lift.low);press('KeyB');assert.equal(nav.mode,'flight');assert.equal(nav.stationLift,true);
  station.doorMixer.update(6);station.updateDoorColliders();
  advanceUntil(()=>!nav.stationLift,3,'full-scale Atlas lifts from the real landing feet');
  near(nav.deckClearance,FREIGHTER_LAYOUT.seatEye[1]+1,1e-5);
  assert.ok(nav.deckClearance+FREIGHTER_LAYOUT.flightBounds.max[1]-FREIGHTER_LAYOUT.seatEye[1]<station.interiorBox.max.y-station.interiorBox.min.y);
});

for(const layout of [SHIP_LAYOUT,FREIGHTER_LAYOUT])test(`${layout===SHIP_LAYOUT?'Nomad':'Atlas'} lifts without overshoot and departs at 20 m/s`,async t=>{
  const {station}=await createStation({fleet:layout===FREIGHTER_LAYOUT});t.after(()=>station.dispose());
  const {navigation:nav,press,keyDown,keyUp,advanceUntil}=setupNavigation(t,station);
  nav.layout=layout;
  if(layout===FREIGHTER_LAYOUT){nav.shipId='atlas';nav.freighter=new FreighterSystems();}
  nav.position.copy(station.padWorldPosition).add(new THREE.Vector3(...layout.seatEye).applyQuaternion(station.padQuaternion));
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
  const exit=layout===FREIGHTER_LAYOUT?station.openingZ-(layout.flightBounds.max[2]-layout.seatEye[2])-2:-100;
  advanceUntil(()=>nav.stationLocal.z < exit,layout===FREIGHTER_LAYOUT?12:7,'full hull clears the open bay at useful departure speed');
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

test('a gentle manual deck arrival waits for animated gear even without ship power',async t=>{
  const {station}=await createStation();t.after(()=>station.dispose());
  const {navigation:nav,advance}=setupNavigation(t,station);
  nav.position.copy(station.toWorld(new THREE.Vector3(0,station.interiorBox.min.y+SHIP_LAYOUT.seatEye[1]+.08,station.padLocal.z+SHIP_LAYOUT.seatEye[2]),new THREE.Vector3()));
  nav.orientation.copy(station.padQuaternion);nav.powered=false;nav.flightAssist=false;
  nav.velocity.copy(station.up).multiplyScalar(-.3);
  advance(.1);
  assert.equal(nav.mode,'flight');assert.equal(nav.gearContactHold,true);
  assert.ok(nav.gearProgress<.1,'manual capture does not bypass gear motion');
  advance(.8);assert.ok(nav.gearProgress>.4&&nav.gearProgress<.6);
  advance(1.2);
  assert.equal(nav.mode,'landed');assert.equal(nav.dockedAtStation,true);
  assert.equal(nav.powered,false);assert.equal(nav.gearProgress,1);
  assert.equal(nav.gearContactHold,false);
  near(nav.deckClearance,SHIP_LAYOUT.seatEye[1]);
});
