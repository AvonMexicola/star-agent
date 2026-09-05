// Dev bench for src/trees.js. Served raw out of public/, so it may only use absolute
// module URLs; THREE comes from the trees module itself so there is one three instance.
//   ?view=near|grove|lod|far|aerial|atlas   ?t=<seconds> freezes wind time   ?wind=<0..2>   ?clean hides the HUD
import { THREE, createTreeSpecies, createTreeImpostor, wind, lod, TREE_STATS, KINDS } from '/src/trees.js';

const params = new URLSearchParams(location.search);
const view = params.get('view') || 'near';
const fixedTime = params.has('t') ? Number(params.get('t')) : null;
if (params.has('clean')) document.body.classList.add('clean');
wind.strength.value = params.has('wind') ? Number(params.get('wind')) : 0.6;

const hud = document.getElementById('hud');
const canvas = document.getElementById('viewport');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, logarithmicDepthBuffer: true });
renderer.setPixelRatio(1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.info.autoReset = false;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0.38, 0.56, 0.86);
const camera = new THREE.PerspectiveCamera(52, innerWidth / innerHeight, 0.08, 20000);

// Lights as in src/lighting.js (sun 3.4 + hemisphere .4), ACES afterwards.
const sunDirection = params.get('sun') === 'front' ? new THREE.Vector3(0.45, 0.5, 0.74).normalize()
  : params.get('sun') === 'side' ? new THREE.Vector3(0.9, 0.38, 0.05).normalize() : new THREE.Vector3(-0.55, 0.42, -0.72).normalize();
const sun = new THREE.DirectionalLight(0xfff1dc, 3.4);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -110, right: 110, top: 110, bottom: -110, near: 1, far: 650 });
sun.shadow.camera.updateProjectionMatrix();
sun.shadow.bias = -0.00015;
sun.shadow.normalBias = 0.16;
sun.position.copy(sunDirection).multiplyScalar(320);
scene.add(sun, sun.target);
scene.add(new THREE.HemisphereLight(0xc4ddf4, 0x393326, 0.4));
// Sky/ground environment like src/lighting.js (intensity .45 in daylight).
{
  const data = new Float32Array(128 * 64 * 4);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 128; x++) {
    const h = Math.cos(y / 63 * Math.PI), k = (y * 128 + x) * 4, horizon = Math.exp(-Math.abs(h) * 7);
    data.set(h > 0 ? [.16 + horizon * .25, .26 + horizon * .24, .42 + horizon * .18, 1] : [.055, .049, .038, 1], k);
  }
  const sky = new THREE.DataTexture(data, 128, 64, THREE.RGBAFormat, THREE.FloatType);
  sky.mapping = THREE.EquirectangularReflectionMapping; sky.needsUpdate = true;
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromEquirectangular(sky).texture;
  scene.environmentIntensity = 0.44;
  pmrem.dispose(); sky.dispose();
}

const ground = new THREE.Mesh(new THREE.PlaneGeometry(8000, 8000), new THREE.MeshStandardMaterial({ color: new THREE.Color(0.14, 0.19, 0.06), roughness: 1 }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// ---------------------------------------------------------------- trees
const species = Object.fromEntries(KINDS.map((k) => [k, createTreeSpecies(k, 1)]));
const impostors = Object.fromEntries(KINDS.map((k) => [k, createTreeImpostor(species[k], renderer)]));
const NEAR_CAP = 3000, FAR_CAP = 20000;
const meshes = {};
function instanced(geometry, material, capacity, depth) {
  const mesh = new THREE.InstancedMesh(geometry, material, capacity);
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
  mesh.count = 0;
  mesh.frustumCulled = false;
  mesh.receiveShadow = true;
  if (depth) { mesh.customDepthMaterial = depth; mesh.castShadow = true; }
  scene.add(mesh);
  return mesh;
}
for (const k of KINDS) {
  meshes[k] = {
    trunk: instanced(species[k].trunkGeometry, species[k].trunkMaterial, NEAR_CAP, species[k].trunkDepthMaterial),
    leaves: instanced(species[k].leafGeometry, species[k].leafMaterial, NEAR_CAP, species[k].leafDepthMaterial),
    far: instanced(impostors[k].geometry, impostors[k].material, FAR_CAP, null),
  };
}
const matrix = new THREE.Matrix4(), quaternion = new THREE.Quaternion(), scale = new THREE.Vector3(), position = new THREE.Vector3(), color = new THREE.Color();
let placed = 0;
function tint(kind, a, b) {
  if (kind === 'conifer') return color.setRGB(0.8 + a * 0.3, 0.85 + b * 0.3, 0.8 + a * 0.25);
  if (kind === 'broadleaf') return color.setRGB(0.8 + b * 0.35, 0.85 + a * 0.3, 0.75 + b * 0.3);
  return color.setRGB(0.85 + a * 0.3, 0.9 + b * 0.25, 0.7 + a * 0.3);
}
function place(kind, x, z, size, widthFactor, yaw, a, b) {
  const m = meshes[kind];
  if (m.trunk.count >= NEAR_CAP || m.far.count >= FAR_CAP) return;
  position.set(x, 0, z);
  quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  scale.set(size * widthFactor, size, size * widthFactor);
  matrix.compose(position, quaternion, scale);
  const i = m.trunk.count++;
  m.trunk.setMatrixAt(i, matrix); m.leaves.setMatrixAt(i, matrix);
  m.leaves.count = m.trunk.count;
  const t = tint(kind, a, b);
  m.leaves.setColorAt(i, t);
  m.trunk.setColorAt(i, color.setRGB(0.85 + b * 0.3, 0.85 + b * 0.3, 0.85 + b * 0.3));
  const j = m.far.count++;
  m.far.setMatrixAt(j, matrix);
  m.far.setColorAt(j, tint(kind, a, b));
  placed++;
}
function finish() {
  for (const k of KINDS) for (const mesh of Object.values(meshes[k])) { mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true; }
}
let seed = 17;
const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
const pickKind = (r) => (r < 0.4 ? 'conifer' : r < 0.75 ? 'broadleaf' : 'birch');
function forestField(count, zMin, zMax, xHalf, minSpacing = 9) {
  const pts = [];
  for (let n = 0, tries = 0; n < count && tries < count * 30; tries++) {
    const x = (rnd() * 2 - 1) * xHalf, z = -(zMin + rnd() * (zMax - zMin));
    if (pts.some(([px, pz]) => (px - x) ** 2 + (pz - z) ** 2 < minSpacing * minSpacing)) continue;
    pts.push([x, z]); n++;
    const kind = pickKind(rnd());
    const s = kind === 'conifer' ? 9 + rnd() * 11 : kind === 'broadleaf' ? 7 + rnd() * 9 : 7 + rnd() * 7;
    place(kind, x, z, s, 0.83 + rnd() * 0.28, rnd() * Math.PI * 2, rnd(), rnd());
  }
}

let atlasQuads = null;
switch (view) {
  case 'near':
    lod.nearEnd.value = 1e9; lod.farStart.value = -1e9;   // near LOD only, whatever the distance
    for (const k of KINDS) meshes[k].far.visible = false;
    place('conifer', -12, -26, 15, 1.0, 0.4, 0.5, 0.5);
    place('broadleaf', 1.5, -28, 13, 1.05, 2.1, 0.4, 0.6);
    place('birch', 14, -25, 12, 0.95, 1.2, 0.6, 0.4);
    camera.position.set(0, 1.7, 0);
    camera.lookAt(1, 6.5, -26);
    break;
  case 'grove':
    lod.nearEnd.value = 1e9; lod.farStart.value = -1e9;
    for (const k of KINDS) meshes[k].far.visible = false;
    for (let n = 0; n < 40; n++) {
      const r = 6 + Math.sqrt(rnd()) * 30, a = rnd() * Math.PI * 2;
      const kind = pickKind(rnd());
      const s = kind === 'conifer' ? 9 + rnd() * 11 : kind === 'broadleaf' ? 7 + rnd() * 9 : 7 + rnd() * 7;
      place(kind, Math.cos(a) * r, -45 + Math.sin(a) * r * 0.8, s, 0.83 + rnd() * 0.28, rnd() * Math.PI * 2, rnd(), rnd());
    }
    camera.position.set(0, 2.2, 5);
    camera.lookAt(0, 7, -45);
    break;
  case 'lod':
    lod.nearEnd.value = 250; lod.farStart.value = 250;
    forestField(2200, 15, 1100, 450, 10);
    camera.position.set(0, 26, 0);
    camera.lookAt(0, 8, -260);
    break;
  case 'far':
    lod.nearEnd.value = -1e9; lod.farStart.value = -1e9;   // impostors only
    forestField(2500, 350, 1300, 500, 10);
    camera.position.set(0, 18, 0);
    camera.lookAt(0, 10, -500);
    break;
  case 'aerial':
    lod.nearEnd.value = 250; lod.farStart.value = 250;
    forestField(2800, 60, 1500, 600, 10);
    camera.position.set(0, 320, 0);
    camera.lookAt(0, 0, -520);
    break;
  case 'atlas': {
    for (const k of KINDS) for (const mesh of Object.values(meshes[k])) mesh.visible = false;
    ground.visible = false;
    scene.background = new THREE.Color(0.2, 0.2, 0.22);
    atlasQuads = new THREE.Group();
    KINDS.forEach((k, i) => {
      for (const [j, tex] of [impostors[k].albedo.texture, impostors[k].normals.texture].entries()) {
        const q = new THREE.Mesh(new THREE.PlaneGeometry(2, 1), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
        q.position.set(-1.05 + j * 2.1, 1.1 - i * 1.1, 0);
        atlasQuads.add(q);
      }
    });
    scene.add(atlasQuads);
    camera.position.set(0, 0, 3.6);
    camera.lookAt(0, 0, 0);
    break;
  }
}
finish();

// ---------------------------------------------------------------- loop
function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();
const start = performance.now();
let frames = 0;
function frame() {
  requestAnimationFrame(frame);
  const elapsed = fixedTime ?? (performance.now() - start) / 1000;
  wind.time.value = elapsed;
  renderer.info.reset();
  renderer.render(scene, camera);
  frames++;
  if (frames === 2 || frames % 30 === 0) {
    const info = renderer.info.render;
    const stats = KINDS.map((k) => `${k.padEnd(9)} near ${String(TREE_STATS[k].near).padStart(4)} tris (${TREE_STATS[k].clusters} clusters)  far ${TREE_STATS[k].far}`).join('\n');
    hud.textContent = `view: ${view}   trees placed: ${placed}\ndraw calls ${info.calls}  triangles ${info.triangles}\n${stats}\nwind ${wind.strength.value}  t=${elapsed.toFixed(1)}  lod near<${lod.nearEnd.value} far>${lod.farStart.value}`;
    window.treesInfo = { view, placed, calls: info.calls, triangles: info.triangles, stats: TREE_STATS };
    window.treesReady = true;
  }
}
requestAnimationFrame(frame);
