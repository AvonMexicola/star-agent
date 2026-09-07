import * as THREE from 'three';

// Solves run synchronously for each character. Keep arm and rotation scratch
// separate because solveArm calls rotateBoneWorld while its vectors are live.
const parentRotation = new THREE.Quaternion();
const localRotation = new THREE.Quaternion();
const armRotation = new THREE.Quaternion();
const shoulderPosition = new THREE.Vector3();
const elbowPosition = new THREE.Vector3();
const handPosition = new THREE.Vector3();
const armAxis = new THREE.Vector3();
const elbowPole = new THREE.Vector3();
const elbowTarget = new THREE.Vector3();

export function rotateBoneWorld(character, bone, delta) {
  character?.rememberAnimatedPose?.(bone);
  const parent = bone.parent.getWorldQuaternion(parentRotation);
  bone.quaternion.premultiply(localRotation.copy(parent).invert().multiply(delta).multiply(parent));
  bone.updateWorldMatrix(false, true);
}

/** Analytic two-bone arm solve. Fixed bone lengths and a body-relative elbow
 * pole keep elbows anatomical while a moving hand follows an equipment grip. */
export function solveArm(character, hand, target, pole) {
  const forearm = hand.parent, upper = forearm?.parent;
  if (!upper?.isBone || !forearm?.isBone) return;
  const a = upper.getWorldPosition(shoulderPosition);
  const b = forearm.getWorldPosition(elbowPosition);
  const c = hand.getWorldPosition(handPosition);
  const first = a.distanceTo(b), second = b.distanceTo(c);
  const axis = armAxis.copy(target).sub(a), distance = THREE.MathUtils.clamp(axis.length(), Math.abs(first - second) + 1e-4, (first + second) * .999);
  axis.normalize();
  const along = (first * first - second * second + distance * distance) / (2 * distance);
  const perpendicular = elbowPole.copy(pole).addScaledVector(axis, -pole.dot(axis)).normalize();
  const elbow = elbowTarget.copy(a).addScaledVector(axis, along).addScaledVector(perpendicular, Math.sqrt(Math.max(0, first * first - along * along)));
  rotateBoneWorld(character, upper, armRotation.setFromUnitVectors(b.sub(a).normalize(), elbow.sub(a).normalize()));
  forearm.getWorldPosition(b); hand.getWorldPosition(c);
  const end = a.addScaledVector(axis, distance);
  rotateBoneWorld(character, forearm, armRotation.setFromUnitVectors(c.sub(b).normalize(), end.sub(b).normalize()));
}
