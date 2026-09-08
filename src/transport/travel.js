import {transportRoute} from './catalog.js';
import {planNavigationTravel} from '../navigation-targets.js';
import {Vector3} from 'three';

export function transportDestination(account,id){
 const m=account?.transport?.active,r=transportRoute(m?.route);
 return Boolean(r&&(id===r.from||id===r.to&&m.phase==='issued'));
}
/** Server chooses the authored endpoint, checks the actual pilot/ship and plans
 * the entire collision-cleared continuous leg. Submitted positions are ignored. */
export function planTransportDrive(state,owner,id,nav,sites,station){
 const fail=reason=>({ok:false,reason,plan:null});
 if(!transportDestination(state.accounts[owner],id))return fail('Choose the pickup or delivery site of your active transport contract.');
 if(nav.mode!=='flight'||!nav.powered||nav.travel||nav.autoland||nav.stationLift||nav.carryingCargo)return fail('Pilot your ship with cargo secured before engaging transport drive.');
 if(nav.gearLimited)return fail('Retract landing gear before charging.');
 if(nav.altitude<19990&&nav.flightEnvironment.atmosphereFraction>0)return fail('Climb to 20 km before charging the drive.');
 const target=sites.beacons().find(t=>t.id===id);if(!target)return fail('Transport destination unavailable.');
 const m=state.accounts[owner].transport.active,r=transportRoute(m.route);
 if(id===r.to&&!state.ships[`${owner}:${nav.shipId}`]?.crates.some(c=>c.id===m.crate&&c.transport?.id===m.id))return fail('Secure your sealed crate aboard this ship before flying the delivery leg.');
 const direction=new Vector3(...target.center).sub(nav.position).normalize(),nose=new Vector3(0,0,-1).applyQuaternion(nav.orientation);
 if(nose.dot(direction)<Math.cos(.025))return fail('Aim your ship at the transport destination.');
 const obstacles=station?.ready?[{id:'station-aeon',name:'Aeon Orbital',center:(station.centre??station.worldPosition).toArray(),radius:2000}]:[];
 return {...planNavigationTravel(nav.position,target,{obstacles}),target};
}
