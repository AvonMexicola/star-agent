import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/** Correct the expedition auto-rig's hip pivots, without changing its bind shape
 * or any upper-body joint/animation. All measurements here are in world metres.
 */
export async function correctLegRig(rig) {
  globalThis.self ??= globalThis;
  globalThis.ProgressEvent ??= class { constructor(type, init) { this.type = type; Object.assign(this, init); } };
  const parse = async () => {
    const bytes = rig.bytes({ materials: false });
    return new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  };
  const original = await parse();
  const { nodes, skins, animations } = rig.json;
  const parents = new Map();
  nodes.forEach((node, parent) => node.children?.forEach(child => parents.set(child, parent)));
  const world = index => {
    const node = nodes[index];
    const local = node.matrix ? new THREE.Matrix4().fromArray(node.matrix) : new THREE.Matrix4().compose(
      new THREE.Vector3().fromArray(node.translation || [0, 0, 0]),
      new THREE.Quaternion().fromArray(node.rotation || [0, 0, 0, 1]),
      new THREE.Vector3().fromArray(node.scale || [1, 1, 1]));
    return parents.has(index) ? world(parents.get(index)).multiply(local) : local;
  };
  const originalWorld = nodes.map((_, i) => world(i));
  const originalTranslations = new Map();
  const changes = [];
  for (const side of ['Left', 'Right']) {
    const thigh = nodes.findIndex(node => node.name === `${side}UpLeg`);
    const knee = nodes.findIndex(node => node.name === `${side}Leg`);
    if (thigh < 0 || knee < 0 || parents.get(knee) !== thigh) throw Error(`Missing ${side} leg chain`);
    const oldHip = new THREE.Vector3().setFromMatrixPosition(originalWorld[thigh]);
    const kneePosition = new THREE.Vector3().setFromMatrixPosition(originalWorld[knee]);
    if (oldHip.y < .82 || oldHip.y > .85 || kneePosition.y < .55 || kneePosition.y > .62) {
      throw Error('Expedition source proportions changed; remeasure the hip correction before rebuilding');
    }
    // Measured against the actual suit: hinge at the upper thigh/flexible hip
    // seam, rather than 17 cm below it in the middle of the ceramic plate.
    const hip = oldHip.clone().add(new THREE.Vector3(0, .17, 0));
    for (const [index, position] of [[thigh, hip], [knee, kneePosition]]) {
      originalTranslations.set(index, nodes[index].translation.slice());
      nodes[index].translation = position.clone().applyMatrix4(world(parents.get(index)).invert()).toArray();
    }
    changes.push({ side, hipBefore: oldHip.toArray(), hipAfter: hip.toArray(), knee: kneePosition.toArray() });
  }

  // Meshy also exports constant translations in the clips. Move those tracks
  // with their bind joints so an animation cannot silently restore the bad rig.
  for (const animation of animations) for (const channel of animation.channels) {
    if (channel.target.path !== 'translation' || !originalTranslations.has(channel.target.node)) continue;
    const before = originalTranslations.get(channel.target.node), after = nodes[channel.target.node].translation;
    const sampler = animation.samplers[channel.sampler];
    sampler.output = rig.addRows(rig.rows(sampler.output).map(row => row.map((v, i) => v + after[i] - before[i])), 'VEC3');
  }

  // Rebind only the relocated joints. NewWorld * NewInverseBind equals the
  // original product, preserving every vertex in the rest pose (including UVs).
  for (const skin of skins) {
    const inverses = rig.rows(skin.inverseBindMatrices);
    skin.joints.forEach((node, i) => {
      if (!originalTranslations.has(node)) return;
      inverses[i] = world(node).invert().multiply(originalWorld[node])
        .multiply(new THREE.Matrix4().fromArray(inverses[i])).toArray();
    });
    skin.inverseBindMatrices = rig.addRows(inverses, 'MAT4');
  }
  const corrected = await parse();
  const retarget = retargetLegs(rig, original, corrected);
  return { version: 1, hipLiftMetres: .17, changes, ...retarget };
}

const position = bone => bone.getWorldPosition(new THREE.Vector3());
const rotation = bone => bone.getWorldQuaternion(new THREE.Quaternion()).normalize();
function setWorldRotation(bone, quaternion) {
  bone.quaternion.copy(rotation(bone.parent).invert().multiply(quaternion)).normalize();
  bone.updateWorldMatrix(false, true);
}

/** Re-solve the longer thighs against the source ankle positions. Moving a hip
 * alone changes foot arcs and makes crouching float. This offline two-bone solve
 * retains both original soles and every upper-body motion; no per-frame cost.
 */
function retargetLegs(rig, original, corrected) {
  const sourceMixer = new THREE.AnimationMixer(original.scene), targetMixer = new THREE.AnimationMixer(corrected.scene);
  original.scene.updateMatrixWorld(true); corrected.scene.updateMatrixWorld(true);
  const chains = ['Left', 'Right'].map(side => {
    const names = ['UpLeg', 'Leg', 'Foot'].map(joint => side + joint);
    const source = names.map(name => original.scene.getObjectByName(name));
    const target = names.map(name => corrected.scene.getObjectByName(name));
    return { names, source, target, upper: position(target[0]).distanceTo(position(target[1])),
      lower: position(target[1]).distanceTo(position(target[2])) };
  });
  let maxAnkleError = 0, samples = 0;
  for (const animation of rig.json.animations) {
    sourceMixer.stopAllAction(); targetMixer.stopAllAction();
    for (const [mixer, gltf] of [[sourceMixer, original], [targetMixer, corrected]]) {
      const action = mixer.clipAction(gltf.animations.find(clip => clip.name === animation.name)).setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true; action.reset().play();
    }
    const sourceTimes = [...new Set(animation.samplers.flatMap(s => rig.rows(s.input).map(row => row[0])))].sort((a, b) => a - b);
    const times = [];
    for (let i = 0; i < sourceTimes.length - 1; i++) {
      const start = sourceTimes[i], span = sourceTimes[i + 1] - start;
      const steps = Math.max(1, Math.ceil(span * 60 - 1e-4));
      for (let j = 0; j < steps; j++) times.push(start + span * j / steps);
    }
    times.push(sourceTimes.at(-1));
    const tracks = new Map(chains.flatMap(chain => chain.names).map(name => [name, []]));
    for (const time of times) {
      sourceMixer.setTime(time); targetMixer.setTime(time);
      original.scene.updateMatrixWorld(true); corrected.scene.updateMatrixWorld(true);
      for (const { names, source, target, upper, lower } of chains) {
        const hip = position(target[0]), ankle = position(source[2]);
        const axis = ankle.clone().sub(hip), distance = axis.length(); axis.normalize();
        const reach = THREE.MathUtils.clamp(distance, Math.abs(upper - lower) + 1e-6, upper + lower - 1e-6);
        const along = (upper * upper - lower * lower + reach * reach) / (2 * reach);
        const away = Math.sqrt(Math.max(0, upper * upper - along * along));
        // Follow the authored knee hinge axis. Projecting the old knee from
        // the relocated hip flips the pole when a straight leg crosses that
        // new sight line, producing a sudden backwards knee during walking.
        const hinge = new THREE.Vector3(1, 0, 0).applyQuaternion(rotation(source[0]));
        const pole = axis.clone().cross(hinge);
        if (pole.lengthSq() < 1e-10) throw Error(`Degenerate knee plane in ${animation.name}`);
        pole.normalize();
        const knee = hip.clone().addScaledVector(axis, along).addScaledVector(pole, away);
        const upperDelta = new THREE.Quaternion().setFromUnitVectors(position(target[1]).sub(hip).normalize(), knee.clone().sub(hip).normalize());
        setWorldRotation(target[0], upperDelta.multiply(rotation(target[0])));
        const actualKnee = position(target[1]);
        const lowerDelta = new THREE.Quaternion().setFromUnitVectors(position(target[2]).sub(actualKnee).normalize(), ankle.clone().sub(actualKnee).normalize());
        setWorldRotation(target[1], lowerDelta.multiply(rotation(target[1])));
        setWorldRotation(target[2], rotation(source[2]));
        maxAnkleError = Math.max(maxAnkleError, position(target[2]).distanceTo(ankle)); samples++;
        names.forEach((name, i) => tracks.get(name).push(target[i].quaternion.toArray()));
      }
    }
    const input = rig.addRows(times.map(t => [t]), 'SCALAR');
    for (const [name, rows] of tracks) {
      const node = rig.json.nodes.findIndex(node => node.name === name);
      let channel = animation.channels.find(c => c.target.node === node && c.target.path === 'rotation');
      if (!channel) { channel = { sampler: animation.samplers.length, target: { node, path: 'rotation' } }; animation.channels.push(channel); animation.samplers.push({}); }
      Object.assign(animation.samplers[channel.sampler], { input, output: rig.addRows(rows, 'VEC4'), interpolation: 'LINEAR' });
    }
  }
  return { retargetedAnkleSamples: samples, maximumAnkleErrorMetres: maxAnkleError };
}
