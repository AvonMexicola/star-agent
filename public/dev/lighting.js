// Dev bench for src/lighting-csm.js — real terrain patches, real vegetation,
// a ship-sized box, and main.js's renderer/camera setup (logarithmicDepthBuffer,
// near 0.08, far SUN_DISTANCE*5). Served raw out of public/, so it may only use
// absolute module URLs — hence THREE comes from the lighting module itself,
// which guarantees a single three instance shared with Vite's module graph.
import { THREE, Lighting } from '/src/lighting-csm.js';
import { RADIUS, SUN_DISTANCE, generatePatch, findDestinations, terrainHeight, cubeDirection } from '/src/world.js';

const hud = document.getElementById('hud');
const log = [];
function say(text) { log.push(text); hud.textContent = log.slice(-14).join('\n'); }

// ---------------------------------------------------------------- cube maths
/** Inverse of world.js `cubeDirection`: unit direction -> {face, u, v}. */
function cubeCoords(d) {
  const [x, y, z] = d;
  const ax = Math.abs(x), ay = Math.abs(y), az = Math.abs(z);
  if (ax >= ay && ax >= az) return x > 0 ? { face: 0, u: -z / x, v: y / x } : { face: 1, u: -z / x, v: -y / x };
  if (ay >= az) return y > 0 ? { face: 2, u: x / y, v: -z / y } : { face: 3, u: -x / y, v: -z / y };
  return z > 0 ? { face: 4, u: x / z, v: y / z } : { face: 5, u: x / z, v: -y / z };
}

// ---------------------------------------------------------------- renderer
const canvas = document.getElementById('viewport');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, logarithmicDepthBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(innerWidth, innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.info.autoReset = false;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(52, innerWidth / innerHeight, 0.08, SUN_DISTANCE * 5);
scene.add(camera);

// Same lights main.js creates.
const sun = new THREE.DirectionalLight(0xfff0dc, 2.5);
scene.add(sun, sun.target);
const ambient = new THREE.HemisphereLight(0xb9d9ff, 0x242d1a, 0.65);
scene.add(ambient);

// ---------------------------------------------------------------- world set-up
const destinations = findDestinations();
// ?dest=forest|mountain|coast|polar — mountains are the real test of cascade
// reach, since terrain self-shadowing is what carries the far cascades.
const DEST = new URLSearchParams(location.search).get('dest') || 'forest';
const forest = destinations[DEST] || destinations.forest;

// Two aligned LOD rings, like planet.js selects at ground level.
// A level-13 cell is exactly 8 level-16 cells wide, so the seam tiles perfectly.
const FINE_LEVEL = 16;    // 48.6 m across, ~3 m triangles — the real ground LOD
const COARSE_LEVEL = 13;  // 389 m across, backdrop out to ~3.5 km
const FINE_BLOCKS = 2;    // fine terrain covers FINE_BLOCKS^2 coarse cells (778 m)
const COARSE_SPAN = 4;    // (2*4+1)^2 coarse cells (3.5 km)

const grid = cubeCoords(forest);
const COARSE_SIZE = 2 / 2 ** COARSE_LEVEL;
const CELL_X = Math.floor((grid.u + 1) / COARSE_SIZE);
const CELL_Y = Math.floor((grid.v + 1) / COARSE_SIZE);
// Stand in the middle of the fine block, not at its corner.
const anchor = cubeDirection(
  grid.face,
  -1 + (CELL_X + FINE_BLOCKS / 2) * COARSE_SIZE,
  -1 + (CELL_Y + FINE_BLOCKS / 2) * COARSE_SIZE,
);

const up = new THREE.Vector3(...anchor).normalize();
const groundHeight = terrainHeight(up.x, up.y, up.z);
const surface = up.clone().multiplyScalar(RADIUS + groundHeight);

// Local tangent frame at the destination.
const east = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), up).normalize();
const north = new THREE.Vector3().crossVectors(up, east).normalize();

// Sun at ~35 degrees elevation, coming from the east.
const SUN_ELEVATION = (Number(new URLSearchParams(location.search).get('sunElevation')) || 35) * Math.PI / 180;
const sunDirection = up.clone().multiplyScalar(Math.sin(SUN_ELEVATION))
  .addScaledVector(east, Math.cos(SUN_ELEVATION)).normalize();

scene.background = new THREE.Color(0x6d9ecd);

const landMaterial = new THREE.MeshStandardMaterial({
  vertexColors: true, roughness: 0.96, metalness: 0, side: THREE.DoubleSide,
});
// ?terrainMat=1 runs planet.js's real onBeforeCompile on the land material, so
// the bench proves registerMaterial() chains onto it instead of replacing it.
if (new URLSearchParams(location.search).has('terrainMat')) {
  const { createSurfaceTexture, configureTerrainMaterial } = await import('/src/surface-materials.js');
  const { createGroundTextures } = await import('/src/ground-textures.js');
  const { acquireTerrainMaps } = await import('/src/terrain-maps.js');
  const albedo = new THREE.DataTexture(new Uint8Array([100, 110, 70, 255]), 1, 1);
  albedo.needsUpdate = true;
  configureTerrainMaterial(landMaterial, createSurfaceTexture(), { value: albedo }, { value: 0 }, createGroundTextures(), acquireTerrainMaps());
}

const origin = new THREE.Vector3();
const patches = [];
const pylons = [];

function buildPatch(face, level, ix, iy) {
  const data = generatePatch({ face, level, ix, iy });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(data.normals, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(data.colors, 3));
  geometry.setAttribute('direction', new THREE.BufferAttribute(data.directions, 3));
  geometry.setAttribute('terrainHeight', new THREE.BufferAttribute(data.heights, 1));
  // planet.js builds this the same way, so the real terrain shader is exercised.
  const surfacePoints = new Float32Array(data.positions.length);
  for (let i = 0; i < surfacePoints.length; i++) {
    surfacePoints[i] = data.positions[i] + ((data.center[i % 3] % 256) + 256) % 256;
  }
  geometry.setAttribute('surfacePoint', new THREE.BufferAttribute(surfacePoints, 3));
  geometry.setIndex(new THREE.BufferAttribute(data.indices, 1));
  geometry.computeBoundingSphere();
  const mesh = new THREE.Mesh(geometry, landMaterial);
  const group = new THREE.Group();          // planet.js wraps each patch in a Group
  group.add(mesh);
  group.userData.center = new THREE.Vector3(...data.center);
  scene.add(group);
  patches.push(group);
}

// ---------------------------------------------------------------- ship stand-in
// Low metalness: this bench has no environment map, and metal without an env
// map renders black, which would hide the very shadows we are looking for.
const shipMaterial = new THREE.MeshStandardMaterial({ color: 0x8d96a0, metalness: 0.08, roughness: 0.5 });
const ship = new THREE.Mesh(new THREE.BoxGeometry(7, 3, 11), shipMaterial);
const shipWorld = surface.clone().addScaledVector(north, 34).addScaledVector(east, -11);
{
  const d = shipWorld.clone().normalize();
  const h = terrainHeight(d.x, d.y, d.z);
  shipWorld.copy(d).multiplyScalar(RADIUS + h + 1.6);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
  ship.quaternion.copy(q);
}
scene.add(ship);

// ?pylons=1 — unmistakable casters at 200 / 600 / 1200 m, i.e. one per far
// cascade. The scene's own content stops casting past ~140 m (vegetation.js
// disables castShadow on tree LOD 1 and 2), so this is how the far cascades
// get verified at all.
if (new URLSearchParams(location.search).has('pylons')) {
  for (const distance of [200, 600, 1200]) {
    const height = distance / 12;
    const pylon = new THREE.Mesh(new THREE.BoxGeometry(height / 4, height, height / 4), shipMaterial);
    const at = surface.clone().addScaledVector(north, distance).addScaledVector(east, -distance / 6);
    const d = at.clone().normalize();
    at.copy(d).multiplyScalar(RADIUS + terrainHeight(d.x, d.y, d.z) + height / 2);
    pylon.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
    pylon.userData.world = at;
    scene.add(pylon);
    pylons.push(pylon);
  }
}

// ---------------------------------------------------------------- vegetation
let vegetation = null;

// ---------------------------------------------------------------- lighting
// URL overrides let the bench sweep configurations without editing this file:
//   ?cascades=3&maxFar=1200&mapSize=1024&lambda=0.9&normalBias=1.6&farPerAltitude=0
const query = new URLSearchParams(location.search);
// Only keys actually present in the URL are passed, so the bench always
// exercises src/lighting-csm.js's real defaults unless told otherwise.
const options = { hemisphereLight: ambient };
for (const [key, option] of Object.entries({
  cascades: 'cascades', maxFar: 'maxFar', mapSize: 'shadowMapSize',
  lambda: 'splitLambda', normalBias: 'normalBiasTexels', bias: 'biasTexels',
  farPerAltitude: 'farPerAltitude', maxFarCeiling: 'maxFarCeiling',
  grazingBiasMax: 'grazingBiasMax',
})) if (query.has(key)) options[option] = Number(query.get(key));
const lighting = new Lighting(renderer, scene, camera, sun, options);

// ---------------------------------------------------------------- camera views
const VIEWS = {
  eye: { altitude: 2, pitch: -5, yaw: 0 },
  low: { altitude: 12, pitch: -10, yaw: 0 },
  a40: { altitude: 40, pitch: -20, yaw: 0 },
  a90: { altitude: 90, pitch: -30, yaw: 0 },
  high: { altitude: 200, pitch: -22, yaw: 0 },
  down: { altitude: 200, pitch: -70, yaw: 0 },
};
let view = 'eye';
let cameraWorld = new THREE.Vector3();
let altitude = 2;

function placeCamera(name) {
  view = name;
  const v = VIEWS[name];
  altitude = v.altitude;
  const d = surface.clone().normalize();
  const h = terrainHeight(d.x, d.y, d.z);
  cameraWorld = d.multiplyScalar(RADIUS + h + v.altitude);

  // Look north, tilted down by `pitch`, with the local up as the roll reference.
  const yaw = v.yaw * Math.PI / 180, pitch = v.pitch * Math.PI / 180;
  const forward = north.clone().multiplyScalar(Math.cos(yaw)).addScaledVector(east, Math.sin(yaw));
  const dir = forward.clone().multiplyScalar(Math.cos(pitch)).addScaledVector(up, Math.sin(pitch)).normalize();
  const right = new THREE.Vector3().crossVectors(dir, up).normalize();
  const camUp = new THREE.Vector3().crossVectors(right, dir).normalize();
  camera.position.set(0, 0, 0);
  camera.quaternion.setFromRotationMatrix(
    new THREE.Matrix4().makeBasis(right, camUp, dir.clone().negate()),
  );

  origin.copy(cameraWorld);
  for (const group of patches) group.position.copy(group.userData.center).sub(origin);
  ship.position.copy(shipWorld).sub(origin);
  for (const pylon of pylons) pylon.position.copy(pylon.userData.world).sub(origin);
  if (vegetation) {
    vegetation.lastPosition.set(Infinity, Infinity, Infinity);   // force a rebuild
    vegetation.update(cameraWorld, origin, 0);
  }
  camera.updateMatrixWorld();
}

// ---------------------------------------------------------------- frame loop
// Rendered synchronously and on demand: SwiftShader takes seconds per frame at
// this resolution, so a rAF loop would make every screenshot a stale one.
let shadowsOn = true;
let frameCount = 0;
let looping = false;

function renderOnce() {
  const t0 = performance.now();
  sun.position.copy(sunDirection).multiplyScalar(1000);
  sun.target.position.set(0, 0, 0);
  sun.target.updateMatrixWorld();
  lighting.update({
    sunDirection,
    cameraAltitude: altitude,
    cameraWorldPosition: cameraWorld,
    renderOrigin: origin,
  });
  renderer.info.reset();
  renderer.render(scene, camera);
  // Force the driver to finish before we call it a frame.
  renderer.getContext().finish();
  frameCount++;
  return performance.now() - t0;
}

function loop() {
  if (!looping) return;
  renderOnce();
  requestAnimationFrame(loop);
}

// ---------------------------------------------------------------- boot
async function boot() {
  say(`${DEST} dir ${forest.map((n) => n.toFixed(4)).join(', ')}  h=${groundHeight.toFixed(1)} m`);

  const face = grid.face;
  const ratio = 2 ** (FINE_LEVEL - COARSE_LEVEL);           // fine cells per coarse cell
  const limit = 2 ** COARSE_LEVEL;
  const c0 = CELL_X, c1 = CELL_Y;
  // Fine block: FINE_BLOCKS x FINE_BLOCKS coarse cells, starting at (c0, c1).
  const inFine = (ix, iy) => ix >= c0 && ix < c0 + FINE_BLOCKS && iy >= c1 && iy < c1 + FINE_BLOCKS;

  const started = performance.now();
  let fine = 0, coarse = 0;
  for (let by = 0; by < FINE_BLOCKS; by++) {
    for (let bx = 0; bx < FINE_BLOCKS; bx++) {
      for (let dy = 0; dy < ratio; dy++) {
        for (let dx = 0; dx < ratio; dx++) {
          buildPatch(face, FINE_LEVEL, (c0 + bx) * ratio + dx, (c1 + by) * ratio + dy);
          fine++;
        }
      }
      await new Promise((r) => setTimeout(r, 0));
    }
  }
  for (let dy = -COARSE_SPAN; dy <= COARSE_SPAN; dy++) {
    for (let dx = -COARSE_SPAN; dx <= COARSE_SPAN; dx++) {
      const ix = c0 + dx, iy = c1 + dy;
      if (ix < 0 || iy < 0 || ix >= limit || iy >= limit || inFine(ix, iy)) continue;
      buildPatch(face, COARSE_LEVEL, ix, iy);
      coarse++;
    }
    await new Promise((r) => setTimeout(r, 0));
  }
  say(`terrain: ${fine} fine + ${coarse} coarse in ${Math.round(performance.now() - started)} ms`);

  try {
    if (query.has('noveg')) throw new Error('disabled by ?noveg');
    const module = await import('/src/vegetation.js');
    vegetation = new module.Vegetation(scene);
    say('vegetation module loaded');
  } catch (error) {
    say(`vegetation unavailable: ${error.message}`);
  }

  placeCamera('eye');
  lighting.applyShadowFlags(scene);
  say(`flags applied · ${lighting.stats.materials} materials`);
  renderOnce();

  window.dev = {
    ready: true,
    get stats() {
      return {
        view, altitude, shadowsOn,
        lighting: lighting.stats,
        calls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        patches: patches.length,
        vegetation: vegetation ? vegetation.stats : null,
      };
    },
    /** Cascade internals, for diagnosing coverage. */
    get csm() {
      const c = lighting.csm;
      if (!c) return null;
      return {
        breaks: c.breaks.slice(),
        maxFar: c.maxFar,
        lightDir: c.lightDirection.toArray().map(n => +n.toFixed(3)),
        lights: c.lights.map(l => ({
          on: l.visible, cast: l.castShadow,
          pos: l.position.toArray().map(n => Math.round(n)),
          box: +(l.shadow.camera.right - l.shadow.camera.left).toFixed(1),
          near: l.shadow.camera.near, far: l.shadow.camera.far,
          nb: +l.shadow.normalBias.toFixed(3), bias: +l.shadow.bias.toExponential(2),
          mapped: Boolean(l.shadow.map),
        })),
      };
    },
    /** Draw n synchronous frames and return the last one's cost. */
    render(n = 1) { let ms = 0; for (let i = 0; i < n; i++) ms = renderOnce(); return Number(ms.toFixed(1)); },
    setShadows(on) { shadowsOn = Boolean(on); lighting.setEnabled(shadowsOn); return this.render(2); },
    setView(name) { placeCamera(name); return this.render(2); },
    setOption(key, value) {
      lighting.options[key] = value;
      lighting._retuneFrustums(lighting._appliedFar);
      return this.render(2);
    },
    hud(show) { hud.style.display = show ? '' : 'none'; document.getElementById('bar').style.display = show ? '' : 'none'; },
    /** Mean ms per synchronous frame over `n` frames (first two discarded). */
    bench(n = 12) {
      renderOnce(); renderOnce();
      const t0 = performance.now();
      for (let i = 0; i < n; i++) renderOnce();
      const ms = (performance.now() - t0) / n;
      return { ms: Number(ms.toFixed(1)), fps: Math.round(1000 / ms), frames: n, shadowsOn };
    },
    /** Override the altitude fed to lighting.update, to exercise the gate. */
    setAltitude(n) { altitude = n; return this.render(2); },
    setLoop(on) { looping = Boolean(on); if (looping) requestAnimationFrame(loop); },
  };
  say('ready — window.dev');
}

for (const button of document.querySelectorAll('#bar button')) {
  button.addEventListener('click', async () => {
    const act = button.dataset.act;
    if (act === 'shadows') window.dev.setShadows(!shadowsOn);
    else if (act === 'bench') say(JSON.stringify(await window.dev.bench(60)));
    else window.dev.setView(act);
  });
}

addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});

boot().catch((error) => { say(`FATAL ${error.message}`); console.error(error); });
