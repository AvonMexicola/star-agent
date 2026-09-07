import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createShipMFDs } from './ship-mfd.js';
import { ATLAS_MARK_II_LAYOUT } from './atlas-mark-ii-systems.js';
import { ATLAS_LAYOUT, ATLAS_MODEL_URL, ATLAS_RAMP_CALLS, ATLAS_STORAGE } from './atlas-gameplay.js';
import { describeAtlasControl } from './atlas-mark-ii-controls.js';

const layout = ATLAS_MARK_II_LAYOUT;
function box(parent, position, size, material) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.fromArray(position);mesh.castShadow = true;mesh.receiveShadow = true;parent.add(mesh);return mesh;
}
function node(parent, name, position) {
  const group = new THREE.Group();group.name = name;group.position.fromArray(position);parent.add(group);return group;
}

/** Asset failure retains the new pressure decks, true lift shaft and ramps.
 * It never displays the retired 30 m Atlas or creates its belly elevator.
 */
export function createAtlasFallback(systems) {
  const root = new THREE.Group();root.name = 'Atlas 64 m physical fallback';
  const steel = new THREE.MeshStandardMaterial({ color: 0x455861, metalness: .45, roughness: .65 });
  const panel = new THREE.MeshStandardMaterial({ color: 0xc1d0cb, metalness: .3, roughness: .65 });
  const amber = new THREE.MeshStandardMaterial({ color: 0xe8a149, metalness: .2, roughness: .55 });
  const b = systems.elevatorBounds;
  for (const deck of [layout.cargo, layout.upper]) {
    for (const [x0, x1, z0, z1] of [[deck.minX, b.minX, deck.minZ, deck.maxZ], [b.maxX, deck.maxX, deck.minZ, deck.maxZ],
      [b.minX, b.maxX, deck.minZ, b.minZ], [b.minX, b.maxX, b.maxZ, deck.maxZ]]) {
      box(root, [(x0 + x1) / 2, deck.floor - .11, (z0 + z1) / 2], [x1 - x0, .22, z1 - z0], steel);
    }
    for (const x of [deck.minX - .1, deck.maxX + .1]) box(root,
      [x, (deck.floor + deck.ceiling) / 2, (deck.minZ + deck.maxZ) / 2], [.2, deck.ceiling - deck.floor, deck.maxZ - deck.minZ], panel);
    box(root, [0, deck.ceiling + .1, (deck.minZ + deck.maxZ) / 2], [deck.maxX - deck.minX, .2, deck.maxZ - deck.minZ], steel);
  }
  // Fixed room furniture/collision is retained in the fallback, too.
  for (const part of systems.colliders) box(root, part.min.map((n, i) => (n + part.max[i]) / 2), part.min.map((n, i) => part.max[i] - n), panel);
  box(root, [0, 11.15, layout.upper.maxZ], [14.4, 3.3, .2], panel);
  box(root, [0, 9.8, layout.upper.minZ], [14.4, .6, .2], panel);
  const glass = new THREE.MeshStandardMaterial({color:0x789eaa,transparent:true,opacity:.16,metalness:.1,roughness:.15});
  box(root, [0, 11.43, layout.upper.minZ], [14.4, 2.65, .06], glass);
  for (const ramp of layout.ramps) {
    const pivot = node(root, ramp.node, ramp.pivot);
    box(pivot, [0, -.09, ramp.outward * ramp.hingeLength / 2], [ramp.width, .18, ramp.hingeLength], steel);
    const tip = node(pivot, ramp.tipNode, [0, 0, ramp.outward * ramp.hingeLength]);
    box(tip, [0, -.09, ramp.outward * ramp.tipLength / 2], [ramp.width, .18, ramp.tipLength], steel);
    const seal = node(root, ramp.headerSeal.node, [0, ramp.headerSeal.closedY, ramp.pivot[2]]);
    box(seal, [0, 0, 0], [ramp.width, .25, .3], panel);
    for (const side of [-1, 1]) box(root, [side * 6.5, 4.4, ramp.pivot[2]], [1.4, 8.8, .25], panel);
    box(root, [ramp.control[0], ramp.control[1] + .65, ramp.control[2]], [.45, 1.3, .45], amber);
  }
  const lift = node(root, layout.elevator.node, [liftCentre(0), layout.elevator.low, liftCentre(1)]);
  box(lift, [0, -.11, 0], [layout.elevator.width, .22, layout.elevator.length], steel);
  for (const side of [-1, 1]) box(lift, [side * 1.2, .9, 0], [.07, .07, 3.2], amber);
  for (let i = 0; i < layout.elevator.gateNodes.length; i++) {
    const gate = node(root, layout.elevator.gateNodes[i], [4.2, i ? 9.5 : 2.6, -4]);
    box(gate, [0, .75, 0], [.08, 1.5, 1.45], amber);
  }
  for (const leg of layout.landingGear.legs) {
    const pivot = node(root, leg.node, leg.pivot);
    box(pivot, [0, -1.9, 0], [.6, 3.8, .6], steel);
    const foot = node(pivot, leg.footNode, [0, leg.padPivotY - leg.pivot[1], 0]);
    box(foot, [0, -.35, 0], [2.7, .3, 3.3], steel);
    for (const door of leg.doors) {
      const hinge = node(root, door.node, door.pivot);
      box(hinge, [door.inward * .8, 0, 0], [1.58, .12, leg.pocketZ[1] - leg.pocketZ[0] - .25], panel);
    }
  }
  for (const mount of layout.mounts) {
    const socket = node(root, mount.node, mount.position);socket.rotation.fromArray(mount.rotation);
    socket.userData = { role: 'weapon-mount', mountSize: mount.size };
  }
  return root;
}
const liftCentre = i => layout.elevator.centre[i];

export function createFreighter(systems, { assetURL = `${import.meta.env?.BASE_URL ?? '/'}${ATLAS_MODEL_URL}`, gltf = null } = {}) {
  const ship = new THREE.Group();ship.name = 'Atlas / 64 m heavy logistics';
  ship.userData.layout = ATLAS_LAYOUT;ship.userData.atlasVersion = 2;
  const fallback = createAtlasFallback(systems);ship.add(fallback);systems.bind(fallback);
  const mfds = createShipMFDs({ mounts: layout.pilotMFDs, includeFrames: false, screenOffset: .046, profile: 'atlas-flight' });
  ship.add(mfds);
  ship.updateDisplays = (dt, nav, inventory, course) => mfds.update(dt, nav, inventory, course);
  ship.displayState = () => mfds.snapshot();
  const callMaterial = new THREE.MeshStandardMaterial({ color: 0x172e35, roughness: .45, metalness: .4 });
  const buttonMaterial = new THREE.MeshStandardMaterial({ color: 0x85d9ba, emissive: 0x85d9ba, emissiveIntensity: .6, roughness: .55 });
  for (const call of ATLAS_RAMP_CALLS) {
    const panel = node(ship, `AtlasGroundRampCall_${call.id}`, call.anchor);
    box(panel, [0, .85, 0], [.10, 1.3, .10], callMaterial);
    box(panel, [0, 0, 0], [.45, .55, .18], callMaterial);
    box(panel, [0, .035, call.id === 'front' ? -.10 : .10], [.22, .18, .03], buttonMaterial);
    panel.userData.actionId = `ramp:${call.id}`;
  }
  const lights = [];
  for (const [x, y, z, intensity, distance] of [[0, 8.3, -18, 24, 17], [0, 8.3, 1, 24, 17], [0, 8.3, 19, 24, 17],
    [-2, 12.5, -21, 14, 13], [0, 12.3, -2, 14, 15], [0, 12.3, 12, 14, 13]]) {
    const light = new THREE.PointLight(0xc0e9de, intensity, distance, 2);light.position.set(x, y, z);ship.add(light);lights.push(light);
  }
  ship.setStorage = open => { ship.userData.storageOpen = Boolean(open); };
  ship.setDoor = () => {};
  ship.updateGear = (_dt, deployed, progress = systems.gear.progress) => {
    systems.setGear(progress, deployed);ship.userData.gearProgress = progress;ship.userData.gearAssemblies = systems.gear.legs.length;
  };
  ship.syncFlight = nav => {
    const powered = nav.powered !== false && !['crashed', 'destroyed'].includes(nav.mode);
    for (const light of lights) light.visible = powered;
    buttonMaterial.emissiveIntensity = powered ? .6 : .04;
  };
  ship.controlState = nav => {
    const point = nav.toShipLocal?.();if (!point) return null;
    const id = systems.interaction(point);if (id === 'storage') return { id, anchor: ATLAS_STORAGE.anchor, target: 'Cargo storage', action: 'Open storage', enabled: true };
    const control = describeAtlasControl(systems, point, nav.mode === 'landed');
    if (control && (nav.powered === false || nav.cabinFlight && id?.startsWith('ramp:'))) {
      return { ...control, enabled: false, action: nav.powered === false ? 'Main power off' : 'Secured in flight' };
    }
    return control;
  };
  ship.update = () => { ship.userData.atlasSystems = systems.snapshot; };
  ship.userData.assetStatus = 'loading';
  ship.readyPromise = (gltf ? Promise.resolve(gltf) : new GLTFLoader().loadAsync(assetURL)).then(({ scene: model }) => {
    systems.bind(model);
    model.traverse(object => { if (object.isMesh) { object.castShadow = true;object.receiveShadow = true; } });
    ship.remove(fallback);ship.add(model);ship.userData.assetStatus = 'ready';ship.update();return model;
  }).catch(error => {
    systems.bind(fallback);ship.userData.assetStatus = 'fallback';ship.userData.assetError = error.message;
    console.warn('Atlas asset unavailable; using its 64 m physical fallback.', error);return null;
  });
  ship.update();return ship;
}
