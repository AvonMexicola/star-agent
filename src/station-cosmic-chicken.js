import * as THREE from 'three';
import { stationFinishPalette } from './station-finish-palette.js';

/** COSMIC CHICKEN is the promenade's galley tenant. Its two wall prints and its
 * menu board are runtime textures hung on the physical cassettes the promenade
 * kit already builds, exactly as the concourse campaigns are: the artwork is
 * never baked into geometry, and a failed image leaves a plain printed board
 * rather than breaking the station. */
export const COSMIC_CHICKEN_PRINTS = Object.freeze([
  Object.freeze({ node: 'CosmicPosterFore', texture: 'poster-wings', size: Object.freeze([1.05, 1.312]), yaw: Math.PI }),
  Object.freeze({ node: 'CosmicPosterAft', texture: 'poster-sando', size: Object.freeze([1.05, 1.312]), yaw: 0 }),
  Object.freeze({ node: 'CosmicMenuBoard', texture: 'menu', size: Object.freeze([1.72, 1.29]), yaw: Math.PI / 2 }),
]);
const URLS = Object.freeze({
  'poster-wings': '/textures/station/cosmic-chicken-poster-wings.webp',
  'poster-sando': '/textures/station/cosmic-chicken-poster-sando.webp',
  menu: '/textures/station/cosmic-chicken-menu.webp',
});

function plainTexture(color) {
  const c = new THREE.Color(color).convertLinearToSRGB();
  const map = new THREE.DataTexture(new Uint8Array([Math.round(c.r * 255), Math.round(c.g * 255), Math.round(c.b * 255), 255]), 1, 1);
  map.colorSpace = THREE.SRGBColorSpace;
  map.needsUpdate = true;
  return map;
}

/** Make an isolated cache when a different loader is needed, including tests.
 * The returned function shares one promise, unavailable results included. */
export function createCosmicChickenLoader({ loader = new THREE.TextureLoader() } = {}) {
  let shared;
  return function load() {
    if (!shared) shared = (async () => {
      const palette = stationFinishPalette();
      const entries = Object.entries(URLS);
      const results = await Promise.allSettled(entries.map(([, url]) => loader.loadAsync(url)));
      const materials = {}, status = {};
      results.forEach((result, index) => {
        const [key] = entries[index];
        const ready = result.status === 'fulfilled' && result.value;
        status[key] = ready ? 'ready' : 'unavailable';
        const map = ready ? result.value : plainTexture(palette.paper);
        map.colorSpace = THREE.SRGBColorSpace;
        map.anisotropy = 8;
        map.name = `Cosmic Chicken ${key}`;
        // The wall prints are matte paper. The board is an illuminated menu, so
        // it carries its own restrained emissive and stays readable when the
        // unit light is behind the customer. This adds no light to the scene.
        const lit = key === 'menu';
        const material = new THREE.MeshStandardMaterial({
          map, roughness: lit ? .82 : .95, metalness: 0,
          ...(lit ? { emissive: 0xffffff, emissiveMap: map, emissiveIntensity: .32 } : {}),
        });
        material.name = `Cosmic Chicken ${key} print`;
        // The station finish must not repaint or weather a printed sheet.
        material.userData = { stationFinished: true, unweathered: true };
        materials[key] = material;
      });
      return { materials, status };
    })();
    return shared;
  };
}

/** One resource promise for all station instances; no request until called. */
export const loadCosmicChickenGraphics = createCosmicChickenLoader();

/** Hang the prints on the kit's anchors, in the promenade's local metres. Each
 * print is one plane; none is a collider or a shadow caster. */
export function createCosmicChickenGraphics(props, resources) {
  const group = new THREE.Group();
  group.name = 'Cosmic Chicken prints';
  group.userData.cosmicChicken = { ...resources.status };
  const placements = [];
  // The group hangs beside the kit under the same parent, so every anchor is
  // read back through that parent's inverse. The station is already placed and
  // rebased when the finish arrives; a raw world position would put the prints
  // kilometres from their cassettes.
  props.updateWorldMatrix(true, true);
  const inverseParent = props.parent ? props.parent.matrixWorld.clone().invert() : new THREE.Matrix4();
  for (const { node, texture, size, yaw } of COSMIC_CHICKEN_PRINTS) {
    const anchor = props.getObjectByName(node);
    if (!anchor) continue;
    const position = anchor.getWorldPosition(new THREE.Vector3()).applyMatrix4(inverseParent);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(...size), resources.materials[texture]);
    // Sign_ keeps it out of the room collider and the hub's shadow-caster pass.
    mesh.name = `Sign_Cosmic_${node}`;
    mesh.position.copy(position);
    mesh.rotation.y = yaw;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    group.add(mesh);
    placements.push({ node, texture, size: [...size], position: position.toArray() });
  }
  group.userData.printPlacements = placements;
  return group;
}
