import { MIASMA_RADIUS, MIASMA_POSITION, MIASMA_ATMOSPHERE, miasmaSurface } from './miasma-world.js';
import { Vector3 } from 'three';
import { SUN_POSITION, SUN_NAME, SUN_HEAT_RANGE } from './stellar-world.js';
import { SUN_RADIUS } from './world.js';
import { RADIUS, terrainHeight, MOON_RADIUS, MOON_POSITION, MOON_GRAVITY, moonSurface } from './world.js';
import { PYRE_RADIUS, PYRE_POSITION, PYRE_GRAVITY, PYRE_ATMOSPHERE, pyreSurface } from './pyre-world.js';

// Each descriptor carries its own canonical sampler; `water` bodies clamp to sea level.
export const AEON=Object.freeze({id:'aeon',name:'Aeon',center:Object.freeze([0,0,0]),radius:RADIUS,gravity:9.81,airless:false,water:true,height:(x,y,z)=>Math.max(0,terrainHeight(x,y,z))});
export const SELENE=Object.freeze({id:'selene',name:'Selene',center:MOON_POSITION,radius:MOON_RADIUS,gravity:MOON_GRAVITY,airless:true,water:false,height:(x,y,z)=>moonSurface(x,y,z).height});
export const PYRE=Object.freeze({id:'pyre',name:'Pyre',center:PYRE_POSITION,radius:PYRE_RADIUS,gravity:PYRE_GRAVITY,airless:false,water:false,atmosphere:PYRE_ATMOSPHERE,height:(x,y,z)=>pyreSurface(x,y,z).height});
export const MIASMA=Object.freeze({id:'miasma',name:'Miasma',center:MIASMA_POSITION,radius:MIASMA_RADIUS,gravity:2.1,airless:false,water:false,toxic:true,atmosphere:MIASMA_ATMOSPHERE,height:(x,y,z)=>miasmaSurface(x,y,z).height});
export const STAR=Object.freeze({id:'star',name:SUN_NAME,center:SUN_POSITION,radius:SUN_RADIUS,gravity:0,airless:true,water:false,star:true,height:()=>0});
export const BODIES=Object.freeze([AEON,SELENE,PYRE,MIASMA,STAR]);
// Explicit local navigation domains (8 radii); this is not an N-body orbital solver.
export function bodyAt(position) {
  for(const body of [MIASMA,SELENE,PYRE]){
    const dx=position.x-body.center[0],dy=position.y-body.center[1],dz=position.z-body.center[2];
    if(dx*dx+dy*dy+dz*dz<(body.radius*8)**2)return body;
  }
  if(position.distanceTo(new Vector3(...SUN_POSITION))<SUN_HEAT_RANGE)return STAR;
  return AEON;
}
export function bodyOffset(position,body=bodyAt(position)) {return position.clone().sub(new Vector3(...body.center));}
export function bodyHeight(direction,body) {return body.height(direction.x,direction.y,direction.z);}
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
