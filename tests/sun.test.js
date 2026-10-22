import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import {
  SUN_POSITION, SUN_AXIS, SUN_EXCLUSION, SUN_STANDOFF, SUN_STANDOFF_ANGLE, SUN_HEAT_RANGE, SUN_ROTATION_PERIOD, SUN_SPHERE_RANGE, SUN_DISK_FADE,
  sunAngularRadius, standoffDistance, sunStandoffPoint, sunHeat, sunDiskWeight, sunRotationAngle, flareCurve,
  constrainSunStep, sunVisibility, PROMINENCES, prominenceState,
} from '../src/sun.js';
import { RADIUS, SUN_RADIUS, SUN_DISTANCE, SUN_DIRECTION, SUN_ANGULAR_RADIUS } from '../src/world.js';
import { STAR } from '../src/celestial.js';
import { TRAVEL_TARGETS, planTravel } from '../src/travel-model.js';

const near = (actual, expected, tolerance, label) => assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} vs ${expected}`);

test('the star subtends twice the old disk from Aeon and the angle derives from its radius', () => {
  assert.equal(SUN_RADIUS, 240_000_000);
  near(SUN_ANGULAR_RADIUS, 0.0096, 0.0001, 'angular radius from Aeon');
  near(SUN_ANGULAR_RADIUS / 0.0048, 2, 0.01, 'twice the previous 0.0048 rad');
  near(sunAngularRadius(SUN_DISTANCE), SUN_ANGULAR_RADIUS, 1e-12, 'helper agrees with world.js');
  assert.equal(sunAngularRadius(SUN_RADIUS / 2), Math.PI / 2, 'inside the star the disk is a hemisphere');
  assert.ok(sunAngularRadius(SUN_STANDOFF) > sunAngularRadius(SUN_DISTANCE));
});

test('the standoff is where the disk fills 35 degrees, outside the exclusion sphere', () => {
  near(SUN_STANDOFF, SUN_RADIUS / Math.sin(SUN_STANDOFF_ANGLE / 2), 1e-6, 'R / sin(17.5°)');
  near(SUN_STANDOFF / 1000, 798_122, 1, 'about 798 000 km from the centre');
  near(2 * sunAngularRadius(SUN_STANDOFF), SUN_STANDOFF_ANGLE, 1e-12, 'full angle at the standoff');
  assert.ok(SUN_STANDOFF > SUN_EXCLUSION, 'you arrive outside the exclusion sphere');
  near(standoffDistance(Math.PI / 2), SUN_RADIUS * Math.SQRT2, 1e-6, 'a 90° disk sits at √2 radii');
  const point = sunStandoffPoint(), centre = new Vector3(...SUN_POSITION);
  near(point.distanceTo(centre), SUN_STANDOFF, 1e-6, 'standoff point distance');
  assert.ok(point.length() < SUN_DISTANCE, 'the standoff lies between Aeon and the star');
  assert.ok(Math.abs(point.clone().sub(centre).normalize().dot(new Vector3(...SUN_DIRECTION)) + 1) < 1e-12, 'on the Aeon line');
});

test('travel registry exposes the star with exclusion at 3 radii and arrival at the standoff', () => {
  const target = TRAVEL_TARGETS.find(t => t.id === 'star');
  assert.ok(target, 'star travel target registered');
  assert.equal(target.name, STAR.name);
  assert.deepEqual([...target.center], [...SUN_POSITION]);
  near(target.exclusionRadius, SUN_EXCLUSION, 1e-6, 'exclusion radius');
  near(target.arrivalRadius, SUN_STANDOFF, 1e-6, 'arrival radius');
  assert.ok(target.arrivalRadius > target.exclusionRadius);
  const fromOrbit = new Vector3(...SUN_DIRECTION).multiplyScalar(RADIUS * 2.8).applyAxisAngle(new Vector3(0, 1, 0), .4);
  const route = planTravel(fromOrbit, 'star');
  assert.equal(route.ok, true, route.reason);
  near(route.plan.end.distanceTo(new Vector3(...SUN_POSITION)), SUN_STANDOFF, 1e-3, 'the drive brakes at the standoff');
  const inside = new Vector3(...SUN_POSITION).addScaledVector(new Vector3(...SUN_DIRECTION), -SUN_EXCLUSION * .9);
  assert.equal(planTravel(inside, 'aeon').ok, false, 'no drive from inside the exclusion sphere');
  const behind = new Vector3(...SUN_POSITION).addScaledVector(new Vector3(...SUN_DIRECTION), SUN_DISTANCE);
  assert.match(planTravel(behind, 'aeon').reason, /Our star/, 'routes through the star are refused');
});

test('manual flight is clamped at the exclusion sphere', () => {
  const centre = new Vector3(...SUN_POSITION), outward = new Vector3(...SUN_DIRECTION).negate();
  const previous = centre.clone().addScaledVector(outward, SUN_EXCLUSION * 1.2);
  const proposed = centre.clone().addScaledVector(outward, SUN_EXCLUSION * .5);
  const step = constrainSunStep(previous, proposed);
  assert.equal(step.hit, true);
  near(step.point.distanceTo(centre), SUN_EXCLUSION, 1e-3, 'stopped on the sphere');
  assert.ok(step.point.clone().sub(centre).normalize().dot(outward) > .999, 'radially outward');
  const clear = constrainSunStep(previous, previous.clone().addScaledVector(outward, 1000));
  assert.equal(clear.hit, false);
  assert.equal(constrainSunStep(centre.clone(), centre.clone()).hit, true, 'a step at the centre is resolved');
  assert.equal(constrainSunStep(new Vector3(), new Vector3(0, 0, 1)).hit, false, 'Aeon orbit is unaffected');
});

test('hull heat is zero at Aeon, rises with inverse-square flux and saturates at the exclusion sphere', () => {
  assert.equal(sunHeat(SUN_DISTANCE), 0);
  assert.equal(sunHeat(SUN_HEAT_RANGE), 0);
  assert.equal(sunHeat(Infinity), 0);
  assert.equal(sunHeat(NaN), 0);
  assert.equal(sunHeat(SUN_EXCLUSION), 1);
  assert.equal(sunHeat(SUN_RADIUS), 1);
  const standoff = sunHeat(SUN_STANDOFF);
  assert.ok(standoff > .5 && standoff < .97, `standoff is HIGH but not CRITICAL (${standoff})`);
  let last = 0;
  for (let d = SUN_HEAT_RANGE; d >= SUN_EXCLUSION; d -= 1e8) { const h = sunHeat(d); assert.ok(h >= last); last = h; }
  // heat = (flux - floor) / (1 - floor) with flux = (exclusion / d)²: undo the normalisation and check 1/d².
  const floor = (SUN_EXCLUSION / SUN_HEAT_RANGE) ** 2, flux = d => sunHeat(d) * (1 - floor) + floor;
  near(flux(SUN_EXCLUSION * 2) / flux(SUN_EXCLUSION * 4), 4, 1e-9, 'inverse square between samples');
});

test('the atmosphere disk hands off to the sphere over a fade band inside the sphere range', () => {
  assert.equal(sunDiskWeight(SUN_DISTANCE), 1);
  assert.equal(sunDiskWeight(SUN_DISK_FADE[0]), 0);
  assert.equal(sunDiskWeight(SUN_DISK_FADE[1]), 1);
  assert.ok(SUN_DISK_FADE[1] <= SUN_SPHERE_RANGE, 'the sphere is visible before the disk starts fading');
  assert.ok(sunDiskWeight((SUN_DISK_FADE[0] + SUN_DISK_FADE[1]) / 2) > 0 && sunDiskWeight((SUN_DISK_FADE[0] + SUN_DISK_FADE[1]) / 2) < 1);
});

test('rotation, flares and prominences are periodic and bounded', () => {
  assert.equal(SUN_ROTATION_PERIOD, 600);
  near(sunRotationAngle(SUN_ROTATION_PERIOD / 4), Math.PI / 2, 1e-12, 'quarter turn');
  near(sunRotationAngle(SUN_ROTATION_PERIOD), 0, 1e-9, 'full turn wraps');
  near(new Vector3(...SUN_AXIS).dot(new Vector3(...SUN_DIRECTION)), 0, 1e-12, 'axis is perpendicular to the Aeon line of sight');
  near(new Vector3(...SUN_AXIS).length(), 1, 1e-12, 'unit axis');
  for (let t = 0; t < 300; t += .5) { const f = flareCurve(t); assert.ok(f >= 0 && f <= 1); }
  assert.equal(flareCurve(0), 0); near(flareCurve(1.8), 1, 1e-12, 'peak after the rise');
  assert.ok(flareCurve(20) < .3, 'decays within tens of seconds');
  assert.equal(PROMINENCES.length, 8);
  assert.equal(PROMINENCES.filter(p => p.detaches).length, 2);
  for (const p of PROMINENCES) for (let t = 0; t < 1000; t += 7) {
    const s = prominenceState(p, t);
    assert.ok(s.alpha >= 0 && s.alpha <= 1 && s.height >= p.height && s.height <= p.height * 3.3);
  }
});

test('lens glare visibility follows planet and moon occlusion', () => {
  const sun = new Vector3(...SUN_DIRECTION);
  assert.equal(sunVisibility(sun.clone().multiplyScalar(RADIUS * 2.8)), 1, 'sunlit orbit sees the whole disk');
  assert.equal(sunVisibility(sun.clone().multiplyScalar(-RADIUS * 2.8)), 0, 'Aeon blocks the star from the night side');
  assert.equal(sunVisibility(sunStandoffPoint()), 1, 'nothing between the standoff and the star');
  // Walk from noon to midnight at 500 m: visibility is monotonic and passes through a partial sunrise.
  const axis = new Vector3().crossVectors(sun, new Vector3(0, 1, 0)).normalize();
  let last = 1, partial = 0;
  for (let angle = 0; angle <= Math.PI; angle += Math.PI / 4000) {
    const v = sunVisibility(sun.clone().multiplyScalar(RADIUS + 500).applyAxisAngle(axis, angle));
    assert.ok(v <= last + 1e-12, 'visibility never increases toward the night side'); last = v;
    if (v > 0 && v < 1) partial++;
  }
  assert.ok(partial > 0, 'a sunrise is partially occluded');
  assert.equal(last, 0);
});
