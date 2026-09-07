import * as THREE from 'three';
import { localPoint,hullLayout } from './access.js';
import { shipFloorAt,constrainShipStep } from '../boarding.js';
import { constrainShipAttachments } from '../ship-attachment-collision.js';
import { crateBounds } from './grid.js';
import { constrainEVAShip } from '../eva.js';
import { LIFTS } from '../freighter-layout.js';
/** Physical open-cabin boarding for other ships. No player-position assignment
 * to a seat, no range teleport. An approach must cross the real floor/ramp. */
export function walkForeignShips(previous,proposed,ships){
  let point=proposed.clone(),grounded=false,hit=false;
  for(const s of ships){
    if(previous.distanceTo(s.pose.position)>45)continue;
    const a=localPoint(previous,s.pose),b=localPoint(point,s.pose),l=hullLayout(s.hull);
    let floor=null,next=b;
    if(s.hull==='nomad'){
      floor=shipFloorAt(b.x,b.z,s.open);
      next=constrainShipStep(a,b,s.open);
    }else if(s.hull==='atlas'&&s.systems){floor=s.systems.floorAt(b);next=s.systems.constrain(a,b);}
    if(a.y>l.floorY-.15&&a.y-l.eyeHeight<l.floorY+3&&next.distanceToSquared(b)>1e-12){point=next.clone().applyQuaternion(s.pose.quaternion).add(s.pose.position);hit=true;}
    const oldFoot=a.y-l.eyeHeight;
    if(floor!==null&&Math.abs(oldFoot-floor)<.45){
      next=constrainShipAttachments(a,next,s.crates.map(c=>crateBounds(s.hull,c)));next.y=floor+l.eyeHeight;grounded=true;hit=true;
      point=next.applyQuaternion(s.pose.quaternion).add(s.pose.position);
    }
  }
  return {point,grounded,hit};
}
/** EVA must cross an opening too; a foreign closed hull is not a loot shortcut. */
export function constrainCargoEVA(previous,proposed,ships){
  let point=proposed.clone(),hit=false;
  for(const s of ships){
    if(previous.distanceTo(s.pose.position)>50)continue;
    const a=localPoint(previous,s.pose),b=localPoint(point,s.pose);
    let next=b;
    if(s.hull==='nomad')next=constrainEVAShip(a,b,s.open).point;
    if(s.hull==='atlas'){
      const parts=[
        {min:[-6.3,4,-12.3],max:[-6,9.5,10.3]}, {min:[6,4,-12.3],max:[6.3,9.5,10.3]},
        {min:[-6,9.3,-12.3],max:[6,9.5,10.3]}, {min:[-6,4,-12.3],max:[6,9.3,-12]},
        {min:[-6,4,10],max:[6,9.3,10.3]},
        {min:[-6,3.75,-12],max:[-4,4,10]}, {min:[4,3.75,-12],max:[6,4,10]},
        {min:[-4,3.75,-12],max:[4,4,0]},
        ...(s.systems?.lifts??LIFTS.map(l=>({...l,y:l.id==='main'?l.high:l.low}))).map(l=>({min:[l.minX,l.y-.2,l.minZ],max:[l.maxX,l.y,l.maxZ]})),
      ];
      next=constrainShipAttachments(a,b,parts,{eva:true});
    }
    next=constrainShipAttachments(a,next,s.crates.map(c=>crateBounds(s.hull,c)),{eva:true});
    if(!next.equals(b)){point=next.applyQuaternion(s.pose.quaternion).add(s.pose.position);hit=true;}
  }
  return {point,hit};
}
