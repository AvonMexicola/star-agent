import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { AvatarGLB } from '../blender/avatar-glb.mjs';
import { Character, CLIPS } from '../src/character.js';
import { avatarFixture, loadAsset } from './avatar-fixture.js';

const asset = new AvatarGLB(new URL('../public/models/props/player-expedition.glb', import.meta.url));
const position = bone => bone.getWorldPosition(new THREE.Vector3());

test('broken optional shadow data keeps the rig usable and empty metadata cannot silence missing clips', async t => {
  const warnings = []; t.mock.method(console, 'warn', (...args) => warnings.push(args.join(' ')));
  const gltf = await loadAsset('/models/props/player-expedition.glb');
  gltf.parser.getDependency = () => Promise.reject(Error('unavailable optional accessor'));
  gltf.asset.extras.requiredClips = [];
  gltf.animations = gltf.animations.filter(clip => clip.name !== 'walk');
  const character = new Character(new THREE.Scene(), { placeholder: false, loader: { load(url, loaded) { loaded(gltf); } } });
  await character.readyPromise;
  assert.equal(character.ready, true); assert.equal(character.error, null);
  assert.ok(warnings.some(message => message.includes('missing clips walk')));
  assert.ok(warnings.some(message => message.includes('Optional shadow LOD unavailable')));
  character.update(.2, { speed: 1.4 });
  assert.equal(character.state, 'walk');
  character.dispose();
});

test('animation culling envelope contains every sampled skinned vertex and closed glove', async () => {
  const gltf = await loadAsset('/models/props/player-expedition.glb');
  const mixer = new THREE.AnimationMixer(gltf.scene), meshes = [], vertex = new THREE.Vector3();
  gltf.scene.traverse(mesh => { if (mesh.isSkinnedMesh) meshes.push(mesh); });
  for (const clip of gltf.animations) {
    mixer.stopAllAction();
    const action = mixer.clipAction(clip).setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true; action.reset().play();
    for (let frame = 0; frame <= 4; frame++) {
      mixer.setTime(clip.duration * frame / 4); gltf.scene.updateMatrixWorld(true);
      for (const mesh of meshes) {
        const [x, y, z, radius] = mesh.userData.animationBounds, center = new THREE.Vector3(x, y, z);
        mesh.morphTargetInfluences.fill(1);
        for (let i = 0; i < mesh.geometry.attributes.position.count; i++) {
          mesh.getVertexPosition(i, vertex);
          assert.ok(vertex.distanceTo(center) < radius * .9, `${clip.name} retains culling margin`);
        }
      }
    }
  }
  const { character, equipment } = await avatarFixture();
  character.model.traverse(mesh => { if (mesh.isSkinnedMesh) {
    assert.equal(mesh.frustumCulled, true);
    assert.equal(mesh.boundingSphere.radius, mesh.userData.animationBounds[3]);
    const full = mesh.geometry.index;
    mesh.onBeforeShadow();
    assert.ok(mesh.geometry.index.count / 3 <= 20000, 'shadow pass uses the compact index LOD');
    assert.notEqual(mesh.geometry.index, full);
    mesh.onAfterShadow();
    assert.equal(mesh.geometry.index, full, 'color pass restores the untouched high detail mesh');
  } });
  equipment.dispose(); character.dispose();
});

test('expedition asset contains real clips, canonical skeleton, PBR maps and localized glove shapes', async () => {
  const gltf = await loadAsset('/models/props/player-expedition.glb');
  assert.deepEqual(gltf.animations.map(c => c.name).sort(), [...CLIPS].sort());
  assert.deepEqual(gltf.asset.extras.requiredClips.sort(), [...CLIPS].sort());
  assert.equal(asset.json.skins[0].joints.length, 24);
  const chest = gltf.scene.getObjectByName('Spine2');
  assert.equal(chest.parent.name, 'Spine1');
  assert.equal(chest.parent.parent.name, 'Spine');
  const material = asset.json.materials[0];
  assert.ok(material.pbrMetallicRoughness.metallicRoughnessTexture);
  assert.equal(material.emissiveTexture, undefined, 'armor reflects its scene lighting');
  assert.equal(asset.json.images.length, 2);
  for (const image of asset.json.images) assert.equal(image.mimeType, 'image/webp');
  const report = JSON.parse(readFileSync(new URL('../assets/character/expedition-v2/build.json', import.meta.url)));
  assert.equal(report.textureSize, 2048);
  assert.ok(report.triangles > 60000 && report.triangles < 65000);
  for (const mesh of asset.json.meshes) for (const primitive of mesh.primitives) {
    assert.deepEqual(mesh.extras.targetNames, ['GripRight', 'GripLeft']);
    const joints = asset.rows(primitive.attributes.JOINTS_0), weights = asset.rows(primitive.attributes.WEIGHTS_0);
    for (const [index, side] of ['Right', 'Left'].entries()) {
      const joint = asset.json.skins[0].joints.findIndex(i => asset.json.nodes[i].name === `${side}Hand`);
      let moved = 0;
      for (const [i, delta] of asset.rows(primitive.targets[index].POSITION).entries()) {
        const distance = Math.hypot(...delta);
        assert.ok(distance < .18 && Number.isFinite(distance), 'glove shape has bounded displacement');
        if (distance < 1e-6) continue;
        moved++;
        assert.ok(joints[i].some((j, c) => j === joint && weights[i][c] > .8), 'only the intended glove moves');
      }
      assert.ok(moved > 300, 'the target curls actual finger geometry');
    }
  }
});

test('relaxed idle and locomotion loops close without root travel or foot pops', async () => {
  const gltf = await loadAsset('/models/props/player-expedition.glb'), mixer = new THREE.AnimationMixer(gltf.scene);
  for (const name of ['idle', 'walk', 'run', 'crouch-walk', 'carry-walk', 'wounded-walk', 'sit-idle', 'climb-ladder']) {
    mixer.stopAllAction();
    const clip = gltf.animations.find(c => c.name === name), action = mixer.clipAction(clip).setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true; action.reset().play();
    const first = new Map();
    for (let i = 0; i <= 120; i++) {
      mixer.setTime(clip.duration * i / 120); gltf.scene.updateMatrixWorld(true);
      const hips = position(gltf.scene.getObjectByName('Hips'));
      if (name === 'idle') for (const side of ['Left', 'Right']) {
        const hand = position(gltf.scene.getObjectByName(`${side}Hand`));
        assert.ok(hand.y - hips.y < .14, 'idle wrists remain relaxed by the pelvis');
        assert.ok(Math.hypot(hand.x - hips.x, hand.z - hips.z) < .36, 'idle arms stay beside the body');
      }
      gltf.scene.traverse(bone => {
        if (!bone.isBone) return;
        if (i === 0) first.set(bone.name, { q: bone.quaternion.clone(), p: position(bone) });
        if (i === 120) {
          const start = first.get(bone.name);
          assert.ok(start.q.angleTo(bone.quaternion) < .002, `${name}/${bone.name} rotation closes`);
          assert.ok(start.p.distanceTo(position(bone)) < .002, `${name}/${bone.name} position closes`);
        }
      });
    }
  }
});

test('actual rig grips and barrel stay aligned through gait, aim, and camera-relative EVA rotation', async () => {
  const { scene, character, equipment } = await avatarFixture();
  const origin = new THREE.Vector3(25e9, -1e9, 8e9);
  const attitude = new THREE.Quaternion().setFromEuler(new THREE.Euler(.25, .8, .4));
  character.setWorldPose(origin.clone().add(new THREE.Vector3(1, 2, 3)), attitude);
  character.placeCameraRelative(origin); equipment.setRenderOrigin(origin);
  for (const item of ['rifle-laser', 'sidearm-pistol', 'mining-laser-tool']) {
    await equipment.equip(item);
    for (const speed of [0, 1.4, 4.5]) for (const degrees of [-55, 0, 65]) {
      const angle = THREE.MathUtils.degToRad(degrees);
      const direction = new THREE.Vector3(0, Math.sin(angle), -Math.cos(angle)).applyQuaternion(attitude);
      for (let frame = 0; frame < 40; frame++) {
        character.update(1 / 60, { speed, aiming: equipment.aimingInput() });
        scene.updateMatrixWorld(true); equipment.aimHeld(direction);
        assert.ok(equipment.muzzleWorldDirection().dot(direction) > .99999, 'barrel follows aim');
        for (const side of ['Right', 'Left']) {
          const bone = character.model.getObjectByName(`${side}Hand`);
          const palm = new THREE.Vector3(side === 'Right' ? .007 : -.007, .107, 0)
            .applyQuaternion(bone.getWorldQuaternion(new THREE.Quaternion())).add(position(bone));
          const target = side === 'Right' ? equipment.itemObject(item).getWorldPosition(new THREE.Vector3())
            : equipment.leftHandTargetWorld()?.sub(origin);
          if (target) assert.ok(palm.distanceTo(target) < .003, `${item}/${side} glove holds its grip within 3 mm`);
        }
      }
      character.model.traverse(mesh => { if (mesh.isSkinnedMesh) {
        const vertex = new THREE.Vector3();
        for (let i = 0; i < mesh.geometry.attributes.position.count; i++) {
          mesh.getVertexPosition(i, vertex);
          assert.ok(mesh.boundingSphere.containsPoint(vertex), 'equipped aim remains inside the culling envelope');
        }
      } });
    }
  }
  equipment.dispose(); character.dispose();
});

test('gestures, damage, seats and traversal return control to the animation state machine', async () => {
  const { character, equipment } = await avatarFixture();
  const advance = (seconds, input) => { for (let t = 0; t < seconds; t += .02) character.update(.02, input); };
  advance(.4, { speed: 0, health: 1 });
  assert.equal(character.playGesture('wave'), true); advance(.1, { speed: 0 }); assert.equal(character.state, 'wave');
  advance(.1, { speed: 2 }); assert.equal(character.state, 'walk', 'walking cancels a wave');
  character.update(.02, { health: .8, speed: 0 }); assert.equal(character.state, 'hit');
  advance(2, { health: .8, speed: 0 }); assert.equal(character.state, 'idle');
  advance(5.2, { seated: true }); assert.equal(character.state, 'sit'); assert.equal(character.transition, null);
  advance(6.7, { seated: false }); assert.equal(character.state, 'idle'); assert.equal(character.transition, null);
  advance(.5, { climbing: true, climbSpeed: .344 }); assert.equal(character.state, 'climb');
  advance(.5, { climbing: true, climbSpeed: 0 }); assert.ok(character.weights['climb-idle'] > .99);
  advance(.5, { climbing: false }); assert.equal(character.state, 'idle');
  advance(.5, { dead: true }); assert.equal(character.state, 'dead'); assert.equal(character.playGesture('wave'), false);
  equipment.dispose(); character.dispose();
});

test('saved health is a baseline and repeated hits cannot freeze moving legs', async () => {
  const { character, equipment } = await avatarFixture();
  for (let i = 0; i < 30; i++) character.update(.02, { speed: 0 }); // opening has no health input
  character.update(.02, { health: .8, speed: 0 });
  assert.equal(character.state, 'idle', 'loading an injury is not a new damage event');
  character.update(.02, { health: .79, speed: 0 }); assert.equal(character.gestureActive, 'hit');
  const action = character.actions['take-damage'];
  for (let i = 0; i < 20; i++) character.update(.02, { health: .78 - i * .001, speed: 0 });
  assert.ok(action.time > .3, 'damage ticks do not restart an active hit clip');
  for (let i = 0; i < 160; i++) {
    character.update(.02, { health: .75 - i * .001, speed: 4 });
    assert.equal(character.state, 'run', 'locomotion cancels full-body gestures');
  }
  assert.equal(character.gestureActive, null);
  equipment.dispose(); character.dispose();
});
