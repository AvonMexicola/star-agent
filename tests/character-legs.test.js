import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { AvatarGLB } from '../blender/avatar-glb.mjs';
import { correctLegRig } from '../blender/avatar-legs.mjs';
import { loadAsset } from './avatar-fixture.js';

const position = bone => bone.getWorldPosition(new THREE.Vector3());
const rotation = bone => bone.getWorldQuaternion(new THREE.Quaternion()).normalize();
const parse = glb => {
  const bytes = glb.bytes({ materials: false });
  return new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
};

test('expedition hips articulate at the suit hip seams, with full-length thighs', async () => {
  const gltf = await loadAsset('/models/props/player-expedition.glb'); gltf.scene.updateMatrixWorld(true);
  for (const side of ['Left', 'Right']) {
    const hip = position(gltf.scene.getObjectByName(`${side}UpLeg`));
    const knee = position(gltf.scene.getObjectByName(`${side}Leg`));
    const ankle = position(gltf.scene.getObjectByName(`${side}Foot`));
    assert.ok(hip.y > .98 && hip.y < 1.03, `${side} hip is above the ceramic thigh, not inside it (${hip.y} m)`);
    assert.ok(knee.y > .55 && knee.y < .62, 'the hinge remains in the authored knee joint');
    const thigh = hip.distanceTo(knee), shin = knee.distanceTo(ankle);
    assert.ok(thigh / shin > .9 && thigh / shin < 1.1, 'thigh and shin lengths fit this suit');
  }
});

test('leg animation tracks remain continuous through straight knees and looping gaits', () => {
  const glb = new AvatarGLB(new URL('../public/models/props/player-expedition.glb', import.meta.url));
  for (const clip of glb.json.animations) for (const channel of clip.channels) {
    const name = glb.json.nodes[channel.target.node].name;
    if (channel.target.path !== 'rotation' || !/^(Left|Right)(UpLeg|Leg|Foot)$/.test(name)) continue;
    const sampler = clip.samplers[channel.sampler], values = glb.rows(sampler.output), times = glb.rows(sampler.input);
    for (let i = 1; i < values.length; i++) {
      const dt = times[i][0] - times[i - 1][0];
      const before = new THREE.Quaternion().fromArray(values[i - 1]).normalize();
      const after = new THREE.Quaternion().fromArray(values[i]).normalize();
      // Source running peaks at 1,265 degrees/second; the corrected suite must
      // not introduce a faster hinge reversal (24 degrees per 60 Hz frame).
      assert.ok(before.angleTo(after) <= THREE.MathUtils.degToRad(1440) * dt + 1e-5,
        `${clip.name}/${name}: unexpected knee-plane flip at ${times[i][0]}`);
    }
  }
});

test('leg rebuild preserves the bind surface and original soles and upper body throughout the source animations', async () => {
  const glb = new AvatarGLB(new URL('../assets/character/expedition-v2/meshy-20-motions.glb', import.meta.url));
  const before = await parse(glb);
  const geometry = glb.json.meshes.map(mesh => mesh.primitives.map(p => Object.fromEntries(
    Object.entries(p.attributes).map(([key, index]) => [key, glb.rows(index)]))));
  await correctLegRig(glb);
  const after = await parse(glb);
  assert.deepEqual(glb.json.meshes.map(mesh => mesh.primitives.map(p => Object.fromEntries(
    Object.entries(p.attributes).map(([key, index]) => [key, glb.rows(index)])))), geometry,
  'positions, normals, UVs and skin weights are untouched');

  const meshes = gltf => { const result = []; gltf.scene.traverse(mesh => { if (mesh.isSkinnedMesh) result.push(mesh); }); return result; };
  const oldMeshes = meshes(before), newMeshes = meshes(after), a = new THREE.Vector3(), b = new THREE.Vector3();
  before.scene.updateMatrixWorld(true); after.scene.updateMatrixWorld(true);
  for (let m = 0; m < oldMeshes.length; m++) for (let i = 0; i < oldMeshes[m].geometry.attributes.position.count; i++) {
    oldMeshes[m].getVertexPosition(i, a).applyMatrix4(oldMeshes[m].matrixWorld);
    newMeshes[m].getVertexPosition(i, b).applyMatrix4(newMeshes[m].matrixWorld);
    assert.ok(a.distanceTo(b) < 2e-6, 'rebinding cannot change the authored resting surface');
  }

  const oldMixer = new THREE.AnimationMixer(before.scene), newMixer = new THREE.AnimationMixer(after.scene);
  const upperNames = [];
  before.scene.traverse(bone => { if (bone.isBone && !/^(Left|Right)(UpLeg|Leg|Foot|ToeBase)$/.test(bone.name)) upperNames.push(bone.name); });
  for (const clip of before.animations) {
    oldMixer.stopAllAction(); newMixer.stopAllAction();
    for (const [mixer, gltf] of [[oldMixer, before], [newMixer, after]]) {
      const action = mixer.clipAction(gltf.animations.find(c => c.name === clip.name)).setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true; action.reset().play();
    }
    for (let frame = 0; frame <= 24; frame++) {
      const t = clip.duration * frame / 24;
      oldMixer.setTime(t); newMixer.setTime(t); before.scene.updateMatrixWorld(true); after.scene.updateMatrixWorld(true);
      for (const side of ['Left', 'Right']) for (const joint of ['Foot', 'ToeBase']) {
        const source = before.scene.getObjectByName(side + joint), target = after.scene.getObjectByName(side + joint);
        const error = position(source).distanceTo(position(target));
        assert.ok(error < .003, `${clip.name}/${side}${joint}: source foot arc retained within 3 mm (${error})`);
        assert.ok(rotation(source).angleTo(rotation(target)) < .015, 'retargeting preserves the sole angle');
      }
      for (const name of upperNames) {
        const source = before.scene.getObjectByName(name), target = after.scene.getObjectByName(name);
        assert.ok(position(source).distanceTo(position(target)) < 2e-6, `${clip.name}/${name}: upper-body position unchanged`);
        assert.ok(rotation(source).angleTo(rotation(target)) < 2e-6, `${clip.name}/${name}: upper-body rotation unchanged`);
      }
    }
  }
});
