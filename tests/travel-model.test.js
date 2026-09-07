import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { AEON, SELENE } from '../src/celestial.js';
import {
  LIGHT_SPEED, TRAVEL, TRAVEL_TARGETS, flightSpeedProfile, segmentIntersectsSphere,
  createTravelPlan, sampleTravel, abortTravel, planTravel,
} from '../src/travel-model.js';

const near = (actual, expected, epsilon = 1e-7) =>
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`);
const nearVector = (actual, expected, epsilon = 1e-6) =>
  assert.ok(actual.distanceTo(expected) <= epsilon, `${actual.toArray()} != ${expected.toArray()}`);

test('travel constants and destinations derive from the celestial model', () => {
  assert.equal(LIGHT_SPEED, 299_792_458);
  assert.equal(TRAVEL.maxSpeed, LIGHT_SPEED * .9);
  assert.equal(TRAVEL.acceleration, 50_000_000);
  assert.equal(TRAVEL.spoolSeconds, 3);
  assert.equal(TRAVEL.exitSeconds, .6);
  for (const [body, target, exclusion, arrival] of [
    [AEON, TRAVEL_TARGETS.find(target => target.id === 'aeon'), 100_000, 150_000],
    [SELENE, TRAVEL_TARGETS.find(target => target.id === 'selene'), 20_000, 50_000],
  ]) {
    assert.equal(target.id, body.id);
    assert.deepEqual(target.center, body.center);
    assert.equal(target.radius, body.radius);
    assert.equal(target.exclusionRadius, body.radius + exclusion);
    assert.equal(target.arrivalRadius, body.radius + arrival);
  }
});

test('flight policy blends smoothly to space and keeps throttle out of its limits', () => {
  const profile = altitude => flightSpeedProfile({ altitude, clearance: Infinity, boost: true });
  assert.deepEqual(profile(0), { cruise: 250, boosted: 400, limit: 400, speed: 400, regime: 'ATMOSPHERE' });
  assert.equal(profile(20_000).regime, 'TRANSITION');
  near(profile(45_000).cruise, 1_625);
  near(profile(45_000).boosted, 4_700);
  assert.deepEqual(profile(70_000), { cruise: 3_000, boosted: 9_000, limit: 9_000, speed: 9_000, regime: 'SPACE' });

  const airlessLow = flightSpeedProfile({ airless: true, altitude: 2_000, clearance: Infinity });
  const airlessMid = flightSpeedProfile({ airless: true, altitude: 11_000, clearance: Infinity });
  const airlessHigh = flightSpeedProfile({ airless: true, altitude: 20_000, clearance: Infinity });
  assert.equal(airlessLow.cruise, 250);
  assert.equal(airlessLow.regime, 'TRANSITION');
  near(airlessMid.cruise, 1_625);
  assert.equal(airlessHigh.cruise, 3_000);
  assert.equal(airlessHigh.regime, 'SPACE');

  const full = flightSpeedProfile({ altitude: 70_000, clearance: Infinity, boost: true, throttle: 1 });
  const low = flightSpeedProfile({ altitude: 70_000, clearance: Infinity, boost: true, throttle: 0 });
  assert.equal(low.cruise, full.cruise);
  assert.equal(low.boosted, full.boosted);
  assert.equal(low.limit, full.limit);
  assert.equal(low.speed, full.limit * .05);
});

test('floor and station guards cap boosted speed before throttle', () => {
  const floor = flightSpeedProfile({ altitude: 70_000, clearance: 10, boost: true, throttle: .5 });
  assert.equal(floor.limit, 30);
  assert.equal(floor.speed, 15);
  const station = flightSpeedProfile({ altitude: 70_000, clearance: Infinity, stationDistance: 1_065, boost: true });
  assert.equal(station.limit, 180);
  assert.equal(station.speed, 180);
  const dock = flightSpeedProfile({ altitude: 70_000, clearance: Infinity, stationDistance: 0, boost: true });
  assert.equal(dock.limit, 20);
  assert.equal(flightSpeedProfile({ altitude: 70_000, clearance: Infinity, stationDistance: 20_000, boost: true }).limit, 9_000);
  const extreme = flightSpeedProfile({ altitude: Infinity, clearance: Infinity, stationDistance: -Infinity, boost: true, throttle: -Infinity });
  assert.equal(extreme.cruise, 3_000);
  assert.equal(extreme.boosted, 9_000);
  assert.equal(extreme.limit, 20);
  assert.equal(extreme.regime, 'SPACE');
  near(extreme.speed, 1);
  assert.ok(Object.values(extreme).slice(0, 4).every(Number.isFinite));
});

test('swept sphere checks include crossings, enclosed endpoints and tangencies without mutation', () => {
  const start = new Vector3(-2, 1, 0), end = new Vector3(2, 1, 0);
  const savedStart = start.clone(), savedEnd = end.clone();
  assert.equal(segmentIntersectsSphere(start, end, [0, 0, 0], 1), true);
  assert.equal(segmentIntersectsSphere([-2, 1.001, 0], [2, 1.001, 0], [0, 0, 0], 1), false);
  assert.equal(segmentIntersectsSphere([0, 0, 0], [2, 0, 0], [0, 0, 0], 1), true);
  assert.equal(segmentIntersectsSphere([2, 0, 0], [2, 0, 0], [0, 0, 0], 1), false);
  assert.ok(start.equals(savedStart) && end.equals(savedEnd));
});

test('short and long plans use triangular and capped trapezoidal profiles', () => {
  const start = new Vector3(10, -20, 30), shortEnd = start.clone().add(new Vector3(1_000_000, 0, 0));
  const short = createTravelPlan(start, shortEnd);
  near(short.peakSpeed, Math.sqrt(short.distance * TRAVEL.acceleration));
  assert.ok(short.peakSpeed < TRAVEL.maxSpeed);
  assert.equal(short.cruiseSeconds, 0);
  assert.notEqual(short.start, start);
  assert.notEqual(short.end, shortEnd);
  nearVector(short.start, start);
  nearVector(short.end, shortEnd);

  const longDistance = TRAVEL.maxSpeed ** 2 / TRAVEL.acceleration * 2;
  const long = createTravelPlan(new Vector3(), new Vector3(longDistance, 0, 0));
  assert.equal(long.peakSpeed, TRAVEL.maxSpeed);
  assert.ok(long.cruiseSeconds > 0);
  assert.ok(long.peakSpeed < LIGHT_SPEED);
  assert.ok(Number.isFinite(long.duration));
  assert.throws(() => createTravelPlan(new Vector3(Number.MAX_VALUE, 0, 0), new Vector3(-Number.MAX_VALUE, 0, 0)), /finite/i);
});

test('sampling is exact at phases and independent of frame partitioning', () => {
  const plan = createTravelPlan(new Vector3(5, 6, 7), new Vector3(2_000_005, 6, 7));
  assert.equal(sampleTravel(plan, 0).phase, 'spooling');
  assert.equal(sampleTravel(plan, TRAVEL.spoolSeconds - .01).speed, 0);
  const elapsed = TRAVEL.spoolSeconds + plan.accelerationSeconds * .73;
  const direct = sampleTravel(plan, elapsed);
  let accumulated = 0;
  for (const frame of [1 / 30, .2, 1 / 144, .9, elapsed]) accumulated = Math.min(elapsed, accumulated + frame);
  const partitioned = sampleTravel(plan, accumulated);
  nearVector(partitioned.position, direct.position, 1e-9);
  near(partitioned.speed, direct.speed, 1e-9);

  const motionEnd = plan.spoolSeconds + plan.motionSeconds;
  const cooling = sampleTravel(plan, motionEnd);
  assert.equal(cooling.phase, 'cooldown');
  assert.equal(cooling.speed, 0);
  nearVector(cooling.position, plan.end);
  assert.equal(cooling.done, false);
  const done = sampleTravel(plan, plan.duration);
  assert.equal(done.done, true);
  assert.equal(done.progress, 1);
  assert.equal(done.remaining, 0);
  assert.equal(done.speed, 0);
  nearVector(done.position, plan.end);
  assert.ok(sampleTravel(plan, -10).position.equals(plan.start));
  assert.ok(sampleTravel(plan, NaN).position.equals(plan.start));
});

test('aborting preserves the sampled state then brakes without overshoot', () => {
  const plan = createTravelPlan(new Vector3(), new Vector3(2_000_000_000, 0, 0));
  const elapsed = plan.spoolSeconds + plan.accelerationSeconds + plan.cruiseSeconds * .4;
  const source = sampleTravel(plan, elapsed);
  const abort = abortTravel(plan, elapsed);
  const initial = sampleTravel(abort, 0);
  nearVector(initial.position, source.position, 1e-7);
  near(initial.speed, source.speed, 1e-7);
  assert.equal(initial.phase, 'decelerating');
  near(abort.distance, source.speed ** 2 / (2 * TRAVEL.acceleration), abort.distance * 1e-14);
  const stopped = sampleTravel(abort, abort.motionSeconds);
  nearVector(stopped.position, abort.end, 1e-7);
  assert.equal(stopped.speed, 0);
  assert.equal(stopped.phase, 'cooldown');
  const finished = sampleTravel(abort, abort.duration + 10);
  nearVector(finished.position, abort.end, 1e-7);
  assert.equal(finished.done, true);

  const spoolAbort = abortTravel(plan, 1);
  assert.equal(spoolAbort.duration, 0);
  assert.equal(sampleTravel(spoolAbort, 0).done, true);
  nearVector(spoolAbort.end, plan.start);
  const cooldownAbort = abortTravel(plan, plan.duration - .1);
  assert.equal(cooldownAbort.duration, 0);
  nearVector(cooldownAbort.end, plan.end);
});

test('target planning chooses the near-side endpoint and enforces route guards', () => {
  const moonCenter = new Vector3(...SELENE.center);
  const towardMoon = moonCenter.clone().normalize();
  const aeonTarget = TRAVEL_TARGETS.find(target => target.id === 'aeon');
  const seleneTarget = TRAVEL_TARGETS.find(target => target.id === 'selene');
  const start = towardMoon.clone().multiplyScalar(aeonTarget.exclusionRadius + 100_000);
  const saved = start.clone();
  const result = planTravel(start, 'selene');
  assert.equal(result.ok, true, result.reason);
  assert.ok(start.equals(saved));
  near(result.plan.end.distanceTo(moonCenter), seleneTarget.arrivalRadius, 1e-6);
  const expectedDirection = start.clone().sub(moonCenter).normalize();
  nearVector(result.plan.end.clone().sub(moonCenter).normalize(), expectedDirection, 1e-12);

  const insideAeon = planTravel(new Vector3(0, AEON.radius + 10, 0), 'selene');
  assert.equal(insideAeon.ok, false);
  assert.match(insideAeon.reason, /Aeon.*exclusion/i);
  const approach = moonCenter.clone().addScaledVector(new Vector3(0, 1, 0), seleneTarget.arrivalRadius);
  assert.match(planTravel(approach, 'selene').reason, /approach/i);
  const short = moonCenter.clone().addScaledVector(new Vector3(0, 1, 0), seleneTarget.arrivalRadius + 500);
  assert.match(planTravel(short, 'selene').reason, /too short/i);
  assert.match(planTravel(start, 'missing').reason, /unknown/i);

  const midpoint = start.clone().lerp(result.plan.end, .5);
  const blocked = planTravel(start, 'selene', { obstacles: [{ name: 'test field', center: midpoint.toArray(), radius: 10_000 }] });
  assert.equal(blocked.ok, false);
  assert.match(blocked.reason, /test field/i);

  const beyondAeon = towardMoon.clone().multiplyScalar(-(aeonTarget.exclusionRadius + 100_000));
  const bodyBlocked = planTravel(beyondAeon, 'selene');
  assert.equal(bodyBlocked.ok, false);
  assert.match(bodyBlocked.reason, /intersects Aeon/i);
});

test('free heading drive reserves a safe stop before a distant obstacle even with a long frame',async()=>{
  const {planFreeTravel,abortTravel,TRAVEL}=await import('../src/travel-model.js');
  const body={center:[0,0,0]};
  const start=new Vector3(0,10_000_000,0),heading=new Vector3(0,1,0);
  const route=planFreeTravel(start,heading,{body,altitude:20_000,obstacles:[{name:'test world',center:[0,1_010_000_000,0],radius:1_000_000}]});
  assert.equal(route.ok,true);assert.equal(route.obstruction,'test world');
  const done=sampleTravel(route.plan,1e8);assert.equal(done.done,true);assert.ok(done.position.y<1_009_000_000);
  const free=planFreeTravel(start,heading,{body,altitude:20_000});assert.equal(free.ok,true);
  const fast=sampleTravel(free.plan,100);assert.equal(fast.speed,TRAVEL.maxSpeed);
  const stop=abortTravel(free.plan,100);assert.ok(sampleTravel(stop,100).done);assert.ok(sampleTravel(stop,0).position.distanceTo(fast.position)<1e-7);
  assert.equal(planFreeTravel(start,[NaN,0,0],{body,altitude:20_000}).ok,false);
  assert.equal(planFreeTravel(start,heading,{body,altitude:5,outsideAtmosphere:true}).ok,false);
  assert.equal(planFreeTravel(start,heading,{body,altitude:1000,outsideAtmosphere:true}).ok,true);
});

test('airless heading departure checks the full canonical terrain sweep before accelerating',async()=>{
  const {bodySurfacePoint,bodyAltitude}=await import('../src/celestial.js');
  const {planFreeTravel}=await import('../src/travel-model.js');
  const up=new Vector3(Math.cos(4.8),Math.sin(1.4)*.7,Math.sin(4.8)).normalize();
  const start=bodySurfacePoint(up,SELENE,110),heading=up.clone().cross(new Vector3(0,1,0)).normalize();
  assert.ok(bodyAltitude(start.clone().addScaledVector(heading,2400),SELENE)<0,'fixture crosses a crater rim');
  const route=planFreeTravel(start,heading,{body:SELENE,altitude:110,outsideAtmosphere:true});
  assert.equal(route.ok,false);assert.match(route.reason,/Terrain|clear/);
  const climb=planFreeTravel(start,up,{body:SELENE,altitude:110,outsideAtmosphere:true});
  assert.equal(climb.ok,true,climb.reason);
});
