// Standalone material inspection; ordinary imports also work in static releases.
import * as THREE from 'three';
import * as world from '/src/world.js';
import { createLandMaterial, updateLandMaterial } from '/src/terrain-material.js';
import { createLighting } from '/src/lighting.js';
const { RADIUS, MAX_LEVEL, SUN_DIRECTION, cubeDirection, terrainHeight, findDestinations, generatePatch } = world;

const info = document.getElementById('info');
const log = [];
const say = s => { log.push(s); info.textContent = log.slice(-12).join('\n'); };
const errors = [];
window.addEventListener('error', e => errors.push(String(e.message)));
const origWarn = console.warn.bind(console), origError = console.error.bind(console);
console.error = (...a) => { errors.push(a.map(String).join(' ')); origError(...a); };
console.warn = (...a) => { errors.push('warn: ' + a.map(String).join(' ')); origWarn(...a); };

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, logarithmicDepthBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(innerWidth, innerHeight, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0.42, 0.62, 0.92);
const camera = new THREE.PerspectiveCamera(52, innerWidth / innerHeight, .08, 1e8);
const lighting = createLighting(renderer, scene);
const landMaterial = createLandMaterial();
const waterMaterial = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.02, 0.09, 0.14), roughness: .12, metalness: 0 });
const sunDirection = new THREE.Vector3(...SUN_DIRECTION);
const origin = new THREE.Vector3();
const terrain = new THREE.Group(); scene.add(terrain);
const geometryCache = new Map();
let patches = 0;

function makeNode(face, level, ix, iy) {
  const size = 2 / 2 ** level;
  const d = cubeDirection(face, -1 + (ix + .5) * size, -1 + (iy + .5) * size);
  const normal = new THREE.Vector3(...d);
  return { face, level, ix, iy, size, normal, surfaceCenter: normal.clone().multiplyScalar(RADIUS + Math.max(0, terrainHeight(...d))) };
}
function patchGeometry(node) {
  const key = `${node.face}/${node.level}/${node.ix}/${node.iy}`;
  if (geometryCache.has(key)) return geometryCache.get(key);
  const data = generatePatch(node);
  const land = new THREE.BufferGeometry();
  land.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
  land.setAttribute('normal', new THREE.BufferAttribute(data.normals, 3));
  land.setAttribute('color', new THREE.BufferAttribute(data.colors, 3));
  land.setAttribute('direction', new THREE.BufferAttribute(data.directions, 3));
  land.setIndex(new THREE.BufferAttribute(data.indices, 1));
  let water = null;
  if (data.heights.some(h => h < 50)) {
    water = new THREE.BufferGeometry();
    water.setAttribute('position', new THREE.BufferAttribute(data.waterPositions, 3));
    water.setIndex(new THREE.BufferAttribute(data.indices, 1));
    water.setAttribute('normal', new THREE.BufferAttribute(data.directions, 3));
  }
  const entry = { land, water, center: new THREE.Vector3(...data.center) };
  geometryCache.set(key, entry);
  return entry;
}
// Same LOD selection as planet.js select(), but synchronous.
function buildTerrain(cameraWorld, maxLevel = MAX_LEVEL, splitFactor = 1.8) {
  terrain.clear(); patches = 0;
  const length = cameraWorld.length(), radial = cameraWorld.clone().normalize();
  const visit = node => {
    if (node.level > 1 && node.normal.dot(radial) < RADIUS / Math.max(RADIUS, length) - node.size * 1.5 - .035) return;
    const distance = Math.max(3, node.surfaceCenter.distanceTo(cameraWorld));
    if (node.level < 3 || (distance < node.size * RADIUS * splitFactor && node.level < maxLevel)) {
      for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) visit(makeNode(node.face, node.level + 1, node.ix * 2 + dx, node.iy * 2 + dy));
      return;
    }
    const g = patchGeometry(node);
    const group = new THREE.Group();
    group.position.copy(g.center).sub(origin);
    const land = new THREE.Mesh(g.land, landMaterial); land.receiveShadow = true; land.castShadow = node.level >= 12; group.add(land);
    if (g.water) group.add(new THREE.Mesh(g.water, waterMaterial));
    terrain.add(group); patches++;
  };
  for (let face = 0; face < 6; face++) visit(makeNode(face, 0, 0, 0));
}

function tangentFrame(n) {
  const east = new THREE.Vector3(n.z, 0, -n.x).normalize();
  if (east.lengthSq() < .01) east.set(1, 0, 0);
  const north = new THREE.Vector3().crossVectors(n, east).normalize();
  return { east, north };
}
function heightAt(n) { return terrainHeight(n.x, n.y, n.z); }
function offsetDir(n, east, north, dx, dy) { return n.clone().addScaledVector(east, dx / RADIUS).addScaledVector(north, dy / RADIUS).normalize(); }

// Find real sea (h < -3) nearest a direction, then bisect back towards land for the h = 0.5 shoreline.
function findShore(dir) {
  const n = new THREE.Vector3(...dir), { east, north } = tangentFrame(n);
  let sea = null;
  outer: for (let r = 100; r <= 40000; r += 100) {
    for (let a = 0; a < Math.PI * 2; a += Math.max(.03, 100 / r)) {
      const d = offsetDir(n, east, north, Math.cos(a) * r, Math.sin(a) * r);
      if (heightAt(d) < -3) { sea = d; break outer; }
    }
  }
  if (!sea) return { shore: n, seaward: east };
  let lo = n.clone(), hi = sea.clone();          // h(lo) > 0.5 > h(hi)
  for (let i = 0; i < 40; i++) { const mid = lo.clone().add(hi).normalize(); if (heightAt(mid) > .5) lo = mid; else hi = mid; }
  const shore = lo.clone().add(hi).normalize();
  const seaward = sea.clone().sub(shore); seaward.addScaledVector(shore, -seaward.dot(shore)).normalize();
  return { shore, seaward };
}
function downhill(n) {
  const { east, north } = tangentFrame(n), e = 15;
  const gx = (heightAt(offsetDir(n, east, north, e, 0)) - heightAt(offsetDir(n, east, north, -e, 0))) / (2 * e);
  const gy = (heightAt(offsetDir(n, east, north, 0, e)) - heightAt(offsetDir(n, east, north, 0, -e))) / (2 * e);
  return east.clone().multiplyScalar(-gx).addScaledVector(north, -gy).normalize();
}
function highestNear(n, radius) {
  const { east, north } = tangentFrame(n); let best = n, bh = -Infinity;
  for (let dx = -radius; dx <= radius; dx += radius / 12) for (let dy = -radius; dy <= radius; dy += radius / 12) {
    const d = offsetDir(n, east, north, dx, dy), h = heightAt(d); if (h > bh) { bh = h; best = d; }
  }
  return best;
}

const destinations = findDestinations();
const sites = {};
{
  const { shore, seaward } = findShore(destinations.coast);
  const { east, north } = tangentFrame(shore);
  const eye = offsetDir(shore, east, north, -seaward.dot(east) * 30, -seaward.dot(north) * 30); // 30 m inland
  sites.coast = { ground: eye, heading: seaward, heightAtGround: heightAt(eye) };
  say(`coast shore h=${heightAt(shore).toFixed(2)} eye h=${heightAt(eye).toFixed(2)}`);
  const m = new THREE.Vector3(...destinations.mountain);
  const peak = highestNear(m, 1200);
  const heading = peak.clone().sub(m); heading.addScaledVector(m, -heading.dot(m)).normalize();
  sites.mountain = { ground: m, heading, heightAtGround: heightAt(m) };
  say(`mountain h=${heightAt(m).toFixed(0)} peak h=${heightAt(peak).toFixed(0)} lat=${(Math.asin(m.y) * 180 / Math.PI).toFixed(1)}`);
  const f = new THREE.Vector3(...destinations.forest);
  sites.forest = { ground: f, heading: tangentFrame(f).north, heightAtGround: heightAt(f) };
  const p = new THREE.Vector3(...destinations.polar);
  sites.polar = { ground: p, heading: tangentFrame(p).east, heightAtGround: heightAt(p) };
}

let ready = false, frameCount = 0;
function setView({ site = 'coast', alt = 2, pitch, yaw = 0, splitFactor = 1.8 } = {}) {
  ready = false;
  const s = sites[site];
  const n = s.ground.clone();
  const groundH = Math.max(0, s.heightAtGround);
  origin.copy(n).multiplyScalar(RADIUS + groundH + alt);
  const heading = s.heading.clone().applyAxisAngle(n, yaw * Math.PI / 180);
  const pitchDeg = pitch ?? (alt < 10 ? -6 : alt < 200 ? -28 : -40);
  const dir = heading.clone().multiplyScalar(Math.cos(pitchDeg * Math.PI / 180)).addScaledVector(n, Math.sin(pitchDeg * Math.PI / 180));
  camera.position.set(0, 0, 0);
  camera.up.copy(n);
  camera.lookAt(dir);
  const t0 = performance.now();
  buildTerrain(origin, MAX_LEVEL, splitFactor);
  say(`${site} alt=${alt} patches=${patches} (${(performance.now() - t0).toFixed(0)} ms) lat/lon=${(Math.asin(n.y) * 180 / Math.PI).toFixed(2)}/${(Math.atan2(n.x, n.z) * 180 / Math.PI).toFixed(2)} sun·n=${n.dot(sunDirection).toFixed(2)}`);
  frameCount = 0;
}

function shaderSources() {
  const gl = renderer.getContext();
  const out = [];
  for (const p of renderer.info.programs) {
    if (!String(p.cacheKey).includes('terrain-material')) continue;
    out.push({
      cacheKey: p.cacheKey,
      vertex: gl.getShaderSource(p.vertexShader), fragment: gl.getShaderSource(p.fragmentShader),
      vertexLog: gl.getShaderInfoLog(p.vertexShader), fragmentLog: gl.getShaderInfoLog(p.fragmentShader),
      programLog: gl.getProgramInfoLog(p.program), linked: gl.getProgramParameter(p.program, gl.LINK_STATUS),
    });
  }
  return out;
}

function frame() {
  requestAnimationFrame(frame);
  const n = origin.clone().normalize();
  const altitude = origin.length() - RADIUS - (sites.current?.heightAtGround ?? 0);
  lighting.update(n, sunDirection, Math.max(1, altitude));
  if (params.get('shadows') === '0') { lighting.sun.castShadow = false; renderer.shadowMap.enabled = false; }
  updateLandMaterial(landMaterial, { renderOrigin: origin, sunDirection, time: performance.now() / 1000, cameraAltitude: Math.max(1, altitude) });
  renderer.render(scene, camera);
  if (++frameCount > 3) ready = true;
}
const params = new URLSearchParams(location.search);
setView({ site: params.get('site') || 'coast', alt: Number(params.get('alt') || 2) });
frame();
window.tmTest = { setView, shaderSources, get ready() { return ready; }, get errors() { return errors; }, get patches() { return patches; }, sites, renderer, scene, landMaterial, THREE };
