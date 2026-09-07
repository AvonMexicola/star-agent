import { Vector3, Matrix4, Quaternion } from 'three';
import { bodyAt, bodyOffset, bodySurfacePoint, bodySurfaceNormal } from './celestial.js';
import { LANDING_FRAME } from './moon-world.js';
import { createRoverPhysics } from './rover-physics.js';
import { sampleRoverSupport } from './rover-support.js';

const UP = new Vector3(0, 1, 0);

/** Explicit development placement by an existing outcrop. The normal rover
 * solver must support all four tyres on the canonical terrain before accepting
 * a pose; this route creates neither a floor nor an Atlas cargo attachment. */
export function roverSurfaceStart(target, { isClear = () => true, sampleSupport = sampleRoverSupport } = {}) {
  if (!target?.isVector3 || !target.toArray().every(Number.isFinite)) throw new TypeError('A finite surface mining target is required.');
  const body = bodyAt(target);
  if (body.star) return null;
  const targetUp = bodyOffset(target, body).normalize();
  const heading = new Vector3(...LANDING_FRAME.north).projectOnPlane(targetUp).normalize();
  if (heading.lengthSq() < .5) heading.crossVectors(new Vector3(1, 0, 0), targetUp).normalize();
  for (const distance of [12, 16, 20]) for (const angle of [0, Math.PI / 4, -Math.PI / 4, Math.PI / 2, -Math.PI / 2, Math.PI]) {
    const away = heading.clone().applyAxisAngle(targetUp, angle).multiplyScalar(-distance);
    const direction = bodyOffset(target, body).add(away).normalize();
    const position = bodySurfacePoint(direction, body), up = bodySurfaceNormal(position, body);
    const forward = target.clone().sub(position).projectOnPlane(up).normalize();
    const right = forward.clone().cross(up).normalize();
    const quaternion = new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(right, up, forward.negate()));
    const physics = createRoverPhysics({ position, quaternion, sampleSupport,
      referenceUp: point => bodyOffset(point, body).normalize() });
    physics.step(1 / 60, { brake: 1 });
    const state = physics.state;
    if (!state.supported || state.blocked || state.wheels.some(wheel => wheel.source !== 'terrain')) continue;
    const pose = { position: state.position.clone(), quaternion: state.quaternion.clone() };
    if (!isClear(pose)) continue;
    return { ...pose, body: body.id, target: target.clone(), distance: pose.position.distanceTo(target),
      up: UP.clone().applyQuaternion(pose.quaternion) };
  }
  return null;
}
