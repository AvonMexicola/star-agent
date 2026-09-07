import * as THREE from 'three';

const SIZE = 512, LAYERS = 8;
let shared;

function arrayTexture(pixel, colorSpace) {
  const data = new Uint8Array(LAYERS * 4);
  for (let i = 0; i < LAYERS; i++) data.set(pixel, i * 4);
  const texture = new THREE.DataArrayTexture(data, 1, 1, LAYERS);
  texture.colorSpace = colorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

async function pixels(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Terrain map ${response.status}: ${url}`);
  const bitmap = await createImageBitmap(await response.blob(), { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
  try {
    if (bitmap.width !== SIZE || bitmap.height !== SIZE * LAYERS) throw new Error(`Invalid terrain atlas dimensions: ${url}`);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width; canvas.height = bitmap.height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(bitmap, 0, 0);
    return new Uint8Array(context.getImageData(0, 0, canvas.width, canvas.height).data);
  } finally { bitmap.close(); }
}

/** One pair of local arrays shared by both bodies. A failed load retains their
 * procedural materials; publication is atomic, and late loads cannot revive disposal. */
export function acquireTerrainMaps() {
  if (!shared) {
    const entry = { refs: 0, disposed: false, ready: { value: 0 },
      albedo: arrayTexture([128, 128, 128, 255], THREE.SRGBColorSpace),
      normal: arrayTexture([128, 128, 240, 255], THREE.NoColorSpace) };
    shared = entry;
    entry.loaded = Promise.all([
      pixels(`${import.meta.env.BASE_URL}materials/terrain/albedo.png`),
      pixels(`${import.meta.env.BASE_URL}materials/terrain/normal-roughness.png`),
    ]).then(([albedo, normal]) => {
      if (entry.disposed) return false;
      for (const [texture, data] of [[entry.albedo, albedo], [entry.normal, normal]]) {
        texture.dispose(); // Reallocate the placeholder's immutable GPU storage.
        texture.image = { data, width: SIZE, height: SIZE, depth: LAYERS };
        texture.needsUpdate = true;
      }
      entry.ready.value = 1;
      return true;
    }).catch(error => { if (!entry.disposed) console.warn('Using procedural terrain materials.', error.message); return false; });
  }
  const entry = shared;
  entry.refs++;
  let released = false;
  return { albedo: entry.albedo, normal: entry.normal, ready: entry.ready, loaded: entry.loaded, dispose() {
    if (released) return;
    released = true;
    if (--entry.refs === 0) {
      entry.disposed = true;
      entry.albedo.dispose(); entry.normal.dispose();
      if (shared === entry) shared = undefined;
    }
  } };
}

export function terrainMapUniforms(maps) {
  return { terrainAlbedo: { value: maps.albedo }, terrainNormal: { value: maps.normal }, terrainMapsReady: maps.ready };
}

// All repeat lengths divide the patch phase period (256m). Project normal-map
// slopes into body axes, then onto the actual surface tangent plane in view space.
// This avoids UV seams and makes the same normal map work on floors and cliffs.
export const terrainMapShader = `
precision highp sampler2DArray;
uniform sampler2DArray terrainAlbedo;
uniform sampler2DArray terrainNormal;
uniform float terrainMapsReady;
struct TerrainSample { vec3 color; vec3 gradient; float roughness; };
vec3 terrainColor(vec3 p, vec3 w, float layer) {
  return texture(terrainAlbedo,vec3(p.yz,layer)).rgb*w.x
       + texture(terrainAlbedo,vec3(p.zx,layer)).rgb*w.y
       + texture(terrainAlbedo,vec3(p.xy,layer)).rgb*w.z;
}
vec2 terrainSlope(vec2 rg) {
  // Array layers retain canvas row order (flipY=false), unlike TextureLoader's
  // usual image upload. Reflect normal Y with the vertically reflected albedo.
  vec2 xy = (rg * 2.0 - 1.0) * vec2(1.0,-1.0);
  return xy / sqrt(max(.12, 1.0 - dot(xy, xy)));
}
TerrainSample terrainSample(vec3 p, vec3 w, float layer) {
  vec3 ax = texture(terrainAlbedo, vec3(p.yz, layer)).rgb;
  vec3 ay = texture(terrainAlbedo, vec3(p.zx, layer)).rgb;
  vec3 az = texture(terrainAlbedo, vec3(p.xy, layer)).rgb;
  vec3 nx = texture(terrainNormal, vec3(p.yz, layer)).rgb;
  vec3 ny = texture(terrainNormal, vec3(p.zx, layer)).rgb;
  vec3 nz = texture(terrainNormal, vec3(p.xy, layer)).rgb;
  vec2 sx = terrainSlope(nx.rg), sy = terrainSlope(ny.rg), sz = terrainSlope(nz.rg);
  return TerrainSample(ax*w.x+ay*w.y+az*w.z,
    vec3(0.0,sx)*w.x+vec3(sy.y,0.0,sy.x)*w.y+vec3(sz,0.0)*w.z,
    nx.b*w.x+ny.b*w.y+nz.b*w.z);
}
TerrainSample terrainMix(TerrainSample a, TerrainSample b, float t) {
  return TerrainSample(mix(a.color,b.color,t),mix(a.gradient,b.gradient,t),mix(a.roughness,b.roughness,t));
}
vec3 terrainNormalAt(vec3 n, vec3 gradient, float strength) {
  vec3 g = mat3(viewMatrix) * gradient;
  return normalize(n + (g - n * dot(n,g)) * strength);
}
`;
