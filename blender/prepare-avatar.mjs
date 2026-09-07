/** Rebuild the offline expedition character from the retained Meshy exports.
 * node blender/prepare-avatar.mjs
 * Requires ImageMagick (`magick`) and the repository's existing Three.js install.
 */
import { readFileSync, writeFileSync, mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { AvatarGLB } from './avatar-glb.mjs';
import { addGripShapes } from './avatar-grips.mjs';
import { fitRifleStock } from './fit-rifle-stock.mjs';
import { addShadowIndices } from './avatar-shadow.mjs';
import { correctLegRig } from './avatar-legs.mjs';

const SOURCE = resolve('assets/character/expedition-v2');
const OUTPUT = resolve('public/models/props/player-expedition.glb');
const sha = data => createHash('sha256').update(data).digest('hex');
const rig = new AvatarGLB(join(SOURCE, 'meshy-20-motions.glb'));
const idle = new AvatarGLB(join(SOURCE, 'meshy-idle.glb'));
const materials = new AvatarGLB(join(SOURCE, 'meshy-remesh-pbr.glb'));
if (sha(rig.image(0)) !== sha(materials.image(0))) throw Error('PBR source UV/color mismatch; do not copy these maps onto this rig');
rig.importAnimation(idle, idle.json.animations[0]).name = 'Relaxed_Idle';

// Canonical Mixamo spine order, from hips to shoulders. Meshy's names run backwards.
for (const node of rig.json.nodes) node.name = ({ Spine02: 'Spine', Spine01: 'Spine1', Spine: 'Spine2', neck: 'Neck' })[node.name] || node.name;
const legRig = await correctLegRig(rig);
const hipsIndex = rig.json.nodes.findIndex(node => node.name === 'Hips');
const restHips = rig.json.nodes[hipsIndex].translation;
const sourceClips = new Map(rig.json.animations.map(animation => [animation.name, animation]));

// Load the real rig without image decoders for measuring foot placement during the build.
globalThis.self ??= globalThis;
globalThis.ProgressEvent ??= class { constructor(type, init) { this.type = type; Object.assign(this, init); } };
const bytes = rig.bytes({ materials: false });
const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
const mixer = new THREE.AnimationMixer(gltf.scene), bones = {};
gltf.scene.traverse(node => { if (node.isBone) bones[node.name] = node; });
gltf.scene.updateMatrixWorld(true);
const toeHeight = Math.min(...['LeftToeBase', 'RightToeBase'].map(name => bones[name].getWorldPosition(new THREE.Vector3()).y));
const sourceActions = new Map(gltf.animations.map(clip => {
  const action = mixer.clipAction(clip).setLoop(THREE.LoopOnce, 1);
  action.clampWhenFinished = true;
  return [clip.name, action];
}));
const FOOTED = new Set(['idle', 'wave', 'sit-down', 'sit-idle', 'stand-up', 'interact', 'take-damage', 'reload-rifle']);
const LOOPED = new Set(['idle', 'walk', 'run', 'crouch-walk', 'sit-idle', 'carry-walk', 'wounded-walk', 'climb-ladder']);
const locomotion = new Set(['walk', 'run', 'crouch-walk', 'carry-walk', 'wounded-walk']);
const records = [];

function sample(rows, times, time, quaternion = false) {
  let i = 0;
  while (i + 1 < times.length && times[i + 1][0] <= time) i++;
  if (i === rows.length - 1) return rows[i].slice();
  const t = THREE.MathUtils.clamp((time - times[i][0]) / (times[i + 1][0] - times[i][0] || 1), 0, 1);
  if (quaternion) return new THREE.Quaternion().fromArray(rows[i]).slerp(new THREE.Quaternion().fromArray(rows[i + 1]), t).normalize().toArray();
  return rows[i].map((v, j) => v + (rows[i + 1][j] - v) * t);
}

function replaceTrack(animation, channel, values, times = null) {
  const sampler = animation.samplers[channel.sampler];
  sampler.output = rig.addRows(values, rig.json.accessors[sampler.output].type);
  if (times) sampler.input = rig.addRows(times, 'SCALAR');
  sampler.interpolation = 'LINEAR';
}

function canonical(sourceName, name) {
  const source = sourceClips.get(sourceName);
  if (!source) throw Error(`Missing source motion: ${sourceName}`);
  const animation = structuredClone(source); animation.name = name;
  const rootChannel = animation.channels.find(c => c.target.node === hipsIndex && c.target.path === 'translation');
  const rootSampler = animation.samplers[rootChannel.sampler];
  const positions = rig.rows(rootSampler.output), times = rig.rows(rootSampler.input);
  const duration = times.at(-1)[0], first = positions[0].slice(), last = positions.at(-1).slice();
  const deltas = [];
  mixer.stopAllAction(); sourceActions.get(sourceName).reset().play();
  for (const [time] of times) {
    mixer.setTime(time); gltf.scene.updateMatrixWorld(true);
    const footY = Math.min(...['LeftToeBase', 'RightToeBase'].map(n => bones[n].getWorldPosition(new THREE.Vector3()).y));
    deltas.push((toeHeight - footY) * 100);
  }
  const floorCorrection = Math.max(...deltas);
  positions.forEach((position, i) => {
    const t = duration ? times[i][0] / duration : 0;
    for (const axis of [0, 2]) {
      // Preserve cyclic pelvis sway, remove travel and the source capture's offset.
      position[axis] += restHips[axis] - first[axis] - (last[axis] - first[axis]) * t;
    }
    if (name.startsWith('climb-')) position[1] -= (last[1] - first[1]) * t;
    else if (name === 'jump') position[1] = Math.min(position[1], restHips[1]);
    else if (FOOTED.has(name)) position[1] += deltas[i];
    else if (locomotion.has(name)) position[1] += floorCorrection;
  });
  replaceTrack(animation, rootChannel, positions);
  if (LOOPED.has(name)) {
    for (const channel of animation.channels) {
      const sampler = animation.samplers[channel.sampler], values = rig.rows(sampler.output), input = rig.rows(sampler.input);
      const end = input.at(-1)[0], seam = Math.min(.18, end / 5);
      for (let i = 0; i < values.length; i++) if (input[i][0] > end - seam) {
        const t = (input[i][0] - end + seam) / seam;
        values[i] = channel.target.path === 'rotation'
          ? new THREE.Quaternion().fromArray(values[i]).slerp(new THREE.Quaternion().fromArray(values[0]), t).normalize().toArray()
          : values[i].map((v, j) => v + (values[0][j] - v) * t);
      }
      replaceTrack(animation, channel, values);
    }
  }
  records.push({ name, source: sourceName, duration, inPlace: true, loop: LOOPED.has(name), footCorrection: FOOTED.has(name) ? 'per-frame grounded' : locomotion.has(name) ? 'constant sole clearance' : 'authored' });
  return animation;
}

const mappings = {
  idle: 'Relaxed_Idle', walk: 'Walking', run: 'Running', jump: 'Regular_Jump',
  'crouch-walk': 'Cautious_Crouch_Walk_Forward', 'sit-down': 'Stand_to_Sit_Transition_M',
  'sit-idle': 'Chair_Sit_Idle_M', 'stand-up': 'Sit_to_Stand_Transition_M',
  'carry-walk': 'Carry_Heavy_Object_Walk', 'wounded-walk': 'Injured_Walk',
  death: 'Shot_and_Fall_Backward', wave: 'Big_Wave_Hello', 'take-damage': 'Hit_Reaction',
  'climb-ladder': 'Ladder_Climb_Loop', 'climb-mount': 'Ladder_Mount_Start',
  'climb-finish': 'Ladder_Climb_Finish', 'reload-rifle': 'Forward_Reload_Subtle', interact: 'Collect_Object',
};
const animations = Object.entries(mappings).map(([name, source]) => canonical(source, name));

// Meshy's Idle 02 includes a raised, fidgeting hand. Keep its breathing and
// grounded legs, but author relaxed arms beside the thighs for the opening.
const relaxed = animations.find(a => a.name === 'idle');
const idleTimes = rig.rows(relaxed.samplers[0].input);
const relaxedTracks = new Map();
for (const side of ['Left', 'Right']) for (const part of ['Arm', 'ForeArm', 'Hand']) relaxedTracks.set(side + part, []);
mixer.stopAllAction(); sourceActions.get('Relaxed_Idle').reset().play();
for (const [time] of idleTimes) {
  mixer.setTime(time);
  for (const [name] of relaxedTracks) bones[name].quaternion.fromArray(rig.json.nodes.find(node => node.name === name).rotation);
  gltf.scene.updateMatrixWorld(true);
  const hips = bones.Hips.getWorldPosition(new THREE.Vector3());
  for (const side of ['Left', 'Right']) {
    const arm = bones[`${side}Arm`], hand = bones[`${side}Hand`];
    const shoulder = arm.getWorldPosition(new THREE.Vector3());
    const current = hand.getWorldPosition(new THREE.Vector3()).sub(shoulder).normalize();
    const target = hips.clone().add(new THREE.Vector3(side === 'Left' ? .29 : -.29, -.12, .015)).sub(shoulder).normalize();
    const delta = new THREE.Quaternion().setFromUnitVectors(current, target);
    const parent = arm.parent.getWorldQuaternion(new THREE.Quaternion());
    arm.quaternion.premultiply(parent.clone().invert().multiply(delta).multiply(parent));
    arm.updateWorldMatrix(false, true);
  }
  for (const [name, values] of relaxedTracks) values.push(bones[name].quaternion.toArray());
}
for (const channel of relaxed.channels) {
  const values = relaxedTracks.get(rig.json.nodes[channel.target.node].name);
  if (values && channel.target.path === 'rotation') {
    values[values.length - 1] = values[0].slice();
    replaceTrack(relaxed, channel, values, idleTimes);
  }
}
records.find(record => record.name === 'idle').derived = 'source breathing and stance with relaxed arm rotations';

function pose(source, name, at, duration = 1) {
  const result = structuredClone(source); result.name = name;
  for (const channel of result.channels) {
    const sampler = result.samplers[channel.sampler];
    const value = sample(rig.rows(sampler.output), rig.rows(sampler.input), at, channel.target.path === 'rotation');
    if (channel.target.node === hipsIndex && channel.target.path === 'translation') {
      value[0] = restHips[0]; value[2] = restHips[2];
    }
    replaceTrack(result, channel, [value, value.slice()], [[0], [duration]]);
  }
  records.push({ name, source: source.name, sampledAt: at, duration, derived: 'held pose' });
  return result;
}
const rifle = pose(sourceClips.get('Rifle_Aim_Turn_Right'), 'aim-rifle', .1);
const pistol = pose(sourceClips.get('Cowboy_Quick_Draw_Shooting'), 'aim-pistol', 2.0);
const tool = pose(rifle, 'use-tool', 0);
const rest = pose(sourceClips.get('Armature|clip0|baselayer'), 'rest-pose', 0);
const climbIdle = pose(animations.find(a => a.name === 'climb-ladder'), 'climb-idle', .4);
animations.push(rest, climbIdle, rifle, pistol, tool);

function recoil(source, name, degrees) {
  const result = pose(source, name, 0, .3);
  for (const channel of result.channels) {
    const bone = rig.json.nodes[channel.target.node].name;
    if (channel.target.path !== 'rotation' || !['RightForeArm', 'Spine1'].includes(bone)) continue;
    const base = new THREE.Quaternion().fromArray(rig.rows(result.samplers[channel.sampler].output)[0]);
    const values = [0, 1, .4, 0].map(weight => base.clone().multiply(new THREE.Quaternion()
      .setFromAxisAngle(new THREE.Vector3(1, 0, 0), THREE.MathUtils.degToRad(degrees * weight * (bone === 'Spine1' ? .2 : 1)))).normalize().toArray());
    replaceTrack(result, channel, values, [[0], [.05], [.13], [.3]]);
  }
  records.at(-1).derived = 'held pose with authored recoil';
  return result;
}
animations.push(recoil(rifle, 'fire-rifle', 4), recoil(pistol, 'fire-pistol', 7));
const pistolReload = structuredClone(animations.find(a => a.name === 'reload-rifle')); pistolReload.name = 'reload-pistol';
for (const channel of pistolReload.channels) {
  if (!/Right(Shoulder|Arm|ForeArm|Hand)$/.test(rig.json.nodes[channel.target.node].name)) continue;
  const held = pistol.channels.find(c => c.target.node === channel.target.node && c.target.path === channel.target.path);
  const sampler = pistol.samplers[held.sampler], value = rig.rows(sampler.output)[0];
  replaceTrack(pistolReload, channel, [value, value.slice()], [[0], [3.7]]);
}
records.push({ name: 'reload-pistol', source: 'Forward_Reload_Subtle + aim-pistol', duration: 3.7, derived: 'reload with sidearm firing arm held' });
animations.push(pistolReload);

// Drop redundant scale / bind translations; collapse constant quaternion tracks.
for (const animation of animations) {
  animation.channels = animation.channels.filter(channel => {
    const sampler = animation.samplers[channel.sampler], values = rig.rows(sampler.output), node = rig.json.nodes[channel.target.node];
    const constant = values.every(row => row.every((value, i) => Math.abs(value - values[0][i]) < 1e-5));
    const base = node[channel.target.path] || (channel.target.path === 'scale' ? [1, 1, 1] : [0, 0, 0]);
    if (constant && channel.target.path !== 'rotation' && channel.target.node !== hipsIndex
      && values[0].every((value, i) => Math.abs(value - base[i]) < 1e-3)) return false;
    if (constant && values.length > 2) {
      const times = rig.rows(sampler.input);
      replaceTrack(animation, channel, [values[0], values[0].slice()], [times[0], times.at(-1)]);
    }
    return true;
  });
  const old = animation.samplers; animation.samplers = [];
  for (const channel of animation.channels) { const sampler = old[channel.sampler]; channel.sampler = animation.samplers.length; animation.samplers.push(sampler); }
}
rig.json.animations = animations;
addGripShapes(rig);
// Mesh-local units are centimetres beneath Meshy's .01 armature. This generous
// envelope contains every authored motion and equipped arm pose; test it against
// the skinned vertices so distant shadow cameras can cull this expensive mesh.
for (const mesh of rig.json.meshes) mesh.extras.animationBounds = [0, 90, 0, 175];
const shadow = addShadowIndices(rig);

// The rig export mistakenly emitted the whole color texture as light and lost ORM.
// Recover the exact UV-matched PBR source; retain 2K resolution for both runtime maps.
const scratch = mkdtempSync(join(SOURCE, '.build-textures-'));
try {
  rig.json.images = []; rig.json.textures = [];
  for (let i = 0; i < 2; i++) {
    const source = join(scratch, `${i}.png`), target = join(scratch, `${i}.webp`);
    writeFileSync(source, materials.image(i));
    execFileSync('magick', [source, '-resize', '2048x2048>', '-strip', '-quality', i ? '96' : '94', target]);
    const image = rig.json.images.push({ name: i ? 'expedition-metallic-roughness' : 'expedition-base-color', mimeType: 'image/webp', bufferView: rig.addView(readFileSync(target)) }) - 1;
    rig.json.textures.push({ sampler: 0, extensions: { EXT_texture_webp: { source: image } } });
  }
} finally { rmSync(scratch, { recursive: true, force: true }); }
rig.json.samplers = [{ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 }];
rig.json.materials = [{ name: 'Expedition ceramic, fabric and visor', doubleSided: false,
  pbrMetallicRoughness: { baseColorTexture: { index: 0 }, metallicRoughnessTexture: { index: 1 }, metallicFactor: 1, roughnessFactor: 1 } }];
rig.json.extensionsUsed = ['EXT_texture_webp']; rig.json.extensionsRequired = ['EXT_texture_webp'];
rig.json.asset.extras = { provenance: 'assets/character/expedition-v2/README.md', build: 'node blender/prepare-avatar.mjs', requiredClips: animations.map(animation => animation.name) };
rig.compact(); mkdirSync(resolve('public/models/props'), { recursive: true }); rig.save(OUTPUT);
fitRifleStock(join(SOURCE, 'rifle-before.glb'), resolve('public/models/props/rifle-laser.glb'));
const report = { file: 'player-expedition.glb', sha256: sha(readFileSync(OUTPUT)), bytes: readFileSync(OUTPUT).length,
  triangles: rig.json.meshes.reduce((n, m) => n + m.primitives.reduce((sum, p) => sum + rig.json.accessors[p.indices].count / 3, 0), 0),
  joints: rig.json.skins[0].joints.length, textureSize: 2048, textureCount: 2, sourceOrmSize: 4096, height: 1.85, shadow, legRig,
  animations: records, sources: ['meshy-20-motions.glb', 'meshy-idle.glb', 'meshy-remesh-pbr.glb'].map(file => ({ file, sha256: sha(readFileSync(join(SOURCE, file))) })) };
writeFileSync(join(SOURCE, 'build.json'), JSON.stringify(report, null, 2) + '\n');
const manifestPath = resolve('public/models/props/manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath));
const entry = manifest.find(item => item.name === 'player-expedition');
Object.assign(entry, { sha256: report.sha256, file_mb: report.bytes / 1e6, shadow_triangles: shadow.triangles,
  budget: { triangles: 65000, file_mb: 9, texture_size: 2048, approval: 'Cees request, 2026-09-07; QUALITY.md §5' } });
const rifleEntry = manifest.find(item => item.name === 'rifle-laser');
const rifleBytes = readFileSync(resolve('public/models/props/rifle-laser.glb'));
Object.assign(rifleEntry, { sha256: sha(rifleBytes), file_mb: rifleBytes.length / 1e6 });
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ bytes: report.bytes, triangles: report.triangles, joints: report.joints, animations: records.length, textures: '2 × 2048 WebP' }));
