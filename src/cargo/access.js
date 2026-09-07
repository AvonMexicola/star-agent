import * as THREE from 'three';
import { CARGO_GRIDS, crateBounds } from './grid.js';
import { SHIP_LAYOUT } from '../boarding.js';
import { FREIGHTER_LAYOUT } from '../freighter-layout.js';
export const hullLayout=hull=>hull==='atlas'?FREIGHTER_LAYOUT:SHIP_LAYOUT;
export function shipPose(nav){
  const quaternion=nav.shipPosition?nav.shipOrientation:nav.orientation;
  const position=nav.shipPosition??nav.position.clone().sub(new THREE.Vector3(...nav.layout.seatEye).applyQuaternion(quaternion));
  return {position,quaternion};
}
export function localPoint(position,pose){return position.clone().sub(pose.position).applyQuaternion(pose.quaternion.clone().invert());}
export function aboard(position,pose,hull){
  const p=localPoint(position,pose),l=hullLayout(hull),b=l.interior;
  return p.x>b.minX&&p.x<b.maxX&&p.z>b.minZ&&p.z<b.maxZ&&p.y>=l.floorY+l.eyeHeight-.3&&p.y<=l.floorY+5;
}
export function nearCrate(position,pose,hull,crate,range=2.2){
  const b=crateBounds(hull,crate);if(!b)return false;
  const p=localPoint(position,pose),nearest=new THREE.Vector3(...b.min).clamp(new THREE.Vector3(...b.min),new THREE.Vector3(...b.max));
  nearest.copy(p).clamp(new THREE.Vector3(...b.min),new THREE.Vector3(...b.max));
  return p.distanceTo(nearest)<=range;
}
export function nearGrid(position,pose,hull){
  const p=localPoint(position,pose);
  return (CARGO_GRIDS[hull]??[]).some(g=>p.distanceTo(p.clone().clamp(new THREE.Vector3(...g.min),new THREE.Vector3(...g.min.map((v,i)=>v+g.cells[i]*.6))))<2.2);
}
/** Recognise the visible grid volume, including the side of a long container. */
export function aimedGrid(position,orientation,pose,hull){
  if(!aboard(position,pose,hull)||!nearGrid(position,pose,hull))return false;
  const eye=localPoint(position,pose),direction=new THREE.Vector3(0,0,-1).applyQuaternion(orientation).applyQuaternion(pose.quaternion.clone().invert());
  const ray=new THREE.Ray(eye,direction),hit=new THREE.Vector3();
  return (CARGO_GRIDS[hull]??[]).some(g=>{
    const box=new THREE.Box3(new THREE.Vector3(...g.min),new THREE.Vector3(...g.min.map((v,i)=>v+g.cells[i]*.6)));
    return ray.intersectBox(box,hit)&&eye.distanceTo(hit)<3.2;
  });
}
