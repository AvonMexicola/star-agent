import { Vector3 } from 'three';
import { RADIUS, terrainHeight, MOON_RADIUS, MOON_POSITION, MOON_GRAVITY, moonSurface } from './world.js';

export const AEON=Object.freeze({id:'aeon',name:'Aeon',center:Object.freeze([0,0,0]),radius:RADIUS,gravity:9.81,airless:false});
export const SELENE=Object.freeze({id:'selene',name:'Selene',center:MOON_POSITION,radius:MOON_RADIUS,gravity:MOON_GRAVITY,airless:true});
// Explicit local navigation domain; this is not an N-body orbital solver.
export function bodyAt(position) {
  const dx=position.x-MOON_POSITION[0],dy=position.y-MOON_POSITION[1],dz=position.z-MOON_POSITION[2];
  return dx*dx+dy*dy+dz*dz<(MOON_RADIUS*8)**2?SELENE:AEON;
}
export function bodyOffset(position,body=bodyAt(position)) {return position.clone().sub(new Vector3(...body.center));}
export function bodyHeight(direction,body) {return body.airless?moonSurface(direction.x,direction.y,direction.z).height:Math.max(0,terrainHeight(direction.x,direction.y,direction.z));}
export function bodySurfacePoint(direction,body,clearance=0) {
  const d=direction.clone().normalize();return d.multiplyScalar(body.radius+bodyHeight(d,body)+clearance).add(new Vector3(...body.center));
}
export function bodyAltitude(position,body=bodyAt(position)) {
  const local=bodyOffset(position,body),radius=local.length();if(radius===0)return -body.radius;
  return radius-body.radius-bodyHeight(local.divideScalar(radius),body);
}
export function bodySurfaceNormal(position,body=bodyAt(position)) {
  const radial=bodyOffset(position,body).normalize(),east=new Vector3().crossVectors(Math.abs(radial.y)<.9?new Vector3(0,1,0):new Vector3(1,0,0),radial).normalize();
  const north=new Vector3().crossVectors(radial,east),step=.5/body.radius;
  const sample=(axis,sign)=>bodyHeight(radial.clone().addScaledVector(axis,step*sign).normalize(),body);
  const dx=sample(east,1)-sample(east,-1),dy=sample(north,1)-sample(north,-1);
  return radial.addScaledVector(east,-dx).addScaledVector(north,-dy).normalize();
}
