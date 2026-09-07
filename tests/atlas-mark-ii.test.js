import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import layout from '../assets/atlas-mark-ii/layout.json' with { type: 'json' };
import colliderData from '../assets/atlas-mark-ii/interior-colliders.json' with { type: 'json' };
import mountStandard from '../assets/atlas-mark-ii/mount-standard.json' with { type: 'json' };
import { AtlasMarkIISystems } from '../src/atlas-mark-ii-systems.js';
import { atlasInspectionPages, describeAtlasControl } from '../src/atlas-mark-ii-controls.js';
import { controlAction, projectActionAnchor } from '../src/projected-action-label.js';
import {
  NOMAD_FUTURE_S1_ATTACHMENT,
  createMountFittingGauge,
  mountAccepts,
  mountGeometrySlot,
  mountTransformFromAsset,
} from '../src/weapon-mounts.js';

if (!globalThis.ProgressEvent) {
  globalThis.ProgressEvent = class ProgressEvent {
    constructor(type, init = {}) { this.type = type;Object.assign(this, init); }
  };
}

const point = (x, y, z) => new THREE.Vector3(x, y, z);
const nearVector = (actual, expected, tolerance = 0.02) => assert.ok(
  actual.distanceTo(expected) <= tolerance,
  `${actual.toArray()} differs from ${expected.toArray()}`,
);
const boundsInFrame = frame => {
  frame.updateWorldMatrix(true, true);
  const inverse = frame.matrixWorld.clone().invert();
  const bounds = new THREE.Box3();
  frame.traverse(object => {
    if (!object.isMesh || !object.geometry?.attributes?.position) return;
    object.geometry.computeBoundingBox();
    const transform = inverse.clone().multiply(object.matrixWorld);
    bounds.union(object.geometry.boundingBox.clone().applyMatrix4(transform));
  });
  return bounds;
};
function glbChunks(bytes) {
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
  assert.ok(json && binary, 'Atlas asset is a binary glTF with JSON and geometry chunks');
  return { json, binary };
}
// Materials are irrelevant to transform/geometry contracts. Removing their
// references lets GLTFLoader parse the production binary without browser image decoders.
function withoutMaterials(bytes) {
  const { json, binary } = glbChunks(bytes);
  for (const mesh of json.meshes ?? []) for (const primitive of mesh.primitives ?? []) delete primitive.material;
  delete json.materials;delete json.textures;delete json.images;delete json.samplers;
  const encoded = new TextEncoder().encode(JSON.stringify(json));
  const jsonLength = (encoded.length + 3) & ~3, binaryLength = (binary.length + 3) & ~3;
  const output = new Uint8Array(12 + 8 + jsonLength + 8 + binaryLength);
  const view = new DataView(output.buffer);
  view.setUint32(0, 0x46546c67, true);view.setUint32(4, 2, true);view.setUint32(8, output.length, true);
  view.setUint32(12, jsonLength, true);view.setUint32(16, 0x4e4f534a, true);
  output.fill(0x20, 20, 20 + jsonLength);output.set(encoded, 20);
  const binaryOffset = 20 + jsonLength;
  view.setUint32(binaryOffset, binaryLength, true);view.setUint32(binaryOffset + 4, 0x004e4942, true);
  output.set(binary, binaryOffset + 8);
  return output.buffer;
}
function accessorRgbRange(json, binary, accessorIndex) {
  const accessor = json.accessors[accessorIndex];
  const view = json.bufferViews[accessor.bufferView];
  assert.ok(accessor && view && !accessor.sparse, 'contact colour uses a dense glTF accessor');
  const componentCount = { VEC3: 3, VEC4: 4 }[accessor.type];
  const componentBytes = { 5121: 1, 5123: 2, 5126: 4 }[accessor.componentType];
  assert.ok(componentCount && componentBytes, `supported COLOR_0 encoding: ${accessor.componentType}/${accessor.type}`);
  const data = new DataView(binary.buffer, binary.byteOffset, binary.byteLength);
  const start = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const stride = view.byteStride ?? componentBytes * componentCount;
  const read = (offset) => {
    if (accessor.componentType === 5121) return data.getUint8(offset);
    if (accessor.componentType === 5123) return data.getUint16(offset, true);
    return data.getFloat32(offset, true);
  };
  const divisor = accessor.normalized && accessor.componentType !== 5126
    ? (accessor.componentType === 5121 ? 255 : 65535) : 1;
  let minimum = Infinity, maximum = -Infinity;
  for (let vertex = 0; vertex < accessor.count; vertex++) {
    for (let channel = 0; channel < 3; channel++) {
      const value = read(start + vertex * stride + channel * componentBytes) / divisor;
      assert.ok(Number.isFinite(value), `COLOR_0 contains a non-finite value at vertex ${vertex}`);
      minimum = Math.min(minimum, value);maximum = Math.max(maximum, value);
    }
  }
  return { minimum, maximum };
}
const ancestryNames = object => {
  const names = [];
  for (; object; object = object.parent) names.push(object.name);
  return names;
};
function pressureRayHit(scene, { label, origin, direction, range, ancestor }) {
  const raycaster = new THREE.Raycaster(
    point(...origin),
    point(...direction).normalize(),
    0.001,
    range[1],
  );
  const hit = raycaster.intersectObject(scene, true)[0];
  assert.ok(hit, `${label} ray escaped the pressure envelope`);
  assert.ok(hit.distance >= range[0] && hit.distance <= range[1],
    `${label} first hit was ${hit.distance.toFixed(3)} m, expected ${range[0]}..${range[1]} m`);
  const ancestry = ancestryNames(hit.object);
  assert.ok(ancestry.includes(ancestor),
    `${label} hit ${ancestry.filter(Boolean).join(' < ')} instead of ${ancestor}`);
  return hit;
}
const settle = (systems, rider = null) => {
  for (let i = 0; i < 1000 && (systems.elevator.moving || systems.ramps.some(ramp => ramp.moving)
    || systems.gates.some(gate => gate.moving)); i++) {
    const carry = systems.update(1 / 60, rider);
    if (rider) rider.y += carry;
  }
};

test('physical control verbs follow lift/ramp interlocks and support the shared hangar contract', () => {
  const systems = new AtlasMarkIISystems();settle(systems);
  const rider = point(5.5, 4.35, -4);
  assert.equal(describeAtlasControl(systems, rider).action, 'Go up');
  assert.equal(systems.toggleElevator(rider), true);
  assert.equal(describeAtlasControl(systems, rider).enabled, false);
  assert.equal(describeAtlasControl(systems, rider).action, 'Securing gates');
  settle(systems, rider);
  assert.equal(describeAtlasControl(systems, rider).action, 'Go down');
  assert.equal(describeAtlasControl(systems, point(3.5, 4.35, -4)).action, 'Call lift');
  assert.equal(describeAtlasControl(systems, point(3.5, 11.25, -4)).enabled, false);
  assert.equal(describeAtlasControl(systems, point(-4.5, 4.35, -21.5)).action, 'Open ramp');
  systems.toggleRamp('front');
  assert.equal(describeAtlasControl(systems, point(-4.5, 4.35, -21.5)).enabled, false);
  settle(systems);
  assert.equal(describeAtlasControl(systems, point(-4.5, 4.35, -21.5)).action, 'Close ramp');
  assert.equal(controlAction('hangar', 'closed').action, 'Open hangar');
  assert.equal(controlAction('hangar', 'opening').enabled, false);
  assert.throws(() => controlAction('hangar', 'unknown'), /Unknown physical control state/);
});

test('projected labels hide behind the camera and opaque structure, but allow glazing', () => {
  const camera = new THREE.PerspectiveCamera(55, 1.6, .1, 100);
  const viewport = { width: 1440, height: 900 };
  assert.deepEqual(projectActionAnchor([0, 0, -2], camera, viewport), { x: 720, y: 450 });
  assert.equal(projectActionAnchor([0, 0, 2], camera, viewport), null);
  assert.equal(projectActionAnchor([10, 0, -2], camera, viewport), null);
  const wall = new THREE.Mesh(new THREE.BoxGeometry(.5, .5, .1), new THREE.MeshBasicMaterial());
  wall.position.z = -1;wall.updateMatrixWorld(true);
  assert.equal(projectActionAnchor([0, 0, -2], camera, viewport, wall), null);
  wall.material.transparent = true;wall.material.opacity = .2;
  assert.ok(projectActionAnchor([0, 0, -2], camera, viewport, wall));
  wall.geometry.dispose();wall.material.dispose();
});

test('inspection MFD pages expose actual actuator state and explicit disconnected flight data', () => {
  const systems = new AtlasMarkIISystems();settle(systems);
  const initial = atlasInspectionPages(systems);
  assert.equal(initial.length, 4);
  assert.deepEqual(initial[2].rows.map(row => row[1]), ['CLOSED', 'CLOSED', 'CARGO DECK']);
  assert.equal(initial[0].rows[1][1], 'NOT CONNECTED');
  assert.equal(initial[3].rows[2][1], 'NOT CONNECTED');
  systems.toggleRamp('front');
  assert.equal(atlasInspectionPages(systems)[2].rows[0][1], 'OPENING');
  settle(systems);
  assert.equal(atlasInspectionPages(systems)[2].rows[0][1], 'OPEN');
});

test('shared S1, S2 and S3 slots have coherent metre-scale fitting geometry', () => {
  assert.deepEqual(mountStandard.coordinateSystem, {
    origin: 'centre of docking plane', normal: '+Y', bore: '-Z', right: '+X',
  });
  assert.deepEqual(mountStandard.geometrySlots.map(slot => slot.id), ['S1', 'S2', 'S3']);
  for (const slot of mountStandard.geometrySlots) {
    assert.equal(slot.size, Number(slot.id.slice(1)));
    assert.ok(slot.clearanceEnvelope.diameter > slot.dockingDiameter);
    assert.ok(slot.boltPattern.pitchCircleDiameter + slot.boltPattern.holeDiameter < slot.dockingDiameter);
    assert.equal(slot.boltPattern.firstBoltDirection, '+X');
    assert.equal(slot.provisionalPackageEnvelope.status, 'provisional');
  }
  assert.equal(mountGeometrySlot(1).dockingDiameter, 0.5);
  assert.equal(mountGeometrySlot(3).dockingDiameter, 1.25);
  assert.deepEqual(mountGeometrySlot(1).provisionalPackageEnvelope, {
    shape: 'box', min: [-0.45, 0, -3], max: [0.45, 0.9, 0.3], status: 'provisional',
  });
  assert.deepEqual(mountGeometrySlot(3).provisionalPackageEnvelope, {
    shape: 'box', min: [-0.9, 0, -7], max: [0.9, 2.4, 0.6], status: 'provisional',
  });
  assert.equal(NOMAD_FUTURE_S1_ATTACHMENT.size, 1);
  assert.equal(NOMAD_FUTURE_S1_ATTACHMENT.kind, 'debug-fitting-gauge');
  assert.equal(new Set(layout.mounts.map(mount => mount.node)).size, 3);
  assert.ok(layout.mounts.every(mount => mount.size === 3 && mountGeometrySlot(mount.size).id === 'S3'));
});

test('mount compatibility is exact by default and rejects unknown sizes', () => {
  assert.equal(mountAccepts({ size: 3 }, { size: 3 }), true);
  assert.equal(mountAccepts({ size: 3 }, { size: 1 }), false);
  assert.equal(mountAccepts({ size: 3 }, { size: 1 }, { exactSize: false }), true);
  assert.equal(mountAccepts({ size: 1 }, { size: 3 }, { exactSize: false }), false);
  assert.throws(() => mountGeometrySlot(4), /S1, S2, S3/);
  assert.throws(() => mountAccepts({ size: 3 }, { size: NaN }), /Attachment size/);
  assert.throws(() => mountAccepts({ size: '3' }, { size: 3 }), /Mount size/);
});

test('a compatible attachment mates to the exported named-node world transform', () => {
  const root = new THREE.Group();
  root.position.set(12, 4, -8);
  root.rotation.set(0.1, -0.4, 0.2);
  const carrier = new THREE.Group();
  carrier.position.set(-3, 2, 5);
  const node = new THREE.Object3D();
  node.name = layout.mounts[0].node;
  node.position.fromArray(layout.mounts[0].position);
  node.rotation.fromArray(layout.mounts[0].rotation);
  carrier.add(node);root.add(carrier);

  const transform = mountTransformFromAsset(root, layout.mounts[0], { size: 3 });
  root.updateMatrixWorld(true);
  assert.ok(transform.equals(node.matrixWorld));
  const matedOrigin = point(0, 0, 0).applyMatrix4(transform);
  assert.ok(matedOrigin.distanceTo(node.getWorldPosition(new THREE.Vector3())) < 1e-10);
  const boreEnd = point(0, 0, -1).applyMatrix4(transform);
  assert.ok(boreEnd.clone().sub(matedOrigin).normalize().dot(
    new THREE.Vector3(0, 0, -1).applyQuaternion(node.getWorldQuaternion(new THREE.Quaternion())),
  ) > 1 - 1e-12);
  assert.throws(
    () => mountTransformFromAsset(root, layout.mounts[0], { size: 1 }),
    /S1 attachment does not fit S3 mount/,
  );
  assert.throws(
    () => mountTransformFromAsset(root, { ...layout.mounts[0], node: 'Missing' }, { size: 3 }),
    /missing mount node/,
  );
});

test('fitting gauges are explicitly debug-only interface geometry', () => {
  const gauge = createMountFittingGauge(3);
  assert.equal(gauge.userData.debugOnly, true);
  assert.equal(gauge.userData.mountSize, 3);
  assert.match(gauge.name, /fitting gauge \(debug only\)/);
  assert.ok(gauge.getObjectByName('S3 clearance envelope'));
  assert.ok(gauge.getObjectByName('S3 docking plane'));
  assert.ok(gauge.getObjectByName('S3 bore axis (-Z)'));
});

test('ramp states bind to asset nodes, animate to exact layout angles and expose snapshots', () => {
  assert.equal(layout.cargo.floor, 2.6);
  assert.equal(layout.upper.floor, 9.5);
  assert.deepEqual([layout.upper.minX, layout.upper.maxX], [-7.2, 7.2]);
  assert.deepEqual([layout.elevator.low, layout.elevator.high], [2.6, 9.5]);
  assert.equal(layout.ramps[0].closedAngle, Math.PI / 2);
  assert.equal(layout.ramps[1].closedAngle, -Math.PI / 2);
  assert.ok(Math.abs(layout.ramps[0].openAngle + Math.asin(2.6 / 8)) < 1e-15);
  assert.ok(Math.abs(layout.ramps[1].openAngle - Math.asin(2.6 / 8)) < 1e-15);
  const root = new THREE.Group();
  for (const name of [layout.elevator.node, ...layout.elevator.gateNodes]) {
    const node = new THREE.Object3D();node.name = name;root.add(node);
  }
  for (const definition of layout.ramps) {
    const ramp = new THREE.Object3D();ramp.name = definition.node;root.add(ramp);
    const tip = new THREE.Object3D();tip.name = definition.tipNode;ramp.add(tip);
  }
  const systems = new AtlasMarkIISystems().bind(root);
  assert.deepEqual(systems.snapshot.ramps.map(ramp => ramp.angle), layout.ramps.map(ramp => ramp.closedAngle));
  assert.deepEqual(systems.snapshot.ramps.map(ramp => ramp.node), ['RampFront', 'RampAft']);
  assert.deepEqual(systems.snapshot.ramps.map(ramp => ramp.pivot), layout.ramps.map(ramp => ramp.pivot));
  assert.equal(systems.elevator.nodeObject.position.y, layout.elevator.low);
  settle(systems);
  assert.equal(systems.gates[0].nodeObject.position.z, -2.25);
  assert.equal(systems.gates[1].nodeObject.position.z, -4);
  assert.equal(systems.toggleRamp('front', { occupied: true }), false);
  assert.equal(systems.toggleRamp('front'), true);
  assert.equal(systems.toggleRamp('aft'), true);
  assert.equal(systems.toggleRamp('front'), false);
  settle(systems);
  for (const definition of layout.ramps) {
    const state = systems.ramps.find(ramp => ramp.id === definition.id);
    assert.equal(state.angle, definition.openAngle);
    assert.equal(state.nodeObject.rotation.x, definition.openAngle);
    assert.equal(state.tipAngle, 0);
    assert.equal(state.tipNodeObject.rotation.x, 0);
  }
  assert.deepEqual(systems.snapshot.ramps.map(ramp => ramp.progress), [1, 1]);
  for (const name of [...layout.elevator.gateNodes, ...layout.ramps.map(ramp => ramp.tipNode)]) {
    root.getObjectByName(name).removeFromParent();
  }
  assert.doesNotThrow(() => new AtlasMarkIISystems().bind(root));
  assert.throws(() => new AtlasMarkIISystems().bind(new THREE.Group()), /RampFront/);
});

test('open ramps provide their authored incline and closed ramps block swept exit', () => {
  const systems = new AtlasMarkIISystems();
  const cargoEye = layout.cargo.floor + layout.eyeHeight;
  const insideFront = point(0, cargoEye, -23.5);
  const outsideFront = point(0, cargoEye, -24.5);
  const aftGround = point(0, layout.eyeHeight, 34);
  const aftInterior = point(0, cargoEye, 23);
  assert.deepEqual(systems.constrain(insideFront, outsideFront), insideFront);
  assert.deepEqual(systems.constrain(aftGround, aftInterior), aftGround);
  assert.equal(systems.toggleRamp('front'), true);
  assert.equal(systems.toggleRamp('aft'), true);
  settle(systems);
  assert.deepEqual(systems.constrain(insideFront, outsideFront), outsideFront);
  assert.deepEqual(
    systems.constrain(point(8, layout.eyeHeight, 34), point(6.2, cargoEye, 23)),
    point(8, layout.eyeHeight, 34),
  );

  for (const definition of layout.ramps) {
    const horizontal = definition.length * Math.cos(definition.openAngle);
    for (const fraction of [0, 0.5, 1]) {
      const distance = horizontal * fraction;
      const z = definition.pivot[2] + definition.outward * distance;
      const expectedFloor = definition.pivot[1]
        - definition.outward * distance * Math.tan(definition.openAngle);
      assert.ok(Math.abs(systems.floorAt(point(0, expectedFloor + layout.eyeHeight, z)) - expectedFloor) < 1e-10);
    }
  }
  const front = layout.ramps[0], length = front.length * Math.cos(front.openAngle);
  const midZ = front.pivot[2] + front.outward * length / 2;
  const midFloor = front.pivot[1] - front.outward * length / 2 * Math.tan(front.openAngle);
  const onRamp = point(0, midFloor + layout.eyeHeight, midZ);
  assert.deepEqual(systems.constrain(onRamp, point(7, onRamp.y, midZ)), onRamp);
  assert.equal(systems.toggleRamp('front'), true);
  assert.deepEqual(systems.constrain(outsideFront, insideFront), outsideFront);
  settle(systems);
  assert.equal(systems.floorAt(onRamp), null);
});

test('elevator carries a centred walker exactly and blocks escape while moving', () => {
  const systems = new AtlasMarkIISystems();
  settle(systems);
  const [x, z] = layout.elevator.centre;
  const rider = point(x, layout.elevator.low + layout.eyeHeight, z);
  assert.equal(systems.floorAt(rider), layout.elevator.low);
  assert.equal(systems.interactionAt(rider), 'elevator:crew');
  assert.equal(systems.toggleElevator(rider), true);
  while (systems.elevator.waitingForGates) {
    const carry = systems.update(0.1, rider);
    assert.equal(carry, 0, 'landing gate closes before lift translation');
    assert.equal(systems.elevator.y, layout.elevator.low);
  }
  assert.ok(systems.gates.every(gate => gate.z === -4));
  const priorY = rider.y, carry = systems.update(1 / 60, rider);
  rider.y += carry;
  assert.ok(carry > 0);
  assert.ok(Math.abs((rider.y - priorY) - carry) < 1e-12);
  assert.ok(Math.abs((rider.y - layout.eyeHeight) - systems.elevator.y) < 1e-12);
  assert.deepEqual(systems.constrain(rider, point(3, rider.y, z)), rider);
  settle(systems, rider);
  assert.equal(systems.elevator.y, layout.elevator.high);
  assert.ok(Math.abs(rider.y - layout.elevator.high - layout.eyeHeight) < 1e-12);
  assert.equal(systems.floorAt(rider), layout.elevator.high);
});

test('empty-shaft gates block both decks, call panels summon the lift and leave the through lane clear', () => {
  const systems = new AtlasMarkIISystems();
  settle(systems);
  const [x, z] = layout.elevator.centre;
  const lowerOutside = point(3.5, layout.cargo.floor + layout.eyeHeight, z);
  const lowerShaft = point(x, lowerOutside.y, z);
  assert.deepEqual(systems.constrain(lowerOutside, lowerShaft), lowerShaft);
  assert.deepEqual(
    systems.constrain(point(x, lowerOutside.y, -6.5), lowerShaft),
    point(x, lowerOutside.y, -6.5),
    'platform end rail blocks entry',
  );
  assert.deepEqual(
    systems.constrain(point(7.2, lowerOutside.y, z), lowerShaft),
    point(7.2, lowerOutside.y, z),
    'platform starboard rail blocks entry',
  );
  assert.deepEqual(
    systems.constrain(point(3.5, lowerOutside.y, -5.2), point(5, lowerOutside.y, -5.2)),
    point(3.5, lowerOutside.y, -5.2),
    'split port rail blocks entry outside its central opening',
  );
  assert.equal(systems.toggleElevator(lowerShaft), true);settle(systems);
  assert.deepEqual(systems.constrain(lowerOutside, lowerShaft), lowerOutside);

  const upperOutside = point(3.5, layout.upper.floor + layout.eyeHeight, z);
  const upperShaft = point(x, upperOutside.y, z);
  assert.deepEqual(systems.constrain(upperOutside, upperShaft), upperShaft);
  assert.equal(systems.interactionAt(lowerOutside), 'elevator:crew');
  assert.equal(systems.toggleElevator(point(3.9, lowerOutside.y, z)), false);
  assert.equal(systems.toggleElevator(lowerOutside), true);settle(systems);
  assert.equal(systems.elevator.y, layout.elevator.low);
  assert.deepEqual(systems.constrain(upperOutside, upperShaft), upperOutside);

  const front = point(0, layout.cargo.floor + layout.eyeHeight, -23);
  const aft = point(0, front.y, 23);
  assert.deepEqual(systems.constrain(front, aft), aft);
  assert.equal(systems.floorAt(point(0, layout.cargo.floor + layout.eyeHeight, 0)), layout.cargo.floor);
  assert.equal(systems.floorAt(point(0, layout.upper.floor + layout.eyeHeight, 0)), layout.upper.floor);
  assert.equal(systems.floorAt(point(8, layout.upper.floor + layout.eyeHeight, 0)), null);
  assert.equal(systems.interactionAt(point(...layout.stand)), 'seat');
  const [controlX, controlY, controlZ] = layout.ramps[0].control;
  assert.equal(systems.interactionAt(point(controlX, controlY + layout.eyeHeight, controlZ)), 'ramp:front');
  assert.equal(systems.toggleRamp('missing'), false);
});

test('authored furniture and bulkhead AABBs block swept capsules while keeping designed routes clear', () => {
  assert.equal(colliderData.version, 1);
  assert.equal(new Set(colliderData.colliders.map(collider => collider.id)).size, colliderData.colliders.length);
  for (const collider of colliderData.colliders) {
    assert.equal(collider.min.length, 3);assert.equal(collider.max.length, 3);
    assert.ok(collider.min.every((value, axis) => Number.isFinite(value) && value < collider.max[axis]), collider.id);
  }
  const systems = new AtlasMarkIISystems();settle(systems);
  const cargoEye = layout.cargo.floor + layout.eyeHeight;
  const upperEye = layout.upper.floor + layout.eyeHeight;

  const cargoLane = point(0, cargoEye, -23), aftLane = point(0, cargoEye, 23);
  assert.deepEqual(systems.constrain(cargoLane, aftLane), aftLane, 'central cargo drive lane stays clear');
  const besideRack = point(-3.5, cargoEye, -7), intoRack = point(-5, cargoEye, -7);
  assert.deepEqual(systems.constrain(besideRack, intoRack), besideRack, 'cargo rack blocks a swept low-deck step');
  assert.deepEqual(
    systems.constrain(point(-3.5, upperEye, -7), point(-5, upperEye, -7)),
    point(-5, upperEye, -7),
    'low-deck rack does not create an upper-deck phantom wall',
  );

  const bridgeDoorAft = point(0, upperEye, -11), bridgeDoorForward = point(0, upperEye, -13);
  assert.deepEqual(systems.constrain(bridgeDoorAft, bridgeDoorForward), bridgeDoorForward,
    'bridge centre doorway remains open');
  assert.deepEqual(
    systems.constrain(point(2, upperEye, -11), point(2, upperEye, -13)),
    point(2, upperEye, -11),
    'bridge bulkhead blocks off-door passage',
  );
  assert.deepEqual(
    systems.constrain(point(0, upperEye, 3), point(-3.1, upperEye, 3)),
    point(-3.1, upperEye, 3),
    'crew port partition doorway remains open',
  );
  assert.deepEqual(
    systems.constrain(point(0, upperEye, 1.5), point(-3.1, upperEye, 1.5)),
    point(0, upperEye, 1.5),
    'crew partition blocks passage outside its doorway',
  );

  const approach = point(layout.stand[0], layout.stand[1], -19.5);
  const stand = point(...layout.stand);
  assert.deepEqual(systems.constrain(approach, stand), stand, 'pilot stand point remains capsule-reachable');
  assert.deepEqual(
    systems.constrain(stand, point(stand.x, stand.y, -21)),
    stand,
    'pilot seat blocks walking through its back pad',
  );
});

test('tapered bridge cheeks keep the full walker capsule inside the pressure footprint', () => {
  const systems = new AtlasMarkIISystems();settle(systems);
  const footprint = layout.bridge.pressureFootprint;
  assert.deepEqual(footprint, {
    aftZ: -17.8, aftHalfWidth: 7.2, frontZ: -25, frontHalfWidth: 4.8,
  });
  const eyeY = layout.upper.floor + layout.eyeHeight;
  // Sample the passage between the forward instrument console and seat backs.
  const z = -22.2;
  const progress = (z - footprint.frontZ) / (footprint.aftZ - footprint.frontZ);
  const halfWidth = THREE.MathUtils.lerp(footprint.frontHalfWidth, footprint.aftHalfWidth, progress);
  const slope = (footprint.aftHalfWidth - footprint.frontHalfWidth)
    / (footprint.aftZ - footprint.frontZ);
  const capsuleLimit = halfWidth - layout.capsuleRadius * Math.hypot(1, slope);
  const centre = point(0, eyeY, z);
  for (const side of [-1, 1]) {
    const safe = point(side * (capsuleLimit - 0.05), eyeY, z);
    const throughCheek = point(side * (capsuleLimit + 0.05), eyeY, z);
    assert.deepEqual(systems.constrain(centre, safe), safe, `bridge ${side} safe lane remains reachable`);
    assert.deepEqual(systems.constrain(safe, throughCheek), safe,
      `bridge ${side} cheek blocks the capsule before its centre crosses the visible shell`);
  }
  assert.equal(systems.floorAt(point(halfWidth - 0.02, eyeY, z)), layout.upper.floor,
    'the tapered sole exists up to its authored pressure edge');
  assert.equal(systems.floorAt(point(halfWidth + 0.02, eyeY, z)), null,
    'the rectangular upper-deck fallback does not project floor beyond a bridge cheek');
});

test('crew end walls block escape while the full bunk aisle remains reachable', () => {
  const systems = new AtlasMarkIISystems();settle(systems);
  const y = layout.upper.floor + layout.eyeHeight;
  const doorway = point(0, y, 3);
  const entry = point(-3.1, y, 3);
  const aft = point(-3.1, y, 16.2);
  assert.deepEqual(systems.constrain(doorway, entry), entry, 'crew doorway admits a standing capsule');
  assert.deepEqual(systems.constrain(entry, aft), aft, 'all three berths are accessible past the fold desk');
  assert.deepEqual(systems.constrain(aft, point(-3.1, y, 17.6)), aft, 'aft bulkhead blocks escape');
  assert.deepEqual(systems.constrain(entry, point(-3.1, y, 0)), entry, 'forward bulkhead blocks escape');
  assert.deepEqual(systems.constrain(aft, entry), entry, 'the same aisle permits return to the doorway');
});

test('galley and hygiene circulation stays capsule-clear while fixtures remain solid', () => {
  const systems = new AtlasMarkIISystems();settle(systems);
  const upperEye = layout.upper.floor + layout.eyeHeight;
  const radius = layout.capsuleRadius;
  const collider = id => colliderData.colliders.find(item => item.id === id);
  const partition = collider('starboard-corridor-partition-middle');
  const messCounter = collider('galley-cabinet-wall-mess');
  const basin = collider('hygiene-basin');
  assert.ok(partition && messCounter && basin, 'galley and hygiene collider bands are authored');
  const aisleMinX = partition.max[0] + radius;
  const aisleMaxX = messCounter.min[0] - radius;
  assert.ok(aisleMaxX - aisleMinX >= 1.6,
    `galley aisle leaves only ${(aisleMaxX - aisleMinX).toFixed(2)} m for capsule centres`);

  const corridor = point(0, upperEye, 2.8);
  const galleyAisle = point(2.5, upperEye, 2.8);
  const hygieneThreshold = point(2.5, upperEye, 12.2);
  const basinApproach = point(2.5, upperEye, 13.9);
  assert.deepEqual(systems.constrain(corridor, galleyAisle), galleyAisle,
    'the z=2.8 galley doorway admits the walker capsule');
  assert.deepEqual(systems.constrain(galleyAisle, hygieneThreshold), hygieneThreshold,
    'the wall-mounted mess counter leaves a straight route to hygiene');
  assert.deepEqual(systems.constrain(hygieneThreshold, point(0, upperEye, 12.2)), point(0, upperEye, 12.2),
    'the z=12.2 hygiene doorway remains open to the central corridor');
  assert.deepEqual(systems.constrain(hygieneThreshold, basinApproach), basinApproach,
    'the inward hygiene walkway reaches the basin approach');
  assert.deepEqual(
    systems.constrain(basinApproach, point(2.5, upperEye, 15.2)),
    basinApproach,
    'the basin remains a physical downstream fixture rather than ghost geometry',
  );
});

test('exported Atlas Mark II GLB preserves metre scale, system pivots and mount flange frames', async () => {
  const bytes = await readFile(new URL('../public/models/atlas-mark-ii/atlas-mark-ii.glb', import.meta.url));
  const { scene } = await new GLTFLoader().parseAsync(withoutMaterials(bytes), '');
  scene.updateMatrixWorld(true);

  nearVector(scene.scale, point(1, 1, 1), 1e-12);
  const bounds = new THREE.Box3().setFromObject(scene);
  for (let axis = 0; axis < 3; axis++) {
    assert.ok(bounds.min.getComponent(axis) >= layout.hull.min[axis] - 0.2, `hull min ${axis}: ${bounds.min.toArray()}`);
    assert.ok(bounds.max.getComponent(axis) <= layout.hull.max[axis] + 0.2, `hull max ${axis}: ${bounds.max.toArray()}`);
  }
  const size = bounds.getSize(new THREE.Vector3());
  const bow = scene.getObjectByName('LoadingBow');
  assert.ok(bow && boundsInFrame(bow).min.y >= 4.95,
    'loading arch feet terminate in the bow cheeks instead of piercing the lower front armour');
  assert.ok(size.x > 34 && size.y > 14 && size.z > 61.5, `metre-scale hull is ${size.toArray()}`);
  assert.ok(bounds.min.z < -30.8 && bounds.max.z > 30.8,
    `shaped bow and stern survive export: ${bounds.min.z}..${bounds.max.z}`);
  assert.ok(Math.abs(bounds.min.z + bounds.max.z) < 0.1,
    `bow and stern remain longitudinally balanced: ${bounds.min.z}..${bounds.max.z}`);

  const rampDefinitions = [];
  assert.equal(layout.pilotMFDs.length, 4);
  for (const definition of layout.pilotMFDs) {
    const anchor = scene.getObjectByName(definition.node);
    assert.ok(anchor && !anchor.isMesh, `${definition.node} is an exported physical screen anchor`);
    nearVector(anchor.getWorldPosition(new THREE.Vector3()), point(...definition.position));
    const expected = new THREE.Quaternion().setFromEuler(new THREE.Euler(...definition.rotation));
    assert.ok(Math.abs(anchor.getWorldQuaternion(new THREE.Quaternion()).dot(expected)) > 1 - 1e-7);
    const localBounds = boundsInFrame(anchor);
    assert.ok(localBounds.min.x <= -definition.width / 2 && localBounds.max.x >= definition.width / 2);
    assert.ok(localBounds.min.y <= -definition.height / 2 && localBounds.max.y >= definition.height / 2);
  }
  for (const definition of layout.ramps) {
    const pivot = scene.getObjectByName(definition.node);
    assert.ok(pivot && !pivot.isMesh, `${definition.node} remains an animatable named pivot`);
    nearVector(pivot.getWorldPosition(new THREE.Vector3()), point(...definition.pivot));
    const expected = new THREE.Quaternion().setFromEuler(new THREE.Euler(definition.closedAngle, 0, 0, 'XYZ'));
    assert.ok(Math.abs(pivot.getWorldQuaternion(new THREE.Quaternion()).dot(expected)) > 1 - 1e-7,
      `${definition.node} retains its closed rotation`);
    const rampBounds = boundsInFrame(pivot);
    assert.ok(rampBounds.min.x < -definition.width / 2 && rampBounds.max.x > definition.width / 2,
      `${definition.node} retains its full-width hinge geometry`);
    assert.ok(definition.outward < 0
      ? rampBounds.min.z < -definition.hingeLength
      : rampBounds.max.z > definition.hingeLength,
    `${definition.node} geometry remains in its authored local direction`);
    assert.ok(rampBounds.min.y < -0.5 && rampBounds.max.y > 0.65,
      `${definition.node} local deck and hinge height survive batching`);
    rampDefinitions.push(definition);
  }

  const lift = scene.getObjectByName(layout.elevator.node);
  assert.ok(lift && !lift.isMesh, `${layout.elevator.node} remains an animatable named pivot`);
  nearVector(lift.getWorldPosition(new THREE.Vector3()), point(
    layout.elevator.centre[0], layout.elevator.low, layout.elevator.centre[1],
  ));
  const liftBounds = boundsInFrame(lift);
  nearVector(liftBounds.min, point(-1.4, -0.32, -1.8), 0.03);
  nearVector(liftBounds.max, point(1.4, 1.32, 1.8), 0.03);
  for (const [index, name] of layout.elevator.gateNodes.entries()) {
    const gate = scene.getObjectByName(name);
    assert.ok(gate && !gate.isMesh, `${name} remains an animatable landing gate pivot`);
    const deck = index === 0 ? layout.elevator.low : layout.elevator.high;
    nearVector(gate.getWorldPosition(new THREE.Vector3()), point(4.2, deck, -4));
    const gateBounds = boundsInFrame(gate);
    nearVector(gateBounds.min, point(-0.064, 0.83, -0.75), 0.03);
    nearVector(gateBounds.max, point(0.064, 1.07, 0.75), 0.03);
  }

  for (const definition of layout.mounts) {
    const node = scene.getObjectByName(definition.node);
    assert.ok(node && !node.isMesh, `${definition.node} remains a named attachment frame`);
    nearVector(node.getWorldPosition(new THREE.Vector3()), point(...definition.position));
    const expected = new THREE.Quaternion().setFromEuler(new THREE.Euler(...definition.rotation, 'XYZ'));
    assert.ok(Math.abs(node.getWorldQuaternion(new THREE.Quaternion()).dot(expected)) > 1 - 1e-7,
      `${definition.node} orientation matches the +Y-normal/-Z-bore layout frame`);
    assert.ok(mountTransformFromAsset(scene, definition, { size: 3 }).equals(node.matrixWorld));
    const flange = boundsInFrame(node), radius = mountGeometrySlot(definition.size).dockingDiameter / 2;
    assert.ok(flange.min.x <= -radius && flange.max.x >= radius, `${definition.node} spans docking diameter on X`);
    assert.ok(flange.min.z <= -radius && flange.max.z >= radius, `${definition.node} spans docking diameter on Z`);
    assert.ok(flange.min.y < -0.15 && flange.max.y >= 0, `${definition.node} has geometry around its mating plane`);
  }
  for (const definition of rampDefinitions) {
    const tip = scene.getObjectByName(definition.tipNode);
    assert.ok(tip && !tip.isMesh, `${definition.tipNode} remains an animatable folding pivot`);
    nearVector(tip.position, point(0, definition.tipHingeHeight, definition.outward * definition.hingeLength));
    const tipClosed = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI, 0, 0, 'XYZ'));
    assert.ok(Math.abs(tip.quaternion.dot(tipClosed)) > 1 - 1e-7, `${definition.tipNode} retains its folded rotation`);
    const tipBounds = boundsInFrame(tip);
    assert.ok(tipBounds.min.x <= -definition.width / 2 && tipBounds.max.x >= definition.width / 2,
      `${definition.tipNode} retains the authored tip width`);
    assert.ok(definition.outward < 0
      ? tipBounds.min.z < -definition.tipLength + 0.03 && tipBounds.max.z < 0
      : tipBounds.max.z > definition.tipLength - 0.03 && tipBounds.min.z > 0,
    `${definition.tipNode} geometry remains in its authored local direction`);
  }
});

test('exported opaque geometry keeps authored base factors and finite, varying contact shading', async () => {
  const bytes = await readFile(new URL('../public/models/atlas-mark-ii/atlas-mark-ii.glb', import.meta.url));
  const { json, binary } = glbChunks(bytes);
  const expectedFactors = new Map([
    ['Atlas / dark', [0.035, 0.05, 0.057, 1]],
    ['Atlas / petrol', [0.025, 0.105, 0.115, 1]],
    ['Atlas / rubber', [0.017, 0.022, 0.024, 1]],
    ['Atlas / warning', [0.58, 0.37, 0.12, 1]],
  ]);
  for (const [name, expected] of expectedFactors) {
    const material = json.materials?.find(item => item.name === name);
    assert.ok(material, `${name} material is exported`);
    const actual = material.pbrMetallicRoughness?.baseColorFactor;
    assert.ok(actual, `${name} retains an explicit non-white base colour factor`);
    nearVector(point(...actual.slice(0, 3)), point(...expected.slice(0, 3)), 1e-5);
    assert.ok(Math.abs(actual[3] - expected[3]) < 1e-5, `${name} retains authored opacity`);
  }
  const shaded = [];
  for (const mesh of json.meshes ?? []) {
    for (const primitive of mesh.primitives ?? []) {
      if (primitive.attributes?.COLOR_0 === undefined || primitive.material === undefined) continue;
      const material = json.materials?.[primitive.material];
      const opaque = (material?.alphaMode ?? 'OPAQUE') === 'OPAQUE';
      const emissive = material?.emissiveFactor?.some(value => value > 0) ?? false;
      if (!opaque || emissive) continue;
      shaded.push({ mesh: mesh.name, ...accessorRgbRange(json, binary, primitive.attributes.COLOR_0) });
    }
  }
  assert.ok(shaded.length > 0, 'at least one opaque primitive exports a COLOR_0 contact-shading attribute');
  assert.ok(shaded.some(({ minimum, maximum }) => maximum - minimum > 1 / 255),
    'opaque contact shading contains more than one quantized brightness value');
  for (const { mesh, minimum, maximum } of shaded) {
    assert.ok(minimum >= 0 && maximum <= 1, `${mesh} contact shading stays in normalized RGB range`);
  }
});

test('exported pressure shell closes the bridge, roof seam, cargo doors and aft room', async () => {
  const bytes = await readFile(new URL('../public/models/atlas-mark-ii/atlas-mark-ii.glb', import.meta.url));
  const { scene } = await new GLTFLoader().parseAsync(withoutMaterials(bytes), '');
  scene.updateMatrixWorld(true);
  scene.traverse(object => {
    if (!object.isMesh) return;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      material.side = THREE.DoubleSide;
    }
  });

  const checks = [
    {
      label: 'crew forward wall at standing height', origin: [-3.1, 11.25, 2], direction: [0, 0, -1],
      range: [0.8, 1.1], ancestor: 'InteriorCrew',
    },
    {
      label: 'crew aft environmental bulkhead', origin: [-3.1, 11.25, 16], direction: [0, 0, 1],
      range: [0.65, 1.1], ancestor: 'InteriorCrew',
    },
    {
      label: 'lower cockpit pressure skirt', origin: [0, 9.9, -28], direction: [0, 0, 1],
      range: [1.9, 2.8], ancestor: 'PressureBridge',
    },
    {
      label: 'upper central pressure seam', origin: [0, 12.65, 0], direction: [0, 1, 0],
      range: [0.08, 0.4], ancestor: 'UpperHull',
    },
    {
      label: 'upper aft-room closure', origin: [0, 11, 17], direction: [0, 0, 1],
      range: [0.6, 1.0], ancestor: 'UpperHull',
    },
  ];
  for (const z of [-23, 23]) {
    for (const x of [-5.9, 5.9]) {
      checks.push({
        label: `${z < 0 ? 'front' : 'aft'} cargo-door ${x < 0 ? 'port' : 'starboard'} edge seal`,
        origin: [x, 4, z], direction: [0, 0, Math.sign(z)],
        range: [0.6, 1.2], ancestor: 'ExteriorStructure',
      });
    }
  }
  for (const check of checks) pressureRayHit(scene, check);
  for (const x of [-1.42, 1.42]) {
    const hits = new THREE.Raycaster(point(x, 11, 3), point(0, 0, -1), .001, 1.5)
      .intersectObject(scene, true);
    assert.ok(hits.length >= 2, 'door jamb and wall are both present');
    const jamb = hits[0];
    const wall = hits.find(hit => hit.object !== jamb.object);
    assert.ok(wall && wall.distance - jamb.distance >= .015,
      `door jamb at x=${x} overlaps the partition face in depth and can flicker`);
  }
  // The pre-existing removable service panel sits in front of the liner.
  // Target the room structure so it cannot conceal a missing back wall.
  pressureRayHit(scene.getObjectByName('InteriorCrew'), {
    label: 'crew outboard liner between bunks', origin: [-6.1, 10.7, 8.35], direction: [-1, 0, 0],
    range: [0.25, 0.5], ancestor: 'InteriorCrew',
  });

  // Check actual exported surfaces across the capsule width and body height,
  // independently of collider JSON: ceiling haunches cannot become ghost obstacles.
  for (const x of [-3.4, -3.1, -2.8]) {
    for (const y of [9.7, 10.4, 11.25, 11.5]) {
      const hits = new THREE.Raycaster(point(x, y, 3), point(0, 0, 1), .001, 13.2)
        .intersectObject(scene, true);
      assert.equal(hits.length, 0, `standing bunk-aisle sweep at x=${x}, y=${y} meets geometry`);
    }
  }

  const upperDeckHits = x => new THREE.Raycaster(
    point(x, 10, -24),
    point(0, -1, 0),
    0.001,
    0.8,
  ).intersectObject(scene, true).filter(hit => ancestryNames(hit.object).includes('InteriorUpper')
    && hit.point.y >= 9.25 && hit.point.y <= 9.55);
  assert.ok(upperDeckHits(4.8).length > 0, 'tapered bridge floor covers its authored interior');
  assert.ok(upperDeckHits(-4.8).length > 0, 'tapered bridge floor is symmetric');
  assert.equal(upperDeckHits(5.6).length, 0, 'bridge floor does not protrude through the starboard cheek');
  assert.equal(upperDeckHits(-5.6).length, 0, 'bridge floor does not protrude through the port cheek');
});
