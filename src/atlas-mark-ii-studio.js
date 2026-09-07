import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import atlasLayout from '../assets/atlas-mark-ii/layout.json' with { type: 'json' };
import { AtlasMarkIISystems } from './atlas-mark-ii-systems.js';
import { createShipMFDs } from './ship-mfd.js';
import { atlasInspectionPages, describeAtlasControl } from './atlas-mark-ii-controls.js';
import { createProjectedActionLabel } from './projected-action-label.js';
import { shipManufacturer } from './ship-manufacturers.js';

const MODEL_URL = '/models/atlas-mark-ii/atlas-mark-ii.glb';
const WALK_SPEED = 4.2;
const VIEW_LABELS = {
  exterior: 'EXTERIOR / PORT QUARTER',
  aft: 'EXTERIOR / ENGINE QUARTER',
  cargo: 'CARGO / DRIVE LANE',
  bridge: 'UPPER / BRIDGE',
  crew: 'UPPER / CREW QUARTERS',
  galley: 'UPPER / GALLEY & HYGIENE',
  mounts: 'HARDPOINT / S3 ARRAY',
};

const body = document.body;
const manufacturer = shipManufacturer('atlas');
document.querySelector('[data-manufacturer-name]').textContent = manufacturer.name.toUpperCase();
document.querySelector('[data-manufacturer-emblem]').src = manufacturer.emblemURL;
const canvas = document.querySelector('#viewport');
const loading = document.querySelector('#loading');
const loadingDetail = document.querySelector('#loading-detail');
const assetState = document.querySelector('#asset-state');
const viewName = document.querySelector('#view-name');
const walkButton = document.querySelector('#walk-button');
const detailsToggle = document.querySelector('#details-toggle');
const mountToggle = document.querySelector('#mount-toggle');
const mountOverlay = document.querySelector('#mount-overlay');
const prompt = document.querySelector('#interaction-prompt');
const promptText = prompt.querySelector('span');
const message = document.querySelector('#studio-message');
const scaleLabel = document.querySelector('#scale-reference');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, logarithmicDepthBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth < 600 ? 1.25 : 1.75));
renderer.setSize(innerWidth, innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.03;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x071017);
scene.fog = new THREE.FogExp2(0x071017, 0.0055);

const camera = new THREE.PerspectiveCamera(43, innerWidth / innerHeight, 0.035, 320);
camera.position.fromArray(atlasLayout.views.exterior.position);
const controls = new OrbitControls(camera, canvas);
controls.target.fromArray(atlasLayout.views.exterior.target);
controls.enableDamping = true;
controls.dampingFactor = 0.065;
controls.minDistance = 2;
controls.maxDistance = 145;
controls.maxPolarAngle = Math.PI * 0.495;
controls.update();

const environmentScene = new RoomEnvironment();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(environmentScene, 0.035).texture;
scene.environmentIntensity = 0.25;
environmentScene.dispose();
pmrem.dispose();

scene.add(new THREE.HemisphereLight(0xc4ddf4, 0x182229, 0.15));
const keyLight = new THREE.DirectionalLight(0xffe4c3, 4.1);
keyLight.position.set(-35, 54, -42);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.camera.left = -46;
keyLight.shadow.camera.right = 46;
keyLight.shadow.camera.top = 46;
keyLight.shadow.camera.bottom = -46;
keyLight.shadow.camera.near = 4;
keyLight.shadow.camera.far = 140;
// Bias matches the 92 m-wide key shadow frustum; too little produces
// self-shadow contour bands across the shallow-angle armour panels.
keyLight.shadow.bias = -0.0005;
keyLight.shadow.normalBias = 0.06;
keyLight.target.position.set(0, 4, 0);
scene.add(keyLight, keyLight.target);

const bayLights = [
  [0xc4ddf4, 14, [-16, 13, -17]],
  [0xffcf94, 12, [15, 11, 15]],
  [0xc4ddf4, 9, [0, 10, 29]],
];
for (const [colour, intensity, position] of bayLights) {
  const light = new THREE.PointLight(colour, intensity, 27, 1.6);
  light.position.set(...position);
  scene.add(light);
}

RectAreaLightUniformsLib.init();
const fixtureMaterial = new THREE.MeshStandardMaterial({
  color: 0xd8e2df,
  emissive: 0xc4ddf4,
  emissiveIntensity: 2.2,
  roughness: 0.42,
});
function addPractical(position, width = 2.3, intensity = 3.2, warm = false) {
  const colour = warm ? 0xffcf94 : 0xc4ddf4;
  const light = new THREE.RectAreaLight(colour, intensity, width, 0.22);
  light.position.set(...position);
  light.rotation.x = Math.PI / 2;
  scene.add(light);
  const fixture = new THREE.Mesh(new THREE.BoxGeometry(width, 0.045, 0.22), fixtureMaterial);
  fixture.position.set(position[0], position[1] + 0.015, position[2]);
  scene.add(fixture);
}
for (const z of [-16, 0, 16]) {
  addPractical([-3, 8.1, z], 2.2, 3.1);
  addPractical([3, 8.1, z], 2.2, 3.1);
}
addPractical([0, 12.7, -18], 2.8, 4.2);
addPractical([-3.8, 12.6, 7], 1.8, 2.8, true);
addPractical([3.8, 12.6, 7], 1.8, 2.8, true);
addPractical([2.7, 12.6, 15], 1.4, 2.4);

function addInteriorShadow(position, target, angle, intensity, distance) {
  const light = new THREE.SpotLight(0xc4ddf4, intensity, distance, angle, 0.65, 1.7);
  light.position.set(...position);
  light.target.position.set(...target);
  light.castShadow = true;
  light.shadow.mapSize.set(512, 512);
  light.shadow.camera.near = 0.3;
  light.shadow.camera.far = distance;
  light.shadow.bias = -0.00025;
  light.shadow.normalBias = 0.018;
  scene.add(light, light.target);
}
addInteriorShadow([0, 8.25, 0], [0, 2.6, 0], 1.12, 18, 12);
addInteriorShadow([0, 12.85, -18], [0, 9.5, -18], 1.05, 12, 8);
addInteriorShadow([-3.8, 12.75, 7], [-3.8, 9.5, 7], 0.95, 9, 7);
addInteriorShadow([3.8, 12.75, 8.5], [3.1, 9.5, 10], 1.05, 9, 8);

const bay = new THREE.Group();
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(180, 180),
  new THREE.MeshStandardMaterial({ color: 0x202a30, roughness: 0.76, metalness: 0.18 }),
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.035;
floor.receiveShadow = true;
bay.add(floor);
for (const radius of [25, 40, 58]) {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(radius - 0.025, radius + 0.025, 128),
    new THREE.MeshBasicMaterial({ color: 0x60747a, transparent: true, opacity: 0.28, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.004;
  bay.add(ring);
}
const centreLine = new THREE.Mesh(
  new THREE.PlaneGeometry(0.035, 132),
  new THREE.MeshBasicMaterial({ color: 0x80979f, transparent: true, opacity: 0.25 }),
);
centreLine.rotation.x = -Math.PI / 2;
centreLine.position.y = 0.006;
bay.add(centreLine);

const backdropMaterial = new THREE.MeshStandardMaterial({ color: 0x18232a, roughness: 0.82, metalness: 0.22 });
const backdrop = new THREE.Mesh(new THREE.BoxGeometry(92, 23, 0.45), backdropMaterial);
backdrop.position.set(0, 11.5, -68);
backdrop.receiveShadow = true;
bay.add(backdrop);
const structureMaterial = new THREE.MeshStandardMaterial({ color: 0x344249, roughness: 0.58, metalness: 0.5 });
for (const x of [-36, -18, 0, 18, 36]) {
  const upright = new THREE.Mesh(new THREE.BoxGeometry(0.55, 23, 0.75), structureMaterial);
  upright.position.set(x, 11.5, -67.65);
  bay.add(upright);
}
const serviceStripMaterial = new THREE.MeshStandardMaterial({
  color: 0xc4ddf4,
  emissive: 0xc4ddf4,
  emissiveIntensity: 3,
  roughness: 0.38,
});
for (const [x, y, width] of [[-26, 17, 11], [-7, 8, 6], [10, 17, 9], [28, 8, 7]]) {
  const strip = new THREE.Mesh(new THREE.BoxGeometry(width, 0.18, 0.1), serviceStripMaterial);
  strip.position.set(x, y, -67.38);
  bay.add(strip);
}
scene.add(bay);

function createScaleReference() {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ color: 0x9db0ad, roughness: 0.52, metalness: 0.35 });
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.78, 5, 10), material);
  torso.position.y = 1.05;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 10), material);
  head.position.y = 1.65;
  const legGeometry = new THREE.CapsuleGeometry(0.075, 0.5, 4, 8);
  const leftLeg = new THREE.Mesh(legGeometry, material);
  leftLeg.position.set(-0.105, 0.37, 0);
  const rightLeg = leftLeg.clone();
  rightLeg.position.x = 0.105;
  group.add(torso, head, leftLeg, rightLeg);
  group.position.set(-18, 0, -17);
  group.traverse((object) => { if (object.isMesh) object.castShadow = true; });
  return group;
}
const scaleReference = createScaleReference();
scene.add(scaleReference);

const systems = new AtlasMarkIISystems(atlasLayout);
const nodeBindings = { ramps: new Map(), elevator: null, gates: [] };
const stats = { meshes: 0, triangles: 0, materials: 0, textures: 0 };
let model = null;
let mode = 'inspect';
let activeView = 'exterior';
let detailsVisible = true;
let viewTransition = null;
let dynamicShadowsActive = false;
let messageTimer = 0;
let currentInteraction = null;
let yaw = 0;
let pitch = 0;
let seated = false;
let inputDevice = 'keyboard';
const mfds = createShipMFDs({ mounts: atlasLayout.pilotMFDs, includeFrames: false, screenOffset: .046 });
const controlLabel = createProjectedActionLabel(document.body, id => onInteraction(id));
const walker = { position: new THREE.Vector3(0, atlasLayout.eyeHeight, 34) };
const keys = new Set();
const controllerButtons = { interact: false, exit: false };
const clock = new THREE.Clock();
const scratch = {
  forward: new THREE.Vector3(),
  right: new THREE.Vector3(),
  motion: new THREE.Vector3(),
  next: new THREE.Vector3(),
  projected: new THREE.Vector3(),
};

function formatCount(value) {
  return new Intl.NumberFormat('en-US').format(value);
}

function collectStats(root) {
  const materials = new Set();
  const textures = new Set();
  root.traverse((object) => {
    if (!object.isMesh) return;
    stats.meshes += 1;
    const geometry = object.geometry;
    if (geometry.index) stats.triangles += geometry.index.count / 3;
    else if (geometry.attributes.position) stats.triangles += geometry.attributes.position.count / 3;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (!material) continue;
      materials.add(material);
      for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
    }
  });
  stats.triangles = Math.round(stats.triangles);
  stats.materials = materials.size;
  stats.textures = textures.size;
  for (const [key, value] of Object.entries(stats)) {
    document.querySelector(`#stat-${key}`).textContent = formatCount(value);
  }
}

function configureModel(root) {
  const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  root.traverse((object) => {
    if (!object.isMesh) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    object.castShadow = materials.some((material) => material
      && !(material.transmission > 0.01
        || (material.transparent && material.opacity < 0.95)
        || /glass|window|canopy/i.test(material.name)));
    object.receiveShadow = true;
    for (const material of materials) {
      if (!material) continue;
      for (const value of Object.values(material)) {
        if (!value?.isTexture) continue;
        value.anisotropy = anisotropy;
      }
    }
  });
  for (const ramp of atlasLayout.ramps) nodeBindings.ramps.set(ramp.id, root.getObjectByName(ramp.node));
  nodeBindings.elevator = root.getObjectByName(atlasLayout.elevator.node);
  nodeBindings.gates = atlasLayout.elevator.gateNodes.map((name) => root.getObjectByName(name)).filter(Boolean);
}

function showMessage(text, duration = 3200) {
  clearTimeout(messageTimer);
  message.textContent = text;
  message.hidden = false;
  messageTimer = setTimeout(() => { message.hidden = true; }, duration);
}

function bindSystems(root) {
  if (typeof systems.bind === 'function') systems.bind(root);
  configureModel(root);
}

function applySystemsToModel() {
  for (const ramp of systems.ramps ?? []) {
    const node = nodeBindings.ramps.get(ramp.id);
    if (node && Number.isFinite(ramp.angle)) node.rotation.x = ramp.angle;
  }
  if (nodeBindings.elevator && Number.isFinite(systems.elevator?.y)) {
    nodeBindings.elevator.position.y = systems.elevator.y;
  }
}

function updateDynamicShadows() {
  const moving = Boolean(
    systems.ramps?.some(ramp => ramp.moving)
    || systems.elevator?.moving
    || systems.elevator?.gates?.some(gate => gate.moving)
    || systems.gates?.some(gate => gate.moving)
    || systems.gear?.moving
  );
  if (moving || dynamicShadowsActive) renderer.shadowMap.needsUpdate = true;
  dynamicShadowsActive = moving;
}

const assetPromise = new GLTFLoader().loadAsync(MODEL_URL).then((gltf) => {
  model = gltf.scene;
  model.name = 'AtlasMarkII';
  bindSystems(model);
  collectStats(model);
  model.add(mfds);
  scene.add(model);
  renderer.shadowMap.needsUpdate = true;
  assetState.textContent = 'READY';
  body.classList.remove('is-loading');
  body.classList.add('is-ready');
  loading.classList.add('hidden');
  return model;
}).catch((error) => {
  console.error(`Atlas Mark II asset failed to load from ${MODEL_URL}`, error);
  assetState.textContent = 'UNAVAILABLE';
  body.classList.remove('is-loading');
  body.classList.add('has-error');
  loading.classList.add('error');
  loadingDetail.textContent = `MODEL UNAVAILABLE · ${MODEL_URL} · ${error.message}`;
  document.querySelector('.loading-glyph').style.animation = 'none';
  return null;
});

function setView(name, immediate = false) {
  const view = atlasLayout.views[name];
  if (!view) return;
  if (mode === 'walk') leaveWalk(false);
  const destination = {
    position: new THREE.Vector3().fromArray(view.position),
    target: new THREE.Vector3().fromArray(view.target),
  };
  camera.fov = ['bridge', 'crew', 'galley'].includes(name) ? 56 : name === 'cargo' ? 52 : 43;
  camera.updateProjectionMatrix();
  if (immediate) {
    camera.position.copy(destination.position);
    controls.target.copy(destination.target);
    controls.update();
    viewTransition = null;
    commitViewUI(name);
  } else {
    viewTransition = {
      name,
      startedAt: performance.now(),
      duration: 0.72,
      fromPosition: camera.position.clone(),
      fromTarget: controls.target.clone(),
      ...destination,
    };
  }
}

function commitViewUI(name) {
  activeView = name;
  const isInterior = ['cargo', 'bridge', 'crew', 'galley'].includes(name);
  setDetailsVisible(!isInterior);
  viewName.textContent = VIEW_LABELS[name] ?? name.toUpperCase();
  document.querySelectorAll('[data-view]').forEach((button) => button.classList.toggle('active', button.dataset.view === name));
}

function setDetailsVisible(visible) {
  detailsVisible = visible;
  body.classList.toggle('details-hidden', !visible);
  detailsToggle.setAttribute('aria-pressed', String(visible));
}

function updateViewTransition() {
  if (!viewTransition) return;
  const elapsed = (performance.now() - viewTransition.startedAt) / 1000;
  const linear = Math.min(1, elapsed / viewTransition.duration);
  const eased = linear * linear * (3 - 2 * linear);
  camera.position.lerpVectors(viewTransition.fromPosition, viewTransition.position, eased);
  controls.target.lerpVectors(viewTransition.fromTarget, viewTransition.target, eased);
  if (linear === 1) {
    const name = viewTransition.name;
    viewTransition = null;
    commitViewUI(name);
  }
}

function rampIsOpen(id) {
  const config = atlasLayout.ramps.find((item) => item.id === id);
  const ramp = systems.ramps?.find((item) => item.id === id);
  return config && ramp && Math.abs((ramp.target ?? ramp.angle) - config.openAngle) < 0.025;
}

function activeGamepad() {
  return Array.from(navigator.getGamepads?.() ?? []).find(gamepad => gamepad?.connected) ?? null;
}

function controllerAxis(value, deadzone = 0.16) {
  const magnitude = Math.abs(value ?? 0);
  if (magnitude <= deadzone) return 0;
  return Math.sign(value) * Math.min(1, (magnitude - deadzone) / (1 - deadzone));
}

function syncControllerEdges() {
  const gamepad = activeGamepad();
  controllerButtons.interact = Boolean(gamepad?.buttons[0]?.pressed);
  controllerButtons.exit = Boolean(gamepad?.buttons[1]?.pressed);
}

function readController(dt) {
  const gamepad = activeGamepad();
  if (!gamepad) {
    controllerButtons.interact = false;
    controllerButtons.exit = false;
    return { x: 0, y: 0 };
  }
  const interact = Boolean(gamepad.buttons[0]?.pressed);
  const exit = Boolean(gamepad.buttons[1]?.pressed);
  if (interact || exit || gamepad.axes.some(value => Math.abs(value) > .15)) inputDevice = 'controller';
  if (interact && !controllerButtons.interact) onInteraction();
  if (exit && !controllerButtons.exit) leaveWalk();
  controllerButtons.interact = interact;
  controllerButtons.exit = exit;
  yaw -= controllerAxis(gamepad.axes[2]) * dt * 1.8;
  pitch = THREE.MathUtils.clamp(pitch - controllerAxis(gamepad.axes[3]) * dt * 1.5, -1.42, 1.42);
  return { x: controllerAxis(gamepad.axes[0]), y: controllerAxis(gamepad.axes[1]) };
}

function enterWalk() {
  if (!model) {
    showMessage('The physical walkthrough becomes available when the Atlas model is loaded.');
    return false;
  }
  mode = 'walk';
  body.classList.add('walking');
  controls.enabled = false;
  viewTransition = null;
  walker.position.set(0, atlasLayout.eyeHeight, 34);
  yaw = 0;
  pitch = -0.02;
  camera.fov = 67;
  camera.updateProjectionMatrix();
  walkButton.querySelector('strong').textContent = 'EXIT';
  syncControllerEdges();
  if (!rampIsOpen('aft')) systems.toggleRamp?.('aft');
  showMessage('Aft ramp opening. Walk aboard when it reaches the ground.');
  capturePointer();
  return true;
}

function leaveWalk(selectExterior = true) {
  if (document.pointerLockElement === canvas) document.exitPointerLock();
  mode = 'inspect';
  seated = false;
  controlLabel.hide();
  keys.clear();
  body.classList.remove('walking');
  controls.enabled = true;
  prompt.hidden = true;
  walkButton.querySelector('strong').textContent = 'ENTER';
  if (selectExterior) setView('exterior');
}

function capturePointer() {
  if (mode !== 'walk' || document.pointerLockElement === canvas) return;
  try {
    const result = canvas.requestPointerLock();
    result?.catch(() => showMessage('Mouse capture unavailable. Use arrow keys to look.'));
  } catch {
    showMessage('Mouse capture unavailable. Use arrow keys to look.');
  }
}

function onInteraction(expectedId = null) {
  if (mode !== 'walk') return false;
  const descriptor = describeAtlasControl(systems, walker.position, seated);
  const interaction = descriptor?.id ?? null;
  if (typeof expectedId === 'string' && interaction !== expectedId) return false;
  if (!interaction) {
    showMessage('No control within reach.', 1500);
    return false;
  }
  if (!descriptor.enabled) { showMessage(descriptor.reason || descriptor.action);return false; }
  if (interaction.startsWith('ramp:')) {
    const id = interaction.slice(5);
    const config = atlasLayout.ramps.find((item) => item.id === id);
    const outwardDistance = config && (walker.position.z - config.pivot[2]) * config.outward;
    const openLength = config && config.length * Math.cos(config.openAngle);
    const onRamp = config && outwardDistance >= 0 && outwardDistance <= openLength + atlasLayout.capsuleRadius
      && Math.abs(walker.position.x - config.pivot[0]) <= config.width / 2 + atlasLayout.capsuleRadius;
    const changed = systems.toggleRamp?.(id, { occupied: Boolean(onRamp) });
    showMessage(changed ? `${id.toUpperCase()} ramp actuator accepted.` : 'Ramp interlock active. Clear the moving surface.');
    return Boolean(changed);
  }
  if (interaction === 'elevator:crew') {
    const changed = systems.toggleElevator?.(walker.position);
    showMessage(changed ? 'Crew lift moving.' : 'Stand fully inside the crew lift.');
    return Boolean(changed);
  }
  if (interaction === 'seat') {
    seated = !seated;
    walker.position.fromArray(seated ? atlasLayout.pilotEye : atlasLayout.stand);
    yaw = 0;pitch = 0;keys.clear();
    camera.fov = seated ? 56 : 67;camera.updateProjectionMatrix();
    showMessage(seated ? 'Pilot station. F / A to stand up.' : 'Standing at the pilot station.');
    return true;
  }
  return false;
}

function updateWalker(dt) {
  const carryDeltaY = systems.update?.(dt, walker.position) ?? 0;
  if (Number.isFinite(carryDeltaY)) walker.position.y += carryDeltaY;
  applySystemsToModel();

  const controller = readController(dt);
  if (mode !== 'walk') return;
  const turn = (keys.has('ArrowLeft') ? 1 : 0) - (keys.has('ArrowRight') ? 1 : 0);
  const tilt = (keys.has('ArrowUp') ? 1 : 0) - (keys.has('ArrowDown') ? 1 : 0);
  yaw += turn * dt * 1.45;
  pitch = THREE.MathUtils.clamp(pitch + tilt * dt * 1.15, -1.42, 1.42);

  scratch.forward.set(-Math.sin(yaw), 0, -Math.cos(yaw));
  scratch.right.set(Math.cos(yaw), 0, -Math.sin(yaw));
  scratch.motion.set(0, 0, 0);
  if (keys.has('KeyW')) scratch.motion.add(scratch.forward);
  if (keys.has('KeyS')) scratch.motion.sub(scratch.forward);
  if (keys.has('KeyD')) scratch.motion.add(scratch.right);
  if (keys.has('KeyA')) scratch.motion.sub(scratch.right);
  scratch.motion.addScaledVector(scratch.right, controller.x);
  scratch.motion.addScaledVector(scratch.forward, -controller.y);
  const precisionWalking = keys.has('ShiftLeft') || keys.has('ShiftRight');
  if (seated) scratch.motion.set(0, 0, 0);
  else if (scratch.motion.lengthSq() > 0) scratch.motion.normalize().multiplyScalar((precisionWalking ? 1 : WALK_SPEED) * dt);
  scratch.next.copy(walker.position).add(scratch.motion);
  const constrained = systems.constrain?.(walker.position, scratch.next);
  scratch.next.copy(constrained?.isVector3 ? constrained : scratch.next);
  const floorHeight = systems.floorAt?.(scratch.next);
  if (!seated && Number.isFinite(floorHeight)) scratch.next.y = floorHeight + atlasLayout.eyeHeight;
  walker.position.copy(scratch.next);
  camera.position.copy(walker.position);
  camera.rotation.set(pitch, yaw, 0, 'YXZ');

  const descriptor = describeAtlasControl(systems, walker.position, seated);
  currentInteraction = descriptor?.id ?? null;
  prompt.hidden = !currentInteraction;
  if (currentInteraction) {
    promptText.textContent = descriptor.action + (descriptor.reason ? ` · ${descriptor.reason}` : '');
    prompt.querySelector('kbd').textContent = inputDevice === 'controller' ? 'A' : inputDevice === 'touch' ? 'TAP' : 'F';
  }
}

function updateAnnotations() {
  const rect = canvas.getBoundingClientRect();
  const showMounts = mountOverlay.classList.contains('visible') && mode === 'inspect';
  for (const mount of atlasLayout.mounts) {
    const label = mountOverlay.querySelector(`[data-mount="${mount.id}"]`);
    scratch.projected.fromArray(mount.position).project(camera);
    const visible = showMounts && scratch.projected.z > -1 && scratch.projected.z < 1;
    label.hidden = !visible;
    if (!visible) continue;
    label.style.left = `${(scratch.projected.x * 0.5 + 0.5) * rect.width}px`;
    label.style.top = `${(-scratch.projected.y * 0.5 + 0.5) * rect.height}px`;
  }
  scratch.projected.copy(scaleReference.position).add(new THREE.Vector3(0, 1.8, 0)).project(camera);
  scaleLabel.style.left = `${(scratch.projected.x * 0.5 + 0.5) * rect.width}px`;
  scaleLabel.style.top = `${(-scratch.projected.y * 0.5 + 0.5) * rect.height}px`;
}

document.querySelectorAll('[data-view]').forEach((button) => {
  button.disabled = !atlasLayout.views[button.dataset.view];
  button.addEventListener('click', () => setView(button.dataset.view));
});
walkButton.addEventListener('click', () => mode === 'walk' ? leaveWalk() : enterWalk());
detailsToggle.addEventListener('click', () => setDetailsVisible(!detailsVisible));
mountToggle.addEventListener('click', () => {
  const visible = !mountOverlay.classList.contains('visible');
  mountOverlay.classList.toggle('visible', visible);
  mountOverlay.setAttribute('aria-hidden', String(!visible));
  mountToggle.setAttribute('aria-pressed', String(visible));
  if (visible && mode === 'inspect') setView('mounts');
});
canvas.addEventListener('click', capturePointer);
document.addEventListener('mousemove', (event) => {
  if (mode !== 'walk' || document.pointerLockElement !== canvas) return;
  yaw -= event.movementX * 0.0022;
  pitch = THREE.MathUtils.clamp(pitch - event.movementY * 0.002, -1.42, 1.42);
});
window.addEventListener('keydown', (event) => {
  inputDevice = 'keyboard';
  if (mode !== 'walk') return;
  if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'ShiftRight', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.code)) {
    event.preventDefault();
    keys.add(event.code);
  }
  if (event.code === 'KeyF' && !event.repeat) onInteraction();
});
window.addEventListener('keyup', (event) => keys.delete(event.code));
window.addEventListener('blur', () => keys.clear());
for (const button of document.querySelectorAll('[data-hold]')) {
  const release = () => keys.delete(button.dataset.hold);
  button.addEventListener('pointerdown', (event) => { event.preventDefault(); keys.add(button.dataset.hold); });
  button.addEventListener('pointerup', release);
  button.addEventListener('pointercancel', release);
  button.addEventListener('pointerleave', release);
}
document.querySelector('[data-touch-interact]').addEventListener('click', onInteraction);
document.addEventListener('pointerdown', event => { if (event.pointerType === 'touch') inputDevice = 'touch'; });
let touchLook = null;
canvas.addEventListener('pointerdown', (event) => {
  if (mode === 'walk' && event.pointerType === 'touch') touchLook = { id: event.pointerId, x: event.clientX, y: event.clientY };
});
canvas.addEventListener('pointermove', (event) => {
  if (mode !== 'walk' || !touchLook || event.pointerId !== touchLook.id) return;
  yaw -= (event.clientX - touchLook.x) * 0.007;
  pitch = THREE.MathUtils.clamp(pitch - (event.clientY - touchLook.y) * 0.006, -1.42, 1.42);
  touchLook.x = event.clientX;
  touchLook.y = event.clientY;
});
canvas.addEventListener('pointerup', (event) => { if (touchLook?.id === event.pointerId) touchLook = null; });
canvas.addEventListener('pointercancel', () => { touchLook = null; });
window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth < 600 ? 1.25 : 1.75));
  renderer.setSize(innerWidth, innerHeight, false);
});

function frame() {
  const frameDelta = Math.min(0.25, clock.getDelta());
  let remaining = frameDelta;
  while (remaining > 0) {
    const step = Math.min(0.05, remaining);
    if (mode === 'walk') updateWalker(step);
    else systems.update?.(step, null);
    remaining -= step;
  }
  if (mode === 'inspect') {
    applySystemsToModel();
    updateViewTransition();
    controls.update();
  }
  updateDynamicShadows();
  updateAnnotations();
  mfds.updatePages(frameDelta, atlasInspectionPages(systems));
  if (mode === 'walk') {
    controlLabel.update(describeAtlasControl(systems, walker.position, seated), camera,
      { width: innerWidth, height: innerHeight }, inputDevice === 'controller' ? 'A' : inputDevice === 'touch' ? 'TAP' : 'F', model);
    // Keep the conventional prompt as a fallback for a control outside the view.
    if (!controlLabel.element.hidden) prompt.hidden = true;
  } else controlLabel.hide();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

setView('exterior', true);
requestAnimationFrame(frame);

window.atlasMarkIIStudio = {
  systems,
  stats,
  walker,
  ready: assetPromise,
  view: setView,
  enterWalk,
  leaveWalk,
  interact: onInteraction,
  get model() { return model; },
  get mode() { return mode; },
  get activeView() { return activeView; },
  get transitioning() { return Boolean(viewTransition); },
  get heading() { return { yaw, pitch }; },
  get interaction() { return currentInteraction; },
  get seated() { return seated; },
  mfds,
  get control() { return describeAtlasControl(systems, walker.position, seated); },
  get camera() { return camera; },
  inspectCamera(position, target) {
    if (mode !== 'inspect') return false;
    viewTransition = null;
    camera.position.fromArray(position);controls.target.fromArray(target);
    controls.update();return true;
  },
};
