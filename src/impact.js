import { Vector3 } from 'three';
import { terrainHeight } from './world.js';

// Gameplay threshold in m/s into the surface, not total airspeed or a frame delta.
export const CRASH_LIMITS = Object.freeze({ groundSpeed: 12 });

export function assessImpact(velocity, normal, surface = 'terrain') {
  const impactSpeed = Math.max(0, -velocity.dot(normal.clone().normalize()));
  return { crashed: impactSpeed >= CRASH_LIMITS.groundSpeed, impactSpeed, totalSpeed: velocity.length(), surface };
}

/** Normal of the same terrain/sea-level floor used by navigation. Sample in
 * metre-sized tangent offsets using JS doubles; no GPU/readback approximation. */
export function terrainSurfaceNormal(position) {
  const radial = position.clone().normalize();
  const east = new Vector3().crossVectors(Math.abs(radial.y) < .9 ? new Vector3(0,1,0) : new Vector3(1,0,0), radial).normalize();
  const north = new Vector3().crossVectors(radial, east).normalize();
  const sample = (axis, distance) => {
    const d = position.clone().addScaledVector(axis, distance).normalize();
    return Math.max(0, terrainHeight(d.x,d.y,d.z));
  };
  return radial.addScaledVector(east, -(sample(east,1)-sample(east,-1))*.5)
    .addScaledVector(north, -(sample(north,1)-sample(north,-1))*.5).normalize();
}
