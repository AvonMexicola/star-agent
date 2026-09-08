import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3, Quaternion} from 'three';
import {createSettlementLayouts} from '../src/settlements/layout.js';
import {createRoverBuildSupport} from '../src/rover-build-support.js';
import {createRoverPhysics} from '../src/rover-physics.js';
import {sampleRoverSupport} from '../src/rover-support.js';
import {bodyAt, bodyOffset} from '../src/celestial.js';
import {garageRetrievalStatus} from '../src/settlements/garage-policy.js';
import {terminalPieceFrame} from '../src/trading/terminal-frames.js';
const UP = new Vector3(0, 1, 0);
const sites = createSettlementLayouts();

for (const site of sites) test(`${site.body}: four wheels leave the garage over actual kit support and reach canonical terrain`, () => {
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
