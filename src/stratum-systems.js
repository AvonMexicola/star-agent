import * as THREE from 'three';
import { STRATUM_LAYOUT as L, stratumRampPose } from './stratum-layout.js';

const clamp = (value, min, max, fallback = min) => Math.max(min, Math.min(max, Number.isFinite(value) ? value : fallback));

/** Bind only a complete, finite authored rig. Does not alter it on failure. */
export function validateStratumAsset(model) {
  if (!model?.isObject3D) throw new Error('Stratum scene is missing');
  const names = ['Stratum_M05', 'PilotEye', 'StandingEye', L.ramp.hingeNode,
    ...L.ramp.slideNodes, ...L.gear.legs.map(x => x.node),
    ...L.mining.booms.flatMap(x => [x.node, x.pitchNode, x.muzzle]),
    ...L.nozzles.map(x => x.node), ...L.displays.map(x => x.node)];
  for (const name of names) if (!model.getObjectByName(name)) throw new Error(`Stratum node missing: ${name}`);
  let triangles = 0;
  model.updateMatrixWorld(true);
  model.traverse(node => {
    if (!node.matrixWorld.elements.every(Number.isFinite)) throw new Error(`Stratum invalid transform: ${node.name}`);
    if (!node.isMesh) return;
    const p = node.geometry?.getAttribute('position');
    if (!p || p.itemSize !== 3 || p.count < 3 || !Array.from(p.array).every(Number.isFinite)) throw new Error(`Stratum invalid geometry: ${node.name}`);
    const index = node.geometry.index;
    if (index && (!Array.from(index.array).every(x => Number.isInteger(x) && x >= 0 && x < p.count) || index.count % 3)) throw new Error(`Stratum invalid indices: ${node.name}`);
    triangles += (index?.count ?? p.count) / 3;
  });
  if (!triangles || triangles > 60_000) throw new Error('Stratum geometry exceeds its contract');
  for (const display of L.displays) if (!model.getObjectByName(display.node)?.isMesh) throw new Error(`Stratum display is not a mesh: ${display.node}`);
  return { triangles };
}

/** Asset motion only. Root owns navigation, input, mining, storage and flight. */
export function createStratumSystems(model) {
  validateStratumAsset(model);
  const node = name => model.getObjectByName(name);
  const hinge = node(L.ramp.hingeNode), slides = L.ramp.slideNodes.map(node);
  const legs = L.gear.legs.map(spec => ({ ...spec, object: node(spec.node) }));
  const booms = L.mining.booms.map(spec => ({ ...spec, yawNode: node(spec.node), pitch: node(spec.pitchNode), tip: node(spec.muzzle) }));
  const nozzles = L.nozzles.map(spec => ({ ...spec, object: node(spec.node) }));
  const inverse = new THREE.Matrix4();
  const worldRotation = new THREE.Quaternion(), rootRotation = new THREE.Quaternion();
  const state = { gearProgress: 1, rampProgress: 0, aim: booms.map(() => ({ yaw: 0, pitch: 0 })) };

  function applyPose({ gearProgress = state.gearProgress, rampProgress = state.rampProgress, aim = state.aim } = {}) {
    state.gearProgress = clamp(gearProgress, 0, 1, state.gearProgress);
    state.rampProgress = clamp(rampProgress, 0, 1, state.rampProgress);
    for (const leg of legs) leg.object.rotation.z = leg.side * L.gear.stowedAngle * (1 - state.gearProgress);
    const ramp = stratumRampPose(state.rampProgress);
    hinge.rotation.x = ramp.angle;
    slides[0].position.z = ramp.middle;
    slides[1].position.z = ramp.end;
    slides[0].position.y = ramp.middleLift;
    slides[1].position.y = ramp.endLift;
    for (let i = 0; i < booms.length; i++) {
      const request = aim[i] ?? state.aim[i];
      const yaw = clamp(request.yaw, -L.mining.yawLimit, L.mining.yawLimit, 0);
      const pitch = clamp(request.pitch, L.mining.pitchMin, L.mining.pitchMax, 0);
      booms[i].yawNode.rotation.y = yaw;
      booms[i].pitch.rotation.x = pitch;
      state.aim[i] = { yaw, pitch };
    }
    model.updateMatrixWorld(true);
    return snapshot();
  }

  function poseFor(object, forward, local) {
    model.updateWorldMatrix(true, true);
    const position = object.getWorldPosition(new THREE.Vector3());
    const direction = new THREE.Vector3(...forward).applyQuaternion(object.getWorldQuaternion(worldRotation)).normalize();
    if (local) {
      position.applyMatrix4(inverse.copy(model.matrixWorld).invert());
      direction.applyQuaternion(model.getWorldQuaternion(rootRotation).invert()).normalize();
    }
    return { position, direction };
  }

  function muzzle(index, { local = true } = {}) {
    const boom = booms[index];
    if (!boom) throw new RangeError('Stratum mining head index must be 0 or 1');
    return { ...poseFor(boom.tip, L.mining.forward, local), name: boom.muzzle, index, type: L.mining.type };
  }

  function nozzle(index, { local = true } = {}) {
    const spec = nozzles[index];
    if (!spec) throw new RangeError('Stratum nozzle index must be 0 or 1');
    return { ...poseFor(spec.object, spec.direction, local), name: spec.node, radius: spec.radius };
  }

  function snapshot() {
    return { gearProgress: state.gearProgress, rampProgress: state.rampProgress,
      rampReady: state.rampProgress === 1, secured: state.rampProgress === 0,
      aim: state.aim.map(x => ({ ...x })) };
  }

  applyPose();
  return { applyPose, snapshot, muzzle, nozzle, model,
    displays: L.displays.map(x => node(x.node)) };
}

/** Inspection clock only. A flight adapter passes its canonical progress directly. */
export function createStratumInspectionState() {
  const state = { gearProgress: 1, rampProgress: 0 };
  const target = { gear: 1, ramp: 0 };
  function command(part, value) {
    if (!(part in target)) return { ok: false, reason: 'Unknown mechanism' };
    const next = value ? 1 : 0;
    if (part === 'ramp' && next && (state.gearProgress < 1 || target.gear !== 1)) return { ok: false, reason: 'Extend the landing gear first.' };
    if (part === 'gear' && !next && (state.rampProgress > 0 || target.ramp !== 0)) return { ok: false, reason: 'Close and stow the boarding ramp first.' };
    target[part] = next;
    return { ok: true };
  }
  function update(dt) {
    const step = clamp(dt, 0, 0.1, 0);
    for (const [part, duration] of [['gear', L.gear.duration], ['ramp', L.ramp.duration]]) {
      const key = part + 'Progress', distance = target[part] - state[key];
      state[key] += Math.sign(distance) * Math.min(Math.abs(distance), step / duration);
      if (Math.abs(state[key] - target[part]) < 1e-9) state[key] = target[part];
    }
    return { ...state };
  }
  return { command, update, snapshot: () => ({ ...state, target: { ...target } }) };
}
