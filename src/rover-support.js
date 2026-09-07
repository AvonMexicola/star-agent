import {Vector3} from 'three';
import {bodyAt,bodyOffset,bodySurfacePoint,bodySurfaceNormal} from './celestial.js';
import {roverFootprint,roverFitsPlatform} from './rover-physics.js';
const UP=new Vector3(0,1,0);
const inside=(p,b)=>p.x>=b.minX&&p.x<=b.maxX&&p.z>=b.minZ&&p.z<=b.maxZ;
export const roverShipLocal=(point,frame)=>point.clone().sub(frame.position).applyQuaternion(frame.quaternion.clone().invert());
/** Ask the existing floor owner. In particular, raised internal lifts leave holes. */
export function sampleRoverSupport(point,{freighter=null,frame=null}={}){
  if(freighter&&frame){
    const s=roverShipLocal(point,frame);
    if(s.length()<30){
      const y=freighter.floorAt(s.clone().addScaledVector(UP,1.75));
      if(y!==null){
        const platform=freighter.lifts.find(l=>inside(s,l)&&Math.abs(l.y-y)<.001);
        return {point:new Vector3(s.x,y,s.z).applyQuaternion(frame.quaternion).add(frame.position),normal:UP.clone().applyQuaternion(frame.quaternion),source:platform?'atlas-lift:'+platform.id:'atlas-deck'};
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
export function roverLiftMayMove(state,platform,frame,{spawned=true,busy=false}={}){
  if(!spawned)return true;
  const points=roverFootprint(state.position,state.quaternion).map(p=>roverShipLocal(p,frame));
  const min=[0,1,2].map(i=>Math.min(...points.map(p=>p.getComponent(i)))),max=[0,1,2].map(i=>Math.max(...points.map(p=>p.getComponent(i))));
  const overlaps=max[0]>platform.minX&&min[0]<platform.maxX&&max[2]>platform.minZ&&min[2]<platform.maxZ&&max[1]>platform.low-.1&&min[1]<platform.high+.1;
  if(!overlaps)return true;
  const supported=state.wheels.every(w=>w.source==='atlas-lift:'+platform.id)&&state.wheels.length===4;
  return supported&&Math.abs(state.speed)<.1&&!busy&&roverFitsPlatform(state.position,state.quaternion,{...platform,...frame,ceiling:9.2});
}
