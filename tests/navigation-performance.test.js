import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { Navigation } from '../src/navigation.js';
import { BODIES, bodyAltitude, bodySurfacePoint } from '../src/celestial.js';
import { SEED, setPlanetSeed } from '../src/generation.js';

function at(position) {
  const nav = Object.create(Navigation.prototype);
  nav.position = position.clone();
  return nav;
}

test('changing the planet seed invalidates terrain at an unchanged position', () => {
  const seed = SEED;
  try {
    setPlanetSeed(7291);
    const nav = at(bodySurfacePoint(new Vector3(.31, .82, -.48).normalize(), BODIES[0], 100));
    const before = nav.altitude;
    setPlanetSeed(7292);
    const expected = Math.max(0, bodyAltitude(nav.position, nav.body));
    assert.notEqual(expected, before);
    assert.equal(nav.altitude, expected);
  } finally { setPlanetSeed(seed); }
});

test('altitude reuse matches canonical terrain across bodies, substeps and corrections', () => {
  const direction = new Vector3(.31, .82, -.48).normalize();
  for (const body of BODIES) {
    const nav = at(bodySurfacePoint(direction, body, 100));
    for (const change of [new Vector3(), new Vector3(.00001, 0, 0), new Vector3(0, -.125, 0), new Vector3(0, 0, .25)]) {
      nav.position.add(change);
      const expected = Math.max(0, bodyAltitude(nav.position, nav.body));
      for (let i = 0; i < 10; i++) assert.equal(nav.altitude, expected);
    }
    // Both replacing the vector and mutating it in place occur in navigation.
    nav.position = bodySurfacePoint(direction, body, -20);
    assert.equal(nav.altitude, Math.max(0, bodyAltitude(nav.position, nav.body)));
    nav.position.set(...body.center);
    assert.equal(nav.altitude, Math.max(0, bodyAltitude(nav.position, nav.body)));
  }
});

test('repeated reads sample once and every exact coordinate/body change resamples', () => {
  let calls = 0;
  const body = { center: [0, 0, 0], radius: 10, height() { calls++; return 2; } };
  const nav = at(new Vector3(0, 20, 0));
  Object.defineProperty(nav, 'body', { configurable: true, value: body });
  for (let i = 0; i < 100; i++) assert.equal(nav.altitude, 8);
  assert.equal(calls, 1);
  for (const axis of ['x', 'y', 'z']) {
    nav.position[axis] += .000001;
    void nav.altitude;
  }
  assert.equal(calls, 4, 'no distance threshold or frame-lifetime cache');
  Object.defineProperty(nav, 'body', { value: { ...body, radius: 9 } });
  void nav.altitude;
  assert.equal(calls, 5, 'body identity invalidates the sample');
});
