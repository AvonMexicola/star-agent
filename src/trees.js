// Procedural trees for Star Agent: branching trunks, painted leaf cards, wind, and
// baked impostors for the far LOD. No downloaded assets; everything is generated at
// startup. Geometries live in a canonical 1-unit-tall frame (base y = 0, top y = 1,
// +Y up) so callers scale by tree size exactly as vegetation.js does today.
//
//   import { createTreeSpecies, createTreeImpostor, Forest, wind, lod, TREE_STATS } from './trees.js';
//
// createTreeSpecies(kind, seed)  -> { kind, trunkGeometry, leafGeometry, trunkMaterial, leafMaterial, height, radius, stats }
// createTreeImpostor(species, renderer) -> { geometry, material, albedo, normals, dispose() }   (2 triangles per tree)
// new Forest(scene, { renderer })  mirrors Vegetation's API: update(worldPos, renderOrigin, seconds), setExclusion(), dispose().
//
// Shared uniforms (`wind`, `lod`) are plain { value } objects referenced by every tree
// material, so setting wind.time.value once per frame animates every tree.

import * as THREE from 'three';
import { RADIUS, terrainHeight, moisture, biomeAt, hash, noise } from './world.js';

export { THREE };

const TAU = Math.PI * 2;
const UP = new THREE.Vector3(0, 1, 0);
export const KINDS = ['conifer', 'broadleaf', 'birch'];

/** Wind state shared by all tree materials. `direction` is in the tree group's space. */
export const wind = {
  time: { value: 0 },
  strength: { value: 0.6 },
  direction: { value: new THREE.Vector3(0.8, 0, 0.6).normalize() },
};

/** LOD state shared by all tree materials. Near geometry fades out past `nearEnd`,
 * impostors fade in past `farStart`; both over `band` metres with a screen-door dither.
 * Defaults keep near geometry always on and impostors always on, so each works alone. */
export const lod = {
  nearEnd: { value: 1e9 },
  farStart: { value: -1e9 },
  band: { value: 30 },
};

export const TREE_STATS = {};

// ---------------------------------------------------------------------------
// Small deterministic RNG (mulberry32)
function makeRng(seed) {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const lerp = (a, b, t) => a + (b - a) * t;
const range = (rng, a, b) => a + (b - a) * rng();

// ---------------------------------------------------------------------------
// Species parameters (colours are linear, sunlit albedo 0.2–0.8 before ACES)
const SPECIES = {
  conifer: {
    radius: 0.19,
    bark: [0.26, 0.17, 0.12], barkDark: [0.08, 0.05, 0.035],
    barkParams: [14, 9, 0, 0.55],          // streaks around, streaks along, birch marks, crevice depth
    leafRough: 0.9, wrap: 0.6, translucency: 0.4,
  },
  broadleaf: {
    radius: 0.36,
    bark: [0.30, 0.24, 0.19], barkDark: [0.10, 0.075, 0.055],
    barkParams: [11, 6, 0, 0.5],
    leafRough: 0.8, wrap: 0.5, translucency: 0.6,
  },
  birch: {
    radius: 0.24,
    bark: [0.72, 0.70, 0.64], barkDark: [0.08, 0.07, 0.06],
    barkParams: [6, 3, 1, 0.15],
    leafRough: 0.8, wrap: 0.5, translucency: 0.7,
  },
};

// ---------------------------------------------------------------------------
// Geometry builder
class GeoBuilder {
  constructor() { this.positions = []; this.normals = []; this.uvs = []; this.extra = []; this.indices = []; }
  get vertexCount() { return this.positions.length / 3; }
  /** Tapered tube along a path of { p: Vector3, r: radius }, parallel-transport frames. */
  addTube(path, radial) {
    const tangent = new THREE.Vector3(), normal = new THREE.Vector3(), binormal = new THREE.Vector3();
    const v = new THREE.Vector3();
    let length = 0;
    const base = this.vertexCount;
    for (let i = 0; i < path.length; i++) {
      const prev = path[Math.max(0, i - 1)].p, next = path[Math.min(path.length - 1, i + 1)].p;
      tangent.subVectors(next, prev).normalize();
      if (i === 0) {
        normal.set(0, 0, 1);
        if (Math.abs(tangent.dot(normal)) > 0.9) normal.set(1, 0, 0);
        normal.addScaledVector(tangent, -tangent.dot(normal)).normalize();
      } else {
        length += path[i].p.distanceTo(path[i - 1].p);
        normal.addScaledVector(tangent, -tangent.dot(normal)).normalize();
      }
      binormal.crossVectors(tangent, normal);
      const r = path[i].r;
      for (let j = 0; j <= radial; j++) {
        const a = (j / radial) * TAU, c = Math.cos(a), s = Math.sin(a);
        v.copy(normal).multiplyScalar(c).addScaledVector(binormal, s);
        this.normals.push(v.x, v.y, v.z);
        this.positions.push(path[i].p.x + v.x * r, path[i].p.y + v.y * r, path[i].p.z + v.z * r);
        this.uvs.push(j / radial, length);
        this.extra.push(0, 0);
      }
    }
    const stride = radial + 1;
    for (let i = 0; i < path.length - 1; i++) {
      for (let j = 0; j < radial; j++) {
        const a = base + i * stride + j, b = a + 1, c = a + stride, d = c + 1;
        this.indices.push(a, c, b, b, c, d);
      }
    }
  }
  /** Quad card centred at `c`, spanned by half-axes `a` and `b`; `n` is the lighting normal. */
  addCard(c, a, b, n, flip, shade, phase) {
    const base = this.vertexCount;
    const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    const bent = new THREE.Vector3();
    for (const [sa, sb] of corners) {
      this.positions.push(c.x + a.x * sa + b.x * sb, c.y + a.y * sa + b.y * sb, c.z + a.z * sa + b.z * sb);
      // Bend the normal toward each corner so a card shades like a puffy bunch, not a plate.
      bent.set(a.x * sa + b.x * sb, a.y * sa + b.y * sb, a.z * sa + b.z * sb).normalize().multiplyScalar(0.5).add(n).normalize();
      this.normals.push(bent.x, bent.y, bent.z);
      this.uvs.push(flip ? (1 - sa) * 0.5 : (sa + 1) * 0.5, (sb + 1) * 0.5);
      this.extra.push(shade, phase);
    }
    this.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  build(extraName) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.normals, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uvs, 2));
    if (extraName) g.setAttribute(extraName, new THREE.Float32BufferAttribute(this.extra, 2));
    g.setIndex(this.indices);
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}

/** Grow a curved path from `start` along `dir`; `gravity` bends it down (+) or up (-). */
function grow(start, dir, length, segments, r0, r1, wobble, gravity, rng) {
  const path = [{ p: start.clone(), r: r0, d: dir.clone().normalize() }];
  const p = start.clone(), d = dir.clone().normalize();
  const step = length / segments;
  for (let i = 1; i <= segments; i++) {
    d.x += (rng() - 0.5) * wobble; d.z += (rng() - 0.5) * wobble;
    d.y += (rng() - 0.5) * wobble * 0.5 - gravity;
    d.normalize();
    p.addScaledVector(d, step);
    const t = i / segments;
    path.push({ p: p.clone(), r: lerp(r0, r1, t * t * 0.4 + t * 0.6), d: d.clone() });
  }
  return path;
}
function pathPoint(path, t) {
  const f = t * (path.length - 1), i = Math.min(path.length - 2, Math.floor(f)), k = f - i;
  return { p: path[i].p.clone().lerp(path[i + 1].p, k), d: path[i + 1].d.clone(), r: lerp(path[i].r, path[i + 1].r, k) };
}
/** Unit vector at `pitch` above the horizon, `yaw` around +Y. */
function direction(yaw, pitch) {
  const c = Math.cos(pitch);
  return new THREE.Vector3(Math.cos(yaw) * c, Math.sin(pitch), Math.sin(yaw) * c);
}

/** Two crossed cards sharing axis `axis`, with spherical lighting normals around `crown`. */
function addCluster(leaves, centre, axis, size, aspect, crown, rng, upBias = 0.35, tilt = Math.PI / 4, flip = true, crownRadius = 0.3) {
  const a = axis.clone().normalize();
  const h = new THREE.Vector3().crossVectors(a, UP);          // horizontal, perpendicular to the axis
  if (h.lengthSq() < 1e-4) h.set(Math.cos(rng() * TAU), 0, Math.sin(rng() * TAU)).cross(a);
  h.normalize();
  const v = new THREE.Vector3().crossVectors(h, a).normalize(); // perpendicular, in the axis' vertical plane
  const b1 = h.clone().multiplyScalar(Math.cos(tilt)).addScaledVector(v, Math.sin(tilt));
  const b2 = h.clone().multiplyScalar(Math.cos(tilt)).addScaledVector(v, -Math.sin(tilt));
  const n = centre.clone().sub(crown);
  n.y += upBias * Math.max(0.05, n.length());
  n.normalize();
  // Cheap ambient occlusion: clusters deep inside or low in the crown are darker.
  const rel = centre.clone().sub(crown);
  const radial = Math.hypot(rel.x, rel.z);
  const occlusion = THREE.MathUtils.clamp(0.55 + radial / Math.max(0.12, crownRadius) * 0.5 + rel.y * 0.35, 0.45, 1.15);
  const shade = range(rng, 0.85, 1.12) * occlusion, phase = rng();
  const ha = a.clone().multiplyScalar(size * aspect);
  leaves.addCard(centre, ha, b1.multiplyScalar(size), n, flip && rng() < 0.5, shade, phase);
  leaves.addCard(centre, ha, b2.multiplyScalar(size), n, flip && rng() < 0.5, shade * range(rng, 0.92, 1.05), phase + 0.37);
}

// ---------------------------------------------------------------------------
// Species skeletons
function buildConifer(rng) {
  const trunk = new GeoBuilder(), leaves = new GeoBuilder();
  const crown = new THREE.Vector3(0, 0.45, 0);
  const spine = grow(new THREE.Vector3(), UP, 0.98, 12, 0.026, 0.002, 0.03, 0, rng);
  trunk.addTube(spine, 7);
  const whorls = 9;
  let clusters = 0;
  for (let w = 0; w < whorls; w++) {
    const tw = lerp(0.14, 0.9, w / (whorls - 1)) + range(rng, -0.035, 0.035);
    const count = (w < whorls - 2 ? 3 + (rng() < 0.5 ? 1 : 0) : 3) + 1;   // last one is a filler between tiers
    const yaw0 = rng() * TAU;
    for (let i = 0; i < count; i++) {
      const filler = i === count - 1;
      const t = filler ? Math.min(0.95, tw + range(rng, 0.03, 0.06)) : tw + range(rng, -0.012, 0.012);
      const at = pathPoint(spine, t);
      const yaw = yaw0 + (i / (count - 1)) * TAU + range(rng, -0.3, 0.3);
      const length = (0.05 + 0.24 * Math.pow(1 - t, 0.85)) * range(rng, 0.8, 1.15) * (filler ? 0.7 : 1);
      const dir = direction(yaw, range(rng, 0.15, 0.35));
      const path = grow(at.p, dir, length, length > 0.12 ? 3 : 2, at.r * 0.5 + 0.004, 0.0015, 0.08, 0.14, rng);
      trunk.addTube(path, 4);
      const stops = length > 0.16 ? [0.45, 0.78, 1.05] : [0.5, 0.9];
      for (const s of stops) {
        const pt = pathPoint(path, Math.min(1, s));
        if (s > 1) pt.p.addScaledVector(pt.d, length * 0.08);
        const size = Math.max(0.05, Math.min(0.11, length * 0.42)) * range(rng, 0.85, 1.15);
        const axis = pt.d.clone(); axis.y -= 0.3; axis.normalize();
        const yawJitter = new THREE.Vector3(range(rng, -0.25, 0.25), 0, range(rng, -0.25, 0.25));
        addCluster(leaves, pt.p, axis.add(yawJitter).normalize(), size, 1.35, crown, rng, 0.55, range(rng, 0.8, 1.1), false, 0.28 * (1.1 - t));
        clusters++;
      }
    }
  }
  // Leader: a few small upright bunches near the tip.
  for (let i = 0; i < 4; i++) {
    const pt = pathPoint(spine, lerp(0.88, 0.99, i / 3));
    const axis = direction(rng() * TAU, range(rng, 0.9, 1.3));
    addCluster(leaves, pt.p, axis, lerp(0.07, 0.045, i / 3), 1.5, crown, rng, 0.6, 0.9, false);
    clusters++;
  }
  return { trunk, leaves, clusters, crown };
}

function buildBroadleaf(rng) {
  const trunk = new GeoBuilder(), leaves = new GeoBuilder();
  const crown = new THREE.Vector3(0, 0.66, 0);
  const lean = direction(rng() * TAU, Math.PI / 2 - 0.08);
  const spine = grow(new THREE.Vector3(), lean, 0.42, 7, 0.036, 0.022, 0.05, -0.01, rng);
  trunk.addTube(spine, 7);
  const top = spine[spine.length - 1];
  const primaries = 4 + (rng() < 0.6 ? 1 : 0);
  const yaw0 = rng() * TAU;
  let clusters = 0;
  const clusterAt = (pt, size) => {
    // Keep the crown rounded: pull stray tips toward the crown ellipsoid.
    const c = pt.p.clone();
    const rel = c.clone().sub(crown); rel.y /= 0.9;
    const d = rel.length();
    if (d > 0.34) c.copy(crown).addScaledVector(rel.normalize(), 0.34).setY(crown.y + rel.y * 0.34 * 0.9);
    c.x += range(rng, -0.03, 0.03); c.z += range(rng, -0.03, 0.03); c.y += range(rng, -0.02, 0.03);
    const axis = direction(rng() * TAU, range(rng, -0.4, 0.9));
    addCluster(leaves, c, axis, size, 1.0, crown, rng, 0.35, Math.PI / 4, true, 0.34);
    clusters++;
  };
  for (let i = 0; i < primaries; i++) {
    const yaw = yaw0 + (i / primaries) * TAU + range(rng, -0.35, 0.35);
    const start = pathPoint(spine, range(rng, 0.8, 1.0));
    const dir = direction(yaw, range(rng, 0.55, 1.0));
    const length = range(rng, 0.32, 0.42);
    const path = grow(start.p, dir, length, 6, 0.019, 0.006, 0.12, -0.03, rng);
    trunk.addTube(path, 5);
    clusterAt(pathPoint(path, 0.85), range(rng, 0.11, 0.14));
    clusterAt(pathPoint(path, 1.0), range(rng, 0.12, 0.15));
    const secondaries = 3;
    for (let j = 0; j < secondaries; j++) {
      const at = pathPoint(path, lerp(0.45, 0.95, j / (secondaries - 1)) + range(rng, -0.05, 0.05));
      const side = new THREE.Vector3().crossVectors(at.d, UP).normalize();
      if (side.lengthSq() < 0.5) side.set(1, 0, 0);
      const sdir = at.d.clone().addScaledVector(side, range(rng, 0.5, 1.1) * (j % 2 ? 1 : -1));
      sdir.y += range(rng, 0.1, 0.6); sdir.normalize();
      const slength = range(rng, 0.16, 0.26);
      const spath = grow(at.p, sdir, slength, 4, 0.007, 0.002, 0.16, -0.02, rng);
      trunk.addTube(spath, 5);
      clusterAt(pathPoint(spath, 0.45), range(rng, 0.10, 0.13));
      clusterAt(pathPoint(spath, 0.75), range(rng, 0.11, 0.14));
      clusterAt(pathPoint(spath, 1.0), range(rng, 0.11, 0.14));
    }
  }
  // Fill the crown volume with a few inner clusters so the canopy is not hollow.
  for (let i = 0; i < 34; i++) {
    const p = crown.clone().add(direction(rng() * TAU, range(rng, -0.6, 1.2)).multiplyScalar(range(rng, 0.08, 0.3)));
    clusterAt({ p, d: UP }, range(rng, 0.10, 0.13));
  }
  return { trunk, leaves, clusters, crown, top };
}

function buildBirch(rng) {
  const trunk = new GeoBuilder(), leaves = new GeoBuilder();
  const crown = new THREE.Vector3(0, 0.62, 0);
  const lean = direction(rng() * TAU, Math.PI / 2 - 0.06);
  const spine = grow(new THREE.Vector3(), lean, 0.92, 12, 0.019, 0.003, 0.05, -0.006, rng);
  trunk.addTube(spine, 7);
  const branches = 7 + Math.floor(rng() * 3);
  const yaw0 = rng() * TAU;
  let clusters = 0;
  const hang = (pt, size) => {
    const axis = direction(rng() * TAU, range(rng, -1.35, -0.7));   // drooping foliage
    addCluster(leaves, pt.p, axis, size, 1.15, crown, rng, 0.3, Math.PI / 4, true, 0.24);
    clusters++;
  };
  for (let i = 0; i < branches; i++) {
    const t = lerp(0.36, 0.93, i / (branches - 1)) + range(rng, -0.03, 0.03);
    const at = pathPoint(spine, t);
    const yaw = yaw0 + i * 2.39996 + range(rng, -0.4, 0.4);          // golden angle spiral
    const dir = direction(yaw, range(rng, 0.7, 1.05));
    const length = (0.12 + 0.2 * (1 - t)) * range(rng, 0.8, 1.2);
    const path = grow(at.p, dir, length, 4, Math.min(at.r * 0.7, 0.008), 0.0015, 0.12, 0.03, rng);
    trunk.addTube(path, 5);
    hang(pathPoint(path, 0.35), range(rng, 0.075, 0.1));
    hang(pathPoint(path, 0.65), range(rng, 0.085, 0.11));
    hang(pathPoint(path, 1.0), range(rng, 0.10, 0.125));
    // Birch foliage hangs in curtains: a couple of extra bunches below the branch.
    const below = pathPoint(path, range(rng, 0.5, 0.9)); below.p.y -= range(rng, 0.05, 0.12);
    hang(below, range(rng, 0.08, 0.105));
    if (length > 0.18) {
      const sat = pathPoint(path, range(rng, 0.5, 0.8));
      const sdir = sat.d.clone().add(direction(rng() * TAU, 0.2).multiplyScalar(0.8)).normalize();
      const spath = grow(sat.p, sdir, length * 0.55, 3, 0.004, 0.0012, 0.15, 0.04, rng);
      trunk.addTube(spath, 5);
      hang(pathPoint(spath, 0.5), range(rng, 0.08, 0.1));
      hang(pathPoint(spath, 1.0), range(rng, 0.09, 0.115));
      const sbelow = pathPoint(spath, range(rng, 0.6, 1.0)); sbelow.p.y -= range(rng, 0.06, 0.12);
      hang(sbelow, range(rng, 0.08, 0.1));
    }
  }
  for (let i = 0; i < 3; i++) hang(pathPoint(spine, lerp(0.9, 0.99, i / 2)), 0.07);
  return { trunk, leaves, clusters, crown };
}

const BUILDERS = { conifer: buildConifer, broadleaf: buildBroadleaf, birch: buildBirch };

// ---------------------------------------------------------------------------
// Painted leaf textures (Canvas 2D; skipped when no canvas exists, e.g. Node tests)
const textureCache = new Map();

function makeCanvas(size) {
  if (typeof document !== 'undefined' && document.createElement) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    return canvas;
  }
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(size, size);
  return null;
}

function leafShape(ctx, x, y, angle, length, width, kind) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.beginPath();
  if (kind === 'birch') {           // ovate with a pointed tip and a small serrated look
    ctx.moveTo(0, -length * 0.5);
    ctx.bezierCurveTo(width * 0.62, -length * 0.35, width * 0.55, length * 0.25, 0, length * 0.5);
    ctx.bezierCurveTo(-width * 0.55, length * 0.25, -width * 0.62, -length * 0.35, 0, -length * 0.5);
  } else {                          // elliptic leaf, pointed both ends
    ctx.moveTo(0, -length * 0.5);
    ctx.bezierCurveTo(width * 0.55, -length * 0.3, width * 0.55, length * 0.3, 0, length * 0.5);
    ctx.bezierCurveTo(-width * 0.55, length * 0.3, -width * 0.55, -length * 0.3, 0, -length * 0.5);
  }
  ctx.closePath();
  ctx.fill();
  // midrib
  ctx.strokeStyle = 'rgba(0,0,0,0.22)';
  ctx.lineWidth = Math.max(1, width * 0.06);
  ctx.beginPath(); ctx.moveTo(0, -length * 0.42); ctx.lineTo(0, length * 0.42); ctx.stroke();
  ctx.restore();
}

function paintLeafTexture(kind, size = 256) {
  const canvas = makeCanvas(size);
  if (!canvas) return null;
  const ctx = canvas.getContext('2d');
  const rng = makeRng(kind === 'conifer' ? 11 : kind === 'birch' ? 23 : 37);
  ctx.clearRect(0, 0, size, size);
  const cx = size / 2, cy = size / 2;
  const hsl = (h, s, l) => `hsl(${h.toFixed(1)},${s.toFixed(0)}%,${l.toFixed(0)}%)`;

  if (kind === 'conifer') {
    // A fir frond: main twig along u (the card axis, base at the left), side twigs with
    // dense needles. Widest a third of the way in, tapering to the tip.
    const x0 = 22, x1 = 236;
    ctx.lineCap = 'round';
    ctx.strokeStyle = hsl(26, 32, 24); ctx.lineWidth = 3.2;
    ctx.beginPath(); ctx.moveTo(x0, cy); ctx.lineTo(x1, cy); ctx.stroke();
    const sideTwigs = 15;
    for (let t = 0; t <= sideTwigs; t++) {
      const f = t / sideTwigs;
      const px = lerp(x0 + 6, x1 - 8, f);
      const reach = (26 + 66 * Math.sin(Math.pow(f, 0.6) * Math.PI)) * range(rng, 0.85, 1.1);
      for (const side of [-1, 1]) {
        const ang = side * range(rng, 0.95, 1.25);          // sweep back toward the tip
        const ex = px + Math.cos(ang) * reach * 0.55, ey = cy + Math.sin(ang) * reach;
        ctx.strokeStyle = hsl(28, 30, 26); ctx.lineWidth = 1.8;
        ctx.beginPath(); ctx.moveTo(px, cy); ctx.lineTo(ex, ey); ctx.stroke();
        const needles = Math.floor(reach * 0.5);
        for (let n = 0; n < needles; n++) {
          const k = (n + 0.5) / needles;
          const nx = lerp(px, ex, k), ny = lerp(cy, ey, k);
          const dir = Math.atan2(ey - cy, ex - px) + (n % 2 ? 1 : -1) * range(rng, 0.75, 1.15);
          const nl = range(rng, 11, 19) * (0.6 + 0.4 * Math.sin(k * Math.PI));
          ctx.strokeStyle = hsl(range(rng, 122, 156), range(rng, 22, 36), range(rng, 25, 41) - f * 3);
          ctx.lineWidth = range(rng, 1.9, 2.8);
          ctx.beginPath(); ctx.moveTo(nx, ny); ctx.lineTo(nx + Math.cos(dir) * nl, ny + Math.sin(dir) * nl); ctx.stroke();
        }
      }
    }
    // Needles straight on the main twig near the tip.
    for (let n = 0; n < 40; n++) {
      const px = lerp(x1 - 60, x1, rng()), dir = (rng() < 0.5 ? -1 : 1) * range(rng, 0.5, 1.2);
      ctx.strokeStyle = hsl(range(rng, 120, 150), 30, range(rng, 30, 42)); ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.moveTo(px, cy); ctx.lineTo(px + Math.cos(dir) * 14, cy + Math.sin(dir) * 14); ctx.stroke();
    }
  } else {
    const birch = kind === 'birch';
    const count = birch ? 110 : 150;
    for (let i = 0; i < count; i++) {
      // Dense in the middle, ragged at the rim.
      const r = Math.sqrt(rng()) * 108 * (birch ? 1.0 : 0.98);
      const a = rng() * TAU;
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      const depth = i / count;                              // later leaves are nearer the light
      const length = birch ? range(rng, 20, 28) : range(rng, 26, 38);
      const width = birch ? length * range(rng, 0.7, 0.85) : length * range(rng, 0.5, 0.62);
      const hue = birch ? range(rng, 72, 96) : range(rng, 90, 122);
      const sat = birch ? range(rng, 42, 58) : range(rng, 36, 54);
      const light = (birch ? range(rng, 30, 46) : range(rng, 22, 38)) + depth * 6;
      const grad = ctx.createLinearGradient(x - width, y, x + width, y);
      grad.addColorStop(0, hsl(hue, sat, light - 5));
      grad.addColorStop(1, hsl(hue + 6, sat, light + 6));
      ctx.fillStyle = grad;
      leafShape(ctx, x, y, a + Math.PI / 2 + range(rng, -0.6, 0.6), length, width, kind);
    }
    if (birch) {         // a few thin drooping twigs for structure
      ctx.strokeStyle = hsl(30, 25, 30); ctx.lineWidth = 1.6;
      for (let i = 0; i < 6; i++) {
        const a = rng() * TAU;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * 100, cy + Math.sin(a) * 100); ctx.stroke();
      }
    }
  }

  // Flood transparent pixels with the mean leaf colour so mip/bilinear fringes stay green.
  const image = ctx.getImageData(0, 0, size, size);
  const d = image.data;
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 128) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
  if (n) { r /= n; g /= n; b /= n; }
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 128) { d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 0; } else d[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

export function leafTexture(kind) {
  if (textureCache.has(kind)) return textureCache.get(kind);
  const canvas = paintLeafTexture(kind);
  let texture = null;
  if (canvas) {
    texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.anisotropy = 8;
    texture.generateMipmaps = true;
  }
  textureCache.set(kind, texture);
  return texture;
}

// ---------------------------------------------------------------------------
// Shader pieces shared by trunk and leaf materials
const GLSL_NOISE = /* glsl */`
float saHash21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float saNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(saHash21(i), saHash21(i + vec2(1.0, 0.0)), f.x), mix(saHash21(i + vec2(0.0, 1.0)), saHash21(i + vec2(1.0, 1.0)), f.x), f.y);
}
float saDither() { return fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))); }
`;

const VERTEX_PARS = /* glsl */`
uniform float uTime, uWindStrength, uSway, uFlutter;
uniform vec3 uWindDir;
attribute vec2 aLeaf;
varying vec2 vBarkUv;
varying vec3 vObj;
varying float vDist;
varying float vShade;
`;

// Object-space flutter before instancing (leaf cards only, uFlutter = 0 for bark).
const VERTEX_BEGIN = /* glsl */`
#include <begin_vertex>
vBarkUv = uv;
vObj = position;
vShade = uFlutter > 0.5 ? aLeaf.x : 1.0;
float treeH = clamp(position.y, 0.0, 1.05);
if (uFlutter > 0.5) {
  float fl = sin(uTime * 6.5 + aLeaf.y * 37.0 + position.y * 22.0) * (0.55 + 0.45 * sin(uTime * 2.1 + aLeaf.y * 11.0));
  transformed += normal * (fl * 0.012 * uWindStrength * treeH);
}
`;

// Sway after instancing, in the (planet-fixed) group space: wind is projected onto the
// tree's tangent plane, amplitude grows with height^2 and tree size.
const VERTEX_PROJECT = /* glsl */`
vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_INSTANCING
  mvPosition = instanceMatrix * mvPosition;
  vec3 tUp = instanceMatrix[1].xyz;
  vec3 tBase = instanceMatrix[3].xyz;
  #ifdef USE_INSTANCING_COLOR
    float phase = dot(instanceColor, vec3(23.1, 47.7, 71.3));
  #else
    float phase = dot(tBase, vec3(0.173, 0.271, 0.119));
  #endif
#else
  vec3 tUp = vec3(0.0, 1.0, 0.0);
  vec3 tBase = vec3(0.0);
  float phase = dot(modelMatrix[3].xyz, vec3(0.173, 0.271, 0.119));
#endif
float treeSize = max(length(tUp), 1e-5);
vec3 upN = tUp / treeSize;
vec3 windT = uWindDir - upN * dot(uWindDir, upN);
float wl = length(windT);
windT = wl > 1e-4 ? windT / wl : vec3(0.0);
float gust = 0.55 + 0.45 * sin(uTime * 0.31 + phase * 0.5) * sin(uTime * 0.17 + phase);
float sway = sin(uTime * 1.1 + phase) * 0.6 + sin(uTime * 1.9 + phase * 1.7) * 0.3 + sin(uTime * 3.1 + phase * 2.3) * 0.1;
float amp = uWindStrength * uSway * treeH * treeH * treeSize * 0.03 * (0.4 + gust);
mvPosition.xyz += windT * (amp * (0.6 + 0.4 * sway));
mvPosition.xyz += cross(upN, windT) * (amp * 0.35 * sin(uTime * 1.5 + phase * 2.1));
vDist = length((modelViewMatrix * vec4(tBase, 1.0)).xyz);
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;
`;

const FRAGMENT_PARS = /* glsl */`
uniform float uLodNearEnd, uLodFarStart, uLodBand;
uniform vec4 uBark;
uniform vec3 uBarkDark;
uniform float uWrap, uTranslucency, uLeafShadow;
varying vec2 vBarkUv;
varying vec3 vObj;
varying float vDist;
varying float vShade;
` + GLSL_NOISE;

// Near-LOD screen-door fade: fully visible below uLodNearEnd, gone past uLodNearEnd + band.
const FRAGMENT_LOD_NEAR = /* glsl */`
{
  float lodT = (vDist - uLodNearEnd) / uLodBand;
  if (lodT > 0.0 && (lodT >= 1.0 || saDither() < lodT)) discard;
}
`;

const FRAGMENT_BARK = /* glsl */`
{
  vec2 bp = vec2(vBarkUv.x * uBark.x, vBarkUv.y * uBark.y);
  float streak = saNoise(bp) * 0.65 + saNoise(bp * vec2(2.1, 1.7) + 7.3) * 0.35;
  float fine = saNoise(vec2(vBarkUv.x * 48.0, vBarkUv.y * 60.0));
  float crevice = smoothstep(0.32, 0.7, streak);
  vec3 bark = diffuseColor.rgb * mix(1.0 - uBark.w, 1.0 + uBark.w * 0.5, crevice) * (0.86 + 0.28 * fine);
  // Birch: dark horizontal lens-shaped marks and a faint papery sheen.
  float marks = smoothstep(0.66, 0.72, saNoise(vec2(vBarkUv.x * 4.0 + vBarkUv.y * 0.5, vBarkUv.y * 55.0)) * uBark.z);
  marks = max(marks, smoothstep(0.7, 0.76, saNoise(vec2(vBarkUv.x * 9.0, vBarkUv.y * 30.0 + 3.0)) * uBark.z));
  bark = mix(bark, uBarkDark, marks * 0.9);
  diffuseColor.rgb = bark;
}
`;

// Leaves: cluster shade, distance alpha boost (fights mip thinning), and no back-face normal flip.
const FRAGMENT_LEAF_COLOR = /* glsl */`
diffuseColor.rgb *= vShade;
diffuseColor.a *= 1.0 + 1.4 * smoothstep(25.0, 240.0, vDist);
`;

const FRAGMENT_LEAF_NORMAL = /* glsl */`
float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
vec3 normal = normalize( vNormal );
// Spherical crown normals are never flipped by face; instead face the viewer so the
// microfacet terms stay valid (back-facing views otherwise blow out to white).
if ( dot( normal, normalize( vViewPosition ) ) < 0.0 ) normal = -normal;
vec3 nonPerturbedNormal = normal;
`;

// Leaves are matte: keep a faint sheen only.
const FRAGMENT_LEAF_SPECULAR = /* glsl */`
#include <lights_physical_fragment>
material.specularColor *= 0.18;
`;

// Backlit glow: light passing through the leaf toward the camera.
const FRAGMENT_TRANSLUCENCY = /* glsl */`
#if NUM_DIR_LIGHTS > 0
{
  vec3 viewDir = normalize(vViewPosition);
  float back = pow(saturate(dot(-viewDir, directionalLights[0].direction)), 3.0);
  float thin = 0.5 + 0.5 * (1.0 - abs(dot(normal, viewDir)));
  reflectedLight.indirectDiffuse += diffuseColor.rgb * directionalLights[0].color * (back * thin * uTranslucency * 0.4);
}
#endif
`;

function softShadowChunk() {
  return THREE.ShaderChunk.lights_fragment_begin
    .replace('directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ]',
      'directLight.color *= mix( 1.0, ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ]')
    .replace('vDirectionalShadowCoord[ i ] ) : 1.0;', 'vDirectionalShadowCoord[ i ] ) : 1.0, uLeafShadow );');
}

function wrappedLightingChunk() {
  return THREE.ShaderChunk.lights_physical_pars_fragment.replace(
    'float dotNL = saturate( dot( geometryNormal, directLight.direction ) );',
    'float dotNL = saturate( ( dot( geometryNormal, directLight.direction ) + uWrap ) / ( 1.0 + uWrap ) );'
  );
}

/** MeshDepthMaterial twin (shadow casting) that shares the wind + alpha test. */
function depthMaterialFor(material) {
  const depth = new THREE.MeshDepthMaterial({
    depthPacking: THREE.RGBADepthPacking, map: material.map, alphaTest: material.alphaTest, side: material.side,
  });
  depth.userData.uniforms = material.userData.uniforms;
  depth.onBeforeCompile = (shader) => {
    attachTreeUniforms(shader, depth);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n' + VERTEX_PARS)
      .replace('#include <begin_vertex>', VERTEX_BEGIN)
      .replace('#include <project_vertex>', VERTEX_PROJECT);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uLodNearEnd, uLodFarStart, uLodBand;\nvarying float vDist;\n' + GLSL_NOISE)
      .replace('#include <alphatest_fragment>', '#include <alphatest_fragment>\n' + FRAGMENT_LOD_NEAR);
  };
  depth.customProgramCacheKey = () => 'star-agent-depth';
  return depth;
}

function attachTreeUniforms(shader, material) {
  shader.uniforms.uTime = wind.time;
  shader.uniforms.uWindStrength = wind.strength;
  shader.uniforms.uWindDir = wind.direction;
  shader.uniforms.uLodNearEnd = lod.nearEnd;
  shader.uniforms.uLodFarStart = lod.farStart;
  shader.uniforms.uLodBand = lod.band;
  Object.assign(shader.uniforms, material.userData.uniforms);
}

function barkMaterial(spec) {
  const material = new THREE.MeshStandardMaterial({ color: new THREE.Color(...spec.bark), roughness: 0.95, metalness: 0 });
  material.userData.uniforms = {
    uSway: { value: 0.35 }, uFlutter: { value: 0 },
    uBark: { value: new THREE.Vector4(...spec.barkParams) },
    uBarkDark: { value: new THREE.Color(...spec.barkDark) },
    uWrap: { value: 0.0 }, uTranslucency: { value: 0 }, uLeafShadow: { value: 1 },
  };
  material.onBeforeCompile = (shader) => {
    attachTreeUniforms(shader, material);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n' + VERTEX_PARS)
      .replace('#include <begin_vertex>', VERTEX_BEGIN)
      .replace('#include <project_vertex>', VERTEX_PROJECT);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + FRAGMENT_PARS)
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + FRAGMENT_BARK + FRAGMENT_LOD_NEAR);
  };
  material.customProgramCacheKey = () => 'star-agent-bark';
  return material;
}

function leafMaterial(spec, kind) {
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff, map: leafTexture(kind), alphaTest: 0.42, side: THREE.DoubleSide,
    roughness: spec.leafRough, metalness: 0, transparent: false,
  });
  material.userData.uniforms = {
    uSway: { value: 1.0 }, uFlutter: { value: 1 },
    uBark: { value: new THREE.Vector4() }, uBarkDark: { value: new THREE.Color() },
    uWrap: { value: spec.wrap }, uTranslucency: { value: spec.translucency }, uLeafShadow: { value: 0.7 },
  };
  material.onBeforeCompile = (shader) => {
    attachTreeUniforms(shader, material);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n' + VERTEX_PARS)
      .replace('#include <begin_vertex>', VERTEX_BEGIN)
      .replace('#include <project_vertex>', VERTEX_PROJECT);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + FRAGMENT_PARS)
      .replace('#include <lights_physical_pars_fragment>', wrappedLightingChunk())
      .replace('#include <lights_fragment_begin>', softShadowChunk())
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + FRAGMENT_LEAF_COLOR + FRAGMENT_LOD_NEAR)
      .replace('#include <normal_fragment_begin>', FRAGMENT_LEAF_NORMAL)
      .replace('#include <lights_physical_fragment>', FRAGMENT_LEAF_SPECULAR)
      .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\n' + FRAGMENT_TRANSLUCENCY);
  };
  material.customProgramCacheKey = () => 'star-agent-leaf';
  return material;
}

// ---------------------------------------------------------------------------
const speciesCache = new Map();

/**
 * Build (or fetch the cached) species: canonical 1-unit-tall trunk + leaf geometries and
 * their materials. `seed` varies the skeleton; textures are shared per kind.
 */
export function createTreeSpecies(kind = 'conifer', seed = 1) {
  if (!BUILDERS[kind]) throw new Error(`Unknown tree kind "${kind}"; use one of ${KINDS.join(', ')}`);
  const key = `${kind}:${seed}`;
  if (speciesCache.has(key)) return speciesCache.get(key);
  const spec = SPECIES[kind];
  const rng = makeRng(seed * 7919 + KINDS.indexOf(kind) * 131);
  const built = BUILDERS[kind](rng);
  const trunkGeometry = built.trunk.build();
  const leafGeometry = built.leaves.build('aLeaf');
  const trunkTris = trunkGeometry.index.count / 3, leafTris = leafGeometry.index.count / 3;
  const stats = { trunk: trunkTris, leaves: leafTris, near: trunkTris + leafTris, far: 2, clusters: built.clusters };
  const trunkMaterial = barkMaterial(spec), leafMat = leafMaterial(spec, kind);
  const species = {
    kind, seed, spec,
    trunkGeometry, leafGeometry,
    trunkMaterial, leafMaterial: leafMat,
    // Assign these to mesh.customDepthMaterial so shadows are alpha-tested and sway too.
    trunkDepthMaterial: depthMaterialFor(trunkMaterial),
    leafDepthMaterial: depthMaterialFor(leafMat),
    height: 1, radius: spec.radius, crown: built.crown, stats,
    dispose() {
      trunkGeometry.dispose(); leafGeometry.dispose();
      for (const m of [species.trunkMaterial, species.leafMaterial, species.trunkDepthMaterial, species.leafDepthMaterial]) m.dispose();
      speciesCache.delete(key);
    },
  };
  if (!TREE_STATS[kind] || seed === 1) TREE_STATS[kind] = { ...stats };
  speciesCache.set(key, species);
  return species;
}

// ---------------------------------------------------------------------------
// Impostors: 16 yaw angles x 2 elevations, albedo + view-space normal atlases
const IMPOSTOR = { yaws: 16, columns: 8, rows: 4, elevations: [12, 50].map((d) => d * Math.PI / 180), frame: 1.2, tile: 256 };

const NORMAL_BAKE_SHADER = {
  vertex: /* glsl */`
    varying vec3 vN; varying vec2 vUv2;
    void main() { vN = normalMatrix * normal; vUv2 = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragment: /* glsl */`
    uniform sampler2D map; uniform float hasMap; uniform float alphaTest;
    varying vec3 vN; varying vec2 vUv2;
    void main() {
      if (hasMap > 0.5 && texture2D(map, vUv2).a < alphaTest) discard;
      gl_FragColor = vec4(normalize(vN) * 0.5 + 0.5, 1.0);
    }`,
};

const IMPOSTOR_VERTEX_PARS = /* glsl */`
uniform float uTime, uWindStrength, uYaws, uColumns, uRows, uElevSplit;
uniform vec3 uWindDir;
varying vec2 vTile, vQuadUv;
varying vec3 vRight, vUp, vToCam;
varying float vDist;
`;

const IMPOSTOR_VERTEX_PROJECT = /* glsl */`
#ifdef USE_INSTANCING
  mat4 saIm = instanceMatrix;
  #ifdef USE_INSTANCING_COLOR
    float phase = dot(instanceColor, vec3(23.1, 47.7, 71.3));
  #else
    float phase = dot(saIm[3].xyz, vec3(0.173, 0.271, 0.119));
  #endif
#else
  mat4 saIm = mat4(1.0);
  float phase = dot(modelMatrix[3].xyz, vec3(0.173, 0.271, 0.119));
#endif
mat3 mv3 = mat3(modelViewMatrix);
vec3 cBase = (modelViewMatrix * saIm * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
vec3 ax = mv3 * saIm[0].xyz, ay = mv3 * saIm[1].xyz, az = mv3 * saIm[2].xyz;
float sizeY = max(length(ay), 1e-5), sizeX = max(length(ax), 1e-5);
vec3 Yn = ay / sizeY, Xn = normalize(ax), Zn = normalize(az);
vec3 cMid = cBase + Yn * (sizeY * 0.5);
vec3 toCam = normalize(-cMid);
float yaw = atan(dot(toCam, Zn), dot(toCam, Xn));
float elev = asin(clamp(dot(toCam, Yn), -1.0, 1.0));
float ti = mod(floor(yaw / 6.28318530718 * uYaws + 0.5), uYaws);
float erow = elev > uElevSplit ? 1.0 : 0.0;
float perRow = uColumns;
vTile = vec2(mod(ti, perRow) / uColumns, (floor(ti / perRow) + erow * (uYaws / perRow)) / uRows);
vec3 right = cross(Yn, toCam);
float rl = length(right);
right = rl > 1e-3 ? right / rl : normalize(cross(vec3(0.0, 0.0, 1.0), toCam));
vec3 bup = normalize(cross(toCam, right));
vRight = right; vUp = bup; vToCam = toCam;
vQuadUv = uv;
vec3 p = cMid + right * (position.x * sizeX) + bup * ((position.y - 0.5) * sizeY);
// Gentle sway of the whole card top (matches the near LOD's lean).
vec3 windV = mv3 * uWindDir;
windV -= Yn * dot(windV, Yn);
float h = clamp(position.y, 0.0, 1.1);
float sway = sin(uTime * 1.1 + phase) * 0.6 + sin(uTime * 1.9 + phase * 1.7) * 0.4;
p += normalize(windV + vec3(1e-5)) * (uWindStrength * h * h * sizeY * 0.03 * (0.6 + 0.4 * sway) * 0.8);
vec4 mvPosition = vec4(p, 1.0);
vDist = length(cBase);
gl_Position = projectionMatrix * mvPosition;
`;

const IMPOSTOR_FRAGMENT_PARS = /* glsl */`
uniform sampler2D uNormalAtlas;
uniform float uColumns, uRows, uWrap, uTranslucency;
uniform float uLodNearEnd, uLodFarStart, uLodBand;
varying vec2 vTile, vQuadUv;
varying vec3 vRight, vUp, vToCam;
varying float vDist;
vec2 atlasUv() { return vTile + vQuadUv * vec2(1.0 / uColumns, 1.0 / uRows); }
` + GLSL_NOISE;

const IMPOSTOR_FRAGMENT_MAP = /* glsl */`
vec4 sampledDiffuseColor = texture2D( map, atlasUv() );
sampledDiffuseColor.rgb = min(sampledDiffuseColor.rgb / max(sampledDiffuseColor.a, 0.002), vec3(1.0));
// Baked albedo has no canopy self-shadowing; darken a little to match the near LOD.
sampledDiffuseColor.rgb *= 0.85;
diffuseColor *= sampledDiffuseColor;
{
  float lodT = (vDist - uLodFarStart) / uLodBand;
  if (lodT <= 0.0 || (lodT < 1.0 && saDither() >= lodT)) discard;
}
`;

const IMPOSTOR_FRAGMENT_NORMAL = /* glsl */`
float faceDirection = 1.0;
vec3 nT = texture2D( uNormalAtlas, atlasUv() ).xyz * 2.0 - 1.0;
vec3 normal = normalize( vRight * nT.x + vUp * nT.y + vToCam * nT.z );
if ( dot( normal, normalize( vViewPosition ) ) < 0.0 ) normal = -normal;
vec3 nonPerturbedNormal = normal;
`;

/**
 * Bake the species into an albedo + normal atlas and return a 2-triangle billboard
 * (geometry in the canonical frame) whose shader picks the view tile per instance.
 */
export function createTreeImpostor(species, renderer, options = {}) {
  const tile = options.tile ?? IMPOSTOR.tile;
  const { yaws, columns, rows, elevations, frame } = IMPOSTOR;
  const width = columns * tile, height = rows * tile;
  const targetOptions = {
    format: THREE.RGBAFormat, type: THREE.UnsignedByteType, depthBuffer: true, stencilBuffer: false,
    generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter,
    wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping, samples: 4,
  };
  const albedo = new THREE.WebGLRenderTarget(width, height, targetOptions);
  const normals = new THREE.WebGLRenderTarget(width, height, targetOptions);
  albedo.texture.anisotropy = normals.texture.anisotropy = 4;

  // Bake scene: the near-LOD mesh under a white hemisphere of intensity PI, so the
  // Lambert term returns plain albedo; a second pass writes view-space normals.
  const scene = new THREE.Scene();
  const trunk = new THREE.Mesh(species.trunkGeometry, species.trunkMaterial);
  const leaves = new THREE.Mesh(species.leafGeometry, species.leafMaterial);
  trunk.frustumCulled = leaves.frustumCulled = false;
  scene.add(trunk, leaves, new THREE.HemisphereLight(0xffffff, 0xffffff, Math.PI));
  const normalTrunk = new THREE.ShaderMaterial({
    vertexShader: NORMAL_BAKE_SHADER.vertex, fragmentShader: NORMAL_BAKE_SHADER.fragment,
    uniforms: { map: { value: null }, hasMap: { value: 0 }, alphaTest: { value: 0.5 } },
  });
  const normalLeaves = new THREE.ShaderMaterial({
    vertexShader: NORMAL_BAKE_SHADER.vertex, fragmentShader: NORMAL_BAKE_SHADER.fragment, side: THREE.DoubleSide,
    uniforms: { map: { value: species.leafMaterial.map }, hasMap: { value: species.leafMaterial.map ? 1 : 0 }, alphaTest: { value: species.leafMaterial.alphaTest } },
  });
  const camera = new THREE.OrthographicCamera(-frame / 2, frame / 2, frame / 2, -frame / 2, 0.1, 10);
  const target = new THREE.Vector3(0, 0.5, 0);

  const previous = {
    target: renderer.getRenderTarget(), autoClear: renderer.autoClear, scissorTest: renderer.getScissorTest(),
    clearColor: renderer.getClearColor(new THREE.Color()), clearAlpha: renderer.getClearAlpha(),
    windStrength: wind.strength.value, nearEnd: lod.nearEnd.value,
  };
  wind.strength.value = 0;
  lod.nearEnd.value = 1e9;
  renderer.setClearColor(0x000000, 0);
  renderer.autoClear = false;
  const passes = [[albedo, species.trunkMaterial, species.leafMaterial], [normals, normalTrunk, normalLeaves]];
  for (const [rt, trunkMat, leafMat] of passes) {
    trunk.material = trunkMat; leaves.material = leafMat;
    renderer.setRenderTarget(rt);
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, width, height);
    renderer.clear(true, true, false);
    renderer.setScissorTest(true);
    for (let e = 0; e < elevations.length; e++) {
      for (let i = 0; i < yaws; i++) {
        const yaw = (i / yaws) * TAU, elev = elevations[e];
        camera.position.set(Math.cos(yaw) * Math.cos(elev), Math.sin(elev), Math.sin(yaw) * Math.cos(elev)).multiplyScalar(4).add(target);
        camera.up.set(0, 1, 0);
        camera.lookAt(target);
        camera.updateMatrixWorld();
        const index = i + e * yaws;
        const col = index % columns, row = Math.floor(index / columns);
        renderer.setViewport(col * tile, row * tile, tile, tile);
        renderer.setScissor(col * tile, row * tile, tile, tile);
        renderer.render(scene, camera);
      }
    }
  }
  renderer.setScissorTest(previous.scissorTest);
  renderer.setRenderTarget(previous.target);
  renderer.setClearColor(previous.clearColor, previous.clearAlpha);
  renderer.autoClear = previous.autoClear;
  wind.strength.value = previous.windStrength;
  lod.nearEnd.value = previous.nearEnd;
  normalTrunk.dispose(); normalLeaves.dispose();

  const geometry = new THREE.PlaneGeometry(frame, frame);
  geometry.translate(0, 0.5, 0);
  const makeMaterial = () => impostorMaterial(species, albedo, normals);
  const material = makeMaterial();
  return {
    species, geometry, material, albedo, normals, tris: 2,
    /** A fresh material sharing the atlases (e.g. one per LOD band when each gets wrapped separately). */
    cloneMaterial: makeMaterial,
    dispose() { geometry.dispose(); material.dispose(); albedo.dispose(); normals.dispose(); },
  };
}

function impostorMaterial(species, albedo, normals) {
  const { yaws, columns, rows, elevations } = IMPOSTOR;
  const material = new THREE.MeshStandardMaterial({
    map: albedo.texture, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.9, metalness: 0, transparent: false,
  });
  material.userData.uniforms = {
    uNormalAtlas: { value: normals.texture },
    uYaws: { value: yaws }, uColumns: { value: columns }, uRows: { value: rows },
    uElevSplit: { value: (elevations[0] + elevations[1]) / 2 },
    uWrap: { value: species.spec.wrap * 0.8 }, uTranslucency: { value: species.spec.translucency * 0.5 }, uLeafShadow: { value: 0.7 },
  };
  material.onBeforeCompile = (shader) => {
    attachTreeUniforms(shader, material);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n' + IMPOSTOR_VERTEX_PARS)
      .replace('#include <project_vertex>', IMPOSTOR_VERTEX_PROJECT);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + IMPOSTOR_FRAGMENT_PARS)
      .replace('#include <lights_physical_pars_fragment>', wrappedLightingChunk())
      .replace('#include <map_fragment>', IMPOSTOR_FRAGMENT_MAP)
      .replace('#include <lights_physical_fragment>', FRAGMENT_LEAF_SPECULAR)
      .replace('#include <normal_fragment_begin>', IMPOSTOR_FRAGMENT_NORMAL)
      .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\n' + FRAGMENT_TRANSLUCENCY);
  };
  material.customProgramCacheKey = () => 'star-agent-impostor';
  return material;
}

// ---------------------------------------------------------------------------
// Forest: scatter + placement on the globe (mirrors Vegetation), near LOD + impostors
const NEAR_LIMIT = 2600;          // per species, within nearRadius
const FAR_LIMIT = 24000;          // per species, within farRadius

/** Deterministic per-cell tree description shared by near and far passes; null = no tree. */
export function treeAt(x, y, z, col, row, a, b) {
  if (Math.abs(y) > 0.84) return null;
  const m = moisture(x, y, z);
  const density = m > 0.46 ? Math.min(0.86, 0.58 + (m - 0.46) * 2) : m > 0.4 ? 0.025 : 0;
  if (density === 0 || hash(col, row, 911) > density) return null;
  const h = terrainHeight(x, y, z);
  if (h < 12 || h > 2200) return null;
  const cold = THREE.MathUtils.smoothstep(Math.abs(y), 0.42, 0.75);
  const alt = THREE.MathUtils.smoothstep(h, 600, 1500);
  const wet = THREE.MathUtils.smoothstep(m, 0.5, 0.62);
  const grove = noise(x * 900 + 3, y * 900, z * 900 - 5);          // ~1.7 km groves
  let wConifer = (0.25 + cold * 1.4 + alt * 1.6) * (0.5 + grove);
  let wBroad = (0.35 + (1 - cold) * (1 - alt) * 1.1 + wet * 0.7) * (1.5 - grove);
  let wBirch = (0.3 + (1 - alt) * 0.45 + cold * 0.35) * (0.7 + Math.abs(grove - 0.5));
  const pick = hash(col, row, 1301) * (wConifer + wBroad + wBirch);
  const kind = pick < wConifer ? 'conifer' : pick < wConifer + wBroad ? 'broadleaf' : 'birch';
  const s = hash(col, row, 1103);
  const size = kind === 'conifer' ? 9 + s * 11 : kind === 'broadleaf' ? 7 + s * 9 : 7 + s * 7;
  return { kind, h, size, width: size * (0.83 + b * 0.28), yaw: a * TAU, a, b };
}

export class Forest {
  /**
   * @param {THREE.Scene} scene
   * @param {object} [options]
   * @param {THREE.WebGLRenderer} [options.renderer]  needed to bake impostors (far LOD); omit for near LOD only
   * @param {object} [options.replaces]  a Vegetation instance whose cone trees should be hidden
   */
  constructor(scene, { renderer = null, replaces = null, nearRadius = 400, farRadius = 1500, lodDistance = 250, seed = 1 } = {}) {
    this.group = new THREE.Group();
    this.group.name = 'Procedural trees';
    scene.add(this.group);
    this.nearRadius = nearRadius; this.farRadius = farRadius; this.lodDistance = lodDistance;
    this.origin = new THREE.Vector3();
    this.farOrigin = new THREE.Vector3();
    this.lastNear = new THREE.Vector3(Infinity, Infinity, Infinity);
    this.lastFar = new THREE.Vector3(Infinity, Infinity, Infinity);
    this.direction = new THREE.Vector3();
    this.point = new THREE.Vector3();
    this.rotation = new THREE.Quaternion();
    this.yaw = new THREE.Quaternion();
    this.scale = new THREE.Vector3();
    this.matrix = new THREE.Matrix4();
    this.color = new THREE.Color();
    this.exclusionPosition = null;
    this.exclusionDirection = new THREE.Vector3();
    this.exclusionRadius = 13;
    this.exclusionDirty = false;
    this.stats = { trees: 0, impostors: 0, rebuilds: 0, farRebuilds: 0 };
    this.farBuild = null;
    this.farVisible = 0;

    this.species = {};
    this.near = {};
    this.far = {};
    for (const kind of KINDS) {
      const species = createTreeSpecies(kind, seed);
      this.species[kind] = species;
      this.near[kind] = {
        trunk: this.makeMesh(species.trunkGeometry, species.trunkMaterial, NEAR_LIMIT, species.trunkDepthMaterial),
        leaves: this.makeMesh(species.leafGeometry, species.leafMaterial, NEAR_LIMIT, species.leafDepthMaterial),
      };
    }
    if (renderer) this.bakeImpostors(renderer);
    if (replaces) for (const mesh of replaces.treeMeshes?.flat() ?? [replaces.trunks, replaces.foliage]) if (mesh) mesh.visible = false;
  }

  /** Create the far LOD (call once with the renderer if it was not passed to the constructor). */
  bakeImpostors(renderer) {
    if (this.impostors) return;
    this.impostors = {};
    for (const kind of KINDS) {
      const impostor = createTreeImpostor(this.species[kind], renderer);
      this.impostors[kind] = impostor;
      // Two buffers per species: one on screen while the other fills over several frames.
      this.far[kind] = [0, 1].map(() => { const m = this.makeMesh(impostor.geometry, impostor.material, FAR_LIMIT); m.visible = false; return m; });
    }
    lod.nearEnd.value = lod.farStart.value = this.lodDistance;
    this.lastFar.set(Infinity, Infinity, Infinity);
  }

  makeMesh(geometry, material, capacity, depthMaterial = null) {
    const mesh = new THREE.InstancedMesh(geometry, material, capacity);
    if (depthMaterial) { mesh.customDepthMaterial = depthMaterial; mesh.castShadow = true; }
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
    mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    mesh.count = 0;
    mesh.frustumCulled = false;
    mesh.receiveShadow = true;
    this.group.add(mesh);
    return mesh;
  }

  setExclusion(worldPositionOrNull, radius = 13) {
    if (!worldPositionOrNull) {
      if (this.exclusionPosition === null) return;
      this.exclusionPosition = null;
      this.exclusionDirty = true;
      return;
    }
    const clearingRadius = Number.isFinite(radius) ? Math.max(0, radius) : 13;
    if (this.exclusionPosition?.equals(worldPositionOrNull) && this.exclusionRadius === clearingRadius) return;
    if (!this.exclusionPosition) this.exclusionPosition = new THREE.Vector3();
    this.exclusionPosition.copy(worldPositionOrNull);
    this.exclusionDirection.copy(worldPositionOrNull).normalize();
    this.exclusionRadius = clearingRadius;
    this.exclusionDirty = true;
  }

  isExcluded(x, y, z, canopyMargin = 0) {
    if (!this.exclusionPosition) return false;
    const dx = (x - this.exclusionDirection.x) * RADIUS;
    const dy = (y - this.exclusionDirection.y) * RADIUS;
    const dz = (z - this.exclusionDirection.z) * RADIUS;
    const radius = this.exclusionRadius + canopyMargin;
    return dx * dx + dy * dy + dz * dz < radius * radius;
  }

  update(worldPosition, renderOrigin, elapsedSeconds) {
    wind.time.value = elapsedSeconds;
    const distance = worldPosition.length();
    if (distance < 1) { this.group.visible = false; return; }
    this.direction.copy(worldPosition).divideScalar(distance);
    const height = terrainHeight(this.direction.x, this.direction.y, this.direction.z);
    const altitude = distance - RADIUS - Math.max(0, height);
    this.group.visible = altitude < 4000 && altitude > -50;
    if (!this.group.visible) return;
    const nearVisible = altitude < 1800;
    for (const kind of KINDS) this.near[kind].trunk.visible = this.near[kind].leaves.visible = nearVisible;

    if (this.exclusionDirty || worldPosition.distanceToSquared(this.lastNear) > 140 * 140) {
      this.lastNear.copy(worldPosition);
      this.origin.copy(this.direction).multiplyScalar(RADIUS + height);
      this.rebuildNear(this.direction.clone());
      this.exclusionDirty = false;
      // Far buffers are placed relative to their own origin; re-express them in the new one.
      if (this.impostors) for (const kind of KINDS) this.far[kind][this.farVisible].position.copy(this.farOrigin).sub(this.origin);
    }
    if (this.impostors) {
      if (!this.farBuild && worldPosition.distanceToSquared(this.lastFar) > 350 * 350) {
        this.lastFar.copy(worldPosition);
        this.farBuild = this.rebuildFar(this.direction.clone(), this.origin.clone());
      }
      if (this.farBuild) {
        const started = performance.now();
        let step = this.farBuild.next();
        while (!step.done && performance.now() - started < 4) step = this.farBuild.next();
        if (step.done) this.farBuild = null;
      }
    }
    this.group.position.copy(this.origin).sub(renderOrigin);
  }

  /** Rows of a fixed lat/lon lattice around `center` (same cells as vegetation.js). */
  *scatterRows(center, radius, spacing, seed) {
    const latitude = Math.asin(THREE.MathUtils.clamp(center.y, -1, 1));
    const longitude = Math.atan2(center.x, center.z);
    const rowSize = spacing / RADIUS;
    const firstRow = Math.floor((latitude - radius / RADIUS) / rowSize) - 1;
    const lastRow = Math.ceil((latitude + radius / RADIUS) / rowSize) + 1;
    for (let row = firstRow; row <= lastRow; row++) {
      const rowLatitude = (row + 0.5) * rowSize;
      if (Math.abs(rowLatitude) >= Math.PI / 2) continue;
      const columns = Math.max(1, Math.round(TAU * RADIUS * Math.cos(rowLatitude) / spacing));
      const columnSize = TAU / columns;
      const centerColumn = Math.floor((longitude + Math.PI) / columnSize);
      const reach = Math.ceil(radius / (spacing * Math.max(0.05, Math.cos(rowLatitude)))) + 2;
      yield (visit) => {
        for (let column = centerColumn - reach; column <= centerColumn + reach; column++) {
          const wrapped = ((column % columns) + columns) % columns;
          const a = hash(wrapped, row, seed);
          const b = hash(wrapped, row, seed + 41);
          const lat = (row + 0.15 + a * 0.7) * rowSize;
          const lon = (wrapped + 0.15 + b * 0.7) * columnSize - Math.PI;
          const cosLat = Math.cos(lat);
          const x = cosLat * Math.sin(lon), y = Math.sin(lat), z = cosLat * Math.cos(lon);
          const dx = (x - center.x) * RADIUS, dy = (y - center.y) * RADIUS, dz = (z - center.z) * RADIUS;
          if (dx * dx + dy * dy + dz * dz > radius * radius) continue;
          visit(x, y, z, wrapped, row, a, b);
        }
      };
    }
  }

  place(mesh, index, origin, x, y, z, height, scaleX, scaleY, scaleZ, angle) {
    this.point.set(x, y, z).multiplyScalar(RADIUS + height).sub(origin);
    this.direction.set(x, y, z);
    this.rotation.setFromUnitVectors(UP, this.direction);
    this.yaw.setFromAxisAngle(UP, angle);
    this.rotation.multiply(this.yaw);
    this.scale.set(scaleX, scaleY, scaleZ);
    this.matrix.compose(this.point, this.rotation, this.scale);
    mesh.setMatrixAt(index, this.matrix);
  }

  tint(tree) {
    const { kind, a, b } = tree;
    if (kind === 'conifer') this.color.setRGB(0.8 + a * 0.3, 0.85 + b * 0.3, 0.8 + a * 0.25);
    else if (kind === 'broadleaf') this.color.setRGB(0.8 + b * 0.35, 0.85 + a * 0.3, 0.75 + b * 0.3);
    else this.color.setRGB(0.85 + a * 0.3, 0.9 + b * 0.25, 0.7 + a * 0.3);
    return this.color;
  }

  rebuildNear(center) {
    const counts = { conifer: 0, broadleaf: 0, birch: 0 };
    for (const visitRow of this.scatterRows(center, this.nearRadius, 12, 711)) {
      visitRow((x, y, z, col, row, a, b) => {
        if (this.isExcluded(x, y, z, 5)) return;
        const tree = treeAt(x, y, z, col, row, a, b);
        if (!tree || counts[tree.kind] >= NEAR_LIMIT) return;
        const { trunk, leaves } = this.near[tree.kind];
        const index = counts[tree.kind]++;
        this.place(trunk, index, this.origin, x, y, z, tree.h - 0.08, tree.width, tree.size, tree.width, tree.yaw);
        leaves.setMatrixAt(index, this.matrix);
        const tint = this.tint(tree);
        leaves.setColorAt(index, tint);
        trunk.setColorAt(index, this.color.setRGB(0.85 + b * 0.3, 0.85 + b * 0.3, 0.85 + b * 0.3));
      });
    }
    let total = 0;
    for (const kind of KINDS) {
      const { trunk, leaves } = this.near[kind];
      trunk.count = leaves.count = counts[kind];
      total += counts[kind];
      for (const mesh of [trunk, leaves]) { mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true; }
    }
    this.stats.trees = total;
    this.stats.rebuilds++;
  }

  /** Generator: fills the hidden far buffers row by row, then swaps them in. */
  *rebuildFar(center, origin) {
    const back = 1 - this.farVisible;
    const counts = { conifer: 0, broadleaf: 0, birch: 0 };
    for (const visitRow of this.scatterRows(center, this.farRadius, 12, 711)) {
      visitRow((x, y, z, col, row, a, b) => {
        const tree = treeAt(x, y, z, col, row, a, b);
        if (!tree || counts[tree.kind] >= FAR_LIMIT) return;
        const mesh = this.far[tree.kind][back];
        const index = counts[tree.kind]++;
        this.place(mesh, index, origin, x, y, z, tree.h - 0.08, tree.width, tree.size, tree.width, tree.yaw);
        mesh.setColorAt(index, this.tint(tree));
      });
      yield;
    }
    let total = 0;
    for (const kind of KINDS) {
      const mesh = this.far[kind][back];
      mesh.count = counts[kind];
      total += counts[kind];
      mesh.instanceMatrix.needsUpdate = true;
      mesh.instanceColor.needsUpdate = true;
      mesh.position.copy(origin).sub(this.origin);
      mesh.visible = true;
      this.far[kind][this.farVisible].visible = false;
    }
    this.farOrigin.copy(origin);
    this.farVisible = back;
    this.stats.impostors = total;
    this.stats.farRebuilds++;
  }

  dispose() {
    for (const kind of KINDS) {
      for (const mesh of [this.near[kind].trunk, this.near[kind].leaves, ...(this.far[kind] || [])]) mesh.dispose();
      this.impostors?.[kind].dispose();
      this.species[kind].dispose();
    }
    this.group.removeFromParent();
  }
}

// Build the default species once so TREE_STATS is populated at import (textures are
// painted here too when a canvas exists; in Node the leaf materials simply have no map).
for (const kind of KINDS) createTreeSpecies(kind, 1);
