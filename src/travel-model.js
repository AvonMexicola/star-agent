import { PYRE_ARRIVAL_ALTITUDE } from './pyre-world.js';
import { MIASMA_ARRIVAL_ALTITUDE } from './miasma-world.js';
import { Vector3 } from 'three';
import { SUN_STANDOFF, SUN_EXCLUSION } from './stellar-world.js';
import { AEON, SELENE, PYRE, MIASMA, STAR } from './celestial.js';
import { MOON_MAX_HEIGHT, constrainMoonStep } from './moon-world.js';
import { PYRE_MAX_HEIGHT } from './pyre-world.js';
import { shipHandling } from './ship-handling.js';
import { GEAR_FLIGHT } from './gear-flight.js';
import { sampleRoute } from './travel-route.js';

export const LIGHT_SPEED = 299_792_458;
export const TRAVEL = Object.freeze({
  maxSpeed: LIGHT_SPEED * .9,
  acceleration: 50_000_000,
  spoolSeconds: 3,
  exitSeconds: .6,
});

const targetFrom = (body, exclusion, arrival) => Object.freeze({
  id: body.id,
  name: body.name,
  center: Object.freeze([...body.center]),
  radius: body.radius,
  airless: body.airless,
  exclusionRadius: body.radius + exclusion,
  arrivalRadius: body.radius + arrival,
});

export const TRAVEL_TARGETS = Object.freeze([
  targetFrom(AEON, 100_000, 150_000),
  targetFrom(SELENE, 20_000, 50_000),
  targetFrom(PYRE, 55_000, PYRE_ARRIVAL_ALTITUDE),
  targetFrom(MIASMA, 40_000, MIASMA_ARRIVAL_ALTITUDE),
  targetFrom(STAR, SUN_EXCLUSION-STAR.radius, SUN_STANDOFF-STAR.radius),
]);

const BODY_TARGETS = TRAVEL_TARGETS;
const TARGET_BY_ID = Object.freeze(Object.fromEntries(TRAVEL_TARGETS.map(target => [target.id, target])));
const MIN_ROUTE_DISTANCE = 1_000;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const smoothstep = (low, high, value) => {
  const t = clamp((value - low) / (high - low), 0, 1);
  return t * t * (3 - 2 * t);
};
const finiteOr = (value, fallback) => Number.isFinite(value) ? value : fallback;
const nonnegative = (value, fallback = 0) => value === Infinity ? Infinity
  : value === -Infinity ? 0 : Math.max(0, finiteOr(value, fallback));
const clearanceValue = (value, fallback) => value === Infinity ? Infinity : nonnegative(value, fallback);

/** Controlled bay departure, then progressively release the approach restriction. */
export function stationSpeedLimit(distance = Infinity) {
  const clearance = clearanceValue(distance, Infinity);
  return clearance < 20_000 ? Math.max(20, (clearance - 65) * .18) : Infinity;
}

/** Speed policy shared by manual flight and the travel-entry UI. */
export function flightSpeedProfile({
  shipId = 'nomad',
  gearLimited = false,
  airless = false,
  altitude = 0,
  clearance = altitude,
  stationDistance = Infinity,
  boost = false,
  throttle = 1,
} = {}) {
  const height = nonnegative(altitude);
  const floorClearance = clearanceValue(clearance, height);
  const lower = airless ? 2_000 : 20_000;
  const upper = airless ? 20_000 : 70_000;
  const blend = smoothstep(lower, upper, height);
  const cruise = (250 + (3_000 - 250) * blend) * shipHandling(shipId).speed;
  const boosted = (400 + (9_000 - 400) * blend) * shipHandling(shipId).speed;
  const requested = boost ? boosted : cruise;
  const floorLimit = floorClearance === Infinity ? Infinity : 25 + floorClearance * .5;
  const stationLimit = stationSpeedLimit(stationDistance);
  const limit = Math.min(requested, floorLimit, stationLimit, gearLimited?GEAR_FLIGHT.speed:Infinity);
  const throttleAmount = Number.isNaN(throttle) || typeof throttle !== 'number'
    ? 1 : clamp(throttle, .05, 1);
  const speed = limit * throttleAmount;
  const regime = height >= upper ? 'SPACE'
    : height >= lower ? 'TRANSITION'
      : airless ? 'AIRLESS' : 'ATMOSPHERE';
  return { cruise, boosted, limit, speed, regime };
}

function vectorFrom(value, label) {
  let vector;
  if (value?.isVector3) vector = value.clone();
  else if (Array.isArray(value) && value.length >= 3) vector = new Vector3(value[0], value[1], value[2]);
  else throw new TypeError(`${label} must be a Vector3 or [x, y, z].`);
  if (![vector.x, vector.y, vector.z].every(Number.isFinite)) throw new RangeError(`${label} must contain finite coordinates.`);
  return vector;
}

const frozenVector = vector => Object.freeze(vector.clone());

/** Inclusive swept-segment/sphere test. Tangencies count as unsafe. */
export function segmentIntersectsSphere(start, end, center, radius) {
  const a = vectorFrom(start, 'Segment start');
  const b = vectorFrom(end, 'Segment end');
  const c = vectorFrom(center, 'Sphere center');
  if (!Number.isFinite(radius) || radius < 0) throw new RangeError('Sphere radius must be finite and nonnegative.');
  const delta = b.sub(a);
  const lengthSquared = delta.lengthSq();
  const t = lengthSquared === 0 ? 0 : clamp(c.clone().sub(a).dot(delta) / lengthSquared, 0, 1);
  return a.addScaledVector(delta, t).distanceToSquared(c) <= radius * radius;
}

function makePlan({ start, end, direction, distance, peakSpeed, accelerationSeconds,
  cruiseSeconds, decelerationSeconds, spoolSeconds, exitSeconds, startSpeed = 0, kind = 'travel', path = null, pathOffset = 0 }) {
  const motionSeconds = accelerationSeconds + cruiseSeconds + decelerationSeconds;
  return Object.freeze({
    kind,
    start: frozenVector(start),
    end: frozenVector(end),
    direction: frozenVector(direction),
    distance,
    duration: spoolSeconds + motionSeconds + exitSeconds,
    peakSpeed,
    acceleration: TRAVEL.acceleration,
    spoolSeconds,
    exitSeconds,
    accelerationSeconds,
    cruiseSeconds,
    decelerationSeconds,
    motionSeconds,
    startSpeed,
    ...(path ? {path,pathOffset} : {}),
  });
}

/** Construct an elapsed-time travel plan. Inputs are cloned and never mutated. */
export function createTravelPlan(start, end, {path = null} = {}) {
  const from = vectorFrom(start, 'Travel start');
  const to = vectorFrom(end, 'Travel end');
  const offset = to.clone().sub(from);
  const distance = path ? path.reduce((sum,part)=>sum+part.distance,0) : offset.length();
  if (!Number.isFinite(distance)) throw new RangeError('Travel distance must be finite.');
  if (distance === 0) return makePlan({
    start: from, end: to, direction: new Vector3(), distance: 0, peakSpeed: 0,
    accelerationSeconds: 0, cruiseSeconds: 0, decelerationSeconds: 0,
    spoolSeconds: 0, exitSeconds: 0,
  });
  const direction = path ? sampleRoute(path,0).direction : offset.divideScalar(distance);
  const unconstrainedPeak = Math.sqrt(distance * TRAVEL.acceleration);
  const peakSpeed = Math.min(TRAVEL.maxSpeed, unconstrainedPeak);
  const accelerationSeconds = peakSpeed / TRAVEL.acceleration;
  const accelerationDistance = peakSpeed * peakSpeed / (2 * TRAVEL.acceleration);
  const cruiseDistance = Math.max(0, distance - accelerationDistance * 2);
  const cruiseSeconds = cruiseDistance / peakSpeed;
  return makePlan({
    start: from, end: to, direction, distance, peakSpeed, path,
    accelerationSeconds, cruiseSeconds, decelerationSeconds: accelerationSeconds,
    spoolSeconds: TRAVEL.spoolSeconds, exitSeconds: TRAVEL.exitSeconds,
  });
}

const invalidPlan = plan => !plan || !plan.start?.isVector3 || !plan.end?.isVector3
  || !plan.direction?.isVector3 || !Number.isFinite(plan.distance) || !Number.isFinite(plan.duration);

/** Sample a plan analytically. Repeated or partitioned calls cannot accumulate drift. */
export function sampleTravel(plan, elapsed) {
  if (plan?.kind === 'free') return sampleFreeTravel(plan, elapsed);
  if (invalidPlan(plan)) throw new TypeError('A valid travel plan is required.');
  const time = elapsed === Infinity ? plan.duration : clamp(finiteOr(elapsed, 0), 0, plan.duration);
  if (plan.distance === 0 || time >= plan.duration) return {
    position: plan.end.clone(), direction: plan.path ? sampleRoute(plan.path,plan.pathOffset+plan.distance).direction : plan.direction.clone(), speed: 0, phase: 'done', remaining: 0, progress: 1, done: true,
  };
  if (time < plan.spoolSeconds) return {
    position: plan.start.clone(), direction: plan.direction.clone(), speed: 0, phase: 'spooling', remaining: plan.distance, progress: 0, done: false,
  };
  if (time >= plan.spoolSeconds + plan.motionSeconds) return {
    position: plan.end.clone(), direction: plan.path ? sampleRoute(plan.path,plan.pathOffset+plan.distance).direction : plan.direction.clone(), speed: 0, phase: 'cooldown', remaining: 0, progress: 1, done: false,
  };

  const motionTime = time - plan.spoolSeconds;
  let travelled;
  let speed;
  let phase;
  const accelerationDistance = (plan.startSpeed + plan.peakSpeed) * plan.accelerationSeconds * .5;
  const cruiseDistance = plan.peakSpeed * plan.cruiseSeconds;
  if (motionTime < plan.accelerationSeconds) {
    travelled = plan.startSpeed * motionTime + .5 * plan.acceleration * motionTime * motionTime;
    speed = plan.startSpeed + plan.acceleration * motionTime;
    phase = 'accelerating';
  } else if (motionTime < plan.accelerationSeconds + plan.cruiseSeconds) {
    const t = motionTime - plan.accelerationSeconds;
    travelled = accelerationDistance + plan.peakSpeed * t;
    speed = plan.peakSpeed;
    phase = 'cruising';
  } else if (motionTime < plan.motionSeconds) {
    const t = motionTime - plan.accelerationSeconds - plan.cruiseSeconds;
    travelled = accelerationDistance + cruiseDistance + plan.peakSpeed * t - .5 * plan.acceleration * t * t;
    speed = Math.max(0, plan.peakSpeed - plan.acceleration * t);
    phase = 'decelerating';
  }
  travelled = clamp(travelled, 0, plan.distance);
  const progress = travelled / plan.distance;
  return {
    ...(plan.path ? sampleRoute(plan.path,plan.pathOffset+travelled) : {position:plan.start.clone().addScaledVector(plan.direction,travelled),direction:plan.direction.clone()}),
    speed,
    phase,
    remaining: plan.distance - travelled,
    progress,
    done: false,
  };
}

/** Replace active travel with a fixed-acceleration braking trajectory. */
export function abortTravel(plan, elapsed) {
  const sample = sampleTravel(plan, elapsed);
  if (sample.speed <= 0 || sample.done) return makePlan({
    start: sample.position, end: sample.position, direction: new Vector3(), distance: 0, peakSpeed: 0,
    accelerationSeconds: 0, cruiseSeconds: 0, decelerationSeconds: 0,
    spoolSeconds: 0, exitSeconds: 0, kind: 'abort',
  });
  const brakingSeconds = sample.speed / TRAVEL.acceleration;
  const brakingDistance = sample.speed * brakingSeconds * .5;
  const pathOffset=(plan.pathOffset??0)+plan.distance-sample.remaining;
  const end = plan.path ? sampleRoute(plan.path,pathOffset+brakingDistance).position : sample.position.clone().addScaledVector(plan.direction, brakingDistance);
  return makePlan({
    start: sample.position, end, direction: sample.direction??plan.direction, distance: brakingDistance, path:plan.path, pathOffset,
    peakSpeed: sample.speed, startSpeed: sample.speed,
    accelerationSeconds: 0, cruiseSeconds: 0, decelerationSeconds: brakingSeconds,
    spoolSeconds: 0, exitSeconds: TRAVEL.exitSeconds, kind: 'abort',
  });
}

const failed = reason => ({ ok: false, reason, plan: null });

/** Validate a direct inter-body route and construct its continuous travel plan. */
export function planTravel(start, targetId, { obstacles = [] } = {}) {
  let from;
  try { from = vectorFrom(start, 'Travel start'); }
  catch (error) { return failed(error.message); }
  const target = TARGET_BY_ID[String(targetId).toLowerCase()];
  if (!target) return failed(`Unknown travel target: ${targetId}.`);

  for (const body of BODY_TARGETS) {
    if (from.distanceTo(new Vector3(...body.center)) < body.exclusionRadius)
      return failed(`Travel cannot begin inside ${body.name}'s exclusion zone.`);
  }
  const targetCenter = new Vector3(...target.center);
  const targetDistance = from.distanceTo(targetCenter);
  if (!Number.isFinite(targetDistance)) return failed('Travel start is outside the supported coordinate range.');
  if (targetDistance <= target.arrivalRadius)
    return failed(`Already within ${target.name}'s approach radius.`);
  const endpoint = from.clone().sub(targetCenter).normalize().multiplyScalar(target.arrivalRadius).add(targetCenter);
  if (from.distanceTo(endpoint) < MIN_ROUTE_DISTANCE)
    return failed(`Route to ${target.name} is too short for continuous travel.`);

  const hazards = BODY_TARGETS.map(body => ({ name: body.name, center: body.center, radius: body.exclusionRadius }));
  if (!Array.isArray(obstacles)) return failed('Travel obstacles must be an array.');
  for (const obstacle of obstacles) {
    if (!obstacle || !Number.isFinite(obstacle.radius) || obstacle.radius < 0)
      return failed('Travel obstacle radius must be finite and nonnegative.');
    try { vectorFrom(obstacle.center, 'Travel obstacle center'); }
    catch (error) { return failed(error.message); }
    hazards.push({ name: obstacle.name || 'obstacle', center: obstacle.center, radius: obstacle.radius });
  }
  for (const hazard of hazards) {
    if (segmentIntersectsSphere(from, endpoint, hazard.center, hazard.radius))
      return failed(`Direct route intersects ${hazard.name}'s exclusion zone.`);
  }
  return { ok: true, reason: null, plan: createTravelPlan(from, endpoint) };
}

/** Manual heading travel. Reserve the entire forward ray before spooling, so
 * even a long frame and its braking distance cannot tunnel through a world. */
export function planFreeTravel(start, heading, { body, altitude, outsideAtmosphere=false, obstacles=[] }={}) {
  let from, direction;
  try { from=vectorFrom(start,'Travel start'); direction=vectorFrom(heading,'Heading'); }
  catch(error) { return failed(error.message); }
  if(direction.lengthSq()<1e-12)return failed('Choose a flight heading.');
  direction.normalize();
  if(!body || !Number.isFinite(altitude) || altitude<100 || (altitude<20_000&&!outsideAtmosphere))
    return failed('Climb to 20 km or leave the atmosphere before spooling.');
  const radial=from.clone().sub(new Vector3(...body.center)).normalize();
  if(direction.dot(radial)<-.001)return failed('Aim along the horizon or away from the planet before spooling.');
  const hazards=BODY_TARGETS.map(b=>({name:b.name,center:b.center,radius:b.radius+({aeon:12_000,selene:MOON_MAX_HEIGHT,pyre:PYRE_MAX_HEIGHT}[b.id]??20_000)+100})).concat(obstacles);
  let clearance=Infinity, obstruction=null;
  for(const hazard of hazards){
    const offset=from.clone().sub(vectorFrom(hazard.center,'Obstacle'));
    const c=offset.lengthSq()-hazard.radius**2, projection=offset.dot(direction);
    if(c<=0){
      // Airless launch can begin below the global terrain envelope only after
      // the canonical swept heightfield validates the entire departure segment.
      if(body.id==='selene'&&hazard.name===body.name&&projection>=0){
        const exit=-projection+Math.sqrt(projection**2-c)+1;
        const checked=constrainMoonStep(from,from.clone().addScaledVector(direction,exit),100);
        if(!checked.hit&&!checked.limited)continue;
        return failed('Terrain ahead. Aim higher or climb before spooling.');
      }
      return failed(`Move clear of ${hazard.name} before spooling.`);
    }
    const discriminant=projection**2-c;
    if(projection>=0||discriminant<0)continue;
    const entry=-projection-Math.sqrt(discriminant);
    if(entry<clearance){clearance=entry;obstruction=hazard.name;}
  }
  if(Number.isFinite(clearance)){
    const distance=clearance-10_000;
    if(distance<1000)return failed(`Aim clear of ${obstruction} before spooling.`);
    return {ok:true,reason:null,obstruction,plan:createTravelPlan(from,from.clone().addScaledVector(direction,distance))};
  }
  return {ok:true,reason:null,plan:Object.freeze({kind:'free',start:frozenVector(from),direction:frozenVector(direction),duration:Infinity})};
}
export function sampleFreeTravel(plan, elapsed) {
  const t=Math.max(0,Number.isFinite(elapsed)?elapsed:0);
  const motion=Math.max(0,t-TRAVEL.spoolSeconds), ramp=TRAVEL.maxSpeed/TRAVEL.acceleration;
  const accel=Math.min(ramp,motion), speed=Math.min(TRAVEL.maxSpeed,TRAVEL.acceleration*motion);
  const distance=.5*TRAVEL.acceleration*accel**2+TRAVEL.maxSpeed*Math.max(0,motion-ramp);
  return {position:plan.start.clone().addScaledVector(plan.direction,distance),speed,
    phase:t<TRAVEL.spoolSeconds?'spooling':motion<ramp?'accelerating':'cruising',remaining:Infinity,progress:0,done:false};
}
