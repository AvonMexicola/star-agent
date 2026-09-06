import * as THREE from 'three';
import { stationFinishPalette } from './station-finish-palette.js';

const DECK_URL = '/textures/station/material-charcoal-deck.webp';
const MATERIAL_KEYS = {
  Hull: 'ivory', HullPanel: 'ivory', ServiceTeal: 'petrol',
  Gunmetal: 'steel', Truss: 'dark', Deck: 'deck', Rubber: 'rubber', ServiceOchre: 'ochre',
  FinishIvory: 'ivory', FinishPetrol: 'petrol', FinishSteel: 'steel', FinishDark: 'dark',
  FinishDeck: 'deck', FinishRubber: 'rubber', FinishOchre: 'ochre',
  ControlGlass: 'galleryBack', FinishGlass: 'observationGlass',
};

function tileSettings(texture) {
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 4;
  return texture;
}

/** Independent, periodic manufacturing relief. R is bump; G is roughness.
 * This does not infer surface height from shadows in the generated colour image.
 */
function manufacturingTexture(brushed = false) {
  const size = brushed ? 128 : 512;
  const data = new Uint8Array(size * size * 4);
  const random = (x, y) => {
    let n = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ 7291;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
  };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const k = (y * size + x) * 4;
    const grain = random(x, y);
    const brush = .82 * random(x, 0) + .18 * grain;
    data[k] = Math.round(255 * (brushed ? .36 + .28 * brush : .4 + .2 * grain));
    data[k + 1] = Math.round(255 * (.90 + .08 * grain));
    data[k + 2] = 0;
    data[k + 3] = 255;
  }
  const texture = tileSettings(new THREE.DataTexture(data, size, size, THREE.RGBAFormat));
  texture.name = brushed ? 'Station brushed steel microrelief' : 'Station powdercoat microrelief';
  texture.colorSpace = THREE.NoColorSpace;
  texture.repeat.setScalar(brushed ? 10 : 1);
  texture.needsUpdate = true;
  return texture;
}

/** Missing station UVs are generated from dominant face axes in mesh-local metres.
 * Positions remain local: camera/world origin never enters a float attribute.
 * Blender exports hard edges as split vertices, so box faces have separate UVs.
 * The only image map is on the planar deck; rounded hardware gets subtle grain.
 */
export function ensureStationMaterialUVs(geometry, scale = new THREE.Vector3(1, 1, 1)) {
  if (geometry.hasAttribute('uv')) return false;
  const positions = geometry.getAttribute('position');
  if (!positions) return false;
  if (!geometry.hasAttribute('normal')) geometry.computeVertexNormals();
  const normals = geometry.getAttribute('normal');
  const uv = new Float32Array(positions.count * 2);
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i) * scale.x, y = positions.getY(i) * scale.y, z = positions.getZ(i) * scale.z;
    const nx = Math.abs(normals.getX(i) / scale.x);
    const ny = Math.abs(normals.getY(i) / scale.y);
    const nz = Math.abs(normals.getZ(i) / scale.z);
    // One UV interval covers 2 m. Axis signs retain a right-handed projection.
    const pair = nx >= ny && nx >= nz ? [z, y] : ny >= nz ? [x, z] : [x, y];
    uv[i * 2] = pair[0] / 2;
    uv[i * 2 + 1] = pair[1] / 2;
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geometry.userData.stationMetreUVs = true;
  return true;
}

/** Load once, apply to hero + LOD before cloning twenty pods.
 * No shader replacements: native standard-material normal, roughness, colour
 * management and logarithmic-depth chunks remain intact. Custom shaders and
 * emissive/navigation/glass/marking materials are deliberately preserved.
 */
export async function createStationFinishMaterials({ palette = stationFinishPalette(), textureLoader = new THREE.TextureLoader() } = {}) {
  const deck = tileSettings(await textureLoader.loadAsync(DECK_URL));
  deck.name = 'Station charcoal deck / generated colour';
  deck.colorSpace = THREE.SRGBColorSpace;
  // Mirror at sampler boundaries: a full-resolution source covers 2 m, and its
  // reflected neighbours meet without a hard seam. The full cycle is 4 m.
  deck.wrapS = deck.wrapT = THREE.MirroredRepeatWrapping;
  const powdercoat = manufacturingTexture();
  const brushed = manufacturingTexture(true);
  const definitions = {
    ivory: { color: palette.ivory, metalness: .12, roughness: .76, bumpScale: .00045 },
    petrol: { color: palette.petrol, metalness: .16, roughness: .70, bumpScale: .00045 },
    steel: { color: palette.steel, metalness: .65, roughness: .39, bumpScale: .00012, bumpMap: brushed, roughnessMap: brushed },
    dark: { color: palette.dark, metalness: .52, roughness: .53, bumpScale: .00022 },
    rubber: { color: palette.rubber, metalness: 0, roughness: .98, bumpScale: .00065 },
    deck: { color: 'white', metalness: .08, roughness: .86, bumpScale: .0014, map: deck },
    ochre: { color: palette.ochre, metalness: .14, roughness: .73, bumpScale: .0004 },
    // The original opaque control-room pane becomes the dim rear surface of the
    // shallow gallery. The new transparent pane is separate Blender geometry.
    galleryBack: { color: palette.dark, metalness: .08, roughness: .36, emissive: palette.cool, emissiveIntensity: .035, envMapIntensity: .25, bumpMap: null, roughnessMap: null, bumpScale: 0 },
    observationGlass: { color: palette.cool, metalness: .12, roughness: .18, transparent: true, opacity: .14, depthWrite: false, envMapIntensity: .35, bumpMap: null, roughnessMap: null, bumpScale: 0 },
  };
  const materials = Object.fromEntries(Object.entries(definitions).map(([key, definition]) => {
    const material = new THREE.MeshStandardMaterial({
      bumpMap: powdercoat, roughnessMap: powdercoat, envMapIntensity: .65, ...definition,
    });
    material.name = `StationFinish_${key}`;
    material.userData.stationFinished = true;
    material.userData.unweathered = true;
    return [key, material];
  }));
  const seenGeometry = new WeakSet();
  const stats = { replacedMeshes: 0, generatedUVs: 0, materialCount: Object.keys(materials).length, textureCount: 3,
    // RGBA, including full mip chains. Textures are shared across every bay.
    estimatedTextureBytes: Math.ceil((1024 ** 2 + 512 ** 2 + 128 ** 2) * 4 * 4 / 3) };
  const absoluteScale = new THREE.Vector3();
  const apply = root => {
    root.updateMatrixWorld(true);
    root.traverse(mesh => {
      if (!mesh.isMesh) return;
      let replaced = false;
      const replace = source => {
        if (!source || source.userData.stationFinished) return source;
        const key = MATERIAL_KEYS[source.name];
        if (!key || source.transparent && source.name !== 'FinishGlass') return source;
        if (source.emissiveIntensity > .8 && source.emissive?.getHex() !== 0 && source.name !== 'ControlGlass') return source;
        // An authored custom shader may encode functional behaviour. Leave it alone.
        if (source.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile) return source;
        replaced = true;
        return materials[key];
      };
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(replace) : replace(mesh.material);
      if (!replaced) return;
      if (!seenGeometry.has(mesh.geometry)) {
        mesh.getWorldScale(absoluteScale);
        if (ensureStationMaterialUVs(mesh.geometry, absoluteScale)) stats.generatedUVs++;
        seenGeometry.add(mesh.geometry);
      }
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      stats.replacedMeshes++;
    });
    return root;
  };
  return { apply, materials, textures: { deck, powdercoat, brushed }, stats };
}
