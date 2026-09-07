import * as THREE from 'three';
import { SHIP_LAYOUT, shipFloorAt } from './boarding.js';

export const EVA = Object.freeze({ acceleration: 3.5, boostAcceleration: 7, maxSpeed: 12, boostSpeed: 24, brakeRate: 6, turnRate: .85 });

/** Exact constant-thrust integration in world doubles. Release thrust to coast. */
export function stepEVA(velocity, orientation, translation, dt, { boost=false, brake=false }={}) {
  const duration=Math.max(0,Math.min(dt,.25)), next=velocity.clone();
  const acceleration=translation.clone().clampLength(0,1).applyQuaternion(orientation).multiplyScalar(boost?EVA.boostAcceleration:EVA.acceleration);
  let displacement;
  if(brake){
    const decay=Math.exp(-EVA.brakeRate*duration);
    displacement=next.clone().multiplyScalar((1-decay)/EVA.brakeRate);next.multiplyScalar(decay);
    if(next.length()<.01)next.set(0,0,0);
  }else{
    const limit=boost?EVA.boostSpeed:EVA.maxSpeed;
    // Small fixed upper bound keeps speed-cap integration consistent at low FPS.
    const steps=Math.max(1,Math.ceil(duration*120)), h=duration/steps;
    displacement=new THREE.Vector3();
    for(let i=0;i<steps;i++){
      const before=next.clone();next.addScaledVector(acceleration,h).clampLength(0,limit);
      displacement.add(before.add(next).multiplyScalar(h*.5));
    }
  }
  return {velocity:next,displacement};
}

const radius=SHIP_LAYOUT.capsuleRadius;
// The suit capsule extends 1.5 m below its eye and .2 m above it. These are
// actual cabin surfaces, not infinite walking walls projected through space.
export const EVA_SHIP_BOXES=[
  [-1.85,1.85,.8,1,-4.7,4], [-1.85,1.85,4.1,4.3,-4.7,4],
  [-1.85,-1.65,1,4.1,-4.7,4], [1.65,1.85,1,4.1,-4.7,4],
  [-1.85,1.85,1,4.1,-4.7,-4.5],
  [-1.85,-.9,1,4.1,3.8,4.1], [.9,1.85,1,4.1,3.8,4.1],
  [.93,1.65,1,2.08,.35,1.95],
  [-6.05,-1.85,.5,1.25,-2,3], [1.85,6.05,.5,1.25,-2,3],
  [-1.6,1.6,.8,3.5,-6.82,-4.7],
];
function entry(previous,proposed,box){
  const lo=[box[0]-radius,box[2]-.2,box[4]-radius],hi=[box[1]+radius,box[3]+1.5,box[5]+radius];
  let first=0,last=1;
  const p=previous.toArray(),q=proposed.toArray();
  // Avoid trapping a suit which already overlaps a changing doorway.
  if(p.every((v,i)=>v>lo[i]&&v<hi[i]))return null;
  for(let i=0;i<3;i++){
    const d=q[i]-p[i];
    if(Math.abs(d)<1e-12){if(p[i]<=lo[i]||p[i]>=hi[i])return null;continue;}
    const a=(lo[i]-p[i])/d,b=(hi[i]-p[i])/d;
    first=Math.max(first,Math.min(a,b));last=Math.min(last,Math.max(a,b));
    if(first>=last)return null;
  }
  return first<1&&last>0?first:null;
}
export function constrainEVAShip(previous,proposed,doorOpen){
  let fraction=1;
  for(const box of doorOpen?EVA_SHIP_BOXES:[...EVA_SHIP_BOXES,[-.9,.9,1,4.1,3.8,4.1]]){
    const hit=entry(previous,proposed,box);if(hit!==null)fraction=Math.min(fraction,Math.max(0,hit-1e-4));
  }
  return {point:previous.clone().lerp(proposed,fraction),hit:fraction<1};
}
export function canAttachRamp(local,doorOpen,speed){
  if(!doorOpen||speed>4||Math.abs(local.x)>.65||local.z<3.9||local.z>7.2)return false;
  const floor=shipFloorAt(local.x,local.z,true);
  return floor!==null&&Math.abs(local.y-floor-SHIP_LAYOUT.eyeHeight)<.45;
}
