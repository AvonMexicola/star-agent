import * as THREE from 'three';
import { CSM } from 'three/addons/csm/CSM.js';

/**
 * Real-time sun shadows (cascaded shadow maps) + lighting polish for Star Agent.
 *
 * NOTE ON THE FILE NAME: this was commissioned as `src/lighting.js`, but Astra
 * created a (simpler, single-cascade) `src/lighting.js` first, so this ships
 * beside it as a strict add-on. It does NOT replace `createLighting()` — it
 * layers cascades on top of the sun that `createLighting()` already made.
 *
 * Camera-relative rendering is ideal for CSM: the camera sits at the scene
 * origin every frame, so cascade boxes and shadow cameras never leave float32
 * comfort — no big-coordinate jitter at all.
 *
 * Ownership of the sun
 * --------------------
 * three's CSM creates its own DirectionalLights (one per cascade) and its
 * shader patch assumes those are the only shadow-casting directional lights in
 * the scene. So this module takes over the sun it is handed: it is hidden
 * (`sun.visible = false`) while cascades are active, and handed straight back,
 * untouched, when they are gated off at altitude. Three's renderer skips
 * invisible lights entirely, so `createLighting().update()` may keep writing
 * `sun.position` and `sun.castShadow` every frame — those become no-ops while
 * the cascades are on, and are correct again the moment they are off. Nothing
 * in `lighting.js` has to change.
 *
 * Wiring (main.js), two added lines:
 *   import { Lighting as CascadeShadows } from './lighting-csm.js';
 *   const lighting = createLighting(renderer, scene);                      // unchanged
 *   const shadows = new CascadeShadows(renderer, scene, camera, lighting.sun);
 *   // ... in frame(), after `lighting.update(...)` and BEFORE atmosphere.render(...):
 *   shadows.update({ sunDirection, cameraAltitude: altitude,
 *                    cameraWorldPosition: nav.position, renderOrigin: origin });
 *
 * Colour and intensity are inherited from the sun that is passed in, so the
 * look stays exactly as `createLighting()` tuned it. Pass
 * `{ hemisphereLight: lighting.ambient }` to additionally opt into the
 * sky/ground grading here (it then overrides createLighting's ambient curve).
 */

const DEFAULTS = {
  // --- cascades -----------------------------------------------------------
  cascades: 4,
  shadowMapSize: 2048,
  /** cascade reach in metres while standing on the ground */
  maxFar: 1500,
  /** Hard ceiling for the altitude-scaled cascade reach. Above a few km there
   *  is nothing left whose shadow is more than a pixel, so paying for a longer
   *  reach only costs draw calls. */
  maxFarCeiling: 6000,
  /** cascade reach grows by this many metres per metre of altitude */
  farPerAltitude: 1.5,
  /** virtual near plane used to compute the splits. camera.near is 0.08 m,
   *  which would otherwise waste a whole cascade on the first few centimetres */
  shadowNear: 3,
  /** 0 = uniform splits, 1 = logarithmic splits */
  splitLambda: 0.96,
  fade: true,
  shadowType: THREE.PCFSoftShadowMap,

  // --- bias ---------------------------------------------------------------
  /** normalBias, expressed in shadow-map texels of the cascade it belongs to */
  normalBiasTexels: 1.6,
  /** constant depth bias, in world-space texel widths */
  biasTexels: 0.5,
  lightMargin: 250,
  /** A shadow texel covers texel/sin(elevation) of surface along the light, so
   *  the offset needed to escape self-shadowing grows as the sun drops. Without
   *  this, a sunrise/sunset sun stripes every slope with acne. */
  grazingFloor: 0.18,      // sin(~10 deg): below this the boost stops growing
  grazingBiasMax: 5,       // and never exceeds this multiple of the base bias

  // --- sun ----------------------------------------------------------------
  intensity: 2.5,
  color: 0xfff0dc,
  /** warm/dim the sunlight near the horizon. The atmosphere pass only reddens
   *  the *camera* path, never the sun's path down onto the terrain. */
  tintSun: true,

  // --- altitude gating ----------------------------------------------------
  /** shadow strength starts fading out here */
  fadeAltitude: 7000,
  /** shadows re-enable below this altitude (hysteresis pair) */
  enableAltitude: 11000,
  /** shadows switch off completely above this altitude */
  disableAltitude: 13000,

  // --- scene plumbing -----------------------------------------------------
  /** automatically give shadow flags + CSM support to anything added to the scene */
  autoAdopt: true,
  /** InstancedMeshes with more instances than this receive but do not cast.
   *  12 000 grass tufts through four cascades is not worth the vertex bandwidth. */
  instancedCastLimit: 6000,

  // --- ambient polish -----------------------------------------------------
  /** pass main.js's HemisphereLight here to get sky/ground colour grading */
  hemisphereLight: null,
  ambient: true,
};

const LIT_MATERIAL_KEYS = [
  'isMeshStandardMaterial', 'isMeshPhysicalMaterial',
  'isMeshLambertMaterial', 'isMeshPhongMaterial', 'isMeshToonMaterial',
];

function isLitMaterial(material) {
  return Boolean(material) && LIT_MATERIAL_KEYS.some((key) => material[key]);
}

function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
function smoothstep(a, b, x) { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); }

const _skyDay = new THREE.Color(0x9fc4ff);
const _skyDusk = new THREE.Color(0xff9a5c);
const _skyNight = new THREE.Color(0x0b1526);
const _groundDay = new THREE.Color(0x2f3a22);
const _groundDusk = new THREE.Color(0x3a2418);
const _groundNight = new THREE.Color(0x070a10);
const _sunHigh = new THREE.Color(0xfff0dc);
const _sunLow = new THREE.Color(0xff9d52);

/**
 * Pure helper: hemisphere-light grading from the sun elevation.
 *
 * @param {number} sunElevation dot(surfaceNormal, sunDirection), in [-1, 1].
 *   1 = sun overhead, 0 = sun on the horizon, < 0 = night.
 * @returns {{sky: THREE.Color, ground: THREE.Color, intensity: number}} fresh objects.
 */
export function skyGroundColors(sunElevation) {
  const e = Math.max(-1, Math.min(1, sunElevation));
  const day = smoothstep(0.04, 0.34, e);      // 0 at the horizon, 1 well past sunrise
  const night = smoothstep(0.02, -0.12, e);   // 1 once the sun is properly down
  const sky = _skyDusk.clone().lerp(_skyDay, day).lerp(_skyNight, night);
  const ground = _groundDusk.clone().lerp(_groundDay, day).lerp(_groundNight, night);
  const intensity = 0.14 + 0.62 * Math.max(0, e) ** 0.65;
  return { sky, ground, intensity: intensity * (1 - night * 0.72) };
}

/**
 * Pure helper: direct-sun colour and intensity multiplier from the sun elevation.
 *
 * @param {number} sunElevation dot(surfaceNormal, sunDirection), in [-1, 1].
 * @param {THREE.Color} [baseColor] the sun's colour with the sun high up.
 * @returns {{color: THREE.Color, intensity: number}} intensity is a 0..1 multiplier.
 */
export function sunColorIntensity(sunElevation, baseColor = _sunHigh) {
  const e = Math.max(-1, Math.min(1, sunElevation));
  const high = smoothstep(0.02, 0.42, e);
  const color = _sunLow.clone().lerp(baseColor, high);
  // Fades to nothing just below the horizon so the terminator is not a hard edge.
  return { color, intensity: smoothstep(-0.06, 0.10, e) };
}

export class Lighting {
  /**
   * @param {THREE.WebGLRenderer} renderer
   * @param {THREE.Scene} scene
   * @param {THREE.PerspectiveCamera} camera
   * @param {THREE.DirectionalLight|null} sunLight main.js's sun. Taken over while
   *   shadows are active, restored when they are gated off. May be null.
   * @param {object} [options] see DEFAULTS above.
   */
  constructor(renderer, scene, camera, sunLight = null, options = {}) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.sunLight = sunLight;
    // Inherit the look of whatever sun we were handed, so swapping cascades in
    // and out is invisible. Explicit options still win.
    this.options = {
      ...DEFAULTS,
      ...(sunLight ? { intensity: sunLight.intensity, color: sunLight.color.getHex() } : null),
      ...options,
    };

    this.enabled = true;          // user/quality switch
    this.active = false;          // shadows actually rendering right now
    this.altitudeAllows = true;   // altitude gate
    this.error = null;

    this._sunDirection = new THREE.Vector3(0, 1, 0);
    this._lightDirection = new THREE.Vector3(0, -1, 0);
    this._registered = new Map();   // material -> original onBeforeCompile
    this._seen = new WeakSet();     // scene subtrees already given shadow flags
    this._sceneChildCount = -1;
    this._appliedFar = 0;
    this._shadowStrength = 1;
    this._sunElevation = 1;
    this._biasBoost = 1;
    this._baseColor = new THREE.Color(this.options.color);
    this._sunColor = this._baseColor.clone();
    this._up = new THREE.Vector3();

    this._previousShadowType = renderer.shadowMap.type;
    this._previousShadowEnabled = renderer.shadowMap.enabled;
    renderer.shadowMap.type = this.options.shadowType;
    renderer.shadowMap.enabled = false;

    try {
      this.csm = new CSM({
        camera,
        parent: scene,
        cascades: this.options.cascades,
        maxFar: this.options.maxFar,
        mode: 'custom',
        customSplitsCallback: (cascades, near, far, target) => this._splits(cascades, near, far, target),
        shadowMapSize: this.options.shadowMapSize,
        lightIntensity: this.options.intensity,
        lightDirection: this._lightDirection,
        lightMargin: this.options.lightMargin,
        lightNear: 1,
        lightFar: this.options.maxFar * 4 + this.options.lightMargin,
      });
      // `fade` is not read from the constructor data in three 0.180.
      this.csm.fade = this.options.fade;
      for (const light of this.csm.lights) {
        light.color.set(this.options.color);
        light.visible = false;
        light.castShadow = false;
        light.shadow.blurSamples = 8;
      }
      this._retuneFrustums(this.options.maxFar);
    } catch (error) {
      // A missing/renamed CSM addon must never take the whole flight down.
      console.error('Lighting: CSM unavailable, falling back to the unshadowed sun.', error);
      this.error = String((error && error.message) || error);
      this.csm = null;
      this.enabled = false;
    }

    if (this.options.autoAdopt) this._adopt();
  }

  // ---------------------------------------------------------------- splits

  /**
   * Logarithmic/uniform blend computed from `options.shadowNear` rather than
   * `camera.near`. Breaks are expressed exactly the way CSMShader compares
   * them: `viewZ / (maxFar - camera.near)`.
   */
  _splits(cascades, near, far, target) {
    const start = Math.max(near, this.options.shadowNear);
    const lambda = this.options.splitLambda;
    const denominator = Math.max(1e-6, far - near);
    for (let i = 1; i < cascades; i++) {
      const logSplit = start * (far / start) ** (i / cascades);
      const uniformSplit = start + (far - start) * i / cascades;
      target.push(THREE.MathUtils.lerp(uniformSplit, logSplit, lambda) / denominator);
    }
    target.push(1);
  }

  /** Re-derive cascade bounds, shadow-camera depth range and per-cascade bias. */
  _retuneFrustums(maxFar) {
    const csm = this.csm;
    if (!csm) return;
    csm.maxFar = maxFar;
    csm.lightMargin = this.options.lightMargin;
    csm.lightFar = maxFar * 4 + this.options.lightMargin;
    for (const light of csm.lights) {
      light.shadow.camera.near = csm.lightNear;
      light.shadow.camera.far = csm.lightFar;
    }
    csm.updateFrustums();
    // updateFrustums() rewrote left/right/top/bottom, so texel size is known now.
    const depthRange = csm.lightFar - csm.lightNear;
    for (const light of csm.lights) {
      const shadowCamera = light.shadow.camera;
      const texel = (shadowCamera.right - shadowCamera.left) / this.options.shadowMapSize;
      // Stored as the sun-overhead baseline; update() scales it for low sun.
      light.userData.baseNormalBias = texel * this.options.normalBiasTexels;
      // three adds `bias` to the (linear, orthographic) shadow depth in [0,1].
      light.userData.baseBias = -(texel * this.options.biasTexels) / depthRange;
      shadowCamera.updateProjectionMatrix();
    }
    this._appliedFar = maxFar;
    this._applyBias();
  }

  /**
   * Scale every cascade's bias by how low the sun is. A shadow texel of width
   * `t` covers `t / sin(elevation)` of a horizontal surface measured along the
   * light, so the depth error that causes acne grows the same way.
   */
  _applyBias() {
    if (!this.csm) return;
    const { grazingFloor, grazingBiasMax } = this.options;
    const boost = THREE.MathUtils.clamp(
      1 / Math.max(this._sunElevation, grazingFloor), 1, grazingBiasMax,
    );
    this._biasBoost = boost;
    for (const light of this.csm.lights) {
      light.shadow.normalBias = (light.userData.baseNormalBias ?? 0) * boost;
      light.shadow.bias = (light.userData.baseBias ?? 0) * boost;
    }
  }

  // ------------------------------------------------------------- materials

  /**
   * Give a lit material CSM support. Safe to call repeatedly.
   *
   * Unlike `csm.setupMaterial()` this *chains* onto any existing
   * `onBeforeCompile`: planet.js's landMaterial injects its albedo/grain there
   * and plain CSM would silently overwrite it.
   *
   * @param {THREE.Material} material
   */
  registerMaterial(material) {
    if (!this.csm || !material || this._registered.has(material)) return;
    if (!isLitMaterial(material)) return;
    const original = material.onBeforeCompile;
    this.csm.setupMaterial(material);
    const csmHook = material.onBeforeCompile;
    material.onBeforeCompile = function (shader, renderer) {
      csmHook.call(this, shader, renderer);
      if (original) original.call(this, shader, renderer);
    };
    this._registered.set(material, original);
    material.needsUpdate = true;
  }

  /**
   * Traverse `root`, set sensible castShadow/receiveShadow flags and register
   * every lit material on the way. Raw ShaderMaterial meshes (water, clouds)
   * are excluded: they have no shadow code and must not occlude either.
   *
   * Opt out per object with `object.userData.noShadow = true`.
   *
   * @param {THREE.Object3D} root
   * @param {{cast?: boolean, receive?: boolean}} [override]
   */
  applyShadowFlags(root, override = {}) {
    if (!root) return;
    root.traverse((object) => {
      if (!object.isMesh && !object.isInstancedMesh && !object.isSkinnedMesh) return;
      if (object.userData && object.userData.noShadow) {
        object.castShadow = false;
        object.receiveShadow = false;
        return;
      }
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      if (!materials.some(isLitMaterial)) {
        object.castShadow = false;
        object.receiveShadow = false;
        return;
      }
      for (const material of materials) this.registerMaterial(material);
      // Transparent panes (cockpit glass, HUD displays) must not punch opaque
      // holes into the shadow map.
      const solid = materials.some((m) => isLitMaterial(m) && !m.transparent);
      const crowded = object.isInstancedMesh
        && (object.instanceMatrix?.count ?? object.count ?? 0) > this.options.instancedCastLimit;
      object.receiveShadow = override.receive ?? true;
      // Never *disable* a caster the module's own author enabled — vegetation.js
      // and planet.js already make deliberate per-mesh choices. Only fill in the
      // default for objects nobody has configured.
      object.castShadow = override.cast ?? (object.castShadow || (solid && !crowded));
    });
  }

  /** Pick up whatever was newly added to the scene: streamed terrain, ship, station. */
  _adopt() {
    if (this.scene.children.length === this._sceneChildCount) return;
    this._sceneChildCount = this.scene.children.length;
    for (const child of this.scene.children) {
      if (child.isLight || child.isCamera || this._seen.has(child)) continue;
      this._seen.add(child);
      this.applyShadowFlags(child);
    }
  }

  // --------------------------------------------------------------- control

  /** Master on/off (a quality setting). The altitude gate is independent. */
  setEnabled(value) {
    this.enabled = Boolean(value) && Boolean(this.csm);
    this._setActive(this.enabled && this.altitudeAllows);
  }

  _setActive(value) {
    if (value === this.active) return;
    this.active = value;
    if (!value) this._shadowStrength = 0;
    const csm = this.csm;
    if (csm) {
      for (let i = 0; i < csm.lights.length; i++) {
        const light = csm.lights[i];
        light.castShadow = value;
        // With no sun handed to us, keep one CSM light on as the plain sun.
        light.visible = value || (!this.sunLight && i === 0);
      }
    }
    if (this.sunLight) this.sunLight.visible = !value;
    this.renderer.shadowMap.enabled = value;
    // shadowMap.enabled is a shader define and three does not invalidate for us.
    for (const material of this._registered.keys()) material.needsUpdate = true;
  }

  /**
   * Call once per frame, after the camera transform is set and BEFORE
   * `atmosphere.render(...)` — shadow maps are drawn inside `renderer.render`,
   * so rendering the scene into the atmosphere's HalfFloat target is fine.
   *
   * @param {object} state
   * @param {THREE.Vector3} state.sunDirection unit vector, planet -> sun.
   * @param {number} state.cameraAltitude metres above the terrain.
   * @param {THREE.Vector3} [state.cameraWorldPosition] used for the sun elevation.
   * @param {THREE.Vector3} [state.renderOrigin] accepted for symmetry with the
   *   other modules; unused, because everything here is already camera-relative.
   */
  update({ sunDirection, cameraAltitude = 0, cameraWorldPosition = null, renderOrigin = null } = {}) {
    if (sunDirection) this._sunDirection.copy(sunDirection).normalize();
    const hasUp = Boolean(cameraWorldPosition) && cameraWorldPosition.lengthSq() > 1;
    if (hasUp) this._up.copy(cameraWorldPosition).normalize();
    const sunElevation = hasUp ? this._up.dot(this._sunDirection) : 1;
    this._sunElevation = Math.max(0, sunElevation);

    const options = this.options;
    if (options.hemisphereLight && options.ambient) {
      const { sky, ground, intensity } = skyGroundColors(sunElevation);
      const hemisphere = options.hemisphereLight;
      hemisphere.color.copy(sky);
      hemisphere.groundColor.copy(ground);
      // Thins out with altitude, like main.js's original curve.
      hemisphere.intensity = intensity * (0.34 + 0.66 * Math.exp(-cameraAltitude / 90000));
      if (hasUp) hemisphere.position.copy(this._up);
    }

    this.altitudeAllows = this.active
      ? cameraAltitude < options.disableAltitude
      : cameraAltitude < options.enableAltitude;
    this._setActive(this.enabled && this.altitudeAllows && Boolean(this.csm));

    const tint = options.tintSun ? sunColorIntensity(sunElevation, this._baseColor) : null;
    if (tint) this._sunColor.copy(tint.color); else this._sunColor.copy(this._baseColor);
    const sunIntensity = options.intensity * (tint ? tint.intensity : 1);

    if (this.sunLight && !this.active) {
      this.sunLight.color.copy(this._sunColor);
      if (tint) this.sunLight.intensity = sunIntensity;
    }

    if (!this.active || !this.csm) return;

    if (options.autoAdopt) this._adopt();

    // Cascades reach further as you climb; strength fades out before the gate.
    const wanted = THREE.MathUtils.clamp(
      options.maxFar + Math.max(0, cameraAltitude) * options.farPerAltitude,
      options.maxFar, options.maxFarCeiling,
    );
    if (Math.abs(wanted - this._appliedFar) > this._appliedFar * 0.08) this._retuneFrustums(wanted);

    this._shadowStrength = 1 - smoothstep(options.fadeAltitude, options.disableAltitude, cameraAltitude);
    this._applyBias();

    // CSM points its cascade lights along `lightDirection`, i.e. sun -> ground.
    this._lightDirection.copy(this._sunDirection).negate();
    this.csm.lightDirection.copy(this._lightDirection);
    for (const light of this.csm.lights) {
      light.color.copy(this._sunColor);
      light.intensity = sunIntensity;
      light.shadow.intensity = this._shadowStrength;
    }

    this.camera.updateMatrixWorld();
    this.csm.update();
  }

  /** Rough diagnostics for HUDs and tests. */
  get stats() {
    return {
      enabled: this.enabled,
      active: this.active,
      cascades: this.csm ? this.csm.cascades : 0,
      maxFar: Math.round(this._appliedFar),
      splits: this.csm ? this.csm.breaks.map((b) => Math.round(b * this._appliedFar)) : [],
      shadowMapSize: this.options.shadowMapSize,
      materials: this._registered.size,
      strength: Number(this._shadowStrength.toFixed(2)),
      biasBoost: Number(this._biasBoost.toFixed(2)),
      error: this.error,
    };
  }

  dispose() {
    this._setActive(false);
    if (this.csm) {
      // csm.dispose() deletes onBeforeCompile outright, so restore the originals
      // afterwards (planet.js's landMaterial needs its albedo hook back).
      this.csm.dispose();
      for (const [material, original] of this._registered) {
        if (original) material.onBeforeCompile = original;
        else delete material.onBeforeCompile;
        material.needsUpdate = true;
      }
      this.csm.remove();
      this.csm = null;
    }
    this._registered.clear();
    if (this.sunLight) this.sunLight.visible = true;
    this.renderer.shadowMap.enabled = this._previousShadowEnabled;
    this.renderer.shadowMap.type = this._previousShadowType;
  }
}

export default Lighting;

/** Re-exported so `public/dev/lighting.html` — served raw, outside Vite's module
 *  graph — can share this module's exact three instance. Harmless elsewhere. */
export { THREE };
