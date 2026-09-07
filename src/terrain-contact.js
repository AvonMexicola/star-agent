import { Vector3 } from 'three';

/** Sweep against a canonical radial terrain sampler; cap unresolved long steps safely. */
export function constrainTerrainStep(previous, proposed, { radius, position, maxHeight, sample }, clearance = 3.2) {
  const center = new Vector3(...position), start = previous.clone().sub(center), delta = proposed.clone().sub(previous);
  const length = delta.length(), bound = radius + maxHeight + clearance;
  const distanceAt = t => {
    const local = start.clone().addScaledVector(delta, t), r = local.length();
    if (r < 1) return -radius;
    local.divideScalar(r); return r - radius - sample(local.x, local.y, local.z).height - clearance;
  };
  const contact = t => {
    const d = start.clone().addScaledVector(delta, t); if (d.lengthSq() < 1) d.set(0, 0, 1); d.normalize();
    return { point: d.clone().multiplyScalar(radius + sample(d.x, d.y, d.z).height + clearance).add(center), hit: true, t };
  };
  if (start.length() < bound && distanceAt(0) <= 0) return contact(0);
  if (length === 0) return { point: proposed, hit: false };
  const ray = delta.clone().divideScalar(length), b = start.dot(ray), c = start.lengthSq() - bound * bound, disc = b * b - c;
  if (disc < 0) return { point: proposed, hit: false };
  const root = Math.sqrt(disc), entry = Math.max(0, (-b - root) / length), exit = Math.min(1, (-b + root) / length);
  if (exit < entry || exit < 0 || entry > 1) return { point: proposed, hit: false };
  let t = entry, last = t;
  for (let i = 0; i < 4096 && t <= exit; i++) {
    const height = distanceAt(t);
    if (height <= .002) {
      let lo = last, hi = t;
      for (let j = 0; j < 24; j++) { const mid = (lo + hi) / 2; if (distanceAt(mid) > 0) lo = mid; else hi = mid; }
      return contact(hi);
    }
    if (t === exit) break;
    last = t; t = Math.min(exit, t + Math.min(250, height / 20) / length);
  }
  if (t < exit) return { point: previous.clone().addScaledVector(delta, t), hit: false, limited: true };
  return { point: proposed, hit: false };
}
