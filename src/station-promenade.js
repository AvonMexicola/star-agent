import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { stationFinishPalette } from './station-finish-palette.js';
import { assetCollisionBoxes } from './station-concourse.js';
import { STATION_HUB_PORTAL } from './station-hub-policy.js';

/** The retail promenade runs aft from the concourse portal. This module owns the
 * pressurised shell, glazing, suspended gantry and lighting in local metres;
 * `blender/build_station_promenade.py` owns the storefronts, fixtures and stock.
 * Both sides repeat the same room planes, so change them together. */
export { STATION_HUB_PORTAL };
/** Two authored walkable volumes: the corridor and the shop/mid-court band.
 * A single enclosing box would hand the suit a floor out in open space beside
 * the corridor. Each is 0.3 m larger than its walls so deck support, which
 * insets by that margin, still reaches the wall the body actually touches. */
export const PROMENADE_VOLUMES = Object.freeze([
  Object.freeze({ min: Object.freeze([-4.9, -8, -50.4]), max: Object.freeze([4.9, -3.4, -18.6]) }),
  Object.freeze({ min: Object.freeze([-13.3, -8, -43.75]), max: Object.freeze([13.3, -3.4, -20.85]) }),
]);
/** Counter approach points, 0.9 m clear of each customer face. */
export const PROMENADE_SHOPS = Object.freeze([
  Object.freeze({ shopId: 'galley', node: 'Galley', name: 'LONGREACH GALLEY', x: -8.6, z: -25.7 }),
  Object.freeze({ shopId: 'outfitter', node: 'Outfitter', name: 'TIDEWELL OUTFITTERS', x: 8.6, z: -25.7 }),
  Object.freeze({ shopId: 'hydroponics', node: 'Hydroponics', name: 'GREENSIDE HYDROPONICS', x: -8.6, z: -38.9 }),
  Object.freeze({ shopId: 'souvenir', node: 'Souvenir', name: 'WAYPOINT SOUVENIRS', x: 8.6, z: -38.9 }),
]);
/** Distant stand-in for the annex, drawn only while the interior is not. Both
 * exterior kits add it to their own hub shell so the promenade never appears as
 * a hole in the port from outside. Named Detail: flight collision comes from the
 * hub's own geometry, exactly like the concourse shell. */
export const PROMENADE_SHELL = Object.freeze([
  Object.freeze({ size: Object.freeze([10.2, 9, 31.8]), position: Object.freeze([0, -3.5, -34.5]) }),
  Object.freeze({ size: Object.freeze([27.6, 9, 22.6]), position: Object.freeze([0, -3.5, -32.3]) }),
]);
let shellGeometry;
export function addPromenadeShell(hubShell, material) {
  shellGeometry ??= new THREE.BoxGeometry(1, 1, 1);
  const finish = material ?? hubShell.getObjectByProperty('isMesh', true)?.material;
  if (!finish) return hubShell;
  for (const { size, position } of PROMENADE_SHELL) {
    const mesh = new THREE.Mesh(shellGeometry, finish);
    mesh.name = 'PromenadeShellDetail';
    mesh.scale.set(...size); mesh.position.set(...position);
    mesh.castShadow = mesh.receiveShadow = false;
    hubShell.add(mesh);
  }
  return hubShell;
}
/** The prompt reaches 4 m out from the door plane. A 4.2 m pressure door that
 * spans the corridor is read from a standing distance, not with a nose against
 * its cassette, and the aft hall has nothing else to interact with. */
export const PROMENADE_SEALED_DOOR = Object.freeze({ z: -48.9, halfWidth: 3.7, approach: 4 });
export const SEALED_DOOR_LABEL = 'DECK 05 SEALED · HABITAT TERRACES ARE STILL BEING FITTED OUT';
const SHOP_RADIUS = 1.9;

/** Seen from the concourse, an unlit corridor behind the portal reads as a hole
 * rather than a route, so the three corridor lights follow the hub itself. The
 * four unit lights, which only matter once a storefront is in view, switch on
 * while the player is still short of the portal and cannot see into a side unit,
 * so their light-count change is never a visible pop. */
const UNIT_LIGHT_Z = -12;

export function createPromenade({ sign }) {
  const group = new THREE.Group(); group.name = 'Retail promenade';
  const p = stationFinishPalette(), batches = new Map();
  const material = (name, key, metalness, roughness) => { const m = new THREE.MeshStandardMaterial({ color: p[key], metalness, roughness }); m.name = name; return m; };
  const ivory = material('FinishIvory', 'ivory', .12, .7), steel = material('FinishSteel', 'steel', .65, .4);
  const dark = material('FinishDark', 'dark', .3, .7), deck = material('FinishDeck', 'deck', .15, .85), petrol = material('FinishPetrol', 'petrol', .2, .65);
  const glow = new THREE.MeshStandardMaterial({ color: p.mint, emissive: p.mint, emissiveIntensity: .8, roughness: .5 });
  const glass = new THREE.MeshStandardMaterial({ color: p.cool, transparent: true, opacity: .045, metalness: 0, roughness: .18, side: THREE.DoubleSide, depthWrite: false });
  glass.userData.unweathered = true;
  function box(size, position, mat = ivory, detail = false, radius = .025) {
    // RoundedBoxGeometry is non-indexed and BoxGeometry is indexed, so a batch
    // that mixes them cannot be merged. Keep the two forms in separate batches.
    const key = mat.uuid + detail + (radius ? 'r' : 'b');
    if (!batches.has(key)) batches.set(key, { mat, detail, parts: [] });
    const geometry = radius ? new RoundedBoxGeometry(...size, 1, Math.min(radius, Math.min(...size) * .2)) : new THREE.BoxGeometry(...size);
    geometry.deleteAttribute('uv'); geometry.translate(...position); batches.get(key).parts.push(geometry);
  }
  // Deck: a corridor strip for the full length and a wider band under the four
  // units and the mid court. Nothing is laid where the room does not exist.
  box([9.8, .5, 31.8], [0, -8.25, -34.5], deck, false, 0);
  box([27.2, .5, 22.3], [0, -8.25, -32.3], deck, false, 0);
  // Structural roof above both, then the visible corridor ceiling below it.
  box([9.8, .3, 31.8], [0, -3.0, -34.5], dark, false, 0);
  box([27.2, .3, 22.3], [0, -3.0, -32.3], dark, false, 0);
  box([9.2, .3, 31.4], [0, -3.3, -34.5], ivory, false, 0);
  box([26.4, .3, 4.6], [0, -3.3, -32.3], ivory, false, 0);
  for (const side of [-1, 1]) {
    // Corridor liner where a storefront does not form the wall: the entry bay
    // and the aft hall in front of the sealed bulkhead.
    for (const [z, length] of [[-20.2, 2.4], [-46.65, 6.9]]) {
      box([.5, 4.85, length], [side * 4.85, -5.575, z], ivory);
      box([.14, .3, length - .3], [side * 4.58, -7.7, z], steel, true, .01);
      box([.1, .04, length - .8], [side * 4.55, -4.1, z], glow, true, 0);
    }
    // Outer hull behind the two shop bands, and the mid-court glazing between.
    for (const z of [-25.7, -38.9]) box([.3, 5.4, 9.1], [side * 13.5, -5.7, z], dark, false, 0);
    box([.1, 4.0, 4.6], [side * 13.35, -5.6, -32.3], glass, false, 0);
    box([.5, 1.0, 4.9], [side * 13.42, -7.9, -32.3], petrol);
    box([.5, .8, 4.9], [side * 13.42, -3.4, -32.3], dark);
    box([.55, .12, 4.9], [side * 13.3, -7.36, -32.3], steel);
    for (const z of [-34.55, -32.3, -30.05]) box([.45, 4.3, .45], [side * 13.3, -5.6, z], ivory);
    // Ceiling cove and lightline along the corridor, and unit portal reveals.
    box([.22, .12, 31.2], [side * 4.2, -3.52, -34.5], steel);
    box([.16, .03, 30.6], [side * 4.16, -3.60, -34.5], glow, true, 0);
    // Floor: the concourse language of flush joints, guidance and skirting.
    box([.07, .008, 30.8], [side * 3.7, -7.992, -34.5], steel, true, 0);
    box([.025, .009, 29.6], [side * 3.57, -7.99, -34.5], glow, true, 0);
    for (let z = -48; z <= -21; z += 2) box([7.15, .004, .025], [0, -7.995, z], dark, true, 0);
  }
  // Portal lining where the corridor meets the concourse wall opening.
  for (const side of [-1, 1]) box([.42, 4.55, .74], [side * 4.79, -5.725, -19], steel);
  box([10, .42, .74], [0, -3.24, -19], steel);
  box([9.2, .05, .8], [0, -7.97, -19], steel, true, .01);
  box([9.2, .02, .1], [0, -7.955, -19.3], glow, true, 0);
  // Aft end cap behind the authored bulkhead.
  box([9.8, 4.85, .4], [0, -5.575, -49.9], dark, false, 0);
  // The suspended gantry that replaces the old flat directory on the wall: a
  // transverse concourse beam, two drops and a double-sided illuminated box.
  box([43.8, .36, .45], [0, 1.1, -17], ivory);
  box([17.2, .18, .65], [0, .83, -17], steel);
  for (const x of [-3.8, 3.8]) {
    box([.09, 3.0, .09], [x, -.65, -17], steel);
    box([.22, .1, .22], [x, -2.2, -17], dark);
  }
  box([10.6, 2.6, .55], [0, -3.45, -17], petrol);
  box([10.2, 2.2, .06], [0, -3.45, -16.71], dark, true, .01);
  box([10.2, 2.2, .06], [0, -3.45, -17.29], dark, true, .01);
  box([10.7, .1, .6], [0, -2.06, -17], glow, true, 0);
  box([10.7, .16, .6], [0, -4.83, -17], steel);
  sign(group, 'AEON', [0, -2.72, -16.67], 9.4, 1.25, 0);
  sign(group, 'ORBITAL TRANSIT / DECK 04', [0, -3.74, -16.67], 8, .52, 0);
  sign(group, 'ARMORY  ←     /     SHIP COMPONENTS  →', [0, -4.34, -16.67], 8, .3, 0);
  sign(group, 'CENTRAL CONCOURSE   /   DECK 04', [0, -3.45, -17.33], 6, .32);
  // Portal header, read on approach from the concourse.
  // Flush against the header wall face at Z -18.75, not floating in front of it.
  sign(group, 'RETAIL PROMENADE   /   DECK 05 ACCESS', [0, -2.75, -18.73], 8, .55, 0);
  for (const { mat, detail, parts } of batches.values()) {
    const merged = mergeGeometries(parts, false); parts.forEach(g => g.dispose());
    const mesh = new THREE.Mesh(merged, mat); mesh.name = detail ? 'PromenadeDetail_' + mat.name : 'PromenadeStructure_' + mat.name;
    // Shadow casting is switched off for the whole room below, after the
    // station finish has applied its materials; see disableShadowCasting.
    mesh.castShadow = false; mesh.receiveShadow = !mat.transparent; group.add(mesh);
  }
  // Recessed downlights, aimed at the deck and casting no shadow map: the two
  // concourse spotlights remain the only shadow casters in the occupied hub.
  // A point light this close under a ceiling blows the ceiling out; a cone
  // aimed down lights the floor, fixtures and lower walls instead.
  const lights = [], corridorLights = [], unitLights = [];
  for (const [x, y, z, distance, intensity, unit] of [
    // The aft light stands well clear of the bulkhead: hung any closer it blew
    // out the door's large flat cassettes in the actual game capture.
    [0, -3.62, -21.5, 30, 360, false], [0, -3.62, -32.3, 34, 400, false], [0, -3.62, -43.6, 30, 250, false],
    [-8.8, -4.72, -25.7, 22, 230, true], [8.8, -4.72, -25.7, 22, 230, true],
    [-8.8, -4.72, -38.9, 22, 230, true], [8.8, -4.72, -38.9, 22, 230, true],
  ]) {
    const light = new THREE.SpotLight(p.ivory, intensity, distance, 1.45, .6, 2);
    light.position.set(x, y, z); light.target.position.set(x, -8, z);
    light.castShadow = false; light.visible = false;
    group.add(light, light.target); lights.push(light);
    (unit ? unitLights : corridorLights).push(light);
  }
  const volumes = PROMENADE_VOLUMES.map(({ min, max }) => new THREE.Box3(new THREE.Vector3(...min), new THREE.Vector3(...max)));
  return {
    group, lights, volumes, props: null,
    /** Nothing in this room casts a shadow, because nothing in it has a
     * shadow-casting light: the seven downlights are shadowless by design and
     * the two concourse spotlights are 20 m forward with a 22 m far plane. The
     * station finish re-enables casting whenever it replaces a material, so the
     * whole room is switched off again once, after that pass. The room still
     * receives shadows. This keeps ~80k triangles out of every shadow map the
     * scene renders while the player is in the hub. */
    disableShadowCasting() {
      group.traverse(mesh => { if (mesh.isMesh) mesh.castShadow = false; });
    },
    /** `local` is the suit's hub-local position, or null when it is not in the
     * hub at all. */
    update(local) {
      const inHub = Boolean(local);
      for (const light of corridorLights) light.visible = inHub;
      for (const light of unitLights) light.visible = inHub && local.z < UNIT_LIGHT_Z;
    },
  };
}

/** Runtime labels for the authored storefronts, counters, directory and door. */
export function attachPromenade(hub, asset, { sign, materials }) {
  const promenade = hub.promenade;
  if (!promenade) throw new Error('The hub has no promenade to attach to.');
  const props = asset.scene.clone(true);
  props.traverse(mesh => { if (mesh.isMesh) mesh.receiveShadow = true; });
  materials?.apply(props);
  hub.staticBoxes.push(...assetCollisionBoxes(props));
  promenade.group.add(props); promenade.props = props;
  for (const { node, name, x } of PROMENADE_SHOPS) {
    const side = Math.sign(x);
    const fascia = props.getObjectByName(node + 'Sign');
    if (fascia) sign(fascia, name, [0, 0, 0], 6.9, .52, -side * Math.PI / 2);
    const screen = props.getObjectByName(node + 'Screen');
    if (screen) sign(screen, 'F / BROWSE STOCK', [0, 0, 0], .43, .24, -side * Math.PI / 2);
  }
  const directory = props.getObjectByName('PromenadeDirectory');
  if (directory) sign(directory, 'AEON / DECK 04\nRETAIL PROMENADE\n\nGALLEY / OUTFITTERS\nHYDROPONICS / GIFTS\n\nDECK 05 SEALED', [0, 0, 0], .58, 1.86, 0);
  const doorSign = props.getObjectByName('SealedDoorSign');
  if (doorSign) sign(doorSign, 'DECK 05   /   HABITAT TERRACES', [0, 0, 0], 7.4, .44, 0);
  const doorPanel = props.getObjectByName('SealedDoorPanel');
  if (doorPanel) sign(doorPanel, 'SEALED\nNO ENTRY', [0, 0, 0], .32, .56, 0);
  const notice = props.getObjectByName('SealedDoorNotice');
  if (notice) sign(notice, 'FIT-OUT\nIN PROGRESS\n\nNO PUBLIC\nACCESS', [0, 0, 0], .42, .6, 0);
  return props;
}

/** Physical interactions inside the promenade, in hub-local metres. Returns the
 * same shape as the concourse interactions so one F action serves both rooms. */
export function promenadeInteraction(local) {
  for (const { shopId, name, x, z } of PROMENADE_SHOPS) {
    if (Math.hypot(local.x - x, local.z - z) < SHOP_RADIUS) return { kind: 'shop', shopId, label: `F · ${name}` };
  }
  const { z, halfWidth, approach } = PROMENADE_SEALED_DOOR;
  if (Math.abs(local.x) < halfWidth && local.z < z + approach && local.z > z - 1) {
    return { kind: 'unavailable', label: SEALED_DOOR_LABEL };
  }
  return null;
}
