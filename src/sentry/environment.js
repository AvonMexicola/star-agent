import * as THREE from 'three';
import {sampleRoverSupport} from '../rover-support.js';
import {roverCarrierClear,guardRoverCarrier} from '../rover-carrier.js';
import {roverFootprint} from '../rover-physics.js';
import {bodyOffset} from '../celestial.js';
import {stationPhysicsAt,stationDeckPoint} from '../station-physics.js';
import {constrainStationSweep} from '../station-collision.js';
import {SENTRY_LAYOUT as L} from './layout.js';

const UP=new THREE.Vector3(0,1,0),v=p=>new THREE.Vector3(...p);
/** Support is always supplied by the existing canonical terrain, carrier or
 * authored station deck. This adapter is identical in the browser and room. */
export function createSentryEnvironment({station=null,getCarriers=()=>[],getRovers=()=>[],getWalkers=()=>[],getHulls=()=>[],getObstacles=()=>null,buildingRaycast=()=>null}={}){
  const guarded=new WeakSet();
  function carriers(){
    const list=getCarriers();
    for(const c of list)if(!guarded.has(c.systems)){
      guarded.add(c.systems);
      guardRoverCarrier(c.systems,()=>getRovers().map(r=>{
        const s=r.physics?.state??r,frame=getCarriers().find(x=>x.systems===c.systems)?.frame??c.frame;
        return {spawned:true,busy:Boolean(r.busy),layout:L,frame,state:{...s,position:s.position.isVector3?s.position:v(s.position),quaternion:s.quaternion.isQuaternion?s.quaternion:new THREE.Quaternion(...s.quaternion),wheels:s.wheels.map(w=>({...w,source:w.source?.replace('carrier:'+c.id+':','')}))}};
      }));
    }
    return list;
  }
  function support(point){
    for(const c of carriers()){
      const hit=sampleRoverSupport(point,{freighter:c.systems,frame:c.frame});
      if(hit?.source!=='terrain'&&hit)return {...hit,source:'carrier:'+c.id+':'+hit.source};
    }
    const grid=stationPhysicsAt(station,point.clone().addScaledVector(station?.up??UP,1));
    if(grid&&grid.id!=='station:hub'){
      const floor=stationDeckPoint(grid,point,0);
      if(floor&&Math.abs(point.clone().sub(floor).dot(grid.up))<.4)return {point:floor,normal:grid.up.clone(),source:grid.id};
    }
    return sampleRoverSupport(point);
  }
  function ray(a,b,{carrier=true}={}){
    const d=b.clone().sub(a),distance=d.length();if(distance<1e-6)return false;
    const direction=d.divideScalar(distance),worldHit=buildingRaycast(a,direction,distance);
    if(worldHit)return true;
    const obstacles=getObstacles();if(obstacles?.constrainWalker?.(a,b)?.hit)return true;
    for(const frame of station?.pods??[]){
      if(a.distanceTo(frame.padWorldPosition)>160&&b.distanceTo(frame.padWorldPosition)>160)continue;
      const x=frame.toLocal(a,new THREE.Vector3()),y=frame.toLocal(b,new THREE.Vector3());
      const result=constrainStationSweep(frame.colliders,frame.doorBoxes??[],x,y,new THREE.Vector3(-.04,-.04,-.04),new THREE.Vector3(.04,.04,.04));
      if(result.hit)return true;
    }
    for(const c of carrier?carriers():[]){
      if(a.distanceTo(c.frame.position)>55&&b.distanceTo(c.frame.position)>55)continue;
      const inverse=c.frame.quaternion.clone().invert(),x=a.clone().sub(c.frame.position).applyQuaternion(inverse),y=b.clone().sub(c.frame.position).applyQuaternion(inverse);
      const r=c.systems.constrain?.(x,y);if(r?.hit||r?.isVector3&&r.distanceTo(y)>.08||r?.point&&r.point.distanceTo(y)>.08)return true;
    }
    return false;
  }
  function peersClear(position,quaternion,ownId){
    const points=roverFootprint(position,quaternion,{layout:L});
    for(const r of getRovers()){
      if(r.id===ownId)continue;const s=r.physics?.state??r,root=s.position.isVector3?s.position:v(s.position),q=s.quaternion.isQuaternion?s.quaternion:new THREE.Quaternion(...s.quaternion),inverse=q.clone().invert();
      const local=points.map(p=>p.clone().sub(root).applyQuaternion(inverse));
      if([0,1,2].every(i=>Math.min(...local.map(p=>p.getComponent(i)))<L.bounds.max[i]+.05&&Math.max(...local.map(p=>p.getComponent(i)))>L.bounds.min[i]-.05))return false;
    }
    const inverse=quaternion.clone().invert();
    for(const walker of getWalkers()){
      const n=walker.nav??walker;if(!['walk','eva'].includes(n.mode)||n.sentrySeat?.id===ownId||n.roverOccupied)continue;
      const eye=n.position.clone().sub(position).applyQuaternion(inverse);
      if(eye.x>L.bounds.min[0]-.3&&eye.x<L.bounds.max[0]+.3&&eye.z>L.bounds.min[2]-.3&&eye.z<L.bounds.max[2]+.3&&eye.y>L.bounds.min[1]-.2&&eye.y-1.75<L.bounds.max[1])return false;
    }
    return true;
  }
  function clearPose(position,quaternion,ownId){
    if(!peersClear(position,quaternion,ownId))return false;
    const world=p=>v(p).applyQuaternion(quaternion).add(position);
    for(const hull of getHulls()){
      const inverse=hull.quaternion.clone().invert(),points=roverFootprint(position,quaternion,{layout:L}).map(p=>p.sub(hull.position).applyQuaternion(inverse));
      if([0,1,2].every(i=>Math.min(...points.map(p=>p.getComponent(i)))<hull.bounds.max[i]&&Math.max(...points.map(p=>p.getComponent(i)))>hull.bounds.min[i]))return false;
    }
    const pose={position,quaternion};
    for(const c of carriers())if(!roverCarrierClear({previous:pose,proposed:pose},c.systems,c.frame,{layout:L,cargoConstrain:c.cargoConstrain}))return false;
    // Rays cross the actual occupied chassis/cabin area and the turret's
    // complete sweep. No invented bounding-floor collision is introduced.
    for(const x of [-.83,0,.83])for(const y of [.50,1.10,1.8,2.35,3.02])if(ray(world([x,y,-1.7]),world([x,y,2.15]),{carrier:false}))return false;
    return true;
  }
  return {support,ray,clearPose,peersClear,carriers,
    up:point=>support(point)?.normal??bodyOffset(point).normalize(),
    constrain({previous,proposed,previousCorners,corners},ownId){
      for(const carrier of carriers())if(!roverCarrierClear({previous,proposed,previousCorners,corners},carrier.systems,carrier.frame,{layout:L,cargoConstrain:carrier.cargoConstrain}))return false;
      if(!clearPose(proposed.position,proposed.quaternion,ownId))return false;
      const a=roverFootprint(previous.position,previous.quaternion,{layout:L}),b=roverFootprint(proposed.position,proposed.quaternion,{layout:L});
      // The conservative tyre suspension envelope extends below the deck. Its
      // floor contact belongs to sampleSupport, so sweep lower side samples
      // 15 cm above the chassis root; keep upper clearance at the true top.
      const raise=(p,pose)=>{const up=UP.clone().applyQuaternion(pose.quaternion),height=p.clone().sub(pose.position).dot(up);return p.addScaledVector(up,Math.max(0,.15-height));};
      return a.every((p,i)=>!ray(raise(p,previous),raise(b[i],proposed),{carrier:false}));
    },
    accessClear:(a,b)=>!ray(a,b),
  };
}

/** Nearest supported placement from a real on-foot character. Every candidate
 * must settle all tyres and leave both doors reachable. No client pose input. */
export function sentryDeploymentPoses(nav){
  const up=nav.stationPhysics?.up?.clone()??bodyOffset(nav.position).normalize();
  const forward=new THREE.Vector3(0,0,-1).applyQuaternion(nav.orientation).projectOnPlane(up).normalize();
  const right=forward.clone().cross(up).normalize(),quaternion=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right,up,forward.clone().negate()));
  return [[0,6],[5,6],[-5,6],[6,0],[-6,0],[0,-6]].map(([x,z])=>({position:nav.position.clone().addScaledVector(up,-1.75).addScaledVector(right,x).addScaledVector(forward,z),quaternion:quaternion.clone()}));
}
