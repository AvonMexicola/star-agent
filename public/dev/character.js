// Test bench for src/character.js — flat ground, one character, every state on a key.
//
// Served raw out of public/, so imports must be absolute URLs. THREE comes from
// /src/character.js so the module under test and this page share one three instance.
//
//   ?clean            hide the panels (screenshots)
//   ?cam=third|first|cine   initial camera mode
//   ?drive=walk|run|crouch|carry|wounded  hold a constant locomotion input
//   ?aim=rifle|pistol ?sit ?dead ?carry ?hurt
//   ?warm=<seconds>   advance the simulation with fixed 1/60 s steps before the first
//                     frame, so a screenshot lands on a known animation phase
//   ?rig=standin|glb  force the placeholder rig or the authored mannequin
import { THREE, Character, CharacterCamera, CLIPS } from '/src/character.js';

const params = new URLSearchParams(location.search);
if (params.has('clean')) document.body.classList.add('clean');

const RIG_URL = '/models/props/mannequin.glb';

// ---------------------------------------------------------------- renderer

const canvas = document.getElementById('viewport');
const readout = document.getElementById('readout');
const assetPanel = document.getElementById('assets');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setClearColor(0x0a1119, 1);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x0a1119, 40, 160);
const camera = new THREE.PerspectiveCamera(52, 1, 0.05, 500);

/** Everything with a fixed world position lives here; it is shifted by -renderOrigin
 *  each frame, exactly like main.js shifts the planet, so this page exercises the
 *  same camera-relative path the game uses. */
const world = new THREE.Group();
scene.add(world);

const hemi = new THREE.HemisphereLight(0x9dc4ff, 0x3a382f, 1.05);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1dc, 2.6);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -10; sun.shadow.camera.right = 10;
sun.shadow.camera.top = 10; sun.shadow.camera.bottom = -10;
sun.shadow.camera.near = 1; sun.shadow.camera.far = 90;
sun.shadow.normalBias = 0.03;
world.add(sun, sun.target);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(400, 400),
  new THREE.MeshStandardMaterial({ color: 0x63705f, roughness: 0.96, metalness: 0 }),
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
world.add(ground);

const grid = new THREE.GridHelper(120, 120, 0x35566b, 0x1d3141);
grid.material.transparent = true; grid.material.opacity = 0.5;
grid.position.y = 0.002;
world.add(grid);

// Metre posts, so walk speed and stride length are readable in a still frame.
const postGeometry = new THREE.BoxGeometry(0.12, 1.8, 0.12);
const postMaterial = new THREE.MeshStandardMaterial({ color: 0x9fb6c6, roughness: 0.8 });
for (let i = -4; i <= 4; i++) {
  for (const z of [-6, 6]) {
    const post = new THREE.Mesh(postGeometry, postMaterial);
    post.position.set(i * 4, 0.9, z);
    post.castShadow = true; post.receiveShadow = true;
    world.add(post);
  }
}

// ------------------------------------------------------- stand-in rigged model

// A blocky 1.80 m mannequin with Mixamo bone names and the full 14-clip contract,
// used until the authored public/models/props/mannequin.glb lands.
const BONES = [
  ['Hips', null, [0, 0.98, 0]],
  ['Spine', 'Hips', [0, 0.10, 0]],
  ['Spine1', 'Spine', [0, 0.12, 0]],
  ['Spine2', 'Spine1', [0, 0.12, 0]],
  ['Neck', 'Spine2', [0, 0.16, 0]],
  ['Head', 'Neck', [0, 0.09, 0]],
  ['LeftShoulder', 'Spine2', [0.055, 0.12, 0]],
  ['LeftArm', 'LeftShoulder', [0.12, 0, 0]],
  ['LeftForeArm', 'LeftArm', [0.27, 0, 0]],
  ['LeftHand', 'LeftForeArm', [0.25, 0, 0]],
  ['RightShoulder', 'Spine2', [-0.055, 0.12, 0]],
  ['RightArm', 'RightShoulder', [-0.12, 0, 0]],
  ['RightForeArm', 'RightArm', [-0.27, 0, 0]],
  ['RightHand', 'RightForeArm', [-0.25, 0, 0]],
  ['LeftUpLeg', 'Hips', [0.09, -0.06, 0]],
  ['LeftLeg', 'LeftUpLeg', [0, -0.45, 0]],
  ['LeftFoot', 'LeftLeg', [0, -0.45, 0]],
  ['LeftToeBase', 'LeftFoot', [0, -0.02, -0.12]],
  ['RightUpLeg', 'Hips', [-0.09, -0.06, 0]],
  ['RightLeg', 'RightUpLeg', [0, -0.45, 0]],
  ['RightFoot', 'RightLeg', [0, -0.45, 0]],
  ['RightToeBase', 'RightFoot', [0, -0.02, -0.12]],
];

// [from bone, to bone or explicit offset from `from`, thickness]
const SEGMENTS = [
  ['Hips', 'Spine', 0.28], ['Spine', 'Spine1', 0.30], ['Spine1', 'Spine2', 0.32],
  ['Spine2', 'Neck', 0.32], ['Neck', 'Head', 0.12], ['Head', [0, 0.13, 0], 0.21],
  ['LeftShoulder', 'LeftArm', 0.14], ['LeftArm', 'LeftForeArm', 0.115],
  ['LeftForeArm', 'LeftHand', 0.10], ['LeftHand', [0.10, 0, 0], 0.09],
  ['RightShoulder', 'RightArm', 0.14], ['RightArm', 'RightForeArm', 0.115],
  ['RightForeArm', 'RightHand', 0.10], ['RightHand', [-0.10, 0, 0], 0.09],
  ['LeftUpLeg', 'LeftLeg', 0.17], ['LeftLeg', 'LeftFoot', 0.13],
  ['LeftFoot', 'LeftToeBase', 0.11], ['LeftToeBase', [0, 0, -0.06], 0.10],
  ['RightUpLeg', 'RightLeg', 0.17], ['RightLeg', 'RightFoot', 0.13],
  ['RightFoot', 'RightToeBase', 0.11], ['RightToeBase', [0, 0, -0.06], 0.10],
];

const UPV = new THREE.Vector3(0, 1, 0);

function boxBetween(a, b, thickness, boneIndex) {
  const direction = new THREE.Vector3().subVectors(b, a);
  const length = Math.max(0.02, direction.length());
  const geometry = new THREE.BoxGeometry(thickness, length, thickness).toNonIndexed();
  const quaternion = new THREE.Quaternion().setFromUnitVectors(UPV, direction.clone().normalize());
  geometry.applyMatrix4(new THREE.Matrix4().compose(
    new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5), quaternion, new THREE.Vector3(1, 1, 1),
  ));
  const count = geometry.attributes.position.count;
  const index = new Uint16Array(count * 4);
  const weight = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) { index[i * 4] = boneIndex; weight[i * 4] = 1; }
  geometry.setAttribute('skinIndex', new THREE.BufferAttribute(index, 4));
  geometry.setAttribute('skinWeight', new THREE.BufferAttribute(weight, 4));
  return geometry;
}

function mergeAll(geometries) {
  const names = ['position', 'normal', 'uv', 'skinIndex', 'skinWeight'];
  const total = geometries.reduce((n, g) => n + g.attributes.position.count, 0);
  const merged = new THREE.BufferGeometry();
  for (const name of names) {
    const itemSize = geometries[0].attributes[name].itemSize;
    const array = name === 'skinIndex' ? new Uint16Array(total * itemSize) : new Float32Array(total * itemSize);
    let offset = 0;
    for (const geometry of geometries) {
      array.set(geometry.attributes[name].array, offset);
      offset += geometry.attributes[name].array.length;
    }
    merged.setAttribute(name, new THREE.BufferAttribute(array, itemSize));
  }
  for (const geometry of geometries) geometry.dispose();
  merged.computeBoundingSphere();
  return merged;
}

const boneByName = {};

function buildStandInRig() {
  const bones = [];
  const boneIndex = {};
  for (const [name, parent, position] of BONES) {
    const bone = new THREE.Bone();
    bone.name = `mixamorig${name}`;
    bone.position.set(position[0], position[1], position[2]);
    if (parent) boneByName[parent].add(bone);
    boneIndex[name] = bones.length;
    bones.push(bone);
    boneByName[name] = bone;
  }

  const armature = new THREE.Group();
  armature.name = 'Armature';
  armature.add(bones[0]);
  armature.updateMatrixWorld(true);

  const bindWorld = {};
  for (const [name] of BONES) bindWorld[name] = boneByName[name].getWorldPosition(new THREE.Vector3());

  const parts = [];
  for (const [from, to, thickness] of SEGMENTS) {
    const a = bindWorld[from];
    const b = Array.isArray(to) ? a.clone().add(new THREE.Vector3(to[0], to[1], to[2])) : bindWorld[to];
    parts.push(boxBetween(a, b, thickness, boneIndex[from]));
  }

  const skeleton = new THREE.Skeleton(bones);       // inverses taken from the bind pose above
  const material = new THREE.MeshStandardMaterial({ color: 0xa9bcc9, roughness: 0.62, metalness: 0.08 });
  const mesh = new THREE.SkinnedMesh(mergeAll(parts), material);
  mesh.name = 'MannequinBody';
  armature.add(mesh);
  armature.updateMatrixWorld(true);
  mesh.bind(skeleton, mesh.matrixWorld);

  // A mint visor block on the head, so first person has something to hide.
  const visor = new THREE.Mesh(
    new THREE.BoxGeometry(0.19, 0.07, 0.03),
    new THREE.MeshStandardMaterial({ color: 0x2ee08f, emissive: 0x0d6a44, roughness: 0.3 }),
  );
  visor.name = 'HelmetVisor';
  visor.position.set(0, 0.13, -0.11);
  boneByName.Head.add(visor);

  return { scene: armature, animations: buildStandInClips() };
}

// ------------------------------------------------------------- stand-in clips

function buildClip(name, duration, spec) {
  const tracks = [];
  const euler = new THREE.Euler();
  const quaternion = new THREE.Quaternion();
  for (const key of Object.keys(spec)) {
    const keys = spec[key];
    const [short, property] = key.split(':');
    const times = keys.map((entry) => entry[0]);
    if (property === 'pos') {
      const bind = boneByName[short].position;
      const values = [];
      for (const [, v] of keys) values.push(bind.x + v[0], bind.y + v[1], bind.z + v[2]);
      tracks.push(new THREE.VectorKeyframeTrack(`mixamorig${short}.position`, times, values));
    } else {
      const values = [];
      for (const [, v] of keys) {
        euler.set(v[0], v[1], v[2]);
        quaternion.setFromEuler(euler);
        values.push(quaternion.x, quaternion.y, quaternion.z, quaternion.w);
      }
      tracks.push(new THREE.QuaternionKeyframeTrack(`mixamorig${short}.quaternion`, times, values));
    }
  }
  return new THREE.AnimationClip(name, duration, tracks);
}

const ARM_L = -1.32, ARM_R = 1.32;            // T-pose → arms down
const hold = (value) => [[0, value]];

function buildStandInClips() {
  const idle = buildClip('idle', 2, {
    'Spine': [[0, [0, 0, 0]], [1, [0.025, 0, 0]], [2, [0, 0, 0]]],
    'Head': [[0, [0, 0.05, 0]], [1, [0.03, -0.05, 0]], [2, [0, 0.05, 0]]],
    'LeftArm': [[0, [0, 0, ARM_L]], [1, [0.05, 0, ARM_L - 0.03]], [2, [0, 0, ARM_L]]],
    'RightArm': [[0, [0, 0, ARM_R]], [1, [0.05, 0, ARM_R + 0.03]], [2, [0, 0, ARM_R]]],
    'LeftForeArm': hold([0, -0.18, 0]),
    'RightForeArm': hold([0, 0.18, 0]),
    'Hips:pos': [[0, [0, 0, 0]], [1, [0, 0.014, 0]], [2, [0, 0, 0]]],
  });

  const walk = buildClip('walk', 1, {
    'LeftUpLeg': [[0, [0.42, 0, 0]], [0.5, [-0.42, 0, 0]], [1, [0.42, 0, 0]]],
    'RightUpLeg': [[0, [-0.42, 0, 0]], [0.5, [0.42, 0, 0]], [1, [-0.42, 0, 0]]],
    'LeftLeg': [[0, [-0.12, 0, 0]], [0.5, [-0.12, 0, 0]], [0.75, [-0.95, 0, 0]], [1, [-0.12, 0, 0]]],
    'RightLeg': [[0, [-0.12, 0, 0]], [0.25, [-0.95, 0, 0]], [0.5, [-0.12, 0, 0]], [1, [-0.12, 0, 0]]],
    'LeftFoot': [[0, [0.2, 0, 0]], [0.5, [-0.1, 0, 0]], [1, [0.2, 0, 0]]],
    'RightFoot': [[0, [-0.1, 0, 0]], [0.5, [0.2, 0, 0]], [1, [-0.1, 0, 0]]],
    'LeftArm': [[0, [-0.38, 0, ARM_L]], [0.5, [0.38, 0, ARM_L]], [1, [-0.38, 0, ARM_L]]],
    'RightArm': [[0, [0.38, 0, ARM_R]], [0.5, [-0.38, 0, ARM_R]], [1, [0.38, 0, ARM_R]]],
    'LeftForeArm': hold([0, -0.3, 0]),
    'RightForeArm': hold([0, 0.3, 0]),
    'Spine': hold([0.06, 0, 0]),
    'Hips:pos': [[0, [0, 0.028, 0]], [0.25, [0, 0, 0]], [0.5, [0, 0.028, 0]], [0.75, [0, 0, 0]], [1, [0, 0.028, 0]]],
  });

  const run = buildClip('run', 0.62, {
    'LeftUpLeg': [[0, [0.85, 0, 0]], [0.31, [-0.62, 0, 0]], [0.62, [0.85, 0, 0]]],
    'RightUpLeg': [[0, [-0.62, 0, 0]], [0.31, [0.85, 0, 0]], [0.62, [-0.62, 0, 0]]],
    'LeftLeg': [[0, [-0.55, 0, 0]], [0.31, [-0.3, 0, 0]], [0.46, [-1.6, 0, 0]], [0.62, [-0.55, 0, 0]]],
    'RightLeg': [[0, [-0.3, 0, 0]], [0.15, [-1.6, 0, 0]], [0.31, [-0.55, 0, 0]], [0.62, [-0.3, 0, 0]]],
    'LeftArm': [[0, [-1.0, 0, ARM_L]], [0.31, [0.7, 0, ARM_L]], [0.62, [-1.0, 0, ARM_L]]],
    'RightArm': [[0, [0.7, 0, ARM_R]], [0.31, [-1.0, 0, ARM_R]], [0.62, [0.7, 0, ARM_R]]],
    'LeftForeArm': hold([0, -1.1, 0]),
    'RightForeArm': hold([0, 1.1, 0]),
    'Spine': hold([0.26, 0, 0]),
    'Hips:pos': [[0, [0, 0.05, 0]], [0.155, [0, -0.02, 0]], [0.31, [0, 0.05, 0]], [0.465, [0, -0.02, 0]], [0.62, [0, 0.05, 0]]],
  });

  const jump = buildClip('jump', 0.85, {
    'LeftUpLeg': [[0, [0, 0, 0]], [0.15, [0.9, 0, 0]], [0.35, [-0.15, 0, 0]], [0.6, [0.6, 0, 0]], [0.85, [0.25, 0, 0]]],
    'RightUpLeg': [[0, [0, 0, 0]], [0.15, [0.9, 0, 0]], [0.35, [-0.15, 0, 0]], [0.6, [0.6, 0, 0]], [0.85, [0.25, 0, 0]]],
    'LeftLeg': [[0, [-0.12, 0, 0]], [0.15, [-1.5, 0, 0]], [0.35, [-0.05, 0, 0]], [0.6, [-1.1, 0, 0]], [0.85, [-0.5, 0, 0]]],
    'RightLeg': [[0, [-0.12, 0, 0]], [0.15, [-1.5, 0, 0]], [0.35, [-0.05, 0, 0]], [0.6, [-1.1, 0, 0]], [0.85, [-0.5, 0, 0]]],
    'LeftArm': [[0, [0, 0, ARM_L]], [0.15, [-0.9, 0, ARM_L]], [0.35, [1.9, 0, ARM_L]], [0.85, [0.4, 0, ARM_L]]],
    'RightArm': [[0, [0, 0, ARM_R]], [0.15, [-0.9, 0, ARM_R]], [0.35, [1.9, 0, ARM_R]], [0.85, [0.4, 0, ARM_R]]],
    'Spine': [[0, [0, 0, 0]], [0.15, [0.35, 0, 0]], [0.35, [-0.1, 0, 0]], [0.85, [0.2, 0, 0]]],
    'Hips:pos': [[0, [0, 0, 0]], [0.15, [0, -0.24, 0]], [0.35, [0, 0.06, 0]], [0.6, [0, 0.02, 0]], [0.85, [0, -0.16, 0]]],
  });

  const crouch = buildClip('crouch-walk', 1.2, {
    'LeftUpLeg': [[0, [1.15, 0, 0]], [0.6, [0.7, 0, 0]], [1.2, [1.15, 0, 0]]],
    'RightUpLeg': [[0, [0.7, 0, 0]], [0.6, [1.15, 0, 0]], [1.2, [0.7, 0, 0]]],
    'LeftLeg': [[0, [-1.5, 0, 0]], [0.6, [-1.15, 0, 0]], [1.2, [-1.5, 0, 0]]],
    'RightLeg': [[0, [-1.15, 0, 0]], [0.6, [-1.5, 0, 0]], [1.2, [-1.15, 0, 0]]],
    'Spine': hold([0.4, 0, 0]),
    'Spine1': hold([0.12, 0, 0]),
    'Head': hold([-0.35, 0, 0]),
    'LeftArm': [[0, [0.5, 0, ARM_L + 0.15]], [0.6, [0.2, 0, ARM_L + 0.15]], [1.2, [0.5, 0, ARM_L + 0.15]]],
    'RightArm': [[0, [0.2, 0, ARM_R - 0.15]], [0.6, [0.5, 0, ARM_R - 0.15]], [1.2, [0.2, 0, ARM_R - 0.15]]],
    'Hips:pos': [[0, [0, -0.36, 0]], [0.6, [0, -0.32, 0]], [1.2, [0, -0.36, 0]]],
  });

  const seated = {
    'LeftUpLeg': [1.5, 0, 0.1], 'RightUpLeg': [1.5, 0, -0.1],
    'LeftLeg': [-1.5, 0, 0], 'RightLeg': [-1.5, 0, 0],
    'LeftArm': [0.85, 0, ARM_L + 0.1], 'RightArm': [0.85, 0, ARM_R - 0.1],
    'LeftForeArm': [0, -0.5, 0], 'RightForeArm': [0, 0.5, 0],
    'Spine': [0.08, 0, 0],
  };
  const sitDownSpec = { 'Hips:pos': [[0, [0, 0, 0]], [1, [0, -0.44, 0.1]]] };
  const standUpSpec = { 'Hips:pos': [[0, [0, -0.44, 0.1]], [0.9, [0, 0, 0]]] };
  const sitIdleSpec = { 'Hips:pos': [[0, [0, -0.44, 0.1]], [1, [0, -0.428, 0.1]], [2, [0, -0.44, 0.1]]] };
  for (const bone of Object.keys(seated)) {
    const rest = bone.includes('Arm') ? [0, 0, bone.startsWith('Left') ? ARM_L : ARM_R] : [0, 0, 0];
    sitDownSpec[bone] = [[0, rest], [1, seated[bone]]];
    standUpSpec[bone] = [[0, seated[bone]], [0.9, rest]];
    sitIdleSpec[bone] = [[0, seated[bone]], [2, seated[bone]]];
  }
  const sitDown = buildClip('sit-down', 1, sitDownSpec);
  const standUp = buildClip('stand-up', 0.9, standUpSpec);
  const sitIdle = buildClip('sit-idle', 2, sitIdleSpec);

  const carry = buildClip('carry-walk', 1.05, {
    'LeftUpLeg': [[0, [0.3, 0, 0]], [0.525, [-0.3, 0, 0]], [1.05, [0.3, 0, 0]]],
    'RightUpLeg': [[0, [-0.3, 0, 0]], [0.525, [0.3, 0, 0]], [1.05, [-0.3, 0, 0]]],
    'LeftLeg': [[0, [-0.12, 0, 0]], [0.525, [-0.12, 0, 0]], [0.8, [-0.8, 0, 0]], [1.05, [-0.12, 0, 0]]],
    'RightLeg': [[0, [-0.12, 0, 0]], [0.26, [-0.8, 0, 0]], [0.525, [-0.12, 0, 0]], [1.05, [-0.12, 0, 0]]],
    'LeftArm': hold([1.28, 0, ARM_L + 0.2]),
    'RightArm': hold([1.28, 0, ARM_R - 0.2]),
    'LeftForeArm': hold([0, -0.85, 0]),
    'RightForeArm': hold([0, 0.85, 0]),
    'Spine': hold([-0.12, 0, 0]),
    'Hips:pos': [[0, [0, 0.02, 0]], [0.26, [0, 0, 0]], [0.525, [0, 0.02, 0]], [0.79, [0, 0, 0]], [1.05, [0, 0.02, 0]]],
  });

  const wounded = buildClip('wounded-walk', 1.45, {
    'LeftUpLeg': [[0, [0.18, 0, 0]], [0.72, [-0.2, 0, 0]], [1.45, [0.18, 0, 0]]],
    'RightUpLeg': [[0, [-0.34, 0, 0]], [0.72, [0.5, 0, 0]], [1.45, [-0.34, 0, 0]]],
    'LeftLeg': hold([-0.35, 0, 0]),
    'RightLeg': [[0, [-0.15, 0, 0]], [0.36, [-0.9, 0, 0]], [0.72, [-0.15, 0, 0]], [1.45, [-0.15, 0, 0]]],
    'Spine': hold([0.4, 0, 0.16]),
    'Spine1': hold([0.1, 0, 0.1]),
    'Head': hold([-0.3, 0, -0.12]),
    'LeftArm': hold([0.95, 0, ARM_L + 0.42]),
    'LeftForeArm': hold([0, -1.35, 0]),
    'RightArm': [[0, [0.1, 0, ARM_R]], [0.72, [-0.25, 0, ARM_R]], [1.45, [0.1, 0, ARM_R]]],
    'Hips:pos': [[0, [0, -0.05, 0]], [0.36, [0, -0.13, 0]], [0.72, [0, -0.05, 0]], [1.45, [0, -0.05, 0]]],
  });

  const aimPose = {
    'LeftArm': [1.42, 0, ARM_L + 0.22], 'LeftForeArm': [0, -1.1, 0],
    'RightArm': [1.34, 0, ARM_R - 0.32], 'RightForeArm': [0, 1.0, 0],
    'Spine1': [0, 0.3, 0], 'Spine2': [0, 0.14, 0], 'Head': [0, 0.16, 0], 'Neck': [0.1, 0.1, 0],
  };
  const aimSpec = {};
  for (const bone of Object.keys(aimPose)) aimSpec[bone] = [[0, aimPose[bone]], [1, aimPose[bone]]];
  aimSpec['RightArm'] = [[0, aimPose.RightArm], [0.5, [1.36, 0, ARM_R - 0.32]], [1, aimPose.RightArm]];
  const aimRifle = buildClip('aim-rifle', 1, aimSpec);

  const recoil = (name, duration, kick) => {
    const spec = {};
    for (const bone of Object.keys(aimPose)) spec[bone] = [[0, aimPose[bone]], [duration, aimPose[bone]]];
    spec['RightArm'] = [
      [0, aimPose.RightArm],
      [duration * 0.18, [aimPose.RightArm[0] - kick, 0, aimPose.RightArm[2]]],
      [duration, aimPose.RightArm],
    ];
    spec['Spine1'] = [[0, aimPose.Spine1], [duration * 0.18, [-0.14, aimPose.Spine1[1], 0]], [duration, aimPose.Spine1]];
    return buildClip(name, duration, spec);
  };
  const fireRifle = recoil('fire-rifle', 0.34, 0.38);
  const firePistol = recoil('fire-pistol', 0.28, 0.55);

  const death = buildClip('death', 1.3, {
    'Hips:pos': [[0, [0, 0, 0]], [0.4, [0, -0.35, 0.15]], [1.3, [0, -0.86, 0.42]]],
    'Hips': [[0, [0, 0, 0]], [0.4, [-0.5, 0, 0]], [1.3, [-1.45, 0, 0.1]]],
    'Spine': [[0, [0, 0, 0]], [0.5, [0.3, 0, 0]], [1.3, [0.45, 0, 0]]],
    'Head': [[0, [0, 0, 0]], [1.3, [0.5, 0.2, 0]]],
    'LeftUpLeg': [[0, [0, 0, 0]], [0.5, [0.6, 0, 0.2]], [1.3, [0.35, 0, 0.35]]],
    'RightUpLeg': [[0, [0, 0, 0]], [0.5, [0.5, 0, -0.2]], [1.3, [0.2, 0, -0.28]]],
    'LeftLeg': [[0, [-0.1, 0, 0]], [1.3, [-0.7, 0, 0]]],
    'RightLeg': [[0, [-0.1, 0, 0]], [1.3, [-0.45, 0, 0]]],
    'LeftArm': [[0, [0, 0, ARM_L]], [0.5, [0.4, 0, ARM_L + 0.5]], [1.3, [0.1, 0, ARM_L + 0.9]]],
    'RightArm': [[0, [0, 0, ARM_R]], [0.5, [0.4, 0, ARM_R - 0.5]], [1.3, [0.1, 0, ARM_R - 0.9]]],
  });

  return [idle, walk, run, jump, crouch, sitDown, sitIdle, standUp, carry, wounded,
    aimRifle, fireRifle, firePistol, death];
}

/** A GLTFLoader-shaped stand-in so Character exercises its real load path. */
function standInLoader() {
  return {
    load(url, onLoad, onProgress) {
      setTimeout(() => {
        onProgress?.({ loaded: 1, total: 1 });
        onLoad(buildStandInRig());
      }, 0);
    },
  };
}

// ------------------------------------------------------------------- the bench

let character = null;
let characterCamera = null;
let usingAuthoredRig = false;

function createCharacter(useAuthoredRig) {
  character?.dispose();
  usingAuthoredRig = useAuthoredRig;
  character = new Character(scene, {
    url: RIG_URL,
    eyeHeight: 1.65,
    loader: useAuthoredRig ? undefined : standInLoader(),
    onReady: () => describeAssets(),
  });
  characterCamera = new CharacterCamera(character, { mode: params.get('cam') === 'first' ? 'first' : 'third' });
  characterCamera.setMode(characterCamera.mode);
  if (params.get('cam') === 'cine') queueMicrotask(() => characterCamera.openingShot(10, 1.5));
  describeAssets();
}

function describeAssets() {
  const rig = usingAuthoredRig ? `authored ${RIG_URL}` : 'built-in stand-in rig (blocky mannequin)';
  const missing = character?.missingClips || [];
  const lines = [`RIG  ${rig}`, `LOAD ${character?.ready ? 'ready' : character?.error ? 'FAILED' : `${Math.round((character?.progress || 0) * 100)} %`}`];
  if (character?.error) lines.push(`<span class="warn">${character.error}</span>`);
  lines.push(`CLIPS ${CLIPS.length - missing.length}/${CLIPS.length} authored`);
  if (missing.length) {
    lines.push(`<span class="warn">fallbacks:</span> ${missing.map((n) => `${n}→${character.clipInfo[n].source}`).join(', ')}`);
  }
  lines.push(`<span class="dim">head bone: ${character?.headBone?.name || 'none (eyeHeight fallback)'}</span>`);
  assetPanel.innerHTML = lines.join('\n');
}

// Swap to the authored mannequin the moment it appears on disk.
async function pollForAuthoredRig() {
  if (usingAuthoredRig || params.get('rig') === 'standin') return;
  try {
    const response = await fetch(RIG_URL, { method: 'HEAD', cache: 'no-store' });
    if (response.ok && !(response.headers.get('content-type') || '').includes('text/html')) {
      const yaw = character ? character.object.rotation.y : 0;
      createCharacter(true);
      character.object.rotation.y = yaw;
    }
  } catch { /* not there yet */ }
}

createCharacter(params.get('rig') === 'glb');
pollForAuthoredRig();
setInterval(pollForAuthoredRig, 15000);

// ------------------------------------------------------------------ simulation

const sim = {
  position: new THREE.Vector3(0, 0, 0),
  velocity: new THREE.Vector3(),
  yaw: 0,
  jumpHeight: 0,
  jumpVelocity: 0,
  crouching: false,
  carrying: params.has('carry'),
  health: params.has('hurt') ? 0.25 : 1,
  aiming: params.get('aim') || 'none',
  firing: false,
  fireTimer: 0,
  seated: params.has('sit'),
  dead: params.has('dead'),
};
const input = {
  speed: 0, grounded: true, jumping: false, crouching: false, carrying: false,
  health: 1, aiming: 'none', firing: false, seated: false, dead: false,
};

const keys = new Set();
addEventListener('keydown', (event) => {
  if (event.repeat) { keys.add(event.code); return; }
  keys.add(event.code);
  if (event.code === 'Digit1') sim.aiming = 'none';
  if (event.code === 'Digit2') sim.aiming = 'rifle';
  if (event.code === 'Digit3') sim.aiming = 'pistol';
  if (event.code === 'KeyF') { sim.firing = true; sim.fireTimer = 0.12; if (sim.aiming === 'none') sim.aiming = 'rifle'; }
  if (event.code === 'KeyX') sim.carrying = !sim.carrying;
  if (event.code === 'KeyH') sim.health = sim.health < 0.4 ? 1 : 0.25;
  if (event.code === 'KeyK') sim.dead = !sim.dead;
  if (event.code === 'KeyE') sim.seated = !sim.seated;
  if (event.code === 'KeyV') characterCamera.blendTo(characterCamera.mode === 'third' ? 'first' : 'third', 0.9);
  if (event.code === 'KeyR') { sim.position.set(0, 0, 0); sim.velocity.set(0, 0, 0); sim.yaw = 0; characterCamera.reset(); }
  if (event.code === 'KeyG') characterCamera.openingShot(10, 1.5);
  if (['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Tab'].includes(event.code)) event.preventDefault();
});
addEventListener('keyup', (event) => keys.delete(event.code));
addEventListener('blur', () => keys.clear());

let dragging = false;
canvas.addEventListener('pointerdown', (event) => { dragging = true; canvas.setPointerCapture(event.pointerId); });
canvas.addEventListener('pointerup', () => { dragging = false; });
canvas.addEventListener('pointermove', (event) => { if (dragging) sim.yaw -= event.movementX * 0.005; });

const DRIVE = params.get('drive');
const forwardVector = new THREE.Vector3();
const rightVector = new THREE.Vector3();
const desired = new THREE.Vector3();
const feet = new THREE.Vector3();
const up = new THREE.Vector3(0, 1, 0);
const lookQuaternion = new THREE.Quaternion();
const renderOrigin = new THREE.Vector3();

function step(dt) {
  const axis = (positive, negative) => Number(keys.has(positive)) - Number(keys.has(negative));
  sim.yaw += (axis('ArrowLeft', 'ArrowRight')) * dt * 1.6;

  let forward = axis('KeyW', 'KeyS');
  let strafe = axis('KeyD', 'KeyA');
  let running = keys.has('ShiftLeft') || keys.has('ShiftRight');
  sim.crouching = keys.has('KeyC');
  if (DRIVE) {
    forward = 1; strafe = 0;
    running = DRIVE === 'run';
    if (DRIVE === 'crouch') sim.crouching = true;
    if (DRIVE === 'carry') sim.carrying = true;
    if (DRIVE === 'wounded') sim.health = 0.25;
  }

  forwardVector.set(-Math.sin(sim.yaw), 0, -Math.cos(sim.yaw));
  rightVector.set(Math.cos(sim.yaw), 0, -Math.sin(sim.yaw));
  desired.set(0, 0, 0).addScaledVector(forwardVector, forward).addScaledVector(rightVector, strafe);
  if (desired.lengthSq() > 1) desired.normalize();
  desired.multiplyScalar(sim.crouching ? 1.1 : running ? 5.2 : 2.0);
  sim.velocity.lerp(desired, 1 - Math.exp(-11 * dt));
  sim.position.addScaledVector(sim.velocity, dt);
  if (sim.position.length() > 55) sim.position.setLength(55);

  if (keys.has('Space') && sim.jumpHeight === 0 && !sim.seated) { sim.jumpVelocity = 4.5; sim.jumpHeight = 0.001; }
  sim.jumpVelocity -= 9.81 * dt;
  sim.jumpHeight = Math.max(0, sim.jumpHeight + sim.jumpVelocity * dt);
  if (sim.jumpHeight === 0) sim.jumpVelocity = 0;

  if (sim.fireTimer > 0) { sim.fireTimer -= dt; if (sim.fireTimer <= 0) sim.firing = false; }

  input.speed = Math.hypot(sim.velocity.x, sim.velocity.z);
  input.grounded = sim.jumpHeight === 0;
  input.jumping = sim.jumpHeight > 0;
  input.crouching = sim.crouching;
  input.carrying = sim.carrying;
  input.health = sim.dead ? 0 : sim.health;
  input.aiming = sim.aiming;
  input.firing = sim.firing;
  input.seated = sim.seated;
  input.dead = sim.dead;
  if (sim.seated || sim.dead) { input.speed = 0; sim.velocity.set(0, 0, 0); }

  feet.copy(sim.position).addScaledVector(up, sim.jumpHeight);
  character.alignToSurface(feet, up, forwardVector);
  character.update(dt, input);

  lookQuaternion.setFromAxisAngle(up, sim.yaw);
  characterCamera.update(dt, lookQuaternion);
}

// ------------------------------------------------------------------ presentation

function resize() {
  const width = Math.floor(innerWidth), height = Math.floor(innerHeight);
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

const bar = (value) => {
  const width = Math.round(Math.max(0, Math.min(1, value)) * 90);
  return `<span class="barbg"><span class="bar" style="width:${width}px"></span></span>`;
};

let lastReadout = 0;
function updateReadout(time) {
  if (time - lastReadout < 120) return;
  lastReadout = time;
  const weights = character.weights;
  const rows = Object.keys(weights).sort((a, b) => weights[b] - weights[a])
    .map((key) => `  ${key.padEnd(13)}${bar(weights[key])} ${weights[key].toFixed(2)}`);
  readout.innerHTML = [
    `STATE   <b>${character.state}</b>${character.transition ? ` <span class="dim">(${character.transition})</span>` : ''}`,
    `CLIP    <b>${character.clipName || '—'}</b>`,
    `SPEED   ${input.speed.toFixed(2)} m/s   ${input.grounded ? '' : 'AIRBORNE'}`,
    `AIM     ${input.aiming}${input.firing ? ' · FIRING' : ''}`,
    `HEALTH  ${(input.health * 100).toFixed(0)} %${input.carrying ? ' · CARRYING' : ''}${input.crouching ? ' · CROUCHED' : ''}`,
    `CAMERA  ${characterCamera.mode}${characterCamera.blending ? ' (blending)' : ''} · fov ${characterCamera.currentFov.toFixed(0)}°`,
    `EYE     ${character.eyeWorldPosition(new THREE.Vector3()).y.toFixed(2)} m`,
    'WEIGHTS', ...rows,
  ].join('\n');
}

let last = null;
function frame(time) {
  requestAnimationFrame(frame);
  const dt = last === null ? 0 : Math.min(0.05, (time - last) / 1000);
  last = time;
  if (dt > 0) step(dt);

  renderOrigin.copy(characterCamera.worldPosition);
  character.placeCameraRelative(renderOrigin);
  world.position.copy(renderOrigin).negate();
  characterCamera.applyTo(camera, renderOrigin);

  sun.position.copy(sim.position).add(new THREE.Vector3(14, 24, 10));
  sun.target.position.copy(sim.position);
  sun.target.updateMatrixWorld();

  renderer.render(scene, camera);
  updateReadout(time);
}

// Deterministic warm-up so a headless screenshot lands on a known animation phase.
const warm = Number(params.get('warm') || 0);
if (warm > 0) {
  character.readyPromise.then(() => {
    for (let t = 0; t < warm; t += 1 / 60) step(1 / 60);
    requestAnimationFrame(frame);
  });
} else requestAnimationFrame(frame);

window.characterDev = {
  get state() {
    return {
      ready: character.ready,
      error: character.error,
      rig: usingAuthoredRig ? 'glb' : 'standin',
      state: character.state,
      transition: character.transition,
      clip: character.clipName,
      weights: character.weights,
      missingClips: character.missingClips,
      headBone: character.headBone?.name || null,
      eye: character.eyeWorldPosition(new THREE.Vector3()).toArray(),
      camera: { mode: characterCamera.mode, fov: characterCamera.currentFov, position: characterCamera.worldPosition.toArray() },
      speed: input.speed,
    };
  },
  sim, input,
  get character() { return character; },              // getters: the rig can be swapped live
  get characterCamera() { return characterCamera; },
  press: (code) => dispatchEvent(new KeyboardEvent('keydown', { code })),
  release: (code) => dispatchEvent(new KeyboardEvent('keyup', { code })),
  step,
};
