import {Box3, Quaternion, Ray, Vector3} from 'three';
import {getWorldBoxes} from './build/collision.js';
import {getPieceDefinition} from './build/definitions.js';
import {contains, boxPolygon} from './build/polygons.js';
import {roverFootprint, roverSweptBounds} from './rover-physics.js';

const UP = new Vector3(0, 1, 0), v = a => new Vector3(...a);
const overlaps = (a, b) => a.min.x < b.max[0] - .002 && a.max.x > b.min[0] + .002 &&
  a.min.y < b.max[1] - .002 && a.max.y > b.min[1] + .002 && a.min.z < b.max[2] - .002 && a.max.z > b.min[2] + .002;

/** Construction owns these surfaces and solids. The rover only queries them;
 * canonical terrain remains the fallback. Cached boxes retain JS doubles. */
export function createRoverBuildSupport({claims, doorFraction = (c, p) => p.doorOpen ?? false}) {
  const cache = new WeakMap();
  function geometry(claim) {
    let entry = cache.get(claim);
    if (entry?.pieces === claim.pieces) return entry;
    const rotation = new Quaternion(...claim.quaternion), boxes = [], doors = [];
    for (const p of claim.pieces) {
      const def = getPieceDefinition(p);
      if (def.door) { doors.push(p); continue; }
      for (const b of getWorldBoxes(p)) boxes.push({...b, supporting: Boolean(def.support) && b.support !== false && b.kind !== 'rail', pieceId: p.id});
    }
    entry = {pieces: claim.pieces, rotation, inverse: rotation.clone().invert(), origin: v(claim.origin), boxes, doors};
    cache.set(claim, entry); return entry;
  }
  function nearby(point) {
    return claims().filter(c => v(c.origin).distanceToSquared(point) < (c.radius + 30) ** 2).map(c => ({claim: c, ...geometry(c)}));
  }
  function sample(point) {
    let best = null;
    for (const g of nearby(point)) {
      const local = point.clone().sub(g.origin).applyQuaternion(g.inverse);
      for (const b of g.boxes) {
        if (!b.supporting || b.max[1] > local.y + .4 || b.max[1] < local.y - .4 || !contains(boxPolygon(b), local.x, local.z)) continue;
        const hit = {point: new Vector3(local.x, b.max[1], local.z).applyQuaternion(g.rotation).add(g.origin), normal: UP.clone().applyQuaternion(g.rotation), source: `construction:${g.claim.id}:${b.pieceId}`};
        if (!best || hit.point.clone().sub(point).dot(hit.normal) > best.point.clone().sub(point).dot(best.normal)) best = hit;
      }
    }
    return best;
  }
  function clearPose(previous, proposed = previous) {
    for (const g of nearby(proposed.position)) {
      const local = pose => pose.position.clone().sub(g.origin).applyQuaternion(g.inverse);
      const a = local(previous), b = local(proposed), corners = pose => roverFootprint(pose.position, pose.quaternion).map(p => p.sub(g.origin).applyQuaternion(g.inverse));
      const oldBox = new Box3().setFromPoints(corners(previous)), nextBox = new Box3().setFromPoints(corners(proposed));
      const bounds = roverSweptBounds();
      const floorCeiling = Math.max(...[previous, proposed].flatMap(pose => [bounds.min[0], bounds.max[0]].flatMap(x => [bounds.min[2], bounds.max[2]].map(z => new Vector3(x, 0, z).applyQuaternion(pose.quaternion).add(pose.position).sub(g.origin).applyQuaternion(g.inverse).y)))) + .26;
      const solids = [...g.boxes, ...g.doors.flatMap(p => getWorldBoxes(p, doorFraction(g.claim, p)))];
      const delta = b.clone().sub(a), distance = delta.length();
      for (const solid of solids) {
        // Load-bearing contact within the existing 26 cm step budget is handled
        // by the four-wheel solver. Ceilings and taller risers remain obstacles.
        if (solid.supporting && solid.max[1] <= floorCeiling) continue;
        if (overlaps(nextBox, solid)) return false;
        if (distance < 1e-8) continue;
        const offsetMin = oldBox.min.clone().sub(a).min(nextBox.min.clone().sub(b)), offsetMax = oldBox.max.clone().sub(a).max(nextBox.max.clone().sub(b));
        const expanded = new Box3(v(solid.min).sub(offsetMax), v(solid.max).sub(offsetMin));
        const ray = new Ray(a, delta.clone().divideScalar(distance));
        const hit = ray.intersectBox(expanded, new Vector3());
        if (hit && hit.distanceTo(a) < distance - .002) return false;
      }
    }
    return true;
  }
  return {sample, clearPose};
}
