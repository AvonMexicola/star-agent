// Contact sheet for the Meshy props in public/models/props/manifest.json.
// Served raw out of public/, so imports must be absolute URLs. THREE comes from
// /src/trees.js so that GLTFLoader (which imports the bare specifier 'three')
// resolves to the same Vite-optimised module instance.
//
//   ?t=<seconds>  freeze the turntable at a fixed time (deterministic screenshots)
//   ?cols=<n>     force the column count
//   ?only=<name>  show a single asset, full window
//   ?clean        hide the HUD
import { THREE } from '/src/trees.js';
import { GLTFLoader } from '/node_modules/three/examples/jsm/loaders/GLTFLoader.js';

const params = new URLSearchParams(location.search);
const fixedTime = params.has('t') ? Number(params.get('t')) : null;
const onlyName = params.get('only');
if (params.has('clean')) document.body.classList.add('clean');

const MANIFEST_URL = '/models/props/manifest.json';
const HUMAN_HEIGHT = 1.8;

const canvas = document.getElementById('viewport');
const labelHost = document.getElementById('labels');
const hud = document.getElementById('hud');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.setClearColor(0x0a1016, 1);
renderer.setScissorTest(true);

const scene = new THREE.Scene();

const hemi = new THREE.HemisphereLight(0xbfd8ff, 0x2a2620, 1.15);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff3e0, 2.4);
sun.position.set(4, 7, 5);
scene.add(sun);
const fill = new THREE.DirectionalLight(0x9fd8ff, 0.5);
fill.position.set(-5, 2.5, -4);
scene.add(fill);

// 1 m grid, shared by every cell — the squares are the scale reference.
const grid = new THREE.GridHelper(40, 40, 0x2c4b63, 0x16303f);
grid.material.transparent = true;
grid.material.opacity = 0.55;
scene.add(grid);

const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 2000);

// ------------------------------------------------------------------ silhouette

function buildHuman() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: 0x27343d, roughness: 0.95, metalness: 0.0,
  });
  const add = (geo, x, y, z) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    g.add(m);
    return m;
  };
  // proportions of a 1.8 m adult
  add(new THREE.SphereGeometry(0.105, 16, 12), 0, 1.66, 0);          // head
  add(new THREE.CylinderGeometry(0.055, 0.06, 0.1, 10), 0, 1.545, 0); // neck
  add(new THREE.BoxGeometry(0.4, 0.56, 0.21), 0, 1.2, 0);             // chest
  add(new THREE.BoxGeometry(0.34, 0.2, 0.19), 0, 0.86, 0);            // hips
  for (const s of [-1, 1]) {
    add(new THREE.CapsuleGeometry(0.055, 0.5, 4, 8), s * 0.245, 1.19, 0);  // arm
    add(new THREE.CapsuleGeometry(0.075, 0.66, 4, 8), s * 0.1, 0.42, 0);   // leg
    add(new THREE.BoxGeometry(0.1, 0.055, 0.24), s * 0.1, 0.027, 0.04);    // foot
  }
  return g;
}
const human = buildHuman();
scene.add(human);

// ---------------------------------------------------------------------- loading

function bbox(obj) {
  return new THREE.Box3().setFromObject(obj);
}

function analyse(root) {
  let tris = 0, meshes = 0, textured = false, emissive = false;
  const texSizes = new Set();
  root.traverse((o) => {
    if (!o.isMesh) return;
    meshes++;
    const g = o.geometry;
    if (g?.index) tris += g.index.count / 3;
    else if (g?.attributes?.position) tris += g.attributes.position.count / 3;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      if (!m) continue;
      if (m.map) {
        textured = true;
        const img = m.map.image;
        if (img?.width) texSizes.add(`${img.width}x${img.height}`);
      }
      if (m.emissive && m.emissive.getHex() !== 0x000000) emissive = true;
    }
  });
  return { tris: Math.round(tris), meshes, textured, emissive, texSizes: [...texSizes] };
}

const loader = new GLTFLoader();

async function loadEntry(entry) {
  const url = `/models/props/${entry.file}`;
  const gltf = await loader.loadAsync(url);
  const root = gltf.scene;
  const info = analyse(root);

  // Pivot lets the turntable spin the asset about its own vertical axis.
  const pivot = new THREE.Group();
  pivot.add(root);
  scene.add(pivot);
  pivot.visible = false;

  const box = bbox(root);
  const size = new THREE.Vector3();
  box.getSize(size);
  const center = new THREE.Vector3();
  box.getCenter(center);

  return {
    entry, pivot, info, size, center,
    minY: box.min.y,
    height: size.y,
    footprint: Math.max(size.x, size.z),
    anims: gltf.animations?.length || 0,
  };
}

// ------------------------------------------------------------------- framing

function frameCell(item, aspect) {
  // Fit the asset and the 1.8 m human side by side.
  const gap = Math.max(0.25, item.footprint * 0.18);
  const humanX = -(item.footprint * 0.5 + gap + 0.25);
  human.position.set(humanX, 0, 0);

  const top = Math.max(item.height, HUMAN_HEIGHT);
  const wide = item.footprint * 0.5 + Math.abs(humanX) + 0.35;
  const radius = Math.max(top * 0.62, wide * 0.62, 0.3);
  const focus = new THREE.Vector3((humanX + item.footprint * 0.5) * 0.35, top * 0.48, 0);

  camera.aspect = aspect;
  const vFov = THREE.MathUtils.degToRad(camera.fov);
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
  const dist = Math.max(radius / Math.sin(vFov / 2), radius / Math.sin(hFov / 2)) * 1.08;

  const az = THREE.MathUtils.degToRad(38);
  const el = THREE.MathUtils.degToRad(17);
  camera.position.set(
    focus.x + dist * Math.cos(el) * Math.sin(az),
    focus.y + dist * Math.sin(el),
    focus.z + dist * Math.cos(el) * Math.cos(az),
  );
  camera.lookAt(focus);
  camera.near = Math.max(0.01, dist * 0.02);
  camera.far = dist * 12;
  camera.updateProjectionMatrix();

  // Keep the grid from swallowing tiny props.
  const gridScale = Math.max(0.06, Math.min(1, top / 12));
  grid.scale.setScalar(gridScale);
}

// ---------------------------------------------------------------------- main

let items = [];
let cols = 1, rows = 1;

function layout() {
  const n = items.length || 1;
  cols = params.has('cols') ? Number(params.get('cols'))
       : onlyName ? 1
       : Math.min(4, Math.ceil(Math.sqrt(n)));
  rows = Math.ceil(n / cols);

  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);

  labelHost.replaceChildren();
  const cw = w / cols, ch = h / rows;
  items.forEach((it, i) => {
    const cx = (i % cols) * cw, cy = Math.floor(i / cols) * ch;
    const d = document.createElement('div');
    d.className = 'lab';
    d.style.left = `${cx + 8}px`;
    d.style.top = `${cy + 8}px`;
    const e = it.entry;
    const budget = e.category === 'character' ? 20000 : 10000;
    const overTris = it.info.tris > budget;
    const wantH = e.height_m;
    const offH = wantH && Math.abs(it.height - wantH) / wantH > 0.06;
    const sunk = it.minY < -0.02 * Math.max(1, it.height);
    const flags = [];
    if (!it.info.textured) flags.push('NO TEXTURE');
    if (overTris) flags.push('OVER TRIS');
    if (offH) flags.push('SCALE');
    if (sunk) flags.push('ORIGIN');
    d.innerHTML =
      `<b>${e.name}</b>\n` +
      `${it.info.tris.toLocaleString()} tris · ${it.height.toFixed(2)} m\n` +
      `foot ${it.size.x.toFixed(2)}×${it.size.z.toFixed(2)} m · ${it.info.meshes} mesh\n` +
      `tex ${it.info.texSizes.join(',') || 'none'}${it.anims ? ` · ${it.anims} anim` : ''}` +
      (flags.length ? `\n<span class="warn">${flags.join(' · ')}</span>` : '');
    labelHost.appendChild(d);
  });
}

function render(timeSec) {
  const w = window.innerWidth, h = window.innerHeight;
  const cw = Math.floor(w / cols), ch = Math.floor(h / rows);

  items.forEach((it) => { it.pivot.visible = false; });

  items.forEach((it, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    const x = col * cw;
    const y = h - (row + 1) * ch; // WebGL viewport origin is bottom-left
    renderer.setViewport(x, y, cw, ch);
    renderer.setScissor(x, y, cw, ch);

    it.pivot.visible = true;
    it.pivot.rotation.y = timeSec * 0.35 + i * 0.6;
    frameCell(it, cw / ch);
    renderer.render(scene, camera);
    it.pivot.visible = false;
  });
}

let start = performance.now();
function loop() {
  const t = fixedTime !== null ? fixedTime : (performance.now() - start) / 1000;
  render(t);
  if (fixedTime === null) requestAnimationFrame(loop);
}

async function boot() {
  let manifest;
  try {
    const res = await fetch(MANIFEST_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    manifest = await res.json();
  } catch (err) {
    hud.textContent = `manifest load failed: ${err.message}`;
    window.__propsError = String(err);
    window.__propsReady = true;
    return;
  }

  let list = Array.isArray(manifest) ? manifest : (manifest.props || []);
  if (onlyName) list = list.filter((e) => e.name === onlyName);

  const loaded = [];
  const failed = [];
  for (const entry of list) {
    try {
      loaded.push(await loadEntry(entry));
    } catch (err) {
      failed.push(`${entry.name}: ${err.message}`);
    }
  }
  items = loaded;

  layout();
  window.addEventListener('resize', () => { layout(); if (fixedTime !== null) render(fixedTime); });

  const totalTris = items.reduce((s, it) => s + it.info.tris, 0);
  hud.textContent =
    `${items.length} / ${list.length} props · ${totalTris.toLocaleString()} tris total\n` +
    `human silhouette = ${HUMAN_HEIGHT} m · grid = 1 m squares` +
    (failed.length ? `\nfailed: ${failed.join('; ')}` : '');

  start = performance.now();
  loop();
  if (fixedTime !== null) render(fixedTime);

  window.__propsFailed = failed;
  window.__propsStats = items.map((it) => ({
    name: it.entry.name, tris: it.info.tris, height: it.height,
    footprint: [it.size.x, it.size.z], textured: it.info.textured,
    texSizes: it.info.texSizes, minY: it.minY, anims: it.anims,
  }));
  window.__propsReady = true;
}

boot();
