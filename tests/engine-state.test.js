import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ENGINE_EXHAUST, engineExhaust, enginePresentation, updateShipEngineVisuals } from '../src/effects/engine-state.js';
import { SHIP_LAYOUT } from '../src/boarding.js';
import { shipHandling } from '../src/ship-handling.js';

const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const nav = (shipId = 'nomad') => ({ shipId, mode: 'flight', powered: true, cabinFlight: false,
  insideShip: false, boost: false, layout: SHIP_LAYOUT, orientation: new THREE.Quaternion(),
  shipOrientation: new THREE.Quaternion(), position: v(25e9, 3e9, -4e9), velocity: v(),
  shipVelocity: v(), engineAcceleration: v(), keys: new Set() });

test('each hull normalizes actual signed thrust by its own flight authority', () => {
  for (const shipId of Object.keys(ENGINE_EXHAUST)) {
    const live = nav(shipId), thrust = shipHandling(shipId).thrust;
    live.orientation.setFromAxisAngle(v(0, 1, 0), Math.PI / 3);
    live.engineAcceleration.copy(v(0, 0, -thrust * .4).applyQuaternion(live.orientation));
    const state = enginePresentation(live);
    assert.ok(Math.abs(state.forwardThrottle - .4) < 1e-10, shipId);
    assert.ok(Math.abs(state.throttle - .4) < 1e-10, shipId);
    assert.equal(state.state, 'forward');
    assert.ok(state.shipPosition.clone().add(v(...SHIP_LAYOUT.seatEye).applyQuaternion(live.orientation)).distanceTo(live.position) < .00001);
    assert.deepEqual(state.shipQuaternion, live.orientation);
  }
});

test('coasting, reverse and lateral braking do not claim aft thrust or boost', () => {
  const live = nav();
  live.velocity.set(0, 0, -1e6);live.keys.add('KeyW');live.boost = true;
  assert.equal(enginePresentation(live).forwardThrottle, 0);
  assert.equal(enginePresentation(live).state, 'idle');
  assert.equal(enginePresentation(live).boost, false);
  live.engineAcceleration.set(0, 0, shipHandling('nomad').thrust);
  let state = enginePresentation(live);
  assert.equal(state.signedForwardDemand, -1);assert.equal(state.forwardThrottle, 0);
  assert.equal(state.throttle, 1);assert.equal(state.state, 'reverse');assert.equal(state.boost, false);
  live.engineAcceleration.set(shipHandling('nomad').thrust / 2, 0, 0);
  state = enginePresentation(live);
  assert.equal(state.state, 'maneuvering');assert.equal(state.throttle, .5);
  assert.equal(state.forwardThrottle, 0);assert.equal(state.boost, false);
  live.engineAcceleration.set(0, 0, -shipHandling('nomad').thrust * 3);
  state = enginePresentation(live);
  assert.equal(state.signedForwardDemand, 3);assert.equal(state.forwardThrottle, 1);assert.equal(state.boost, true);
});

test('unseated flight follows the hull pose and velocity; walking sprint cannot boost it', () => {
  const live = nav('atlas');
  Object.assign(live, { mode: 'walk', cabinFlight: true, insideShip: true, boost: true, shipPosition: v(25e9, 3e9, -4e9) });
  live.shipOrientation.setFromAxisAngle(v(0, 1, 0), Math.PI / 2);
  live.orientation.setFromAxisAngle(v(1, 0, 0), .8);
  live.engineAcceleration.copy(v(0, 0, -14).applyQuaternion(live.shipOrientation));
  live.shipVelocity.set(-300, 2, 0);live.velocity.set(0, 0, 2);
  const state = enginePresentation(live);
  assert.equal(state.mode, 'walk');assert.equal(state.cabinFlight, true);assert.equal(state.flying, true);
  assert.deepEqual(state.shipPosition, live.shipPosition);assert.deepEqual(state.shipQuaternion, live.shipOrientation);
  assert.deepEqual(state.velocity, live.shipVelocity);assert.ok(state.forwardThrottle > .999);assert.equal(state.boost, false);
  assert.deepEqual(live.shipPosition, v(25e9, 3e9, -4e9), 'reading effects must not move the hull');
});

test('power-off, parked modes, travel, destruction and suspension suppress stale acceleration', () => {
  for (const [props, options, expected] of [
    [{ powered: false }, {}, 'off'], [{ mode: 'landed' }, {}, 'idle'],
    [{ mode: 'walk', cabinFlight: false }, {}, 'idle'], [{ travel: {} }, {}, 'travel'],
    [{ mode: 'crashed' }, {}, 'off'], [{ mode: 'destroyed' }, {}, 'off'], [{}, { suspended: true }, 'suspended'],
    [{ enabled: false }, {}, 'suspended'], [{ focused: false }, {}, 'suspended'],
  ]) {
    const live = Object.assign(nav(), props);live.engineAcceleration.set(0, 0, -100);live.boost = true;
    const state = enginePresentation(live, options);
    assert.equal(state.state, expected);assert.equal(state.throttle, 0);assert.equal(state.forwardThrottle, 0);assert.equal(state.boost, false);
  }
});

globalThis.ProgressEvent ??= class ProgressEvent { constructor(type, init = {}) { this.type = type;Object.assign(this, init); } };
async function loadGeometry(path) {
  const bytes = fs.readFileSync(new URL(path, import.meta.url)), length = bytes.readUInt32LE(12);
  const document = JSON.parse(bytes.subarray(20, 20 + length));
  document.buffers[0].uri = 'data:application/octet-stream;base64,' + bytes.subarray(20 + length + 8).toString('base64');
  // CPU checks real binary geometry; the parent's browser job owns image decoding.
  for (const material of document.materials ?? []) {
    for (const key of ['normalTexture', 'occlusionTexture', 'emissiveTexture']) delete material[key];
    for (const key of ['baseColorTexture', 'metallicRoughnessTexture']) if (material.pbrMetallicRoughness) delete material.pbrMetallicRoughness[key];
  }
  const { scene } = await new GLTFLoader().parseAsync(JSON.stringify(document), '');
  scene.userData.assetStatus = 'ready';scene.updateMatrixWorld(true);
  return scene;
}
const assets = {
  nomad: await loadGeometry('../public/models/nomad.glb'),
  atlas: await loadGeometry('../public/models/atlas.glb'),
  kestrel: await loadGeometry('../assets/kestrel/kestrel.glb'),
};

test('all three engine bindings align with the real shipped throats, not another hull', () => {
  for (const [id, root] of Object.entries(assets)) {
    const profile = engineExhaust(root, id);
    assert.equal(profile.sockets.length, 2, id);
    const drives = [];
    root.traverse(node => {
      if (node.isMesh && (node.name === 'EngineCores' || node.material.name === 'Drive / ion blue')) drives.push(node);
    });
    assert.ok(drives.length > 0, id);
    for (const spec of profile.sockets) {
      const start = v(...spec.position).add(v(0, 0, .2));
      const hit = new THREE.Raycaster(start, v(0, 0, -1), 0, 1).intersectObjects(drives, false)[0];
      assert.ok(hit, `${id}: socket ${spec.position} must face the actual emissive throat`);
      // Kestrel's luminous liner is deliberately recessed .68 m behind its
      // authored AB root; Nomad's throat is .54 m inside its open nozzle lip.
      const [near, far] = { nomad: [.71, .78], atlas: [.20, .27], kestrel: [.85, .91] }[id];
      assert.ok(hit.distance > near && hit.distance < far, `${id}: ${hit.distance} m between test ray and throat`);
      const ringEdge = start.clone().add(v(profile.radius * .75, 0, 0));
      assert.ok(new THREE.Raycaster(ringEdge, v(0, 0, -1), 0, 1).intersectObjects(drives, false).length, `${id}: plume radius fits the throat`);
      if (spec.node) {
        const node = root.getObjectByName(spec.node);node.geometry.computeBoundingBox();
        assert.ok(Math.abs(node.geometry.boundingBox.max.x - profile.radius) < .00001, 'Kestrel motes use the authored cone radius');
      }
    }
  }
});

test('Kestrel authored sockets resolve locally even under a rotated large-world render pose', () => {
  const root = assets.kestrel.clone(true);
  root.position.set(382.25, -114.5, 21);root.quaternion.setFromAxisAngle(v(0, 1, 0), .73);
  const profile = engineExhaust(root, 'kestrel');
  assert.equal(profile.authoredCones, true);
  profile.sockets.forEach((spec, i) => assert.ok(v(...spec.position).distanceTo(v(...ENGINE_EXHAUST.kestrel.sockets[i].position)) < .00001));
  root.userData.assetStatus = 'loading';assert.equal(engineExhaust(root, 'kestrel').sockets.length, 0);
  root.userData.assetStatus = 'fallback';assert.equal(engineExhaust(root, 'kestrel').sockets.length, 0);
});

test('existing hull cores obey signed demand and power, with authored Kestrel cones only on boost', () => {
  for (const [shipId, root] of Object.entries(assets)) {
    const before = root.children.length, live = nav(shipId);
    live.engineAcceleration.set(0, 0, -shipHandling(shipId).thrust);
    updateShipEngineVisuals(root, enginePresentation(live));
    assert.ok(root.userData.driveIntensity > 2, shipId);
    assert.equal(root.userData.enginePresentation.authoredCones, 0);
    live.boost = true;updateShipEngineVisuals(root, enginePresentation(live));
    assert.equal(root.userData.enginePresentation.authoredCones, shipId === 'kestrel' ? 2 : 0);
    live.engineAcceleration.negate();updateShipEngineVisuals(root, enginePresentation(live));
    assert.ok(root.userData.driveIntensity < .2);assert.equal(root.userData.enginePresentation.authoredCones, 0);
    live.powered = false;updateShipEngineVisuals(root, enginePresentation(live));
    assert.equal(root.userData.driveIntensity, 0);
    root.traverse(node => {
      if (node.isMesh && (node.name === 'EngineCores' || node.material.name === 'Drive / ion blue')) assert.equal(node.material.emissiveIntensity, 0);
    });
    assert.equal(root.children.length, before, 'visual adapter creates no duplicate geometry');
  }
});
