import * as THREE from 'three';
import layout from '../assets/station-defense/layout.json' with {type:'json'};

export const AEON_STATION_ID = 'aeon-orbital';
export const STATION_PROTECTION_RADIUS = 30_000;
export const DEFENSE_LAYOUT = Object.freeze(layout);
export const STATION_DEFENSE_MOUNTS = Object.freeze([-665, 665].flatMap((x, side) => [
  Object.freeze({id:`bastion-${side + 1}-upper`,position:[x,-18,0],rotation:[0,0,0,1]}),
  Object.freeze({id:`bastion-${side + 1}-lower`,position:[x,-92,0],rotation:[0,0,1,0]}),
]));
const finitePoint = point => point?.isVector3 && point.toArray().every(Number.isFinite);
const FORWARD = new THREE.Vector3(0,0,-1), UP = new THREE.Vector3(0,1,0), RIGHT = new THREE.Vector3(1,0,0);

/** Explicit registry entries allow later stations without creating player bubbles. */
export function securityStations(world) {
  if (Array.isArray(world.securityStations)) return world.securityStations;
  if (!finitePoint(world.center)) return [];
  return [{id:AEON_STATION_ID,center:world.center,orientation:world.station?.baseQuaternion ?? new THREE.Quaternion(),
    radius:STATION_PROTECTION_RADIUS,mounts:STATION_DEFENSE_MOUNTS}];
}

export function protectionAt(stations, point) {
  if (!finitePoint(point)) return null;
  return stations.find(station => finitePoint(station.center) && Number.isFinite(station.radius) && station.radius > 0 &&
    point.distanceToSquared(station.center) <= station.radius * station.radius) ?? null;
}

/** World doubles throughout. Both server strike and renderer use these exact
 * pivot/muzzle transforms; only the renderer subtracts its camera origin. */
export function defensePose(station, mount, target, barrel = 0) {
  const rotation = station.orientation.clone().multiply(new THREE.Quaternion().fromArray(mount.rotation));
  const root = new THREE.Vector3().fromArray(mount.position).applyQuaternion(station.orientation).add(station.center);
  const local = target.clone().sub(root).applyQuaternion(rotation.clone().invert());
  const pivot = new THREE.Vector3().fromArray(layout.pitchPivot);
  const offset = new THREE.Vector3().fromArray(layout.muzzles[barrel % layout.muzzles.length].position);
  const relative = local.clone().sub(pivot);
  let yaw = Math.atan2(-relative.x, -relative.z), pitch = Math.atan2(relative.y, Math.hypot(relative.x,relative.z));
  const aim = new THREE.Quaternion();
  // Account for the selected outboard barrel, rather than aiming its pivot and
  // drawing a beam several metres away from the physical bore at close range.
  for (let i = 0; i < 10; i++) {
    aim.setFromAxisAngle(UP,yaw).multiply(new THREE.Quaternion().setFromAxisAngle(RIGHT,pitch));
    const direction = relative.clone().sub(offset.clone().applyQuaternion(aim));
    yaw = Math.atan2(-direction.x,-direction.z);
    pitch = Math.atan2(direction.y,Math.hypot(direction.x,direction.z));
  }
  aim.setFromAxisAngle(UP,yaw).multiply(new THREE.Quaternion().setFromAxisAngle(RIGHT,pitch));
  const origin = offset.applyQuaternion(aim).add(pivot).applyQuaternion(rotation).add(root);
  return {mountId:mount.id,barrel,yaw,pitch,origin,direction:FORWARD.clone().applyQuaternion(aim).applyQuaternion(rotation).normalize(),
    target:target.clone(),root,rotation};
}

export function selectDefensePose(station, target, barrel = 0) {
  const mounts = station.mounts ?? STATION_DEFENSE_MOUNTS;
  const poses = mounts.map(mount => defensePose(station,mount,target,barrel));
  // Prefer an outward-facing platform; all strikes remain authoritative hitscan.
  poses.sort((a,b) => Number(b.pitch >= 0) - Number(a.pitch >= 0) || a.origin.distanceToSquared(target) - b.origin.distanceToSquared(target));
  return poses[0] ?? null;
}
