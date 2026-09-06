import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { buildStationColliders, constrainStationSweep } from './station-collision.js';
import { SHIP_LAYOUT } from './boarding.js';
import { RADIUS, terrainHeight, findDestinations } from './world.js';

/** Metres above the datum. ISS flies at ~400 km; the planet is quarter scale. */
export const STATION_ALTITUDE = 100_000;
/** Seconds per orbit when `orbiting: true`. ISS-like pace (about 93 minutes). */
export const STATION_ORBIT_PERIOD = 5_600;
export const STATION_MODEL_URL = '/models/station.glb';
export const STATION_LOD_URL = '/models/station_lod1.glb';
/** Hover height navigation.js keeps between the ship's pads and the ground. */
export const HOVER_HEIGHT = 3.2;
/** Door automation radii around the DoorTrigger empty (250 m outside the bay). */
export const DOOR_OPEN_RADIUS = 600;
export const DOOR_CLOSE_RADIUS = 1_500;
const LOD_DISTANCE = 25_000;
const preparedMaterials = new WeakSet();
const VISIBLE_DISTANCE = 600_000;
const NAV_LIGHT_MATERIALS = ['NavLight_Red', 'NavLight_Green', 'Beacon_White'];
const REQUIRED_NODES = ['HangarDoor_L', 'HangarDoor_R', 'LandingDeck', 'LandingPad', 'ApproachPoint', 'DoorTrigger'];

const UP = new THREE.Vector3(0, 1, 0);
const FLIP_Y = new THREE.Quaternion().setFromAxisAngle(UP, Math.PI);
const scratch = new THREE.Vector3(), scratchB = new THREE.Vector3(), scratchC = new THREE.Vector3();
const scratchMatrix = new THREE.Matrix4(), scratchBox = new THREE.Box3();

/** Unit direction of the station's ground track: above the "coast" destination, so it
 * is in view from the opening orbit. Falls back to lat 19° / lon 22° if world.js changes. */
export function defaultStationDirection() {
  const coast = findDestinations().coast;
  if (coast) return new THREE.Vector3(...coast).normalize();
  const lat = THREE.MathUtils.degToRad(19), lon = THREE.MathUtils.degToRad(22);
  return new THREE.Vector3(Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon));
}

/** Orientation with local +Y along `direction` (away from the planet) and the hangar
 * opening (local -Z) facing east along the horizon, prograde for an ISS-like orbit.
 * Near the poles east is undefined, so fall back to the meridian. Zero allocations. */
export function stationQuaternion(direction, target) {
  const forward = scratch.crossVectors(UP, direction);
  if (forward.lengthSq() < 1e-8) forward.set(1, 0, 0).projectOnPlane(direction);
  forward.normalize();
  const right = scratchB.crossVectors(forward, direction).normalize();
  const back = scratchC.copy(forward).negate();
  scratchMatrix.makeBasis(right, direction, back);
  return target.setFromRotationMatrix(scratchMatrix);
}

/** An orbital station with a working hangar. World coordinates are doubles in metres;
 * only the camera-relative offset reaches the float matrices. */
export class Station {
  /**
   * @param {THREE.Scene} scene
   * @param {object} [options]
   * @param {string} [options.url='/models/station.glb']
   * @param {string|null} [options.lodUrl='/models/station_lod1.glb'] low-poly stand-in beyond 25 km; null disables
   * @param {THREE.Vector3} [options.direction] unit vector of the ground track (default: over the coast destination)
   * @param {THREE.Quaternion|null} [options.orientation] fixed model orientation; defaults to radial stationQuaternion
   * @param {number} [options.altitude=STATION_ALTITUDE]
   * @param {boolean} [options.orbiting=false] true: circles the planet's axis once per `period`. Off by default,
   *   because a target that moves at 1.1 km/s is no fun to chase; the fixed station reads as geostationary.
   * @param {number} [options.period=STATION_ORBIT_PERIOD]
   * @param {object} [options.gltf] an already-loaded glTF result (tests, preloading); skips the network
   * @param {(event: ProgressEvent) => void} [options.onProgress]
   */
  constructor(scene, options = {}) {
    this.scene = scene;
    this.url = options.url ?? STATION_MODEL_URL;
    this.lodUrl = options.lodUrl === undefined ? STATION_LOD_URL : options.lodUrl;
    this.altitude = options.altitude ?? STATION_ALTITUDE;
    this.orbiting = Boolean(options.orbiting);
    this.period = options.period ?? STATION_ORBIT_PERIOD;
    this.onProgress = options.onProgress;
    this.error = null;
    this.ready = false;
    this.elapsed = 0;
    this.offset = new THREE.Vector3(...(options.offset ?? [0,0,0]));
    this.yaw = new THREE.Quaternion().setFromAxisAngle(UP, options.yaw ?? 0);
    this.lodDistance = options.lodDistance ?? LOD_DISTANCE;
    this.sharedColliders = options.colliders;
    this.localLights = [];

    this.group = new THREE.Group();
    this.group.name = 'Orbital station';
    scene.add(this.group);
    this.model = null;
    this.lodModel = null;

    this.direction0 = (options.direction ? options.direction.clone() : defaultStationDirection()).normalize();
    this.orientationOverride = options.orientation ? options.orientation.clone().normalize() : null;
    /** Current unit direction from the planet centre to the station. */
    this.direction = this.direction0.clone();
    /** Station origin in world metres (double precision). */
    this.worldPosition = new THREE.Vector3();
    this.quaternion = new THREE.Quaternion();
    this.inverseQuaternion = new THREE.Quaternion();
    this._up = new THREE.Vector3();

    // Model-space anchors, filled by attach().
    this.padLocal = new THREE.Vector3();
    this.padLocalQuaternion = new THREE.Quaternion();
    this.approachLocal = new THREE.Vector3();
    this.triggerLocal = new THREE.Vector3();
    /** Interior clear volume in model space: deck top to ceiling, wall to wall, back wall to opening. */
    this.interiorBox = new THREE.Box3();
    this.openingZ = 0;
    // World-space results, recomputed whenever the station moves.
    this._padWorld = new THREE.Vector3();
    this._padQuaternion = new THREE.Quaternion();
    this._approachWorld = new THREE.Vector3();
    this._triggerWorld = new THREE.Vector3();

    this.doorMixer = null;
    this.doorAction = null;
    this.doorClip = null;
    this.doorCommand = 'closed';
    this.openingControlled = false;
    this.openingProgress = 0;
    this.navMaterials = [];
    this.cameraDistance = Infinity;

    this.updateFrame();
    this.readyPromise = options.gltf ? Promise.resolve(this.attach(options.gltf)) : this.load();
  }

  load() {
    const loader = new GLTFLoader();
    const main = new Promise((resolve, reject) => {
      loader.load(this.url, (gltf) => {
        try { resolve(this.attach(gltf)); } catch (error) { this.fail(error); reject(error); }
      }, this.onProgress, (error) => { this.fail(error); reject(error); });
    });
    if (this.lodUrl) {
      loader.load(this.lodUrl, (gltf) => this.attachLod(gltf), undefined, (error) => console.warn('Station LOD unavailable:', error));
    }
    return main;
  }

  fail(error) {
    this.error = `Station model failed to load (${this.url}): ${error?.message ?? error}`;
    console.error(this.error, error);
  }

  /** Wire a loaded glTF into the station. Separated from the network so tests can inject a scene. */
  attach(gltf) {
    const model = gltf.scene ?? gltf.scenes?.[0];
    if (!model) throw new Error('glTF has no scene');
    const nodes = {};
    for (const name of REQUIRED_NODES) {
      nodes[name] = model.getObjectByName(name);
      if (!nodes[name]) throw new Error(`glTF is missing node ${name}`);
    }
    // Measure in model space before the model joins the camera-relative group.
    model.position.set(0, 0, 0); model.quaternion.identity(); model.scale.setScalar(1);
    model.updateMatrixWorld(true);
    const deck = scratchBox.setFromObject(nodes.LandingDeck);
    const deckTop = deck.max.y;
    const deckMinX = deck.min.x, deckMaxX = deck.max.x, deckMinZ = deck.min.z, deckMaxZ = deck.max.z;
    const door = new THREE.Box3().setFromObject(nodes.HangarDoor_L);
    const height = Math.max(14, door.max.y - deckTop);
    this.interiorBox.min.set(deckMinX, deckTop, deckMinZ);
    this.interiorBox.max.set(deckMaxX, deckTop + height, deckMaxZ);
    this.openingZ = deckMinZ;
    nodes.LandingPad.getWorldPosition(this.padLocal);
    nodes.LandingPad.getWorldQuaternion(this.padLocalQuaternion);
    nodes.ApproachPoint.getWorldPosition(this.approachLocal);
    nodes.DoorTrigger.getWorldPosition(this.triggerLocal);

    this.colliders = this.sharedColliders ?? buildStationColliders(model);
    this.doorBoxes = [];
    this.prepareMaterials(model, true);
    this.deck = nodes.LandingDeck;
    this.doors = [nodes.HangarDoor_L, nodes.HangarDoor_R];

    const clip = THREE.AnimationClip.findByName(gltf.animations ?? [], 'DoorsOpen');
    if (clip) {
      this.doorClip = clip;
      this.doorMixer = new THREE.AnimationMixer(model);
      const action = this.doorMixer.clipAction(clip);
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
      action.play();
      action.paused = true;
      action.time = 0;
      this.doorAction = action;
    } else {
      console.warn('Station glTF has no DoorsOpen animation; doors stay shut.');
    }

    this.model = model;
    this.group.add(model);
    if (this.lodModel) this.lodModel.visible = false;
    this.ready = true;
    this.updateFrame();
    if (this.openingControlled) this.setOpeningProgress(this.openingProgress);
    else this.updateDoorColliders();
    this.fill = new THREE.AmbientLight(0xddeaff,0); this.group.add(this.fill);
    for (const x of [-12,12]) {
      const light = new THREE.PointLight(0xffdfb4,300,65,2);
      light.position.set(x,deckTop+11,this.padLocal.z); this.group.add(light); this.localLights.push(light);
    }
    return this;
  }

  attachLod(gltf) {
    const model = gltf.scene ?? gltf.scenes?.[0];
    if (!model) return;
    this.prepareMaterials(model, false);
    this.lodModel = model;
    model.visible = !this.model;
    this.group.add(model);
  }

  /** Emissives are authored for a display-referred look; the demo tone-maps HDR with ACES,
   * so double them. Nav-light materials are remembered for blinking. */
  prepareMaterials(root, collectNavLights) {
    const seen = new Set();
    root.traverse((object) => {
      if (!object.isMesh) return;
      object.castShadow = collectNavLights;
      object.receiveShadow = true;
      const material = object.material;
      if (!material || seen.has(material)) return;
      seen.add(material);
      if (material.emissive && material.emissiveIntensity > 0 && material.emissive.getHex() !== 0) {
        if (!preparedMaterials.has(material)) material.emissiveIntensity *= 2;
        preparedMaterials.add(material);
      }
      if (collectNavLights && NAV_LIGHT_MATERIALS.includes(material.name)) {
        this.navMaterials.push({ material, base: material.emissiveIntensity, kind: material.name });
      }
    });
  }

  /** Recompute world position, orientation and the world-space anchors. */
  updateFrame() {
    this.worldPosition.copy(this.direction).multiplyScalar(RADIUS + this.altitude);
    if (this.orientationOverride) this.quaternion.copy(this.orientationOverride);
    else stationQuaternion(this.direction, this.quaternion);
    // Pod spacing belongs to the common station frame. A berth's own yaw turns
    // its doorway without rotating its position around the central spine.
    this.worldPosition.add(this.offset.clone().applyQuaternion(this.quaternion));
    this.quaternion.multiply(this.yaw);
    this.inverseQuaternion.copy(this.quaternion).invert();
    this._up.set(0, 1, 0).applyQuaternion(this.quaternion).normalize();
    this.toWorld(this.padLocal, this._padWorld);
    this.toWorld(this.approachLocal, this._approachWorld);
    this.toWorld(this.triggerLocal, this._triggerWorld);
    // Ship convention is nose -Z; the pad's +Z points out of the bay, so turn the ship around.
    this._padQuaternion.copy(this.quaternion).multiply(this.padLocalQuaternion).multiply(FLIP_Y);
  }

  toWorld(local, target) {
    return target.copy(local).applyQuaternion(this.quaternion).add(this.worldPosition);
  }

  toLocal(world, target) {
    return target.copy(world).sub(this.worldPosition).applyQuaternion(this.inverseQuaternion);
  }

  /**
   * @param {THREE.Vector3} cameraWorldPosition the viewer/ship position in world metres (nav.position)
   * @param {THREE.Vector3} renderOrigin the camera-relative rendering origin (main.js `origin`)
   * @param {THREE.Vector3} sunDirection unused for now; kept for parity with the other modules
   * @param {number} dt seconds since the previous frame
   */
  update(cameraWorldPosition, renderOrigin, sunDirection, dt) {
    this.elapsed += dt;
    if (this.orbiting) {
      const angle = (this.elapsed / this.period) * Math.PI * 2;
      this.direction.copy(this.direction0).applyAxisAngle(UP, angle);
      this.updateFrame();
    }
    this.group.position.copy(this.worldPosition).sub(renderOrigin);
    this.group.quaternion.copy(this.quaternion);
    const distance = scratch.copy(cameraWorldPosition).sub(this.worldPosition).length();
    this.cameraDistance = distance;
    if(this.fill)this.fill.intensity=.22*(1-THREE.MathUtils.smoothstep(distance,50,180));
    this.group.visible = distance < VISIBLE_DISTANCE;
    for (const light of this.localLights) light.visible = distance < 180;
    if (this.model && this.lodModel) {
      const far = distance > this.lodDistance;
      this.model.visible = !far;
      this.lodModel.visible = far;
    }
    if (!this.ready) return;

    const triggerDistanceSq = scratch.copy(cameraWorldPosition).sub(this._triggerWorld).lengthSq();
    if (!this.openingControlled) {
      if (triggerDistanceSq < DOOR_OPEN_RADIUS * DOOR_OPEN_RADIUS) this.openDoors();
      else if (triggerDistanceSq > DOOR_CLOSE_RADIUS * DOOR_CLOSE_RADIUS) this.closeDoors();
    }
    if (this.doorMixer && !this.doorAction.paused) this.doorMixer.update(dt);
    if(this.lodModel)for(const door of this.doors){const farDoor=this.lodModel.getObjectByName(door.name);if(farDoor)farDoor.position.copy(door.position);}
    this.updateDoorColliders();

    // Aviation-style lights: a white double-strobe once per second, red and green in anti-phase.
    const phase = this.elapsed % 1;
    const strobe = phase < 0.08 || (phase > 0.2 && phase < 0.28);
    for (let i = 0; i < this.navMaterials.length; i++) {
      const light = this.navMaterials[i];
      let on = true;
      if (light.kind === 'Beacon_White') on = strobe;
      else if (light.kind === 'NavLight_Red') on = phase < 0.5;
      else if (light.kind === 'NavLight_Green') on = phase >= 0.5;
      light.material.emissiveIntensity = on ? light.base : light.base * 0.06;
    }
  }

  updateDoorColliders() {
    if (!this.doors) return;
    this.group.updateMatrixWorld(true);
    const inverse = this.group.matrixWorld.clone().invert();
    this.doorBoxes = this.doors.map(door => {
      const box = new THREE.Box3();
      door.traverse(mesh => {
        if (!mesh.isMesh) return;
        mesh.geometry.computeBoundingBox();
        box.union(mesh.geometry.boundingBox.clone().applyMatrix4(inverse.clone().multiply(mesh.matrixWorld)));
      });
      return box;
    });
  }

  /** Swept conservative ship/body bounds, including the animated doors. */
  constrainStep(previous, proposed, orientation, walking = false, layout = SHIP_LAYOUT) {
    if (!this.ready) return { point: proposed.clone(), hit: false };
    const start = this.toLocal(previous,new THREE.Vector3()), end = this.toLocal(proposed,new THREE.Vector3());
    const min = new THREE.Vector3(), max = new THREE.Vector3();
    if (!walking && layout.flightParts) {
      const q=this.inverseQuaternion.clone().multiply(orientation),seat=new THREE.Vector3(...layout.seatEye);
      let closest={point:end.clone(),hit:false};
      for(const envelope of layout.flightParts){
        const bounds=new THREE.Box3();
        for(let i=0;i<8;i++){
          const corner=new THREE.Vector3(...envelope.min);
          for(let axis=0;axis<3;axis++)if(i&(1<<axis))corner.setComponent(axis,envelope.max[axis]);
          bounds.expandByPoint(corner.sub(seat).applyQuaternion(q));
        }
        const hit=constrainStationSweep(this.colliders,this.doorBoxes,start,end,bounds.min,bounds.max);
        if(hit.hit&&(!closest.hit||hit.point.distanceToSquared(start)<closest.point.distanceToSquared(start)))closest=hit;
      }
      this.toWorld(closest.point,closest.point);return closest;
    }
    if (walking) {
      min.set(-.25,-layout.eyeHeight,-.25); max.set(.25,.15,.25);
    } else {
      const q = this.inverseQuaternion.clone().multiply(orientation);
      const bounds = new THREE.Box3(), seat = new THREE.Vector3(...layout.seatEye);
      const envelope = layout.flightBounds;
      for (let i=0;i<8;i++) {
        const corner = new THREE.Vector3(...envelope.min);
        for (let axis=0;axis<3;axis++) if(i & (1<<axis)) corner.setComponent(axis,envelope.max[axis]);
        bounds.expandByPoint(corner.sub(seat).applyQuaternion(q));
      }
      min.copy(bounds.min); max.copy(bounds.max);
    }
    const result = constrainStationSweep(this.colliders,this.doorBoxes,start,end,min,max);
    this.toWorld(result.point,result.point); return result;
  }

  /** Flat model-authored deck support, deliberately distinct from planet terrain. */
  deckPoint(worldPosition, eyeHeight = 0) {
    if (!this.ready) return null;
    const local = this.toLocal(worldPosition,new THREE.Vector3()), box = this.interiorBox;
    if(local.x<box.min.x+.3 || local.x>box.max.x-.3 || local.z<box.min.z+.3 || local.z>box.max.z-.3 || local.y<box.min.y-1 || local.y>box.max.y) return null;
    local.y=box.min.y+eyeHeight; return this.toWorld(local,local);
  }

  canDock(worldPosition, layout = SHIP_LAYOUT, orientation = this.quaternion) {
    if (!this.ready) return false;
    const p=this.toLocal(worldPosition,new THREE.Vector3()), b=this.interiorBox;
    if (layout !== SHIP_LAYOUT) {
      const q=this.inverseQuaternion.clone().multiply(orientation),seat=new THREE.Vector3(...layout.seatEye);
      const bounds=new THREE.Box3();
      for(let i=0;i<8;i++){
        const corner=new THREE.Vector3(...layout.flightBounds.min);
        for(let axis=0;axis<3;axis++)if(i&(1<<axis))corner.setComponent(axis,layout.flightBounds.max[axis]);
        bounds.expandByPoint(corner.sub(seat).applyQuaternion(q).add(p));
      }
      return bounds.min.x>b.min.x+.5 && bounds.max.x<b.max.x-.5 && bounds.min.z>b.min.z+.5 && bounds.max.z<b.max.z-.5 && p.y>b.min.y && bounds.max.y<b.max.y-.3;
    }
    return p.x>b.min.x+9 && p.x<b.max.x-9 && p.z>b.min.z+12 && p.z<b.max.z-12 && p.y>b.min.y && p.y<b.max.y-3;
  }

  openDoors() {
    this.doorCommand = 'open';
    const action = this.doorAction;
    if (!action) return;
    if (action.time >= this.doorClip.duration - 1e-4) { action.time = this.doorClip.duration; action.paused = true; return; }
    action.enabled = true; action.timeScale = 1; action.paused = false;
  }

  closeDoors() {
    this.doorCommand = 'closed';
    const action = this.doorAction;
    if (!action) return;
    if (action.time <= 1e-4) { action.time = 0; action.paused = true; return; }
    action.enabled = true; action.timeScale = -1; action.paused = false;
  }

  /** Take deterministic control of the opening animation for the intro. */
  beginOpening() {
    this.openingControlled = true;
    this.doorCommand = 'opening';
    return this.setOpeningProgress(0);
  }

  /** Set and immediately evaluate the authored door pose, including collision. */
  setOpeningProgress(progress) {
    this.openingProgress = THREE.MathUtils.clamp(Number.isFinite(progress) ? progress : 0, 0, 1);
    const action = this.doorAction;
    if (action) {
      action.enabled = true;
      action.paused = true;
      action.timeScale = 0;
      action.time = this.openingProgress * this.doorClip.duration;
      this.doorMixer.update(0);
      this.updateDoorColliders();
    }
    return this.openingProgress;
  }

  /** Release intro control without changing the current authored door pose. */
  endOpening() {
    this.openingControlled = false;
    if (this.doorAction) {
      this.doorAction.paused = true;
      this.doorAction.timeScale = 1;
    }
    this.doorCommand = this.doorsOpen >= 1 - 1e-4 ? 'open' : this.doorsOpen <= 1e-4 ? 'closed' : 'paused';
    return this.doorsOpen;
  }

  /** 0 = sealed, 1 = fully open. */
  get doorsOpen() {
    if (!this.doorAction) return 0;
    return THREE.MathUtils.clamp(this.doorAction.time / this.doorClip.duration, 0, 1);
  }

  /** Authored deck normal (local +Y), including the opening's tilted station pose. */
  get up() { return this._up; }
  /** Deck-centre world position, on the deck surface. */
  get padWorldPosition() { return this._padWorld; }
  /** Orientation for a landed ship: pads flat on the deck, nose (-Z) toward the doors. */
  get padQuaternion() { return this._padQuaternion; }
  /** 90 m outside the doors on the approach axis, at hover height. */
  get approachWorldPosition() { return this._approachWorld; }
  /** 250 m outside the doors; doors open within 600 m of it and close beyond 1.5 km. */
  get doorTriggerWorldPosition() { return this._triggerWorld; }

  /** Oriented-box test against the interior clear volume (deck to ceiling, wall to wall). */
  isInsideHangar(worldPosition) {
    if (!this.ready) return false;
    const local = this.toLocal(worldPosition, scratch);
    return this.interiorBox.containsPoint(local);
  }

  /** Distance from the planet centre of the deck surface under `worldPosition`, when that point
   * projects onto the deck and sits between 2 m below it and 6 m above the ceiling; else null.
   * navigation.js can use `value - RADIUS` as a ground-height override so autoland settles on the deck. */
  deckHeightAt(worldPosition) {
    if (!this.ready) return null;
    const box = this.interiorBox;
    const local = this.toLocal(worldPosition, scratch);
    if (local.x < box.min.x || local.x > box.max.x || local.z < box.min.z || local.z > box.max.z) return null;
    if (local.y < box.min.y - 2 || local.y > box.max.y + 6) return null;
    local.y = box.min.y;
    return this.toWorld(local, scratchB).length();
  }

  /** Arguments for `nav.transit(direction, altitude)` that arrive `distanceOutside` metres in front of the
   * doors at hover height, plus a point to look at (the pad). Allocates; call once per transit. */
  transitParams(distanceOutside = 400, height = HOVER_HEIGHT) {
    const local = new THREE.Vector3(this.padLocal.x, this.interiorBox.min.y + height, this.openingZ - distanceOutside);
    const world = this.toWorld(local, new THREE.Vector3());
    const direction = world.clone().normalize();
    const ground = Math.max(0, terrainHeight(direction.x, direction.y, direction.z));
    return { direction: direction.toArray(), altitude: world.length() - RADIUS - ground, lookAt: this.toWorld(new THREE.Vector3(this.padLocal.x,this.interiorBox.min.y+height,this.padLocal.z),new THREE.Vector3()), up: this.up.clone() };
  }

  dispose() {
    this.doorMixer?.stopAllAction();
    this.group.removeFromParent();
    const materials = new Set();
    this.group.traverse((object) => {
      if (!object.isMesh) return;
      object.geometry.dispose();
      materials.add(object.material);
    });
    for (const material of materials) material.dispose();
    this.group.clear();
    this.model = this.lodModel = null;
    this.ready = false;
  }
}
