import { PLANET_ANGULAR_SPEED } from './planet-rotation.js';
import { Vector3, Quaternion } from 'three';
import { shipHandling } from './ship-handling.js';

// Gameplay tuning, SI units. One surface g is deliberate; planet size is not mass.
export const FLIGHT = Object.freeze({
  surfaceGravity: 9.81, seaLevelDensity: 1.225, scaleHeight: 8000,
  atmosphereHeight: 70000, planeHeight: 20000,
  mass: 12000, wingArea: 38, dragCoefficient: .12, inducedDrag: .08,
  liftSlope: 4.5, stallAngle: .28, stallSpeed: 55,
  thrustAcceleration: 35, rcsAcceleration: 18, angularAcceleration: 1.6,
  travelSpeed: 3000,
});
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

/** Body-relative position. `air` describes another body's atmosphere
 * ({seaLevelDensity, scaleHeight, height, planeHeight}); the defaults are Aeon's. */
export function environmentAt(position, groundRadius, air = null, surfaceGravity = FLIGHT.surfaceGravity) {
  const atmosphereHeight = air?.height ?? FLIGHT.atmosphereHeight, planeHeight = air?.planeHeight ?? FLIGHT.planeHeight;
  const seaLevelDensity = air?.seaLevelDensity ?? FLIGHT.seaLevelDensity, scaleHeight = air?.scaleHeight ?? FLIGHT.scaleHeight;
  const radius = position.length(), altitude = Math.max(0, radius - groundRadius);
  // Fade the very thin upper atmosphere to exactly zero without a boundary impulse.
  const fade = clamp((atmosphereHeight - altitude) / 10000, 0, 1);
  return {
    groundRadius, altitude,
    density: seaLevelDensity * Math.exp(-altitude / scaleHeight) * fade * fade * (3 - 2 * fade),
    gravity: position.clone().normalize().multiplyScalar(-surfaceGravity * (groundRadius / radius) ** 2),
    regime: altitude >= atmosphereHeight ? 'SPACE' : altitude >= planeHeight ? 'TRANSITION' : 'ATMOSPHERE',
    atmosphereFraction: clamp((atmosphereHeight - altitude) / (atmosphereHeight - planeHeight), 0, 1),
  };
}

export function aerodynamics(velocity, orientation, density) {
  const local = velocity.clone().applyQuaternion(orientation.clone().invert());
  const speed = velocity.length(), forwardSpeed = Math.max(0, -local.z);
  const angleOfAttack = Math.atan2(-local.y, Math.max(1e-9, forwardSpeed));
  const dynamicPressure = .5 * Math.max(0, density) * speed * speed;
  // Wings lose lift progressively beyond critical AoA and below stall speed.
  const angle = Math.abs(angleOfAttack);
  const separation = angle <= FLIGHT.stallAngle ? 1 : Math.exp(-8 * (angle - FLIGHT.stallAngle));
  const speedFactor = clamp(forwardSpeed / FLIGHT.stallSpeed, 0, 1) ** 2;
  const liftCoefficient = forwardSpeed > 0 ? clamp(FLIGHT.liftSlope * angleOfAttack, -1.4, 1.4) * separation * speedFactor : 0;
  const dragCoefficient = FLIGHT.dragCoefficient + FLIGHT.inducedDrag * liftCoefficient ** 2;
  // Lift is perpendicular to velocity and the wing span: banking rotates the force.
  const right = new Vector3(1, 0, 0).applyQuaternion(orientation);
  const liftDirection = right.cross(velocity).normalize();
  return {
    dynamicPressure, angleOfAttack, liftCoefficient, dragCoefficient,
    stalled: density > .01 && (forwardSpeed < FLIGHT.stallSpeed || angle > FLIGHT.stallAngle),
    liftAcceleration: liftDirection.multiplyScalar(dynamicPressure * FLIGHT.wingArea * liftCoefficient / FLIGHT.mass),
  };
}

/** Pure velocity/attitude step; inputs are never mutated. Navigation owns swept
 * position integration and contact. Vectors use world axes; rotation input and
 * angularVelocity use ship axes (+X right, +Y up, -Z forward), in radians/second.
 * Assisted travel is an explicit velocity servo with gravity/aero compensation.
 * Inertial flight integrates thrust, gravity, lift, drag and persistent rotation.
 */
export function step(state, controls, env, dt) {
  if (!Number.isFinite(dt) || dt < 0) throw new RangeError('Flight dt must be finite and non-negative');
  const velocity = state.velocity.clone(), orientation = state.orientation.clone();
  const angularVelocity = (state.angularVelocity || new Vector3()).clone();
  const engineAcceleration = new Vector3();
  const handling = shipHandling(controls.shipId);
  if (controls.assist) {
    // Fly-by-wire commands velocity, but correction is limited by the hull's
    // actual manoeuvring authority. Hover compensation is a separate reserve.
    const target = controls.targetVelocity || new Vector3();
    const inverse = orientation.clone().invert();
    const count = Math.max(1, Math.ceil(dt * 120)), h = dt / count;
    const authority = (controls.brake ? 1.5 : controls.boost ? 3 : 1);
    for (let i = 0; i < count; i++) {
      const correction = target.clone().sub(velocity).applyQuaternion(inverse);
      const fraction = 1 - Math.exp(-handling.assistResponse * h);
      correction.multiplyScalar(fraction);
      const load = Math.hypot(correction.x / handling.rcs, correction.y / handling.rcs, correction.z / handling.thrust);
      if (load > authority * h) correction.multiplyScalar(authority * h / load);
      velocity.add(correction.applyQuaternion(orientation));
    }
    angularVelocity.multiplyScalar(Math.exp(-8 * dt));
    if (dt > 0) engineAcceleration.copy(velocity).sub(state.velocity).divideScalar(dt).sub(env.gravity || new Vector3());
  } else if (dt > 0) {
    const count = Math.ceil(dt / (1 / 120)), h = dt / count;
    const translation = (controls.translation || new Vector3()).clone().clampLength(0, 1);
    const torque = (controls.rotation || new Vector3()).clone().clampLength(0, 1);
    const gravity = env.gravity || new Vector3();
    const omega = env.rotationOffset ? new Vector3(0,PLANET_ANGULAR_SPEED,0) : null;
    const centrifugal = omega ? omega.clone().cross(omega.clone().cross(env.rotationOffset)).negate() : new Vector3();
    for (let i = 0; i < count; i++) {
      if(omega)orientation.premultiply(new Quaternion().setFromAxisAngle(new Vector3(0,1,0),-PLANET_ANGULAR_SPEED*h)).normalize();
      angularVelocity.addScaledVector(torque, handling.torque * h);
      const spin = angularVelocity.length();
      if (spin > 0) orientation.multiply(new Quaternion().setFromAxisAngle(angularVelocity.clone().divideScalar(spin), spin * h)).normalize();
      const thrust = new Vector3(translation.x * handling.rcs, translation.y * handling.rcs,
        translation.z * handling.thrust).applyQuaternion(orientation).multiplyScalar(controls.boost ? 3 : 1);
      engineAcceleration.addScaledVector(thrust, h / dt);
      const aero = aerodynamics(velocity, orientation, env.density);
      if(omega)velocity.addScaledVector(omega.clone().cross(velocity),-2*h).addScaledVector(centrifugal,h);
      velocity.addScaledVector(gravity, h).addScaledVector(thrust, h);
      // Rotate velocity for lift so this force does no work, even at large q.
      const speed = velocity.length();
      if (speed > 0 && aero.liftAcceleration.lengthSq() > 0) {
        const axis = velocity.clone().cross(aero.liftAcceleration).normalize();
        velocity.applyAxisAngle(axis, aero.liftAcceleration.length() / speed * h);
      }
      // Exact quadratic-drag decay for the substep; cannot reverse velocity.
      const drag = .5 * Math.max(0, env.density) * FLIGHT.wingArea * aero.dragCoefficient / FLIGHT.mass;
      velocity.multiplyScalar(1 / (1 + drag * velocity.length() * h));
    }
  }
  if (dt > 0 && !controls.assist && Number.isFinite(controls.maxSpeed)) {
    const limit = Math.max(0, controls.maxSpeed), before = state.velocity.length();
    // A lower speed selection is a thruster command, never a velocity reset.
    // At the cap, reject additional outward thrust; existing overspeed bleeds off.
    const allowed = Math.max(limit, before - handling.rcs * dt);
    if (velocity.length() > allowed) {
      const beforeLimit=velocity.clone();velocity.setLength(allowed);
      engineAcceleration.add(velocity.clone().sub(beforeLimit).divideScalar(dt));
    }
  }
  return { velocity, orientation, angularVelocity, engineAcceleration, ...aerodynamics(velocity, orientation, env.density) };
}
