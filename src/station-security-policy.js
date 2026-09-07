import * as THREE from 'three';
import layout from '../assets/station-defense/layout.json' with {type:'json'};

export const AEON_STATION_ID = 'aeon-orbital';
export const STATION_PROTECTION_RADIUS = 30_000;
export const DEFENSE_LAYOUT = Object.freeze(layout);
// The authored exterior GLB quantizes its nominal −18/−92 m support planes.
// Use the measured decoded surfaces so all four foundations sit flush.
export const STATION_DEFENSE_MOUNTS = Object.freeze([-665, 665].flatMap((x, side) => [
  Object.freeze({id:`bastion-${side + 1}-upper`,position:[x,-17.997183184697576,0],rotation:[0,0,0,1]}),
  Object.freeze({id:`bastion-${side + 1}-lower`,position:[x,-92.0070038910506,0],rotation:[0,0,1,0]}),
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
  // Solve the actual outboard bore analytically. The target must lie beyond
  // the muzzle, not inside the barrel's swept radius; nearby unreachable
  // targets use another battery instead of a backward or converging fake ray.
  const horizontal=Math.hypot(relative.x,relative.z),lengthSquared=relative.lengthSq()-offset.x*offset.x;
  if(horizontal<=Math.abs(offset.x)||lengthSquared<=offset.z*offset.z)return null;
  const pitch=Math.atan2(relative.y,Math.sqrt(horizontal*horizontal-offset.x*offset.x));
  const yaw=Math.atan2(-relative.x,-relative.z)+Math.asin(offset.x/horizontal);
  const aim=new THREE.Quaternion().setFromAxisAngle(UP,yaw).multiply(new THREE.Quaternion().setFromAxisAngle(RIGHT,pitch));
  const origin = offset.applyQuaternion(aim).add(pivot).applyQuaternion(rotation).add(root);
  return {mountId:mount.id,barrel,yaw,pitch,origin,direction:FORWARD.clone().applyQuaternion(aim).applyQuaternion(rotation).normalize(),
    target:target.clone(),root,rotation};
}

export function selectDefensePose(station, target, barrel = 0) {
  const mounts = station.mounts ?? STATION_DEFENSE_MOUNTS;
  const poses = mounts.map(mount => defensePose(station,mount,target,barrel))
    .filter(pose=>pose&&pose.pitch>=-.2&&pose.pitch<=Math.PI/2&&pose.direction.dot(target.clone().sub(pose.origin).normalize())>1-1e-8);
  // Prefer an outward-facing platform; all strikes remain authoritative hitscan.
  poses.sort((a,b) => Number(b.pitch >= 0) - Number(a.pitch >= 0) || a.origin.distanceToSquared(target) - b.origin.distanceToSquared(target));
  return poses[0] ?? null;
}
