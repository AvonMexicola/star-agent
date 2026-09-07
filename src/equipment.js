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
