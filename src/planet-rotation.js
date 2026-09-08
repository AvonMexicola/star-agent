import { Quaternion, Vector3 } from 'three';
import { BODIES } from './celestial.js';

// Centres keep their existing fixed orbits. Positions inside a body's navigation
// domain are expressed in its rotating, terrain-fixed chart; deep space uses the
// inertial chart. Rotations never change a terrain seed or a saved surface anchor.
export const PLANET_DAY_SECONDS = 3600;
export const ROTATION_EPOCH_MS = Date.UTC(2026, 8, 8);
export const ROTATION_DOMAIN_RADII = 3;
export const ROTATING_BODIES = Object.freeze(BODIES.filter(body => !body.star));
const AXIS = new Vector3(0, 1, 0);
const TAU = Math.PI * 2;
export const PLANET_ANGULAR_SPEED = TAU / PLANET_DAY_SECONDS;

export function planetRotation(body, seconds = 0, target = new Quaternion()) {
  const phase = body && !body.star && Number.isFinite(seconds)
    ? ((seconds % PLANET_DAY_SECONDS) / PLANET_DAY_SECONDS) * TAU : 0;
  return target.setFromAxisAngle(AXIS, phase);
}

/** These disjoint spheres have identical membership in either chart. */
export function rotationFrameAt(position) {
  return ROTATING_BODIES.find(body => {
    const [x, y, z] = body.center;
    return (position.x-x)**2 + (position.y-y)**2 + (position.z-z)**2
      < (body.radius * ROTATION_DOMAIN_RADII)**2;
  }) ?? null;
}

export function toInertial(position, body, seconds, target = new Vector3()) {
  target.copy(position);
  if (body) {
    const center = new Vector3(...body.center);
    target.sub(center).applyQuaternion(planetRotation(body, seconds)).add(center);
  }
  return target;
}

export function fromInertial(position, body, seconds, target = new Vector3()) {
  target.copy(position);
  if (body) {
    const center = new Vector3(...body.center);
    target.sub(center).applyQuaternion(planetRotation(body, seconds).invert()).add(center);
  }
  return target;
}

export function frameRotation(from, to, seconds, target = new Quaternion()) {
  return target.copy(planetRotation(to, seconds)).invert().multiply(planetRotation(from, seconds));
}

export function betweenFrames(position, from, to, seconds, target = new Vector3()) {
  if (from === to) return target.copy(position);
  return fromInertial(toInertial(position, from, seconds, target), to, seconds, target);
}

/** Subtract in doubles before a translation reaches a GPU matrix. Same-frame
 * nearby points avoid adding/subtracting an astronomical body centre entirely. */
export function frameRelative(position, from, origin, to, seconds, target = new Vector3()) {
  if (from === to) return target.copy(position).sub(origin);
  const inertialOrigin = toInertial(origin, to, seconds);
  toInertial(position, from, seconds, target).sub(inertialOrigin);
  return target.applyQuaternion(planetRotation(to, seconds).invert());
}

export function frameVelocity(position, body, target = new Vector3()) {
  if (!body) return target.set(0, 0, 0);
  return target.set(position.z-body.center[2], 0, -(position.x-body.center[0]))
    .multiplyScalar(PLANET_ANGULAR_SPEED);
}

export function velocityBetweenFrames(velocity, position, from, to, seconds, target = new Vector3()) {
  if (from === to) return target.copy(velocity);
  const nextPosition = betweenFrames(position, from, to, seconds);
  return target.copy(velocity).add(frameVelocity(position, from))
    .applyQuaternion(frameRotation(from, to, seconds)).sub(frameVelocity(nextPosition, to));
}

/** The world samplers accept terrain-fixed directions, even when the requested
 * arrival radial is inertial. This also works at distant Pyre/Miasma centres. */
export function inertialSurfacePoint(direction, body, seconds, clearance = 0) {
  const local = direction.clone().normalize().applyQuaternion(planetRotation(body, seconds).invert());
  return local.multiplyScalar(body.radius + body.height(local.x, local.y, local.z) + clearance)
    .applyQuaternion(planetRotation(body, seconds)).add(new Vector3(...body.center));
}

export class PlanetRotationClock {
  constructor({now = () => Date.now()} = {}) {
    this.now = now;
    this.offset = 0;
    this.tick();
  }
  tick() { this.seconds = (this.now() - ROTATION_EPOCH_MS) / 1000 + this.offset; return this.seconds; }
  synchronize(seconds) {
    if (!Number.isFinite(seconds)) return false;
    this.offset = seconds - (this.now() - ROTATION_EPOCH_MS) / 1000;
    this.tick();
    return true;
  }
}
