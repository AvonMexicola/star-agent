import {Vector3} from 'three';
import {bodyAt,bodyOffset,bodySurfacePoint,bodySurfaceNormal} from './celestial.js';
import {roverFootprint,roverFitsPlatform} from './rover-physics.js';
import {ROVER_LAYOUT} from './rover-layout.js';
const UP=new Vector3(0,1,0);
const inside=(p,b)=>p.x>=b.minX&&p.x<=b.maxX&&p.z>=b.minZ&&p.z<=b.maxZ;
export const roverShipLocal=(point,frame)=>point.clone().sub(frame.position).applyQuaternion(frame.quaternion.clone().invert());
/** Ask the existing floor owner. In particular, raised internal lifts leave holes. */
export function sampleRoverSupport(point,{freighter=null,frame=null}={}){
  if(freighter&&frame){
    const s=roverShipLocal(point,frame);
    // The 64 m hull's ramps extend beyond the retired 30 m broadphase.
    if(s.length()<50){
      const eye=s.clone().addScaledVector(UP,freighter.eyeHeight??1.75);
      const surface=freighter.surfaceAt?.(eye),y=surface?.y??freighter.floorAt(eye);
      if(Number.isFinite(y)){
        const platform=freighter.lifts?.find(l=>inside(s,l)&&Math.abs(l.y-y)<.001);
        return {point:new Vector3(s.x,y,s.z).applyQuaternion(frame.quaternion).add(frame.position),normal:(surface?.normal??UP).clone().applyQuaternion(frame.quaternion),source:surface?.source??(platform?(freighter.layout?.id??'atlas')+'-lift:'+platform.id:(freighter.layout?.id??'atlas')+'-deck')};
      }
    }
  }
  const body=bodyAt(point);if(body.star)return null;
  const surface=bodySurfacePoint(bodyOffset(point,body).normalize(),body);
  if(point.distanceTo(surface)>.4)return null;
  return {point:surface,normal:bodySurfaceNormal(point,body),source:'terrain'};
}
/** Called by the shared lift toggle, including every on-foot pedestal caller.
 * A platform cannot hit a vehicle below it or lift only part of a straddling one. */
export function roverLiftMayMove(state,platform,frame,{spawned=true,busy=false,carrierId='atlas',ceiling=platform.ceiling??9.2,layout=ROVER_LAYOUT}={}){
  if(!spawned)return true;
  const points=roverFootprint(state.position,state.quaternion,{layout}).map(p=>roverShipLocal(p,frame));
  const min=[0,1,2].map(i=>Math.min(...points.map(p=>p.getComponent(i)))),max=[0,1,2].map(i=>Math.max(...points.map(p=>p.getComponent(i))));
  const overlaps=max[0]>platform.minX&&min[0]<platform.maxX&&max[2]>platform.minZ&&min[2]<platform.maxZ&&max[1]>platform.low-.1&&min[1]<platform.high+.1;
  if(!overlaps)return true;
  const supported=state.wheels.every(w=>w.source===carrierId+'-lift:'+platform.id)&&state.wheels.length===4;
  return supported&&Math.abs(state.speed)<.1&&!busy&&roverFitsPlatform(state.position,state.quaternion,{...platform,...frame,ceiling},{layout});
}
