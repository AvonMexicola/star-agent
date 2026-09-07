import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Character } from './character.js';
import { Equipment } from './equipment.js';
import { PLAYER_AVATAR } from './player-avatar.js';
import { createLighting } from './lighting.js';
import './avatar-studio.css';

const $ = id => document.getElementById(id), params = new URLSearchParams(location.search);
const rig = params.get('rig') === 'player-male' ? 'player-male' : PLAYER_AVATAR.rig;
$('avatar-model').value = rig;
const renderer = new THREE.WebGLRenderer({ canvas: $('avatar-canvas'), antialias: true, logarithmicDepthBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1;
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x071019);
const camera = new THREE.PerspectiveCamera(42, 1, .02, 600);
const orbit = new OrbitControls(camera, renderer.domElement);
orbit.target.set(0, .95, 0); orbit.minDistance = .35; orbit.maxDistance = 7; orbit.enableDamping = true;
const light = createLighting(renderer, scene);
light.update(new THREE.Vector3(0, 1, 0), new THREE.Vector3(-.5, .75, -.65).normalize(), 0);
Object.assign(light.sun.shadow.camera, { left: -3, right: 3, top: 4, bottom: -2 });
light.sun.shadow.camera.updateProjectionMatrix(); light.sun.shadow.normalBias = .008;
const floor = new THREE.Mesh(new THREE.CircleGeometry(8, 96), new THREE.MeshStandardMaterial({ color: 0x80979f, roughness: .85, metalness: .05 }));
floor.rotation.x = -Math.PI / 2; floor.position.y = -.002; floor.receiveShadow = true; scene.add(floor);
const character = new Character(scene, { url: `/models/props/${rig}.glb`, modelYaw: Math.PI, placeholder: false });
character.setWorldPose(new THREE.Vector3(), new THREE.Quaternion());
const equipment = new Equipment(character, scene, { rig, camera });
const target = new THREE.Vector3(0, 1.35, -6), direction = new THREE.Vector3(0, 0, -1);
const input = { speed: 0, grounded: true, health: 1, aiming: 'none' };
let motion = 'idle', paused = false, firing = false, jumping = 0, itemPending = false;

function view(name) {
  const presets = { front: [.5, 1.15, -3.55], side: [3.45, 1.2, -.3], back: [.6, 1.2, 3.55], hands: [1.15, 1.45, -1.25] };
  if (!presets[name]) name = 'front';
  const preset = presets[name];
  orbit.target.set(name === 'hands' ? .08 : 0, name === 'hands' ? 1.3 : .95, name === 'hands' ? -.3 : 0);
  camera.position.set(...preset); orbit.update();
  document.querySelectorAll('[data-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.view === name)));
}
document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => view(button.dataset.view)));
view(params.get('view') || 'front');
$('avatar-model').addEventListener('change', event => { location.href = `?rig=${event.target.value}`; });
$('avatar-motion').addEventListener('change', event => { motion = event.target.value; input.health = motion === 'wounded' ? .3 : 1; });
document.querySelectorAll('[data-gesture]').forEach(button => button.addEventListener('click', () => {
  if (button.dataset.gesture === 'jump') jumping = character.actions.jump?.getClip().duration || 1;
  else { motion = 'idle'; $('avatar-motion').value = motion; character.setState('idle'); character.playGesture(button.dataset.gesture); }
}));
$('avatar-equipment').addEventListener('change', async event => {
  itemPending = true; firing = false;
  if (event.target.value === 'none') equipment.unequip(); else await equipment.equip(event.target.value);
  itemPending = false;
  for (const id of ['avatar-fire', 'avatar-holster']) $(id).disabled = !equipment.equipped;
  $('avatar-reload').disabled = !equipment.item?.fireClip;
  $('avatar-holster').setAttribute('aria-pressed', 'false');
});
$('avatar-aim').addEventListener('input', event => { $('aim-output').value = `${event.target.value}°`; });
$('avatar-holster').addEventListener('click', () => { equipment.holster(!equipment.holstered); $('avatar-holster').setAttribute('aria-pressed', String(equipment.holstered)); });
$('avatar-reload').addEventListener('click', () => character.playGesture(equipment.equipped === 'sidearm-pistol' ? 'reload-pistol' : 'reload-rifle'));
$('avatar-pause').addEventListener('click', () => { paused = !paused; $('avatar-pause').textContent = paused ? 'Resume' : 'Pause'; });
const stopFire = () => { firing = false; };
$('avatar-fire').addEventListener('pointerdown', event => { firing = true; event.target.setPointerCapture(event.pointerId); });
for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) $('avatar-fire').addEventListener(event, stopFire);
$('avatar-fire').addEventListener('keydown', event => { if (['Space', 'Enter'].includes(event.code)) { event.preventDefault(); firing = true; } });
$('avatar-fire').addEventListener('keyup', stopFire); addEventListener('blur', stopFire); document.addEventListener('visibilitychange', stopFire);
const resize = () => {
  const box = renderer.domElement.parentElement.getBoundingClientRect(); renderer.setSize(box.width, box.height, false);
  camera.aspect = box.width / box.height; camera.updateProjectionMatrix();
};
new ResizeObserver(resize).observe(renderer.domElement.parentElement); resize();

await character.readyPromise;
if (character.error) $('avatar-status').textContent = character.error;
else {
  const manifest = await fetch('/models/props/manifest.json').then(response => response.json());
  const entry = manifest.find(row => row.name === rig);
  $('avatar-spec').textContent = `${entry.tris.toLocaleString()} triangles · ${entry.texture_size / 1024}K textures\n${entry.animations.length} clips · ${entry.height_m.toFixed(2)} m`;
  for (const button of document.querySelectorAll('[data-gesture]')) {
    const key = button.dataset.gesture === 'hit' ? 'take-damage' : button.dataset.gesture;
    button.disabled = character.clipInfo[key]?.fallback === true;
  }
}
let last = performance.now(), auditAt = 0, frames = 0, totalMs = 0;
function frame(time) {
  requestAnimationFrame(frame); const elapsed = Math.min(.05, (time - last) / 1000); last = time;
  if (document.hidden) return;
  const dt = paused ? 0 : elapsed;
  const pitch = THREE.MathUtils.degToRad(Number($('avatar-aim').value)); direction.set(0, Math.sin(pitch), -Math.cos(pitch));
  target.copy(direction).multiplyScalar(6).add(new THREE.Vector3(0, 1.35, 0));
  input.speed = ({ walk: 1.4, run: 4.5, crouch: .8, carry: .7, wounded: .8 })[motion] || 0;
  input.crouching = motion === 'crouch'; input.carrying = motion === 'carry';
  input.seated = motion === 'sit'; input.resting = motion === 'rest';
  input.climbing = motion === 'climb' || motion === 'climb-idle'; input.climbSpeed = motion === 'climb' ? .344 : 0;
  input.jumping = jumping > 0; jumping = Math.max(0, jumping - dt);
  input.aiming = equipment.aimingInput(); input.firing = equipment.firingInput();
  character.update(dt, input);
  const wave = character.gestureActive === 'wave';
  if (wave && !equipment.holstered) { equipment.holster(true); $('avatar-holster').setAttribute('aria-pressed', 'true'); }
  equipment.aimHeld(direction);
  equipment.update(dt, { firing: firing && !character.gestureActive, hasHit: true, targetWorldPoint: target });
  orbit.update(); renderer.render(scene, camera);
  frames++; totalMs += elapsed * 1000;
  if (time - auditAt > 250) {
    auditAt = time;
    $('motion-caption').textContent = character.transition || character.state.replaceAll('-', ' ');
    $('avatar-audit').textContent = `${character.clipName}\n${renderer.info.render.calls} draw calls\n${renderer.info.render.triangles.toLocaleString()} rendered triangles\n${(totalMs / frames).toFixed(1)} ms / frame\n${character.missingClips.length} fallback clips\n${JSON.stringify(character.weights, null, 2)}`;
    $('avatar-status').textContent = character.error || equipment.error || (itemPending ? 'Preparing equipment…' : '');
  }
}
requestAnimationFrame(frame);
window.avatarStudio = { character, equipment, renderer, camera, scene, input,
  get state() { return { ready: character.ready, error: character.error || equipment.error, rig, motion, characterState: character.state, transition: character.transition, equipment: equipment.equipped, missingClips: character.missingClips, weights: character.weights, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles }; } };
