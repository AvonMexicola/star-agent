import * as THREE from 'three';
/** Closed pressure shells stop rays even when their glazing is transparent.
 * Local double-precision slabs match the authored manufactured shell extents. */
const SHELLS=[
  new THREE.Box3(new THREE.Vector3(-.88,.40,-1.70),new THREE.Vector3(.88,2.50,.78)),
  new THREE.Box3(new THREE.Vector3(-.85,1.06,.78),new THREE.Vector3(.85,2.68,2.15)),
];
export function sentryBodyDistance(origin,direction,position,quaternion){
  const inverse=quaternion.clone().invert(),ray=new THREE.Ray(origin.clone().sub(position).applyQuaternion(inverse),direction.clone().applyQuaternion(inverse));
  let distance=Infinity;
  for(const box of SHELLS){const hit=ray.intersectBox(box,new THREE.Vector3());if(hit)distance=Math.min(distance,hit.distanceTo(ray.origin));}
  return distance;
}
