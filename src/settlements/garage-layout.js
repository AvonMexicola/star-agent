import {Vector3, Quaternion} from 'three';
import {bodyAt, bodyOffset, bodySurfacePoint} from '../celestial.js';

/** Existing kit parts; all ramp supports sample the same canonical world floor. */
export function addGarageAccess(put, site, z, flatRows = 0) {
  const rotation = new Quaternion(...site.quaternion), origin = new Vector3(...site.origin);
  const world = point => new Vector3(...point).applyQuaternion(rotation).add(origin);
  const height = (x, z) => {
    const point = world([x, 0, z]), body = bodyAt(point);
    return bodySurfacePoint(bodyOffset(point, body).normalize(), body).sub(origin).applyQuaternion(rotation.clone().invert()).y;
  };
  const terminal = put('terminal', 25.7, site.deck, z - 6, Math.PI / 2);
  // Two lanes, 8 m wide, descend 0.6 m per 4 m module (8.5 degrees).
  // The authored approach includes flat spans over the surveyed rocky patches.
  let rows = 0, top = site.deck, rampCount = 0;
  for (; rows < 32; rows++) {
    const x = 42 + rows * 4, descending = rows >= flatRows;
    const bottom = top - (descending ? .6 : 0);
    for (const lane of [-2, 2]) {
      const floor = Math.min(...[-2, 0, 2].flatMap(dx => [-2, 0, 2].map(dz => height(x + dx, z + lane + dz))));
      put('foundation', x, bottom, z + lane, 0, {supportDepth: Math.max(.6, Math.min(24, Math.ceil((bottom - floor + .15) * 10) / 10))});
      if (descending) put('foundation-ramp', x, top, z + lane, Math.PI / 2);
    }
    if (descending) rampCount++;
    top = bottom;
    if (descending && [-3, -1, 1, 3].every(dz => height(x + 2, z + dz) >= top - .02)) { rows++; break; }
  }
  return {terminalPiece: terminal, position: [32, site.deck, z], rotation: -Math.PI / 2,
    width: 16, depth: 16, height: 6, rampRows: rows, rampCount, rampEnd: [40 + rows * 4, top, z]};
}
