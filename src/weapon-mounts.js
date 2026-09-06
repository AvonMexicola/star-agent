import * as THREE from 'three';
import standard from '../assets/atlas-mark-ii/mount-standard.json' with { type: 'json' };

const slots = new Map(standard.geometrySlots.map(slot => [slot.size, Object.freeze(slot)]));

export const WEAPON_MOUNT_STANDARD = Object.freeze(standard);
export const WEAPON_MOUNT_SIZES = Object.freeze([...slots.keys()]);
export const NOMAD_FUTURE_S1_ATTACHMENT = Object.freeze({
  id: 'nomad-s1-fitting-gauge',
  size: 1,
  kind: 'debug-fitting-gauge',
  status: 'future',
});

function sizeOf(value, label) {
  const size = typeof value === 'number' ? value : value?.size;
  if (!Number.isInteger(size) || !slots.has(size)) {
    throw new RangeError(`${label} size must be one of ${WEAPON_MOUNT_SIZES.map(item => `S${item}`).join(', ')}`);
  }
  return size;
}

export function mountGeometrySlot(size) {
  return slots.get(sizeOf(size, 'Mount'));
}

export function mountAccepts(mount, attachment, { exactSize = true } = {}) {
  const mountSize = sizeOf(mount, 'Mount');
  const attachmentSize = sizeOf(attachment, 'Attachment');
  return exactSize ? attachmentSize === mountSize : attachmentSize <= mountSize;
}

function validateMountDefinition(mount) {
  sizeOf(mount, 'Mount');
  if (!mount || typeof mount.node !== 'string' || mount.node.length === 0) {
    throw new TypeError('Mount definition requires a named asset node');
  }
}

/** Resolve the world transform of a mount node after checking attachment size. */
export function mountTransformFromAsset(assetRoot, mount, attachment, options) {
  validateMountDefinition(mount);
  if (!mountAccepts(mount, attachment, options)) {
    throw new RangeError(`S${attachment.size} attachment does not fit S${mount.size} mount`);
  }
  if (!assetRoot?.getObjectByName) throw new TypeError('Asset root must support getObjectByName()');
  const node = assetRoot.getObjectByName(mount.node);
  if (!node) throw new Error(`Asset is missing mount node ${mount.node}`);
  assetRoot.updateWorldMatrix?.(true, true);
  node.updateWorldMatrix?.(true, false);
  return node.matrixWorld.clone();
}

/**
 * Visible dimensional gauge for asset fitting and viewer diagnostics.
 * It has no weapon or combat behaviour.
 */
export function createMountFittingGauge(size) {
  const slot = mountGeometrySlot(size);
  const group = new THREE.Group();
  group.name = `${slot.id} fitting gauge (debug only)`;
  group.userData.debugOnly = true;
  group.userData.mountSize = slot.size;

  const envelope = slot.clearanceEnvelope;
  const height = envelope.abovePlane + envelope.belowPlane;
  const clearance = new THREE.Mesh(
    new THREE.CylinderGeometry(envelope.diameter / 2, envelope.diameter / 2, height, 32, 1, true),
    new THREE.MeshBasicMaterial({ color: 0x66ddff, wireframe: true, transparent: true, opacity: 0.35 }),
  );
  clearance.name = `${slot.id} clearance envelope`;
  clearance.position.y = (envelope.abovePlane - envelope.belowPlane) / 2;
  group.add(clearance);

  const plate = new THREE.Mesh(
    new THREE.CylinderGeometry(slot.dockingDiameter / 2, slot.dockingDiameter / 2, 0.025, 32),
    new THREE.MeshBasicMaterial({ color: 0xffb866, wireframe: true }),
  );
  plate.name = `${slot.id} docking plane`;
  group.add(plate);
  const bore = new THREE.ArrowHelper(new THREE.Vector3(0, 0, -1), new THREE.Vector3(), envelope.diameter, 0xff6f61);
  bore.name = `${slot.id} bore axis (-Z)`;
  group.add(bore);
  return group;
}
