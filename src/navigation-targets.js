import { rotationFrameAt, toInertial, planetRotation, inertialSurfacePoint } from './planet-rotation.js';
import { Vector3 } from 'three';
import { BODIES, AEON, SELENE, PYRE, MIASMA, bodySurfacePoint } from './celestial.js';
import { SUN_STANDOFF, SUN_EXCLUSION } from './stellar-world.js';
import { createTravelPlan, segmentIntersectsSphere } from './travel-model.js';
import { createAvoidanceRoute } from './travel-route.js';
import { MOON_LANDING_DIRECTION, MOON_MAX_HEIGHT } from './moon-world.js';
import { pyreLandingDirection } from './pyre-world.js';
import { MIASMA_SITES } from './miasma-world.js';

export const NAV_ARRIVAL = 20_000;
export const NAV_SURFACE_CLEARANCE = 35_000;
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
  if(target.surface&&body)return surface(center.sub(v(body.center)).normalize(),body,NAV_SURFACE_CLEARANCE);
  const offset=from.sub(center).normalize();if(!offset.lengthSq())offset.set(1,0,0);
  return center.addScaledVector(offset,NAV_ARRIVAL);
}
export function navigationHazards(obstacles=[]) {
  return [...BODIES.map(b=>({id:b.id,name:b.name,center:b.center,radius:b.star?SUN_EXCLUSION:b.radius+envelopes[b.id]+100})),...obstacles];
}
/** Plan tangent legs and limb arcs outside a terrain envelope +35 km. Surface
 * signals finish on their own local vertical, with the rotating arrival led. */
export function planNavigationTravel(start,target,{obstacles=[],rotationTime=null,spoolSeconds=null}={}) {
  if(!valid(start)||!target||!valid(target.center))return fail('Destination signal unavailable.');
  if((target.surface||target.category==='bodies')&&!BODIES.some(b=>b.id===target.body))return fail('Destination world unavailable.');
  if(spoolSeconds!==null&&(!Number.isFinite(spoolSeconds)||spoolSeconds<0))return fail('Invalid drive charge.');
  if(!Array.isArray(obstacles)||obstacles.some(h=>!h||!valid(h.center)||!Number.isFinite(h.radius)||h.radius<0))return fail('Invalid navigation obstacle.');
  if(rotationTime!==null&&!Number.isFinite(rotationTime))return fail('Invalid navigation time.');
  const from=rotationTime===null?v(start):toInertial(v(start),rotationFrameAt(v(start)),rotationTime);
  let end=navigationEndpoint(from,target,{rotationTime});
  const currentCenter=targetInertialCenter(target,rotationTime);
  if(from.distanceTo(end)<1000 || (!target.surface&&target.category!=='bodies'&&from.distanceTo(currentCenter)<=NAV_ARRIVAL+1))return fail(target.surface?'Within 35 km approach. Continue in normal flight.':'Within 20 km. Continue in normal flight.');
  if(target.category==='bodies'&&from.distanceTo(currentCenter)<=end.distanceTo(currentCenter)+1)return fail(target.id==='star'?'At stellar observation range.':'Within 20 km of the surface. Continue in normal flight.');
  const worlds=BODIES.filter(b=>!b.star).map(b=>({id:b.id,name:b.name,center:b.center,radius:b.radius+envelopes[b.id]+NAV_SURFACE_CLEARANCE}));
  const hazards=[...obstacles.map(h=>rotationTime===null?h:{...h,center:targetInertialCenter(h,rotationTime).toArray()}),
    ...BODIES.filter(b=>b.star).map(b=>({id:b.id,name:b.name,center:b.center,radius:SUN_EXCLUSION}))];
  // The radial corridor may begin below the detour shell, but never in terrain.
  for(const body of BODIES.filter(b=>!b.star)){
    const radial=from.clone().sub(v(body.center)),surface=rotationTime===null?bodySurfacePoint(radial.clone().normalize(),body):inertialSurfacePoint(radial.clone().normalize(),body,rotationTime);
    if(radial.length()<surface.distanceTo(v(body.center))+100)return fail(`Climb clear of ${body.name}'s surface before engaging.`);
  }
  const makePlan=end=>{
    for(const body of BODIES.filter(b=>!b.star)){
      const radial=end.clone().sub(v(body.center)),surface=rotationTime===null?bodySurfacePoint(radial.clone().normalize(),body):inertialSurfacePoint(radial.clone().normalize(),body,rotationTime);
      if(radial.length()<surface.distanceTo(v(body.center))+100)throw new Error(`Destination approach intersects ${body.name}'s surface.`);
    }
    const path=createAvoidanceRoute(from,end,worlds,hazards);
    const plan=createTravelPlan(from,end,{path});
    return spoolSeconds===null?plan:Object.freeze({...plan,spoolSeconds,duration:plan.duration-plan.spoolSeconds+spoolSeconds});
  };
  try {
    let plan=makePlan(end);
    if(rotationTime!==null){
      // Include the detour length and charge in the rotating target's lead.
      let error=Infinity;
      for(let i=0;i<12;i++){
        const next=navigationEndpoint(from,target,{rotationTime:rotationTime+plan.duration});
        error=next.distanceTo(end);end=next;plan=makePlan(end);
        if(error<.001)break;
      }
      if(error>=.001)return fail('Unable to resolve a stable arrival. Choose another approach.');
    }
    return {ok:true,reason:null,plan:rotationTime===null?plan:Object.freeze({...plan,coordinates:'inertial',departureTime:rotationTime,arrivalTime:rotationTime+plan.duration})};
  } catch(error) { return fail(error.message); }
}
/** Sight acquisition respects occlusion. An explicitly tracked world or surface
 * signal can charge behind a limb because its drive route goes around it. */
export function aimedNavigationTarget(position,orientation,targets,selectedId=null,{rotationTime=null}={}) {
  const local=v(position),frame=rotationTime===null?null:rotationFrameAt(local);
  const from=toInertial(local,frame,rotationTime),forward=new Vector3(0,0,-1).applyQuaternion(orientation).applyQuaternion(planetRotation(frame,rotationTime));
  const candidates=[];
  for(const t of targets) {
    // A tracked destination stays selected when its marker leaves the aim cone.
    // Never charge a different world behind it while the pilot lines up.
    if(selectedId!==null&&t.id!==selectedId)continue;
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
    if(!occluded || t.id===selectedId&&(t.surface||t.category==='bodies'))candidates.push({target:t,angular,surfaceDistance});
  }
  // A point signal within the narrow aim cone outranks a world's broad disk.
  // Otherwise Aeon's nearer surface steals an exactly aimed settlement bearing.
  candidates.sort((a,b)=>Number(a.target.category==='bodies')-Number(b.target.category==='bodies')||a.surfaceDistance-b.surfaceDistance);
  return candidates[0]?.target??null;
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
