import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Character, CLIPS, locomotionTimeScale } from '../src/character.js';
import { rotateBoneWorld, solveArm } from '../src/character-ik.js';

function characterFixture() {
  const model = new THREE.Group();
  const hips = new THREE.Bone(); hips.name = 'Hips'; model.add(hips);
  const chest = new THREE.Bone(); chest.name = 'Spine1'; hips.add(chest);
  const meshes = [];
  for (const names of [['GripRight', 'GripLeft'], ['Other', 'GripRight'], ['GripLeft'], ['Other']]) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3));
    geometry.morphAttributes.position = names.map(name => {
      const attribute = new THREE.Float32BufferAttribute([0, 0, 0], 3);
      attribute.name = name;
      return attribute;
    });
    const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial());
    mesh.morphTargetInfluences.fill(.25);
    model.add(mesh); meshes.push(mesh);
  }
  for (let i = 0; i < 64; i++) chest.add(new THREE.Bone());
  const animations = CLIPS.map(name => new THREE.AnimationClip(name, 1, [
    new THREE.VectorKeyframeTrack('Hips.position', [0, 1], [0, 0, 0, 0, 0, 0]),
    new THREE.QuaternionKeyframeTrack('Spine1.quaternion', [0, 1], [0, 0, 0, 1, 0, 0, 0, 1]),
  ]));
  const character = new Character(new THREE.Scene(), {
    placeholder: false,
    loader: { load(url, loaded) { loaded({ scene: model, animations }); } },
  });
  assert.equal(character.ready, true);
  return { character, meshes };
}

test('grips preserve both-handed and pistol smoothing without traversing the rig each frame', () => {
  const { character, meshes } = characterFixture();
  const expected = meshes.map(mesh => [...mesh.morphTargetInfluences]);
  const traverse = character.model.traverse;
  character.model.traverse = () => assert.fail('a loaded rig must not be searched every animation frame');
  const cases = [
    [{ aiming: 'rifle' }, true, true, 1 / 60],
    [{ aiming: 'pistol', speed: 4.5 }, true, false, 1 / 30],
    [{ aiming: 'tool', speed: 1.4 }, true, true, 1 / 60],
    [{ aiming: 'rifle', seated: true }, false, false, 1 / 60],
    [{ aiming: 'rifle', climbing: true }, false, false, 1 / 60],
    [{ aiming: 'rifle', resting: true }, false, false, 1 / 60],
    [{ aiming: 'rifle', dead: true }, false, false, 1 / 60],
    [{ aiming: 'pistol' }, true, false, 0],
    [{ aiming: 'none' }, false, false, 0],
  ];
  for (const [input, right, left, dt] of cases) {
    const rate = dt > 0 ? 1 - Math.exp(-dt * 18) : 1;
    for (let i = 0; i < meshes.length; i++) {
      const dictionary = meshes[i].morphTargetDictionary;
      for (const [name, closed] of [['GripRight', right], ['GripLeft', left]]) {
        if (dictionary[name] === undefined) continue;
        const index = dictionary[name];
        expected[i][index] = THREE.MathUtils.lerp(expected[i][index], closed ? 1 : 0, rate);
      }
    }
    character.update(dt, input);
    assert.deepEqual(meshes.map(mesh => mesh.morphTargetInfluences), expected);
  }
  // Read the live influence array: animation tools may replace its storage.
  meshes[0].morphTargetInfluences = [.4, .6];
  character.update(0, { aiming: 'pistol' });
  assert.deepEqual(meshes[0].morphTargetInfluences, [1, 0]);
  character.model.traverse = traverse;
  character.dispose();
});

test('cached stride classifications retain every full/lower clip rate and reverse climbing', () => {
  const { character } = characterFixture();
  for (const speed of [NaN, -3, 0, .2, .7, 1.4, 2.2, 4.5, 20]) {
    for (const aiming of ['none', 'rifle', 'pistol', 'tool']) {
      character.update(1 / 60, { speed, aiming, climbing: true, climbSpeed: -.172 });
      for (const key of character._keys) {
        const action = character.actions[key];
        const expected = key === 'climb-ladder' ? -.5
          : locomotionTimeScale(speed, key.replace(/-lower$/, '')) * (action.userData.timeScale || 1);
        assert.equal(action.timeScale, expected, `${key} at ${speed} m/s with ${aiming}`);
      }
    }
  }
  character.dispose();
});

test('temporary equipment corrections restore the first authored pose once per frame', () => {
  const { character } = characterFixture();
  const bone = new THREE.Bone();
  const authored = new THREE.Quaternion().setFromEuler(new THREE.Euler(.1, -.4, .8));
  bone.quaternion.copy(authored);
  character.rememberAnimatedPose(bone);
  bone.quaternion.setFromEuler(new THREE.Euler(.7, .3, -.6));
  character.rememberAnimatedPose(bone);
  bone.quaternion.identity();
  character.update(1 / 60, {});
  assert.deepEqual(bone.quaternion.toArray(), authored.toArray());
  bone.quaternion.identity();
  character.update(1 / 60, {});
  assert.deepEqual(bone.quaternion.toArray(), [0, 0, 0, 1], 'inactive corrections do not overwrite later poses');
  character.rememberAnimatedPose(bone);
  bone.quaternion.copy(authored);
  character.update(1 / 60, {});
  assert.deepEqual(bone.quaternion.toArray(), [0, 0, 0, 1], 'the next correction captures a fresh authored pose');
  character.dispose();
});

// Pre-optimization analytic solve retained as a numerical reference. The
// assertions compare complete joint/world transforms over different rigs and
// unreachable targets, so allocation changes cannot silently alter equipment.
function referenceRotate(bone, delta) {
  const parent = bone.parent.getWorldQuaternion(new THREE.Quaternion());
  bone.quaternion.premultiply(parent.clone().invert().multiply(delta).multiply(parent));
  bone.updateWorldMatrix(false, true);
}
function referenceSolve(hand, target, pole) {
  const forearm = hand.parent, upper = forearm.parent;
  const a = upper.getWorldPosition(new THREE.Vector3());
  const b = forearm.getWorldPosition(new THREE.Vector3());
  const c = hand.getWorldPosition(new THREE.Vector3());
  const first = a.distanceTo(b), second = b.distanceTo(c);
  const axis = target.clone().sub(a);
  const distance = THREE.MathUtils.clamp(axis.length(), Math.abs(first - second) + 1e-4, (first + second) * .999);
  axis.normalize();
  const along = (first * first - second * second + distance * distance) / (2 * distance);
  const perpendicular = pole.clone().addScaledVector(axis, -pole.dot(axis)).normalize();
  const elbow = a.clone().addScaledVector(axis, along).addScaledVector(perpendicular, Math.sqrt(Math.max(0, first * first - along * along)));
  referenceRotate(upper, new THREE.Quaternion().setFromUnitVectors(b.sub(a).normalize(), elbow.sub(a).normalize()));
  forearm.getWorldPosition(b); hand.getWorldPosition(c);
  const end = a.addScaledVector(axis, distance);
  referenceRotate(forearm, new THREE.Quaternion().setFromUnitVectors(c.sub(b).normalize(), end.sub(b).normalize()));
}
function armFixture(index) {
  const root = new THREE.Group(), upper = new THREE.Bone(), forearm = new THREE.Bone(), hand = new THREE.Bone();
  root.position.set(index * 1000, -index * 20, index * 31);
  root.rotation.set(index * .13, index * -.19, index * .09);
  upper.position.set(.2, 1.4, .02); upper.rotation.set(.14, -.35, .28);
  forearm.position.set(.25 + index * .002, -.08, .01); forearm.rotation.set(.4, .2, -.3);
  hand.position.set(.24, -.12 - index * .001, .04);
  root.add(upper); upper.add(forearm); forearm.add(hand);
  return { root, upper, forearm, hand };
}

test('reused IK scratch preserves exact joints, world transforms and inputs across interleaved rigs', () => {
  const rigs = Array.from({ length: 6 }, (_, index) => ({ before: armFixture(index), after: armFixture(index) }));
  for (let frame = 0; frame < 90; frame++) {
    for (const { before, after } of rigs) {
      const shoulder = before.upper.getWorldPosition(new THREE.Vector3());
      const target = shoulder.clone().add(new THREE.Vector3(Math.sin(frame * .31) * .9, Math.cos(frame * .13) * .2, -.1));
      const pole = new THREE.Vector3(.6, -.8, .15).applyQuaternion(before.root.quaternion);
      const savedTarget = target.toArray(), savedPole = pole.toArray();
      referenceSolve(before.hand, target, pole);
      solveArm(null, after.hand, target, pole);
      const wrist = new THREE.Quaternion().setFromEuler(new THREE.Euler(.03, -.04, .01));
      referenceRotate(before.hand, wrist); rotateBoneWorld(null, after.hand, wrist);
      for (const key of ['upper', 'forearm', 'hand']) {
        assert.deepEqual(after[key].quaternion.toArray(), before[key].quaternion.toArray(), `${key} rotation`);
        assert.deepEqual(after[key].matrixWorld.elements, before[key].matrixWorld.elements, `${key} world transform`);
      }
      assert.deepEqual(target.toArray(), savedTarget);
      assert.deepEqual(pole.toArray(), savedPole);
    }
  }
});
