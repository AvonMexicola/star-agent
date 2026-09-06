import * as THREE from 'three';
import { cubeDirection } from './world.js';
import { PYRE_RADIUS, PYRE_POSITION, PYRE_MAX_HEIGHT, PYRE_EPOCH, pyreSurface } from './pyre-world.js';

export const PYRE_GRID = 16, PYRE_MAX_LEVEL = 17;
const normalized = (x, y, z) => { const l = Math.hypot(x, y, z); return [x / l, y / l, z / l]; };

/** Cube face and (u,v) in -1..1 containing a unit direction (inverse of cubeDirection). */
export function cubeCoordinates(d) {
  const [x, y, z] = d, ax = Math.abs(x), ay = Math.abs(y), az = Math.abs(z);
  if (ax >= ay && ax >= az) return x > 0 ? { face: 0, u: -z / ax, v: y / ax } : { face: 1, u: z / ax, v: y / ax };
  if (ay >= az) return y > 0 ? { face: 2, u: x / ay, v: -z / ay } : { face: 3, u: x / ay, v: z / ay };
  return z > 0 ? { face: 4, u: x / az, v: y / az } : { face: 5, u: -x / az, v: y / az };
}

/** Patch geometry in body-local metres (double-precision centre on the real surface).
 * A one-cell halo shares height samples between vertices and their normals. */
export function generatePyrePatch({ face, level, ix, iy }) {
  const size = 2 / 2 ** level, u0 = -1 + ix * size, v0 = -1 + iy * size;
  const d0 = cubeDirection(face, u0 + size / 2, v0 + size / 2), centerRadius = PYRE_RADIUS + pyreSurface(...d0).height, center = d0.map(v => v * centerRadius);
  const count = (PYRE_GRID + 1) ** 2 + 4 * (PYRE_GRID + 1);
  const positions = new Float32Array(count * 3), normals = new Float32Array(count * 3), directions = new Float32Array(count * 3), points = new Float32Array(count * 3), colors = new Float32Array(count * 3), data = new Float32Array(count * 4);
  const stride = PYRE_GRID + 3, samples = [];
  for (let y = -1; y <= PYRE_GRID + 1; y++) for (let x = -1; x <= PYRE_GRID + 1; x++) {
    const d = cubeDirection(face, u0 + size * x / PYRE_GRID, v0 + size * y / PYRE_GRID), sample = pyreSurface(...d);
    samples.push({ d, sample, p: d.map(v => v * (PYRE_RADIUS + sample.height)), normal: null });
  }
  const at = (x, y) => samples[(y + 1) * stride + x + 1];
  let maxHeight = -Infinity, minHeight = Infinity;
  const write = (index, x, y, skirt = 0) => {
    const entry = at(x, y), { d, sample, p } = entry;
    if (!entry.normal) {
      const left = at(x - 1, y).p, right = at(x + 1, y).p, bottom = at(x, y - 1).p, top = at(x, y + 1).p;
      const a = right.map((v, i) => v - left[i]), b = top.map((v, i) => v - bottom[i]);
      let normal = normalized(a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]);
      if (normal[0] * d[0] + normal[1] * d[1] + normal[2] * d[2] < 0) normal = normal.map(v => -v);
      entry.normal = normal;
    }
    data.set([sample.activity, sample.fresh, sample.sulphur, sample.height], index * 4);
    if (!skirt) { maxHeight = Math.max(maxHeight, sample.height); minHeight = Math.min(minHeight, sample.height); }
    for (let axis = 0; axis < 3; axis++) {
      const value = p[axis] - d[axis] * skirt - center[axis], k = index * 3 + axis;
      positions[k] = value; directions[k] = d[axis]; normals[k] = entry.normal[axis]; colors[k] = sample.color[axis];
      points[k] = value + ((center[axis] % 256) + 256) % 256;
    }
  };
  for (let y = 0; y <= PYRE_GRID; y++) for (let x = 0; x <= PYRE_GRID; x++) write(y * (PYRE_GRID + 1) + x, x, y);
  const indices = [];
  for (let y = 0; y < PYRE_GRID; y++) for (let x = 0; x < PYRE_GRID; x++) { const a = y * (PYRE_GRID + 1) + x, b = a + 1, c = a + PYRE_GRID + 1; indices.push(a, b, c, b, c + 1, c); }
  const edges = [Array.from({ length: PYRE_GRID + 1 }, (_, i) => i), Array.from({ length: PYRE_GRID + 1 }, (_, i) => i * (PYRE_GRID + 1) + PYRE_GRID), Array.from({ length: PYRE_GRID + 1 }, (_, i) => PYRE_GRID * (PYRE_GRID + 1) + PYRE_GRID - i), Array.from({ length: PYRE_GRID + 1 }, (_, i) => (PYRE_GRID - i) * (PYRE_GRID + 1))];
  let next = (PYRE_GRID + 1) ** 2;
  const depth = Math.max(.15, size * PYRE_RADIUS * .18);
  for (const edge of edges) { const start = next; for (const index of edge) write(next++, index % (PYRE_GRID + 1), Math.floor(index / (PYRE_GRID + 1)), depth); for (let i = 0; i < PYRE_GRID; i++) indices.push(edge[i], start + i, edge[i + 1], edge[i + 1], start + i, start + i + 1); }
  return { center, positions, normals, directions, points, colors, data, indices: new Uint16Array(indices), maxHeight, minHeight };
}

/** Worker-streamed cubed-sphere quadtree for Pyre. Falls back to synchronous
 * generation when Workers are unavailable (node tests). */
export class PyreTerrain {
  constructor(parent, material, { sync = false, workers = 3, onMaps = null } = {}) {
    this.parent = parent; this.material = material; this.nodes = new Map(); this.queue = []; this.jobs = new Map(); this.nextId = 0; this.workers = [];
    this.origin = new THREE.Vector3(); this.local = new THREE.Vector3(); this.visibleCount = 0; this.maxLevel = 0; this.buildsLastFrame = 0; this.altitude = Infinity; this.error = null;
    this.sync = sync || typeof Worker === 'undefined'; this.onMaps = onMaps; this.lastSelect = 0;
    if (!this.sync) for (let i = 0; i < Math.min(workers, Math.max(1, (navigator.hardwareConcurrency || 4) - 2)); i++) {
      const worker = new Worker(new URL('./pyre.worker.js', import.meta.url), { type: 'module' });
      const slot = { worker, busy: false };
      worker.onmessage = e => this.receive(slot, e.data);
      worker.onerror = e => { console.error('Pyre terrain worker failed', e); this.error = 'Pyre terrain worker failed.'; slot.busy = false; };
      this.workers.push(slot);
    }
    this.roots = Array.from({ length: 6 }, (_, face) => this.node(face, 0, 0, 0));
    for (const root of this.roots) this.request(root, true);
    if (!this.sync && this.onMaps) { const slot = this.workers[0]; slot.busy = true; slot.worker.postMessage({ id: -1, type: 'maps', epoch: PYRE_EPOCH }); }
  }
  node(face, level, ix, iy) {
    const key = `${face}/${level}/${ix}/${iy}`; if (this.nodes.has(key)) return this.nodes.get(key);
    const size = 2 / 2 ** level, d = cubeDirection(face, -1 + (ix + .5) * size, -1 + (iy + .5) * size), normal = new THREE.Vector3(...d);
    const node = { key, face, level, ix, iy, size, normal, surface: normal.clone().multiplyScalar(PYRE_RADIUS + pyreSurface(...d).height), children: null, mesh: null, queued: false, lastUsed: performance.now() };
    this.nodes.set(key, node); return node;
  }
  request(node, urgent = false) {
    if (node.mesh || node.queued) return;
    if (this.sync) { this.upload(node, generatePyrePatch(node)); this.buildsLastFrame++; return; }
    node.queued = true; node.urgent = urgent; this.queue.push(node);
  }
  dispatch() {
    const rank = n => (n.urgent ? 0 : 1e6) + n.surface.distanceTo(this.local) / (n.size * PYRE_RADIUS);
    this.queue.sort((a, b) => rank(a) - rank(b));
    for (const slot of this.workers) {
      if (slot.busy || !this.queue.length) continue;
      const node = this.queue.shift(), id = this.nextId++; this.jobs.set(id, node); slot.busy = true;
      slot.worker.postMessage({ id, type: 'patch', face: node.face, level: node.level, ix: node.ix, iy: node.iy, epoch: PYRE_EPOCH });
    }
  }
  receive(slot, data) {
    slot.busy = false;
    if (data.type === 'maps') { this.onMaps?.(data); this.dispatch(); return; }
    const node = this.jobs.get(data.id); this.jobs.delete(data.id);
    if (!node) { this.dispatch(); return; }
    node.queued = false;
    if (data.error) { this.error = data.error; console.error(data.error); return; }
    this.upload(node, data); this.buildsLastFrame++; this.dispatch();
  }
  upload(node, data) {
    const geometry = new THREE.BufferGeometry();
    for (const [name, values] of [['position', data.positions], ['normal', data.normals], ['pyreDirection', data.directions], ['pyrePoint', data.points], ['color', data.colors]]) geometry.setAttribute(name, new THREE.BufferAttribute(values, 3));
    geometry.setAttribute('pyreData', new THREE.BufferAttribute(data.data, 4));
    geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(data.positions.length / 3 * 2), 2));
    geometry.setIndex(new THREE.BufferAttribute(data.indices, 1)); geometry.computeBoundingSphere();
    node.center = new THREE.Vector3(...data.center); node.maxHeight = data.maxHeight;
    node.mesh = new THREE.Mesh(geometry, this.material); node.mesh.name = `Pyre terrain ${node.key}`;
    node.mesh.receiveShadow = true; node.mesh.castShadow = node.level >= 12; node.mesh.visible = false;
    node.mesh.position.copy(node.center).add(new THREE.Vector3(...PYRE_POSITION)).sub(this.origin);
    this.parent.add(node.mesh);
  }
  /** Request the whole column of nodes (and their siblings) above a landing direction. */
  prewarm(direction, maxLevel = 15) {
    const { face, u, v } = cubeCoordinates(direction);
    let node = this.roots[face]; this.request(node, true);
    for (let level = 1; level <= maxLevel; level++) {
      const size = 2 / 2 ** level, ix = Math.min(2 ** level - 1, Math.floor((u + 1) / size)), iy = Math.min(2 ** level - 1, Math.floor((v + 1) / size));
      if (!node.children) node.children = this.childrenOf(node);
      for (const child of node.children) this.request(child, true);
      node = this.node(face, level, ix, iy);
    }
    this.dispatch();
  }
  childrenOf(node) { return [this.node(node.face, node.level + 1, node.ix * 2, node.iy * 2), this.node(node.face, node.level + 1, node.ix * 2 + 1, node.iy * 2), this.node(node.face, node.level + 1, node.ix * 2, node.iy * 2 + 1), this.node(node.face, node.level + 1, node.ix * 2 + 1, node.iy * 2 + 1)]; }
  update(worldPosition, origin) {
    this.origin.copy(origin); this.local.copy(worldPosition).sub(new THREE.Vector3(...PYRE_POSITION));
    const now = performance.now();
    if (now - this.lastSelect > 100 || this.sync) { this.select(now); this.lastSelect = now; }
    for (const node of this.nodes.values()) if (node.mesh) node.mesh.position.copy(node.center).add(new THREE.Vector3(...PYRE_POSITION)).sub(origin);
  }
  select(now = performance.now()) {
    const radius = this.local.length(), radial = this.local.clone().normalize();
    this.altitude = radius - PYRE_RADIUS;
    for (const node of this.nodes.values()) if (node.mesh) node.mesh.visible = false;
    for (const n of this.queue) n.queued = false; this.queue = [];
    this.buildsLastFrame = 0; this.visibleCount = 0; this.maxLevel = 0;
    // Streaming budget: many more patches in flight close to the ground (moon lesson).
    let budget = this.altitude < 5000 ? 64 : this.altitude < 100_000 ? 32 : 16;
    const distance = node => node.surface.distanceTo(this.local);
    const minLevel = radius < PYRE_RADIUS * 12 ? 3 : 2;
    const visit = node => {
      if (node.level > 1 && node.normal.dot(radial) < PYRE_RADIUS / Math.max(PYRE_RADIUS, radius) - node.size * 1.5 - PYRE_MAX_HEIGHT / PYRE_RADIUS) return;
      node.lastUsed = now;
      if (!node.mesh && budget > 0) { this.request(node); budget--; }
      const split = node.level < minLevel || (node.level < PYRE_MAX_LEVEL && distance(node) < node.size * PYRE_RADIUS * 1.8);
      if (split && node.mesh) {
        if (!node.children) node.children = this.childrenOf(node);
        // Siblings are needed for parent replacement even when horizon-culled (PR #15 lesson).
        for (const child of node.children) child.lastUsed = now;
        for (const child of [...node.children].sort((a, b) => distance(a) - distance(b))) if (!child.mesh && budget > 0) { this.request(child); budget--; }
        if (node.children.every(child => child.mesh)) { for (const child of node.children) visit(child); return; }
      }
      if (node.mesh) { node.mesh.visible = true; this.visibleCount++; this.maxLevel = Math.max(this.maxLevel, node.level); }
    };
    for (const root of [...this.roots].sort((a, b) => distance(a) - distance(b))) visit(root);
    if (this.nodes.size > 1100) for (const node of this.nodes.values()) {
      if (node.level <= 3 || !node.mesh || node.mesh.visible || node.queued || now - node.lastUsed < 8000) continue;
      this.parent.remove(node.mesh); node.mesh.geometry.dispose(); node.mesh = null;
    }
    this.dispatch();
  }
  get pending() { return this.queue.length + this.jobs.size; }
  /** Honest readiness: a fine LOD is required near the ground, not just six roots. */
  get requiredLevel() { return this.altitude < 2000 ? 12 : this.altitude < 100_000 ? 7 : 3; }
  get ready() { return this.pending === 0 && this.maxLevel >= this.requiredLevel; }
  dispose() {
    for (const slot of this.workers) slot.worker.terminate();
    for (const node of this.nodes.values()) if (node.mesh) { this.parent.remove(node.mesh); node.mesh.geometry.dispose(); }
    this.nodes.clear(); this.queue = []; this.jobs.clear();
  }
}
