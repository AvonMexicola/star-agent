import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Exported assets have base-centre origins and metre-scale, Y-up geometry.
// These placements sit on the counters' existing rubber work inserts; they
// add no collision boxes or changes to the physical purchase interactions.
const PROPS = [
  { id: 'kestrel-maintenance-roll', position: [12.04, -6.908, -.25] },
  { id: 'watchkeep-folded-protective-jacket', position: [-12.04, -6.908, -.25] },
];

/** Make an isolated cache when a different loader is needed (including tests).
 * A failed or empty model is optional dressing, never a station-finish failure.
 * The returned function shares its promise, including unavailable results. */
export function createStationShopPropLoader({ loader = new GLTFLoader() } = {}) {
  let sharedPromise;
  return function load() {
    if (!sharedPromise) sharedPromise = (async () => {
      const results = await Promise.allSettled(PROPS.map(async ({ id }) => {
        const asset = await loader.loadAsync(`/models/props/${id}.glb`);
        if (!asset?.scene?.isObject3D) throw new Error(`Missing prop scene: ${id}`);
        let meshes = 0;
        asset.scene.traverse(node => {
          if (!node.isMesh) return;
          meshes++;
          for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
            material.userData.stationFinished = true;
            material.userData.unweathered = true;
          }
        });
        if (!meshes) throw new Error(`Empty prop scene: ${id}`);
        return asset.scene;
      }));
      const scenes = {}, status = {};
      results.forEach((result, index) => {
        const { id } = PROPS[index];
        status[id] = result.status === 'fulfilled' ? 'ready' : 'unavailable';
        if (result.status === 'fulfilled') scenes[id] = result.value;
      });
      return { scenes, status };
    })();
    return sharedPromise;
  };
}

/** One resource promise for all station instances; no requests until called. */
export const loadStationShopProps = createStationShopPropLoader();

/** Add the returned group to hub.group after awaiting loadStationShopProps().
 * Node graphs are private per attachment; geometry, materials and maps remain
 * shared. The hub supplies the world transform, keeping GPU geometry local. */
export function createStationShopProps(resources) {
  const group = new THREE.Group();
  group.name = 'Shop counter props';
  group.userData.shopProps = { ...resources.status };
  for (const { id, position } of PROPS) {
    const source = resources.scenes[id];
    if (!source) continue;
    const placement = new THREE.Group();
    placement.name = id;
    placement.position.fromArray(position);
    const model = source.clone(true);
    let meshIndex = 0;
    model.traverse(node => {
      if (!node.isMesh) return;
      // Generated names may contain Detail or Sign_, which the hub's shadow
      // policy treats as flat print meshes. These props need contact shadows.
      node.name = `ShopProp_${id}_${meshIndex++}`;
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      node.castShadow = materials.every(material => !material.transparent);
      node.receiveShadow = true;
    });
    placement.add(model);
    group.add(placement);
  }
  return group;
}
