import test from 'node:test';
import assert from 'node:assert/strict';
import { Quaternion, Vector3 } from 'three';
import { LANDING_GEAR, evaluateLandingGear } from '../src/landing-gear.js';

const near = (actual, expected, epsilon = 1e-8) => {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected} (±${epsilon})`);
};
const bodyAt = (height = 0) => ({
  position: new Vector3(0, height, 0), orientation: new Quaternion(),
  velocity: new Vector3(), angularVelocity: new Vector3(), mass: 12000,
});
// Test fixture only. Production mounts must come from the authored ship layout.
const rig = () => [-1, 1].flatMap(x => [-1, 1].map(z => ({
  id: `${x}:${z}`, mount: new Vector3(x * 2, 1, z * 3), restLength: 1,
})));
function plane(point = new Vector3(), normal = new Vector3(0, 1, 0), velocity = new Vector3()) {
  return (origin, direction, maxDistance) => {
    const denominator = direction.dot(normal);
    if (Math.abs(denominator) < 1e-12) return null;
    const distance = point.clone().sub(origin).dot(normal) / denominator;
    return distance < 0 || distance > maxDistance ? null : { distance, normal, velocity };
  };
}
const flat = plane();

test('airborne gear issues one bounded ray per strut; retracted gear issues none', () => {
  let calls = 0;
  const result = evaluateLandingGear(bodyAt(20), rig(), (origin, direction, length, id) => {
    calls++;
    near(direction.length(), 1);
    near(length, 1);
    assert.ok(id);
    return flat(origin, direction, length);
  });
  assert.equal(calls, 4);
  assert.deepEqual(result.contacts, []);
  assert.equal(result.force.length(), 0);
  assert.equal(result.torque.length(), 0);
  const retracted = evaluateLandingGear(bodyAt(-.2), rig(), () => assert.fail('queried retracted gear'),
    { contactIds: ['old'], damageReported: true }, { deployed: false });
  assert.deepEqual(retracted.state, { contactIds: [], damageReported: false });
});

test('four springs support the ship at the analytical static sag without net torque', () => {
  const sag = 12000 * 9.81 / (4 * LANDING_GEAR.stiffness);
  const result = evaluateLandingGear(bodyAt(-sag), rig(), flat);
  near(result.force.y, 12000 * 9.81);
  near(result.supportG, 1);
  near(result.torque.length(), 0);
  assert.equal(result.contacts.length, 4);
  for (const contact of result.contacts) {
    near(contact.compression, sag);
    near(contact.point.y, 0);
    assert.equal(contact.bottomedOut, false);
  }
});

test('damping resists closing motion but never pulls a departing ship onto the floor', () => {
  const closing = bodyAt(-.1);
  closing.velocity.y = -2;
  const compressed = evaluateLandingGear(closing, rig(), flat);
  near(compressed.force.y, 4 * (120000 * .1 + 18000 * 2));
  assert.equal(compressed.events.filter(event => event.type === 'touchdown').length, 4);
  for (const event of compressed.events) near(event.speed, 2);
  closing.velocity.y = 10;
  const departing = evaluateLandingGear(closing, rig(), flat, compressed.state);
  assert.equal(departing.force.length(), 0);
  assert.deepEqual(departing.events, []);
});

test('an unloaded pad at exactly full extension does not swallow the next touchdown', () => {
  const body = bodyAt();
  const hovering = evaluateLandingGear(body, rig(), flat);
  assert.deepEqual(hovering.events, []);
  assert.deepEqual(hovering.state.contactIds, []);
  body.velocity.y = -.1;
  const touchdown = evaluateLandingGear(body, rig(), flat, hovering.state);
  assert.equal(touchdown.events.length, 4);
  assert.ok(touchdown.events.every(event => event.type === 'touchdown'));
});

test('angular velocity changes individual pad loads and produces opposing torque', () => {
  const body = bodyAt(-.3);
  body.angularVelocity.z = .1;
  const result = evaluateLandingGear(body, rig(), flat);
  assert.ok(result.torque.z < 0, 'roll damping must oppose positive roll');
  near(result.torque.x, 0);
  near(result.force.y, 4 * 120000 * .3);
  const left = result.contacts.find(contact => contact.id === '-1:-1');
  const right = result.contacts.find(contact => contact.id === '1:-1');
  assert.ok(left.load > right.load);
});

test('the contact surface velocity is subtracted before calculating damper load', () => {
  const moving = bodyAt(-.2);
  moving.velocity.set(10, 3, -5);
  const surface = plane(new Vector3(), new Vector3(0, 1, 0), moving.velocity.clone());
  const result = evaluateLandingGear(moving, rig(), surface);
  near(result.force.y, 4 * 120000 * .2);
  assert.ok(result.contacts.every(contact => contact.normalSpeed === 0));
});

test('independent surface heights produce independent compression and a restoring moment', () => {
  const body = bodyAt(-.2);
  const uneven = (origin, direction, maxDistance) =>
    plane(new Vector3(0, origin.x < 0 ? .1 : 0, 0))(origin, direction, maxDistance);
  const result = evaluateLandingGear(body, rig(), uneven);
  assert.ok(result.torque.z < 0);
  for (const contact of result.contacts) near(contact.compression, contact.point.x < 0 ? .3 : .2);
  // The deck's supplied normal determines the force, including on a slope.
  const normal = new Vector3(.05, 1, 0).normalize();
  const slope = evaluateLandingGear(body, rig(), plane(new Vector3(), normal));
  near(slope.force.clone().normalize().distanceTo(normal), 0);
});

test('travel caps animation compression and engages a progressive bump stop', () => {
  const result = evaluateLandingGear(bodyAt(-.8), rig(), flat);
  for (const contact of result.contacts) {
    near(contact.compression, .6);
    near(contact.compressionRatio, 1);
    near(contact.overtravel, .2);
    assert.equal(contact.bottomedOut, true);
    near(contact.load, 120000 * .6 + 1200000 * .2);
  }
  assert.equal(result.events.filter(event => event.type === 'hard-landing').length, 1);
});

test('damage triggers at peak contact load, once per episode, and rearms after separation', () => {
  const body = bodyAt(-.1);
  body.velocity.y = -1;
  const first = evaluateLandingGear(body, rig(), flat);
  assert.ok(first.events.every(event => event.type === 'touchdown'));
  // Peak loading may arrive AFTER touchdown: it must still trigger damage.
  body.velocity.y = -15;
  const hard = evaluateLandingGear(body, rig(), flat, first.state);
  assert.equal(hard.events.length, 1);
  assert.equal(hard.events[0].type, 'hard-landing');
  near(hard.events[0].supportG, hard.supportG);
  assert.ok(hard.events[0].excessG > 0);
  const sustained = evaluateLandingGear(body, rig(), flat, hard.state);
  assert.deepEqual(sustained.events, []);
  const airborne = evaluateLandingGear(bodyAt(2), rig(), flat, sustained.state);
  assert.equal(airborne.state.damageReported, false);
  const next = evaluateLandingGear(body, rig(), flat, airborne.state);
  assert.equal(next.events.filter(event => event.type === 'touchdown').length, 4);
  assert.equal(next.events.filter(event => event.type === 'hard-landing').length, 1);
});

test('force and torque rotate with the ship, retaining precision far from the origin', () => {
  const body = bodyAt(-.2);
  body.velocity.set(0, -.3, 0);
  body.angularVelocity.set(.02, 0, -.03);
  const reference = evaluateLandingGear(body, rig(), flat);
  const rotation = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.PI / 2);
  const offset = new Vector3(25_000_000_000, 1_592_750, -25_000_000_000);
  const moved = {
    ...body, position: body.position.clone().applyQuaternion(rotation).add(offset),
    orientation: rotation, velocity: body.velocity.clone().applyQuaternion(rotation),
  };
  const rotated = evaluateLandingGear(moved, rig(), plane(offset, new Vector3(0, 1, 0).applyQuaternion(rotation)));
  // Micrometre precision is the JS-double bound at the actual sun's distance.
  near(rotated.force.distanceTo(reference.force.clone().applyQuaternion(rotation)), 0, 2);
  near(rotated.torque.distanceTo(reference.torque.clone().applyQuaternion(rotation)), 0, 1e-6);
});

test('inputs and previous state are unchanged; separate ships do not share contact history', () => {
  const body = bodyAt(-.2), struts = rig(), previous = { contactIds: ['-1:-1'], damageReported: false };
  const normal = new Vector3(0, 2, 0), velocity = new Vector3(1, 0, 0);
  const before = structuredClone({ body, struts, previous, normal, velocity });
  const result = evaluateLandingGear(body, struts, plane(new Vector3(), normal, velocity), previous);
  assert.deepEqual(structuredClone({ body, struts, previous, normal, velocity }), before);
  assert.equal(result.events.filter(event => event.type === 'touchdown').length, 3);
  const other = evaluateLandingGear(body, struts, flat);
  assert.equal(other.events.filter(event => event.type === 'touchdown').length, 4);
});

test('sides and undersides cannot support a strut; malformed contacts fail explicitly', () => {
  for (const normal of [new Vector3(1, 0, 0), new Vector3(0, -1, 0)]) {
    const result = evaluateLandingGear(bodyAt(), rig(), () => ({ distance: .5, normal }));
    assert.equal(result.force.length(), 0);
    assert.deepEqual(result.contacts, []);
  }
  for (const distance of [-.1, 1.1, NaN, Infinity]) {
    assert.throws(() => evaluateLandingGear(bodyAt(), rig(), () => ({ distance, normal: new Vector3(0, 1, 0) })), RangeError);
  }
  assert.throws(() => evaluateLandingGear(bodyAt(), rig(), () => ({ distance: .5, normal: new Vector3() })), RangeError);
  assert.throws(() => evaluateLandingGear({ ...bodyAt(), mass: 0 }, rig(), flat), RangeError);
  const duplicate = rig(); duplicate[1].id = duplicate[0].id;
  assert.throws(() => evaluateLandingGear(bodyAt(), duplicate, () => assert.fail('queried invalid rig')), TypeError);
});

function drop(dt) {
  const body = bodyAt(.35), struts = rig();
  let state, lowest = Infinity, rebounded = false, damageEvents = 0;
  for (let frame = 0; frame < Math.round(8 / dt); frame++) {
    const result = evaluateLandingGear(body, struts, flat, state);
    state = result.state;
    damageEvents += result.events.filter(event => event.type === 'hard-landing').length;
    body.velocity.addScaledVector(result.force, dt / body.mass);
    body.velocity.y -= 9.81 * dt;
    body.position.addScaledVector(body.velocity, dt);
    lowest = Math.min(lowest, body.position.y);
    if (body.velocity.y > .05) rebounded = true;
  }
  return { body, lowest, rebounded, damageEvents };
}

test('a dropped ship compresses, rebounds and settles at spring sag at 120 and 240 Hz', () => {
  const sag = 12000 * 9.81 / (4 * LANDING_GEAR.stiffness);
  const a = drop(1 / 120), b = drop(1 / 240);
  for (const result of [a, b]) {
    assert.equal(result.rebounded, true);
    assert.ok(result.lowest < -sag, 'the first compression must pass static equilibrium');
    assert.ok(result.lowest > -.6, 'a gentle drop should fit in available suspension travel');
    near(result.body.position.y, -sag, .001);
    near(result.body.velocity.y, 0, .001);
    assert.equal(result.damageEvents, 0);
  }
  near(a.lowest, b.lowest, .015);
});
