// Terrain material — per-pixel procedural surface detail for the planet's land patches.
//
// Drop-in replacement for `planet.landMaterial`: still a MeshStandardMaterial (three's
// lights, hemisphere light, shadow maps and the <logdepthbuf_*> chunks keep working), with
// onBeforeCompile injecting texture-quality detail computed from tileless triplanar value noise.
// No image assets.
//
//   import { createLandMaterial, updateLandMaterial } from './terrain-material.js';
//   this.landMaterial = createLandMaterial({ planetAlbedo: this.albedoUniform, albedoReady: this.albedoReady });
//   // once per frame, e.g. inside Planet.update():
//   updateLandMaterial(this.landMaterial, { renderOrigin: origin, sunDirection, time, cameraAltitude: altitude });
//
// Precision model. Patch geometry is patch-local metres and every patch Group sits at
// `node.center - renderOrigin`, so `modelMatrix * position` is the camera-relative world
// position (`vTmWorld`, exact to ~1e-7 relative). Everything that needs absolute planet
// coordinates goes through one of two exact paths instead of `vTmWorld + renderOrigin`
// (which would lose 0.1–0.2 m at 1.6e6 m and shimmer as the camera moves):
//   * height above the sphere: h = camHeight + (2·L·a + b) / (sqrt(L² + 2·L·a + b) + L) with
//     a = up·wp, b = wp·wp, L = |renderOrigin| — the large numbers only appear in the
//     denominator, so h is good to millimetres next to the camera.
//   * noise lattice coordinates: for each octave the CPU splits `R·renderOrigin / cellSize`
//     into integer cell + fraction (doubles), the shader adds `R·wp / cellSize` to the
//     fraction and carries the integer part into an integer hash. Exact for |cell| < 2^24.
// Layers: grass (vertex colour tinted), dirt (20–35° slopes), stratified rock (> 35°),
// sand with a wet band (0–4 m), snow above a latitude-dependent snowline, polar ice.
// Each layer has its own albedo, roughness and analytic-gradient height field; the height
// gradients perturb the shading normal, and a crevice term supplies micro-AO.

import * as THREE from 'three';
import { RADIUS } from './world.js';

// One orthonormal rotation applied between octaves so lattice axes never line up.
const ROT_M = [0, .8, .6, -.8, .36, -.48, -.6, -.48, .64]; // row-major
const mul3 = (A, B) => {
  const out = new Array(9).fill(0);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) for (let k = 0; k < 3; k++) out[r * 3 + c] += A[r * 3 + k] * B[k * 3 + c];
  return out;
};
const ROTS = [[1, 0, 0, 0, 1, 0, 0, 0, 1], ROT_M, mul3(ROT_M, ROT_M)];
const glslMat3 = m => `mat3(${[0, 1, 2].map(c => [0, 1, 2].map(r => m[r * 3 + c].toFixed(8)).join(',')).join(', ')})`;

// Octave table: cell size in metres (per axis, so anisotropic cells are possible), rotation
// index and the camera distance over which the octave fades out to fight aliasing shimmer.
// `fine` octaves are skipped entirely above FINE_ALTITUDE metres of camera altitude.
export const OCTAVES = [
  { size: [.06, .06, .06], rot: 1, fade: [6, 28], fine: true },     // 0 grit / blades
  { size: [.15, .15, .15], rot: 0, fade: [15, 70], fine: true },    // 1 grit
  { size: [.45, .45, .45], rot: 2, fade: [45, 220], fine: true },   // 2 pebbles, cracks
  { size: [1.4, 1.4, 1.4], rot: 1, fade: [140, 650], fine: true },  // 3 tussocks, rock blocks
  { size: [4.5, 4.5, 4.5], rot: 0, fade: [450, 2000], fine: true }, // 4 hummocks
  { size: [14, 14, 14], rot: 2, fade: [1400, 6000], fine: true },   // 5 patchiness 20 m
  { size: [45, 45, 45], rot: 1, fade: [4500, 18000], fine: true },  // 6 patchiness 50 m
  { size: [150, 150, 150], rot: 0, fade: [15000, 70000], fine: false }, // 7 moisture patches
  { size: [500, 500, 500], rot: 2, fade: [1e8, 2e8], fine: false },     // 8 mask warping
  { size: [.32, 4.0, .32], rot: 0, fade: [10, 45], fine: true },    // 9 sand ripples (north–south rows), short range
];
export const FINE_ALTITUDE = 30000;

const fragmentPars = /* glsl */`
uniform vec3 tmUp;
uniform float tmL;
uniform float tmCamHeight;
uniform float tmRadius;
uniform float tmAltitude;
uniform vec3 tmSun;
uniform float tmTime;
uniform vec3 tmCell[${OCTAVES.length}];
uniform vec3 tmFrac[${OCTAVES.length}];
#ifdef TM_PLANET_ALBEDO
uniform sampler2D planetAlbedo;
uniform float albedoReady;
#endif
varying vec3 vTmWorld;
varying vec3 vTmNormal;
const mat3 TM_R0 = ${glslMat3(ROTS[0])};
const mat3 TM_R1 = ${glslMat3(ROTS[1])};
const mat3 TM_R2 = ${glslMat3(ROTS[2])};

float tmHash(ivec3 p) {
  uvec3 u = uvec3(p + ivec3(0x2000000));
  uint h = u.x * 0x8da6b343u ^ u.y * 0xd8163841u ^ u.z * 0xcb1ab31fu;
  h ^= h >> 13u; h *= 0x27d4eb2du; h ^= h >> 15u;
  return float(h & 0xffffffu) * (1.0 / 16777216.0);
}
// Quintic 2D value noise with analytic derivative. x: fractional lattice coords, cell: integer
// lattice offset, salt: decorrelates planes/octaves. Returns (d/dx, d/dy in cells, value in -1..1).
vec3 tmNoised2(vec2 x, vec2 cell, int salt) {
  vec2 p = floor(x); vec2 w = x - p; ivec2 i = ivec2(p) + ivec2(cell);
  vec2 u = w * w * w * (w * (w * 6.0 - 15.0) + 10.0);
  vec2 du = 30.0 * w * w * (w * (w - 2.0) + 1.0);
  float a = tmHash(ivec3(i, salt)), b = tmHash(ivec3(i + ivec2(1, 0), salt)), c = tmHash(ivec3(i + ivec2(0, 1), salt)), d = tmHash(ivec3(i + ivec2(1, 1), salt));
  float k1 = b - a, k2 = c - a, k3 = a - b - c + d;
  float v = a + k1 * u.x + k2 * u.y + k3 * u.x * u.y;
  vec2 dv = du * vec2(k1 + k3 * u.y, k2 + k3 * u.x);
  return vec3(dv * 2.0, v * 2.0 - 1.0);
}
// One octave at camera-relative world position wp, sampled triplanar in the octave's rotated
// lattice frame (3D lattice noise cut by an oblique plane smears along the near-normal axis;
// 2D noise on the three lattice planes blended by the surface normal stays isotropic to 1.4x).
// Returns (gradient per metre in world frame, value).
vec4 tmOctave(vec3 wp, vec3 n, vec3 invSize, mat3 R, vec3 frac, vec3 cell, int salt) {
  vec3 p = (R * wp) * invSize + frac;
  vec3 rn = R * n; vec3 w = rn * rn; w *= w; w *= w;             // |n|^8 per lattice axis
  w /= dot(w, vec3(1.0));
  vec4 acc = vec4(0.0);
  if (w.x > 0.003) { vec3 s = tmNoised2(p.yz, cell.yz, salt); acc += vec4(0.0, s.x, s.y, s.z) * w.x; }
  if (w.y > 0.003) { vec3 s = tmNoised2(p.zx, cell.zx, salt + 37); acc += vec4(s.y, 0.0, s.x, s.z) * w.y; }
  if (w.z > 0.003) { vec3 s = tmNoised2(p.xy, cell.xy, salt + 91); acc += vec4(s.x, s.y, 0.0, s.z) * w.z; }
  return vec4((acc.xyz * invSize) * R, acc.w);
}
// Ridged transform (1 - |v|) with matching gradient, remapped to -1..1.
vec4 tmRidge(vec4 o) { return vec4(-sign(o.w) * o.xyz * 2.0, (1.0 - abs(o.w)) * 2.0 - 1.0); }
`;

const octaveSamples = OCTAVES.map((o, k) => {
  const inv = o.size.map(s => (1 / s).toFixed(8)).join(',');
  return `float tmW${k} = ${o.fine ? '(tmFine ? 1.0 : 0.0) * ' : ''}(1.0 - smoothstep(${o.fade[0].toFixed(1)}, ${o.fade[1].toFixed(1)}, tmDist)); vec4 o${k} = vec4(0.0); if (tmW${k} > 0.0) o${k} = tmOctave(tmWp, tmN, vec3(${inv}), TM_R${o.rot}, tmFrac[${k}], tmCell[${k}], ${k * 131}) * tmW${k};`;
}).join('\n');

// Runs right after <color_fragment>; sets diffuseColor, tmRough, tmNormalW, tmAO.
const fragmentMain = /* glsl */`
vec3 tmWp = vTmWorld;
float tmDist = length(vViewPosition);
bool tmFine = tmAltitude < ${FINE_ALTITUDE.toFixed(1)};
float tmA = dot(tmUp, tmWp), tmB = dot(tmWp, tmWp);
float tmQ = 2.0 * tmL * tmA + tmB;
float tmH = tmCamHeight + tmQ / (sqrt(tmL * tmL + tmQ) + tmL);   // height above the sphere, metres
vec3 tmN = normalize(tmUp * tmL + tmWp);                          // radial unit vector
vec3 tmGN = normalize(vTmNormal) * (gl_FrontFacing ? 1.0 : -1.0);  // geometric normal, world
float tmCos = dot(tmGN, tmN);                                     // 1 flat, 0 vertical
float tmLat = abs(tmN.y);
${octaveSamples}

// ---- shared detail fields (height in metres, gradient per metre) ----
vec4 micro = o0 * 0.014 + o1 * 0.036;
vec4 meso  = o2 * 0.10 + o3 * 0.26;
vec4 macro = o4 * 0.55 + o5 * 1.0 + o6 * 1.6;
float tmPatch = o5.w * 0.6 + o6.w * 0.4;    // ~20-50 m colour patchiness
float region = o7.w;                        // ~150 m moisture patches
float warp = o8.w;                          // ~500 m mask warp
vec4 rc1 = tmRidge(o2 + o1 * 0.5), rc2 = tmRidge(o3 + o2 * 0.5), rc3 = tmRidge(o4 + o3 * 0.5); // lattice-free ridges

// ---- masks ----
float mDirt = smoothstep(0.965, 0.885, tmCos + 0.05 * o4.w + 0.03 * o5.w);
float mRock = smoothstep(0.88, 0.74, tmCos + 0.06 * o4.w + 0.04 * o7.w);
mRock = max(mRock, smoothstep(0.9, 1.5, length(macro.xyz)) * 0.7);
float mSand = 1.0 - smoothstep(2.6, 4.6, tmH + 0.8 * o5.w + 0.4 * o4.w);
mSand *= 1.0 - mRock * 0.85;
float wet = 1.0 - smoothstep(0.6, 1.4, tmH + 0.15 * o4.w);
float snowline = mix(3300.0, -300.0, smoothstep(0.35, 0.92, tmLat)) + 250.0 * warp + 60.0 * o5.w;
float mSnow = smoothstep(snowline - 220.0, snowline + 220.0, tmH);
mSnow *= smoothstep(0.5, 0.82, tmCos + 0.12 * o4.w + 0.06 * o3.w);    // rock pokes through steep faces
float mIce = smoothstep(0.85, 0.92, tmLat + 0.02 * region + 0.01 * o5.w);
mIce = max(mIce, smoothstep(4600.0, 5200.0, tmH + 200.0 * warp) * smoothstep(0.55, 0.85, tmCos));

// ---- grass (base layer, vertex colour tinted) ----
vec3 gTint = mix(vec3(1.0), vec3(1.26, 1.14, 0.72), smoothstep(-0.15, 0.55, tmPatch) * 0.6);
gTint *= 0.86 + 0.28 * smoothstep(-0.6, 0.6, region);
float clump = smoothstep(-0.35, 0.35, o3.w * 0.65 + o2.w * 0.35 + 0.25 * o4.w);   // 1 = dense grass, 0 = soil showing
float blades = o1.w * 0.6 + o0.w * 0.4;
vec3 soil = mix(vColor * 0.8, vec3(0.27, 0.20, 0.13), 0.6) * (0.9 + 0.15 * o2.w);
vec3 grassC = vColor * gTint * (1.0 + 0.22 * blades + 0.10 * o2.w + 0.18 * smoothstep(0.45, 0.9, o0.w) + 0.1 * smoothstep(0.5, 0.9, o1.w));
vec3 alb = mix(soil, grassC, 0.35 + 0.65 * clump);
alb *= 1.0 + 0.08 * o4.w;
float rough = mix(0.93, 0.88, clump);
vec4 H = micro * 1.1 + meso * 1.2 + macro * 0.4;
float crev = clamp(0.5 - 0.5 * (meso.w / 0.36), 0.0, 1.0);
float aoStr = 0.3;

// ---- dirt / earth ----
{
  vec3 c = mix(vColor * 0.9, vec3(0.31, 0.225, 0.14), 0.72) * (0.86 + 0.22 * o2.w + 0.1 * o1.w);
  c *= 1.0 - 0.15 * smoothstep(0.3, 0.8, o3.w);
  c = mix(c, c * vec3(0.8, 0.85, 0.9) * 1.1, smoothstep(0.55, 0.9, rc1.w) * 0.5);     // pale pebbles
  vec4 h = micro * 1.3 + rc1 * 0.05 + o3 * 0.16 + macro * 0.5;
  alb = mix(alb, c, mDirt); rough = mix(rough, 0.86, mDirt); H = mix(H, h, mDirt);
  crev = mix(crev, clamp(0.5 - 0.5 * o2.w, 0.0, 1.0), mDirt); aoStr = mix(aoStr, 0.3, mDirt);
}
// ---- stratified rock ----
{
  float bandPhase = (tmH + 0.7 * o3.w + 0.25 * o4.w) * (6.2831853 / 2.4);
  float band = sin(bandPhase) * tmW3;                                   // fades with the 1.4 m octave
  vec3 bandG = cos(bandPhase) * (6.2831853 / 2.4) * (tmN + 0.7 * o3.xyz + 0.25 * o4.xyz) * tmW3;
  float stratum = 0.5 + 0.5 * band;
  float crack = smoothstep(0.55, 0.95, rc1.w) * 0.6 + smoothstep(0.6, 0.97, rc2.w) * 0.4;
  vec3 c = mix(vec3(0.36, 0.33, 0.30), vec3(0.50, 0.46, 0.40), stratum * stratum);
  c = mix(c, vColor * 1.6, 0.15);
  c *= (0.92 + 0.16 * o2.w) * (1.0 - 0.4 * crack);
  c *= 1.0 - 0.2 * smoothstep(0.2, 0.9, o5.w);                          // darker weathered zones
  c = mix(c, vec3(0.42, 0.44, 0.30), smoothstep(0.4, 0.8, o4.w) * smoothstep(0.7, 0.95, tmCos) * 0.35); // lichen on flat tops
  vec4 h = rc1 * 0.06 + rc2 * 0.22 + rc3 * 0.5 + macro * 0.9 + micro * 0.6;
  h += vec4(bandG, band) * 0.045;
  alb = mix(alb, c, mRock); rough = mix(rough, 0.82, mRock); H = mix(H, h, mRock);
  crev = mix(crev, clamp(crack + 0.3 * (0.5 - 0.5 * rc2.w), 0.0, 1.0), mRock); aoStr = mix(aoStr, 0.45, mRock);
}
// ---- sand ----
{
  // Ripples only on the low beach (0-3 m), in patches set by a 4.5/14 m mask, half amplitude.
  float rippleMask = smoothstep(0.1, 0.55, o4.w * 0.6 + o5.w * 0.4) * (1.0 - smoothstep(2.0, 3.0, tmH)) * smoothstep(0.0, 0.6, tmH);
  vec4 ripple = o9 * rippleMask;
  vec3 dry = vec3(0.70, 0.62, 0.45) * (0.93 + 0.07 * o5.w) * (0.96 + 0.06 * o1.w + 0.04 * o0.w);
  vec3 wetC = vec3(0.34, 0.29, 0.21) * (0.9 + 0.1 * o2.w);
  vec3 c = mix(dry, wetC, wet);
  c = mix(c, vColor * 1.9, 0.12);
  float tufts = smoothstep(1.6, 3.6, tmH) * smoothstep(0.35, 0.75, clump) * 0.85;   // vegetation creeping onto the upper beach
  c = mix(c, grassC * 0.9, tufts);
  float rippleAmp = 0.01 * (1.0 - wet * 0.7);
  vec4 h = ripple * rippleAmp + micro * 0.8 + o2 * 0.03 + macro * 0.25 + H * tufts;
  alb = mix(alb, c, mSand); rough = mix(rough, mix(0.72, 0.35, wet), mSand); H = mix(H, h, mSand);
  crev = mix(crev, clamp(0.5 - 0.5 * o1.w, 0.0, 1.0), mSand); aoStr = mix(aoStr, 0.08, mSand);
}
// ---- snow ----
{
  vec3 c = vec3(0.80, 0.85, 0.94) * (0.95 + 0.05 * o2.w + 0.03 * o1.w + 0.02 * o9.w);
  c = mix(c, vec3(0.72, 0.78, 0.88), smoothstep(0.1, 0.7, -o4.w) * 0.35);  // shaded hollows bluer
  vec4 h = o1 * 0.018 + o9 * 0.03 + o2 * 0.07 + o3 * 0.08 + o4 * 0.1 + macro * 0.2;
  alb = mix(alb, c, mSnow); rough = mix(rough, 0.6, mSnow); H = mix(H, h, mSnow);
  crev = mix(crev, clamp(0.5 - 0.5 * o3.w, 0.0, 1.0), mSnow); aoStr = mix(aoStr, 0.1, mSnow);
}
// ---- polar ice ----
{
  float cracks = smoothstep(0.7, 0.97, rc2.w) * 0.6 + smoothstep(0.8, 0.98, rc1.w) * 0.4;
  vec3 c = vec3(0.62, 0.76, 0.86) * (0.95 + 0.05 * o4.w) * (1.0 - 0.3 * cracks);
  c = mix(c, vec3(0.86, 0.90, 0.95), smoothstep(0.2, 0.8, o5.w) * 0.5);   // snow dusting
  vec4 h = o2 * 0.01 + rc2 * -0.05 + o4 * 0.12 + macro * 0.3;
  alb = mix(alb, c, mIce); rough = mix(rough, mix(0.25, 0.5, smoothstep(0.2, 0.8, o5.w)), mIce); H = mix(H, h, mIce);
  crev = mix(crev, cracks, mIce); aoStr = mix(aoStr, 0.3, mIce);
}

#ifdef TM_PLANET_ALBEDO
{
  vec2 puv = vec2(atan(tmN.x, tmN.z) / 6.28318530718 + 0.5, asin(clamp(tmN.y, -1.0, 1.0)) / 3.14159265359 + 0.5);
  float distant = smoothstep(20000.0, 80000.0, tmDist) * albedoReady;
  alb = mix(alb, texture2D(planetAlbedo, puv).rgb, distant);
}
#endif

float tmAO = 1.0 - aoStr * crev;
diffuseColor.rgb = diffuse * alb * mix(1.0, tmAO, 0.5);
float tmRough = clamp(rough, 0.05, 1.0);
vec3 tmGt = H.xyz - tmGN * dot(H.xyz, tmGN);
vec3 tmNormalW = normalize(tmGN - tmGt);
`;

/**
 * Create the land material. Options:
 *   planetAlbedo, albedoReady — the {value} uniform objects from planet.js for the distant
 *     satellite-albedo blend (optional; omit to skip that feature).
 *   side — THREE.DoubleSide by default, like the original.
 */
export function createLandMaterial(options = {}) {
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 1, metalness: 0,
    side: options.side ?? THREE.DoubleSide,
  });
  return configureLandMaterial(material, options);
}

/**
 * Apply the procedural surface to an existing MeshStandardMaterial (same role as
 * surface-materials.js `configureTerrainMaterial`, so planet.js can swap one call).
 * Returns the material.
 */
export function configureLandMaterial(material, options = {}) {
  material.vertexColors = true;
  material.metalness = 0;
  const uniforms = {
    tmUp: { value: new THREE.Vector3(0, 0, 1) },
    tmL: { value: RADIUS },
    tmCamHeight: { value: 0 },
    tmRadius: { value: RADIUS },
    tmAltitude: { value: 1e6 },
    tmSun: { value: new THREE.Vector3(0, 0, 1) },
    tmTime: { value: 0 },
    tmCell: { value: OCTAVES.map(() => new THREE.Vector3()) },
    tmFrac: { value: OCTAVES.map(() => new THREE.Vector3()) },
  };
  const useAlbedo = Boolean(options.planetAlbedo && options.albedoReady);
  if (useAlbedo) { uniforms.planetAlbedo = options.planetAlbedo; uniforms.albedoReady = options.albedoReady; }
  material.userData.tmUniforms = uniforms;
  material.customProgramCacheKey = () => `terrain-material-v1${useAlbedo ? '+albedo' : ''}`;
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    if (useAlbedo) shader.defines = { ...(shader.defines || {}), TM_PLANET_ALBEDO: 1 };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vTmWorld;\nvarying vec3 vTmNormal;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvTmWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvTmNormal = normalize(mat3(modelMatrix) * objectNormal);');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + fragmentPars)
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + fragmentMain)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = tmRough;')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = normalize(mat3(viewMatrix) * tmNormalW);')
      .replace('#include <aomap_fragment>', '#include <aomap_fragment>\nreflectedLight.indirectDiffuse *= tmAO;');
  };
  return material;
}

/**
 * Per-frame uniform update (allocation free).
 *   renderOrigin   THREE.Vector3 — camera world position in metres (planet centre = 0).
 *   sunDirection   THREE.Vector3 — unit vector towards the sun (optional).
 *   time           seconds (optional).
 *   cameraAltitude metres above terrain (optional; defaults to height above the sphere).
 */
export function updateLandMaterial(material, { renderOrigin, sunDirection, time, cameraAltitude } = {}) {
  const u = material && material.userData.tmUniforms;
  if (!u || !renderOrigin) return;
  const ox = renderOrigin.x, oy = renderOrigin.y, oz = renderOrigin.z;
  const L = Math.hypot(ox, oy, oz) || 1;
  u.tmUp.value.set(ox / L, oy / L, oz / L);
  u.tmL.value = L;
  u.tmCamHeight.value = L - RADIUS;
  u.tmAltitude.value = cameraAltitude ?? (L - RADIUS);
  if (sunDirection) u.tmSun.value.copy(sunDirection);
  if (time !== undefined) u.tmTime.value = time;
  const cells = u.tmCell.value, fracs = u.tmFrac.value;
  for (let k = 0; k < OCTAVES.length; k++) {
    const o = OCTAVES[k], R = ROTS[o.rot];
    const vx = (R[0] * ox + R[1] * oy + R[2] * oz) / o.size[0];
    const vy = (R[3] * ox + R[4] * oy + R[5] * oz) / o.size[1];
    const vz = (R[6] * ox + R[7] * oy + R[8] * oz) / o.size[2];
    const cx = Math.floor(vx), cy = Math.floor(vy), cz = Math.floor(vz);
    cells[k].set(cx, cy, cz);
    fracs[k].set(vx - cx, vy - cy, vz - cz);
  }
}
