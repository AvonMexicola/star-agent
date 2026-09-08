import {Vector3,Quaternion} from 'three';
import {DIFFICULTIES} from '../combat/encounters.js';

export const RECOVERY_JOBS=Object.freeze([
  {id:'silent-atlas',name:'Silent Atlas',difficulty:'Recovery',crates:2,reward:900,offset:[0,6000000,0],guards:[],brief:'A disabled freighter is broadcasting on emergency power. No hostile ships reported.'},
  {id:'raider-claim',name:'Raider claim',difficulty:'Standard',crates:2,reward:1500,offset:[1800000,7000000,0],guards:['nomad','kestrel'],brief:'Raiders have claimed a stranded Atlas. Clear both ships before recovering its cargo.'},
  {id:'broken-convoy',name:'Broken convoy',difficulty:'Hard',crates:3,reward:2400,offset:[-1800000,8500000,1000000],guards:['nomad','kestrel','kestrel'],brief:'A reinforced raider flight protects the last freighter of a lost convoy.'},
].map(j=>Object.freeze({...j,sbu:2,resource:'conductor',destination:'settlement-aeon',guards:Object.freeze(j.guards),offset:Object.freeze(j.offset)})));
export const recoveryJob=id=>RECOVERY_JOBS.find(j=>j.id===id);
export const recoveryCargo=c=>Boolean(c?.recovery);
export function recoveryPose(job,site){
  const rotation=new Quaternion(...site.claim.quaternion);
  return {position:new Vector3(...job.offset).applyQuaternion(rotation).add(new Vector3(...site.claim.origin)).toArray(),quaternion:rotation.toArray()};
}
// These centres sit inside the real aft bay, above its 2.6m cargo floor.
export const RECOVERY_CRATE_CENTRES=Object.freeze([[-1.6,2.915,22.4],[1.6,2.915,22.4],[0,2.915,19.8]].map(Object.freeze));
export function recoveryCratePose(mission,index){
  return {position:new Vector3(...RECOVERY_CRATE_CENTRES[index]).applyQuaternion(new Quaternion(...mission.quaternion)).add(new Vector3(...mission.position)).toArray(),quaternion:[...mission.quaternion]};
}
export function recoveryEncounter(job,mission){
  const difficulty=job.difficulty==='Hard'?DIFFICULTIES.hard:DIFFICULTIES.standard;
  return {id:mission.id,regionId:'deep-space',region:'Deep space',title:job.name+' · defending flight',brief:job.brief,difficulty,waves:[[...job.guards]],total:job.guards.length,reinforcementDelay:10};
}
