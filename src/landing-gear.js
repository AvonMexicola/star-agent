import { Vector3 } from 'three';

export const LANDING_GEAR = Object.freeze({
  travel: .6,                // metres per strut
  stiffness: 120000,         // N/m per strut
  damping: 18000,            // N/(m/s) per strut
  bumpStiffness: 1200000,    // N/m beyond suspension travel
  damageThresholdG: 6,
  standardGravity: 9.81,
});

const UP = new Vector3(0, 1, 0);

function finiteVector(value, name) {
  if (!value || ![value.x, value.y, value.z].every(Number.isFinite)) {
    throw new TypeError(`${name} must be a finite Vector3`);
  }
}

function positive(value, name, allowZero = false) {
  if (!Number.isFinite(value) || (allowZero ? value < 0 : value <= 0)) {
    throw new RangeError(`${name} must be finite and ${allowZero ? 'non-negative' : 'positive'}`);
  }
}

/** Pure spring/damper force evaluation; does not integrate or snap the ship.
 *
 * body: { position, orientation, velocity, angularVelocity?, mass }. Position is
 * the world-space centre of mass (JS doubles); angularVelocity is SHIP-local,
 * matching flight-model.js. All other returned vectors use world axes.
 *
 * struts: [{ id, mount: Vector3, restLength, travel?, stiffness?, damping?,
 *            bumpStiffness? }]. Mounts are SHIP-local offsets from that centre.
 * Supply the authored rig from boarding.js; this module defines no ship floor.
 *
 * raycast(origin, direction, maxDistance, id): closest supporting hit or null.
 * A hit is { distance, normal: Vector3, velocity?: Vector3 }. Distance is metres
 * along the normalized ray; normal points out of the surface, and velocity is
 * the surface's world velocity at the hit. Use the SAME terrainHeight or actual
 * station deck as collision. One ray is issued per deployed strut per call.
 * The callback must not mutate its arguments.
 *
 * previous is the prior result.state (omit initially). Carry it between physics
 * substeps to emit touchdown once per strut and damage once per contact episode.
 * Force / torque are instantaneous SI values: the caller integrates them with
 * its fixed dt and retains swept hull collision. These rays alone do not prevent
 * tunnelling, provide tire friction, or resolve a mount already below the floor.
 */
export function evaluateLandingGear(body, struts, raycast, previous = {}, options = {}) {
  finiteVector(body.position, 'body.position');
  finiteVector(body.velocity, 'body.velocity');
  positive(body.mass, 'body.mass');
  const orientation = body.orientation;
  if (!orientation || ![orientation.x, orientation.y, orientation.z, orientation.w].every(Number.isFinite)
      || Math.abs(orientation.lengthSq() - 1) > 1e-6) {
    throw new TypeError('body.orientation must be a normalized Quaternion');
  }
  const angularVelocity = body.angularVelocity || new Vector3();
  finiteVector(angularVelocity, 'body.angularVelocity');
  const threshold = options.damageThresholdG ?? LANDING_GEAR.damageThresholdG;
  positive(threshold, 'damageThresholdG');
  const force = new Vector3(), torque = new Vector3(), contacts = [], events = [];
  if (options.deployed === false) {
    return { force, torque, contacts, events, supportG: 0, state: { contactIds: [], damageReported: false } };
  }
  if (typeof raycast !== 'function') throw new TypeError('raycast must be a function');
  const up = UP.clone().applyQuaternion(orientation);
  const down = up.clone().negate();
  const omega = angularVelocity.clone().applyQuaternion(orientation);
  const previousIds = new Set(previous.contactIds || []);
  const ids = new Set();
  // Validate the whole rig before issuing any surface queries.
  const rig = struts.map(strut => {
    if (typeof strut.id !== 'string' || !strut.id || ids.has(strut.id)) {
      throw new TypeError('Each strut requires a unique non-empty string id');
    }
    ids.add(strut.id);
    finiteVector(strut.mount, `${strut.id}.mount`);
    const spec = { ...LANDING_GEAR, ...strut };
    positive(spec.restLength, `${strut.id}.restLength`);
    positive(spec.travel, `${strut.id}.travel`);
    if (spec.travel > spec.restLength) throw new RangeError('Strut travel cannot exceed restLength');
    positive(spec.stiffness, `${strut.id}.stiffness`);
    positive(spec.damping, `${strut.id}.damping`, true);
    positive(spec.bumpStiffness, `${strut.id}.bumpStiffness`, true);
    return spec;
  });

  for (const strut of rig) {
    const mountOffset = strut.mount.clone().applyQuaternion(orientation);
    const origin = body.position.clone().add(mountOffset);
    const hit = raycast(origin, down.clone(), strut.restLength, strut.id);
    if (hit == null) continue;
    if (!Number.isFinite(hit.distance) || hit.distance < 0 || hit.distance > strut.restLength) {
      throw new RangeError('Ray hit distance must be within the supplied ray');
    }
    finiteVector(hit.normal, 'hit.normal');
    if (hit.normal.lengthSq() < 1e-12) throw new RangeError('Ray hit normal cannot be zero');
    const normal = hit.normal.clone().normalize();
    // A side wall or the underside of a deck cannot support the suspension.
    if (normal.dot(up) <= 1e-6) continue;
    const surfaceVelocity = hit.velocity || new Vector3();
    finiteVector(surfaceVelocity, 'hit.velocity');
    // Form the lever arm locally: never subtract two astronomical world points.
    const arm = mountOffset.clone().addScaledVector(down, hit.distance);
    const relativeVelocity = omega.clone().cross(arm).add(body.velocity).sub(surfaceVelocity);
    const normalSpeed = relativeVelocity.dot(normal);
    const deflection = strut.restLength - hit.distance;
    const compression = Math.min(strut.travel, deflection);
    const overtravel = Math.max(0, deflection - strut.travel);
    const springLoad = strut.stiffness * compression + strut.bumpStiffness * overtravel;
    // Unilateral contact: a damper can unload a pad, never glue it to the deck.
    const load = Math.max(0, springLoad - strut.damping * normalSpeed);
    const contactForce = normal.clone().multiplyScalar(load);
    force.add(contactForce);
    torque.add(arm.clone().cross(contactForce));
    const contact = {
      id: strut.id, point: body.position.clone().add(arm), normal, force: contactForce,
      compression, compressionRatio: compression / strut.travel,
      overtravel, bottomedOut: deflection >= strut.travel, normalSpeed, load,
    };
    contacts.push(contact);
    if (!previousIds.has(strut.id) && (compression > 0 || normalSpeed < 0)) {
      events.push({ type: 'touchdown', strutId: strut.id, speed: Math.max(0, -normalSpeed) });
    }
  }

  const supportG = force.length() / (body.mass * LANDING_GEAR.standardGravity);
  let damageReported = contacts.length > 0 && !!previous.damageReported;
  if (contacts.length > 0 && supportG > threshold && !damageReported) {
    events.push({ type: 'hard-landing', supportG, excessG: supportG - threshold });
    damageReported = true;
  }
  return {
    force, torque, contacts, events, supportG,
    state: {
      contactIds: contacts.filter(contact => contact.compression > 0 || contact.normalSpeed < 0
        || previousIds.has(contact.id)).map(contact => contact.id),
      damageReported,
    },
  };
}
