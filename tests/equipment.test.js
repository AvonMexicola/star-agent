// Unit checks for src/equipment.js — pure logic only, no WebGL context needed.
//   node --test --test-isolation=none tests/equipment.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';

import {
  ITEMS, HELD_ITEMS, WORN_ITEMS, RIGS, SOCKETS, SOCKETS_URL, FALLBACK_SOCKETS,
  FireGate, HeatSink, advanceTracer, resolveSocket, socketScale, composeMuzzle,
  Equipment,
} from '../src/equipment.js';

const near = (actual, expected, tolerance, message) =>
  assert.ok(Math.abs(actual - expected) <= tolerance,
    `${message || ''} expected ${expected} ± ${tolerance}, got ${actual}`);

// ------------------------------------------------------------------- contract

test('the item table covers exactly the five props the manifest ships as gear', () => {
  assert.deepEqual(Object.keys(ITEMS), [
    'rifle-laser', 'sidearm-pistol', 'mining-laser-tool',
    'backpack-life-support', 'helmet-standalone',
  ]);
  assert.deepEqual([...HELD_ITEMS], ['rifle-laser', 'sidearm-pistol', 'mining-laser-tool']);
  assert.deepEqual([...WORN_ITEMS], ['backpack-life-support', 'helmet-standalone']);
});

test('every item names a known socket and a file under public/models/props', () => {
  for (const [name, spec] of Object.entries(ITEMS)) {
    assert.equal(spec.name, name, `${name} carries the wrong name`);
    assert.ok(SOCKETS.includes(spec.socket), `${name} wants unknown socket ${spec.socket}`);
    assert.match(spec.file, /^\/models\/props\/.+\.glb$/, `${name} file`);
  }
  assert.equal(ITEMS['rifle-laser'].socket, 'RightHand');
  assert.equal(ITEMS['sidearm-pistol'].socket, 'RightHand');
  assert.equal(ITEMS['mining-laser-tool'].socket, 'RightHand');
  assert.equal(ITEMS['backpack-life-support'].socket, 'Spine2');
  assert.equal(ITEMS['helmet-standalone'].socket, 'Head');
});

test('anything that shoots has a unit barrel axis, a muzzle point and a range', () => {
  for (const name of HELD_ITEMS) {
    const spec = ITEMS[name];
    assert.ok(spec.shot === 'tracer' || spec.shot === 'beam', `${name} shot kind`);
    const axis = spec.barrelAxis;
    near(Math.hypot(axis[0], axis[1], axis[2]), 1, 1e-6, `${name} barrel axis is not unit:`);
    assert.equal(spec.muzzle.length, 3, `${name} muzzle`);
    // The muzzle must sit inside the item, i.e. within its own length of the origin.
    assert.ok(Math.hypot(...spec.muzzle) <= spec.length, `${name} muzzle is outside the model`);
    assert.ok(spec.range > 0, `${name} range`);
  }
  assert.equal(ITEMS['rifle-laser'].range, 4000, 'the tracer cap is 4 km');
  assert.equal(ITEMS['sidearm-pistol'].range, 4000);
  assert.equal(ITEMS['rifle-laser'].muzzleSpeed, 400, 'bolts fly at 400 m/s');
});

test('the aim clips are ones character.js actually knows, and only the guns recoil', () => {
  assert.equal(ITEMS['rifle-laser'].aimClip, 'aim-rifle');
  // Meshy shipped no `aim-pistol` / `use-tool`; both fall back to the rifle aim.
  assert.equal(ITEMS['sidearm-pistol'].aimClip, 'aim-rifle');
  assert.equal(ITEMS['mining-laser-tool'].aimClip, 'aim-rifle');
  assert.equal(ITEMS['rifle-laser'].fireClip, 'fire-rifle');
  assert.equal(ITEMS['sidearm-pistol'].fireClip, 'fire-pistol');
  assert.equal(ITEMS['mining-laser-tool'].fireClip, null, 'a beam has no one-shot recoil');
  assert.equal(ITEMS['rifle-laser'].aiming, 'rifle');
  assert.equal(ITEMS['sidearm-pistol'].aiming, 'pistol');
});

test('both two-handed items expose a support-hand grip for a later IK pass', () => {
  assert.equal(ITEMS['rifle-laser'].handed, 2);
  assert.equal(ITEMS['mining-laser-tool'].handed, 2);
  assert.equal(ITEMS['sidearm-pistol'].handed, 1);
  for (const name of ['rifle-laser', 'mining-laser-tool']) {
    assert.equal(ITEMS[name].leftGrip.length, 3, `${name} leftGrip`);
  }
  assert.equal(ITEMS['sidearm-pistol'].leftGrip, null);
});

// ------------------------------------------------------------------ fire rate

test('the fire gate lets exactly one shot through per interval', () => {
  const gate = new FireGate(5);                       // 5 rounds a second → 0.2 s
  near(gate.interval, 0.2, 1e-9);
  assert.equal(gate.tryFire(), true, 'the first pull always goes through');
  assert.equal(gate.tryFire(), false, 'never twice in the same frame');
  gate.update(0.1);
  assert.equal(gate.ready, false);
  assert.equal(gate.tryFire(), false, 'half an interval is not enough');
  gate.update(0.1);
  assert.equal(gate.ready, true);
  assert.equal(gate.tryFire(), true);
});

test('a held trigger at 60 fps yields the rated number of rounds a second', () => {
  const gate = new FireGate(ITEMS['rifle-laser'].fireRate);
  let rounds = 0;
  for (let i = 0; i < 60; i++) { gate.update(1 / 60); if (gate.tryFire()) rounds++; }
  assert.equal(rounds, 5, 'the carbine fires five rounds in one second');

  const pistol = new FireGate(ITEMS['sidearm-pistol'].fireRate);
  rounds = 0;
  for (let i = 0; i < 120; i++) { pistol.update(1 / 60); if (pistol.tryFire()) rounds++; }
  assert.equal(rounds, 6, 'the sidearm fires three a second, six in two');
});

test('a zero rate means no gating at all (the mining laser is continuous)', () => {
  const gate = new FireGate(ITEMS['mining-laser-tool'].fireRate);
  assert.equal(gate.interval, 0);
  assert.equal(gate.tryFire(), true);
  assert.equal(gate.tryFire(), true);
});

test('the gate survives a nonsense dt', () => {
  const gate = new FireGate(5);
  gate.tryFire();
  gate.update(NaN);
  gate.update(-10);
  assert.equal(gate.ready, false, 'garbage never refunds the cooldown');
  gate.update(0.2);
  assert.equal(gate.ready, true);
});

// ---------------------------------------------------------------- heat budget

test('heat rises at 0.35/s while the beam is on', () => {
  const sink = new HeatSink(ITEMS['mining-laser-tool'].heat);
  assert.equal(sink.heat, 0);
  for (let i = 0; i < 60; i++) assert.equal(sink.update(1 / 60, true), true, 'the beam stays on');
  near(sink.heat, 0.35, 1e-9, 'one second of beam:');
  assert.equal(sink.overheated, false);
});

test('heat falls at 0.5/s with the trigger up, and never below zero', () => {
  const sink = new HeatSink(ITEMS['mining-laser-tool'].heat);
  for (let i = 0; i < 120; i++) sink.update(1 / 60, true);      // 2 s → 0.70
  near(sink.heat, 0.7, 1e-9);
  for (let i = 0; i < 60; i++) assert.equal(sink.update(1 / 60, false), false, 'off means off');
  near(sink.heat, 0.2, 1e-9, 'one second of cooling:');
  for (let i = 0; i < 60; i++) sink.update(1 / 60, false);
  assert.equal(sink.heat, 0);
});

test('a full bar overheats, locks the trigger for 2 s and is empty again when it clears', () => {
  const sink = new HeatSink(ITEMS['mining-laser-tool'].heat);
  // 1 / 0.35 ≈ 2.857 s of beam to fill the bar.
  let seconds = 0;
  while (!sink.overheated && seconds < 10) { sink.update(1 / 60, true); seconds += 1 / 60; }
  assert.equal(sink.overheated, true, 'the bar fills');
  near(seconds, 1 / 0.35, 0.02, 'seconds to overheat:');
  assert.equal(sink.heat, 1);
  assert.equal(sink.lockout, 2);
  assert.equal(sink.ready, false);

  // Holding the trigger down through the lockout changes nothing.
  for (let i = 0; i < 60; i++) assert.equal(sink.update(1 / 60, true), false, 'locked out');
  near(sink.lockout, 1, 1e-9);
  near(sink.heat, 0.5, 1e-9, 'it cools through the lockout:');
  assert.equal(sink.overheated, true);

  for (let i = 0; i < 60; i++) sink.update(1 / 60, true);
  assert.equal(sink.overheated, false, 'the lockout ends after 2 s');
  near(sink.heat, 0, 1e-9, 'cool 0.5/s over a 2 s lockout empties the bar exactly:');
  assert.equal(sink.update(1 / 60, true), true, 'and the beam comes straight back');
});

test('reset clears heat, the lock and the timer', () => {
  const sink = new HeatSink({ rise: 1, cool: 0.5, lockout: 2 });
  sink.update(1.5, true);
  assert.equal(sink.overheated, true);
  sink.reset();
  assert.deepEqual([sink.heat, sink.overheated, sink.lockout], [0, false, 0]);
});

// --------------------------------------------------------------- tracer flight

test('a bolt flies 400 m/s and stops on the aim point', () => {
  const { range, muzzleSpeed } = ITEMS['rifle-laser'];
  let step = advanceTracer(0, 1 / 60, muzzleSpeed, 20, range);
  near(step.travelled, 400 / 60, 1e-9, 'one frame of flight:');
  assert.equal(step.done, false);
  assert.equal(step.hit, false);

  // 20 m at 400 m/s is 0.05 s — three frames.
  step = advanceTracer(step.travelled, 1 / 60, muzzleSpeed, 20, range);
  step = advanceTracer(step.travelled, 1 / 60, muzzleSpeed, 20, range);
  assert.equal(step.done, true);
  assert.equal(step.hit, true);
  assert.equal(step.travelled, 20, 'it lands exactly on the point, never past it');
});

test('a bolt with no aim point gives up at 4 km and reports no hit', () => {
  const { range, muzzleSpeed } = ITEMS['rifle-laser'];
  const almost = advanceTracer(range - 1, 1 / 60, muzzleSpeed, Infinity, range);
  assert.deepEqual(almost, { travelled: range, done: true, hit: false });
  near(range / muzzleSpeed, 10, 1e-9, '4 km at 400 m/s is ten seconds of flight');
});

test('an aim point beyond the range is never reached', () => {
  const step = advanceTracer(3999, 1, 400, 5000, 4000);
  assert.equal(step.travelled, 4000);
  assert.equal(step.done, true);
  assert.equal(step.hit, false, 'a target outside the range is not a hit');
});

test('a target already reached resolves on the first step', () => {
  const step = advanceTracer(0, 1 / 60, 400, 0.5, 4000);
  assert.deepEqual(step, { travelled: 0.5, done: true, hit: true });
});

// ----------------------------------------------------------- socket algebra

test('socketScale undoes a bone\'s world scale so offsets read as metres', () => {
  const plain = new THREE.Object3D();
  plain.updateWorldMatrix(true, false);
  near(socketScale(plain), 1, 1e-9, 'an unscaled rig:');

  // The two Meshy pilots hang their whole skeleton off a 0.01 armature.
  const armature = new THREE.Object3D();
  armature.scale.setScalar(0.01);
  const bone = new THREE.Object3D();
  bone.position.set(0, 22.3, 0);
  armature.add(bone);
  armature.updateWorldMatrix(true, true);
  near(socketScale(bone), 100, 1e-6, 'a 0.01 armature:');
  assert.equal(socketScale(null), 1);
});

test('a scale-compensated socket puts a 5 cm offset 5 cm away on either rig', () => {
  for (const armatureScale of [1, 0.01]) {
    const armature = new THREE.Object3D();
    armature.scale.setScalar(armatureScale);
    const bone = new THREE.Object3D();
    armature.add(bone);
    const socket = new THREE.Object3D();
    bone.add(socket);
    armature.updateWorldMatrix(true, true);
    socket.scale.setScalar(socketScale(bone));
    const item = new THREE.Object3D();
    item.position.set(0.05, 0, 0);
    socket.add(item);
    armature.updateWorldMatrix(true, true);
    const world = new THREE.Vector3().setFromMatrixPosition(item.matrixWorld);
    near(world.x, 0.05, 1e-9, `armature scale ${armatureScale}:`);
  }
});

test('resolveSocket reads the calibration and falls back without throwing', () => {
  const sockets = {
    rigs: {
      'player-male': {
        bones: { RightHand: 'RightHand', Spine2: 'Spine', Head: 'Head' },
        items: { 'rifle-laser': { position: [1, 2, 3], rotation: [10, 20, 30] } },
        holster: { 'rifle-laser': { position: [4, 5, 6], rotation: [40, 50, 60] } },
      },
    },
  };
  const hand = resolveSocket(sockets, 'player-male', 'rifle-laser');
  assert.deepEqual(hand, { bone: 'RightHand', position: [1, 2, 3], rotation: [10, 20, 30], calibrated: true });

  const slung = resolveSocket(sockets, 'player-male', 'rifle-laser', 'holster');
  assert.equal(slung.bone, 'Spine', 'a slung weapon rides the chest bone, whatever it is called');
  assert.deepEqual(slung.position, [4, 5, 6]);

  // The backpack has no entry here: identity offset, the rig's own Spine2 bone.
  const missing = resolveSocket(sockets, 'player-male', 'backpack-life-support');
  assert.equal(missing.calibrated, false);
  assert.deepEqual(missing.position, [0, 0, 0]);
  assert.equal(missing.bone, 'Spine');

  // An unknown rig, and no calibration at all, both resolve to the default names.
  assert.equal(resolveSocket(sockets, 'nobody', 'rifle-laser').bone, FALLBACK_SOCKETS.bones.RightHand);
  assert.equal(resolveSocket(null, 'mannequin', 'helmet-standalone').bone, 'Head');
  assert.equal(resolveSocket(undefined, 'mannequin', 'rifle-laser').calibrated, false);
});

// -------------------------------------------------------- muzzle composition

test('composeMuzzle carries the muzzle point and the barrel through a transform', () => {
  const item = new THREE.Object3D();
  item.position.set(1, 2, 3);
  item.updateWorldMatrix(true, false);
  const position = new THREE.Vector3();
  const direction = new THREE.Vector3();
  composeMuzzle(item.matrixWorld, [-0.55, 0.19, 0], [-1, 0, 0], position, direction);
  assert.deepEqual(position.toArray().map((v) => Number(v.toFixed(6))), [0.45, 2.19, 3]);
  assert.deepEqual(direction.toArray().map((v) => Number(v.toFixed(6))), [-1, 0, 0]);
});

test('a rifle rotated to aim down -Z puts its muzzle a barrel length ahead', () => {
  const spec = ITEMS['rifle-laser'];
  const item = new THREE.Object3D();
  // The calibration's job: send the item's -X (the barrel) along the world -Z.
  item.quaternion.setFromUnitVectors(new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 0, -1));
  item.position.set(0.3, 1.4, -0.2);                 // roughly a hand in the aim pose
  item.updateWorldMatrix(true, false);
  const position = new THREE.Vector3();
  const direction = new THREE.Vector3();
  composeMuzzle(item.matrixWorld, spec.muzzle, spec.barrelAxis, position, direction);
  near(direction.z, -1, 1e-6, 'the barrel points forward:');
  near(direction.x, 0, 1e-6);
  near(position.z, -0.2 - 0.55, 1e-6, 'the muzzle is 0.55 m ahead of the item origin:');
});

test('composeMuzzle survives a degenerate axis rather than emitting NaN', () => {
  const position = new THREE.Vector3();
  const direction = new THREE.Vector3();
  composeMuzzle(new THREE.Matrix4(), null, [0, 0, 0], position, direction);
  assert.deepEqual(position.toArray(), [0, 0, 0]);
  assert.deepEqual(direction.toArray(), [0, 0, -1], 'it falls back to the game forward');
});

test('the muzzle of a scaled Meshy socket still lands in metres', () => {
  const armature = new THREE.Object3D();
  armature.scale.setScalar(0.01);
  const bone = new THREE.Object3D();
  armature.add(bone);
  const socket = new THREE.Object3D();
  bone.add(socket);
  armature.updateWorldMatrix(true, true);
  socket.scale.setScalar(socketScale(bone));
  const item = new THREE.Object3D();
  socket.add(item);
  armature.updateWorldMatrix(true, true);
  const position = new THREE.Vector3();
  const direction = new THREE.Vector3();
  composeMuzzle(item.matrixWorld, ITEMS['rifle-laser'].muzzle, [-1, 0, 0], position, direction);
  near(position.x, -0.55, 1e-6, 'not -0.0055 and not -55:');
  near(direction.length(), 1, 1e-6);
});

// ------------------------------------------------- the shipped calibration file

const sockets = JSON.parse(await readFile(new URL('../public' + SOCKETS_URL, import.meta.url), 'utf8'));

test('the socket file is where equipment.js looks for it and covers all three rigs', () => {
  assert.equal(SOCKETS_URL, '/models/props/equipment-sockets.json');
  assert.deepEqual(Object.keys(sockets.rigs), [...RIGS]);
});

test('every rig × item pair is calibrated, in both the hand and the holster', () => {
  for (const rig of RIGS) {
    for (const item of Object.keys(ITEMS)) {
      const offset = resolveSocket(sockets, rig, item);
      assert.equal(offset.calibrated, true, `${rig} × ${item} has no hand calibration`);
      assert.equal(offset.position.length, 3);
      assert.equal(offset.rotation.length, 3);
      for (const value of [...offset.position, ...offset.rotation]) {
        assert.ok(Number.isFinite(value), `${rig} × ${item} holds ${value}`);
      }
      // Nothing should sit more than a metre away from its own bone.
      assert.ok(Math.hypot(...offset.position) < 1,
        `${rig} × ${item} is ${Math.hypot(...offset.position).toFixed(2)} m off its socket`);
      for (const angle of offset.rotation) assert.ok(Math.abs(angle) <= 180, `${rig} × ${item} angle`);

      if (!ITEMS[item].holsterable) continue;
      const slung = resolveSocket(sockets, rig, item, 'holster');
      assert.equal(slung.calibrated, true, `${rig} × ${item} has no holster calibration`);
      assert.ok(Math.hypot(...slung.position) < 1, `${rig} × ${item} holster offset`);
    }
  }
});

test('each rig maps every logical socket onto a bone name', () => {
  for (const rig of RIGS) {
    const bones = sockets.rigs[rig].bones;
    for (const socket of SOCKETS) {
      assert.equal(typeof bones[socket], 'string', `${rig} has no bone for ${socket}`);
      assert.ok(bones[socket].length, `${rig}.${socket} is empty`);
    }
  }
  // The mannequin is plain Mixamo; the Meshy pilots call the chest bone `Spine`.
  assert.equal(sockets.rigs.mannequin.bones.Spine2, 'Spine2');
  assert.equal(sockets.rigs['player-male'].bones.Spine2, 'Spine');
  assert.equal(sockets.rigs['player-female'].bones.Spine2, 'Spine');
});

// Which way "behind the character" runs in the chest bone's own frame: the
// mannequin was authored facing -Z, the two Meshy pilots facing +Z, so their
// chest bones' +Z points the opposite way.
const BACK = Object.freeze({ mannequin: 1, 'player-male': -1, 'player-female': -1 });

test('a slung weapon really is on the back, and the pack is behind the chest', () => {
  for (const rig of RIGS) {
    for (const item of ['rifle-laser', 'mining-laser-tool']) {
      const slung = resolveSocket(sockets, rig, item, 'holster');
      assert.ok(slung.position[2] * BACK[rig] > 0.05,
        `${rig}'s slung ${item} is at z ${slung.position[2]}, not behind the chest bone`);
    }
    const pack = resolveSocket(sockets, rig, 'backpack-life-support');
    assert.ok(pack.position[2] * BACK[rig] > 0.05,
      `${rig}'s pack is at z ${pack.position[2]}, not on the back`);
    const helmet = resolveSocket(sockets, rig, 'helmet-standalone');
    assert.ok(Math.abs(helmet.position[1]) < 0.25, `${rig}'s helmet sits ${helmet.position[1]} m off the head`);
  }
});

// -------------------------------------------------------------- the class itself

test('the module exports the class main.js wires in', () => {
  assert.equal(typeof Equipment, 'function');
  for (const method of ['equip', 'unequip', 'holster', 'update', 'dispose',
    'firingInput', 'aimingInput', 'setFirstPersonOffset', 'setRenderOrigin',
    'muzzleWorldPosition', 'muzzleWorldDirection', 'leftHandTargetWorld']) {
    assert.equal(typeof Equipment.prototype[method], 'function', `Equipment#${method}`);
  }
  for (const getter of ['equipped', 'holstered', 'heat', 'overheated', 'lockout', 'beaming',
    'worn', 'item', 'leftHandTargetLocal']) {
    assert.ok(Object.getOwnPropertyDescriptor(Equipment.prototype, getter)?.get,
      `Equipment#${getter} is not a getter`);
  }
});
