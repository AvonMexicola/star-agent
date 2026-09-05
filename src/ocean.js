import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Star Agent — planetary ocean material.
//
// Drop-in replacement for planet.js `waterMaterial` / water.js
// `createWaterMaterial`. Same attributes (`position` = patch-local metres,
// `direction` = unit sphere direction) and the same uniforms (`sunDirection`,
// `time`, `altitude`).
//
// Water depth drives the shoreline colour and the swash foam. It can come from
// either of two per-vertex attributes, selected by uniform:
//   `terrainHeight` (signed metres, what planet.js already puts on the water
//                    geometry)  -> uniform hasTerrainHeight, default 1
//   `depth`         (metres of water, max(0,-terrainHeight); setOceanDepth()
//                    below writes it)  -> uniform hasDepth, default 0
// An unbound attribute reads 0.0, which is a legal depth, so the uniform flag
// and not the value is what decides. With both flags 0 the whole ocean is
// treated as deep and the shader still works.
//
// Why the waves do not swim with the camera
// -----------------------------------------
// `vWorld` is camera-relative metres (planet.js already renders that way), which
// is the only space where float32 can resolve a 0.75 m ripple on a 1,592 km
// planet. A wave phase must nevertheless be anchored to the planet, so the CPU
// dead-reckons the camera's ground track in the local east/north frame using
// JS doubles and hands the shader each octave's phase already reduced mod 2*PI.
// The fragment then only ever adds `k * dot(cameraRelativeOffset, dir)`, which
// stays small and exact. No seams: every term is a continuous function of
// `direction` and `vWorld`, so neighbouring patches (and neighbouring LODs)
// agree exactly.
//
// The detail noise is wrapped on an 8192 m lattice and its hash is periodic on
// the matching cell count, so the dead-reckoned anchor can be wrapped without a
// visible pop, forever.
// ---------------------------------------------------------------------------

const GRAVITY = 9.81;
// Metres. The anchor wrap; every noise cell size below divides it as a power of
// two so the periodic hash makes the wrap invisible.
const ANCHOR_WRAP = 8192;

// wavelength (m), amplitude (m), heading (deg). Slope = 2*PI*amp/lambda, and the
// sum of the slopes is what makes the surface read as choppy rather than glassy.
const WAVES = [
  // Two crossing mega-swells rather than one: a single long sine reads as
  // corduroy inside the sun glint from orbit, two interfere into patches.
  { lambda: 9000, amp: 9.0,   angle:   5 },
  { lambda: 4300, amp: 3.6,   angle:  74 },
  // Same trick one scale down: the wind swell also needs a cross component.
  { lambda: 380,  amp: 1.25,  angle:  12 },
  { lambda: 210,  amp: 0.80,  angle: -55 },
  { lambda: 62,   amp: 0.95,  angle: -22 },
  { lambda: 19,   amp: 0.34,  angle:  35 },
  { lambda: 6.2,  amp: 0.125, angle: -48 },
  { lambda: 2.1,  amp: 0.044, angle:  58 },
  { lambda: 0.75, amp: 0.015, angle:  -8 },
];

// Fade each octave out once its wavelength approaches the pixel footprint. At
// ~1 mrad per pixel the footprint on the surface is distance/grazing * 1e-3, so
// the fragment fades on `distance / grazing` rather than raw distance -- without
// the grazing term the ocean moires badly a few hundred metres out.
const FADE_NEAR = 120;
const FADE_FAR = 380;

const WAVE_DATA = WAVES.map((w, i) => ({
  k: 2 * Math.PI / w.lambda,
  omega: Math.sqrt(GRAVITY * 2 * Math.PI / w.lambda),   // deep-water dispersion
  dx: Math.cos(w.angle * Math.PI / 180),
  dy: Math.sin(w.angle * Math.PI / 180),
  amp: w.amp,
  // Crest sharpening as an s -> s*s blend (no pow in the inner loop).
  sharp: Math.min(0.95, 0.15 + i * 0.13),
  // Whitecaps and sub-surface glow live on wind chop, not on the two swells;
  // letting the 9 km swell into the crest term paints the whole horizon.
  crestWeight: w.lambda > 100 ? 0 : 1,
  fadeNear: w.lambda * FADE_NEAR,
  fadeFar: w.lambda * FADE_FAR,
}));

const glsl = v => {
  const s = Number(v).toPrecision(9);
  return /[.e]/.test(s) ? s : `${s}.0`;
};

const waveCalls = WAVE_DATA.map((w, i) => `  addWave(height, grad, lost, crestH, crestN, p, vec2(${glsl(w.dx)},${glsl(w.dy)}), ` +
  `${glsl(w.k)}, ${glsl(w.amp)}, wavePhase[${i}], ${glsl(w.omega)}, ${glsl(w.sharp)}, ${glsl(w.crestWeight)}, ` +
  `fadeAt(fadeDist, ${glsl(w.fadeNear)}, ${glsl(w.fadeFar)}));`).join('\n');

// Shared analytic sky. Exported so a test harness can paint a matching
// background; the real app gets its sky from atmosphere.js instead.
export const OCEAN_SKY_GLSL = `
vec3 oceanSky(vec3 dir, vec3 up, vec3 sunDir, float day){
  float t = clamp(dot(dir, up), 0.0, 1.0);
  vec3 zenith = vec3(0.038, 0.094, 0.235);
  vec3 horizon = vec3(0.400, 0.490, 0.610);
  vec3 c = mix(horizon, zenith, pow(t, 0.55));
  float sd = max(dot(dir, sunDir), 0.0);
  c += vec3(0.50, 0.34, 0.16) * pow(sd, 5.0) * 0.60;
  c += vec3(0.40, 0.26, 0.12) * pow(sd, 48.0) * 1.20;
  return c * day + vec3(0.0020, 0.0035, 0.0090);
}
`;

const vertexShader = `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  attribute vec3 direction;
  attribute float depth;
  attribute float terrainHeight;
  uniform float hasDepth;
  uniform float hasTerrainHeight;
  varying vec3 vDirection;
  varying vec3 vWorld;
  varying float vDepth;
  void main(){
    vDirection = direction;
    // Unbound attributes read 0.0, so the flags decide, not the values.
    float d = mix(4000.0, max(-terrainHeight, 0.0), hasTerrainHeight);
    vDepth = mix(d, max(depth, 0.0), hasDepth);
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
    #include <logdepthbuf_vertex>
  }
`;

const fragmentShader = `
  #include <common>
  #include <logdepthbuf_pars_fragment>
  uniform vec3 sunDirection;
  uniform float time;
  uniform float altitude;
  uniform float cameraAltitude;
  uniform vec3 renderOrigin;
  uniform float wavePhase[${WAVE_DATA.length}];
  uniform vec2 noiseAnchor;
  uniform float sunIntensity;
  uniform float choppiness;
  varying vec3 vDirection;
  varying vec3 vWorld;
  varying float vDepth;

${OCEAN_SKY_GLSL}

  float hash21(vec2 p){
    vec3 p3 = fract(vec3(p.x, p.y, p.x) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }
  // Value noise on a lattice that repeats every 'period' cells, so wrapping the
  // planet-anchored coordinate is invisible.
  float vnoise(vec2 x, float period){
    vec2 i = floor(x), f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    vec2 a = mod(i, period);
    vec2 b = mod(i + 1.0, period);
    float n00 = hash21(vec2(a.x, a.y));
    float n10 = hash21(vec2(b.x, a.y));
    float n01 = hash21(vec2(a.x, b.y));
    float n11 = hash21(vec2(b.x, b.y));
    return mix(mix(n00, n10, f.x), mix(n01, n11, f.x), f.y);
  }

  float fadeAt(float dist, float a, float b){ return 1.0 - smoothstep(a, b, dist); }

  void addWave(inout float height, inout vec2 grad, inout float lost,
               inout float crestH, inout float crestN, vec2 p, vec2 dir,
               float k, float amp, float phase0, float omega, float sharp,
               float crestWeight, float fade){
    float slope = amp * k;
    float gone = 1.0 - fade;
    // Slope variance we stopped resolving becomes microfacet roughness instead
    // of aliasing: this is what turns the ocean into a broad sun glint from orbit.
    lost += 0.5 * slope * slope * gone * gone;
    if(fade <= 0.002) return;
    float w = phase0 + k * dot(p, dir) - omega * time;
    float s = 0.5 + 0.5 * sin(w);
    // Choppy crests without pow(): mix(s, s*s, sharp) peaks the crests and
    // flattens the troughs, and its derivative is one madd.
    float profile = mix(s, s * s, sharp) - (0.5 - 0.25 * sharp);
    float slopeOfProfile = (1.0 - sharp) + 2.0 * s * sharp;
    height += amp * fade * profile;
    crestH += crestWeight * amp * fade * profile;
    crestN += crestWeight * amp * fade;
    grad += dir * (amp * fade * k * slopeOfProfile * 0.5 * cos(w));
  }

  void main(){
    #include <logdepthbuf_fragment>
    vec3 n = normalize(vDirection);
    vec3 toCamera = cameraPosition - vWorld;
    float dist = max(length(toCamera), 1e-3);
    vec3 V = toCamera / dist;
    // Texel footprint grows as 1/sin(grazing angle); fade detail on that, not on
    // raw distance, or the surface aliases into moire rings towards the horizon.
    float grazing = max(abs(dot(n, V)), 0.02);
    float fadeDist = dist / grazing;

    // Sphere tangent frame. Degenerate only at the geographic poles, which are
    // ice anyway.
    vec3 east = cross(vec3(0.0, 1.0, 0.0), n);
    float eastLen = length(east);
    east = eastLen > 1e-4 ? east / eastLen : vec3(1.0, 0.0, 0.0);
    vec3 north = cross(n, east);

    // Local metres in the tangent plane; the planet-anchored part of the phase
    // arrives pre-reduced in wavePhase[] / noiseAnchor.
    vec2 p = vec2(dot(vWorld, east), dot(vWorld, north));
    vec2 pn = p + noiseAnchor;

    float depthMetres = vDepth;
    float shoal = mix(0.30, 1.0, smoothstep(0.0, 7.0, depthMetres));

    float height = 0.0;
    vec2 grad = vec2(0.0);
    float lost = 0.0;
    float crestH = 0.0, crestN = 0.0;
${waveCalls}

    // One procedural noise octave on top of the sines: breaks the periodicity
    // that pure sums of sines always betray.
    float nFade = fadeAt(fadeDist, 700.0, 2400.0);
    if(nFade > 0.002){
      vec2 q = pn * 0.5 + vec2(time * -0.06, time * 0.041);
      float e = 0.35;
      float c0 = vnoise(q, 4096.0);
      float cx = vnoise(q + vec2(e, 0.0), 4096.0);
      float cy = vnoise(q + vec2(0.0, e), 4096.0);
      grad += vec2(cx - c0, cy - c0) * (0.25 / e) * nFade;
      height += (c0 - 0.5) * 0.10 * nFade;
    }
    lost += 0.5 * 0.09 * 0.09 * (1.0 - nFade) * (1.0 - nFade);

    grad *= choppiness * shoal;
    height *= shoal;

    vec3 N = normalize(n - east * grad.x - north * grad.y);
    bool underwater = dot(n, V) < 0.0;
    if(underwater) N = -N;

    float sunUp = dot(n, sunDirection);
    float day = smoothstep(-0.14, 0.24, sunUp);
    vec3 sunColor = vec3(1.0, 0.945, 0.855);

    float NoV = clamp(dot(N, V), 0.0, 1.0);
    float NoL = max(dot(N, sunDirection), 0.0);
    float F = 0.02 + 0.98 * pow(1.0 - NoV, 5.0);

    // Depth-tinted body colour: deep teal -> turquoise -> sand showing through.
    vec3 deep = vec3(0.0055, 0.0400, 0.0720);
    vec3 shallowTint = vec3(0.0450, 0.2900, 0.2950);
    vec3 sandTint = vec3(0.2600, 0.3100, 0.2450);
    float shallow = exp(-depthMetres / 8.0);
    float sandy = exp(-depthMetres / 2.2);
    vec3 body = mix(deep, shallowTint, shallow);
    body = mix(body, sandTint, sandy * 0.72);
    vec3 diffuse = body * (vec3(0.130, 0.190, 0.270) + sunColor * NoL * 0.66) * day;

    // Sky reflection.
    vec3 R = reflect(-V, N);
    vec3 reflection = oceanSky(R, n, sunDirection, day);

    // GGX sun specular. Roughness grows with the wave detail we faded out.
    float rough = clamp(sqrt(0.10 * 0.10 + 3.4 * lost), 0.05, 0.62);
    vec3 H = normalize(sunDirection + V);
    float NoH = max(dot(N, H), 0.0);
    float VoH = max(dot(V, H), 0.0);
    float a = rough * rough;
    float a2 = a * a;
    float denom = NoH * NoH * (a2 - 1.0) + 1.0;
    float D = a2 / max(PI * denom * denom, 1e-8);
    float kg = a * 0.5;
    float Gv = NoV / (NoV * (1.0 - kg) + kg);
    float Gl = NoL / (NoL * (1.0 - kg) + kg);
    float Fs = 0.02 + 0.98 * pow(1.0 - VoH, 5.0);
    vec3 spec = sunColor * sunIntensity * (D * Gv * Gl * Fs / (4.0 * max(NoV, 1e-3) * max(NoL, 1e-3))) * NoL * day;

    // Sub-surface glow on wave flanks pushed up towards the sun. Measured on the
    // wind chop only (crestN excludes the swells), so it never washes the horizon.
    float crest = clamp(crestH / max(crestN * 0.5, 1e-3), -1.0, 1.0);
    float forward = pow(clamp(dot(V, -sunDirection) * 0.5 + 0.5, 0.0, 1.0), 4.0);
    vec3 sss = vec3(0.055, 0.400, 0.330) * max(crest, 0.0) * forward * 0.80 * day
             * (0.35 + 0.65 * clamp(1.0 - shallow, 0.0, 1.0))
             * fadeAt(fadeDist, 1500.0, 6000.0);

    vec3 color = diffuse * (1.0 - F) + reflection * F + spec + sss;

    // ---- Foam -------------------------------------------------------------
    float capFade = fadeAt(fadeDist, 1200.0, 5000.0);
    float foamShore = 0.0;
    float foam = 0.0;
    // From orbit both terms are dead, so skip every noise fetch below.
    if(depthMetres < 4.0 || capFade > 0.002){
      // Grain washes out into its own mean with distance, so distant foam reads
      // as a smooth band instead of a field of aliased speckles.
      float grainFade = fadeAt(fadeDist, 500.0, 2600.0);
      float foamGrain = mix(0.5, vnoise(pn * 2.0 + vec2(time * 0.09, time * -0.07), 16384.0), grainFade);
      float coarse = vnoise(pn * 0.25 + vec2(time * 0.02, time * -0.015), 2048.0);
      // Swash lines: depth doubles as a distance-to-shore field, so banding on it
      // puts the foam parallel to the waterline for free.
      float band = 0.5 + 0.5 * sin(depthMetres * 2.4 - time * 0.9 + coarse * 7.0);
      float shoreMask = smoothstep(1.7, 0.05, depthMetres);
      foamShore = shoreMask * band * band * smoothstep(0.30, 0.78, mix(foamGrain, coarse, 0.45));
      foamShore = max(foamShore, smoothstep(0.35, 0.0, depthMetres) * (0.55 + 0.45 * coarse));
      float whitecap = smoothstep(0.70, 1.0, crest) * smoothstep(0.34, 0.90, length(grad))
                     * smoothstep(0.40, 0.85, foamGrain) * capFade * 0.85;
      foam = clamp(max(foamShore, whitecap), 0.0, 1.0);
      vec3 foamColor = vec3(0.90, 0.94, 0.97) * (0.10 + 0.95 * max(dot(n, sunDirection), 0.0)) * day;
      color = mix(color, foamColor, foam);
    }

    if(underwater){
      float glow = pow(max(dot(V, sunDirection), 0.0), 8.0);
      color = vec3(0.010, 0.055, 0.075) * (0.45 + 0.85 * day)
            + vec3(0.30, 0.50, 0.46) * glow * 0.40 * day;
      color = mix(color, vec3(0.55, 0.70, 0.75) * day, foamShore * 0.35);
    }

    // ---- Polar ice (Astra's behaviour, plus a crackle normal) --------------
    float ice = smoothstep(0.83, 0.90, abs(n.y));
    if(ice > 0.0){
      vec2 iq = pn * 0.03125;
      float i0 = vnoise(iq, 256.0);
      float ix = vnoise(iq + vec2(0.25, 0.0), 256.0);
      float iy = vnoise(iq + vec2(0.0, 0.25), 256.0);
      vec3 iceN = normalize(n - east * (ix - i0) * 1.6 - north * (iy - i0) * 1.6);
      vec3 iceColor = vec3(0.75, 0.84, 0.87) * (0.22 + max(dot(iceN, sunDirection), 0.0) * 1.20)
                    * (0.88 + 0.24 * i0);
      color = mix(color, iceColor, ice);
    }

    gl_FragColor = vec4(color, 1.0);
  }
`;

/**
 * @returns {THREE.ShaderMaterial} drop-in replacement for planet.js waterMaterial.
 */
export function createOceanMaterial() {
  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      sunDirection: { value: new THREE.Vector3(1, 0, 0) },
      time: { value: 0 },
      altitude: { value: 1e6 },
      cameraAltitude: { value: 1e6 },
      renderOrigin: { value: new THREE.Vector3() },
      wavePhase: { value: new Float32Array(WAVE_DATA.length) },
      noiseAnchor: { value: new THREE.Vector2() },
      // Which depth attribute the water geometry carries. Defaults match
      // planet.js as it stands (terrainHeight). Both 0 => everywhere deep.
      hasTerrainHeight: { value: 1 },
      hasDepth: { value: 0 },
      sunIntensity: { value: 5.5 },
      choppiness: { value: 0.85 },
    },
    side: THREE.DoubleSide,
    transparent: false,
    depthWrite: true,
  });
  material.userData.ocean = { u: 0, v: 0, px: 0, py: 0, pz: 0, seeded: false };
  return material;
}

/**
 * Per-frame update. Allocation free.
 * @param {THREE.ShaderMaterial} material from createOceanMaterial()
 * @param {{renderOrigin?:THREE.Vector3, sunDirection?:THREE.Vector3, time?:number, altitude?:number}} state
 */
export function updateOceanMaterial(material, state) {
  const u = material.uniforms;
  if (state.sunDirection) u.sunDirection.value.copy(state.sunDirection);
  if (state.time !== undefined) u.time.value = state.time;
  if (state.altitude !== undefined) {
    u.altitude.value = state.altitude;
    u.cameraAltitude.value = state.altitude;
  }
  const origin = state.renderOrigin;
  if (!origin) return;
  u.renderOrigin.value.copy(origin);

  const s = material.userData.ocean;
  const ox = origin.x, oy = origin.y, oz = origin.z;
  const len = Math.sqrt(ox * ox + oy * oy + oz * oz) || 1;
  const nx = ox / len, ny = oy / len, nz = oz / len;
  // east = normalize(cross(+Y, n)); north = cross(n, east)
  let ex = nz, ez = -nx;
  const el = Math.hypot(ex, ez);
  if (el < 1e-9) { ex = 1; ez = 0; } else { ex /= el; ez /= el; }
  const tx = ny * ez, ty = nz * ex - nx * ez, tz = -ny * ex;

  if (s.seeded) {
    // Dead-reckon the ground track in doubles; only the difference is ever
    // projected, so this stays exact no matter how far the planet is from 0.
    const dx = ox - s.px, dy = oy - s.py, dz = oz - s.pz;
    s.u += dx * ex + dz * ez;
    s.v += dx * tx + dy * ty + dz * tz;
  }
  s.seeded = true;
  s.px = ox; s.py = oy; s.pz = oz;

  const phase = u.wavePhase.value;
  const TAU = Math.PI * 2;
  for (let i = 0; i < WAVE_DATA.length; i++) {
    const w = WAVE_DATA[i];
    const raw = w.k * (s.u * w.dx + s.v * w.dy);
    phase[i] = raw - TAU * Math.floor(raw / TAU);
  }
  u.noiseAnchor.value.set(
    s.u - ANCHOR_WRAP * Math.floor(s.u / ANCHOR_WRAP),
    s.v - ANCHOR_WRAP * Math.floor(s.v / ANCHOR_WRAP),
  );
}

/**
 * Optional: writes an explicit `depth` attribute (metres of water) from the patch
 * heights, for callers that would rather not ship signed terrain heights. Set
 * `material.uniforms.hasDepth.value = 1` when you use it. Reuses an existing
 * attribute array when the geometry already has one.
 * @param {THREE.BufferGeometry} geometry water geometry
 * @param {Float32Array} heights per-vertex terrain height in metres
 */
export function setOceanDepth(geometry, heights) {
  const existing = geometry.getAttribute('depth');
  const array = existing && existing.array.length === heights.length
    ? existing.array
    : new Float32Array(heights.length);
  for (let i = 0; i < heights.length; i++) array[i] = heights[i] < 0 ? -heights[i] : 0;
  if (existing && existing.array === array) existing.needsUpdate = true;
  else geometry.setAttribute('depth', new THREE.BufferAttribute(array, 1));
  return geometry;
}
