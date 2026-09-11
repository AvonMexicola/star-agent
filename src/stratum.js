import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createStratumSystems } from './stratum-systems.js';

function disposeModel(model) {
  const geometries = new Set(), materials = new Set(), textures = new Set();
  model?.traverse(object => {
    if (object.geometry) geometries.add(object.geometry);
    for (const material of [object.material].flat().filter(Boolean)) {
      materials.add(material);
      for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
    }
  });
  for (const value of [...textures, ...materials, ...geometries]) value.dispose();
}

/** Load one privately owned asset instance. No invisible or partial playable hull. */
export function createStratum({ url = '/models/stratum.glb', loader = new GLTFLoader() } = {}) {
  const root = new THREE.Group();
  root.name = 'Stratum';
  root.userData.assetStatus = 'loading';
  let disposed = false, model = null, systems = null;
  let requestedPose = { gearProgress: 1, rampProgress: 0 };
  root.readyPromise = loader.loadAsync(url).then(gltf => {
    model = gltf.scene;
    if (disposed) { disposeModel(model); model = null; return null; }
    systems = createStratumSystems(model);
    model.traverse(object => { if (object.isMesh) { object.castShadow = true; object.receiveShadow = true; } });
    systems.applyPose(requestedPose);
    root.add(model);
    root.userData.assetStatus = 'ready';
    return systems;
  }).catch(error => {
    if (model) { disposeModel(model); model = null; }
    systems = null;
    if (!disposed) { root.userData.assetStatus = 'error'; root.userData.assetError = String(error.message || error); }
    return null;
  });
  root.applyPose = pose => { requestedPose = { ...requestedPose, ...pose }; return systems?.applyPose(requestedPose) ?? null; };
  root.muzzle = (...args) => systems?.muzzle(...args) ?? null;
  root.nozzle = (...args) => systems?.nozzle(...args) ?? null;
  root.snapshot = () => ({ assetStatus: root.userData.assetStatus, assetError: root.userData.assetError ?? null, ...(systems?.snapshot() ?? {}) });
  root.getDisplays = () => systems?.displays.slice() ?? [];
  root.dispose = () => {
    if (disposed) return;
    disposed = true;
    if (model) { root.remove(model); disposeModel(model); model = null; }
    systems = null;
    root.userData.assetStatus = 'disposed';
  };
  return root;
}
