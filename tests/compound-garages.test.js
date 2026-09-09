import test from 'node:test';
import assert from 'node:assert/strict';
import {Scene, Vector3, Quaternion} from 'three';
import {createSettlements} from '../src/settlements/system.js';
import {SHIP_LAYOUT} from '../src/boarding.js';
import {ROVER_LAYOUT} from '../src/rover-layout.js';
import {createSettlementLayouts} from '../src/settlements/layout.js';
import {createRoverBuildSupport} from '../src/rover-build-support.js';
import {createRoverPhysics} from '../src/rover-physics.js';
import {sampleRoverSupport} from '../src/rover-support.js';
import {bodyAt, bodyOffset} from '../src/celestial.js';
import {garageRetrievalStatus, sentryRetrievalStatus, garageBayAvailable} from '../src/settlements/garage-policy.js';
import {createSentryEnvironment} from '../src/sentry/environment.js';
import {createSentrySimulation} from '../src/sentry/simulation.js';
import {SENTRY_LAYOUT} from '../src/sentry/layout.js';
import {validFoundationDepth} from '../src/build/foundations.js';
import {terminalPieceFrame} from '../src/trading/terminal-frames.js';
const UP = new Vector3(0, 1, 0);
const sites = createSettlementLayouts();

for (const site of sites) test(`${site.body}: four wheels leave the garage over actual kit support and reach canonical terrain`, () => {
  assert.ok(site.claim.pieces.every(validFoundationDepth));
  const q = new Quaternion(...site.claim.quaternion), origin = new Vector3(...site.claim.origin), construction = createRoverBuildSupport({claims: () => [site.claim]});
  const rover = createRoverPhysics({position: new Vector3(...site.garage.position).applyQuaternion(q).add(origin), quaternion: q.clone().multiply(new Quaternion().setFromAxisAngle(UP, site.garage.rotation)),
    sampleSupport: point => sampleRoverSupport(point, {construction: construction.sample}), referenceUp: p => bodyOffset(p, bodyAt(p)).normalize(), constrain: ({previous, proposed}) => construction.clearPose(previous, proposed)});
  const local = () => rover.state.position.clone().sub(origin).applyQuaternion(q.clone().invert());
  rover.step(1 / 60, {brake: 1}); assert.equal(rover.state.supported, true); assert.ok(rover.state.wheels.every(w => w.source.startsWith('construction:')));
  for (let frame = 0; frame < 1800 && local().x < site.garage.rampEnd[0] + 3; frame++) {
    rover.step(1 / 60, {throttle: .5}); assert.equal(rover.state.blocked, false, `${rover.state.reason} at ${local().toArray()}`);
  }
  assert.ok(local().x > site.garage.rampEnd[0] + 3); assert.ok(rover.state.wheels.every(w => w.source === 'terrain'));
  for (let frame = 0; frame < 2200 && local().x > 32.5; frame++) {rover.step(1 / 60, {throttle: -1}); assert.equal(rover.state.blocked, false, `reverse ${rover.state.reason} at ${local().toArray()}`);}
  assert.ok(local().x < 32.5); assert.ok(rover.state.wheels.every(w => w.source.startsWith('construction:')));
  const terminal = terminalPieceFrame(site.claim, site.garage.terminalPiece);
  assert.ok(new Vector3(0, 0, 1).applyQuaternion(terminal.quaternion).dot(new Vector3(-1, 0, 0).applyQuaternion(q)) > .99, 'console faces the landing pad');
  assert.equal(site.claim.pieces.filter(p => p.type === 'hangar-door' && p.doorOpen).length, 2);
});

test('construction collision rejects walls, closed gates and bay cargo while allowing supporting floor at stellar coordinates', () => {
  const claim = {id: 'garage', origin: [25e9, 300, -450], quaternion: [0, 0, 0, 1], radius: 40, pieces: [
    {id: 'floor', type: 'foundation-pad-small', position: [0, 0, 0], rotation: 0},
    {id: 'door', type: 'hangar-door', position: [0, 0, -8], rotation: 0, doorOpen: true},
    {id: 'wall', type: 'wall', position: [8, 0, 0], rotation: Math.PI / 2},
  ]};
  let open = true; const c = createRoverBuildSupport({claims: () => [claim], doorFraction: () => open});
  const pose = (x, z) => ({position: new Vector3(25e9 + x, 300, -450 + z), quaternion: new Quaternion()});
  assert.equal(c.clearPose(pose(0, 0)), true); assert.equal(c.clearPose(pose(0, -6)), true);
  open = false; assert.equal(c.clearPose(pose(0, -6)), false); open = true;
  assert.equal(c.clearPose(pose(0, 0), pose(8, 0)), false);
  claim.pieces = [...claim.pieces, {id: 'crate', type: 'crate', position: [0, 0, 0], rotation: 0}];
  assert.equal(c.clearPose(pose(0, 0)), false);
  const hit = c.sample(new Vector3(25e9 + .125, 300.01, -450.125)); assert.equal(hit.point.x, 25e9 + .125); assert.equal(hit.point.y, 300);
});

test('retrieval rejects occupied, moving, loading and carried vehicles without changing their state', () => {
  const state = {ready: true, spawned: true, occupied: false, busy: false, aboard: false, speed: 0, mass: 27.5, charge: .21};
  assert.equal(garageRetrievalStatus(state).ok, true);
  for (const delta of [{ready: false}, {occupied: true}, {busy: true}, {aboard: true}, {speed: -.11}, {speed: .2}]) {
    const candidate = {...state, ...delta}, before = structuredClone(candidate); assert.equal(garageRetrievalStatus(candidate).ok, false); assert.deepEqual(candidate, before);
  }
});

test('all garage cabin routes distinguish floor grounding from a blocking wall in the destination frame', () => {
  const nav = {position: new Vector3(), orientation: new Quaternion(), layout: SHIP_LAYOUT, mode: 'walk', insideShip: false};
  const system = createSettlements({scene: new Scene(), nav, render: false});
  try {for (const s of sites) {
    const q = new Quaternion(...s.claim.quaternion), rotation = q.clone().multiply(new Quaternion().setFromAxisAngle(UP, s.garage.rotation));
    const position = new Vector3(...s.garage.position).applyQuaternion(q).add(new Vector3(...s.claim.origin));
    const points = [ROVER_LAYOUT.cabin.entryGround, ...ROVER_LAYOUT.cabin.entryRoute].map(p => new Vector3(...p).applyQuaternion(rotation).add(position));
    for (let i = 1; i < points.length; i++) {
      const contact = system.constrainWalker(points[i - 1], points[i]);
      const lateral = contact.point.clone().sub(points[i]).projectOnPlane(UP.clone().applyQuaternion(rotation)).length();
      assert.ok(!contact.hit || contact.grounded && lateral < .02, `${s.id} boarding route ${i}`);
    }
  }} finally {system.dispose();}
});

for (const site of sites) test(`${site.body}: Sentry garage supports both seats and actual ramp drive`, () => {
  const q = new Quaternion(...site.claim.quaternion), origin = new Vector3(...site.claim.origin);
  const construction = createRoverBuildSupport({claims: () => [site.claim]});
  const buildings = createSettlements({scene: new Scene(), nav: {position: new Vector3(), orientation: new Quaternion(), layout: SHIP_LAYOUT, mode: 'walk', insideShip: false}, render: false});
  const environment = createSentryEnvironment({construction, buildingRaycast: construction.rayBlocked});
  const exact = createSentryEnvironment({construction, buildingRaycast: (...args) => buildings.raycast(...args)});
  const position = new Vector3(...site.garage.position).applyQuaternion(q).add(origin);
  const quaternion = q.clone().multiply(new Quaternion().setFromAxisAngle(UP, site.garage.rotation));
  const rover = createSentrySimulation({id: 'garage-test', position, quaternion, sampleSupport: environment.support, referenceUp: environment.up, constrain: environment.constrain});
  rover.physics.step(1/60, {brake: 1});
  assert.equal(rover.physics.state.supported, true);
  assert.ok(rover.physics.state.wheels.every(w => w.source.startsWith('construction:')));
  for (const role of Object.keys(SENTRY_LAYOUT.seats)) {
    assert.ok(rover.ground(role), `${role} floor`);
    const route = [rover.ground(role), ...SENTRY_LAYOUT.seats[role].route.map(rover.world)];
    for (let i = 1; i < route.length; i++) assert.ok(exact.accessClear(route[i-1], route[i]), `${role} route ${i}`);
  }
  assert.ok(exact.clearPose(rover.physics.state.position, rover.physics.state.quaternion));
  const local = () => rover.physics.state.position.clone().sub(origin).applyQuaternion(q.clone().invert());
  for (let frame = 0; frame < 1800 && local().x < site.garage.rampEnd[0] + 3; frame++) {
    rover.physics.step(1/60, {throttle: .5});
    assert.equal(rover.physics.state.blocked, false, `${rover.physics.state.reason} at ${local().toArray()}`);
  }
  assert.ok(local().x > site.garage.rampEnd[0] + 3);
  assert.ok(rover.physics.state.wheels.every(w => w.source === 'terrain'));
  buildings.dispose();
});

test('Sentry retrieval rejects either crew member, a moving door, motion, carrier and destroyed hull', () => {
  const state = {health: 72, charge: .24, speed: 0, seats: {pilot: {id: null}, gunner: {id: null}}};
  assert.equal(sentryRetrievalStatus(null).ok, true);
  assert.equal(sentryRetrievalStatus(state).ok, true);
  for (const change of [{seats: {pilot: {id: 'p'}}}, {seats: {gunner: {id: 'g'}}}, {busy: true}, {speed: -.11}, {carrier: 'atlas'}, {health: 0}, {destroyed: true}]) {
    const candidate = {...state, ...change}, before = structuredClone(candidate);
    assert.equal(sentryRetrievalStatus(candidate).ok, false); assert.deepEqual(candidate, before);
  }
});

test('the other rover must clear the shared bay, without confusing unspawned or distant bodies', () => {
  const point = [25e9, 400, -900];
  assert.equal(garageBayAvailable(point, null), true);
  assert.equal(garageBayAvailable(point, {position: point, spawned: false}), true);
  assert.equal(garageBayAvailable(point, {position: [25e9 + 6.9, 400, -900]}), false);
  assert.equal(garageBayAvailable(point, {position: [25e9 + 7, 400, -900]}), true);
});


test('cached short construction rays match canonical kit raycasts, including live doors and ramps', () => {
  const nav = {position: new Vector3(), orientation: new Quaternion(), layout: SHIP_LAYOUT, mode: 'walk', insideShip: false};
  const buildings = createSettlements({scene: new Scene(), nav, render: false});
  const construction = createRoverBuildSupport({claims: () => sites.map(s => s.claim)});
  try {
    for (const site of sites) {
      const q = new Quaternion(...site.claim.quaternion), origin = new Vector3(...site.claim.origin);
      const world = p => new Vector3(...p).applyQuaternion(q).add(origin), deck = site.garage.position[1], z = site.garage.position[2];
      for (const x of [25, 32, 38, 43]) for (const y of [.15, 1.75, 4.1, 6.1]) for (const direction of [[1,0,0],[0,-1,0],[0,0,1]]) {
        const start = world([x, deck + y, z]), dir = new Vector3(...direction).applyQuaternion(q);
        assert.equal(construction.rayBlocked(start, dir, 6), Boolean(buildings.raycast(start, dir, 6)), `${site.id} ${x},${y} ${direction}`);
      }
    }
  } finally {buildings.dispose();}
  let open = false;
  const claim = {id:'door',origin:[25e9,0,0],quaternion:[0,0,0,1],radius:20,pieces:[{id:'gate',type:'hangar-door',position:[0,0,0],rotation:0}]};
  const door = createRoverBuildSupport({claims:()=>[claim],doorFraction:()=>open});
  const start = new Vector3(25e9,2,3), direction = new Vector3(0,0,-1);
  assert.equal(door.rayBlocked(start,direction,6),true);open=true;
  assert.equal(door.rayBlocked(start,direction,6),false);
});


test('construction body sweeps retain Sentry turret height while tyre support owns the ramp floor', () => {
  const claim = {id: 'low-roof', origin: [25e9, 0, 0], quaternion: [0, 0, 0, 1], radius: 20, pieces: [
    {id:'floor',type:'foundation',position:[0,0,0],rotation:0},
    {id:'roof',type:'floor',position:[0,3.4,0],rotation:0},
  ]};
  const construction = createRoverBuildSupport({claims:()=>[claim]}), pose = {position:new Vector3(25e9,0,0),quaternion:new Quaternion()};
  assert.equal(construction.clearPose(pose),true);
  assert.equal(construction.clearPose(pose,pose,{layout:SENTRY_LAYOUT}),false);
});
