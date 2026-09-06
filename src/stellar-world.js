import * as THREE from 'three';
import { PYRE_RADIUS, PYRE_POSITION } from './pyre-world.js';
import { RADIUS, SUN_RADIUS, SUN_DISTANCE, SUN_DIRECTION, SUN_ANGULAR_RADIUS, clamp, smoothstep } from './world.js';
import { MOON_RADIUS, MOON_POSITION } from './moon-world.js';

// The star as a place. World positions are planet-centred doubles in metres and
// everything renders camera-relative, like every other body. See docs/sun.md.
export const SUN_NAME = 'Our star';
export const SUN_POSITION = Object.freeze(SUN_DIRECTION.map(v => v * SUN_DISTANCE));
/** Seconds for one full rotation. A ~25-day solar period compressed so spots visibly drift in a session. */
export const SUN_ROTATION_PERIOD = 600;
/** Rotation axis: perpendicular to the Aeon line of sight, as close to +Y as possible, so spots drift left→right from the standoff. */
export const SUN_AXIS = Object.freeze((() => {
  const d = new THREE.Vector3(...SUN_DIRECTION), up = new THREE.Vector3(0, 1, 0);
  return up.sub(d.multiplyScalar(up.dot(d))).normalize().toArray();
})());
/** Navigation-drive exclusion only. Manual flight may enter and suffer thermal damage. */
export const SUN_EXCLUSION_RADII = 1 + 100_000_000 / SUN_RADIUS;
export const SUN_EXCLUSION = SUN_RADIUS * SUN_EXCLUSION_RADII;
/** Full angle the disk subtends at the 500,000 km surface-clearance arrival. */
export const SUN_STANDOFF_ANGLE = 2 * Math.asin(SUN_RADIUS / (SUN_RADIUS + 500_000_000));
/** Range used for visual glare/heat grading; ship thermal state is separate. */
export const SUN_HEAT_RANGE = 5_000_000_000;
/** Inside this centre distance the real sphere renders; the atmosphere-pass disk fades out over SUN_DISK_FADE. */
export const SUN_SPHERE_RANGE = 14_000_000_000;
export const SUN_DISK_FADE = Object.freeze([10_000_000_000, 14_000_000_000]);
/** Corona billboard half-extent, in stellar radii. */
export const CORONA_EXTENT = 3.2;
export const PROMINENCE_COUNT = 8;

/** Angular radius (rad) of the photosphere seen from `distance` metres (centre distance). */
export function sunAngularRadius(distance) {
  return Math.asin(clamp(SUN_RADIUS / Math.max(SUN_RADIUS, distance), 0, 1));
}
/** Centre distance at which the disk subtends `angle` (full angle). Limb rays are tangents, so sin, not tan. */
export function standoffDistance(angle = SUN_STANDOFF_ANGLE) {
  return SUN_RADIUS / Math.sin(angle / 2);
}
export const SUN_ARRIVAL_CLEARANCE = 500_000_000;
export const SUN_STANDOFF = SUN_RADIUS + SUN_ARRIVAL_CLEARANCE;
/** Arrival point between Aeon and the star: the star fills about 38° and Aeon is behind you. */
export function sunStandoffPoint(distance = SUN_STANDOFF) {
  return new THREE.Vector3(...SUN_POSITION).addScaledVector(new THREE.Vector3(...SUN_DIRECTION), -distance);
}
/** 0 beyond SUN_HEAT_RANGE, 1 at the exclusion sphere; inverse-square between (radiant flux). */
export function sunHeat(distance) {
  if (!Number.isFinite(distance)) return 0;
  const d = Math.max(SUN_EXCLUSION, distance);
  const flux = (SUN_EXCLUSION / d) ** 2, floor = (SUN_EXCLUSION / SUN_HEAT_RANGE) ** 2;
  return clamp((flux - floor) / (1 - floor), 0, 1);
}
/** Weight of the atmosphere-pass disk: 1 from Aeon, 0 once the sphere has taken over. */
export function sunDiskWeight(distance) { return smoothstep(SUN_DISK_FADE[0], SUN_DISK_FADE[1], distance); }
export function sunRotationAngle(elapsed) { return (elapsed / SUN_ROTATION_PERIOD) * Math.PI * 2 % (Math.PI * 2); }
/** Fast rise, slow decay light-curve for a flare site; `seed` staggers sites. Returns 0..1. */
export function flareCurve(elapsed, period = 75, seed = 0) {
  const t = (elapsed + seed * period * .618) % period, rise = 1.8, decay = 14;
  if (t < rise) return t / rise;
  return Math.exp(-(t - rise) / decay);
}

/** Fraction (0..1) of the disk not hidden behind spherical occluders, seen from `position`. */
export function sunVisibility(position, occluders = DEFAULT_OCCLUDERS) {
  const toSun = new THREE.Vector3(...SUN_POSITION).sub(position), distance = toSun.length();
  if (distance <= SUN_RADIUS) return 1;
  const direction = toSun.divideScalar(distance), sunAngle = sunAngularRadius(distance);
  let visible = 1;
  for (const occluder of occluders) {
    const toCentre = new THREE.Vector3(...occluder.center).sub(position), range = toCentre.length();
    if (range >= distance || range === 0) continue;
    if (range < occluder.radius) return 0;
    const occluderAngle = Math.asin(occluder.radius / range);
    const separation = Math.acos(clamp(toCentre.divideScalar(range).dot(direction), -1, 1));
    visible *= clamp((separation - (occluderAngle - sunAngle)) / (2 * sunAngle), 0, 1);
  }
  return visible;
}
export const DEFAULT_OCCLUDERS = [
  { name: 'Aeon', center: [0, 0, 0], radius: RADIUS },
  { name: 'Selene', center: MOON_POSITION, radius: MOON_RADIUS },
  { name: 'Pyre', center: PYRE_POSITION, radius: PYRE_RADIUS },
];
