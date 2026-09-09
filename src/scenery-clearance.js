import {Quaternion,Vector3} from 'three';
import {getPlacementBounds} from './build/collision.js';

/** Visual scenery clearance from actual authored construction footprints.
 * Inputs are body-frame world doubles; candidates are body-centred doubles.
 * Terrain, mining deposits and navigation/collision authority are unchanged. */
export class SceneryClearance{
 constructor(center){this.center=new Vector3(...center);this.key='';this.frames=[];this.excludes=(point,radius=0)=>this.frames.some(frame=>{const p=point.clone().sub(frame.origin).applyQuaternion(frame.inverse);return frame.bounds.some(b=>{const dx=Math.max(b.min[0]-p.x,0,p.x-b.max[0]),dz=Math.max(b.min[2]-p.z,0,p.z-b.max[2]);return dx*dx+dz*dz<=radius*radius;});});}
 update(claims=[]){
  // Power ticks, appearance edits and door animation do not change footprints.
  const key=JSON.stringify(claims.map(c=>[c.origin,c.quaternion,c.pieces.map(p=>[p.type,p.position,p.rotation??0])]));
  if(key===this.key)return false;this.key=key;
  this.frames=claims.map(c=>{const bounds=c.pieces.map(p=>getPlacementBounds({...p,doorOpen:false})).filter(Boolean),contains=(a,b)=>a.min[0]<=b.min[0]&&a.max[0]>=b.max[0]&&a.min[2]<=b.min[2]&&a.max[2]>=b.max[2];return {origin:new Vector3(...c.origin).sub(this.center),inverse:new Quaternion(...c.quaternion).invert(),bounds:bounds.filter((b,i)=>!bounds.some((other,j)=>j!==i&&contains(other,b)&&(!contains(b,other)||j<i)))};});return true;
 }
}
