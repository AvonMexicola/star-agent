import source from '../assets/stratum/layout.json' with { type: 'json' };

function freeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

/** One authoring/integration contract, in object-local metres, +Y up / −Z bow. */
export const STRATUM_LAYOUT = freeze(source);

export function stratumRampPose(progress) {
  const p = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  const { ramp, interior } = STRATUM_LAYOUT;
  const slope = Math.atan2(interior.floorY, ramp.run);
  const length = Math.hypot(ramp.run, interior.floorY);
  const hinge = Math.min(p / 0.40, 1);
  const extension = Math.max(0, Math.min(1, (p - 0.40) / 0.50));
  const lift = Math.max(0, (p - 0.90) / 0.10);
  const span = (length - ramp.segmentLength) / 2;
  return {
    angle: -Math.PI / 2 + (Math.PI / 2 + slope) * hinge,
    middle: span * extension,
    end: 2 * span * extension,
    middleLift: -ramp.stackDrop + (ramp.stackDrop + ramp.deckRise) * lift,
    endLift: -2 * ramp.stackDrop + 2 * (ramp.stackDrop + ramp.deckRise) * lift,
    ready: p >= 1,
  };
}

export function stratumRampFloor(z) {
  const { ramp, interior } = STRATUM_LAYOUT;
  if (!Number.isFinite(z) || z < ramp.hinge[2] || z > ramp.endZ) return null;
  return interior.floorY * (ramp.endZ - z) / ramp.run;
}
