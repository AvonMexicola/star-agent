import { Vector3 } from 'three';
import { bodyAt, bodyAltitude } from './celestial.js';
import { SEED } from './world.js';

export const ATLAS_RAMP_MIN_PITCH = -10 * Math.PI / 180;
export const ATLAS_RAMP_MAX_PITCH = 55 * Math.PI / 180;
const poses = new WeakMap();

/** Lower the actual rigid ramp until its walking surface first meets ground.
 * Sampling the width prevents a centre-only fit burying an outer edge. */
export function atlasRampGroundAngle(ramp, clearance) {
  const point = new Vector3();
  const gap = pitch => {
    const angle = ramp.outward * pitch, sin = Math.sin(angle), cos = Math.cos(angle);
    let minimum = Infinity;
    for (let distance = .5; distance <= ramp.length; distance += .5) {
      // The contact edge needs denser samples than the elevated main panel.
      const across = distance === ramp.length ? 32 : 4;
      for (let index = 0; index <= across; index++) {
        const fraction = index / across - .5;
        point.set(ramp.pivot[0] + ramp.width * fraction,
          ramp.pivot[1] - ramp.outward * distance * sin,
          ramp.pivot[2] + ramp.outward * distance * cos);
        minimum = Math.min(minimum, clearance(point));
      }
    }
    return minimum;
  };
  let low = ATLAS_RAMP_MIN_PITCH, high = low;
  if (gap(low) <= 0) return null;
  // The footprint shortens as it lowers. Search in deployment order so a
  // raised patch is not skipped merely because the far endpoint clears it.
  while (high < ATLAS_RAMP_MAX_PITCH) {
    high = Math.min(ATLAS_RAMP_MAX_PITCH, low + 2.5 * Math.PI / 180);
    if (gap(high) <= 0) break;
    low = high;
  }
  if (low === high) return null;
  for (let i = 0; i < 23; i++) {
    const middle = (low + high) / 2;
    if (gap(middle) > 0) low = middle;else high = middle;
  }
  return ramp.outward * low;
}

/** Shared client/server navigation hook. Cache the parked pose, not frame time. */
export function updateAtlasRampGround(nav) {
  const systems = nav.freighter;
  if (!systems?.setRampOpenAngle || nav.shipId !== 'atlas') return;
  // Connected clients display the server's replicated mechanism angles.
  if (nav.multiplayer?.connected) return;
  const parked = nav.shipPosition && !nav.dockedAtStation && !nav.stationLift
    && !nav.spaceParked && !nav.cabinFlight && !nav.travel && ['landed', 'walk', 'eva'].includes(nav.mode);
  const previous = poses.get(nav);
  if (!parked) {
    if (previous?.parked && previous.systems === systems) {
      for (const ramp of systems.ramps) systems.setRampOpenAngle(ramp.id, ramp.nominalOpenAngle);
    }
    if (previous?.parked !== false || previous.systems !== systems) poses.set(nav, { systems, parked: false });
    return;
  }
  const baseRevision = nav.baseLandingRevision?.(), cargoRevision = nav.cargoLandingRevision?.();
  if (previous?.parked && previous.systems === systems && previous.seed === SEED
    && previous.baseSampler === nav.baseLandingSurface && previous.cargoSampler === nav.cargoLandingSurface
    && previous.baseRevision === baseRevision && previous.cargoRevision === cargoRevision && previous.position.equals(nav.shipPosition)
    && previous.quaternion.equals(nav.shipOrientation)) return;
  const position = nav.shipPosition.clone(), quaternion = nav.shipOrientation.clone();
  poses.set(nav, { systems, parked: true, position, quaternion, seed: SEED,
    baseSampler: nav.baseLandingSurface, cargoSampler: nav.cargoLandingSurface, baseRevision, cargoRevision });
  const body = bodyAt(position);
  if (body.star) return;
  const world = new Vector3(), delta = new Vector3(), base = nav.baseLandingSurface?.({ position, orientation: quaternion });
  const clearance = point => {
    world.copy(point).applyQuaternion(quaternion).add(position);
    let gap = bodyAltitude(world, body);
    const pad = nav.cargoLandingSurface?.(world);
    if (pad) gap = Math.min(gap, delta.copy(world).sub(pad.point).dot(pad.up));
    // A build landing surface is returned only when the complete hull fits.
    // Atlas's deployed ramps remain within that footprint.
    if (base) gap = Math.min(gap, delta.copy(world).sub(base.point).dot(base.normal));
    return gap;
  };
  for (const ramp of systems.ramps) {
    systems.setRampOpenAngle(ramp.id, atlasRampGroundAngle(ramp, clearance) ?? ramp.nominalOpenAngle);
  }
}
