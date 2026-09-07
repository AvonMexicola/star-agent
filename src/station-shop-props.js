import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Exported assets have base-centre origins and metre-scale, Y-up geometry.
// These placements sit on the counters' existing rubber work inserts; they
// add no collision boxes or changes to the physical purchase interactions.
const PROPS = [
  { id: 'kestrel-maintenance-roll', position: [12.04, -6.908, -.25] },
  { id: 'watchkeep-folded-protective-jacket', position: [-12.04, -6.908, -.25] },
];
// Enable a model only when its reviewed local export ships with this build.
// The jacket remains in the placement contract, but has no downloadable source
// available for intake yet and must not generate a speculative HTTP request.
const SHIPPED_PROP_IDS = ['kestrel-maintenance-roll'];
let sharedContactAO;

function kestrelContactAO() {
  if (sharedContactAO) return sharedContactAO;
  const size = 64, pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const radius = Math.hypot(x / (size - 1) * 2 - 1, y / (size - 1) * 2 - 1);
    const fade = THREE.MathUtils.clamp((1 - radius) / .8, 0, 1);
    const offset = (y * size + x) * 4;
    pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = 255;
    pixels[offset + 3] = Math.round(128 * fade * fade * (3 - 2 * fade));
  }
  const map = new THREE.DataTexture(pixels, size, size);
  map.name = 'Kestrel approximate contact AO';
  map.magFilter = map.minFilter = THREE.LinearFilter;
  map.needsUpdate = true;
  const material = new THREE.MeshBasicMaterial({ color: 0x000000, map,
    transparent: true, depthWrite: false, toneMapped: false });
  material.name = 'Kestrel approximate contact AO';
  material.userData.stationFinished = material.userData.unweathered = true;
  const geometry = new THREE.PlaneGeometry(.26, .27).rotateX(-Math.PI / 2);
  sharedContactAO = { geometry, material };
  return sharedContactAO;
}

/** Make an isolated cache when a different loader is needed (including tests).
 * A failed or empty model is optional dressing, never a station-finish failure.
 * The returned function shares its promise, including unavailable results. */
export function createStationShopPropLoader({ loader = new GLTFLoader(), propIds = SHIPPED_PROP_IDS } = {}) {
  if (propIds.some(id => !PROPS.some(prop => prop.id === id))) throw new Error('Unknown shop prop ID');
  const props = PROPS.filter(prop => propIds.includes(prop.id));
  let sharedPromise;
  return function load() {
    if (!sharedPromise) sharedPromise = (async () => {
      const results = await Promise.allSettled(props.map(async ({ id }) => {
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
        const { id } = props[index];
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
      // policy treats as flat print meshes. Retain the policy for future props;
      // the small static roll uses local contact AO instead of a biased shadow.
      node.name = `ShopProp_${id}_${meshIndex++}`;
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      node.castShadow = id !== 'kestrel-maintenance-roll' && materials.every(material => !material.transparent);
      node.receiveShadow = true;
    });
    placement.add(model);
    if (id === 'kestrel-maintenance-roll') {
      // Approximate contact AO for this static counter sample, not a dynamic
      // cast shadow. Keep global light bias and other merchandise unchanged.
      const { geometry, material } = kestrelContactAO();
      const contact = new THREE.Mesh(geometry, material);
      contact.name = 'ContactAO_Kestrel';
      contact.userData.approximateContactAO = true;
      contact.position.y = .00075;
      contact.castShadow = contact.receiveShadow = false;
      placement.add(contact);
    }
    group.add(placement);
  }
  return group;
}
