// Test bench + socket calibrator for src/equipment.js — one character, one item,
// a nudger that prints the block you paste into equipment-sockets.json.
//
// Served raw out of public/, so imports must be absolute URLs. THREE comes from
// /src/character.js so every module under test shares one three instance.
//
//   ?rig=mannequin|player-male|player-female   which rig to calibrate (default mannequin)
//   ?item=rifle-laser|sidearm-pistol|mining-laser-tool|none   what to hold
//   ?back ?helmet ?holster                     wear the pack / the helmet, sling the item
//   ?view=side|front|back|hand|top|first       camera framing (default side)
//   ?dist=<m> ?fov=<deg> ?height=<m>           tweak that framing
//   ?yaw=<deg> ?pitch=<deg> ?lookz=<m>         orbit and push the aim point forward
//   ?aim=0                                     drop the aim pose (arms down)
//   ?fire                                      hold the trigger from frame one
//   ?phase=<0..1>                              freeze the aim clip at a phase
//   ?target=0 ?targetz=<m>                     hide / move the target block
//   ?warm=<seconds>                            fixed 1/60 s steps before the first frame
//   ?fp=x,y,z[,rx,ry,rz]                       setFirstPersonOffset(), item frame
//   ?clean                                     hide the panels (screenshots)
import { THREE, Character, CharacterCamera } from '/src/character.js';
import { Equipment, ITEMS, HELD_ITEMS, RIGS } from '/src/equipment.js';

const params = new URLSearchParams(location.search);
if (params.has('clean')) document.body.classList.add('clean');
const flag = (key, fallback) => (params.has(key) ? params.get(key) !== '0' : fallback);
const num = (key, fallback) => (params.has(key) ? Number(params.get(key)) : fallback);

const RIG = RIGS.indexOf(params.get('rig')) === -1 ? 'mannequin' : params.get('rig');
const RIG_URL = `/models/props/${RIG}.glb`;
// The two Meshy pilots were authored facing +Z; the mannequin faces -Z like the game.
const MODEL_YAW = RIG === 'mannequin' ? 0 : Math.PI;

// ---------------------------------------------------------------- renderer

const canvas = document.getElementById('viewport');
const readout = document.getElementById('readout');
const calibPanel = document.getElementById('calib');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setClearColor(0x0a1119, 1);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x0a1119, 60, 220);
const camera = new THREE.PerspectiveCamera(num('fov', 42), 1, 0.02, 500);

/** Everything with a fixed world position; shifted by -renderOrigin each frame. */
const world = new THREE.Group();
scene.add(world);

scene.add(new THREE.HemisphereLight(0x9dc4ff, 0x3a382f, 0.95));
const sun = new THREE.DirectionalLight(0xfff1dc, 2.4);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -6; sun.shadow.camera.right = 6;
sun.shadow.camera.top = 6; sun.shadow.camera.bottom = -6;
sun.shadow.camera.near = 1; sun.shadow.camera.far = 60;
sun.shadow.normalBias = 0.03;
sun.position.set(6, 12, 7);
sun.target.position.set(0, 1, 0);
world.add(sun, sun.target);
// A cool rim from behind so a dark barrel still reads against the dark ground.
const rim = new THREE.DirectionalLight(0x9fd8ff, 1.1);
rim.position.set(-7, 5, -8);
world.add(rim);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(400, 400),
  new THREE.MeshStandardMaterial({ color: 0x5d6a5a, roughness: 0.96, metalness: 0 }),
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
world.add(ground);

const grid = new THREE.GridHelper(60, 120, 0x35566b, 0x1d3141);
grid.material.transparent = true; grid.material.opacity = 0.45;
grid.position.y = 0.002;
world.add(grid);

// 10 cm reference ticks straight under the character, so a screenshot has a ruler.
const tickMaterial = new THREE.MeshBasicMaterial({ color: 0x9fd8ff });
for (let i = 1; i <= 18; i++) {
  const tick = new THREE.Mesh(new THREE.BoxGeometry(i % 5 === 0 ? 0.05 : 0.02, 0.004, 0.3), tickMaterial);
  tick.position.set(0.9, 0.004, -i * 0.1);
  world.add(tick);
}

// The thing the beam and the bolts are pointed at.
const target = new THREE.Mesh(
  new THREE.BoxGeometry(1.6, 1.6, 1.6),
  new THREE.MeshStandardMaterial({ color: 0x6b7686, roughness: 0.85, metalness: 0.05 }),
);
target.castShadow = true; target.receiveShadow = true;
const TARGET_Z = num('targetz', 7.2);
target.position.set(0, 1.2, -TARGET_Z);
target.visible = flag('target', true);
world.add(target);
// The face turned toward us: what `targetWorldPoint` points the shot at.
const TARGET_POINT = new THREE.Vector3(0, 1.35, -(TARGET_Z - 0.8));

// ------------------------------------------------------------------ the actors

let character = null;
let characterCamera = null;
let equipment = null;

const pending = [];

function build() {
  character = new Character(scene, { url: RIG_URL, modelYaw: MODEL_YAW, eyeHeight: 1.65 });
  characterCamera = new CharacterCamera(character, { mode: 'third', fov: num('fov', 42) });
  equipment = new Equipment(character, scene, {
    rig: RIG,
    camera,
    onHit: (hit) => { lastHit = `${hit.item} @ ${hit.distance.toFixed(1)} m`; hits++; },
    onMine: (mine) => { mined += mine.rate * mine.dt; },
  });
  character.setWorldPose(new THREE.Vector3(0, 0, 0), new THREE.Quaternion());
  if (flag('back', false)) pending.push(equipment.equip('backpack-life-support'));
  if (flag('helmet', false)) pending.push(equipment.equip('helmet-standalone'));
  if (params.has('fp')) {
    const values = params.get('fp').split(',').map(Number);
    equipment.setFirstPersonOffset({ position: values.slice(0, 3), rotation: values.slice(3, 6) });
  }
  const wanted = params.get('item');
  if (wanted && wanted !== 'none') {
    pending.push(equipment.equip(wanted).then(() => {
      if (flag('holster', false)) equipment.holster(true);
    }));
  }
}
let lastHit = '—';
let hits = 0;
let mined = 0;
build();

// ------------------------------------------------------------------ simulation

const sim = {
  aiming: flag('aim', true),
  firing: params.has('fire'),
  held: false,
  view: params.get('view') || 'side',
  yaw: num('yaw', 0) * Math.PI / 180,
  pitch: num('pitch', 0) * Math.PI / 180,
  distance: num('dist', 3.2),
  height: num('height', 1.35),
};

const input = {
  speed: 0, grounded: true, jumping: false, crouching: false, carrying: false,
  health: 1, aiming: 'none', firing: false, seated: false, dead: false,
};

// ---------------------------------------------------------------- calibration

const NUDGE_ITEMS = [...HELD_ITEMS, 'backpack-life-support', 'helmet-standalone'];
let nudgeIndex = 0;
let slot = 'hand';

function nudgeName() { return NUDGE_ITEMS[nudgeIndex]; }

function currentOffset() {
  return equipment.getOffset(nudgeName(), slot);
}

function nudge(axis, amount, rotation) {
  const offset = currentOffset();
  const position = offset.position.slice();
  const rotate = offset.rotation.slice();
  if (rotation) rotate[axis] = Number((rotate[axis] + amount).toFixed(3));
  else position[axis] = Number((position[axis] + amount).toFixed(4));
  equipment.setOffset(nudgeName(), position, rotate, slot);
}

// --- the auto-fitter -------------------------------------------------------
// Nudging three positions and three angles by hand is slow, so this solves the
// socket offset directly from the pose on screen: it asks "where must the item
// sit for its grip to land in the fist and its barrel to point `dir`?" and
// writes the answer back through the same setOffset() the arrow keys use. The
// arrow keys then only have to fix the last centimetre.
const UP = new THREE.Vector3(0, 1, 0);
const fitScratch = {
  parentPos: new THREE.Vector3(), parentQuat: new THREE.Quaternion(), parentScale: new THREE.Vector3(),
  bonePos: new THREE.Vector3(), boneQuat: new THREE.Quaternion(), boneScale: new THREE.Vector3(),
  inverse: new THREE.Matrix4(), basis: new THREE.Matrix4(), euler: new THREE.Euler(),
};

/** An orthonormal basis whose +X is `a` and whose +Y leans toward `b`. */
function basisOf(a, b, out) {
  const ex = a.clone().normalize();
  const ey = b.clone().addScaledVector(ex, -b.dot(ex));
  if (ey.lengthSq() < 1e-8) ey.set(ex.y, ex.z, ex.x).addScaledVector(ex, -ex.dot(ey));
  ey.normalize();
  return out.makeBasis(ex, ey, new THREE.Vector3().crossVectors(ex, ey));
}

/**
 * @param {object} fit
 * @param {number[]} [fit.axis]   the item-space axis to aim (defaults to its barrelAxis)
 * @param {number[]} [fit.axisTo] where that axis should point, in the character's frame
 * @param {number[]} [fit.ref]    a second item-space axis (defaults to the item's +Y)
 * @param {number[]} [fit.refTo]  where that one should lean (defaults to world up)
 * @param {number[]} [fit.grip]   the item-space point that must land in the hand
 * @param {number}   [fit.palm]   metres down the hand bone from the wrist to that point
 * @param {number[]} [fit.slide]  extra shove of that point, in the character's frame
 */
function autoFit(fit = {}) {
  const name = nudgeName();
  const spec = ITEMS[name];
  const group = equipment.itemObject(name);
  const bone = boneNamed(equipment.getOffset(name, slot).bone);
  if (!group || !group.parent || !bone) return null;
  const s = fitScratch;
  group.parent.updateWorldMatrix(true, false);
  group.parent.matrixWorld.decompose(s.parentPos, s.parentQuat, s.parentScale);
  bone.matrixWorld.decompose(s.bonePos, s.boneQuat, s.boneScale);

  // Orientation: the rotation that carries the item's (axis, ref) pair onto the
  // world (axisTo, refTo) pair — R = Bworld · Bitem⁻¹, both bases orthonormal.
  const item = basisOf(
    new THREE.Vector3(...(fit.axis || spec.barrelAxis || [0, 0, -1])),
    new THREE.Vector3(...(fit.ref || [0, 1, 0])), new THREE.Matrix4(),
  );
  const wanted = basisOf(
    new THREE.Vector3(...(fit.axisTo || [0, 0.09, -1])),
    new THREE.Vector3(...(fit.refTo || [0, 1, 0])), s.basis,
  );
  const worldQuat = new THREE.Quaternion()
    .setFromRotationMatrix(wanted.multiply(item.transpose()));

  // Position: the grip point lands `palm` metres down the hand bone from the wrist.
  const grip = new THREE.Vector3(...(fit.grip || [0, 0, 0]));
  const palm = new THREE.Vector3(0, 1, 0).applyQuaternion(s.boneQuat).multiplyScalar(fit.palm ?? 0);
  const slide = new THREE.Vector3(...(fit.slide || [0, 0, 0]));
  const worldPos = s.bonePos.clone().add(palm).add(slide).sub(grip.clone().applyQuaternion(worldQuat));

  const localPos = worldPos.applyMatrix4(s.inverse.copy(group.parent.matrixWorld).invert());
  const localQuat = s.parentQuat.clone().invert().multiply(worldQuat);
  s.euler.setFromQuaternion(localQuat, 'XYZ');
  const position = [localPos.x, localPos.y, localPos.z].map((v) => Number(v.toFixed(4)));
  const rotation = [s.euler.x, s.euler.y, s.euler.z].map((v) => Number((v * 180 / Math.PI).toFixed(2)));
  equipment.setOffset(name, position, rotation, slot);
  refreshCalibration();
  return { item: name, position, rotation };
}

function boneNamed(name) {
  const skeleton = character.skeleton;
  if (!skeleton) return null;
  return skeleton.bones.find((b) => b.name === name) || null;
}

/** The block to paste into public/models/props/equipment-sockets.json —
 *  one line per item, which is how that file is written. */
function calibrationJSON() {
  const block = equipment.exportCalibration();
  const round = (values, places) => `[${values.map((v) => Number(v.toFixed(places))).join(', ')}]`;
  const table = (entries) => Object.keys(entries).map((name) =>
    `        "${name}": { "position": ${round(entries[name].position, 4)}, `
    + `"rotation": ${round(entries[name].rotation, 2)} }`).join(',\n');
  return [
    `    "${RIG}": {`,
    `      "bones": ${JSON.stringify(block.bones)},`,
    '      "items": {', table(block.items), '      },',
    '      "holster": {', table(block.holster), '      }',
    '    },',
  ].join('\n');
}

function refreshCalibration() {
  if (document.body.classList.contains('clean')) return;
  const offset = currentOffset();
  const p = offset.position.map((v) => v.toFixed(4).padStart(8)).join(' ');
  const r = offset.rotation.map((v) => v.toFixed(2).padStart(7)).join(' ');
  calibPanel.textContent = [
    `RIG    ${RIG}   SLOT ${slot}`,
    `NUDGE  ${nudgeName()}   (bone ${offset.bone}${offset.calibrated ? '' : ', UNCALIBRATED'})`,
    `pos    ${p}`,
    `rot    ${r}`,
    '',
    calibrationJSON(),
  ].join('\n');
}

// ---------------------------------------------------------------------- input

const keys = new Set();
addEventListener('keydown', (event) => {
  keys.add(event.code);
  if (event.repeat && !/^Arrow|^Page|^Key[QERFZX]$/.test(event.code)) return;
  const coarse = event.shiftKey ? 5 : event.altKey ? 0.2 : 1;
  const cm = 0.01 * coarse;
  const dg = 5 * coarse;
  switch (event.code) {
    case 'Digit1': equipment.equip('rifle-laser'); break;
    case 'Digit2': equipment.equip('sidearm-pistol'); break;
    case 'Digit3': equipment.equip('mining-laser-tool'); break;
    case 'Digit0': equipment.unequip(); break;
    case 'KeyB': equipment.worn.includes('backpack-life-support')
      ? equipment.unequip('backpack-life-support') : equipment.equip('backpack-life-support'); break;
    case 'KeyH': equipment.worn.includes('helmet-standalone')
      ? equipment.unequip('helmet-standalone') : equipment.equip('helmet-standalone'); break;
    case 'KeyG': equipment.holster(!equipment.holstered); break;
    case 'KeyA': sim.aiming = !sim.aiming; break;
    case 'KeyV': sim.view = sim.view === 'first' ? 'side' : 'first'; break;
    case 'KeyT': target.visible = !target.visible; break;
    case 'BracketLeft': nudgeIndex = (nudgeIndex + NUDGE_ITEMS.length - 1) % NUDGE_ITEMS.length; break;
    case 'BracketRight': nudgeIndex = (nudgeIndex + 1) % NUDGE_ITEMS.length; break;
    case 'KeyN': slot = slot === 'hand' ? 'holster' : 'hand'; break;
    case 'KeyP': console.log(calibrationJSON()); break;
    case 'KeyC': navigator.clipboard?.writeText(calibrationJSON()); break;
    // ±1 cm along the socket bone's own axes
    case 'ArrowLeft': nudge(0, -cm, false); break;
    case 'ArrowRight': nudge(0, +cm, false); break;
    case 'ArrowUp': nudge(1, +cm, false); break;
    case 'ArrowDown': nudge(1, -cm, false); break;
    case 'PageUp': nudge(2, +cm, false); break;
    case 'PageDown': nudge(2, -cm, false); break;
    // ±5° about those axes
    case 'KeyQ': nudge(0, -dg, true); break;
    case 'KeyE': nudge(0, +dg, true); break;
    case 'KeyR': nudge(1, +dg, true); break;
    case 'KeyF': nudge(1, -dg, true); break;
    case 'KeyZ': nudge(2, -dg, true); break;
    case 'KeyX': nudge(2, +dg, true); break;
    default: break;
  }
  if (['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Tab'].includes(event.code)) {
    event.preventDefault();
  }
  refreshCalibration();
});
addEventListener('keyup', (event) => keys.delete(event.code));
addEventListener('blur', () => keys.clear());

let dragging = false;
canvas.addEventListener('pointerdown', (event) => { dragging = true; canvas.setPointerCapture(event.pointerId); });
canvas.addEventListener('pointerup', () => { dragging = false; });
canvas.addEventListener('pointermove', (event) => {
  if (!dragging) return;
  sim.yaw -= event.movementX * 0.006;
  sim.pitch = Math.max(-1.2, Math.min(1.2, sim.pitch - event.movementY * 0.006));
});
canvas.addEventListener('wheel', (event) => {
  sim.distance = Math.max(0.35, Math.min(14, sim.distance * (1 + event.deltaY * 0.001)));
  event.preventDefault();
}, { passive: false });

// ------------------------------------------------------------------- the frame

const renderOrigin = new THREE.Vector3();
const eye = new THREE.Vector3();
const look = new THREE.Vector3();
const lookLocal = new THREE.Vector3();
const FIRST_PERSON_AIM = new THREE.Vector3(0, -0.1, -6);
const handWorld = new THREE.Vector3();
const lookQuaternion = new THREE.Quaternion();
const PHASE = params.has('phase') ? Number(params.get('phase')) : null;

let frozen = false;
let paused = false;

function step(dt) {
  // Frozen: the pose stops dead so a calibration pass fits every item against
  // one and the same frame (the offsets are relative to a moving bone, so a
  // drifting pose would give each item a slightly different answer).
  if (frozen) dt = 0;
  sim.firing = params.has('fire') || keys.has('Space');
  input.aiming = equipment.aimingInput();
  if (!sim.aiming) input.aiming = 'none';
  // Empty hands still hold the aim pose, so the socket can be judged against it.
  else if (input.aiming === 'none') input.aiming = 'rifle';
  input.speed = 0;

  // The equipment resolves the fire rate / heat and hands the character a
  // one-frame `firing` pulse per round — exactly the wiring main.js will use.
  equipment.update(dt, {
    aiming: sim.aiming,
    firing: sim.firing && sim.aiming,
    targetWorldPoint: TARGET_POINT,
  });
  input.firing = equipment.firingInput();
  character.update(dt, input);

  if (PHASE !== null && character.actions && character.actions.aim) {
    const action = character.actions.aim;
    action.time = PHASE * action.getClip().duration;
    character.mixer.update(0);
  }

  characterCamera.update(dt, lookQuaternion);
  placeCamera();
}

function placeCamera() {
  const view = sim.view;
  if (view === 'first') {
    // The head has to go, or the camera sits inside it (character.js does the
    // same through CharacterCamera.setMode('first')).
    character.setHeadHidden(true);
    character.eyeWorldPosition(eye);
    eye.z -= 0.08;
    look.copy(eye).add(FIRST_PERSON_AIM);
    camera.fov = num('fov', 62);
  } else {
    character.setHeadHidden(false);
    // Presets orbit the chest; the mouse adds to them.
    const preset = {
      side: [Math.PI / 2, 0.06], front: [Math.PI, 0.06], back: [0, 0.06],
      top: [Math.PI / 2, 1.05], hand: [Math.PI / 2.4, 0.12],
    }[view] || [Math.PI / 2, 0.06];
    const yaw = preset[0] + sim.yaw;
    const pitch = preset[1] + sim.pitch;
    const distance = view === 'hand' ? Math.min(sim.distance, 1.25) : sim.distance;
    look.set(0, sim.height, -num('lookz', 0));
    if (view === 'hand') {
      const bone = handBone();
      if (bone) { bone.getWorldPosition(handWorld); look.copy(handWorld).add(renderOrigin); }
    }
    eye.set(
      look.x + Math.sin(yaw) * Math.cos(pitch) * distance,
      look.y + Math.sin(pitch) * distance,
      look.z + Math.cos(yaw) * Math.cos(pitch) * distance,
    );
    camera.fov = num('fov', 42);
  }
  renderOrigin.copy(eye);
  camera.position.set(0, 0, 0);
  camera.lookAt(lookLocal.copy(look).sub(renderOrigin));
  camera.updateProjectionMatrix();
}

let cachedHand = null;
function handBone() {
  if (cachedHand && cachedHand.parent) return cachedHand;
  const skeleton = character.skeleton;
  if (!skeleton) return null;
  cachedHand = skeleton.bones.find((bone) => bone.name === 'RightHand') || null;
  return cachedHand;
}

function resize() {
  const width = Math.floor(innerWidth), height = Math.floor(innerHeight);
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

const bar = (value, hot) => {
  const width = Math.round(Math.max(0, Math.min(1, value)) * 90);
  return `<span class="barbg"><span class="bar${hot ? ' hot' : ''}" style="width:${width}px"></span></span>`;
};

let lastReadout = 0;
function updateReadout(time) {
  if (time - lastReadout < 140 || document.body.classList.contains('clean')) return;
  lastReadout = time;
  const item = equipment.equipped;
  readout.innerHTML = [
    `RIG     <b>${RIG}</b> ${character.ready ? '' : '<span class="dim">(loading)</span>'}`,
    `ITEM    <b>${item || '—'}</b>${equipment.holstered ? ' <span class="dim">(slung)</span>' : ''}`,
    `WORN    ${equipment.worn.join(', ') || '—'}`,
    `STATE   <b>${character.state}</b> · clip ${character.clipName || '—'}`,
    `AIM     ${input.aiming}${sim.firing ? ' · TRIGGER' : ''}`,
    `HEAT    ${bar(equipment.heat, equipment.overheated)} ${(equipment.heat * 100).toFixed(0)} %`
      + `${equipment.overheated ? ` <span class="warn">OVERHEAT ${equipment.lockout.toFixed(1)} s</span>` : ''}`,
    `BEAM    ${equipment.beaming ? 'on' : 'off'} · mined ${mined.toFixed(2)} m³`,
    `HITS    ${hits} · last ${lastHit}`,
    `CAMERA  ${sim.view} · ${sim.distance.toFixed(2)} m · fov ${camera.fov.toFixed(0)}°`,
    equipment.error ? `<span class="warn">${equipment.error}</span>` : '',
  ].join('\n');
}

let last = null;
function frame(time) {
  requestAnimationFrame(frame);
  const dt = last === null ? 0 : Math.min(0.05, (time - last) / 1000);
  last = time;
  if (dt > 0 && !paused) step(dt);

  character.placeCameraRelative(renderOrigin);
  world.position.copy(renderOrigin).negate();

  renderer.render(scene, camera);
  updateReadout(time);
}

const warm = Number(params.get('warm') || 0);
// `ready` waits for the GLBs too: equipment.readyPromise only covers the
// calibration file, and a screenshot taken before the item lands is a blank hand.
Promise.all([character.readyPromise, equipment.readyPromise, ...pending]).then(() => {
  refreshCalibration();
  if (warm > 0) for (let t = 0; t < warm; t += 1 / 60) step(1 / 60);
  window.equipmentDev.ready = true;
});
requestAnimationFrame(frame);

window.equipmentDev = {
  ready: false,
  RIG,
  get state() {
    return {
      ready: character.ready && !!equipment.sockets,
      rig: RIG,
      error: character.error || equipment.error,
      equipped: equipment.equipped,
      holstered: equipment.holstered,
      worn: equipment.worn,
      characterState: character.state,
      clip: character.clipName,
      aiming: input.aiming,
      firing: sim.firing,
      heat: equipment.heat,
      overheated: equipment.overheated,
      beaming: equipment.beaming,
      hits,
      mined,
      muzzle: equipment.muzzleWorldPosition(new THREE.Vector3())?.toArray() || null,
      barrel: equipment.muzzleWorldDirection(new THREE.Vector3())?.toArray() || null,
      leftHand: equipment.leftHandTargetWorld(new THREE.Vector3())?.toArray() || null,
      offset: currentOffset(),
      nudging: nudgeName(),
      slot,
    };
  },
  get equipment() { return equipment; },
  get character() { return character; },
  calibrationJSON,
  autoFit,
  freeze: (on = true) => { frozen = Boolean(on); },
  // Stop the rAF loop from stepping so a caller can drive `step()` by hand and
  // land a screenshot on an exact frame of a 60 ms muzzle flash.
  pause: (on = true) => { paused = Boolean(on); },
  get frozen() { return frozen; },
  select: (item, which = 'hand') => {
    const index = NUDGE_ITEMS.indexOf(item);
    if (index !== -1) nudgeIndex = index;
    slot = which;
    refreshCalibration();
  },
  setOffset: (item, position, rotation, which = 'hand') => {
    equipment.setOffset(item, position, rotation, which);
    refreshCalibration();
  },
  press: (code, modifiers = {}) => dispatchEvent(new KeyboardEvent('keydown', { code, ...modifiers })),
  release: (code) => dispatchEvent(new KeyboardEvent('keyup', { code })),
  setView: (view, distance, height) => {
    sim.view = view;
    if (distance) sim.distance = distance;
    if (height !== undefined) sim.height = height;
  },
  step,
};
