import * as THREE from 'three';

export function rotateBoneWorld(character, bone, delta) {
  character?.rememberAnimatedPose?.(bone);
  const parent = bone.parent.getWorldQuaternion(new THREE.Quaternion());
  bone.quaternion.premultiply(parent.clone().invert().multiply(delta).multiply(parent));
  bone.updateWorldMatrix(false, true);
}

/** Analytic two-bone arm solve. Fixed bone lengths and a body-relative elbow
 * pole keep elbows anatomical while a moving hand follows an equipment grip. */
export function solveArm(character, hand, target, pole) {
  const forearm = hand.parent, upper = forearm?.parent;
  if (!upper?.isBone || !forearm?.isBone) return;
  const a = upper.getWorldPosition(new THREE.Vector3());
  const b = forearm.getWorldPosition(new THREE.Vector3());
  const c = hand.getWorldPosition(new THREE.Vector3());
  const first = a.distanceTo(b), second = b.distanceTo(c);
  const axis = target.clone().sub(a), distance = THREE.MathUtils.clamp(axis.length(), Math.abs(first - second) + 1e-4, (first + second) * .999);
  axis.normalize();
  const along = (first * first - second * second + distance * distance) / (2 * distance);
  const perpendicular = pole.clone().addScaledVector(axis, -pole.dot(axis)).normalize();
  const elbow = a.clone().addScaledVector(axis, along).addScaledVector(perpendicular, Math.sqrt(Math.max(0, first * first - along * along)));
  rotateBoneWorld(character, upper, new THREE.Quaternion().setFromUnitVectors(b.sub(a).normalize(), elbow.sub(a).normalize()));
  forearm.getWorldPosition(b); hand.getWorldPosition(c);
  const end = a.addScaledVector(axis, distance);
  rotateBoneWorld(character, forearm, new THREE.Quaternion().setFromUnitVectors(c.sub(b).normalize(), end.sub(b).normalize()));
}
