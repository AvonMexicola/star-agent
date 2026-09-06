import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { SHIP_LAYOUT } from './boarding.js';
import { createShipMFDs } from './ship-mfd.js';
export { SHIP_LAYOUT } from './boarding.js';

/** A hollow, boardable explorer. +Y is up; the cockpit faces -Z.
 * The ramp's upper surface, cabin floor, and SHIP_LAYOUT use the same geometry.
 * setDoor() selects the target; update(dt) animates both hatch and ramp in seconds.
 */
export function createWalkableShip({ assetURL = `${import.meta.env.BASE_URL}models/nomad.glb` } = {}) {
  const ship = new THREE.Group();
  ship.name = 'Nomad surveyor / Blender explorer';
  const exterior = new THREE.Group();exterior.name = 'Procedural exterior fallback';ship.add(exterior);
  let activeGroup;
  let cargoLid;
  const shell = new THREE.Group();
  shell.name = 'Rigid hull and furnished cabin';
  ship.add(shell);
  activeGroup = shell;
  const finish = {
    hull: new THREE.MeshStandardMaterial({ color: 0xc6d1cf, metalness: .48, roughness: .42 }),
    metal: new THREE.MeshStandardMaterial({ color: 0x687f85, metalness: .7, roughness: .35 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x16262f, metalness: .55, roughness: .48 }),
    floor: new THREE.MeshStandardMaterial({ color: 0x34464c, metalness: .35, roughness: .8 }),
    fabric: new THREE.MeshStandardMaterial({ color: 0x273f44, metalness: .08, roughness: .98 }),
    amberPaint: new THREE.MeshStandardMaterial({ color: 0xd19a43, metalness: .3, roughness: .6 }),
    glass: new THREE.MeshStandardMaterial({ color: 0xa7dae5, transparent: true, opacity: .16, metalness: .12, roughness: .08, side: THREE.DoubleSide, depthWrite: false }),
    mint: new THREE.MeshStandardMaterial({ color: 0x98ffe0, emissive: 0x55ffd0, emissiveIntensity: 2, toneMapped: false }),
    amber: new THREE.MeshStandardMaterial({ color: 0xffc078, emissive: 0xff9c43, emissiveIntensity: 1.8, toneMapped: false }),
    blue: new THREE.MeshStandardMaterial({ color: 0x8ce0ff, emissive: 0x348ecb, emissiveIntensity: 1.7, toneMapped: false }),
    display: new THREE.MeshStandardMaterial({ color: 0x073544, emissive: 0x0e596b, emissiveIntensity: .85, roughness: .25 }),
  };
  function part(geometry, material, x = 0, y = 0, z = 0, parent = activeGroup) {
    const object = new THREE.Mesh(geometry, material);
    object.position.set(x, y, z);
    parent.add(object);
    return object;
  }
  function box(x, y, z, width, height, depth, material, parent = activeGroup) {
    return part(new THREE.BoxGeometry(width, height, depth), material, x, y, z, parent);
  }
  function rod(from, to, radius, material, parent = activeGroup) {
    const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to);
    const mesh = part(new THREE.CylinderGeometry(radius, radius, a.distanceTo(b), 8), material, 0, 0, 0, parent);
    mesh.position.copy(a).add(b).multiplyScalar(.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.sub(a).normalize());
    return mesh;
  }
  function panel(points, top, thickness, material, parent = activeGroup) {
    const shape = new THREE.Shape();
    shape.moveTo(...points[0]);
    points.slice(1).forEach((point) => shape.lineTo(...point));
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, steps: 1 });
    geometry.rotateX(Math.PI / 2);
    return part(geometry, material, 0, top, 0, parent);
  }
  function quad(points, material) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(points.flat(), 3));
    geometry.setIndex([0, 1, 2, 0, 2, 3]);geometry.computeVertexNormals();
    return part(geometry, material);
  }

  // The cabin is assembled from separate walls and floor; nothing fills its volume.
  box(0, .88, -.25, 3.64, .24, 8.5, finish.floor);
  box(0, .68, -.2, 3.28, .18, 8.25, finish.dark);
  box(0, 4.06, 1.15, 3.9, .12, 5.8, finish.hull);
  box(0, 3.986, 1.15, 3.45, .025, 5.65, finish.dark);
  const ceiling = finish.dark.clone();ceiling.side = THREE.DoubleSide;
  quad([[-1.86, 3.91, -1.78], [-1.76, 3.38, -4.20], [1.76, 3.38, -4.20], [1.86, 3.91, -1.78]], ceiling);
  for (const side of [-1, 1]) {
    // Rear side walls and cockpit sills leave true forward side-window openings.
    box(side * 1.84, 2.5, 1.1, .18, 3, 5.8, finish.hull);
    box(side * 1.733, 2.48, 1.1, .025, 2.85, 5.65, finish.dark);
    box(side * 1.84, 1.39, -3.15, .18, .78, 2.7, finish.hull);
    quad([[side * .87, 1.48, -6.36], [side * 1.84, 1.72, -1.8], [side * 1.84, 3.96, -1.8], [side * 1.76, 3.43, -4.18]], finish.glass);
    rod([side * 1.76, 3.43, -4.18], [side * 1.84, 3.96, -1.8], .035, finish.metal);
    rod([side * .87, 1.48, -6.36], [side * 1.76, 3.43, -4.18], .035, finish.metal);
    for (const z of [-.65, 1.15, 2.95]) {
      box(side * 1.707, 2.53, z, .035, 2.76, .085, finish.metal);
    }
    box(side * 1.63, 3.88, 1.15, .05, .055, 5.55, finish.mint);
    rod([side * 1.63, 3.36, -4.10], [side * 1.63, 3.80, -1.80], .012, finish.mint);
    box(side * 1.62, 1.017, .05, .035, .014, 7.45, finish.amberPaint);
    // Recessed service panels stay out of the walkable central aisle.
    box(side * 1.687, 2.22, 1.38, .075, 1.23, 1.42, finish.floor);
    box(side * 1.636, 2.72, 1.37, .025, .035, 1.10, finish.metal);
    box(side * 1.636, 2.02, 1.87, .026, .2, .035, finish.mint);
    box(side * 1.64, 1.35, 2.8, .17, .62, 1.04, finish.fabric);
  }
  for (let i = 0; i < 11; i++) box(0, 1.006, -4.1 + i * .75, 3.4, .008, .012, finish.dark);
  box(0, 1.015, 3.59, 1.75, .014, .09, finish.amberPaint);

  // Large front windscreen: no opaque nose or console intersects the seated view.
  quad([[-.87, 1.48, -6.36], [.87, 1.48, -6.36], [1.76, 3.43, -4.18], [-1.76, 3.43, -4.18]], finish.glass);
  box(0, 1.18, -4.56, 3.76, .36, .19, finish.hull);
  activeGroup = exterior;
  panel([[-1.87, -4.6], [-.56, -6.72], [.56, -6.72], [1.87, -4.6]], 1.24, .42, finish.hull);
  panel([[-1.4, -4.65], [-.39, -6.56], [.39, -6.56], [1.4, -4.65]], 1.255, .025, finish.dark);
  for (const x of [-.43, .43]) box(x, 1.10, -6.73, .14, .085, .032, finish.mint);

  activeGroup = shell;

  // Low pilot console and two angled side control pods, below the sight line.
  box(0, 1.53, -4.11, 3.05, .6, .57, finish.dark);
  box(0, 1.845, -4.05, 2.99, .04, .48, finish.metal);
  for (const side of [-1, 1]) {
    box(side * 1.17, 1.47, -3.10, .63, .6, 1.42, finish.dark);
    box(side * 1.15, 1.80, -2.85, .36, .035, .17, finish.metal);
    for (let key = 0; key < 4; key++) box(side * 1.15 - .12 + key * .08, 1.826, -2.85, .035, .015, .085, key === 0 ? finish.amber : finish.mint);
    rod([side * .51, 1.71, -2.92], [side * .51, 1.94, -3.03], .045, finish.dark);
  }
  // Chair faces -Z; its back is behind the seated camera, toward the aisle.
  const chairFallback=new THREE.Group();chairFallback.name='Pilot chair fallback';ship.add(chairFallback);activeGroup=chairFallback;
  part(new THREE.CylinderGeometry(.24, .32, .32, 10), finish.metal, 0, 1.16, -2.8);
  box(0, 1.42, -2.8, .83, .19, .79, finish.fabric);
  const back = box(0, 1.91, -2.415, .83, .98, .15, finish.fabric);
  back.rotation.x = -.11;
  box(0, 2.40, -2.37, .47, .24, .18, finish.fabric);
  for (const side of [-1, 1]) {
    box(side * .46, 1.67, -2.71, .13, .09, .67, finish.metal);
    rod([side * .43, 1.36, -2.43], [side * .46, 1.64, -2.43], .04, finish.dark);
  }

  // Rear bulkhead surrounds an unobstructed 1.8m × 2.5m doorway.
  activeGroup=shell;
  for (const side of [-1, 1]) {
    box(side * 1.42, 2.5, 4.0, 1.04, 3, .18, finish.hull);
    box(side * .956, 2.24, 4.116, .09, 2.47, .1, finish.metal);
    box(side * 1.025, 2.85, 4.145, .035, .53, .025, finish.amber);
  }
  box(0, 3.85, 4.0, 1.83, .7, .24, finish.dark);
  box(0, 4.10, 4.02, 2.1, .15, .41, finish.hull);
  box(1.32, 2.15, 4.118, .21, .32, .035, finish.display);
  box(1.32, 2.15, 4.145, .12, .10, .018, finish.mint);

  const hatch = new THREE.Group();
  hatch.name = 'Sliding segmented rear hatch';
  ship.add(hatch);
  const slats = [];
  for (let i = 0; i < 6; i++) {
    const slat = new THREE.Group();
    slat.position.set(0, 1 + (i + .5) * 2.5 / 6, 4.015);
    box(0, 0, 0, 1.8, 2.5 / 6 - .012, .10, finish.metal, slat);
    box(0, -.18, .057, 1.69, .022, .015, finish.dark, slat);
    if (i === 2 || i === 3) box(0, 0, .066, .045, .21, .016, finish.mint, slat);
    hatch.add(slat);
    slats.push(slat);
  }

  const ramp = new THREE.Group();
  ramp.name = 'Hinged boarding ramp';
  ramp.position.set(0, 1, 4);
  ship.add(ramp);
  const rampLength = Math.hypot(3.2, 1);
  // Local upper face y=0 gives the exact walk plane y = 1 - (z - 4) / 3.2.
  box(0, -.055, rampLength / 2, 1.8, .11, rampLength, finish.floor, ramp);
  for (const side of [-1, 1]) box(side * .847, .008, rampLength / 2, .045, .016, rampLength - .1, finish.amberPaint, ramp);
  for (let i = 0; i < 15; i++) box(0, .007, .13 + i * .215, 1.63, .014, .035, finish.metal, ramp);
  box(0, -.10, rampLength / 2, .1, .025, rampLength - .23, finish.mint, ramp);
  rod([-.93, 1, 4], [.93, 1, 4], .09, finish.metal);

  activeGroup = exterior;
  // All propulsion and large wings live outside the cabin's walkable width.
  for (const side of [-1, 1]) {
    const mirrored = (points) => points.map(([x, z]) => [side * x, z]);
    panel(mirrored([[1.9, -2.2], [6.0, 1.15], [5.25, 3.53], [1.95, 3.11]]), 1.88, .29, finish.hull);
    panel(mirrored([[2.35, -.95], [5.50, 1.47], [4.99, 2.48], [2.37, 2.31]]), 1.90, .025, finish.dark);
    panel(mirrored([[2.85, -.12], [5.21, 1.71], [5.10, 1.92], [2.80, .12]]), 1.925, .012, finish.metal);
    box(side * 5.5, 1.99, 2.03, .1, .085, .83, side < 0 ? finish.amber : finish.mint);
    // Cylindrical engine axes follow the fuselage, with open rear nozzle collars.
    const nacelle = part(new THREE.CylinderGeometry(.62, .54, 4.6, 10), finish.metal, side * 2.56, 1.86, 1.4);
    nacelle.rotation.x = Math.PI / 2;
    const inlet = part(new THREE.CircleGeometry(.48, 12), finish.dark, side * 2.56, 1.86, -.91);
    inlet.rotation.y = Math.PI;
    const nozzle = part(new THREE.CylinderGeometry(.5, .6, .46, 12, 1, true), finish.dark, side * 2.56, 1.86, 3.81);
    nozzle.rotation.x = Math.PI / 2;
    part(new THREE.TorusGeometry(.52, .065, 6, 12), finish.metal, side * 2.56, 1.86, 4.055);
    part(new THREE.CircleGeometry(.4, 12), finish.blue, side * 2.56, 1.86, 4.025);
    for (let i = 0; i < 6; i++) box(side * 2.56, 2.46, .05 + i * .47, .55, .035, .13, finish.dark);
    for (const z of [-2.72, 2.80]) {
      rod([side * 1.95, 1.27, z], [side * 2.51, .22, z + .23], .115, finish.metal);
      rod([side * 1.95, 1.13, z + .53], [side * 2.51, .22, z + .23], .055, finish.dark);
      box(side * 2.51, .09, z + .23, .74, .18, .98, finish.dark);
      box(side * 2.51, .195, z + .23, .43, .035, .69, finish.metal);
    }
    panel(mirrored([[1.84, -4.5], [3.15, -3.10], [2.74, -2.33], [1.91, -2.92]]), 1.77, .15, finish.metal);
  }
  box(0, 4.16, 1.45, 1.22, .08, 2.6, finish.metal);
  for (let i = 0; i < 7; i++) box(0, 4.21, .43 + i * .32, .86, .035, .1, finish.dark);

  // Keep a physical, usable locker even if the optional GLB fails to load.
  const cargoFallback = new THREE.Group();cargoFallback.name = 'Cargo fallback';ship.add(cargoFallback);
  box(1.315, 1.49, 1.15, .67, .98, 1.60, finish.dark, cargoFallback);
  box(.95, 1.53, 1.15, .04, .74, 1.42, finish.metal, cargoFallback);
  box(.925, 1.78, 1.15, .015, .035, .50, finish.mint, cargoFallback);
  const fallbackLid = new THREE.Group();fallbackLid.position.set(1.65, 1.98, 1.15);cargoFallback.add(fallbackLid);
  box(-.335, .03, 0, .67, .06, 1.60, finish.amberPaint, fallbackLid);
  cargoLid = fallbackLid;
  activeGroup = shell;

  // Static geometry shares a small set of draws; transparent windows stay separate.
  for (const container of [shell, exterior]) {
    const batches = new Map();
    for (const object of [...container.children]) {
      if (!object.isMesh || object.material.transparent) continue;
      object.updateMatrix();
      const geometry = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone();
      geometry.deleteAttribute('uv');
      geometry.applyMatrix4(object.matrix);
      if (!batches.has(object.material)) batches.set(object.material, []);
      batches.get(object.material).push(geometry);
      object.geometry.dispose();
      container.remove(object);
    }
    for (const [material, geometries] of batches) {
      part(mergeGeometries(geometries), material, 0, 0, 0, container);
      geometries.forEach((geometry) => geometry.dispose());
    }
  }
  // Small physical lights make an enclosed cabin readable independently of sun angle.
  for (const z of [-2.2, 1.6]) {
    const light = new THREE.PointLight(0xb9f6e7, 9, 7, 2);
    light.position.set(0, 3.65, z);
    ship.add(light);
  }
  const mfds = createShipMFDs();ship.add(mfds);
  ship.updateDisplays = (dt, nav, inventory, course) => mfds.update(dt, nav, inventory, course);
  ship.displayState = () => mfds.snapshot();
  ship.userData.assetStatus = 'loading';
  ship.readyPromise = new GLTFLoader().loadAsync(assetURL).then(({ scene: model }) => {
    const lid = model.getObjectByName('CargoLid');
    if (!lid) throw new Error('Nomad asset is missing the cargo lid');
    model.name = 'Blender Nomad exterior and storage';
    model.traverse(object => { if (object.isMesh) { object.castShadow = true;object.receiveShadow = true; } });
    ship.add(model);cargoLid = lid;exterior.visible = false;cargoFallback.visible = false;
    if(model.getObjectByName('PilotChair'))chairFallback.visible=false;
    ship.userData.assetStatus = 'ready';
    return model;
  }).catch(error => {
    ship.userData.assetStatus = 'fallback';ship.userData.assetError = error.message;
    console.warn('Nomad model unavailable; using the boardable fallback.', error);
    return null;
  });
  let storageOpen = false, storageProgress = 0;
  ship.setStorage = open => { storageOpen = Boolean(open); };
  let progress = 0;
  ship.doorOpen = false;
  ship.setDoor = (open) => { ship.doorOpen = Boolean(open); };
  ship.update = (dt) => {
    const step = THREE.MathUtils.clamp(Number.isFinite(dt) ? dt : 0, 0, .25) / 1.05;
    storageProgress = THREE.MathUtils.clamp(storageProgress + (storageOpen ? step : -step), 0, 1);
    cargoLid.rotation.z = -storageProgress * 1.35;
    ship.userData.storageOpen = storageOpen;
    ship.userData.storageProgress = storageProgress;
    progress = THREE.MathUtils.clamp(progress + (ship.doorOpen ? step : -step), 0, 1);
    const eased = progress * progress * (3 - 2 * progress);
    for (let i = 0; i < slats.length; i++) {
      const base = 1 + (i + .5) * 2.5 / 6;
      slats[i].position.y = THREE.MathUtils.lerp(base, 3.735 + i * .035, eased);
      slats[i].position.z = 4.015 - i * .021 * eased;
    }
    ramp.rotation.x = THREE.MathUtils.lerp(-Math.PI / 2, Math.atan2(1, 3.2), eased);
    ship.userData.doorProgress = progress;
    ship.userData.rampReady = progress > .995;
  };
  ship.userData.layout = SHIP_LAYOUT;
  ship.userData.ramp = ramp;
  ship.userData.hatch = hatch;
  ship.update(0);
  return ship;
}
