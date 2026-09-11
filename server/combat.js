import { navigationShipFrame } from '../src/navigation-rotation.js';
import { betweenFrames, frameRotation } from '../src/planet-rotation.js';
/** Authoritative hitscan. Call only with room-owned player/navigation objects;
 * no ray, target, distance or damage from a network message is accepted. */
import * as THREE from 'three';
import { WEAPON_RULES } from '../src/multiplayer/protocol.js';
import { SHIP_LAYOUT } from '../src/boarding.js';
import { FREIGHTER_LAYOUT } from '../src/freighter-layout.js';
import { bodyAt, bodyHeight } from '../src/celestial.js';
import { constrainStationSweep } from '../src/station-collision.js';

const UP = new THREE.Vector3(0, 1, 0);
const RADIUS = SHIP_LAYOUT.capsuleRadius;
const EPSILON = 1e-8;
const finiteVector = v => v?.isVector3 && Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z);
const finiteQuaternion = q => q?.isQuaternion && [q.x, q.y, q.z, q.w].every(Number.isFinite) && q.lengthSq() > .99 && q.lengthSq() < 1.01;

export function playerUp(nav) {
  if (nav.mode === 'eva') return UP.clone().applyQuaternion(nav.orientation).normalize();
  const grid=nav.stationPhysics;
  if(grid)return grid.up.clone();
  if (nav.shipPosition && nav.position.distanceToSquared(nav.shipPosition) < 625) return UP.clone().applyQuaternion(nav.shipOrientation).normalize();
  if (finiteVector(nav.normal) && nav.normal.lengthSq() > .5) return nav.normal.clone().normalize();
  return nav.position.clone().sub(new THREE.Vector3(...bodyAt(nav.position).center)).normalize();
}

function sphereHit(offset, direction, radius) {
  const c = offset.lengthSq() - radius * radius;
  if (c <= 0) return 0;
  const b = offset.dot(direction), discriminant = b * b - c;
  if (discriminant < 0) return Infinity;
  const t = -b - Math.sqrt(discriminant);
  return t >= 0 ? t : Infinity;
}

/** Exact ray/capsule intersection in a small frame relative to the target eye. */
export function capsuleDistance(origin, direction, eye, up, radius = RADIUS, eyeHeight = SHIP_LAYOUT.eyeHeight) {
  const bottom = eye.clone().addScaledVector(up, -eyeHeight + radius);
  const length = eyeHeight + .2 - 2 * radius;
  const fromBottom = origin.clone().sub(bottom);
  const along = fromBottom.dot(up), speed = direction.dot(up);
  const perpendicular = fromBottom.clone().addScaledVector(up, -along);
  const lateral = direction.clone().addScaledVector(up, -speed);
  if (along >= 0 && along <= length && perpendicular.lengthSq() <= radius * radius) return 0;
  let distance = Math.min(sphereHit(fromBottom, direction, radius), sphereHit(fromBottom.clone().addScaledVector(up, -length), direction, radius));
  const a = lateral.lengthSq(), b = perpendicular.dot(lateral), c = perpendicular.lengthSq() - radius * radius;
  const disc = b * b - a * c;
  if (a > EPSILON && disc >= 0) {
    const t = (-b - Math.sqrt(disc)) / a;
    const y = along + t * speed;
    if (t >= 0 && y >= 0 && y <= length) distance = Math.min(distance, t);
  }
  return distance;
}

export function shipPose(player) {
  const nav = player.nav;
  if (!nav?.shipPosition && !['flight', 'landed', 'crashed'].includes(nav?.mode)) return null;
  const layout = nav.layout || (nav.shipId === 'atlas' ? FREIGHTER_LAYOUT : SHIP_LAYOUT);
  const rotation = nav.shipPosition ? nav.shipOrientation : nav.orientation;
  if (!finiteQuaternion(rotation)) return null;
  const position = nav.shipPosition?.clone() || nav.position.clone().sub(new THREE.Vector3(...layout.seatEye).applyQuaternion(rotation));
  return { position, rotation, bounds: layout.flightBounds, ...(nav.rotationClock?{frame:navigationShipFrame(nav)}:{}) };
}

/** Ray/slab intersection, subtracting the world hull root before rotation. A
 * ray that starts inside reaches the exit hull; it does not hit at distance 0. */
export function shipDistance(origin, direction, position, rotation, bounds) {
  const inverse = rotation.clone().invert();
  const point = origin.clone().sub(position).applyQuaternion(inverse);
  const ray = direction.clone().applyQuaternion(inverse);
  let near = -Infinity, far = Infinity;
  for (let axis = 0; axis < 3; axis++) {
    const p = point.getComponent(axis), d = ray.getComponent(axis);
    if (Math.abs(d) < EPSILON) {
      if (p < bounds.min[axis] || p > bounds.max[axis]) return Infinity;
      continue;
    }
    const a = (bounds.min[axis] - p) / d, b = (bounds.max[axis] - p) / d;
    near = Math.max(near, Math.min(a, b));
    far = Math.min(far, Math.max(a, b));
    if (near > far) return Infinity;
  }
  if (far < 0) return Infinity;
  return near >= 0 ? near : far;
}

function terrainDistance(origin, direction, limit) {
  const point = new THREE.Vector3(), local = new THREE.Vector3();
  const clearance = t => {
    point.copy(origin).addScaledVector(direction, t);
    const body = bodyAt(point);
    local.copy(point).sub(new THREE.Vector3(...body.center));
    const radius = local.length();
    if (!radius) return -body.radius;
    local.divideScalar(radius);
    return radius - body.radius - bodyHeight(local, body);
  };
  if (clearance(0) <= 0) return 0;
  // Maximum gun range is 250 m. Half-metre sampling keeps this bounded; refine
  // the first surface crossing against the exact canonical sampler to <1 cm.
  let previous = 0;
  for (let t = Math.min(.5, limit); t <= limit && t > previous; t = Math.min(t + .5, limit)) {
    if (clearance(t) <= 0) {
      let lo = previous, hi = t;
      for (let i = 0; i < 7; i++) { const mid = (lo + hi) / 2; if (clearance(mid) > 0) lo = mid; else hi = mid; }
      return hi;
    }
    previous = t;
  }
  return Infinity;
}

export function worldDistance(world, origin, direction, range) {
  let distance = range;
  const endpoint = origin.clone().addScaledVector(direction, range);
  const min = new THREE.Vector3(-.004, -.004, -.004), max = min.clone().negate();
  for (const pod of world?.pods || []) {
    if (pod.ready === false) continue;
    const start = pod.toLocal(origin, new THREE.Vector3());
    const end = pod.toLocal(endpoint, new THREE.Vector3());
    const hit = constrainStationSweep(pod.colliders, pod.doorBoxes || [], start, end, min, max);
    if (hit.hit) distance = Math.min(distance, start.distanceTo(hit.point));
  }
  // Optional authoritative additional occluder for room fixtures/other scenery.
  // Return a distance in metres, true for an immediate obstruction, or null.
  if (world?.occludes) {
    const hit = world.occludes(origin.clone(), direction.clone(), range);
    if (hit === true) distance = 0;
    else if (typeof hit === 'number' && Number.isFinite(hit) && hit >= 0) distance = Math.min(distance, hit);
  }
  return Math.min(distance, terrainDistance(origin, direction, distance));
}

/**
 * @returns null for rejected fire, otherwise the authoritative visual event.
 * An accepted miss still spends one charge and advances the cooldown. Empty
 * hands/mining tools, missing pack weapons, dead players and pilots cannot fire.
 */
export function shoot({ shooter, players, world, now, deferDamage = false, vehicleHit = () => null }) {
  const nav = shooter?.nav;
  const rules = typeof shooter?.weapon === 'string' && Object.hasOwn(WEAPON_RULES, shooter.weapon) ? WEAPON_RULES[shooter.weapon] : null;
  const pack = shooter?.inventory?.containers?.pack;
  if (!rules || !nav || !['walk', 'eva'].includes(nav.mode) || !Number.isFinite(shooter.health) || shooter.health <= 0) return null;
  if (!Number.isFinite(now) || now < 0 || !finiteVector(nav.position) || !finiteQuaternion(nav.orientation)) return null;
  if (!Number.isSafeInteger(pack?.[shooter.weapon]) || pack[shooter.weapon] < 1 || !Number.isSafeInteger(pack[rules.ammo]) || pack[rules.ammo] < 1) return null;
  if (Number.isFinite(shooter.lastShotAt) && now - shooter.lastShotAt < rules.interval * 1000 - .001) return null;
  const origin = nav.position.clone();
  const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(nav.orientation).normalize();
  let distance = worldDistance(world, origin, direction, rules.range), target = null, kind = null;
  const vehicle=vehicleHit(origin,direction,distance);
  if(vehicle&&vehicle.distance<distance){distance=vehicle.distance;if(vehicle.health>0){target=vehicle;kind='vehicle';}}
  const candidates = players instanceof Map ? players.values() : players;
  for (const player of candidates || []) {
    if (!player?.nav || !finiteVector(player.nav.position)) continue;
    const ship = shipPose(player);
    if (ship) {
      if(nav.rotationClock){
        betweenFrames(ship.position,ship.frame,nav.rotationFrame,nav.rotationTime,ship.position);
        ship.rotation=frameRotation(ship.frame,nav.rotationFrame,nav.rotationTime).multiply(ship.rotation);
      }
      const hit = shipDistance(origin, direction, ship.position, ship.rotation, ship.bounds);
      if (hit < distance) {
        distance = hit;
        // Own hull and wrecks still block the ray, without self damage.
        target = player.id !== shooter.id && Number.isFinite(player.shipHealth) && player.shipHealth > 0 ? player : null;
        kind = target ? 'ship' : null;
      }
    }
    if (player.id === shooter.id || !['walk', 'eva'].includes(player.nav.mode) || !Number.isFinite(player.health) || !(player.health > 0)) continue;
    const eye=nav.rotationClock?betweenFrames(player.nav.position,player.nav.rotationFrame,nav.rotationFrame,nav.rotationTime):player.nav.position;
    const up=playerUp(player.nav);if(nav.rotationClock)up.applyQuaternion(frameRotation(player.nav.rotationFrame,nav.rotationFrame,nav.rotationTime));
    const hit = capsuleDistance(origin, direction, eye, up);
    if (hit < distance) { distance = hit; target = player; kind = 'player'; }
  }
  pack[rules.ammo]--;
  shooter.inventory.revision = (shooter.inventory.revision || 0) + 1;
  shooter.lastShotAt = now;
  let damage = 0;
  if (target) {
    const key = kind === 'ship' ? 'shipHealth' : 'health';
    damage = Math.min(target[key], rules.damage);
    if (!deferDamage) target[key] = Math.max(0, target[key] - damage);
  }
  return { origin: origin.toArray(), direction: direction.toArray(), weapon: shooter.weapon,
    ...(target ? { targetId: target.id } : {}), damage, distance, kind };
}
