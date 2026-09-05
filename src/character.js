/**
 * src/character.js — the player character: rigged GLB, animation state machine,
 * over-the-shoulder / first-person camera and the opening-sequence dolly.
 *
 * Self-contained: it owns nothing else in the project and touches no globals.
 * `navigation.js` / `main.js` only need the few lines documented at the bottom.
 *
 * Conventions (see HANDOFF.md "Conventions Claude's modules follow"):
 *   - world positions are JS doubles in metres, planet centre at (0,0,0);
 *   - camera-relative rendering: `placeCameraRelative(renderOrigin)` each frame;
 *   - forward is -Z and up is +Y in the character's own frame, like the ship.
 *
 * The pure helpers at the top (`resolveState`, `blendWeights`,
 * `locomotionTimeScale`, `resolveClip`, `walkClipForState`,
 * `returnStateAfterOneShot`) contain all of the decision logic and are unit
 * tested without a GL context.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Re-exported like trees.js does, so the raw-served page under /public/dev/ shares
// this module's Vite-optimised three instance instead of loading a second copy.
export { THREE };

// ---------------------------------------------------------------- the contract

/** Animation clips the rigged character GLB must contain (HANDOFF request 17). */
export const CLIPS = Object.freeze([
  'idle', 'walk', 'run', 'jump', 'crouch-walk', 'sit-down', 'sit-idle', 'stand-up',
  'carry-walk', 'wounded-walk', 'aim-rifle', 'fire-rifle', 'fire-pistol', 'death',
]);

/** Logical states `setState()` accepts and `resolveState()` returns. */
export const STATES = Object.freeze([
  'idle', 'walk', 'run', 'jump', 'crouch', 'sit', 'carry', 'wounded',
  'aim-rifle', 'fire-rifle', 'fire-pistol', 'dead',
]);

/** Planar speed thresholds in m/s. idle → walk → run. */
export const SPEED = Object.freeze({ idle: 0.2, walkFull: 1.0, run: 2.2, runFull: 4.5 });

/** Speed at which each locomotion clip plays at timeScale 1 (metres per second). */
export const STRIDE = Object.freeze({ walk: 1.4, run: 4.5 });

/** Below this fraction of health the character limps. */
export const WOUNDED_HEALTH = 0.4;

/** Cross-fade time between animation states, seconds. */
export const FADE = 0.2;

/** Clips whose playback rate follows the walk stride. */
export const WALK_CLIPS = Object.freeze(['walk', 'carry-walk', 'wounded-walk', 'crouch-walk']);

/** Nearest usable clip when the authored one is missing, in preference order. */
export const CLIP_FALLBACKS = Object.freeze({
  'idle': [],
  'walk': ['run', 'idle'],
  'run': ['walk', 'idle'],
  'jump': ['idle'],
  'crouch-walk': ['walk', 'idle'],
  'carry-walk': ['walk', 'idle'],
  'wounded-walk': ['walk', 'idle'],
  'sit-down': ['sit-idle', 'idle'],
  'sit-idle': ['idle'],
  'stand-up': ['sit-down', 'idle'],
  'aim-rifle': ['idle'],
  'fire-rifle': ['aim-rifle', 'idle'],
  'fire-pistol': ['fire-rifle', 'aim-rifle', 'idle'],
  'death': ['idle'],
});

/** Playback-rate bias applied when a clip is served by a fallback:
 *  a missing `wounded-walk` is `walk` slowed down, a missing `run` is `walk` sped up. */
export const FALLBACK_TIME_SCALE = Object.freeze({
  'wounded-walk': 0.6,
  'crouch-walk': 0.75,
  'run': 1.6,
  'walk': 0.7,
});

/** Bones the aim/fire layer is allowed to touch — Spine1 upward, both arms and fingers.
 *  Matches Mixamo names (`mixamorigRightForeArm`) and plain names (`RightForeArm`). */
export const UPPER_BODY_PATTERN =
  /(Spine1|Spine2|Spine3|Neck|Head|Shoulder|Arm|ForeArm|Hand|Thumb|Index|Middle|Ring|Pinky)/i;

export function isUpperBodyTrack(trackName) {
  const bone = String(trackName).split('.')[0];
  // The rig root ("Armature") would otherwise match /Arm/ and drag the whole body.
  if (/^(armature|armature\d+|scene|rootnode|root|object\d*)$/i.test(bone)) return false;
  return UPPER_BODY_PATTERN.test(bone) && !/UpLeg|LegUp|ToeBase|Foot/i.test(bone);
}

const FIRE_STATES = Object.freeze(['fire-rifle', 'fire-pistol']);
const NO_FIRE = Object.freeze({ allowFire: false });

const clamp = (value, min, max) => (value < min ? min : value > max ? max : value);
const finite = (value, fallback) => (Number.isFinite(value) ? value : fallback);

// ------------------------------------------------------------- pure state logic

/**
 * The animation state for one frame of input. Pure, allocation free.
 *
 * @param {{speed?:number, grounded?:boolean, jumping?:boolean, crouching?:boolean,
 *          carrying?:boolean, health?:number, aiming?:'none'|'rifle'|'pistol',
 *          firing?:boolean, seated?:boolean, dead?:boolean}} input
 * @param {string} prevState  state from the previous frame (keeps fire/death sticky)
 * @param {{allowFire?:boolean}|null} options  pass `{allowFire:false}` to resolve the
 *        state a one-shot fire animation should fall back to.
 * @returns {string} one of STATES
 *
 * Priority: dead > held fire > new fire > seated > airborne > crouch > wounded >
 * carry > standing aim > run > walk > idle.
 */
export function resolveState(input, prevState = 'idle', options = null) {
  const source = input || EMPTY_INPUT;
  const speed = Math.max(0, finite(source.speed, 0));
  const health = finite(source.health, 1);
  const aiming = source.aiming || 'none';
  const allowFire = !(options && options.allowFire === false);

  if (source.dead === true || health <= 0) return 'dead';
  if (allowFire && source.firing === true && (prevState === 'fire-rifle' || prevState === 'fire-pistol')) return prevState;
  if (allowFire && source.firing === true && aiming !== 'none') return aiming === 'pistol' ? 'fire-pistol' : 'fire-rifle';
  if (source.seated === true) return 'sit';
  if (source.jumping === true || source.grounded === false) return 'jump';
  if (source.crouching === true) return 'crouch';
  if (health < WOUNDED_HEALTH) return 'wounded';
  if (source.carrying === true) return 'carry';
  // A standing aim is its own pose; while moving the aim rides on top of locomotion.
  if (aiming !== 'none' && speed <= SPEED.idle) return 'aim-rifle';
  if (speed >= SPEED.run) return 'run';
  if (speed > SPEED.idle) return 'walk';
  return 'idle';
}

const EMPTY_INPUT = Object.freeze({});

/** The state a finished `fire-*` one-shot returns to: whatever the input says, minus firing. */
export function returnStateAfterOneShot(previousState, input) {
  return resolveState(input, previousState, NO_FIRE);
}

/**
 * idle / walk / run blend weights for a planar speed. Weights always sum to 1.
 * Pass `out` to avoid the allocation (the character does, every frame).
 */
export function blendWeights(speed, out) {
  const target = out || { idle: 0, walk: 0, run: 0 };
  const s = Math.max(0, finite(speed, 0));
  let idle = 0, walk = 0, run = 0;
  if (s <= SPEED.idle) idle = 1;
  else if (s < SPEED.walkFull) {
    const t = (s - SPEED.idle) / (SPEED.walkFull - SPEED.idle);
    idle = 1 - t; walk = t;
  } else if (s <= SPEED.run) walk = 1;
  else if (s < SPEED.runFull) {
    const t = (s - SPEED.run) / (SPEED.runFull - SPEED.run);
    walk = 1 - t; run = t;
  } else run = 1;
  target.idle = idle; target.walk = walk; target.run = run;
  return target;
}

/** Playback rate that keeps the feet planted: stride length over ground speed, clamped. */
export function locomotionTimeScale(speed, clipName) {
  const s = Math.max(0, finite(speed, 0));
  if (clipName === 'run') return clamp(s / STRIDE.run, 0.6, 1.6);
  if (WALK_CLIPS.indexOf(clipName) !== -1) return clamp(s / STRIDE.walk, 0.5, 1.8);
  return 1;
}

/** The walking clip a locomotion state uses in the idle/walk/run blend. */
export function walkClipForState(state) {
  if (state === 'crouch') return 'crouch-walk';
  if (state === 'carry') return 'carry-walk';
  if (state === 'wounded') return 'wounded-walk';
  return 'walk';
}

/** States driven by the speed blend rather than by a single full-body clip. */
export function isLocomotionState(state) {
  return state !== 'jump' && state !== 'sit' && state !== 'dead';
}

/**
 * Which loaded clip serves `name`, following CLIP_FALLBACKS.
 * @param {string} name a member of CLIPS
 * @param {Set<string>|string[]|Object} available names present in the GLB
 * @returns {{name:string, source:string|null, fallback:boolean, timeScale:number}}
 */
export function resolveClip(name, available) {
  const has = (clip) => (available instanceof Set ? available.has(clip)
    : Array.isArray(available) ? available.indexOf(clip) !== -1
      : Boolean(available && available[clip]));
  if (has(name)) return { name, source: name, fallback: false, timeScale: 1 };
  const chain = CLIP_FALLBACKS[name] || [];
  for (let i = 0; i < chain.length; i++) {
    if (has(chain[i])) {
      return { name, source: chain[i], fallback: true, timeScale: FALLBACK_TIME_SCALE[name] ?? 1 };
    }
  }
  if (has('idle')) return { name, source: 'idle', fallback: true, timeScale: 1 };
  const any = available instanceof Set ? [...available] : Array.isArray(available) ? available : Object.keys(available || {});
  if (any.length) return { name, source: any[0], fallback: true, timeScale: 1 };
  return { name, source: null, fallback: true, timeScale: 1 };
}

// --------------------------------------------------------------------- scratch

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _eye = new THREE.Vector3();
const _spring = new THREE.Vector3();
const _sd1 = new THREE.Vector3();
const _sd2 = new THREE.Vector3();
const _pos = new THREE.Vector3();
const _pos2 = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _quat2 = new THREE.Quaternion();
const _matrix = new THREE.Matrix4();
const _zero = new THREE.Vector3();
const FORWARD = new THREE.Vector3(0, 0, -1);
const UP = new THREE.Vector3(0, 1, 0);
const RIGHT = new THREE.Vector3(1, 0, 0);

const easeInOut = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

// ------------------------------------------------------------------- Character

/**
 * A rigged, animated player character.
 *
 *   const character = new Character(scene, { onReady: () => ... });
 *   character.setWorldPose(worldPosition, quaternion);   // or alignToSurface(...)
 *   character.update(dt, input);                          // input, see resolveState
 *   character.placeCameraRelative(origin);                // every frame, after origin
 */
export class Character {
  /**
   * @param {THREE.Scene|THREE.Object3D} scene
   * @param {object} [options]
   * @param {string} [options.url='/models/props/mannequin.glb']
   * @param {number} [options.eyeHeight=1.65] fallback eye height when the rig has no Head bone
   * @param {Function} [options.onReady] called with (this) when the GLB is live
   * @param {number} [options.modelYaw=0] radians, if the authored rig does not face -Z
   * @param {boolean} [options.placeholder=true] show a capsule until the GLB arrives
   * @param {GLTFLoader} [options.loader] share a loader / inject one in tests
   */
  constructor(scene, options = {}) {
    const {
      url = '/models/props/mannequin.glb',
      eyeHeight = 1.65,
      onReady = null,
      modelYaw = 0,
      placeholder = true,
      loader = null,
    } = options;

    this.scene = scene;
    this.url = url;
    this.eyeHeight = eyeHeight;
    this.error = null;
    this.progress = 0;
    this.ready = false;
    this.disposed = false;

    /** Logical animation state, one of STATES. */
    this.state = 'idle';
    /** Non-null while a `sit-down` / `stand-up` transition plays. */
    this.transition = null;

    this.object = new THREE.Group();
    this.object.name = 'player-character';
    this.object.matrixAutoUpdate = true;
    this.pivot = new THREE.Group();          // absorbs modelYaw so `object` stays the game frame
    this.pivot.rotation.y = modelYaw;
    this.object.add(this.pivot);
    if (scene) scene.add(this.object);

    this.worldPosition = new THREE.Vector3();
    this._renderOrigin = new THREE.Vector3();
    this._up = new THREE.Vector3(0, 1, 0);
    /** Eye offset from the Head bone, in the character's own frame. */
    this.headOffset = new THREE.Vector3(0, 0.09, -0.08);

    this.model = null;
    this.mixer = null;
    this.skeleton = null;
    this._headBone = null;
    this._headParts = [];
    this._headScale = 1;
    this._headHidden = false;

    /** name → THREE.AnimationAction for every key in `_keys`. */
    this.actions = Object.create(null);
    /** name → { source, fallback, timeScale } describing which clip actually plays. */
    this.clipInfo = Object.create(null);
    this.missingClips = [];

    this._keys = [];                          // stable iteration order, no per-frame allocation
    this._weight = Object.create(null);
    this._target = Object.create(null);
    this._oneShots = Object.create(null);
    this._blend = { idle: 0, walk: 0, run: 0 };
    this._fireLatch = false;
    this._fireActive = false;
    this._lastSpeed = 0;
    this._walkSlot = 'walk';
    this._onFinished = (event) => this._handleFinished(event);

    this._placeholder = placeholder ? this._buildPlaceholder() : null;
    if (this._placeholder) this.pivot.add(this._placeholder);

    this.readyPromise = new Promise((resolve) => { this._resolveReady = resolve; });
    this._load(loader || new GLTFLoader(), onReady);
  }

  // -------------------------------------------------------------------- loading

  _buildPlaceholder() {
    const group = new THREE.Group();
    group.name = 'character-placeholder';
    const material = new THREE.MeshStandardMaterial({ color: 0x7fd8b0, roughness: 0.75, metalness: 0.05 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 1.06, 6, 14), material);
    body.position.y = 0.85;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 18, 12), material);
    head.position.y = 1.66;
    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.12), material);
    nose.position.set(0, 1.62, -0.14);       // marks -Z, the facing direction
    for (const mesh of [body, head, nose]) { mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh); }
    group.userData.material = material;
    return group;
  }

  _load(loader, onReady) {
    loader.load(
      this.url,
      (gltf) => {
        if (this.disposed) return;
        try {
          this._adopt(gltf);
          this.ready = true;
          this._resolveReady(this);
          if (onReady) onReady(this);
        } catch (error) {
          this.error = `Character rig could not be prepared: ${error.message}`;
          console.error('[character]', error);
          this._resolveReady(this);
        }
      },
      (event) => {
        if (event && event.total) this.progress = clamp(event.loaded / event.total, 0, 1);
      },
      (error) => {
        if (this.disposed) return;
        this.error = `Character model ${this.url} failed to load: ${error?.message || error}`;
        console.warn('[character]', this.error, '— keeping the placeholder.');
        this._resolveReady(this);
      },
    );
  }

  _adopt(gltf) {
    this.model = gltf.scene || gltf.scenes[0];
    this.model.traverse((node) => {
      if (node.isMesh || node.isSkinnedMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
        // A skinned mesh's authored bounds do not follow the pose; culling it by them pops.
        if (node.isSkinnedMesh) node.frustumCulled = false;
        if (/helmet|visor|head/i.test(node.name)) this._headParts.push(node);
      }
      // `mixamorigHead`, `Head`, `DEF-head` — but not `mixamorigHeadTop_End`.
      if (node.isBone && !this._headBone && /head$/i.test(node.name)) this._headBone = node;
      if (node.isSkinnedMesh && !this.skeleton) this.skeleton = node.skeleton;
    });
    if (!this._headBone && this.skeleton) {
      this._headBone = this.skeleton.bones.find((bone) => /head/i.test(bone.name)) || null;
    }
    this.pivot.add(this.model);
    if (this._placeholder) {
      this.pivot.remove(this._placeholder);
      disposeTree(this._placeholder);
      this._placeholder = null;
    }

    this.mixer = new THREE.AnimationMixer(this.model);
    this.mixer.addEventListener('finished', this._onFinished);
    this._buildActions(gltf.animations || []);
    this._applyStateActions(this.state, null);
    // The game may already have driven us into a one-shot state (dead, jump, a seat
    // transition) while the GLB was still downloading; start that clip now.
    this._enterCurrentState();
    // A first-person camera may have asked for this before the rig existed.
    this.setHeadHidden(this._headHidden);
  }

  _buildActions(animations) {
    const byName = new Map();
    for (const clip of animations) byName.set(normaliseClipName(clip.name), clip);
    const available = new Set(byName.keys());

    const addAction = (key, clip, { loop, oneShot, timeScale }) => {
      const action = this.mixer.clipAction(clip);
      action.enabled = true;
      action.setLoop(loop, loop === THREE.LoopOnce ? 1 : Infinity);
      action.clampWhenFinished = oneShot;
      action.setEffectiveWeight(0);
      action.play();
      action.paused = true;               // nothing advances until it carries weight
      this.actions[key] = action;
      this._weight[key] = 0;
      this._target[key] = 0;
      this._oneShots[key] = Boolean(oneShot);
      this._keys.push(key);
      action.userData = action.userData || {};
      action.userData.characterKey = key;
      action.userData.timeScale = timeScale;
      return action;
    };

    // Full-body clips, one action per contract clip.
    const oneShotClips = new Set(['jump', 'sit-down', 'stand-up', 'death']);
    for (const name of CLIPS) {
      if (name === 'fire-rifle' || name === 'fire-pistol' || name === 'aim-rifle') continue;
      const info = resolveClip(name, available);
      this.clipInfo[name] = info;
      if (info.fallback) this.missingClips.push(name);
      const clip = info.source ? byName.get(info.source) : null;
      if (!clip) continue;
      const oneShot = oneShotClips.has(name);
      addAction(name, clip, {
        loop: oneShot ? THREE.LoopOnce : THREE.LoopRepeat,
        oneShot,
        timeScale: info.timeScale,
      });
    }

    // Upper-body additive layer: aim held, fire as a one-shot over the locomotion.
    const idleClip = byName.get(this.clipInfo.idle?.source || 'idle') || null;
    for (const [key, name] of [['aim', 'aim-rifle'], ['fire-rifle', 'fire-rifle'], ['fire-pistol', 'fire-pistol']]) {
      const info = resolveClip(name, available);
      this.clipInfo[name] = info;
      if (info.fallback) this.missingClips.push(name);
      const source = info.source ? byName.get(info.source) : null;
      if (!source) continue;
      const additive = makeUpperBodyAdditive(source, idleClip, `${name}-additive`);
      if (!additive) continue;
      const oneShot = key !== 'aim';
      addAction(key, additive, {
        loop: oneShot ? THREE.LoopOnce : THREE.LoopRepeat,
        oneShot,
        timeScale: info.timeScale,
      });
    }

    if (this.missingClips.length) {
      console.warn(`[character] ${this.url}: missing clips ${this.missingClips.join(', ')} — mapped to `
        + this.missingClips.map((name) => `${name}→${this.clipInfo[name].source ?? 'none'}`).join(', '));
    }
  }

  // ---------------------------------------------------------------- state machine

  /**
   * Force a state. Handles the seat sequence (`sit-down` → `sit-idle`,
   * `stand-up` → target) and restarts one-shots.
   * @param {string} name one of STATES
   * @param {{immediate?:boolean}} [params]
   */
  setState(name, params = null) {
    if (STATES.indexOf(name) === -1) return this.state;
    if (name === this.state && !(params && params.immediate)) return this.state;
    const previous = this.state;
    this.state = name;
    // Only hold the state open when there is a real one-shot to wait for.
    this._fireActive = (name === 'fire-rifle' || name === 'fire-pistol') && Boolean(this.actions[name]);

    if (name === 'sit' && previous !== 'sit') this._beginTransition('sit-down');
    else if (previous === 'sit' && name !== 'sit' && name !== 'dead') this._beginTransition('stand-up');
    else this.transition = null;

    if (name === 'dead') { this.transition = null; this._restart('death'); }
    if (name === 'jump' && previous !== 'jump') this._restart('jump');
    if (name === 'fire-rifle' || name === 'fire-pistol') this._restart(name === 'fire-rifle' ? 'fire-rifle' : 'fire-pistol');

    if (isLocomotionState(name)) this._syncWalkSlot(walkClipForState(name));
    return this.state;
  }

  /** (Re)start whichever one-shot the current state owns. */
  _enterCurrentState() {
    if (this.transition) { this._restart(this.transition); return; }
    if (this.state === 'dead') this._restart('death');
    else if (this.state === 'jump') this._restart('jump');
    else if (this.state === 'fire-rifle' || this.state === 'fire-pistol') this._restart(this.state);
    if (isLocomotionState(this.state)) this._syncWalkSlot(walkClipForState(this.state));
  }

  _beginTransition(name) {
    if (!this.actions[name]) { this.transition = null; return; }
    this.transition = name;
    this._restart(name);
  }

  _restart(key) {
    const action = this.actions[key];
    if (!action) return;
    action.reset();
    action.enabled = true;
    action.paused = false;
    action.setEffectiveWeight(this._weight[key] || 0);
    action.play();
  }

  /** Keep the feet in phase when the walk variant changes (picking up cargo, crouching). */
  _syncWalkSlot(slot) {
    if (slot === this._walkSlot) return;
    const from = this.actions[this._walkSlot];
    const to = this.actions[slot];
    if (from && to && to.getClip().duration > 0) {
      const phase = from.getClip().duration > 0 ? (from.time / from.getClip().duration) : 0;
      to.time = phase * to.getClip().duration;
    }
    this._walkSlot = slot;
  }

  _handleFinished(event) {
    const key = event.action?.userData?.characterKey;
    if (!key) return;
    if (key === 'sit-down' || key === 'stand-up') { if (this.transition === key) this.transition = null; return; }
    if (key === 'fire-rifle' || key === 'fire-pistol') { this._fireLatch = true; this._fireActive = false; return; }
    // `jump` and `death` clamp on their last frame; the next update resolves out of them.
  }

  /**
   * Advance one frame.
   * @param {number} dt seconds
   * @param {{speed?:number, grounded?:boolean, jumping?:boolean, crouching?:boolean,
   *          carrying?:boolean, health?:number, aiming?:'none'|'rifle'|'pistol',
   *          firing?:boolean, seated?:boolean, dead?:boolean}} input
   */
  update(dt, input) {
    const source = input || EMPTY_INPUT;
    if (source.firing !== true) this._fireLatch = false;

    // Semi-automatic: one shot per trigger press. The recoil one-shot always plays out
    // (a tapped trigger is not cut short) and the latch, released only when `firing`
    // goes false, stops a held trigger from re-entering it.
    let next;
    if (source.dead === true || finite(source.health, 1) <= 0) next = 'dead';
    else if (this._fireActive) next = this.state;
    else if (this._fireLatch) next = returnStateAfterOneShot(this.state, source);
    else next = resolveState(source, this.state);
    if (next !== this.state) this.setState(next);

    this._lastSpeed = Math.max(0, finite(source.speed, 0));
    if (!this.ready || !this.mixer) return this.state;

    this._applyStateActions(this.state, source);
    const rate = dt > 0 ? Math.min(1, dt / FADE) : 1;
    for (let i = 0; i < this._keys.length; i++) {
      const key = this._keys[i];
      const action = this.actions[key];
      const target = this._target[key];
      let weight = this._weight[key];
      const delta = target - weight;
      weight += delta > 0 ? Math.min(delta, rate) : Math.max(delta, -rate);
      if (weight < 1e-4) weight = 0;
      this._weight[key] = weight;
      action.setEffectiveWeight(weight);
      const bias = action.userData.timeScale || 1;
      action.setEffectiveTimeScale(locomotionTimeScale(this._lastSpeed, key) * bias);
      if (!this._oneShots[key]) action.paused = weight === 0 && target === 0;
    }
    this.mixer.update(dt);
    return this.state;
  }

  _applyStateActions(state, input) {
    const keys = this._keys;
    for (let i = 0; i < keys.length; i++) this._target[keys[i]] = 0;

    if (this.transition) {
      this._target[this.transition] = 1;
    } else if (state === 'sit') {
      this._set('sit-idle', 1);
    } else if (state === 'dead') {
      this._set('death', 1);
    } else if (state === 'jump') {
      this._set('jump', 1);
    } else {
      const blend = blendWeights(this._lastSpeed, this._blend);
      const slot = walkClipForState(state);
      this._syncWalkSlot(slot);
      this._set('idle', blend.idle);
      if (slot === 'walk') {
        this._set('walk', blend.walk);
        this._set('run', blend.run);
      } else {
        // Crouching, carrying and limping never break into a run.
        this._set(slot, blend.walk + blend.run);
      }
    }

    const aiming = input ? (input.aiming || 'none') : 'none';
    const firing = state === 'fire-rifle' || state === 'fire-pistol';
    if (firing) this._set(state, 1);
    else if (aiming !== 'none' && state !== 'dead' && state !== 'sit') this._set('aim', 1);
  }

  _set(key, weight) {
    if (this._target[key] !== undefined) this._target[key] = weight;
    else if (this.actions[key]) this._target[key] = weight;
  }

  /** The clip currently carrying the most weight — for HUD / debug readouts. */
  get clipName() {
    let best = null, weight = 0;
    for (let i = 0; i < this._keys.length; i++) {
      const key = this._keys[i];
      if (this._weight[key] > weight) { weight = this._weight[key]; best = key; }
    }
    return best;
  }

  /** { key: weight } snapshot; allocates, for debug pages only. */
  get weights() {
    const out = {};
    for (let i = 0; i < this._keys.length; i++) if (this._weight[this._keys[i]] > 0.001) out[this._keys[i]] = this._weight[this._keys[i]];
    return out;
  }

  // -------------------------------------------------------------------- placement

  /** Feet position and orientation in world metres. Forward is -Z, up is +Y. */
  setWorldPose(worldPosition, quaternion) {
    this.worldPosition.copy(worldPosition);
    if (quaternion) this.object.quaternion.copy(quaternion);
    this._up.copy(UP).applyQuaternion(this.object.quaternion);
    return this;
  }

  /** Camera-relative rendering: call once per frame with the frame's render origin. */
  placeCameraRelative(renderOrigin) {
    this._renderOrigin.copy(renderOrigin);
    this.object.position.copy(this.worldPosition).sub(renderOrigin);
    return this;
  }

  /**
   * Stand on a sphere: feet at `worldPosition`, up along `surfaceNormal`,
   * facing `forward` projected onto the tangent plane.
   */
  alignToSurface(worldPosition, surfaceNormal, forward) {
    _v1.copy(surfaceNormal).normalize();
    _v2.copy(forward || FORWARD).projectOnPlane(_v1);
    if (_v2.lengthSq() < 1e-10) {
      _v2.copy(Math.abs(_v1.y) > 0.9 ? RIGHT : UP).cross(_v1);
      if (_v2.lengthSq() < 1e-10) _v2.copy(FORWARD);
    }
    _v2.normalize();
    _matrix.lookAt(_zero, _v2, _v1);          // -Z along forward, +Y along the normal
    _quat.setFromRotationMatrix(_matrix);
    return this.setWorldPose(worldPosition, _quat);
  }

  /** Unit up vector in world space (the character's own +Y). */
  get up() { return this._up; }

  /** Unit forward vector in world space (the character's own -Z). Allocates on demand. */
  forwardVector(out = new THREE.Vector3()) {
    return out.copy(FORWARD).applyQuaternion(this.object.quaternion);
  }

  /** The rig's Head bone, or null on the placeholder / an unrigged model. */
  get headBone() { return this._headBone; }

  /** World-space eye position: from the Head bone if the rig has one, else eyeHeight along up. */
  eyeWorldPosition(out = new THREE.Vector3()) {
    if (this._headBone) {
      this._headBone.getWorldPosition(out);
      out.add(this._renderOrigin);
      _eye.copy(this.headOffset).applyQuaternion(this.object.quaternion);
      return out.add(_eye);
    }
    return out.copy(this.worldPosition).addScaledVector(this._up, this.eyeHeight);
  }

  /** Hide the head / helmet so the first-person camera does not sit inside it. */
  setHeadHidden(hidden) {
    this._headHidden = Boolean(hidden);
    if (this._headBone) this._headBone.scale.setScalar(hidden ? 1e-4 : this._headScale);
    for (const part of this._headParts) part.visible = !hidden;
    return this;
  }

  /** Show or hide the whole character (the intro hides nothing; photo mode might). */
  setVisible(visible) { this.object.visible = visible; return this; }

  dispose() {
    this.disposed = true;
    if (this.mixer) {
      this.mixer.removeEventListener('finished', this._onFinished);
      this.mixer.stopAllAction();
      if (this.model) this.mixer.uncacheRoot(this.model);
    }
    if (this.object.parent) this.object.parent.remove(this.object);
    disposeTree(this.object);
    this.actions = Object.create(null);
    this._keys.length = 0;
    this.model = null;
    this.mixer = null;
    this._headBone = null;
    this._headParts.length = 0;
  }
}

// -------------------------------------------------------------- CharacterCamera

/**
 * Over-the-shoulder and first-person camera for a Character, plus the opening
 * cinematic dolly. Produces a world position + orientation; the game keeps
 * rendering camera-relative:
 *
 *   characterCamera.update(dt, nav.orientation);
 *   origin.copy(characterCamera.worldPosition);
 *   characterCamera.applyTo(camera, origin);
 */
export class CharacterCamera {
  /**
   * @param {Character} character
   * @param {object} [options]
   * @param {'third'|'first'} [options.mode='third']
   * @param {number} [options.fov=52] third/first person field of view (degrees)
   * @param {number} [options.cinematicFov=45]
   * @param {number} [options.stiffness=8] spring-damper rate of the follow camera
   */
  constructor(character, options = {}) {
    this.character = character;
    this.mode = options.mode || 'third';
    this.fov = options.fov ?? 52;
    this.cinematicFov = options.cinematicFov ?? 45;
    this.stiffness = options.stiffness ?? 8;
    /** Over-the-shoulder offset in the character's frame, metres. */
    this.offset = { right: 0.45, up: 1.7, back: 3.2, ...(options.offset || {}) };
    /** Distance ahead of the character the third-person camera aims at. */
    this.lookAhead = options.lookAhead ?? 8;
    /** Height of that aim point above the feet — low enough to keep the boots in frame. */
    this.lookHeight = options.lookHeight ?? 1.05;
    /** Breathing sway during the cinematic: metres and Hz. */
    this.sway = { amplitude: 0.02, frequency: 0.2, ...(options.sway || {}) };

    this.worldPosition = new THREE.Vector3();
    this.quaternion = new THREE.Quaternion();
    this.currentFov = this.fov;

    this._springPosition = new THREE.Vector3();
    this._springVelocity = new THREE.Vector3();
    this._springReady = false;
    this._blendFrom = null;
    this._blendT = 0;
    this._blendDuration = 0;

    this._cine = {
      active: false, t: 0, duration: 0,
      from: new THREE.Vector3(), to: new THREE.Vector3(), lookAt: new THREE.Vector3(),
    };
    /** Called once when a cinematic reaches its end. */
    this.onCinematicEnd = null;
    this._elapsed = 0;
  }

  /** Snap to a mode with no blend. */
  setMode(mode) {
    this.mode = mode;
    this._blendFrom = null;
    this._blendT = 0;
    if (mode !== 'cinematic') this._cine.active = false;
    this.character?.setHeadHidden?.(mode === 'first');
    return this;
  }

  /** Ease from the current mode to `mode` over `seconds` (request 18e: A → first person). */
  blendTo(mode, seconds = 0.9) {
    if (mode === this.mode && !this._blendFrom) return this;
    this._blendFrom = this.mode;
    this._blendT = 0;
    this._blendDuration = Math.max(1e-3, seconds);
    this.mode = mode;
    // The head only disappears once the camera is actually at the eyes.
    if (mode !== 'first') this.character?.setHeadHidden?.(false);
    return this;
  }

  get blending() { return this._blendFrom !== null; }
  get cinematicActive() { return this._cine.active; }
  get cinematicProgress() { return this._cine.duration > 0 ? clamp(this._cine.t / this._cine.duration, 0, 1) : 1; }

  /**
   * Opening shot (HANDOFF request 18b): dolly from `from` to `to` over `seconds`
   * while looking at `lookAt`, at 45° FOV with a faint breathing sway.
   * All arguments are world-space metres.
   */
  cinematic(from, to, seconds, lookAt) {
    this._cine.from.copy(from);
    this._cine.to.copy(to);
    this._cine.lookAt.copy(lookAt);
    this._cine.duration = Math.max(1e-3, seconds);
    this._cine.t = 0;
    this._cine.active = true;
    this.mode = 'cinematic';
    this._blendFrom = null;
    this.character?.setHeadHidden?.(false);
    return this;
  }

  /**
   * Request 18b as one call: 6 m back and 2.6 m up from the character, looking over
   * its head toward whatever it faces, dollying `dolly` metres forward over `seconds`.
   */
  openingShot(seconds = 10, dolly = 1.5) {
    const character = this.character;
    character.forwardVector(_v1);
    const up = character.up;
    _v2.copy(character.worldPosition).addScaledVector(_v1, -6).addScaledVector(up, 2.6);
    _v3.copy(_v2).addScaledVector(_v1, dolly);
    // Look over the head, six metres beyond it, so the door seam lands in the centre.
    // Derived from the pose, not the live head bone, so it is correct before the GLB lands.
    _pos.copy(character.worldPosition)
      .addScaledVector(up, character.eyeHeight + 0.25)
      .addScaledVector(_v1, 6);
    return this.cinematic(_v2, _v3, seconds, _pos);
  }

  /**
   * @param {number} dt seconds
   * @param {THREE.Quaternion} [lookQuaternion] the player's look orientation
   *        (`nav.orientation`); first person uses it, third person aims from the body.
   */
  update(dt, lookQuaternion) {
    this._elapsed += dt;
    if (this._cine.active) {
      this._cine.t += dt;
      if (this._cine.t >= this._cine.duration && this.mode === 'cinematic') {
        this._cine.t = this._cine.duration;
        if (this.onCinematicEnd) { const done = this.onCinematicEnd; this.onCinematicEnd = null; done(this); }
      }
    }

    if (this._blendFrom) {
      this._blendT += dt;
      const t = easeInOut(clamp(this._blendT / this._blendDuration, 0, 1));
      this._pose(this._blendFrom, dt, lookQuaternion, _pos, _quat);
      const fovA = this._fovFor(this._blendFrom);
      this._pose(this.mode, dt, lookQuaternion, _pos2, _quat2);
      this.worldPosition.copy(_pos).lerp(_pos2, t);
      this.quaternion.copy(_quat).slerp(_quat2, t);
      this.currentFov = fovA + (this._fovFor(this.mode) - fovA) * t;
      if (t >= 1) {
        this._blendFrom = null;
        if (this.mode !== 'cinematic') this._cine.active = false;
        this.character?.setHeadHidden?.(this.mode === 'first');
      }
    } else {
      this._pose(this.mode, dt, lookQuaternion, this.worldPosition, this.quaternion);
      this.currentFov = this._fovFor(this.mode);
    }
    return this;
  }

  _fovFor(mode) { return mode === 'cinematic' ? this.cinematicFov : this.fov; }

  _pose(mode, dt, lookQuaternion, outPosition, outQuaternion) {
    const character = this.character;
    const up = character.up;
    if (mode === 'first') {
      character.eyeWorldPosition(outPosition);
      outQuaternion.copy(lookQuaternion || character.object.quaternion);
      return;
    }
    if (mode === 'cinematic') {
      const t = easeInOut(this.cinematicProgress);
      outPosition.copy(this._cine.from).lerp(this._cine.to, t);
      const sway = Math.sin(this._elapsed * Math.PI * 2 * this.sway.frequency) * this.sway.amplitude;
      outPosition.addScaledVector(up, sway);
      _matrix.lookAt(outPosition, this._cine.lookAt, up);
      outQuaternion.setFromRotationMatrix(_matrix);
      return;
    }
    // Third person: over-the-shoulder, critically damped follow.
    character.forwardVector(_v1);
    _v2.copy(_v1).cross(up).normalize();      // right
    _spring.copy(character.worldPosition)
      .addScaledVector(_v2, this.offset.right)
      .addScaledVector(up, this.offset.up)
      .addScaledVector(_v1, -this.offset.back);
    if (!this._springReady) { this._springPosition.copy(_spring); this._springVelocity.set(0, 0, 0); this._springReady = true; }
    springDamp(this._springPosition, this._springVelocity, _spring, this.stiffness, dt);
    outPosition.copy(this._springPosition);
    _v3.copy(character.worldPosition)
      .addScaledVector(up, this.lookHeight)
      .addScaledVector(_v1, this.lookAhead)
      .addScaledVector(_v2, this.offset.right);
    _matrix.lookAt(outPosition, _v3, up);
    outQuaternion.setFromRotationMatrix(_matrix);
  }

  /** Write the pose onto a real camera, camera-relative like the rest of the renderer. */
  applyTo(camera, renderOrigin) {
    if (renderOrigin) camera.position.copy(this.worldPosition).sub(renderOrigin);
    else camera.position.copy(this.worldPosition);
    camera.quaternion.copy(this.quaternion);
    if (camera.isPerspectiveCamera && Math.abs(camera.fov - this.currentFov) > 1e-3) {
      camera.fov = this.currentFov;
      camera.updateProjectionMatrix();
    }
    return this;
  }

  /** Forget the follow smoothing (after a teleport / transit). */
  reset() { this._springReady = false; this._springVelocity.set(0, 0, 0); return this; }
}

// -------------------------------------------------------------------- internals

/** Critically damped spring toward `target`; stable for any dt. */
function springDamp(position, velocity, target, omega, dt) {
  if (dt <= 0) return position;
  const exp = Math.exp(-omega * dt);
  _sd1.copy(position).sub(target);                                 // x
  _sd2.copy(velocity).addScaledVector(_sd1, omega).multiplyScalar(dt);
  velocity.addScaledVector(_sd2, -omega).multiplyScalar(exp);
  position.copy(target).add(_sd1.add(_sd2).multiplyScalar(exp));
  return position;
}

/** Meshy/Mixamo exports carry names like `Armature|idle` or `mixamo.com`. */
function normaliseClipName(name) {
  const raw = String(name || '');
  const tail = raw.includes('|') ? raw.slice(raw.lastIndexOf('|') + 1) : raw;
  return tail.trim().toLowerCase().replace(/[\s_]+/g, '-');
}

/**
 * An additive clip that only drives the upper body, so an aim or a shot rides on
 * top of whatever the legs are doing.
 */
function makeUpperBodyAdditive(clip, referenceClip, name) {
  const tracks = clip.tracks.filter((track) => isUpperBodyTrack(track.name));
  if (!tracks.length) return null;
  const filtered = new THREE.AnimationClip(name, clip.duration, tracks.map((track) => track.clone()));
  THREE.AnimationUtils.makeClipAdditive(filtered, 0, referenceClip || filtered, 30);
  return filtered;
}

function disposeTree(root) {
  root.traverse((node) => {
    if (node.geometry) node.geometry.dispose();
    const material = node.material;
    if (!material) return;
    for (const entry of Array.isArray(material) ? material : [material]) {
      for (const key of Object.keys(entry)) {
        const value = entry[key];
        if (value && value.isTexture) value.dispose();
      }
      entry.dispose();
    }
  });
}

/* ---------------------------------------------------------------------------
 * Wiring for Astra (main.js / navigation.js) — HANDOFF requests 17 and 18.
 * Test bench: /dev/character.html (WASD, 1/2/3 aim, F fire, E sit, V camera).
 *
 * 1. CONSTRUCT (next to `const ship = createWalkableShip()`):
 *
 *      import { Character, CharacterCamera } from './character.js';
 *      const character = new Character(scene);        // capsule placeholder until the GLB lands
 *      const characterCamera = new CharacterCamera(character);
 *      const feet = new THREE.Vector3(), forward = new THREE.Vector3(), planar = new THREE.Vector3();
 *
 * 2. PER FRAME, in frame() right after the nav.update() substep loop and BEFORE
 *    `origin.copy(nav.position)`. `nav.position` is the EYE, so the feet are one
 *    eye-height down the local up — the ship's up while aboard, the planet normal outside.
 *
 *      const onFoot = nav.mode === 'walk';
 *      character.setVisible(onFoot);
 *      if (onFoot) {
 *        const up = nav.insideShip ? UP.clone().applyQuaternion(nav.shipOrientation) : nav.normal;
 *        feet.copy(nav.position).addScaledVector(up, -SHIP_LAYOUT.eyeHeight);
 *        forward.set(0, 0, -1).applyQuaternion(nav.orientation);
 *        character.alignToSurface(feet, up, forward);
 *        planar.copy(nav.velocity).projectOnPlane(up);
 *        character.update(dt, {
 *          speed: planar.length(),            // planar m/s drives the idle↔walk↔run blend
 *          grounded: nav.jumpHeight === 0,
 *          jumping: nav.jumpHeight > 0,
 *          crouching: false,                  // wire to a crouch key when you add one
 *          carrying: inventory.carrying,      // or false
 *          health: 1,                         // < 0.4 → wounded-walk
 *          aiming: 'none', firing: false,     // 'rifle' | 'pistol' when weapons land
 *          seated: false,
 *        });
 *      } else if (nav.mode === 'landed') {
 *        character.update(dt, { seated: true, speed: 0, grounded: true, health: 1, aiming: 'none' });
 *      }
 *
 * 3. CAMERA HANDOFF in walk mode. Third person moves the render origin off nav.position,
 *    so hand the camera's world position to everything that streams or shades by viewer:
 *
 *      if (onFoot) {
 *        characterCamera.update(dt, nav.orientation);           // first person uses this look quaternion
 *        origin.copy(characterCamera.worldPosition);
 *        characterCamera.applyTo(camera, origin);               // camera.position = 0, quaternion + fov
 *      } else { origin.copy(nav.position); camera.position.set(0,0,0); camera.quaternion.copy(nav.orientation); }
 *      character.placeCameraRelative(origin);                   // always, so it renders camera-relative
 *      // then pass `origin` (not nav.position) as the viewer to planet/station/atmosphere while on foot.
 *      // V (or your own key) toggles: characterCamera.blendTo(mode === 'third' ? 'first' : 'third', 0.9);
 *
 * 4. OPENING SEQUENCE (request 18a/b/e). Once `station.ready`, stand the character on the
 *    deck 2.5 m to the +X side of the ship's nose, facing the doors, and run camera A:
 *
 *      const q = station.padQuaternion;                          // nose (-Z) toward the doors
 *      const stand = station.padWorldPosition.clone()
 *        .add(new THREE.Vector3(2.5, 0, -5).applyQuaternion(q)); // +X side, level with the nose
 *      character.setWorldPose(stand, q);
 *      characterCamera.openingShot(10, 1.5);                     // 6 m back, 2.6 m up, 45°, 1.5 m dolly
 *      // …or spell the shot out yourself: characterCamera.cinematic(from, to, 10, lookAt)
 *      characterCamera.onCinematicEnd = () => showHint('W to walk');   // fires once at second 10
 *      station.openDoors();                                      // play DoorsOpen at 0.5× for request 18c
 *      // first move key: characterCamera.blendTo('first', 0.9) — the character cross-fades
 *      // idle → walk on its own as soon as `speed` rises, and the head hides at the end of the blend.
 * ------------------------------------------------------------------------- */
