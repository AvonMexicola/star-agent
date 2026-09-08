/** Remote visuals only. All poses stay in double precision until camera-relative
 * placement; this module never decides damage, movement authority or suit colors. */
import * as THREE from 'three';
import { rotationFrameAt } from '../planet-rotation.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { Character } from '../character.js';
import { PLAYER_AVATAR } from '../player-avatar.js';
import { Equipment, HELD_ITEMS } from '../equipment.js';
import { SHIP_LAYOUT } from '../boarding.js';
import { FREIGHTER_LAYOUT, FreighterSystems } from '../freighter-layout.js';
import { ATLAS_MODEL_URL } from '../atlas-gameplay.js';
import { BODIES } from '../celestial.js';
import { SUIT_COLORS } from './protocol.js';

export const PLAYER_COLORS = SUIT_COLORS;
export const SHIP_URLS = Object.freeze({ nomad: '/models/nomad.glb', atlas: `/${ATLAS_MODEL_URL}` });
const FORWARD = new THREE.Vector3(0, 0, -1);
const UP = new THREE.Vector3(0, 1, 0);
const NO_FIRE = Object.freeze({ firing: false });

/** SkeletonUtils is essential: Object3D.clone shares the original skin bones. */
export function cloneCharacterGLTF(gltf) {
  const scene = cloneSkeleton(gltf.scene || gltf.scenes[0]);
  const materials = new Map();
  scene.traverse(node => {
    if (!node.material) return;
    const own = material => {
      if (!materials.has(material)) materials.set(material, material.clone());
      return materials.get(material);
    };
    node.material = Array.isArray(node.material) ? node.material.map(own) : own(node.material);
  });
  // Required clips and optional shadow indices belong to the parsed template.
  // Keep their metadata/loader while skeletons and suit materials stay private.
  return { scene, scenes: [scene], animations: gltf.animations || [], asset: gltf.asset, parser: gltf.parser };
}

/** The current pilot is a single textured mesh. A skin-weight mask leaves the
 * head, neck and bare hands unchanged, including when those bones animate.
 * Geometry is shared and this immutable attribute is computed once per asset. */
export function tintCharacterSuit(model, color) {
  model.traverse(node => {
    if (!node.isSkinnedMesh) return;
    const geometry = node.geometry;
    if (!geometry.getAttribute('remoteSuitMask')) {
      const indices = geometry.getAttribute('skinIndex');
      const weights = geometry.getAttribute('skinWeight');
      if (!indices || !weights) return;
      const excluded = node.skeleton.bones.map(bone => /head|neck|hand|thumb|index|middle|ring|pinky/i.test(bone.name));
      const mask = new Float32Array(indices.count);
      for (let i = 0; i < mask.length; i++) {
        let bare = 0;
        for (let j = 0; j < 4; j++) if (excluded[indices.getComponent(i, j)]) bare += weights.getComponent(i, j);
        // Preserve wrists and collars across partially blended skin weights.
        mask[i] = 1 - THREE.MathUtils.smoothstep(bare, .05, .65);
      }
      geometry.setAttribute('remoteSuitMask', new THREE.BufferAttribute(mask, 1));
    }
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      const suitColor = material.userData.remoteSuitColor?.isColor ? material.userData.remoteSuitColor : new THREE.Color();
      suitColor.set(color);
      material.userData.remoteSuitColor = suitColor;
      material.onBeforeCompile = shader => {
        shader.uniforms.remoteSuitColor = { value: suitColor };
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', '#include <common>\nattribute float remoteSuitMask; varying float vRemoteSuitMask;')
          .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRemoteSuitMask = remoteSuitMask;');
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', '#include <common>\nuniform vec3 remoteSuitColor; varying float vRemoteSuitMask;')
          .replace('#include <map_fragment>', `#include <map_fragment>
            float suitLight = dot(diffuseColor.rgb, vec3(.2126, .7152, .0722));
            diffuseColor.rgb = mix(diffuseColor.rgb, remoteSuitColor * sqrt(max(suitLight, 0.0)), vRemoteSuitMask);`)
          // The shipped pilot repeats its albedo as full-strength emission.
          // Mask that contribution too, otherwise white armor washes out color.
          .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
            float suitEmission = dot(totalEmissiveRadiance, vec3(.2126, .7152, .0722));
            totalEmissiveRadiance = mix(totalEmissiveRadiance, remoteSuitColor * suitEmission, vRemoteSuitMask);`);
      };
      material.customProgramCacheKey = () => 'remote-suit-v2';
      material.needsUpdate = true;
    }
  });
}

/** Local and remote callers can share server color assignment without mutating
 * any cached or other player's material. Safe before the character GLB loads. */
export function applySuitColor(character, color) {
  const apply = () => {
    if (character.disposed || !character.model) return character;
    if (!character.model.userData.remoteMaterialsOwned) {
      const materials = new Map();
      character.model.traverse(node => {
        if (!node.material) return;
        const own = material => {
          if (!materials.has(material)) materials.set(material, material.clone());
          return materials.get(material);
        };
        node.material = Array.isArray(node.material) ? node.material.map(own) : own(node.material);
      });
      character.model.userData.remoteMaterialsOwned = true;
    }
    tintCharacterSuit(character.model, color);
    return character;
  };
  return character.ready ? Promise.resolve(apply()) : character.readyPromise.then(apply);
}

/** Keep a two-handed item's support grip physically reachable before the final
 * aim pass. The authored aim clip plus hand calibration can otherwise put that
 * grip beyond the left arm's full extension (especially the long cutter).
 * Only arm rotations change; bone lengths and the calibrated hand socket stay. */
export function poseHeldEquipment(character, equipment, direction, origin) {
  equipment.aimHeld(direction);
  // Expedition calibration already solves both palms and the reachable grip.
  // The old wrist-only correction would move its glove past the foregrip.
  if (equipment.rig === PLAYER_AVATAR.rig) return;
  if (!equipment.leftHandTargetLocal || !character.skeleton) return;
  const right = character.skeleton.bones.find(b => /RightHand$/i.test(b.name));
  const left = character.skeleton.bones.find(b => /LeftHand$/i.test(b.name));
  if (!right?.parent?.parent || !left?.parent?.parent) return;
  const shoulder = left.parent.parent;
  const leftWrist = left.getWorldPosition(new THREE.Vector3());
  const elbow = left.parent.getWorldPosition(new THREE.Vector3());
  const shoulderPoint = shoulder.getWorldPosition(new THREE.Vector3());
  const reach = (leftWrist.distanceTo(elbow) + elbow.distanceTo(shoulderPoint)) * .9;
  for (let pass = 0; pass < 4; pass++) {
    const grip = equipment.leftHandTargetWorld();
    if (!grip) return;
    grip.sub(origin);
    shoulder.getWorldPosition(shoulderPoint);
    if (grip.distanceTo(shoulderPoint) <= reach) break;
    const attainable = grip.clone().sub(shoulderPoint).setLength(reach).add(shoulderPoint);
    const wristTarget = right.getWorldPosition(new THREE.Vector3()).add(attainable.sub(grip));
    moveArmWrist(right, wristTarget, 12);
    equipment.aimHeld(direction);
  }
  const target = equipment.leftHandTargetWorld();
  if (target) moveArmWrist(left, target.sub(origin), 18);
}

function moveArmWrist(wrist, target, passes) {
  const joints = [wrist.parent, wrist.parent?.parent].filter(b => b?.isBone && /arm/i.test(b.name));
  const pivot = new THREE.Vector3(), from = new THREE.Vector3(), to = new THREE.Vector3();
  const parent = new THREE.Quaternion(), delta = new THREE.Quaternion();
  for (let pass = 0; pass < passes; pass++) for (const joint of joints) {
    joint.getWorldPosition(pivot);
    wrist.getWorldPosition(from).sub(pivot);
    to.copy(target).sub(pivot);
    if (from.lengthSq() < 1e-10 || to.lengthSq() < 1e-10) continue;
    delta.setFromUnitVectors(from.normalize(), to.normalize());
    joint.parent.getWorldQuaternion(parent);
    delta.premultiply(parent.clone().invert()).multiply(parent);
    joint.quaternion.premultiply(delta);
    joint.updateWorldMatrix(false, true);
  }
}

function releaseClone(model, materialsOwned) {
  const materials = new Set(), skeletons = new Set();
  model?.traverse(node => {
    if (node.skeleton) skeletons.add(node.skeleton);
    if (materialsOwned && node.material) for (const m of Array.isArray(node.material) ? node.material : [node.material]) materials.add(m);
  });
  for (const skeleton of skeletons) skeleton.dispose();
  for (const material of materials) material.dispose();
  model?.removeFromParent();
}

function disposeAsset(gltf) {
  const geometry = new Set(), materials = new Set(), textures = new Set();
  (gltf.scene || gltf.scenes[0]).traverse(node => {
    if (node.geometry) geometry.add(node.geometry);
    if (node.material) for (const m of Array.isArray(node.material) ? node.material : [node.material]) materials.add(m);
  });
  for (const m of materials) for (const value of Object.values(m)) if (value?.isTexture) textures.add(value);
  for (const resource of [...geometry, ...materials, ...textures]) resource.dispose();
}

/** Constructor options are injection seams for non-WebGL tests. Colors are
 * assigned by the server; there is deliberately no color-picker API. */
export class RemotePlayers {
  constructor(scene, { palette = PLAYER_COLORS, loader = new GLTFLoader(), sockets = null, eyeHeight = SHIP_LAYOUT.eyeHeight } = {}) {
    this.scene = scene;
    this.palette = palette;
    this.loader = loader;
    this.sockets = sockets;
    this.eyeHeight = eyeHeight;
    this.peers = new Map();
    this.assets = new Map();
    this._disposedAssets = new WeakSet();
    this.disposed = false;
    this._origin = new THREE.Vector3();
    this._feet = new THREE.Vector3();
    this._up = new THREE.Vector3();
    this._direction = new THREE.Vector3();
    this._shipOffset = new THREE.Vector3();
    this._bodyRotation = new THREE.Quaternion();
    this._bodyForward = new THREE.Vector3();
    this._matrix = new THREE.Matrix4();
    this._zero = new THREE.Vector3();
  }

  _releaseAsset(gltf) {
    if (this._disposedAssets.has(gltf)) return;
    this._disposedAssets.add(gltf);
    disposeAsset(gltf);
  }

  _asset(url) {
    if (!this.assets.has(url)) {
      const pending = new Promise((resolve, reject) => this.loader.load(url, resolve, undefined, reject));
      this.assets.set(url, pending);
      // The manager owns character/ship templates, including late completions.
      pending.then(gltf => { if (this.disposed) this._releaseAsset(gltf); }, () => {});
    }
    return this.assets.get(url);
  }

  _create(peer) {
    const entry = {
      peer, position: new THREE.Vector3().fromArray(peer.position),
      orientation: new THREE.Quaternion().fromArray(peer.orientation),
      target: new THREE.Vector3().fromArray(peer.position),
      targetOrientation: new THREE.Quaternion().fromArray(peer.orientation),
      shipPosition: new THREE.Vector3(), shipTarget: new THREE.Vector3(),
      shipOrientation: new THREE.Quaternion(), shipTargetOrientation: new THREE.Quaternion(),
      ship: new THREE.Group(), shipId: null, shipModel: null, shipToken: 0, gears: [], atlasSystems: null, atlasNodes: [],
      body: null, physicsUp: new THREE.Vector3(), hasPhysicsUp: false,
      animationInput: { speed: 0, grounded: true, health: 1, dead: false, aiming: 'none', firing: false },
      gearScale: 1,
      firePulse: false, disposed: false,
    };
    entry.character = new Character(this.scene, {
      url: PLAYER_AVATAR.url, modelYaw: PLAYER_AVATAR.modelYaw, eyeHeight: this.eyeHeight,
      loader: { load: (url, ready, progress, error) => this._asset(url).then(gltf => {
        if (this.disposed || entry.disposed) return;
        ready(cloneCharacterGLTF(gltf));
      }, error) },
      onReady: character => tintCharacterSuit(character.model, this.palette[entry.peer.colorIndex] || this.palette[0]),
    });
    entry.character.object.name = `remote-player-${peer.id}`;
    entry.character.object.userData.playerId = peer.id;
    entry.equipment = new Equipment(entry.character, this.scene, { rig: PLAYER_AVATAR.rig, sockets: this.sockets, loader: this.loader });
    entry.equipment.vfx.visible = false;
    entry.ship.name = `remote-ship-${peer.id}`;
    this.scene.add(entry.ship);
    this._setShipTarget(entry, true);
    return entry;
  }

  _setShipTarget(entry, snap = false) {
    const peer = entry.peer;
    const shipId = peer.shipId === 'atlas' ? 'atlas' : 'nomad';
    entry.shipTargetOrientation.fromArray(peer.shipOrientation || peer.orientation);
    if (peer.shipPosition) entry.shipTarget.fromArray(peer.shipPosition);
    else {
      const layout = shipId === 'atlas' ? FREIGHTER_LAYOUT : SHIP_LAYOUT;
      entry.shipTarget.fromArray(peer.position).sub(this._shipOffset.fromArray(layout.seatEye).applyQuaternion(entry.shipTargetOrientation));
    }
    if (snap || entry.shipPosition.distanceToSquared(entry.shipTarget) > 1e6) {
      entry.shipPosition.copy(entry.shipTarget);
      entry.shipOrientation.copy(entry.shipTargetOrientation);
    }
    if (shipId === entry.shipId) return;
    entry.shipId = shipId;
    releaseClone(entry.shipModel, false);
    entry.shipModel = null;
    entry.gears = [];
    entry.atlasSystems = null;entry.atlasNodes = [];
    const token = ++entry.shipToken;
    entry.ship.userData.assetStatus = 'loading';
    this._asset(SHIP_URLS[shipId]).then(gltf => {
      if (entry.disposed || this.disposed || token !== entry.shipToken) return;
      entry.shipModel = gltf.scene.clone(true);
      entry.shipModel.traverse(node => {
        if (node.isMesh) { node.castShadow = true; node.receiveShadow = true; }
        if (!node.isMesh && node.name.startsWith('LandingGear_')) entry.gears.push(node);
        // These visual-only hulls have no animation mixer. Their authored local
        // transforms stay fixed; moving gear explicitly refreshes its matrix.
        // World matrices still follow the interpolated, camera-relative parent.
        if (node.matrixAutoUpdate) node.updateMatrix();
        node.matrixAutoUpdate = false;
      });
      if (shipId === 'atlas') {
        const systems = entry.atlasSystems = new FreighterSystems();
        systems.bind(entry.shipModel);
        // Only actuators change their local matrices; the rest of the authored
        // hull keeps the checked static transform cache used by remote ships.
        const moving = [systems.elevator.nodeObject, ...systems.gates.map(g => g.nodeObject),
          ...systems.ramps.flatMap(r => [r.nodeObject, r.tipNodeObject, r.sealNodeObject]),
          ...systems.gear.legs.flatMap(l => [l.nodeObject, l.footObject, ...l.doors.map(d => d.nodeObject)])];
        entry.atlasNodes = moving.filter(Boolean);
        this._applyAtlas(entry);
      }
      entry.ship.add(entry.shipModel);
      entry.ship.userData.assetStatus = 'ready';
    }).catch(error => {
      if (entry.disposed || token !== entry.shipToken) return;
      entry.ship.userData.assetStatus = 'error';
      entry.ship.userData.assetError = String(error?.message || error);
    });
  }

  _applyAtlas(entry) {
    if (!entry.atlasSystems) return;
    for (const node of entry.atlasNodes) node.matrixAutoUpdate = true;
    entry.atlasSystems.applySnapshot(entry.peer.freighter);
    entry.atlasSystems.setGear(entry.peer.gearProgress ?? 1,
      entry.peer.gearDeployed ?? (entry.peer.gearProgress ?? 1) >= .5);
    entry.atlasSystems.applyTransforms();
    for (const node of entry.atlasNodes) node.matrixAutoUpdate = false;
  }

  /** Replace the full public peer snapshot (including self is fine). */
  sync(peers, ownId) {
    if (this.disposed) return;
    const present = new Set();
    for (const peer of peers) {
      if (peer.id === ownId || present.has(peer.id) || present.size >= 9) continue;
      present.add(peer.id);
      let entry = this.peers.get(peer.id);
      if (!entry) { entry = this._create(peer); this.peers.set(peer.id, entry); }
      const changedColor = entry.peer.colorIndex !== peer.colorIndex;
      const changedMode = entry.peer.mode !== peer.mode;
      const changedFrame = entry.peer.physicsFrame !== peer.physicsFrame || entry.peer.planetFrame !== peer.planetFrame;
      entry.peer = peer;
      entry.body = BODIES.find(body => body.id === peer.body);
      entry.hasPhysicsUp = Boolean(peer.physicsFrame && Array.isArray(peer.physicsUp)
        && peer.physicsUp.length === 3 && peer.physicsUp.every(Number.isFinite));
      if (entry.hasPhysicsUp) entry.physicsUp.fromArray(peer.physicsUp).normalize();
      const animation = entry.animationInput;
      animation.speed = peer.mode === 'eva' ? 0 : Math.hypot(...(peer.velocity || [0, 0, 0]));
      animation.health = peer.health / 100;
      animation.dead = peer.mode === 'dead';
      const gear = THREE.MathUtils.clamp(peer.gearProgress ?? 1, 0, 1);
      const eased = gear * gear * (3 - 2 * gear);
      entry.gearScale = .08 + .92 * eased;
      entry.target.fromArray(peer.position);
      entry.targetOrientation.fromArray(peer.orientation);
      if (changedMode || changedFrame || entry.position.distanceToSquared(entry.target) > 1e6) {
        entry.position.copy(entry.target);
        entry.orientation.copy(entry.targetOrientation);
      }
      if (changedColor && entry.character.model) tintCharacterSuit(entry.character.model, this.palette[peer.colorIndex] || this.palette[0]);
      this._setShipTarget(entry);
      this._applyAtlas(entry);
      const weapon = HELD_ITEMS.includes(peer.weapon) && (peer.mode === 'walk' || peer.mode === 'eva') ? peer.weapon : null;
      if (entry.equipment.equipped !== weapon) {
        if (weapon) entry.equipment.equip(weapon);
        else entry.equipment.unequip();
      }
    }
    for (const [id, entry] of this.peers) if (!present.has(id)) { this._remove(entry); this.peers.delete(id); }
  }

  /** A server-confirmed fire event may pulse the remote recoil animation.
   * Tracers/impacts belong to the caller's shared authoritative effects pool. */
  fire(id) { const entry = this.peers.get(id); if (entry) entry.firePulse = true; }

  update(dt, origin) {
    if (this.disposed) return;
    const step = Math.max(0, Math.min(.1, Number.isFinite(dt) ? dt : 0));
    const alpha = 1 - Math.exp(-20 * step);
    this._origin.copy(origin);
    for (const entry of this.peers.values()) {
      const { peer, character, equipment } = entry;
      entry.position.lerp(entry.target, alpha);
      entry.orientation.slerp(entry.targetOrientation, alpha);
      entry.shipPosition.lerp(entry.shipTarget, alpha);
      entry.shipOrientation.slerp(entry.shipTargetOrientation, alpha);
      this._direction.copy(FORWARD).applyQuaternion(entry.orientation);
      if (peer.bodyOrientation) {
        this._bodyRotation.fromArray(peer.bodyOrientation);
        this._up.copy(UP).applyQuaternion(this._bodyRotation);
      } else if (peer.mode === 'walk' || peer.mode === 'dead') {
        const body = entry.body;
        if (entry.hasPhysicsUp) {
          this._up.copy(entry.physicsUp);
        } else if (peer.shipPosition && entry.position.distanceToSquared(entry.shipPosition) < (entry.shipId === 'atlas' ? 2500 : 625)) {
          this._up.copy(UP).applyQuaternion(entry.shipOrientation);
        } else if (body) {
          this._up.copy(entry.position).sub(this._shipOffset.fromArray(body.center)).normalize();
        } else this._up.copy(UP).applyQuaternion(entry.orientation);
        this._bodyForward.copy(this._direction).projectOnPlane(this._up);
        if (this._bodyForward.lengthSq() < 1e-8) this._bodyForward.copy(FORWARD).applyQuaternion(entry.character.object.quaternion).projectOnPlane(this._up);
        this._matrix.lookAt(this._zero, this._bodyForward, this._up);
        this._bodyRotation.setFromRotationMatrix(this._matrix);
      } else {
        this._bodyRotation.copy(entry.orientation);
        this._up.copy(UP).applyQuaternion(this._bodyRotation);
      }
      this._feet.copy(entry.position).addScaledVector(this._up, -this.eyeHeight);
      // The wire orientation is the view orientation. A separate bodyQuaternion
      // can be supplied when the sender is pitched independently of its torso.
      character.setWorldPose(this._feet, this._bodyRotation);
      character.placeCameraRelative(origin);
      if(Object.hasOwn(peer,'planetFrame')){
        character.object.userData.planetFrame=peer.planetFrame;
        equipment.vfx.userData.planetFrame=peer.planetFrame;
        entry.ship.userData.planetFrame=peer.mode==='flight'||peer.cabinFlight?peer.planetFrame:rotationFrameAt(entry.shipPosition)?.id??null;
      }
      const onFoot = peer.mode === 'walk' || peer.mode === 'eva' || peer.mode === 'dead';
      character.setVisible(onFoot);
      equipment.setRenderOrigin(origin);
      equipment.update(step, NO_FIRE);
      entry.animationInput.aiming = equipment.aimingInput();
      entry.animationInput.firing = entry.firePulse;
      character.update(step, entry.animationInput);
      entry.firePulse = false;
      // This must follow mixer.update, otherwise animation overwrites the hand.
      if (onFoot && equipment.equipped) poseHeldEquipment(character, equipment, this._direction, origin);
      entry.ship.visible = Boolean(peer.shipPosition) || peer.mode === 'flight' || peer.mode === 'landed';
      entry.ship.position.copy(entry.shipPosition).sub(origin);
      entry.ship.quaternion.copy(entry.shipOrientation);
      for (const node of entry.gears) if (node.scale.y !== entry.gearScale) {
        node.scale.y = entry.gearScale;
        node.updateMatrix();
      }
    }
  }

  _remove(entry) {
    entry.disposed = true;
    entry.equipment.dispose();
    // Character's stock disposer owns its entire tree. Detach this shared-
    // geometry clone first, then release only instance skeleton/materials.
    const model = entry.character.model;
    model?.removeFromParent();
    entry.character.dispose();
    releaseClone(model, true);
    releaseClone(entry.shipModel, false);
    entry.ship.removeFromParent();
  }

  get state() {
    return [...this.peers.values()].map(entry => ({
      id: entry.peer.id, colorIndex: entry.peer.colorIndex,
      characterReady: entry.character.ready, characterError: entry.character.error,
      visible: entry.character.object.visible, position: entry.position.toArray(),
      weapon: entry.equipment.equipped, weaponAttached: Boolean(entry.equipment.itemObject(entry.equipment.equipped)?.parent),
      muzzleDirection: entry.equipment.muzzleWorldDirection()?.toArray() || null,
      shipId: entry.shipId, shipReady: entry.ship.userData.assetStatus === 'ready',
    }));
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const entry of this.peers.values()) this._remove(entry);
    this.peers.clear();
    // Pending loads are also covered by _asset's late-completion handler.
    for (const promise of this.assets.values()) promise.then(gltf => this._releaseAsset(gltf), () => {});
    this.assets.clear();
  }
}
