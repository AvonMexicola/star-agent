import * as THREE from 'three';
import { SHIP_LAYOUT } from '../boarding.js';
import { shipHandling } from '../ship-handling.js';

const ZERO = new THREE.Vector3(), IDENTITY = new THREE.Quaternion();
const clamp = THREE.MathUtils.clamp;
const socket = (position, node = null) => Object.freeze({ position: Object.freeze([...position]), node });

// These are the three playable assets, not the Atlas Mark II studio assembly.
// Nomad's nozzle lips are shared with boarding.js. Atlas's last machined collar
// ends at z=13.33 (assets/ship/build_freighter.py); Kestrel has authored AB sockets.
export const ENGINE_EXHAUST = Object.freeze({
  nomad: Object.freeze({ sockets: Object.freeze(SHIP_LAYOUT.nozzles.map(p => socket(p))), radius: .48, length: 4.3, boostLength: 7, authoredCones: false }),
  atlas: Object.freeze({ sockets: Object.freeze([-1, 1].map(s => socket([s * 7.9, 5.3, 13.34]))), radius: .87, length: 6.5, boostLength: 9, authoredCones: false }),
  kestrel: Object.freeze({ sockets: Object.freeze([-1, 1].map(s => socket([s * 1.26, 1.62, 6.68], s < 0 ? 'AB_L' : 'AB_R'))), radius: .39, length: 1.62, boostLength: 1.2, authoredCones: true }),
});

/** One presentation sample for authored cores, exhaust and engine audio.
 * Engine acceleration is simulation output, including assist/braking. Velocity
 * and input keys never imply thrust. The parked hull owns the unseated pose.
 */
export function enginePresentation(nav, { suspended = false } = {}) {
  suspended = suspended || nav.enabled === false || nav.focused === false;
  const shipId = nav.shipId ?? 'nomad', mode = nav.mode;
  const cabinFlight = Boolean(nav.cabinFlight), flying = mode === 'flight' || cabinFlight;
  const powered = nav.powered !== false && mode !== 'crashed' && mode !== 'destroyed';
  const travel = Boolean(nav.travel), active = powered && !suspended && !travel;
  const parked = mode !== 'flight' && Boolean(nav.shipPosition);
  const shipQuaternion = (parked ? nav.shipOrientation : nav.orientation) ?? IDENTITY;
  const velocity = (parked ? nav.shipVelocity : nav.velocity) ?? ZERO;
  const shipPosition = parked ? nav.shipPosition.clone() : new THREE.Vector3(...(nav.layout ?? SHIP_LAYOUT).seatEye)
    .applyQuaternion(shipQuaternion).negate().add(nav.position ?? ZERO);
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(shipQuaternion);
  const acceleration = active && flying ? nav.engineAcceleration ?? ZERO : ZERO;
  const authority = shipHandling(shipId).thrust;
  const demand = acceleration.dot(forward) / authority;
  const signedForwardDemand = Number.isFinite(demand) && Math.abs(demand) > .001 ? clamp(demand, -3, 3) : 0;
  const total = acceleration.length() / authority;
  const throttle = Number.isFinite(total) ? clamp(total, 0, 1) : 0;
  const forwardThrottle = clamp(signedForwardDemand, 0, 1);
  // Sprinting inside a moving cabin must not engage the ship afterburners.
  const boost = active && mode === 'flight' && Boolean(nav.boost) && forwardThrottle > .001;
  const state = suspended ? 'suspended' : !powered ? 'off' : travel ? 'travel'
    : signedForwardDemand > 0 ? 'forward' : signedForwardDemand < 0 ? 'reverse'
      : throttle > .001 ? 'maneuvering' : 'idle';
  return { shipId, mode, powered, cabinFlight, insideShip: Boolean(nav.insideShip), flying, active,
    throttle, signedForwardDemand, forwardThrottle, boost, state, shipPosition, shipQuaternion, velocity };
}

const socketCache = new WeakMap();
/** Resolve named authored sockets in hull-local doubles before world placement.
 * Missing/loading assets have no free-floating fallback flames.
 */
export function engineExhaust(ship, shipId = 'nomad') {
  const profile = ENGINE_EXHAUST[shipId];
  if (!profile) return { sockets: [], authoredCones: false };
  if (!ship) return profile;
  const assetStatus = ship.userData?.assetStatus;
  if (assetStatus && assetStatus !== 'ready') return { ...profile, sockets: [] };
  const cached = socketCache.get(ship);
  if (cached?.shipId === shipId && cached.assetStatus === assetStatus) return cached.profile;
  ship.updateWorldMatrix(true, true);
  const inverse = ship.matrixWorld.clone().invert();
  const sockets = profile.sockets.flatMap(spec => {
    if (!spec.node) return [spec];
    const node = ship.getObjectByName(spec.node);
    if (!node) return [];
    const point = new THREE.Vector3().setFromMatrixPosition(node.matrixWorld).applyMatrix4(inverse);
    return [socket(point.toArray(), spec.node)];
  });
  const resolved = { ...profile, sockets };
  socketCache.set(ship, { shipId, assetStatus, profile: resolved });
  return resolved;
}

const visualCache = new WeakMap(), WHITE = new THREE.Color(1, 1, 1);
/** Update the existing asset emitters after ship.update/updateCabin. This owns
 * emission only: no duplicate Kestrel cones/cores or changes to asset geometry.
 */
export function updateShipEngineVisuals(ship, engine) {
  if (!ship || !engine) return;
  const assetStatus = ship.userData?.assetStatus;
  let binding = visualCache.get(ship);
  if (!binding || binding.assetStatus !== assetStatus) {
    const materials = new Set(), cones = [], core = ship.getObjectByName('EngineCores');
    ship.traverse(node => {
      if (node.isMesh) for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
        if (material.name === 'Drive / ion blue') materials.add(material);
      }
      if (node.name === 'AB_L' || node.name === 'AB_R') cones.push(node);
    });
    const tint = cones[0]?.material?.uniforms?.tint?.value ?? core?.material?.emissive;
    binding = { assetStatus, materials, cones, core, tint: tint?.clone() };
    visualCache.set(ship, binding);
  }
  const active = engine.active && engine.powered;
  const hot = active ? engine.forwardThrottle : 0;
  const boost = active && engine.boost;
  const idle = engine.flying ? .14 : .055;
  const intensity = active ? idle + hot * 2.6 + Number(boost) * .9 : 0;
  ship.setThrottle?.(hot);
  for (const material of binding.materials) material.emissiveIntensity = intensity;
  if (binding.core?.material?.emissive) {
    binding.core.material.emissive.copy(binding.tint).lerp(WHITE, Math.pow(hot, 1.6) * .84);
    binding.core.material.emissiveIntensity = intensity;
  }
  for (const cone of binding.cones) {
    cone.visible = Boolean(boost && hot > .001);
    cone.scale.set(1, 1, Math.max(.01, .45 + hot * .55));
  }
  ship.userData.driveIntensity = intensity;
  ship.userData.enginePresentation = { shipId: engine.shipId, state: engine.state,
    forwardThrottle: hot, intensity, authoredCones: binding.cones.filter(cone => cone.visible).length };
}
