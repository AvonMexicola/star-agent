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
