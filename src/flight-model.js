import { Vector3, Quaternion } from 'three';

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
  if (controls.assist) {
    velocity.lerp(controls.targetVelocity || new Vector3(), 1 - Math.exp(-3.5 * dt));
    angularVelocity.multiplyScalar(Math.exp(-8 * dt));
  } else if (dt > 0) {
    const count = Math.ceil(dt / (1 / 120)), h = dt / count;
    const translation = (controls.translation || new Vector3()).clone().clampLength(0, 1);
    const torque = (controls.rotation || new Vector3()).clone().clampLength(0, 1);
    const gravity = env.gravity || new Vector3();
    for (let i = 0; i < count; i++) {
      angularVelocity.addScaledVector(torque, FLIGHT.angularAcceleration * h);
      const spin = angularVelocity.length();
      if (spin > 0) orientation.multiply(new Quaternion().setFromAxisAngle(angularVelocity.clone().divideScalar(spin), spin * h)).normalize();
      const thrust = new Vector3(translation.x * FLIGHT.rcsAcceleration, translation.y * FLIGHT.rcsAcceleration,
        translation.z * FLIGHT.thrustAcceleration).applyQuaternion(orientation).multiplyScalar(controls.boost ? 3 : 1);
      const aero = aerodynamics(velocity, orientation, env.density);
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
  if (dt > 0 && Number.isFinite(controls.maxSpeed)) velocity.clampLength(0, Math.max(0, controls.maxSpeed));
  return { velocity, orientation, angularVelocity, ...aerodynamics(velocity, orientation, env.density) };
}
