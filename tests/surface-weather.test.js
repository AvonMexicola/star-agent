import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Scene, Vector3 } from 'three';
import { AEON, SELENE, PYRE, MIASMA, bodySurfacePoint } from '../src/celestial.js';
import { createWeatherField, sampleWeatherField, surfaceWeatherProfile, SurfaceWeather, weatherGridOffset } from '../src/surface-weather.js';

test('aerosol fields sample canonical terrain in local metres on every world, including poles', () => {
  for (const body of [AEON, SELENE, PYRE, MIASMA]) for (const direction of [new Vector3(.3,.6,.8).normalize(), new Vector3(0,1,0)]) {
    const position = bodySurfacePoint(direction, body, 6), field = createWeatherField(body, position);
    while (!sampleWeatherField(field, 128)) {}
    for (const index of [0, 37, 312, 624]) {
      const x = weatherGridOffset(index % field.size);
      const y = weatherGridOffset(Math.floor(index / field.size));
      const d = field.anchor.clone().addScaledVector(field.east, x).addScaledVector(field.north, y).normalize();
      const expected = d.clone().multiplyScalar(body.radius + body.height(...d.toArray())).sub(field.anchor).dot(field.up);
      assert.ok(Math.abs(field.data[index] - expected) < .001);
    }
    const shifted = { ...body, center: body.center.map((v, i) => v + [2.3e10,-1.5e10,7.3e9][i]) };
    const translated = createWeatherField(shifted, position.clone().add(new Vector3(2.3e10,-1.5e10,7.3e9)));
    assert.ok(field.anchor.distanceTo(translated.anchor) < .001, `${body.id} must rebase before Float32 upload`);
  }
});

test('Selene keeps a shallow dust layer and the star has no weather', () => {
  const d = [.3,.6,.7416198487];
  assert.equal(surfaceWeatherProfile('star', d, 0), null);
  assert.ok(surfaceWeatherProfile('selene', d, 0).height < 5);
  assert.equal(SELENE.airless, true);
  assert.notDeepEqual(surfaceWeatherProfile('miasma', d, 0).color, surfaceWeatherProfile('pyre', d, 0).color);
});

test('terrain cache publishes complete fields, stays resident, and weather clears in shelters, orbit and body changes', () => {
  const scene = new Scene(), weather = new SurfaceWeather(scene, { material: { uniforms: {} } });
  const position = bodySurfacePoint(new Vector3(.3,.6,.8).normalize(), MIASMA, 3), sun = new Vector3(1,0,0);
  for (let i=0;i<20;i++) weather.update(position, MIASMA, sun, i*.1, .1);
  assert.equal(weather.state.ready, true);
  assert.ok(weather.state.strength > .5);
  const field = weather.field;
  for (let i=0;i<20;i++) weather.update(position, MIASMA, sun, i*.1+2, .1);
  assert.equal(weather.field, field);
  assert.equal(weather.pending, null);
  const remote = bodySurfacePoint(new Vector3(.31,.6,.8).normalize(), MIASMA, 3);
  weather.update(remote, MIASMA, sun, 4, .1);
  assert.equal(weather.state.strength, 0, 'same-body transit must not reuse fog from the old location');
  assert.equal(weather.state.ready, false);
  weather.update(bodySurfacePoint(new Vector3(.3,.6,.8).normalize().negate(), MIASMA, 3), MIASMA, sun, 4, .1);
  assert.equal(weather.state.ready, false, 'the opposite hemisphere cannot reuse a tangent-plane cache');
  weather.update(position, MIASMA, sun, 4, .1, {sheltered:true});
  assert.equal(weather.state.strength, 0);
  assert.equal(weather.particles.visible, false);
  weather.update(bodySurfacePoint(new Vector3(0,1,0), SELENE, 3), SELENE, sun, 5, .1);
  assert.equal(weather.state.strength, 0);
  weather.update(bodySurfacePoint(new Vector3(0,1,0), SELENE, 25000), SELENE, sun, 6, .1);
  assert.equal(weather.state.strength, 0);
  weather.dispose();
  assert.equal(scene.children.length, 0);
});
