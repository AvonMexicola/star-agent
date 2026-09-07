import test from 'node:test';
import assert from 'node:assert/strict';
import { Quaternion, Vector3 } from 'three';
import { Navigation } from '../src/navigation.js';
import { ATLAS_LAYOUT, AtlasGameplaySystems } from '../src/atlas-gameplay.js';
import { AEON, bodyAltitude, bodyOffset, bodySurfacePoint } from '../src/celestial.js';

const MEADOW_DIRECTION = new Vector3(.013692585058580798, .6056142771291465, .7956405346962626);
const MEADOW_ATTITUDE = new Quaternion(.45198957488735714, -.2555944019854732, -.15162264421697483, .841063314874384);
const DT = 1 / 60;
const near = (actual, expected, tolerance = 1e-6) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);

function setup(t, tilted = true) {
  const descriptors = ['document', 'window'].map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]);
  const surface = () => ({ addEventListener() {} });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: {
    ...surface(), querySelector: () => null, body: { classList: { toggle() {} } },
  } });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: surface() });
  t.after(() => { for (const [name, descriptor] of descriptors) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);else delete globalThis[name];
  } });
  const nav = new Navigation(surface(), () => {});
  nav.shipId = 'atlas';nav.layout = ATLAS_LAYOUT;nav.freighter = new AtlasGameplaySystems();
  nav.transit(MEADOW_DIRECTION.toArray(), 35);nav.touchDown();
  assert.equal(nav.mode, 'landed');
  nav.shipPosition.addScaledVector(MEADOW_DIRECTION, .0234348951);
  if (tilted) nav.shipOrientation.copy(MEADOW_ATTITUDE);
  nav.orientation.copy(nav.shipOrientation);
  nav.position.copy(nav.fromShipLocal(new Vector3(...nav.layout.seatEye)));
  nav.update(0); // The shared navigation hook fits the current parked pose.
  for (const ramp of nav.freighter.ramps) assert.equal(nav.freighter.toggleRamp(ramp.id), true);
  for (let i = 0; i < 360; i++) nav.update(DT);
  assert.ok(nav.freighter.ramps.every(ramp => !ramp.moving));
  nav.mode = 'walk';nav.insideShip = false;
  return nav;
}

function rampY(ramp, z) { return ramp.pivot[1] - (z - ramp.pivot[2]) * Math.tan(ramp.angle); }
function placeOnRamp(nav, ramp, distance, x = 0) {
  const z = ramp.pivot[2] + ramp.outward * distance;
  nav.position.copy(nav.fromShipLocal(new Vector3(x, rampY(ramp, z) + nav.layout.eyeHeight, z)));
  nav.velocity.set(0, 0, 0);nav.jumpHeight = nav.jumpVelocity = 0;nav.insideShip = false;
  nav.orientation.copy(nav.shipOrientation).multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), ramp.outward < 0 ? Math.PI : 0));
}

for (const tilted of [false, true]) for (const id of ['front', 'aft']) {
  test(`${id} ramp jump keeps its support through the apex and landing (${tilted ? 'tilted meadow' : 'radial hull'})`, t => {
    const nav = setup(t, tilted), ramp = nav.freighter.ramps.find(item => item.id === id);
    const shipPosition = nav.shipPosition.clone(), shipOrientation = nav.shipOrientation.clone();
    placeOnRamp(nav, ramp, 3);
    nav.keys.add('Space');nav.update(DT);nav.keys.delete('Space');
    let maximum = nav.jumpHeight;
    for (let frame = 0; frame < 100; frame++) {
      nav.update(DT);maximum = Math.max(maximum, nav.jumpHeight);
      const local = nav.toShipLocal();
      assert.ok(local.y - nav.layout.eyeHeight >= rampY(ramp, local.z) - 1e-6, `fell through at frame ${frame}`);
      assert.equal(nav.mode, 'walk');
    }
    assert.ok(maximum > .9, 'the jump exceeds ordinary step-support tolerance');
    near(nav.jumpHeight, 0);near(nav.jumpVelocity, 0);
    const local = nav.toShipLocal();near(local.y - nav.layout.eyeHeight, rampY(ramp, local.z));
    assert.ok(nav.shipPosition.equals(shipPosition));assert.ok(nav.shipOrientation.equals(shipOrientation));
  });
}

for (const id of ['front', 'aft']) {
  test(`${id} ramp walks across the toe, main panel and cargo seam, then returns to terrain`, t => {
    const nav = setup(t), ramp = nav.freighter.ramps.find(item => item.id === id);
    placeOnRamp(nav, ramp, 7.8 * Math.cos(ramp.angle));
    nav.keys.add('KeyW');
    for (let frame = 0; frame < 300 && (nav.toShipLocal().z - ramp.pivot[2]) * ramp.outward > -1; frame++) {
      const previous = nav.position.clone();nav.update(DT);
      const local = nav.toShipLocal();
      const expected = (local.z - ramp.pivot[2]) * ramp.outward >= 0 ? rampY(ramp, local.z) : nav.layout.cargo.floor;
      near(local.y - nav.layout.eyeHeight, expected);
      assert.ok(nav.position.distanceTo(previous) < .16, 'walking support remains continuous');
    }
    nav.keys.delete('KeyW');
    assert.ok((nav.toShipLocal().z - ramp.pivot[2]) * ramp.outward <= -1, 'entered cargo bay');
    assert.equal(nav.insideShip, true);
    nav.keys.add('KeyS');
    for (let frame = 0; frame < 400 && (nav.toShipLocal().z - ramp.pivot[2]) * ramp.outward < 10; frame++) {
      const previous = nav.position.clone();nav.update(DT);
      assert.ok(nav.position.distanceTo(previous) < .17, 'walking off the ramp does not teleport to the ground');
      assert.ok(bodyAltitude(nav.position, AEON) >= nav.layout.eyeHeight - 1e-6);
    }
    nav.keys.delete('KeyS');
    for (let i = 0; i < 90; i++) nav.update(DT);
    assert.ok((nav.toShipLocal().z - ramp.pivot[2]) * ramp.outward >= 10, 'left the toe');
    near(bodyAltitude(nav.position, AEON), nav.layout.eyeHeight);
    assert.equal(nav.insideShip, false);
  });
}

for (const id of ['front', 'aft']) {
  test(`${id} ramp captures a jump from below only when the feet descend through its top`, t => {
    const nav = setup(t), ramp = nav.freighter.ramps.find(item => item.id === id);
    // Find a reachable part of the real ramp that is higher than step tolerance.
    let start;
    for (let distance = 7.8 * Math.cos(ramp.angle); distance > 1; distance -= .1) {
      const z = ramp.pivot[2] + ramp.outward * distance;
      const top = nav.fromShipLocal(new Vector3(0, rampY(ramp, z), z));
      const gap = bodyAltitude(top, AEON);
      if (gap > .6 && gap < .8) { start = top;break; }
    }
    assert.ok(start, 'meadow fixture has a reachable elevated ramp surface');
    nav.position.copy(bodySurfacePoint(bodyOffset(start, AEON), AEON, nav.layout.eyeHeight));
    nav.velocity.set(0, 0, 0);nav.jumpHeight = nav.jumpVelocity = 0;
    const initial = nav.toShipLocal();
    assert.ok(initial.y - nav.layout.eyeHeight < rampY(ramp, initial.z) - .45);
    nav.keys.add('Space');nav.update(DT);nav.keys.delete('Space');
    let roseAbove = false, landed = false;
    for (let frame = 0; frame < 110; frame++) {
      const previousVelocity = nav.jumpVelocity;
      nav.update(DT);
      const local = nav.toShipLocal(), foot = local.y - nav.layout.eyeHeight, top = rampY(ramp, local.z);
      if (nav.jumpVelocity > 0) {
        assert.ok(nav.jumpHeight > 0, 'ascending feet do not acquire the upper floor');
        near(bodyAltitude(nav.position, AEON) - nav.layout.eyeHeight, nav.jumpHeight);
      }
      if (foot > top + .1) roseAbove = true;
      if (roseAbove && nav.jumpHeight === 0) {
        assert.ok(previousVelocity < 0, 'only descent lands on the ramp');near(foot, top);landed = true;break;
      }
    }
    assert.ok(roseAbove, 'jump cleared the top surface');assert.ok(landed, 'descending feet landed on the ramp');
    for (let i = 0; i < 45; i++) nav.update(DT);
    const local = nav.toShipLocal();near(local.y - nav.layout.eyeHeight, rampY(ramp, local.z));
  });
}

for (const id of ['front', 'aft']) {
  test(`${id} ramp receives a moving jump across the toe without an ascending snap`, t => {
    const nav = setup(t), ramp = nav.freighter.ramps.find(item => item.id === id);
    const toe = ramp.pivot[2] + ramp.outward * ramp.length * Math.cos(ramp.angle);
    let lane = null;
    for (let i = 0; i <= 20; i++) {
      const x = (i / 10 - 1) * (ramp.width / 2 - 1.2);
      const top = nav.fromShipLocal(new Vector3(x, rampY(ramp, toe), toe));
      const gap = bodyAltitude(top, AEON);
      if (!lane || gap < lane.gap) lane = { x, gap };
    }
    assert.ok(lane.gap < .4, 'there is a walkable approach across the toe');
    placeOnRamp(nav, ramp, ramp.length * Math.cos(ramp.angle) + .75, lane.x);
    nav.position.copy(bodySurfacePoint(bodyOffset(nav.position, AEON), AEON, nav.layout.eyeHeight));
    const poll = nav.gamepad.poll.bind(nav.gamepad);
    let forward = .68;
    nav.gamepad.poll = options => ({ ...poll(options), forward });
    nav.keys.add('Space');nav.update(DT);nav.keys.delete('Space');
    let airborneOutside = false, airborneOverRamp = false, landed = false;
    for (let frame = 0; frame < 100; frame++) {
      const previousVelocity = nav.jumpVelocity;
      nav.update(DT);
      const local = nav.toShipLocal(), distance = (local.z - ramp.pivot[2]) * ramp.outward;
      const overRamp = distance <= ramp.length * Math.cos(ramp.angle);
      if (!overRamp && nav.jumpHeight > .02) airborneOutside = true;
      if (overRamp && local.y - nav.layout.eyeHeight > rampY(ramp, local.z) + .04 && nav.jumpHeight > .02) airborneOverRamp = true;
      if (nav.jumpVelocity > 0) near(bodyAltitude(nav.position, AEON) - nav.layout.eyeHeight, nav.jumpHeight);
      if (airborneOverRamp && nav.jumpHeight === 0) {
        assert.ok(previousVelocity < 0);near(local.y - nav.layout.eyeHeight, rampY(ramp, local.z));landed = true;break;
      }
      if (distance < ramp.length * Math.cos(ramp.angle) - 2) forward = 0;
    }
    assert.ok(airborneOutside);assert.ok(airborneOverRamp);assert.ok(landed);
  });
}
