import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createShipMFDs} from './ship-mfd.js';
import {GANNET_LAYOUT as L, gannetMechanismPose} from './gannet-layout.js';
import {gearStep} from './gear-flight.js';

/** Hull-only loader/visual adapter. Movement and carrier authority stay with
 * Navigation and its caller; this module never spawns or teleports a rover. */
export function createGannet(systems, {url = '/models/gannet.glb'} = {}) {
  const root = new THREE.Group();
  root.name = 'Meridian Gannet T-06';
  root.userData.assetStatus = 'loading';
  root.userData.manufacturer = L.manufacturer;
  root.userData.shipId = L.id;
  const mfd = createShipMFDs({height:320, includeFrames:false});
  const textures = mfd.screenTextures();
  const nodes = new Map();
  let asset, gearProgress = 1, lastPose = null;
  root.readyPromise = new GLTFLoader().loadAsync(url).then(gltf => {
    const candidate = gltf.scene;
    const required = [...L.requiredNodes, ...L.gear.nodes.map(n => n.node), ...L.mfdMounts.map(n => n.anchor), ...Array.from({length:L.hatch.slats}, (_,i) => `HatchSlat_${i + 1}`)];
    for (const name of required) {
      const node = candidate.getObjectByName(name);
      if (!node) throw new Error(`Gannet asset missing ${name}`);
      nodes.set(name, node);
    }
    // Validate all intake before publishing an incomplete physical assembly.
    for (const definition of L.mfdMounts) {
      const target = nodes.get(definition.node);
      const surfaces = [];
      target.traverse(node => { if (node.isMesh) surfaces.push(node); });
      if (surfaces.length !== 1) throw new Error(`Gannet ${definition.node} must have exactly one display surface`);
    }
    candidate.traverse(node => {
      if (!node.isMesh) return;
      node.castShadow = true; node.receiveShadow = true;
      for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
        material.userData.authoredSurface = true;
        if (material.transparent) { node.castShadow = false; material.depthWrite = false; material.side = THREE.DoubleSide; }
      }
    });
    L.mfdMounts.forEach((definition, i) => {
      textures[i].flipY = false;
      nodes.get(definition.node).traverse(node => {
        if (!node.isMesh) return;
        node.material = new THREE.MeshBasicMaterial({map:textures[i], toneMapped:false});
        node.material.userData.unweathered = true;
        node.castShadow = false; node.receiveShadow = false;
      });
    });
    asset = candidate; root.add(asset);
    root.userData.assetStatus = 'ready';
    root.setMechanismPose(lastPose ?? systems?.mechanismPose(gearProgress) ?? {});
    return root;
  }).catch(error => {
    root.userData.assetStatus = 'error'; root.userData.assetError = error.message;
    throw error;
  });
  root.setMechanismPose = pose => {
    lastPose = {...pose};
    if(Number.isFinite(pose?.gearProgress))gearProgress=THREE.MathUtils.clamp(pose.gearProgress,0,1);
    const evaluated = gannetMechanismPose(pose);
    if (!asset) return;
    for (const definition of L.gear.nodes) nodes.get(definition.node).position.y = definition.position[1] + evaluated.gearOffset;
    nodes.get(L.lift.node).position.y = evaluated.liftY;
    // Slat coordinates are canonical ship-local; account for the actual parent.
    const inverse = new THREE.Matrix4();
    root.updateMatrixWorld(true);
    for (const slat of evaluated.slats) {
      const node = nodes.get(slat.node);
      inverse.copy(node.parent.matrixWorld).invert();
      node.position.copy(new THREE.Vector3(0,slat.y,slat.z).applyMatrix4(root.matrixWorld).applyMatrix4(inverse));
    }
    root.updateMatrixWorld(true);
  };
  root.updateGear = (dt, deployed, authoritativeProgress) => {
    if (Number.isFinite(authoritativeProgress)) gearProgress = THREE.MathUtils.clamp(authoritativeProgress,0,1);
    else if(Number.isFinite(dt))gearProgress = gearStep(gearProgress,deployed,dt);
    root.setMechanismPose(systems?.mechanismPose(gearProgress) ?? {...lastPose,gearProgress});
  };
  root.update = () => root.setMechanismPose(systems?.mechanismPose(gearProgress) ?? lastPose ?? {});
  root.updateDisplays = (dt, nav, inventory, course) => mfd.update(dt,nav,inventory,course);
  root.displayState = () => mfd.snapshot();
  root.updateInspectionDisplays = dt => mfd.updatePages(dt, [
    {rows:[['VESSEL',L.name],['MODE','INSPECTION'],['LENGTH','24.0 m']],footer:'Hull studio · no flight simulation'},
    {rows:[['BAY CLEAR','5.8 × 6.5 m'],['HEADROOM','3.2 m'],['PAYLOAD','BURROW M-04']],footer:'Actual authored clearance targets'},
    {rows:[['LIFT',(systems?.lift.y ?? L.lift.high).toFixed(2)+' m'],['HATCH',`${Math.round((systems?.hatch.progress ?? 0)*100)}%`],['SECURED',systems?.secured ? 'YES' : 'NO']],footer:'Actual local mechanism state'},
    {rows:[['FREIGHT','128 SBU'],['ROVER BIN','96 kg'],['STATUS','UNLOADED']],footer:'Capacity · no trade inventory in studio'},
  ]);
  root.assetNode = name => nodes.get(name) ?? null;
  root.dispose = () => {
    const geometries = new Set(), materials = new Set(), maps = new Set();
    for(const tree of [root,mfd])tree.traverse(node => {
      if (!node.isMesh) return;
      geometries.add(node.geometry);
      for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
        materials.add(material);
        for (const value of Object.values(material)) if (value?.isTexture) maps.add(value);
      }
    });
    geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); maps.forEach(t => t.dispose());
    root.removeFromParent();
  };
  return root;
}
