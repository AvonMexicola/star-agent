import test from 'node:test';
import assert from 'node:assert/strict';
import { Scene, Vector3 } from 'three';
import { roverSurfaceStart } from '../src/rover-surface-start.js';
import { createRoverPhysics } from '../src/rover-physics.js';
import { sampleRoverSupport } from '../src/rover-support.js';
import { bodyOffset, bodyAltitude, SELENE } from '../src/celestial.js';
import { MineableRock } from '../src/mining/rock.js';
import { ROVER_LAYOUT } from '../src/rover-layout.js';

function crescent() {
  const rock = new MineableRock(new Scene(), null, { worker: { postMessage() {}, terminate() {} } });
  const position = rock.position.clone(); rock.dispose(); return position;
}

test('the actual Crescent outcrop has a nearby terrain-supported rover start with all wheels settled', () => {
  const target = crescent(), start = roverSurfaceStart(target);
  assert.ok(start); assert.equal(start.body, 'selene');
  assert.ok(start.distance > 10 && start.distance < ROVER_LAYOUT.mining.range - 4);
  const physics = createRoverPhysics({ position: start.position, quaternion: start.quaternion,
    sampleSupport: sampleRoverSupport, referenceUp: point => bodyOffset(point, SELENE).normalize() });
  physics.step(1 / 60, { brake: 1 });
  assert.equal(physics.state.supported, true); assert.equal(physics.state.blocked, false);
  assert.equal(physics.state.speed, 0); assert.equal(physics.state.wheels.length, 4);
  for (const wheel of physics.state.wheels) {
    assert.equal(wheel.source, 'terrain');
    assert.ok(Math.abs(bodyAltitude(wheel.contact, SELENE)) < .001, 'contact agrees with canonical lunar terrain');
    assert.ok(Math.abs(wheel.suspension) <= ROVER_LAYOUT.driving.suspensionTravel);
  }
  const heading = new Vector3(0, 0, -1).applyQuaternion(start.quaternion);
  const aim = target.clone().sub(start.position).projectOnPlane(start.up).normalize();
  assert.ok(heading.dot(aim) > .99999, 'cutters start facing the real outcrop');
  for (let i = 0; i < 30; i++) physics.step(1 / 60, { throttle: 1 });
  assert.ok(physics.state.distance > .2 && physics.state.speed > 1, 'the settled rover can drive immediately');
  assert.equal(physics.state.blocked, false);
});

test('ground placement rejects occupied or unsupported candidates and tries a clear heading', () => {
  const target = crescent(), first = roverSurfaceStart(target); let tries = 0;
  const next = roverSurfaceStart(target, { isClear: () => ++tries > 1 });
  assert.ok(next && tries === 2); assert.ok(next.position.distanceTo(first.position) > 4);
  assert.equal(roverSurfaceStart(target, { isClear: () => false }), null);
  assert.equal(roverSurfaceStart(target, { sampleSupport: () => null }), null, 'missing support cannot invent a floor');
  assert.throws(() => roverSurfaceStart(new Vector3(NaN, 0, 0)), /finite surface/);
  assert.deepEqual(target, crescent(), 'placement never moves the mining target');
});
