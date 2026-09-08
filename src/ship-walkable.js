import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { SHIP_LAYOUT } from './boarding.js';
import { createShipMFDs } from './ship-mfd.js';
import { createNomadCabin } from './nomad-cabin.js';
import { mountTransformFromAsset } from './weapon-mounts.js';
export { SHIP_LAYOUT } from './boarding.js';

/** A hollow, boardable explorer. +Y is up; the cockpit faces -Z.
 * The ramp's upper surface, cabin floor, and SHIP_LAYOUT use the same geometry.
 * setDoor() selects the target; update(dt) animates both hatch and ramp in seconds.
 */
export function createWalkableShip({ assetURL = `${import.meta.env.BASE_URL}models/nomad.glb` } = {}) {
  const ship = new THREE.Group();
  ship.name = 'Nomad / solo utility ship';
  const exterior = new THREE.Group();exterior.name = 'Procedural exterior fallback';ship.add(exterior);
  let activeGroup;
  let cargoLid;
  let gearRoots = [], driveMaterials = [];
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
    glass: new THREE.MeshStandardMaterial({ color: 0x203d42, transparent: true, opacity: .94, metalness: .60, roughness: .15, side: THREE.DoubleSide, depthWrite: false }),
    mint: new THREE.MeshStandardMaterial({ color: 0x98ffe0, emissive: 0x55ffd0, emissiveIntensity: 2, toneMapped: false }),
    amber: new THREE.MeshStandardMaterial({ color: 0xffc078, emissive: 0xff9c43, emissiveIntensity: 1.8, toneMapped: false }),
    blue: new THREE.MeshStandardMaterial({ color: 0x8ce0ff, emissive: 0x348ecb, emissiveIntensity: 1.7, toneMapped: false }),
    display: new THREE.MeshStandardMaterial({ color: 0x073544, emissive: 0x0e596b, emissiveIntensity: .85, roughness: .25 }),
  };
  // Inside-facing glazing is clear from the pilot eye, with a darker reflective
  // exterior coating. The standard material retains Three's logarithmic depth.
  finish.glass.userData.unweathered = true;
  finish.glass.forceSinglePass = true;
  finish.glass.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>',
      '#include <color_fragment>\n diffuseColor.a *= gl_FrontFacing ? 0.06 : 1.0;');
  };
  finish.glass.customProgramCacheKey = () => 'nomad-directional-glazing-v1';
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
    if (material === finish.glass) {
      const normal = new THREE.Vector3().fromBufferAttribute(geometry.attributes.normal, 0);
      const middle = points.reduce((sum, point) => sum.add(new THREE.Vector3(...point)), new THREE.Vector3()).multiplyScalar(.25);
      if (normal.dot(new THREE.Vector3(...SHIP_LAYOUT.seatEye).sub(middle)) < 0) {
        geometry.setIndex([0, 2, 1, 0, 3, 2]);geometry.computeVertexNormals();
      }
    }
    return part(geometry, material);
  }

  // The cabin is assembled from separate walls and floor; nothing fills its volume.
  box(0, .88, -.25, 3.64, .24, 8.5, finish.floor);
  box(0, .68, -.2, 3.28, .18, 8.25, finish.dark);
  const ceiling = finish.dark.clone();ceiling.side = THREE.DoubleSide;
  box(0, 3.43, .20, 3.18, .08, 4.10, finish.dark);
  quad([[-1.59, 3.40, 2.25], [-1.53, 3.18, 3.93], [1.53, 3.18, 3.93], [1.59, 3.40, 2.25]], ceiling);
  quad([[-1.60, 3.40, -1.78], [-1.52, 3.29, -3.98], [1.52, 3.29, -3.98], [1.60, 3.40, -1.78]], ceiling);
  for (const side of [-1, 1]) {
    box(side * 1.77, 2.08, 1.1, .18, 2.15, 5.8, finish.hull);
    box(side * 1.666, 2.09, 1.1, .025, 2.10, 5.65, finish.dark);
    box(side * 1.84, 1.54, -3.15, .18, 1.08, 2.7, finish.hull);
    quad([[side * 1.60, 2.09, -4.84], [side * 1.84, 2.19, -2.44], [side * 1.84, 3.59, -2.48], [side * 1.60, 3.34, -3.98]], finish.glass);
    // The upper liner follows the roof chamfer and stays clear of standing heads.
    quad([[side * 1.666, 3.16, -1.79], [side * 1.59, 3.40, -1.79], [side * 1.59, 3.40, 2.25], [side * 1.666, 3.16, 3.93]], ceiling);
    for (const z of [-.65, 1.15, 2.95]) box(side * 1.641, 2.11, z, .035, 2.14, .065, finish.metal);
    box(side * 1.55, 3.30, .20, .035, .035, 4.05, finish.mint);
    rod([side * 1.52, 3.27, 2.24], [side * 1.48, 3.12, 3.70], .014, finish.mint);
    box(side * 1.61, 1.017, .05, .028, .014, 7.45, finish.amberPaint);
  }
  for (let i = 0; i < 11; i++) box(0, 1.006, -4.1 + i * .75, 3.4, .008, .012, finish.dark);
  box(0, 1.015, 3.59, 1.75, .014, .09, finish.amberPaint);

  // Large front windscreen: no opaque nose or console intersects the seated view.
  quad([[-1.60, 2.09, -4.84], [1.60, 2.09, -4.84], [1.60, 3.34, -3.98], [-1.60, 3.34, -3.98]], finish.glass);
  box(0, 1.18, -4.56, 3.76, .36, .19, finish.hull);
  activeGroup = exterior;
  panel([[-1.87, -4.6], [-.56, -6.72], [.56, -6.72], [1.87, -4.6]], 1.24, .42, finish.hull);
  panel([[-1.4, -4.65], [-.39, -6.56], [.39, -6.56], [1.4, -4.65]], 1.255, .025, finish.dark);
  for (const x of [-.43, .43]) box(x, 1.10, -6.73, .14, .085, .032, finish.mint);

  const consoleFallback = new THREE.Group();consoleFallback.name = 'Pilot console fallback';ship.add(consoleFallback);
  activeGroup = consoleFallback;
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
    box(side * 1.40, 2.225, 4.0, 1.00, 2.45, .18, finish.hull);
    box(side * .956, 2.24, 4.116, .09, 2.47, .1, finish.metal);
    box(side * 1.025, 2.85, 4.145, .035, .53, .025, finish.amber);
  }
  // The compact collar encloses six telescoping slats in separate depth tracks.
  box(0, 3.75, 3.78, 1.96, .50, .80, finish.dark);
  box(0, 4.015, 3.78, 2.00, .065, .80, finish.hull);
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
  const leaf = new THREE.Group();leaf.name = 'Folding outer ramp';leaf.position.set(0, -.12, rampLength / 2);ramp.add(leaf);
  const rampPart = (x, y, z, width, height, depth, material) => {
    const outer = z >= rampLength / 2;
    return box(x, y + (outer ? .12 : 0), z - (outer ? rampLength / 2 : 0), width, height, depth, material, outer ? leaf : ramp);
  };
  // Local upper face y=0 gives the exact walk plane y = 1 - (z - 4) / 3.2.
  for (const z of [rampLength / 4, rampLength * 3 / 4]) {
    rampPart(0, -.055, z, 1.8, .11, rampLength / 2 - .012, finish.floor);
    for (const side of [-1, 1]) rampPart(side * .847, .008, z, .045, .016, rampLength / 2 - .06, finish.amberPaint);
    rampPart(0, -.10, z, .1, .018, rampLength / 2 - .15, finish.mint);
  }
  for (let i = 0; i < 15; i++) rampPart(0, .007, .13 + i * .215, 1.63, .014, .035, finish.metal);
  for (const side of [-1, 1]) rod([side * .89, -.12, rampLength / 2], [side * .96, -.12, rampLength / 2], .075, finish.metal, ramp);
  // Outboard pin bearings leave the walking floor continuous at the throat.
  // A full-width axle here would protrude above the authoritative ramp plane.
  for (const side of [-1, 1]) rod([side * .93, 1, 4], [side * 1.08, 1, 4], .06, finish.metal);

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
    const light = new THREE.PointLight(0xb9f6e7, 4.5, 6, 2);
    light.position.set(0, 3.17, z);
    ship.add(light);
  }
  const mfds = createShipMFDs();ship.add(mfds);
  const cabin = createNomadCabin();ship.add(cabin);
  // The canonical navigation clock is the sole pose input. This adapter replaces
  // the generic telescoping rig used by ships in the flight-options lane.
  ship.updateGear = (_dt, _deployed, authoritativeProgress) => {
    const progress = THREE.MathUtils.clamp(authoritativeProgress ?? 1, 0, 1);
    const fold = 1 - progress * progress * (3 - 2 * progress);
    for (const { object, spec, offset } of gearRoots) {
      object.position.fromArray(spec.pivot).addScaledVector(offset, fold);
      object.rotation.z = spec.retractAngle * fold;
    }
    ship.userData.gearProgress = progress;ship.userData.gearAssemblies = gearRoots.length;
  };
  ship.updateCabin = (nav, store) => {
    cabin.update(nav, store);
    ship.updateGear(0, nav.gearDeployed, nav.gearProgress ?? (nav.mode === 'landed' ? 1 : 0));
    const flying = nav.mode === 'flight' || nav.cabinFlight;
    const thrust = THREE.MathUtils.clamp((nav.engineAcceleration?.length() ?? 0) / 12, 0, 1);
    const intensity = nav.powered === false ? 0 : flying ? .24 + thrust * 2 : .055;
    for (const material of driveMaterials) material.emissiveIntensity = intensity;
    ship.userData.driveIntensity = intensity;
  };
  ship.cabinState = () => ({ ...cabin.userData.cargo });
  ship.updateDisplays = (dt, nav, inventory, course) => mfds.update(dt, nav, inventory, course);
  ship.displayState = () => mfds.snapshot();
  ship.userData.assetStatus = 'loading';
  ship.readyPromise = new GLTFLoader().loadAsync(assetURL).then(({ scene: model }) => {
    // Validate the whole interactive assembly before adopting any authored part.
    // A parseable partial GLB must not overlap its cabin with the live fallback.
    const required = ['CargoLid', 'PilotChair', 'NomadConsole', 'NomadCabin',
      ...Array.from({ length: 8 }, (_, i) => `CargoBox_${i + 1}`)];
    for (const name of required) if (!model.getObjectByName(name)) throw new Error(`Nomad asset is missing ${name}`);
    const lid = model.getObjectByName('CargoLid');
    const rig = SHIP_LAYOUT.gear.legs.map(spec => ({ spec, object: model.getObjectByName(spec.name), offset: new THREE.Vector3(...spec.retractOffset) }));
    if (rig.some(leg => !leg.object)) throw new Error('Nomad asset is missing a landing gear root');
    const hardpoints = SHIP_LAYOUT.hardpoints.map(spec => {
      const node = model.getObjectByName(spec.name);
      if (!node) throw new Error(`Nomad asset is missing ${spec.name}`);
      return { name: node.name, ...node.userData, position: node.position.toArray() };
    });
    model.name = 'Blender Nomad exterior and storage';
    model.traverse(object => { if (object.isMesh) {
      object.castShadow = true;object.receiveShadow = true;
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        if (material.map) material.userData.authoredSurface = true;
        if (material.name === 'Drive / ion blue' && !driveMaterials.includes(material)) {
          material.color.set(0x102c37);material.emissive.set(0x42b8ee);driveMaterials.push(material);
        }
      }
    } });
    ship.add(model);cargoLid = lid;exterior.visible = false;cargoFallback.visible = false;
    if(model.getObjectByName('PilotChair'))chairFallback.visible=false;
    if(model.getObjectByName('NomadConsole'))consoleFallback.visible=false;
    cabin.adoptModel(model);
    gearRoots = rig;ship.userData.hardpoints = hardpoints;
    ship.mountTransform = (name, attachment) => {
      const spec = SHIP_LAYOUT.hardpoints.find(point => point.name === name);
      if (!spec) throw new RangeError(`Unknown Nomad hardpoint ${name}`);
      return mountTransformFromAsset(model, { node: name, size: spec.size }, attachment);
    };
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
    const track = Math.min(1, eased / .2), raise = Math.max(0, (eased - .2) / .8);
    for (let i = 0; i < slats.length; i++) {
      const base = 1 + (i + .5) * 2.5 / 6;
      slats[i].position.y = THREE.MathUtils.lerp(base, 3.725, raise);
      slats[i].position.z = 4.015 - i * .105 * track;
    }
    ramp.rotation.x = THREE.MathUtils.lerp(-Math.PI / 2, Math.atan2(1, 3.2), eased);
    leaf.rotation.x = Math.PI * (1 - eased);
    ship.userData.doorProgress = progress;
    ship.userData.rampReady = progress > .995;
  };
  ship.userData.layout = SHIP_LAYOUT;
  ship.userData.ramp = ramp;
  ship.userData.hatch = hatch;
  ship.update(0);
  return ship;
}
