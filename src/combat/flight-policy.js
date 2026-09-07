import {shipHandling} from '../ship-handling.js';
export const COMBAT_SPEED = Object.freeze({kestrel:220, nomad:180, atlas:120});
export const combatSpeed = shipId => COMBAT_SPEED[shipId] ?? COMBAT_SPEED.nomad;
export function shipWeaponStatus(nav) {
  if (!nav.combatMode) return 'CRUISE · WEAPONS LOCKED';
  if (nav.travel || nav.autoland || nav.stationLift || nav.mode !== 'flight' || nav.powered === false) return 'MANOEUVRE · WEAPONS LOCKED';
  if (nav.boost || nav.speed > combatSpeed(nav.shipId) + .5) return 'SLOW TO COMBAT SPEED · WEAPONS LOCKED';
  return 'WEAPONS READY';
}

// Ideal full-brake distance at the current attitude; terrain/aerodynamics may differ.
export function stoppingDistance(nav) {
  const h=shipHandling(nav.shipId),v=nav.velocity.clone().applyQuaternion(nav.orientation.clone().invert());
  return nav.speed*Math.hypot(v.x/h.rcs,v.y/h.rcs,v.z/h.thrust)/3;
}
