import * as THREE from 'three';
import { EVA_SHIP_BOXES } from '../eva.js';
import { FreighterSystems } from '../freighter-layout.js';
import { localPoint } from './access.js';
import { crateBounds,crateSize,placeCrate } from './grid.js';
import { bodyAltitude } from '../celestial.js';
import { constrainShipAttachments } from '../ship-attachment-collision.js';

const sealedAtlas=new FreighterSystems();
export const TRACTOR_RANGE=12,TRACTOR_LEASE_MS=1500,TRACTOR_INTERVAL=.2;
export const tractorSpeed=sbu=>4/Math.cbrt(sbu);
const v=a=>new THREE.Vector3(...a),q=a=>new THREE.Quaternion(...a);
export const crateCentre=(hull,c)=>{const b=crateBounds(hull,c);return v(b.min).add(v(b.max)).multiplyScalar(.5);};
export const detachedPose=(ship,c)=>({position:crateCentre(ship.hull,c).applyQuaternion(ship.pose.quaternion).add(ship.pose.position).toArray(),quaternion:ship.pose.quaternion.toArray()});
export function tractorHullParts(s){
  if(s.hull==='nomad')return [...EVA_SHIP_BOXES,...(s.open?[]:[[-.9,.9,1,4.1,3.8,4.1]])].map(b=>({min:[b[0],b[2],b[4]],max:[b[1],b[3],b[5]]})).concat([
    // Conservative upper cabin liner, beneath the exterior roof.
    {min:[-1.67,3.16,-4],max:[1.67,4.1,3.94]},
    {min:[-1.6,1,-1.1],max:[-.8,1.75,2.2]},
  ]);
  return s.hull==='atlas'?(s.systems??sealedAtlas).evaParts:[];
}
function halfExtents(sbu,rotation){
  const h=v(crateSize(sbu)).multiplyScalar(.5).addScalar(-.008),m=new THREE.Matrix4().makeRotationFromQuaternion(rotation).elements;
  return new THREE.Vector3(Math.abs(m[0])*h.x+Math.abs(m[4])*h.y+Math.abs(m[8])*h.z,Math.abs(m[1])*h.x+Math.abs(m[5])*h.y+Math.abs(m[9])*h.z,Math.abs(m[2])*h.x+Math.abs(m[6])*h.y+Math.abs(m[10])*h.z);
}
function crosses(a,b,part,half=new THREE.Vector3()){
  const box=new THREE.Box3(v(part.min).sub(half),v(part.max).add(half)),delta=b.clone().sub(a),length=delta.length();
  if(box.containsPoint(a))return true;
  if(length<1e-9)return box.containsPoint(b);
  const hit=new THREE.Ray(a,delta.divideScalar(length)).intersectBox(box,new THREE.Vector3());
  return Boolean(hit&&a.distanceTo(hit)<length-1e-5);
}
/** Sweep the entire crate, using a conservative rotated envelope in each hull.
 * Camera/world doubles stay doubles until the presentation subtracts its origin. */
export function tractorClear(a,b,crate,ships,loose=[],{beam=false,worldClear=()=>true}={}){
  for(const s of ships){
    if(!s.pose||Math.min(a.distanceTo(s.pose.position),b.distanceTo(s.pose.position))>70)continue;
    const start=localPoint(a,s.pose),end=localPoint(b,s.pose),rotation=s.pose.quaternion.clone().invert().multiply(q(crate.quaternion));
    const half=beam?new THREE.Vector3():halfExtents(crate.sbu,rotation);
    const parts=[...tractorHullParts(s),...s.crates.filter(c=>c.id!==crate.id).map(c=>crateBounds(s.hull,c))];
    if(parts.some(part=>crosses(start,end,part,half)))return false;
  }
  for(const other of loose){if(other.id===crate.id)continue;const pose={position:v(other.position),quaternion:q(other.quaternion)},h=v(crateSize(other.sbu)).multiplyScalar(.5);
    const half=beam?new THREE.Vector3():halfExtents(crate.sbu,pose.quaternion.clone().invert().multiply(q(crate.quaternion)));
    if(crosses(localPoint(a,pose),localPoint(b,pose),{min:h.clone().negate().toArray(),max:h.toArray()},half))return false;
  }
  return worldClear(a,b,beam?null:crate);
}
export function aimedCrate(eye,orientation,ships,loose=[],worldClear){
  const ray=new THREE.Ray(eye,new THREE.Vector3(0,0,-1).applyQuaternion(orientation)),candidates=[];
  for(const s of ships)if(s.pose)for(const c of s.crates)candidates.push({...c,...detachedPose(s,c),ship:s.id});
  candidates.push(...loose);
  let selected=null;
  for(const c of candidates){const pose={position:v(c.position),quaternion:q(c.quaternion)},h=v(crateSize(c.sbu)).multiplyScalar(.5),direction=ray.direction.clone().applyQuaternion(pose.quaternion.clone().invert()),local=localPoint(eye,pose);
    const hit=new THREE.Ray(local,direction).intersectBox(new THREE.Box3(h.clone().negate(),h),new THREE.Vector3());if(!hit)continue;
    const point=hit.applyQuaternion(pose.quaternion).add(pose.position),distance=eye.distanceTo(point);
    if(distance>TRACTOR_RANGE||selected&&distance>=selected.distance)continue;
    if(tractorClear(eye,point,c,ships,loose,{beam:true,worldClear}))selected={...c,point,distance};
  }
  return selected;
}
export function tractorStep(c,eye,orientation,distance,elapsed,ships,loose,worldClear){
  const start=v(c.position),length=THREE.MathUtils.clamp(Number.isFinite(distance)?distance:4,.8,TRACTOR_RANGE-1);
  if(start.distanceTo(eye)>TRACTOR_RANGE+Math.hypot(...crateSize(c.sbu))/2)return null;
  const target=new THREE.Vector3(0,0,-length).applyQuaternion(orientation).add(eye),end=start.clone().add(target.sub(start).clampLength(0,tractorSpeed(c.sbu)*Math.min(.25,Math.max(0,elapsed))));
  if(!tractorClear(eye,start,c,ships,loose,{beam:true,worldClear}))return null;
  const relative=eye.clone().sub(end).applyQuaternion(q(c.quaternion).invert()),half=v(crateSize(c.sbu)).multiplyScalar(.5).addScalar(.35);
  if(Math.abs(relative.x)<half.x&&Math.abs(relative.y)<half.y&&Math.abs(relative.z)<half.z)return start;
  return tractorClear(start,end,c,ships,loose,{worldClear})?end:start;
}
export function constrainLooseCargo(previous,proposed,loose,{eva=false,eyeHeight=1.75}={}){
  let point=proposed.clone();
  for(const c of loose){if(previous.distanceTo(v(c.position))>20)continue;const pose={position:v(c.position),quaternion:q(c.quaternion)},half=v(crateSize(c.sbu)).multiplyScalar(.5);
    const local=constrainShipAttachments(localPoint(previous,pose),localPoint(point,pose),[{min:half.clone().negate().toArray(),max:half.toArray()}],{eva,eyeHeight});point=local.applyQuaternion(pose.quaternion).add(pose.position);
  }
  return point;
}
/** Shared canonical terrain and station collision. Nine parallel sweeps test
 * the full envelope as well as the centre, not just the beam's thin ray. */
export function tractorWorldClear(nav,station,occludes){
  return (a,b,c)=>{
    const half=c?v(crateSize(c.sbu)).multiplyScalar(.5).addScalar(-.01):new THREE.Vector3(.002,.002,.002);
    const sweep=station?.constrainStep?.(a,b,c?q(c.quaternion):new THREE.Quaternion(),false,{seatEye:[0,0,0],flightBounds:{min:half.clone().negate().toArray(),max:half.toArray()}});
    if(sweep?.hit&&sweep.point.distanceTo(b)>.01)return false;
    const offsets=[new THREE.Vector3()];
    if(c){const half=v(crateSize(c.sbu)).multiplyScalar(.5).addScalar(-.01);for(let bits=0;bits<8;bits++)offsets.push(new THREE.Vector3(bits&1?half.x:-half.x,bits&2?half.y:-half.y,bits&4?half.z:-half.z).applyQuaternion(q(c.quaternion)));}
    for(const offset of offsets){const start=a.clone().add(offset),end=b.clone().add(offset),delta=end.clone().sub(start),length=delta.length();
      if(nav.altitude<50&&bodyAltitude(end,nav.body)<.002)return false;
      const pad=nav.cargoLandingSurface?.(end);if(pad&&end.clone().sub(pad.point).dot(pad.up)<-.005)return false;
      if(length>.00001){const distance=occludes?.(start,delta.clone().normalize(),length);if(Number.isFinite(distance)&&distance<length-.01)return false;}
    }
    return true;
  };
}
export function tractorSlot(ship,c,eye,ships,loose,worldClear){
  if(!ship?.pose)return null;
  const placed=placeCrate(ship.hull,ship.crates,{id:c.id,sbu:c.sbu,resource:c.resource});if(!placed)return null;
  const position=crateCentre(ship.hull,placed).applyQuaternion(ship.pose.quaternion).add(ship.pose.position);
  if(position.distanceTo(eye)>TRACTOR_RANGE||position.distanceTo(v(c.position))>1.6||q(c.quaternion).angleTo(ship.pose.quaternion)>.05)return null;
  // The slot is reached physically; securing cannot teleport through a bulkhead.
  if(!tractorClear(v(c.position),position,c,ships,loose,{worldClear}))return null;
  return {placed,position,quaternion:ship.pose.quaternion};
}
