import { IcosahedronGeometry, Vector3 } from 'three';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import { asteroidField, randomFor } from './ring-world.js';

export const ASTEROID_SHAPE_VERSION = 2;
export const ASTEROID_VARIANTS = 4;
export const ASTEROID_MAX_RADIUS = 1.9;
const profiles = new Map();
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const smooth = (a, b, n) => { const t = clamp((n - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
function profile(family, variant) {
  if (!Number.isInteger(family) || family < 0 || family > 5 || !Number.isInteger(variant) || variant < 0 || variant >= ASTEROID_VARIANTS) throw new RangeError('Unknown asteroid family or variant');
  const key = family * ASTEROID_VARIANTS + variant;
  if (profiles.has(key)) return profiles.get(key);
  const random = randomFor(0x41535445 ^ key * 7919);
  const vector = () => new Vector3(random() * 2 - 1, random() * 2 - 1, random() * 2 - 1).normalize();
  const axes = [[1.6, 1.28, 1.48], [1.69, 1.23, 1.46], [1.37, 1.63, 1.29], [1.76, .87, 1.34], [1.49, 1.38, 1.55], [1.7, 1.2, 1.44]][family].map(n => n * (.9 + random() * .15));
  // Six face directions and eight corners cover the whole sphere. Every broad
  // surface terminates at a fracture plane rather than an ellipsoid fallback.
  const directions = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
  for (const x of [-1,1]) for (const y of [-1,1]) for (const z of [-1,1]) directions.push([x,y,z]);
  const planes = directions.map(direction => {
    const normal = new Vector3(...direction).normalize().addScaledVector(vector(), .17).normalize();
    const radius = 1 / Math.sqrt((normal.x / axes[0]) ** 2 + (normal.y / axes[1]) ** 2 + (normal.z / axes[2]) ** 2);
    return { normal, offset: radius * (.73 + random() * .15) };
  });
  for (let cut=0;cut<3;cut++) planes.push({normal:vector(),offset:.82+random()*.3});
  const pits = Array.from({ length: family === 4 ? 6 : 2 }, () => ({ direction: vector(), radius: .2 + random() * .21, depth: family === 4 ? .18 + random() * .23 : .06 + random() * .10 }));
  const result = { axes, planes, pits, fault: vector(), phase: random() * Math.PI * 2, shoulder: vector() };
  profiles.set(key, result); return result;
}

/** One radial geological surface for every LOD. Broad planar cuts survive low LOD;
 * finer ridges and shallow spalls are samples of this same surface, never a new shape. */
export function asteroidRadius(direction, family = 0, variant = 0) {
  const p = profile(family, variant), d = direction.clone().normalize();
  if (!Number.isFinite(d.lengthSq()) || d.lengthSq() < .5) throw new RangeError('Asteroid direction must be nonzero');
  let radius = ASTEROID_MAX_RADIUS;
  // Bedrock blocks terminate at real planes; this produces large readable fracture faces.
  for (const plane of p.planes) {
    const facing = d.dot(plane.normal);
    if (facing > 0) radius = Math.min(radius, plane.offset / facing);
  }
  const fault = d.dot(p.fault), shoulder = d.dot(p.shoulder);
  // Short broken ledges, concentrated in one geological fault. No global
  // latitude displacement: that reads as an onion instead of fractured stone.
  const brokenLedge = Math.exp(-((fault / .22) ** 2)) * Math.max(0, Math.sin(shoulder * 13 + p.phase));
  radius -= (family === 3 ? .10 : .035) * brokenLedge;
  if (family === 1) radius += .065 * Math.abs(shoulder) - .065 * Math.exp(-(((fault + .18) / .09) ** 2));
  if (family === 2) radius += .075 * Math.abs(shoulder) - .14 * Math.exp(-((fault / .095) ** 2));
  if (family === 5) radius += .11 * Math.abs(shoulder) - .22 * Math.exp(-((fault / .105) ** 2));
  for (const pit of p.pits) {
    const angular = Math.sqrt(Math.max(0, 2 - 2 * d.dot(pit.direction)));
    radius -= pit.depth * (1 - smooth(pit.radius * .22, pit.radius, angular));
    radius += pit.depth * .13 * Math.exp(-(((angular - pit.radius) / .045) ** 2));
  }
  // Chipped edges live near a fault, avoiding rounded noise over every face.
  radius -= .032 * Math.exp(-(((Math.abs(fault) - .36) / .055) ** 2)) * (.5 + .5 * Math.sin(shoulder * 31 + p.phase));
  return clamp(radius, .57, ASTEROID_MAX_RADIUS);
}

/** Exact original small-rock geometry. Its visible boundary still matches mining's density field. */
export function legacyAsteroidGeometry(family, detail = 1) {
  const geometry = new IcosahedronGeometry(1, detail), positions = geometry.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const v = new Vector3().fromBufferAttribute(positions, i).normalize(); let lo = 0, hi = 1.95;
    for (let step = 0; step < 15; step++) { const m = (lo + hi) / 2; if (asteroidField(v.x * m, v.y * m, v.z * m, family) < 0) lo = m; else hi = m; }
    positions.setXYZ(i, v.x * lo, v.y * lo, v.z * lo);
  }
  geometry.computeVertexNormals(); geometry.computeBoundingSphere(); return geometry;
}

export function createAsteroidGeometry(family, detail = 2, variant = 0, { large = true } = {}) {
  if (!large) return legacyAsteroidGeometry(family, detail);
  profile(family, variant);
  if (!Number.isInteger(detail) || detail < 0 || detail > 12) throw new RangeError('Asteroid detail must be between 0 and 12');
  const geometry = new IcosahedronGeometry(1, detail), positions = geometry.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const direction = new Vector3().fromBufferAttribute(positions, i).normalize();
    positions.setXYZ(i, ...direction.multiplyScalar(asteroidRadius(direction, family, variant)).toArray());
  }
  geometry.computeVertexNormals();
  toCreasedNormals(geometry, Math.PI * .105);
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  // Exact origin-centered bound used by descriptor culling and clearance guarantees.
  geometry.boundingSphere.center.set(0, 0, 0);
  geometry.boundingSphere.radius = Math.max(...Array.from({ length: positions.count }, (_, i) => new Vector3().fromBufferAttribute(positions, i).length()));
  geometry.userData = { asteroidShapeVersion: ASTEROID_SHAPE_VERSION, family, variant, large: true };
  return geometry;
}
