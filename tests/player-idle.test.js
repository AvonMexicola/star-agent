import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

if (!globalThis.ProgressEvent) {
  globalThis.ProgressEvent = class ProgressEvent {
    constructor(type, init = {}) { this.type = type; Object.assign(this, init); }
  };
}
if (!globalThis.self) globalThis.self = globalThis;

const MODEL_URL = new URL('../public/models/props/player-male.glb', import.meta.url);
const EXPECTED_CLIPS = [
  'aim-rifle', 'carry-walk', 'crouch-walk', 'death', 'fire-pistol', 'fire-rifle', 'idle',
  'jump', 'run', 'sit-down', 'sit-idle', 'stand-up', 'walk', 'wounded-walk',
];

// Materials are irrelevant to a skeletal pose test. Removing their references
// lets GLTFLoader parse the real binary in Node without browser image decoders.
function withoutMaterials(bytes) {
  const source = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 12, json, binary;
  while (offset < bytes.byteLength) {
    const length = source.getUint32(offset, true);
    const type = source.getUint32(offset + 4, true);
    const chunk = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === 0x4e4f534a) json = JSON.parse(new TextDecoder().decode(chunk).trim());
    else if (type === 0x004e4942) binary = chunk;
    offset += 8 + length;
  }
  assert.ok(json && binary, 'player asset is a binary glTF with JSON and geometry chunks');
  for (const mesh of json.meshes ?? []) for (const primitive of mesh.primitives ?? []) delete primitive.material;
  delete json.materials; delete json.textures; delete json.images; delete json.samplers;

  const encoded = new TextEncoder().encode(JSON.stringify(json));
  const jsonLength = (encoded.length + 3) & ~3;
  const binaryLength = (binary.length + 3) & ~3;
  const output = new Uint8Array(12 + 8 + jsonLength + 8 + binaryLength);
  const view = new DataView(output.buffer);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, output.length, true);
  view.setUint32(12, jsonLength, true);
  view.setUint32(16, 0x4e4f534a, true);
  output.fill(0x20, 20, 20 + jsonLength);
  output.set(encoded, 20);
  const binaryOffset = 20 + jsonLength;
  view.setUint32(binaryOffset, binaryLength, true);
  view.setUint32(binaryOffset + 4, 0x004e4942, true);
  output.set(binary, binaryOffset + 8);
  return output.buffer;
}

async function loadPlayer() {
  const bytes = await readFile(MODEL_URL);
  return new GLTFLoader().parseAsync(withoutMaterials(bytes), '');
}

const positionOf = bone => bone.getWorldPosition(new THREE.Vector3());

test('production pilot idle keeps relaxed hands and a planted looping stance', async () => {
  const gltf = await loadPlayer();
  assert.deepEqual(gltf.animations.map(clip => clip.name).sort(), EXPECTED_CLIPS,
    'the production asset retains the complete animation contract');
  const clip = gltf.animations.find(animation => animation.name === 'idle');
  assert.ok(clip && clip.duration > 2 && clip.duration < 2.5, 'idle retains its authored loop duration');

  const bones = {};
  gltf.scene.traverse(object => { if (object.isBone) bones[object.name] = object; });
  for (const name of ['Hips', 'LeftHand', 'RightHand', 'LeftFoot', 'RightFoot']) {
    assert.ok(bones[name]?.isBone, `production rig has ${name}`);
  }

  const mixer = new THREE.AnimationMixer(gltf.scene);
  const action = mixer.clipAction(clip);
  action.setLoop(THREE.LoopOnce, 1);
  action.clampWhenFinished = true;
  action.play();
  const first = {}, maxFootDrift = { LeftFoot: 0, RightFoot: 0 };
  for (let frame = 0; frame <= 240; frame++) {
    mixer.setTime(clip.duration * frame / 240);
    gltf.scene.updateMatrixWorld(true);
    const hips = positionOf(bones.Hips);
    for (const side of ['Left', 'Right']) {
      const hand = positionOf(bones[`${side}Hand`]);
      const wristAboveWaist = hand.y - hips.y;
      assert.ok(wristAboveWaist < .03,
        `${side} wrist stays at or below the waist (${wristAboveWaist.toFixed(4)} m at frame ${frame})`);
      const handRadius = Math.hypot(hand.x - hips.x, hand.z - hips.z);
      assert.ok(handRadius > .2 && handRadius < .5,
        `${side} hand remains beside the body (${handRadius.toFixed(4)} m at frame ${frame})`);
    }
    const leftFoot = positionOf(bones.LeftFoot), rightFoot = positionOf(bones.RightFoot);
    assert.ok(Math.abs(leftFoot.y - rightFoot.y) < .04,
      `both feet stay on one ground plane at frame ${frame}`);
    for (const [name, position] of [['LeftFoot', leftFoot], ['RightFoot', rightFoot]]) {
      if (!first[name]) first[name] = position.clone();
      maxFootDrift[name] = Math.max(maxFootDrift[name], position.distanceTo(first[name]));
    }
    if (frame === 0) {
      first.Hips = hips.clone();
      first.LeftHand = positionOf(bones.LeftHand);
      first.RightHand = positionOf(bones.RightHand);
    }
    if (frame === 240) {
      assert.ok(hips.distanceTo(first.Hips) < .02, 'hips close the idle loop without a visible jump');
      assert.ok(positionOf(bones.LeftHand).distanceTo(first.LeftHand) < .02, 'left hand closes the idle loop');
      assert.ok(positionOf(bones.RightHand).distanceTo(first.RightHand) < .02, 'right hand closes the idle loop');
    }
  }
  assert.ok(maxFootDrift.LeftFoot < .005, `left foot drift is ${maxFootDrift.LeftFoot} m`);
  assert.ok(maxFootDrift.RightFoot < .005, `right foot drift is ${maxFootDrift.RightFoot} m`);
});
