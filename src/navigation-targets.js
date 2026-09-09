import { rotationFrameAt, toInertial, planetRotation, inertialSurfacePoint } from './planet-rotation.js';
import { Vector3 } from 'three';
import { BODIES, AEON, SELENE, PYRE, MIASMA, bodySurfacePoint } from './celestial.js';
import { SUN_STANDOFF, SUN_EXCLUSION } from './stellar-world.js';
import { createTravelPlan, segmentIntersectsSphere } from './travel-model.js';
import { MOON_LANDING_DIRECTION, MOON_MAX_HEIGHT } from './moon-world.js';
import { pyreLandingDirection } from './pyre-world.js';
import { MIASMA_SITES } from './miasma-world.js';

export const NAV_ARRIVAL = 20_000;
export const NAV_CHARGE_SECONDS = 3;
export const NAV_FILTERS = Object.freeze({bodies:'Worlds',stations:'Stations',ships:'Ships',bases:'Bases',trade:'Trade settlements',friends:'Friends / pilots',missions:'Missions',locations:'Surface sites'});
export const BODY_PARENTS = Object.freeze({star:null,aeon:'star',pyre:'star',selene:'aeon',miasma:'pyre'});
const v = p => p?.isVector3 ? p.clone() : new Vector3(...p);
const valid = p => (p?.isVector3 ? p.toArray() : p)?.length===3 && (p?.isVector3 ? p.toArray() : p).every(Number.isFinite);
const fail = reason => ({ok:false,reason,plan:null});
const envelopes = {aeon:12_000,selene:MOON_MAX_HEIGHT,pyre:9_000,miasma:6500};
export const NAV_BODIES = BODIES.map(body => Object.freeze({id:body.id,name:body.name,category:'bodies',kind:body.star?'Star':['selene','miasma'].includes(body.id)?'Moon':'Planet',parent:BODY_PARENTS[body.id],center:body.center,radius:body.radius,body:body.id}));

export function surfaceTarget(id,name,body,direction,category='locations') {
  return {id,name,category,kind:category==='bases'?'Surface base':'Surface site',parent:body.id,body:body.id,surface:true,center:bodySurfacePoint(v(direction),body).toArray(),radius:0};
}
export function staticNavigationTargets(destinations) {
  const names={coast:'Coastal landing',forest:'Forest expedition',mountain:'Highland survey',polar:'Polar expedition'};
  return [...NAV_BODIES,...Object.entries(destinations).map(([id,dir])=>surfaceTarget(`site-${id}`,names[id]??id,AEON,dir)),
    surfaceTarget('site-selene','Selene landing region',SELENE,MOON_LANDING_DIRECTION),
    surfaceTarget('site-pyre','Twilight landing region',PYRE,pyreLandingDirection()),
    ...MIASMA_SITES.map((site,i)=>surfaceTarget(`site-miasma-${i}`,site.name,MIASMA,site.direction))];
}

/** Near-side surface clearance, or a fixed 20 km stand-off from a signal.
 * Surface sites approach along the local vertical so travel never ends underground. */
export function targetInertialCenter(target,seconds=null) {
  const point=v(target.center);
  return seconds===null?point:toInertial(point,rotationFrameAt(point),seconds);
}
export function navigationEndpoint(start,target,{rotationTime=null}={}) {
  const from=v(start),center=targetInertialCenter(target,rotationTime),body=BODIES.find(b=>b.id===target.body);
  const surface=(radial,b,clearance)=>rotationTime===null?bodySurfacePoint(radial,b,clearance):inertialSurfacePoint(radial,b,rotationTime,clearance);
  if(target.category==='bodies') {
    const radial=from.clone().sub(center).normalize();
    if(!radial.lengthSq())radial.set(1,0,0);
    return body.star?center.addScaledVector(radial,SUN_STANDOFF):surface(radial,body,NAV_ARRIVAL);
  }
  if(target.surface&&body)return surface(center.sub(v(body.center)).normalize(),body,NAV_ARRIVAL);
  const offset=from.sub(center).normalize();if(!offset.lengthSq())offset.set(1,0,0);
  return center.addScaledVector(offset,NAV_ARRIVAL);
}
export function navigationHazards(obstacles=[]) {
  return [...BODIES.map(b=>({id:b.id,name:b.name,center:b.center,radius:b.star?SUN_EXCLUSION:b.radius+envelopes[b.id]+100})),...obstacles];
}
/** Validate the complete segment before committing a continuous analytic flight. */
export function planNavigationTravel(start,target,{obstacles=[],rotationTime=null,spoolSeconds=null}={}) {
  if(!valid(start)||!target||!valid(target.center))return fail('Destination signal unavailable.');
  if(spoolSeconds!==null&&(!Number.isFinite(spoolSeconds)||spoolSeconds<0))return fail('Invalid drive charge.');
  const from=rotationTime===null?v(start):toInertial(v(start),rotationFrameAt(v(start)),rotationTime);
  let end=navigationEndpoint(from,target,{rotationTime});
  const currentCenter=targetInertialCenter(target,rotationTime);
  if(from.distanceTo(end)<1000 || (!target.surface&&target.category!=='bodies'&&from.distanceTo(currentCenter)<=NAV_ARRIVAL+1))return fail('Within 20 km. Continue in normal flight.');
  if(target.category==='bodies'&&from.distanceTo(currentCenter)<=end.distanceTo(currentCenter)+1)return fail(target.id==='star'?'At stellar observation range.':'Within 20 km of the surface. Continue in normal flight.');
  const makePlan=end=>{
    const plan=createTravelPlan(from,end);
    return spoolSeconds===null?plan:Object.freeze({...plan,spoolSeconds,duration:plan.duration-plan.spoolSeconds+spoolSeconds});
  };
  let plan=makePlan(end);
  if(rotationTime!==null){
    // Lead the rotating surface signal through the analytic flight duration.
    // Iteration converges rapidly because a drive is much faster than the ground.
    for(let i=0;i<8;i++){
      const next=navigationEndpoint(from,target,{rotationTime:rotationTime+plan.duration});
      const error=next.distanceTo(end);end=next;plan=makePlan(end);
      if(error<.001)break;
    }
  }
  const hazards=obstacles.map(h=>rotationTime===null?h:{...h,center:targetInertialCenter(h,rotationTime).toArray()});
  for(const hazard of navigationHazards(hazards)) {
    if(!valid(hazard.center)||!Number.isFinite(hazard.radius)||hazard.radius<0)return fail('Invalid navigation obstacle.');
    // A body approach follows one radial all the way to its canonical surface
    // +20 km. A global highest-peak envelope must not reject a deep crater.
    if(target.category==='bodies'&&target.id===hazard.id&&target.id!=='star')continue;
    if(segmentIntersectsSphere(from,end,hazard.center,hazard.radius))return fail(`Route blocked by ${hazard.name}. Climb or fly around its limb.`);
  }
  return {ok:true,reason:null,plan:rotationTime===null?plan:Object.freeze({...plan,coordinates:'inertial',departureTime:rotationTime,arrivalTime:rotationTime+plan.duration})};
}
/** Nearest ray/sphere entry wins: a hidden moon cannot lock through a planet. */
export function aimedNavigationTarget(position,orientation,targets,selectedId=null,{rotationTime=null}={}) {
  const local=v(position),frame=rotationTime===null?null:rotationFrameAt(local);
  const from=toInertial(local,frame,rotationTime),forward=new Vector3(0,0,-1).applyQuaternion(orientation).applyQuaternion(planetRotation(frame,rotationTime));
  const candidates=[];
  for(const t of targets) {
    if(!valid(t.center))continue;
    const offset=targetInertialCenter(t,rotationTime).sub(from),distance=offset.length();
    if(distance<1)continue;
    const cosine=offset.dot(forward)/distance;if(cosine<=0)continue;
    const angular=Math.acos(Math.min(1,cosine));
    const apparent=t.radius?Math.asin(Math.min(1,t.radius/distance)):0;
    const cone=t.category==='bodies'?Math.max(.018,apparent):.035;
    if(angular>cone)continue;
    const surfaceDistance=distance-(t.radius||0);
    // Test the sightline itself, with solid radii (not drive exclusions).
    const sightEnd=t.surface?navigationEndpoint(from,t,{rotationTime}):targetInertialCenter(t,rotationTime);
    const occluded=BODIES.some(b=>b.id!==t.id&&segmentIntersectsSphere(from,sightEnd,b.center,b.radius));
    if(!occluded)candidates.push({target:t,angular,surfaceDistance});
  }
  candidates.sort((a,b)=>a.surfaceDistance-b.surfaceDistance);
  return candidates.find(c=>c.target.id===selectedId)?.target??candidates[0]?.target??null;
}

export class NavigationLock {
  constructor(){this.id=null;this.charge=0;}
  reset(){this.id=null;this.charge=0;}
  update(dt,target,permitted){
    if(!permitted||!target){this.reset();return;}
    if(this.id!==target.id){this.id=target.id;this.charge=0;}
    this.charge=Math.min(1,this.charge+Math.max(0,Math.min(.1,Number.isFinite(dt)?dt:0))/NAV_CHARGE_SECONDS);
  }
  get ready(){return this.charge>=1-1e-9;}
}
