/**
 * src/equipment.js — what the player character holds: a laser rifle, a sidearm
 * pistol, a two-handed mining laser, plus the life-support backpack and the
 * helmet. Items follow skeletal sockets; an arm IK pass keeps both palms on
 * their grips while the barrel follows the player's aim.
 *
 * Self-contained: it reads `character.js` through its public surface (`skeleton`,
 * `model`, `readyPromise`, `update` input) and never edits it.
 *
 * Conventions (see HANDOFF.md "Conventions Claude's modules follow"):
 *   - world positions are JS doubles in metres, planet centre at (0,0,0);
 *   - the scene renders camera-relative, so every VFX keeps its position in
 *     world metres and is drawn at `world - renderOrigin` each frame;
 *   - forward is -Z and up is +Y in the character's own frame.
 *
 * Calibration lives in `public/models/props/equipment-sockets.json`, keyed by
 * rig and item, because the rigs disagree about hand-bone orientation
 * (and Meshy rigs carry a 0.01 armature scale). Offsets in that file
 * are **metres and degrees in the socket bone's own frame**: the item hangs off
 * a scale-compensating group, so the same numbers mean the same thing on every
 * rig. Re-calibrate on /dev/equipment.html.
 *
 * The pure helpers at the top (`FireGate`, `HeatSink`, `advanceTracer`,
 * `resolveSocket`, `socketScale`, `composeMuzzle`) hold all of the arithmetic
 * and are unit tested without a GL context (tests/equipment.test.js).
 */

import * as THREE from 'three';
import { textureMiningTool } from './mining/tool-materials.js';
import { shareHandheldTextures, hasAuthoredHandheldFinish, clearHandheldTextureCache } from './equipment-materials.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { solveArm, rotateBoneWorld } from './character-ik.js';

// Re-exported like character.js does, so the raw-served page under /public/dev/
// shares this module's Vite-optimised three instance instead of a second copy.
export { THREE };

// ---------------------------------------------------------------- the contract

/** Rig names the calibration file is keyed by. */
export const RIGS = Object.freeze(['mannequin', 'player-male', 'player-female', 'player-expedition']);

/** Logical socket names. The calibration file maps each to a real bone per rig. */
export const SOCKETS = Object.freeze(['RightHand', 'LeftHand', 'Spine2', 'Head']);

/** Where the calibration file lives, served out of public/. */
export const SOCKETS_URL = '/models/props/equipment-sockets.json';

const PROPS = '/models/props/';

/**
 * Every equippable item.
 *
 *   file          GLB under public/
 *   socket        logical socket bone (see SOCKETS)
 *   handed        1 | 2 — two-handed items expose `leftHandTargetLocal` for a later IK pass
 *   barrelAxis    unit vector in the item's own space pointing out of the muzzle
 *   muzzle        muzzle point in the item's own space, metres
 *   leftGrip      support-hand grip point in the item's own space (two-handed items)
 *   aimClip       character.js clip held while the item is up
 *   fireClip      character.js clip pulsed on each shot (null → the tool, no recoil)
 *   aiming        the value to feed `character.update({ aiming })`
 *   fireRate      shots per second (rounds); the mining laser is continuous
 *   shot          'tracer' | 'beam' | null
 *   range         metres; tracers despawn here, the beam stops here
 */
export const ITEMS = Object.freeze({
  'rifle-laser': {
    name: 'rifle-laser',
    label: 'Laser rifle',
    file: `${PROPS}rifle-laser.glb`,
    socket: 'RightHand',
    handed: 2,
    length: .77,
    barrelAxis: [-1, 0, 0],
    muzzle: [-0.55, 0.115, 0],
    leftGrip: [-0.29, 0.012, 0],
    aimClip: 'aim-rifle',
    fireClip: 'fire-rifle',
    aiming: 'rifle',
    fireRate: 5,
    shot: 'tracer',
    range: 4000,
    muzzleSpeed: 400,
    holsterable: true,
    tracer: { radius: 0.020, length: 1.6, color: 0xffb066, opacity: 0.95 },
    flash: { size: 0.30, color: 0xffd9a0, intensity: 6, distance: 8, seconds: 0.06 },
  },
  'sidearm-pistol': {
    name: 'sidearm-pistol',
    label: 'Energy sidearm',
    file: `${PROPS}sidearm-pistol.glb`,
    socket: 'RightHand',
    handed: 1,
    length: 0.30,
    barrelAxis: [-1, 0, 0],
    muzzle: [-0.15, 0.055, 0],
    leftGrip: null,
    aimClip: 'aim-pistol',
    fireClip: 'fire-pistol',
    aiming: 'pistol',
    fireRate: 3,
    shot: 'tracer',
    range: 4000,
    muzzleSpeed: 400,
    holsterable: true,
    tracer: { radius: 0.014, length: 1.0, color: 0xffc27a, opacity: 0.95 },
    flash: { size: 0.20, color: 0xffe0b0, intensity: 4, distance: 6, seconds: 0.06 },
  },
  'mining-laser-tool': {
    name: 'mining-laser-tool',
    label: 'Mining laser',
    file: `${PROPS}mining-laser-tool.glb`,
    socket: 'RightHand',
    handed: 2,
    length: 0.80,
    barrelAxis: [-1, 0, 0],
    muzzle: [-0.60, 0.14, 0],
    leftGrip: [-0.30, 0.01, 0],
    aimClip: 'use-tool',
    fireClip: null,                    // a continuous beam has no recoil one-shot
    aiming: 'tool',
    fireRate: 0,                       // continuous
    shot: 'beam',
    range: 60,
    holsterable: true,
    beam: { radius: 0.035, color: 0xb6efd1, impact: 0.34, opacity: 0.85 },
    heat: { rise: 0.35, cool: 0.5, lockout: 2 },
    miningRate: 0.35,                  // handed to onMine() as `rate`, m³/s at full beam
  },
  'tractor-beam-tool': {
    name: 'tractor-beam-tool', label: 'Cargo tractor', file: `${PROPS}tractor-beam-tool.glb`,
    socket: 'RightHand', handed: 2, length: .80,
    barrelAxis: [-1, 0, 0], muzzle: [-.60, .14, 0], leftGrip: [-.30, .01, 0],
    aimClip: 'use-tool', fireClip: null, aiming: 'tool',
    // Cargo owns the beam and authorization. This held model never fires/mines.
    fireRate: 0, shot: null, range: 12, holsterable: true,
  },
  'builder-tool': {
    name: 'builder-tool', label: 'Meridian field builder', file: `${PROPS}builder-tool.glb`,
    socket: 'RightHand', handed: 1, length: .28,
    barrelAxis: [-1, 0, 0], muzzle: [-.191, .076, 0], leftGrip: null,
    aimClip: 'aim-pistol', fireClip: null, aiming: 'pistol',
    // Construction owns its actions. The held device cannot fire or mine.
    fireRate: 0, shot: null, range: 12, holsterable: true,
  },
  'backpack-life-support': {
    name: 'backpack-life-support',
    label: 'Life-support pack',
    file: `${PROPS}backpack-life-support.glb`,
    socket: 'Spine2',
    handed: 0,
    length: 0.60,
    barrelAxis: null, muzzle: null, leftGrip: null,
    aimClip: null, fireClip: null, aiming: 'none',
    fireRate: 0, shot: null, range: 0, holsterable: false,
    worn: true,
  },
  'helmet-standalone': {
    name: 'helmet-standalone',
    label: 'Sealed helmet',
    file: `${PROPS}helmet-standalone.glb`,
    socket: 'Head',
    handed: 0,
    length: 0.35,
    barrelAxis: null, muzzle: null, leftGrip: null,
    aimClip: null, fireClip: null, aiming: 'none',
    fireRate: 0, shot: null, range: 0, holsterable: false,
    worn: true,
  },
});

/** Items the player holds (as opposed to wears). */
export const HELD_ITEMS = Object.freeze(
  Object.keys(ITEMS).filter((name) => !ITEMS[name].worn),
);

/** Items that are worn and can be on at the same time as a held item. */
export const WORN_ITEMS = Object.freeze(
  Object.keys(ITEMS).filter((name) => ITEMS[name].worn),
);

/**
 * Last-resort calibration, used when `equipment-sockets.json` cannot be fetched.
 * The real numbers live in that file; this only keeps the module from throwing.
 */
export const FALLBACK_SOCKETS = Object.freeze({
  bones: { RightHand: 'RightHand', LeftHand: 'LeftHand', Spine2: 'Spine2', Head: 'Head' },
  item: { position: [0, 0, 0], rotation: [0, 0, 0] },
});

const clamp = (value, min, max) => (value < min ? min : value > max ? max : value);
const finite = (value, fallback) => (Number.isFinite(value) ? value : fallback);
const DEG = Math.PI / 180;

// -------------------------------------------------------------- pure fire logic

/**
 * Semi-automatic fire-rate gate. `tryFire()` succeeds at most `rate` times a
 * second and never twice in the same frame.
 */
export class FireGate {
  /** @param {number} rate shots per second; 0 or less means "no gating". */
  constructor(rate) {
    this.rate = Math.max(0, finite(rate, 0));
    this.interval = this.rate > 0 ? 1 / this.rate : 0;
    this.cooldown = 0;
  }

  /** Advance the cooldown by `dt` seconds. */
  update(dt) {
    if (this.cooldown > 0) this.cooldown = Math.max(0, this.cooldown - Math.max(0, finite(dt, 0)));
    return this;
  }

  /** True while the gate would let a shot through right now. */
  get ready() { return this.cooldown <= 0; }

  /** Consume the gate. @returns {boolean} whether a shot actually happened. */
  tryFire() {
    if (this.cooldown > 0) return false;
    this.cooldown = this.interval;
    return true;
  }

  reset() { this.cooldown = 0; return this; }
}

/**
 * The mining laser's heat budget: heat rises while the beam is on, cools when it
 * is off, and a full bar locks the trigger out for `lockout` seconds. With the
 * shipped numbers (0.35 up, 0.5 down, 2 s lockout) the bar is exactly empty
 * again when the lockout ends.
 */
export class HeatSink {
  /** @param {{rise?:number, cool?:number, lockout?:number}} [params] */
  constructor(params = null) {
    const source = params || {};
    this.rise = finite(source.rise, 0.35);
    this.cool = finite(source.cool, 0.5);
    this.lockoutSeconds = finite(source.lockout, 2);
    this.heat = 0;
    this.overheated = false;
    this.lockout = 0;
  }

  /** True while the trigger is allowed to pull. */
  get ready() { return !this.overheated; }

  /**
   * One frame.
   * @param {number} dt seconds
   * @param {boolean} firing whether the trigger is held this frame
   * @returns {boolean} whether the beam is actually on (false while overheated)
   */
  update(dt, firing) {
    const step = Math.max(0, finite(dt, 0));
    if (this.overheated) {
      // The epsilon matters: 120 frames of 1/60 s do not sum to exactly 2 s, and
      // a 1e-16 remainder would hold the trigger shut for one more frame.
      this.lockout = Math.max(0, this.lockout - step);
      this.heat = clamp(this.heat - this.cool * step, 0, 1);
      if (this.lockout <= 1e-6) { this.lockout = 0; this.overheated = false; }
      return false;
    }
    if (firing) {
      this.heat = clamp(this.heat + this.rise * step, 0, 1);
      if (this.heat >= 1) {
        this.heat = 1;
        this.overheated = true;
        this.lockout = this.lockoutSeconds;
        return false;
      }
      return true;
    }
    this.heat = clamp(this.heat - this.cool * step, 0, 1);
    return false;
  }

  reset() { this.heat = 0; this.overheated = false; this.lockout = 0; return this; }
}

/**
 * One frame of a tracer bolt's flight. Pure, allocation free.
 *
 * @param {number} travelled metres already flown
 * @param {number} dt seconds
 * @param {number} speed metres per second
 * @param {number} distance metres to the aim point, or Infinity when there is none
 * @param {number} range metres the bolt may fly before it gives up
 * @returns {{travelled:number, done:boolean, hit:boolean}}
 *   `hit` is true only when the bolt reached a real aim point inside its range.
 */
export function advanceTracer(travelled, dt, speed, distance, range) {
  const flown = Math.max(0, finite(travelled, 0)) + Math.max(0, finite(speed, 0)) * Math.max(0, finite(dt, 0));
  const limit = Math.max(0, finite(range, 0));
  const target = Number.isFinite(distance) ? Math.max(0, distance) : Infinity;
  if (target <= limit && flown >= target) return { travelled: target, done: true, hit: true };
  if (flown >= limit) return { travelled: limit, done: true, hit: false };
  return { travelled: flown, done: false, hit: false };
}

// ---------------------------------------------------------- pure socket algebra

/**
 * The calibration entry for one rig × item.
 * @param {object} sockets parsed equipment-sockets.json
 * @param {string} rig one of RIGS
 * @param {string} item a key of ITEMS
 * @param {'hand'|'holster'} [slot='hand']
 * @returns {{bone:string, position:number[], rotation:number[], calibrated:boolean}}
 */
export function resolveSocket(sockets, rig, item, slot = 'hand') {
  const spec = ITEMS[item];
  const logical = spec ? spec.socket : 'RightHand';
  const rigs = (sockets && sockets.rigs) || null;
  const entry = rigs ? rigs[rig] : null;
  const table = entry ? (slot === 'holster' ? entry.holster : entry.items) : null;
  const offset = table ? table[item] : null;
  const boneName = slot === 'holster'
    ? boneFor(entry, 'Spine2')
    : boneFor(entry, logical);
  if (!offset) {
    return { bone: boneName, position: [0, 0, 0], rotation: [0, 0, 0], calibrated: false };
  }
  return {
    bone: offset.bone || boneName,
    position: (offset.position || [0, 0, 0]).slice(0, 3),
    rotation: (offset.rotation || [0, 0, 0]).slice(0, 3),
    calibrated: true,
  };
}

function boneFor(entry, logical) {
  const bones = entry && entry.bones;
  return (bones && bones[logical]) || FALLBACK_SOCKETS.bones[logical] || logical;
}

/**
 * The uniform scale a socket group needs so that offsets read as metres.
 * The Meshy pilots carry a 0.01 armature scale down into every bone; the
 * mannequin is 1. Returns 1 for a degenerate matrix rather than Infinity.
 * @param {THREE.Object3D} bone
 */
export function socketScale(bone) {
  if (!bone) return 1;
  bone.updateWorldMatrix(true, false);
  const e = bone.matrixWorld.elements;
  const s = Math.hypot(e[0], e[1], e[2]);
  return s > 1e-9 ? 1 / s : 1;
}

/**
 * Muzzle position and direction in the space `itemMatrixWorld` lives in.
 * Pure: writes into `outPosition` / `outDirection` and allocates nothing.
 *
 * @param {THREE.Matrix4} itemMatrixWorld the held item's world matrix
 * @param {number[]|THREE.Vector3} muzzleLocal muzzle point in the item's own space
 * @param {number[]|THREE.Vector3} barrelAxis unit barrel direction in the item's own space
 * @param {THREE.Vector3} outPosition
 * @param {THREE.Vector3} outDirection normalised
 */
export function composeMuzzle(itemMatrixWorld, muzzleLocal, barrelAxis, outPosition, outDirection) {
  read(muzzleLocal, outPosition).applyMatrix4(itemMatrixWorld);
  read(barrelAxis, outDirection).transformDirection(itemMatrixWorld);
  if (outDirection.lengthSq() < 1e-12) outDirection.set(0, 0, -1);
  return outPosition;
}

function read(source, out) {
  if (!source) return out.set(0, 0, 0);
  if (source.isVector3) return out.copy(source);
  return out.set(source[0] || 0, source[1] || 0, source[2] || 0);
}

// --------------------------------------------------------------- shared loading

/** url → Promise<GLTF>. One network fetch per item for the whole page. */
const _gltfCache = new Map();
let _sharedLoader = null;

/** The GLTFLoader every Equipment shares unless one is injected. */
export function sharedLoader() {
  if (!_sharedLoader) _sharedLoader = new GLTFLoader();
  return _sharedLoader;
}

/** Load (once) and return the raw GLTF for an item file. */
export function loadItemGLTF(url, loader = null) {
  let pending = _gltfCache.get(url);
  if (!pending) {
    const use = loader || sharedLoader();
    pending = new Promise((resolve, reject) => use.load(url, resolve, undefined, reject))
      .then(gltf => { shareHandheldTextures(gltf.scene || gltf.scenes[0]); return gltf; });
    _gltfCache.set(url, pending);
  }
  return pending;
}

let _socketsPending = null;

/** Fetch (once) and parse the calibration file. Resolves to null when it is missing. */
export function loadSocketCalibration(url = SOCKETS_URL, fetchImpl = null) {
  if (_socketsPending) return _socketsPending;
  const get = fetchImpl || (typeof fetch === 'function' ? fetch : null);
  if (!get) return Promise.resolve(null);
  _socketsPending = get(url, { cache: 'no-cache' })
    .then((response) => (response && response.ok ? response.json() : null))
    .catch((error) => {
      console.warn('[equipment] no socket calibration at', url, error?.message || error);
      return null;
    });
  return _socketsPending;
}

/** Test / hot-reload hook: forget the cached GLBs and calibration. */
export function clearEquipmentCache() {
  _gltfCache.clear();
  clearHandheldTextureCache();
  _socketsPending = null;
}

// --------------------------------------------------------------------- scratch

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _v4 = new THREE.Vector3();
// aimHeld is synchronous. Keep its scratch separate from muzzle/socket helpers
// and character-ik.js, which it calls while these values are still in use.
const _aimForward = new THREE.Vector3(), _aimDirection = new THREE.Vector3();
const _aimTarget = new THREE.Vector3(), _aimPole = new THREE.Vector3(), _aimArm = new THREE.Vector3();
const _aimBarrel = new THREE.Vector3(), _aimUp = new THREE.Vector3();
const _aimX = new THREE.Vector3(), _aimY = new THREE.Vector3(), _aimZ = new THREE.Vector3();
const _aimPalm = new THREE.Vector3(), _aimShoulder = new THREE.Vector3(), _aimElbow = new THREE.Vector3(), _aimWrist = new THREE.Vector3();
const _aimPitch = new THREE.Quaternion(), _aimGrip = new THREE.Quaternion(), _aimOffset = new THREE.Quaternion();
const _aimDelta = new THREE.Quaternion(), _aimBone = new THREE.Quaternion(), _aimIdentity = new THREE.Quaternion();
const _aimBasis = new THREE.Matrix4();
const NO_AIM_STATES = ['sit', 'climb', 'dead', 'rest'];
const _e1 = new THREE.Euler();
const _backwards = new THREE.Vector3();
const ZERO = new THREE.Vector3();
const UNIT_Z = new THREE.Vector3(0, 0, 1);
const UNIT_Y = new THREE.Vector3(0, 1, 0);

const TRACER_POOL = 24;
const FLASH_POOL = 6;

// ------------------------------------------------------------------- Equipment

/**
 * The player's gear.
 *
 *   const equipment = new Equipment(character, scene, { rig: 'mannequin', camera });
 *   equipment.equip('rifle-laser');
 *   equipment.update(dt, { aiming: true, firing, targetWorldPoint: aimPoint });
 *   character.update(dt, { ...input, aiming: equipment.aimingInput(), firing: equipment.firingInput() });
 */
export class Equipment {
  /**
   * @param {import('./character.js').Character} character
   * @param {THREE.Scene|THREE.Object3D} scene where the VFX live (world space)
   * @param {object} [options]
   * @param {'mannequin'|'player-male'|'player-female'} [options.rig='mannequin']
   * @param {THREE.Camera} [options.camera] used to billboard the muzzle flash
   * @param {object} [options.sockets] pre-parsed calibration, skips the fetch
   * @param {string} [options.socketsUrl]
   * @param {GLTFLoader} [options.loader] share a loader / inject one in tests
   * @param {Function} [options.onHit] ({item, point, distance}) when a bolt arrives
   * @param {Function} [options.onMine] ({item, point, dt, rate, heat}) each beam frame
   */
  constructor(character, scene, options = {}) {
    const {
      rig = 'mannequin',
      camera = null,
      sockets = null,
      socketsUrl = SOCKETS_URL,
      loader = null,
      onHit = null,
      onMine = null,
    } = options || {};

    this.character = character;
    this.scene = scene;
    this.rig = RIGS.indexOf(rig) === -1 ? 'mannequin' : rig;
    this.camera = camera;
    this.loader = loader;
    this.onHit = onHit;
    this.onMine = onMine;
    this.disposed = false;
    this.error = null;

    /** Parsed equipment-sockets.json, or null until it arrives. */
    this.sockets = sockets;

    this._equipped = null;                 // held item name
    this._holstered = false;
    this._worn = new Set();                // backpack / helmet
    this._items = new Map();               // name → { group, root, muzzle, spec }
    this._pending = new Map();             // name → Promise
    this._socketGroups = new Map();        // logical name → THREE.Group under the bone
    this._bonesBound = false;
    this._fpOffset = null;

    this._gate = new FireGate(0);
    this._heat = new HeatSink(ITEMS['mining-laser-tool'].heat);
    this._firePulse = false;
    this._beaming = false;
    this._elapsed = 0;
    this._renderOrigin = new THREE.Vector3();
    this._originOverride = null;

    // VFX live in their own group so they are never dragged around by a bone.
    this.vfx = new THREE.Group();
    this.vfx.name = 'equipment-vfx';
    this.vfx.matrixAutoUpdate = true;
    if (scene) scene.add(this.vfx);

    this._buildPools();

    this.readyPromise = (sockets ? Promise.resolve(sockets) : loadSocketCalibration(socketsUrl))
      .then((data) => {
        if (this.disposed) return this;
        if (data) this.sockets = data;
        this._applyAllOffsets();
        return this;
      });
  }

  // ---------------------------------------------------------------- public API

  /** The held item's name, or null. */
  get equipped() { return this._equipped; }

  /** True while the held item is slung on the back instead of in the hand. */
  get holstered() { return this._holstered; }

  /** The mining laser's heat, 0..1. */
  get heat() { return this._heat.heat; }

  /** True while the mining laser is locked out. */
  get overheated() { return this._heat.overheated; }

  /** Seconds left of the overheat lockout. */
  get lockout() { return this._heat.lockout; }

  /** True on the frames the mining beam is actually on. */
  get beaming() { return this._beaming; }

  /** Names of the worn items (backpack / helmet). Allocates; debug only. */
  get worn() { return [...this._worn]; }

  /** The item spec of whatever is held, or null. */
  get item() { return this._equipped ? ITEMS[this._equipped] : null; }

  /**
   * Put an item in the hand (or on the body, for the backpack and helmet).
   * Loading is shared and cached, so calling this repeatedly is cheap.
   * @param {string} name a key of ITEMS
   * @returns {Promise<Equipment>}
   */
  equip(name) {
    const spec = ITEMS[name];
    if (!spec) { console.warn('[equipment] unknown item', name); return Promise.resolve(this); }
    if (spec.worn) {
      this._worn.add(name);
    } else {
      if (this._equipped && this._equipped !== name) this._detach(this._equipped);
      this._equipped = name;
      this._holstered = false;
      this._gate = new FireGate(spec.fireRate);
      // Keep tool heat across slot changes; update() cools it while stowed.
    }
    return this._ensure(name).then(() => { this._attach(name); return this; });
  }

  /**
   * Take the held item away entirely (or a named worn item).
   * @param {string} [name] defaults to the held item
   */
  unequip(name = null) {
    const target = name || this._equipped;
    if (!target) return this;
    if (ITEMS[target] && ITEMS[target].worn) this._worn.delete(target);
    else if (this._equipped === target) { this._equipped = null; this._holstered = false; this._beaming = false; }
    this._detach(target);
    return this;
  }

  /**
   * Sling the held item across the back-plate (Spine2) instead of holding it.
   * @param {boolean} [stow=true] pass false to bring it back to the hand
   */
  holster(stow = true) {
    if (!this._equipped) return this;
    const spec = ITEMS[this._equipped];
    if (!spec.holsterable) return this;
    this._holstered = Boolean(stow);
    if (this._holstered) { this._beaming = false; this._hideBeam(); }
    this._attach(this._equipped);
    return this;
  }

  /** Bring a slung item back to the hand. */
  unholster() { return this.holster(false); }

  /**
   * The support hand's grip point on the held item, in the item's own space.
   * The arm IK places the palm on this point. A rig calibration can move it
   * along a vertical handle to accommodate a different glove width.
   * @returns {THREE.Vector3|null}
   */
  get leftHandTargetLocal() {
    const spec = this.item;
    if (!spec || spec.handed < 2 || !spec.leftGrip) return null;
    const calibrated = this.sockets?.rigs?.[this.rig]?.items?.[this._equipped]?.supportPosition;
    return read(calibrated || spec.leftGrip, this._leftLocal || (this._leftLocal = new THREE.Vector3()));
  }

  /** That same grip point in world metres, or null. */
  leftHandTargetWorld(out = new THREE.Vector3()) {
    const local = this.leftHandTargetLocal;
    const entry = this._equipped ? this._items.get(this._equipped) : null;
    if (!local || !entry || !entry.group.parent) return null;
    entry.group.updateWorldMatrix(true, false);
    return out.copy(local).applyMatrix4(entry.group.matrixWorld).add(this._renderOrigin);
  }

  /**
   * An extra offset applied to the held item while the camera sits at the eyes,
   * so the barrel reads well in first person. Pass null to clear it.
   *
   * Both parts are in the **item's own frame**, which is the frame that stays
   * meaningful whichever rig is holding it: -X runs down the barrel, +Y is the
   * sight side, +Z is the item's left flank. So `{ position: [0.05, -0.06, 0.1] }`
   * pulls the weapon back, down and across — the usual first-person nudge.
   *
   * @param {{position?:number[], rotation?:number[]}|null} offset metres / degrees
   */
  setFirstPersonOffset(offset) {
    if (!offset) this._fpOffset = null;
    else {
      const position = offset.position || [0, 0, 0];
      const rotation = offset.rotation || [0, 0, 0];
      this._fpOffset = {
        position: new THREE.Vector3(position[0] || 0, position[1] || 0, position[2] || 0),
        quaternion: new THREE.Quaternion().setFromEuler(
          new THREE.Euler((rotation[0] || 0) * DEG, (rotation[1] || 0) * DEG, (rotation[2] || 0) * DEG, 'XYZ'),
        ),
      };
    }
    if (this._equipped && !this._holstered) this._applyOffset(this._equipped);
    return this;
  }

  /**
   * Override the render origin. By default the character's own is used, which
   * `character.placeCameraRelative(origin)` already sets every frame.
   */
  setRenderOrigin(origin) {
    this._originOverride = origin ? (this._originOverride || new THREE.Vector3()).copy(origin) : null;
    if (origin) this._renderOrigin.copy(origin);
    return this;
  }

  /** Live calibration, for the /dev/equipment.html nudger. Offsets are metres / degrees. */
  setOffset(item, position, rotation, slot = 'hand') {
    const table = this._offsetTable(slot);
    table[item] = { position: position.slice(0, 3), rotation: rotation.slice(0, 3) };
    if (item === this._equipped || this._worn.has(item)) this._applyOffset(item);
    return this;
  }

  /** The calibration currently in force for one item. */
  getOffset(item, slot = 'hand') {
    return resolveSocket(this.sockets, this.rig, item, slot);
  }

  /** The Object3D an item's offsets are written onto (null until it has loaded). */
  itemObject(name) {
    const entry = this._items.get(name);
    return entry ? entry.group : null;
  }

  /** The whole calibration for this rig, ready to paste into the JSON file. */
  exportCalibration() {
    const entry = (this.sockets && this.sockets.rigs && this.sockets.rigs[this.rig]) || {};
    return JSON.parse(JSON.stringify({
      bones: entry.bones || FALLBACK_SOCKETS.bones,
      items: entry.items || {},
      holster: entry.holster || {},
    }));
  }

  /** The muzzle in world metres, or null when nothing is held. */
  muzzleWorldPosition(out = new THREE.Vector3()) {
    if (!this._updateMuzzle()) return null;
    return out.copy(_v1).add(this._renderOrigin);
  }

  /** The barrel direction in world space (unit), or null. */
  muzzleWorldDirection(out = new THREE.Vector3()) {
    if (!this._updateMuzzle()) return null;
    return out.copy(_v2);
  }

  /** What to feed `character.update({ aiming })`. */
  aimingInput() {
    if (!this._equipped || this._holstered) return 'none';
    return ITEMS[this._equipped].aiming || 'none';
  }

  /**
   * What to feed `character.update({ firing })` — a one-frame pulse per round so
   * character.js plays exactly one `fire-rifle` / `fire-pistol` recoil.
   */
  firingInput() { return this._firePulse; }

  /**
   * One frame.
   * @param {number} dt seconds
   * @param {{aiming?:boolean, firing?:boolean, targetWorldPoint?:THREE.Vector3}} [input]
   */
  update(dt, input = null) {
    const step = Math.max(0, finite(dt, 0));
    this._elapsed += step;
    const source = input || EMPTY;
    const origin = this._originOverride
      || (this.character && this.character._renderOrigin) || ZERO;
    this._renderOrigin.copy(origin);

    if (!this._bonesBound) this._bindBones();

    const spec = this.item;
    const held = spec && !this._holstered;
    const wantsFire = held && source.firing === true;

    this._firePulse = false;
    this._gate.update(step);

    if (held && spec.shot === 'beam') this._updateBeam(step, wantsFire, source.targetWorldPoint, source.hasHit !== false);
    else { this._beaming = false; this._heat.update(step, false); this._hideBeam(); }

    if (held && spec.shot === 'tracer' && wantsFire && this._gate.tryFire() && this._updateMuzzle() && (!source.authorizeFire || source.authorizeFire(spec.name))) {
      this._spawnTracer(spec, source.targetWorldPoint);
      this._spawnFlash(spec);
      this._firePulse = true;
    }

    this._updateTracers(step);
    this._updateFlashes(step);
    return this;
  }

  dispose() {
    this.disposed = true;
    // The item meshes are `clone(true)` of the shared GLTF cache and share its
    // geometry and original materials. Dispose only instance mining wear
    // materials/texture, then detach; shared cache resources stay alive.
    for (const name of [...this._items.keys()]) {
      this._items.get(name).root.userData.disposeMiningTexture?.();
      this._detach(name);
    }
    this._items.clear();
    for (const group of this._socketGroups.values()) if (group.parent) group.parent.remove(group);
    this._socketGroups.clear();
    if (this.vfx.parent) this.vfx.parent.remove(this.vfx);
    disposeTree(this.vfx);
    this._tracers.length = 0;
    this._flashes.length = 0;
    this._beamMesh = null;
    this._impact = null;
    this.character = null;
    this.scene = null;
  }

  // ------------------------------------------------------------------ internals

  _offsetTable(slot) {
    if (!this.sockets) this.sockets = { rigs: {} };
    if (!this.sockets.rigs) this.sockets.rigs = {};
    let entry = this.sockets.rigs[this.rig];
    if (!entry) entry = this.sockets.rigs[this.rig] = { bones: { ...FALLBACK_SOCKETS.bones }, items: {}, holster: {} };
    const key = slot === 'holster' ? 'holster' : 'items';
    if (!entry[key]) entry[key] = {};
    return entry[key];
  }

  /** Load and prepare one item's mesh group (idempotent). */
  _ensure(name) {
    if (this._items.has(name)) return Promise.resolve(this._items.get(name));
    let pending = this._pending.get(name);
    if (pending) return pending;
    const spec = ITEMS[name];
    pending = loadItemGLTF(spec.file, this.loader).then((gltf) => {
      if (this.disposed) return null;
      let entry = this._items.get(name);
      if (entry) return entry;
      const root = (gltf.scene || gltf.scenes[0]).clone(true);
      root.traverse((node) => {
        if (node.isMesh) { node.castShadow = true; node.receiveShadow = true; node.frustumCulled = false; }
      });
      if (name === 'mining-laser-tool' && !hasAuthoredHandheldFinish(root)) textureMiningTool(root);
      const group = new THREE.Group();
      group.name = `equipment-${name}`;
      group.add(root);
      const muzzle = new THREE.Object3D();
      muzzle.name = `${name}-muzzle`;
      if (spec.muzzle) {
        read(spec.muzzle, muzzle.position);
        // -Z down the barrel, the same convention lights and cameras use.
        muzzle.quaternion.setFromUnitVectors(_v1.set(0, 0, -1), read(spec.barrelAxis, _v2).normalize());
      }
      group.add(muzzle);
      entry = { group, root, muzzle, spec };
      this._items.set(name, entry);
      this._pending.delete(name);
      return entry;
    }).catch((error) => {
      this.error = `${spec.file} failed to load: ${error?.message || error}`;
      console.warn('[equipment]', this.error);
      this._pending.delete(name);
      return null;
    });
    this._pending.set(name, pending);
    return pending;
  }

  /** The rig bone behind a logical socket, wrapped in a scale-compensating group. */
  _socket(logical) {
    let group = this._socketGroups.get(logical);
    if (group && group.parent) return group;
    const bone = this._bone(logical);
    if (!bone) return null;
    if (!group) {
      group = new THREE.Group();
      group.name = `socket-${logical}`;
      this._socketGroups.set(logical, group);
    }
    group.scale.setScalar(socketScale(bone));
    bone.add(group);
    return group;
  }

  _bone(logical) {
    const entry = (this.sockets && this.sockets.rigs && this.sockets.rigs[this.rig]) || null;
    const wanted = boneFor(entry, logical);
    const skeleton = this.character && this.character.skeleton;
    const bones = skeleton ? skeleton.bones : null;
    if (!bones || !bones.length) return null;
    let found = bones.find((bone) => bone.name === wanted);
    if (!found) found = bones.find((bone) => bone.name.toLowerCase() === wanted.toLowerCase());
    if (!found) found = bones.find((bone) => bone.name.toLowerCase().endsWith(wanted.toLowerCase()));
    if (!found && logical === 'Spine2') {
      // Meshy names the chest `Spine`: the bone that owns both shoulders.
      found = bones.find((bone) => bone.children.filter((c) => /shoulder/i.test(c.name)).length >= 2);
    }
    return found || null;
  }

  /** Final pose correction after the animation mixer: keep the firing hand
   * and held barrel aimed together, then bring the support wrist to its grip. */
  aimHeld(direction) {
    if(this._holstered||!this._equipped)return;
    if(this.character?.gestureActive || NO_AIM_STATES.includes(this.character?.state))return;
    const hand=this._bone('RightHand');
    if(!hand?.parent || direction.lengthSq()<1e-8)return;
    // Pitch the shoulder and forearm together before the final wrist alignment.
    // This keeps an aimed-up rifle connected to the body instead of hinging at the wrist.
    const arm=hand.parent?.parent;
    const forward=this.character?.forwardVector?.(_aimForward);
    const pitch = forward ? _aimPitch.setFromUnitVectors(forward.normalize(), _aimDirection.copy(direction).normalize()) : _aimPitch.identity();
    if (this.rig === 'player-expedition' && arm?.isBone) {
      const target = this._equipped === 'sidearm-pistol' ? _aimTarget.set(.005, -.075, -.45)
        : ITEMS[this._equipped].aiming === 'tool' ? _aimTarget.set(-.04, -.23, -.05) : _aimTarget.set(-.025, -.075, -.135);
      target.applyQuaternion(this.character.object.quaternion)
        .applyQuaternion(pitch).add(arm.getWorldPosition(_aimArm));
      const pole = _aimPole.set(.6, -.8, .15).applyQuaternion(this.character.object.quaternion).applyQuaternion(pitch);
      solveArm(this.character, hand, target, pole);
    } else if(arm?.isBone && forward)rotateBoneWorld(this.character,arm,pitch);
    const barrel=this.muzzleWorldDirection(_aimBarrel);
    if(!barrel)return;
    let gripRotation = null;
    if (this.rig === 'player-expedition') {
      const up = _aimUp.set(0, 1, 0).applyQuaternion(this.character.object.quaternion);
      const x = _aimX.copy(direction).normalize().negate();
      const z = _aimZ.crossVectors(x, up).normalize();
      if (z.lengthSq() < 1e-8) z.set(1, 0, 0).applyQuaternion(this.character.object.quaternion);
      const y = _aimY.crossVectors(z, x).normalize();
      const gun = _aimGrip.setFromRotationMatrix(_aimBasis.makeBasis(x, y, z));
      const offset = this._items.get(this._equipped).group.quaternion;
      gripRotation = gun.multiply(_aimOffset.copy(offset).invert());
      rotateBoneWorld(this.character, hand, _aimDelta.copy(gripRotation).multiply(hand.getWorldQuaternion(_aimBone).invert()));
    } else rotateBoneWorld(this.character,hand,_aimDelta.setFromUnitVectors(barrel.normalize(),_aimDirection.copy(direction).normalize()));
    const left=this._bone('LeftHand'),target=this.leftHandTargetWorld(_aimTarget);
    if(!left||!target)return;
    target.sub(this._renderOrigin);
    // Put the palm around the vertical foregrip, with the thumb above the fingers.
    // A wrist snapped directly onto the grip leaves the glove floating past it.
    if (gripRotation) target.sub(_aimPalm.set(-.007, .107, 0).applyQuaternion(gripRotation));
    if (gripRotation) {
      const shoulder = left.parent.parent.getWorldPosition(_aimShoulder);
      const elbow = left.parent.getWorldPosition(_aimElbow);
      const reach = shoulder.distanceTo(elbow) + elbow.distanceTo(left.getWorldPosition(_aimWrist)) - .018;
      const excess = target.distanceTo(shoulder) - reach;
      if (excess > 0) {
        // Bring the whole tool closer during extreme aim/locomotion blends;
        // never stretch an arm or leave the support glove behind the grip.
        const shift = shoulder.sub(target).normalize().multiplyScalar(excess);
        const wrist = hand.getWorldPosition(_aimWrist).add(shift);
        solveArm(this.character, hand, wrist, _aimPole.set(.6, -.8, .15).applyQuaternion(this.character.object.quaternion).applyQuaternion(pitch));
        rotateBoneWorld(this.character, hand, _aimDelta.copy(gripRotation).multiply(hand.getWorldQuaternion(_aimBone).invert()));
        this.leftHandTargetWorld(target).sub(this._renderOrigin).sub(_aimPalm.set(-.007, .107, 0).applyQuaternion(gripRotation));
      }
    }
    // Solve the two arm joints only; the character root/spine stay authored.
    const pole = _aimPole.set(-.5, -.85, .15).applyQuaternion(this.character?.object?.quaternion || _aimIdentity).applyQuaternion(pitch);
    solveArm(this.character, left, target, pole);
    if (gripRotation) rotateBoneWorld(this.character, left, _aimDelta.copy(gripRotation).multiply(left.getWorldQuaternion(_aimBone).invert()));
  }

  bindCharacter(character, rig, sockets) {
    if(this.character===character&&this.rig===rig&&this.sockets===sockets)return;
    for(const group of this._socketGroups.values())group.removeFromParent();
    this._socketGroups.clear();this._bonesBound=false;
    this.character=character;this.rig=rig;this.sockets=sockets;
    this._bindBones();
  }

  /** Re-parent everything once the rig's GLB has landed (or been swapped). */
  _bindBones() {
    const skeleton = this.character && this.character.skeleton;
    if (!skeleton || !skeleton.bones.length) return false;
    this._bonesBound = true;
    this._socketGroups.clear();
    if (this._equipped) this._attach(this._equipped);
    for (const name of this._worn) this._attach(name);
    return true;
  }

  _attach(name) {
    // An older asynchronous model load may finish after a different slot was drawn.
    if(this.disposed || (ITEMS[name]?.worn ? !this._worn.has(name) : this._equipped!==name))return;
    const entry = this._items.get(name);
    if (!entry) return;
    const spec = ITEMS[name];
    const holstered = !spec.worn && this._holstered && this._equipped === name;
    const logical = holstered ? 'Spine2' : spec.socket;
    const socket = this._socket(logical);
    if (!socket) return;
    if (entry.group.parent !== socket) socket.add(entry.group);
    this._applyOffset(name);
  }

  _detach(name) {
    const entry = this._items.get(name);
    if (entry && entry.group.parent) entry.group.parent.remove(entry.group);
  }

  _applyAllOffsets() {
    if (this._equipped) this._applyOffset(this._equipped);
    for (const name of this._worn) this._applyOffset(name);
  }

  _applyOffset(name) {
    const entry = this._items.get(name);
    if (!entry) return;
    const spec = ITEMS[name];
    const holstered = !spec.worn && this._holstered && this._equipped === name;
    const offset = resolveSocket(this.sockets, this.rig, name, holstered ? 'holster' : 'hand');
    entry.group.position.set(offset.position[0], offset.position[1], offset.position[2]);
    _e1.set(offset.rotation[0] * DEG, offset.rotation[1] * DEG, offset.rotation[2] * DEG, 'XYZ');
    entry.group.quaternion.setFromEuler(_e1);
    if (this._fpOffset && !holstered && !spec.worn && name === this._equipped) {
      // In the item's own frame: rotate the shove by the socket orientation first.
      entry.group.position.add(_v3.copy(this._fpOffset.position).applyQuaternion(entry.group.quaternion));
      entry.group.quaternion.multiply(this._fpOffset.quaternion);
    }
    entry.group.updateMatrix();
  }

  /** Fills `_v1` with the muzzle in render space and `_v2` with its direction. */
  _updateMuzzle() {
    const entry = this._equipped ? this._items.get(this._equipped) : null;
    if (!entry || this._holstered || !entry.group.parent || !entry.spec.muzzle) return false;
    entry.group.updateWorldMatrix(true, false);
    composeMuzzle(entry.group.matrixWorld, entry.spec.muzzle, entry.spec.barrelAxis, _v1, _v2);
    _v2.normalize();
    return true;
  }

  // ------------------------------------------------------------------- the VFX

  _buildPools() {
    // --- tracer bolts: a unit cylinder along +Z, scaled to length each frame.
    const bolt = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true);
    bolt.rotateX(Math.PI / 2);
    bolt.translate(0, 0, -0.5);                     // the bolt trails behind its nose
    this._boltGeometry = bolt;
    this._tracers = [];
    for (let i = 0; i < TRACER_POOL; i++) {
      const material = new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending,
        depthWrite: false, toneMapped: false, side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(bolt, material);
      mesh.visible = false;
      mesh.frustumCulled = false;
      mesh.matrixAutoUpdate = true;
      this.vfx.add(mesh);
      this._tracers.push({
        mesh, material, active: false, item: null,
        world: new THREE.Vector3(), direction: new THREE.Vector3(),
        travelled: 0, distance: Infinity, range: 0, speed: 400,
      });
    }

    // --- muzzle flashes: one additive quad plus a short-lived point light.
    const quad = new THREE.PlaneGeometry(1, 1);
    this._quadGeometry = quad;
    this._flashes = [];
    for (let i = 0; i < FLASH_POOL; i++) {
      // A quad with a radial core and a four-point star burned into the alpha —
      // cheaper than a texture and it stays sharp at any size.
      const material = new THREE.ShaderMaterial({
        uniforms: { uColor: { value: new THREE.Color(0xffd9a0) }, uOpacity: { value: 1 } },
        vertexShader: FLASH_VERT,
        fragmentShader: FLASH_FRAG,
        transparent: true, blending: THREE.AdditiveBlending,
        depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
      });
      const mesh = new THREE.Mesh(quad, material);
      mesh.visible = false;
      mesh.frustumCulled = false;
      const light = new THREE.PointLight(0xffd9a0, 0, 8, 2);
      light.visible = false;
      this.vfx.add(mesh, light);
      this._flashes.push({
        mesh, material, light, active: false, ttl: 0, life: 0.06,
        world: new THREE.Vector3(), size: 0.3, intensity: 5,
      });
    }

    // --- the mining beam: one cylinder with a noisy alpha ramp + an impact disc.
    const beamGeometry = new THREE.CylinderGeometry(1, 1, 1, 12, 1, true);
    beamGeometry.rotateX(Math.PI / 2);
    beamGeometry.translate(0, 0, 0.5);              // grows from z=0 to z=1
    this._beamGeometry = beamGeometry;
    this._beamMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(ITEMS['mining-laser-tool'].beam.color) },
        uTime: { value: 0 },
        uLength: { value: 1 },
        uOpacity: { value: ITEMS['mining-laser-tool'].beam.opacity },
      },
      vertexShader: BEAM_VERT,
      fragmentShader: BEAM_FRAG,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    this._beamMesh = new THREE.Mesh(beamGeometry, this._beamMaterial);
    this._beamMesh.visible = false;
    this._beamMesh.frustumCulled = false;
    this.vfx.add(this._beamMesh);

    const disc = new THREE.CircleGeometry(1, 24);
    this._discGeometry = disc;
    this._impactMaterial = new THREE.MeshBasicMaterial({
      color: ITEMS['mining-laser-tool'].beam.color, transparent: true, opacity: 0.8,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide,
    });
    this._impact = new THREE.Mesh(disc, this._impactMaterial);
    this._impact.visible = false;
    this._impact.frustumCulled = false;
    this.vfx.add(this._impact);
    this._impactLight = new THREE.PointLight(ITEMS['mining-laser-tool'].beam.color, 0, 6, 2);
    this._impactLight.visible = false;
    this.vfx.add(this._impactLight);
  }

  _spawnTracer(spec, targetWorldPoint) {
    let slot = null;
    for (let i = 0; i < this._tracers.length; i++) if (!this._tracers[i].active) { slot = this._tracers[i]; break; }
    if (!slot) slot = this._tracers[0];                 // oldest wins; the pool never grows
    slot.active = true;
    slot.item = spec.name;
    slot.world.copy(_v1).add(this._renderOrigin);
    slot.travelled = 0;
    slot.range = spec.range;
    slot.speed = spec.muzzleSpeed;
    if (targetWorldPoint) {
      slot.direction.copy(targetWorldPoint).sub(slot.world);
      slot.distance = slot.direction.length();
      if (slot.distance < 1e-4) { slot.direction.copy(_v2); slot.distance = Infinity; }
      else slot.direction.multiplyScalar(1 / slot.distance);
    } else {
      slot.direction.copy(_v2);
      slot.distance = Infinity;
    }
    slot.material.color.set(spec.tracer.color);
    slot.material.opacity = spec.tracer.opacity;
    slot.mesh.scale.set(spec.tracer.radius, spec.tracer.radius, spec.tracer.length);
    slot.mesh.quaternion.setFromUnitVectors(UNIT_Z, slot.direction);
    slot.mesh.position.copy(slot.world).sub(this._renderOrigin);
    slot.mesh.visible = true;
  }

  _updateTracers(dt) {
    const origin = this._renderOrigin;
    for (let i = 0; i < this._tracers.length; i++) {
      const bolt = this._tracers[i];
      if (!bolt.active) continue;
      const step = advanceTracer(bolt.travelled, dt, bolt.speed, bolt.distance, bolt.range);
      bolt.travelled = step.travelled;
      // Positioned from the muzzle it left each frame rather than integrated, so a
      // shifting render origin can never make the bolt drift off its own line.
      bolt.mesh.position.copy(bolt.world).addScaledVector(bolt.direction, step.travelled).sub(origin);
      if (!step.done) continue;
      bolt.active = false;
      bolt.mesh.visible = false;
      if (step.hit && this.onHit) {
        _v4.copy(bolt.world).addScaledVector(bolt.direction, step.travelled);
        this.onHit({ item: bolt.item, point: _v4, distance: step.travelled });
      }
    }
  }

  _spawnFlash(spec) {
    let slot = null;
    for (let i = 0; i < this._flashes.length; i++) if (!this._flashes[i].active) { slot = this._flashes[i]; break; }
    if (!slot) slot = this._flashes[0];
    slot.active = true;
    slot.life = spec.flash.seconds;
    slot.ttl = spec.flash.seconds;
    slot.size = spec.flash.size;
    slot.intensity = spec.flash.intensity;
    slot.world.copy(_v1).add(this._renderOrigin);
    slot.material.uniforms.uColor.value.set(spec.flash.color);
    slot.light.color.set(spec.flash.color);
    slot.light.distance = spec.flash.distance;
    slot.mesh.visible = true;
    slot.light.visible = true;
    // No camera? Lay the quad along the barrel so it reads from the side.
    if (this.camera) slot.mesh.quaternion.copy(this.camera.quaternion);
    else {
      _backwards.crossVectors(_v2, UNIT_Y);
      if (_backwards.lengthSq() < 1e-8) _backwards.set(1, 0, 0);
      slot.mesh.quaternion.setFromUnitVectors(UNIT_Z, _backwards.normalize());
    }
  }

  _updateFlashes(dt) {
    const origin = this._renderOrigin;
    for (let i = 0; i < this._flashes.length; i++) {
      const flash = this._flashes[i];
      if (!flash.active) continue;
      flash.ttl -= dt;
      if (flash.ttl <= 0) {
        flash.active = false;
        flash.mesh.visible = false;
        flash.light.visible = false;
        flash.light.intensity = 0;
        continue;
      }
      const t = flash.ttl / flash.life;                 // 1 → 0
      const scale = flash.size * (0.55 + 0.45 * t);
      flash.mesh.position.copy(flash.world).sub(origin);
      flash.mesh.scale.set(scale, scale, scale);
      flash.material.uniforms.uOpacity.value = t;
      if (this.camera) flash.mesh.quaternion.copy(this.camera.quaternion);
      flash.light.position.copy(flash.mesh.position);
      flash.light.intensity = flash.intensity * t;
    }
  }

  _updateBeam(dt, wantsFire, targetWorldPoint, hasHit = true) {
    const spec = this.item;
    const on = this._heat.update(dt, wantsFire) && this._updateMuzzle();
    this._beaming = on;
    if (!on) { this._hideBeam(); return; }

    // _v1 muzzle (render space), _v2 barrel direction.
    let length = spec.range;
    if (targetWorldPoint) {
      _v3.copy(targetWorldPoint).sub(this._renderOrigin).sub(_v1);
      const reach = _v3.length();
      if (reach < 1e-3) { this._hideBeam(); return; }
      length = Math.min(reach, spec.range);
      _v3.multiplyScalar(1 / reach);
    } else {
      _v3.copy(_v2);
    }

    this._beamMesh.visible = true;
    this._beamMesh.position.copy(_v1);
    this._beamMesh.quaternion.setFromUnitVectors(UNIT_Z, _v3);
    this._beamMesh.scale.set(spec.beam.radius, spec.beam.radius, length);
    this._beamMaterial.uniforms.uTime.value = this._elapsed;
    this._beamMaterial.uniforms.uLength.value = length;
    this._beamMaterial.uniforms.uOpacity.value = spec.beam.opacity * (0.75 + 0.25 * (1 - this._heat.heat));

    _v4.copy(_v1).addScaledVector(_v3, length);
    const pulse = spec.beam.impact * (0.85 + 0.15 * Math.sin(this._elapsed * 37));
    this._impact.visible = hasHit;
    this._impact.position.copy(_v4).addScaledVector(_v3, -0.02);
    this._impact.quaternion.setFromUnitVectors(UNIT_Z, _backwards.copy(_v3).negate());
    this._impact.scale.setScalar(pulse);
    this._impactLight.visible = hasHit;
    this._impactLight.position.copy(_v4);
    this._impactLight.intensity = 3.5 * (0.85 + 0.15 * Math.sin(this._elapsed * 23));

    if (this.onMine && hasHit) {
      _v4.add(this._renderOrigin);
      this.onMine({ item: spec.name, point: _v4, dt, rate: spec.miningRate, heat: this._heat.heat });
    }
  }

  _hideBeam() {
    if (!this._beamMesh) return;
    this._beamMesh.visible = false;
    this._impact.visible = false;
    this._impactLight.visible = false;
    this._impactLight.intensity = 0;
  }
}

const EMPTY = Object.freeze({});

// ---------------------------------------------------------------- the VFX shaders

const FLASH_VERT = /* glsl */`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FLASH_FRAG = /* glsl */`
  precision highp float;
  varying vec2 vUv;
  uniform vec3 uColor;
  uniform float uOpacity;
  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    float r = clamp(length(p), 0.0, 1.0);
    float core = pow(1.0 - r, 2.4);
    // Four-point star: bright along both axes, cut off at the quad's edge.
    float star = pow(max(0.0, 1.0 - min(abs(p.x), abs(p.y)) * 7.0), 3.0) * (1.0 - r);
    float alpha = uOpacity * clamp(core * 1.6 + star * 0.8, 0.0, 1.4);
    vec3 colour = mix(uColor, vec3(1.0), pow(core, 1.5));
    gl_FragColor = vec4(colour * 2.0, alpha);
    #include <logdepthbuf_fragment>
  }
`;

const BEAM_VERT = /* glsl */`
  #include <common>
  #include <logdepthbuf_pars_vertex>
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    #include <logdepthbuf_vertex>
  }
`;

// A mint core with a noisy, scrolling alpha along the beam plus a soft edge
// falloff across it, so the beam flickers like a plasma cutter instead of a tube.
const BEAM_FRAG = /* glsl */`
  #include <common>
  #include <logdepthbuf_pars_fragment>
  precision highp float;
  varying vec2 vUv;
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uLength;
  uniform float uOpacity;

  float hash(float n) { return fract(sin(n) * 43758.5453123); }
  float noise(float x) {
    float i = floor(x), f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(hash(i), hash(i + 1.0), f);
  }
  float fbm(float x) {
    return 0.55 * noise(x) + 0.30 * noise(x * 2.3 + 11.0) + 0.15 * noise(x * 5.1 + 31.0);
  }

  void main() {
    float along = vUv.y * uLength;
    float flicker = 0.62 + 0.38 * fbm(along * 3.0 - uTime * 9.0);
    // Bright at the emitter, tapering slightly toward the impact point.
    float taper = mix(1.0, 0.72, clamp(vUv.y, 0.0, 1.0));
    // Across the beam: a hot core with soft shoulders (uv.x wraps the cylinder).
    float across = abs(sin(vUv.x * 3.14159265));
    float body = pow(across, 0.35);
    float alpha = uOpacity * flicker * taper * body;
    vec3 colour = mix(uColor, vec3(1.0), 0.55 * pow(across, 3.0));
    gl_FragColor = vec4(colour * 2.0, alpha);
    #include <logdepthbuf_fragment>
  }
`;

// -------------------------------------------------------------------- internals

function disposeTree(root) {
  if (!root) return;
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
 * Wiring for Astra (main.js) — HANDOFF request 17/18 follow-up, ROADMAP Phase 4
 * (weapons) and Phase 6 (mining laser). Test bench: /dev/equipment.html.
 *
 * 1. CONSTRUCT, right after the Character:
 *
 *      import { Equipment, ITEMS } from './equipment.js';
 *      const equipment = new Equipment(character, scene, {
 *        rig: 'mannequin',                 // 'player-male' | 'player-female' when you swap the GLB
 *        camera,                           // billboards the muzzle flash
 *        onHit:  ({ point, distance }) => impact.spawn(point, distance),
 *        onMine: ({ point, dt, rate })  => ore.carve(point, rate * dt),
 *      });
 *      equipment.equip('backpack-life-support');
 *      const aimPoint = new THREE.Vector3();
 *
 * 2. PER FRAME, in frame() just before `character.update(dt, input)`:
 *
 *      // Where the shot goes: the camera ray, 250 m out (or your raycast hit).
 *      aimPoint.set(0, 0, -250).applyQuaternion(camera.quaternion).add(origin);
 *      equipment.update(dt, { aiming: aiming, firing: firing, targetWorldPoint: aimPoint });
 *      character.update(dt, {
 *        ...movementInput,
 *        aiming: equipment.aimingInput(),   // 'rifle' | 'pistol' | 'none'
 *        firing: equipment.firingInput(),   // a one-frame pulse per round
 *      });
 *      character.placeCameraRelative(origin);   // as today; equipment follows it
 *
 * 3. KEYS (suggested, next to the existing 1/2/3 aim keys of the dev bench):
 *
 *      case 'Digit1': equipment.equip('rifle-laser'); break;
 *      case 'Digit2': equipment.equip('sidearm-pistol'); break;
 *      case 'Digit3': equipment.equip('mining-laser-tool'); break;
 *      case 'KeyR':   equipment.holster(!equipment.holstered); break;
 *      // mouse1 held → `firing`; the rifle/pistol respect their own fire rate,
 *      // the mining laser beams until `equipment.overheated` (see equipment.heat
 *      // for the HUD bar, 0..1, and equipment.lockout for the 2 s cool-down).
 *
 * 4. FIRST PERSON: keep the item visible (the player wants to see the barrel) and
 *    nudge it out of the near plane:
 *
 *      characterCamera.blendTo('first', 0.9);
 *      equipment.setFirstPersonOffset({ position: [0, -0.02, 0.06], rotation: [0, 0, 0] });
 *      // …and equipment.setFirstPersonOffset(null) on the way back to third person.
 * ------------------------------------------------------------------------- */
