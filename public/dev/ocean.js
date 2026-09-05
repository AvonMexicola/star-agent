// Standalone harness for src/ocean.js. Builds a real coastal patch set with
// world.js generatePatch and renders it with the ocean material, mirroring the
// camera-relative setup planet.js/main.js use.
//   /dev/ocean.html?view=0   30 m above the shoreline, looking out to sea
//   /dev/ocean.html?view=1   300 m
//   /dev/ocean.html?view=2   50 km
import * as THREE from 'three';
import { RADIUS, SUN_DIRECTION, cubeDirection, terrainHeight, generatePatch, findDestinations } from '/src/world.js';
import { createOceanMaterial, updateOceanMaterial, setOceanDepth, OCEAN_SKY_GLSL } from '/src/ocean.js';

const status = document.getElementById('status');
const log = m => { status.textContent = m; console.log('[ocean-dev]', m); };

const params = new URLSearchParams(location.search);
const viewIndex = Number(params.get('view') || 0);
const maxLevel = Number(params.get('lod') || 16);
if (params.has('clean')) document.body.classList.add('clean');

const canvas = document.getElementById('viewport');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, logarithmicDepthBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(innerWidth, innerHeight, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.autoClear = false;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(52, innerWidth / innerHeight, 0.08, 6e7);

const sun = new THREE.Vector3(...SUN_DIRECTION).normalize();
const sunLight = new THREE.DirectionalLight(0xfff0dc, 2.6);
scene.add(sunLight, sunLight.target);
const ambient = new THREE.HemisphereLight(0xb9d9ff, 0x242d1a, 0.6);
scene.add(ambient);

// ---- analytic sky background (stands in for atmosphere.js) ----------------
const skyMaterial = new THREE.ShaderMaterial({
  depthTest: false, depthWrite: false,
  uniforms: {
    inverseProjection: { value: new THREE.Matrix4() },
    cameraRotation: { value: new THREE.Matrix3() },
    up: { value: new THREE.Vector3(0, 1, 0) },
    sunDirection: { value: sun },
  },
  vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}',
  fragmentShader: `
    uniform mat4 inverseProjection; uniform mat3 cameraRotation;
    uniform vec3 up; uniform vec3 sunDirection; varying vec2 vUv;
    ${OCEAN_SKY_GLSL}
    void main(){
      vec4 p = inverseProjection*vec4(vUv*2.0-1.0,1.0,1.0);
      vec3 rd = normalize(cameraRotation*normalize(p.xyz));
      float day = smoothstep(-0.14,0.24,dot(up,sunDirection));
      vec3 c = oceanSky(rd, up, sunDirection, day);
      c += vec3(2.0,1.6,1.2)*smoothstep(0.99992,0.99996,dot(rd,sunDirection));
      gl_FragColor = vec4(c,1.0);
    }`,
});
const skyScene = new THREE.Scene();
const skyQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), skyMaterial);
skyQuad.frustumCulled = false;
skyScene.add(skyQuad);
const skyCamera = new THREE.Camera();

// ---- materials ------------------------------------------------------------
const landMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0, side: THREE.DoubleSide });
const oceanMaterial = createOceanMaterial();

// ---- shoreline search -----------------------------------------------------
function normalize3(v) { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; }
function move(d, tx, ty, tz, metres) {
  const s = metres / RADIUS;
  return normalize3([d[0] + tx * s, d[1] + ty * s, d[2] + tz * s]);
}
function frameAt(d) {
  let ex = d[2], ez = -d[0];
  const el = Math.hypot(ex, ez) || 1;
  ex /= el; ez /= el;
  const east = [ex, 0, ez];
  const north = [d[1] * ez, d[2] * ex - d[0] * ez, -d[1] * ex];
  return { east, north };
}

function findShoreline() {
  const start = findDestinations().coast;
  const { east, north } = frameAt(start);
  const sunTangent = (() => {
    const dp = sun.x * start[0] + sun.y * start[1] + sun.z * start[2];
    const t = normalize3([sun.x - start[0] * dp, sun.y - start[1] * dp, sun.z - start[2] * dp]);
    return Math.atan2(t[0] * north[0] + t[1] * north[1] + t[2] * north[2],
                      t[0] * east[0] + t[1] * east[1] + t[2] * east[2]);
  })();
  // The coast destination sits ~55 m above sea level and the real waterline is
  // 10-20 km away, so search wide. Prefer the azimuth nearest the sun (that is
  // where the specular glitter path shows) but not at any distance.
  let best = null;
  for (let step = -12; step <= 12; step++) {
    const offset = step * (Math.PI / 36);            // +-60 deg in 5 deg steps
    const a = sunTangent + offset;
    const tx = east[0] * Math.cos(a) + north[0] * Math.sin(a);
    const ty = east[1] * Math.cos(a) + north[1] * Math.sin(a);
    const tz = east[2] * Math.cos(a) + north[2] * Math.sin(a);
    let prev = 0;
    for (let m = 200; m <= 60000; m += 100) {
      const h = terrainHeight(...move(start, tx, ty, tz, m));
      if (h < -1) {
        let lo = prev, hi = m;
        for (let i = 0; i < 30; i++) {
          const mid = (lo + hi) / 2;
          if (terrainHeight(...move(start, tx, ty, tz, mid)) > 0) lo = mid; else hi = mid;
        }
        const waterline = (lo + hi) / 2;
        // Reject tidal flats: we want a coast that actually deepens, otherwise
        // half the frame is 1 m deep water and the shot says nothing.
        const shelf = -terrainHeight(...move(start, tx, ty, tz, waterline + 2500));
        const score = m + Math.abs(offset) * (180 / Math.PI) * 250 + Math.max(0, 25 - shelf) * 2000;
        if (!best || score < best.score) {
          best = { score, shelf, point: move(start, tx, ty, tz, waterline), seaward: [tx, ty, tz], azimuth: offset };
        }
        break;
      }
      prev = m;
    }
  }
  return best;
}

// ---- synchronous quadtree ------------------------------------------------
const patchCache = new Map();
const meshes = [];

function buildPatch(face, level, ix, iy) {
  const key = `${face}/${level}/${ix}/${iy}`;
  let entry = patchCache.get(key);
  if (entry) return entry;
  const data = generatePatch({ face, level, ix, iy });

  const land = new THREE.BufferGeometry();
  land.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
  land.setAttribute('normal', new THREE.BufferAttribute(data.normals, 3));
  land.setAttribute('color', new THREE.BufferAttribute(data.colors, 3));
  land.setIndex(new THREE.BufferAttribute(data.indices, 1));
  land.computeBoundingSphere();

  let water = null;
  if (data.heights.some(h => h < 50)) {
    water = new THREE.BufferGeometry();
    water.setAttribute('position', new THREE.BufferAttribute(data.waterPositions, 3));
    water.setAttribute('direction', new THREE.BufferAttribute(data.directions, 3));
    // Exactly what planet.js puts on the water geometry today.
    water.setAttribute('terrainHeight', new THREE.BufferAttribute(data.heights, 1));
    if (params.has('explicitDepth')) {
      setOceanDepth(water, data.heights);
      oceanMaterial.uniforms.hasDepth.value = 1;
    }
    water.setIndex(new THREE.BufferAttribute(data.indices, 1));
    water.computeBoundingSphere();
  }
  entry = { center: new THREE.Vector3(...data.center), land, water };
  patchCache.set(key, entry);
  return entry;
}

function rebuild(cameraWorld) {
  for (const m of meshes) scene.remove(m);
  meshes.length = 0;
  const radial = cameraWorld.clone().normalize();
  const length = cameraWorld.length();
  const tmp = new THREE.Vector3();
  let patches = 0;

  const visit = (face, level, ix, iy) => {
    const size = 2 / 2 ** level;
    const d = cubeDirection(face, -1 + (ix + 0.5) * size, -1 + (iy + 0.5) * size);
    if (level > 1 && (d[0] * radial.x + d[1] * radial.y + d[2] * radial.z) < RADIUS / Math.max(RADIUS, length) - size * 1.5 - 0.035) return;
    const h = Math.max(0, terrainHeight(...d));
    tmp.set(d[0], d[1], d[2]).multiplyScalar(RADIUS + h);
    const distance = Math.max(3, tmp.distanceTo(cameraWorld));
    if (level < 3 || (distance < size * RADIUS * 1.8 && level < maxLevel)) {
      visit(face, level + 1, ix * 2, iy * 2);
      visit(face, level + 1, ix * 2 + 1, iy * 2);
      visit(face, level + 1, ix * 2, iy * 2 + 1);
      visit(face, level + 1, ix * 2 + 1, iy * 2 + 1);
      return;
    }
    const entry = buildPatch(face, level, ix, iy);
    patches++;
    const group = new THREE.Group();
    group.add(new THREE.Mesh(entry.land, landMaterial));
    if (entry.water) group.add(new THREE.Mesh(entry.water, oceanMaterial));
    group.position.copy(entry.center).sub(cameraWorld);
    scene.add(group);
    meshes.push(group);
  };
  for (let face = 0; face < 6; face++) visit(face, 0, 0, 0);
  return patches;
}

// ---- views ----------------------------------------------------------------
const VIEWS = [
  { altitude: 30, pitch: -3, back: 60, name: '30 m shoreline' },
  { altitude: 300, pitch: -12, back: 700, name: '300 m' },
  { altitude: 50000, pitch: -38, back: 90000, name: '50 km' },
];

const state = { origin: new THREE.Vector3(), ready: false, patches: 0, view: viewIndex, time: 24 };

function setView(index) {
  const v = VIEWS[index];
  const shore = window.__shore;
  const d = shore.point;
  const s = shore.seaward;
  // Stand behind the waterline on the land side, looking out to sea.
  const ground = move(d, -s[0], -s[1], -s[2], v.back);
  const groundHeight = Math.max(0, terrainHeight(...ground));
  state.origin.set(ground[0], ground[1], ground[2]).multiplyScalar(RADIUS + groundHeight + v.altitude);

  const up = new THREE.Vector3(ground[0], ground[1], ground[2]);
  const seaward = new THREE.Vector3(s[0], s[1], s[2]).sub(up.clone().multiplyScalar(up.dot(new THREE.Vector3(s[0], s[1], s[2])))).normalize();
  const pitch = v.pitch * Math.PI / 180;
  const forward = seaward.clone().multiplyScalar(Math.cos(pitch)).add(up.clone().multiplyScalar(Math.sin(pitch))).normalize();

  camera.position.set(0, 0, 0);
  camera.up.copy(up);
  camera.lookAt(forward);
  camera.updateMatrixWorld();

  skyMaterial.uniforms.up.value.copy(up);

  const t0 = performance.now();
  state.patches = rebuild(state.origin);
  state.view = index;
  log(`view ${index} (${v.name}) · ${state.patches} patches · ${Math.round(performance.now() - t0)} ms build`);
}

function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);

function frame() {
  requestAnimationFrame(frame);
  if (!state.ready) return;
  sunLight.position.copy(sun).multiplyScalar(1000);
  sunLight.target.position.set(0, 0, 0);
  updateOceanMaterial(oceanMaterial, {
    renderOrigin: state.origin,
    sunDirection: sun,
    time: state.time,
    altitude: state.origin.length() - RADIUS,
  });
  camera.updateMatrixWorld();
  skyMaterial.uniforms.inverseProjection.value.copy(camera.projectionMatrixInverse);
  skyMaterial.uniforms.cameraRotation.value.setFromMatrix4(camera.matrixWorld);
  renderer.clear();
  renderer.render(skyScene, skyCamera);
  renderer.render(scene, camera);
}

log('locating shoreline…');
setTimeout(() => {
  const shore = findShoreline();
  if (!shore) { log('no shoreline found near the coast destination'); return; }
  window.__shore = shore;
  resize();
  setView(viewIndex);
  state.ready = true;
  window.oceanDev = {
    setView,
    get state() { return { ready: state.ready, view: state.view, patches: state.patches, time: state.time }; },
    setTime(t) { state.time = t; },
  };
  requestAnimationFrame(frame);
}, 30);
