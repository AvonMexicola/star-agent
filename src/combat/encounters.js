import {Vector3} from 'three';
import {AEON,SELENE,PYRE,MIASMA,bodyAt,bodyAltitude,bodySurfacePoint} from '../celestial.js';
import {RING_RADIUS,RING_WIDTH,RING_ROTATION} from '../ring-world.js';

export const DIFFICULTIES=Object.freeze({
  easy:Object.freeze({id:'easy',label:'Easy',integrity:.65,pressure:.55,speed:.8,turn:.8,detail:'One isolated ship · reduced shields and slower firing passes'}),
  standard:Object.freeze({id:'standard',label:'Standard',integrity:1,pressure:1,speed:1,turn:1,detail:'Two ships · full shields and overlapping attack runs'}),
  hard:Object.freeze({id:'hard',label:'Hard',integrity:1.2,pressure:1.35,speed:1.1,turn:1.2,detail:'Five ships in two waves · veteran pilots · reinforced shields'}),
});
export const ENCOUNTER_REGIONS=Object.freeze([
  {id:'aeon',name:'Aeon orbit',body:AEON,titles:['Shipping lane sweep','Outer perimeter patrol','Orbital blockade'],brief:'Raiders are probing the routes beyond Aeon Orbital. Clear their flight before it reaches the shipping lanes.',easy:'nomad',standard:['nomad','kestrel'],hard:[['nomad','kestrel'],['nomad','kestrel','kestrel']]},
  {id:'selene',name:'Selene orbit',body:SELENE,titles:['Lunar picket','Far-side intercept','Silent horizon'],brief:'Unidentified ships are shadowing lunar survey traffic. Intercept them above Selene, clear of the landing sites.',easy:'kestrel',standard:['kestrel','nomad'],hard:[['kestrel','kestrel'],['nomad','nomad','kestrel']]},
  {id:'pyre',name:'Pyre orbit',body:PYRE,titles:['Ash runner','Cinder patrol','Ember siege'],brief:'Armed scavengers are hunting prospectors over Pyre. Break their patrol in high orbit above the volcanic atmosphere.',easy:'nomad',standard:['kestrel','kestrel'],hard:[['kestrel','nomad'],['kestrel','kestrel','kestrel']]},
  {id:'miasma',name:'Miasma orbit',body:MIASMA,titles:['Haze watcher','Veiled ambush','Toxic cordon'],brief:'A raider flight is watching departures from the sulphur clouds. Take the fight into clear space above Miasma.',easy:'kestrel',standard:['nomad','nomad'],hard:[['nomad','nomad'],['kestrel','nomad','kestrel']]},
  {id:'belt',name:'Selene asteroid belt',body:SELENE,titles:['Claim jumper','Belt interdiction','Broken ring'],brief:'Claim jumpers are driving miners out of the asteroid belt. Engage above the rock plane; asteroids block your shots, so keep a clear firing lane.',easy:'nomad',standard:['nomad','kestrel'],hard:[['kestrel','kestrel'],['nomad','kestrel','nomad']]},
].map(region=>Object.freeze({...region,titles:Object.freeze(region.titles),standard:Object.freeze(region.standard),hard:Object.freeze(region.hard.map(Object.freeze))})));

export function encounterRegion(position){
  const p=position.clone().sub(new Vector3(...SELENE.center)).applyQuaternion(RING_ROTATION.clone().invert());
  if(Math.abs(Math.hypot(p.x,p.y)-RING_RADIUS)<RING_WIDTH/2+12000&&Math.abs(p.z)<10000)return ENCOUNTER_REGIONS.find(r=>r.id==='belt');
  const body=bodyAt(position);
  return ENCOUNTER_REGIONS.find(r=>r.id===body.id)??null;
}

export function encounterContract(regionId='aeon',difficultyId='standard'){
  const region=ENCOUNTER_REGIONS.find(r=>r.id===regionId),difficulty=DIFFICULTIES[difficultyId];
  if(!region||!difficulty)throw new RangeError('Unknown encounter region or difficulty');
  const waves=difficultyId==='easy'?[[region.easy]]:difficultyId==='standard'?[region.standard]:region.hard;
  return Object.freeze({id:`${regionId}-${difficultyId}`,regionId,region:region.name,difficulty,
    title:region.titles[['easy','standard','hard'].indexOf(difficultyId)],brief:region.brief,
    waves:Object.freeze(waves.map(w=>Object.freeze([...w]))),total:waves.flat().length,reinforcementDelay:10});
}

/** Dispatch is local to the selected body, in doubles. Accepting never moves the pilot. */
export function encounterWaypoint(nav,region=encounterRegion(nav.position)){
  if(!region)return null;
  if(region.id==='aeon'&&nav.station?.ready&&(nav.dockedAtStation||nav.stationDistance<=1000))
    return nav.station.approachWorldPosition.clone().addScaledVector(nav.station.direction,6000);
  const forward=new Vector3(0,0,-1).applyQuaternion(nav.orientation),point=nav.position.clone().addScaledVector(forward,3000);
  if(region.id==='belt'){
    const center=new Vector3(...SELENE.center),local=point.sub(center).applyQuaternion(RING_ROTATION.clone().invert());
    // Keep the flight above the canonical 2 km-thick belt and its largest rocks.
    // The visible rocks remain nearby without spawning contacts inside them.
    local.z=local.z<0?-3500:3500;
    return local.applyQuaternion(RING_ROTATION).add(center);
  }
  if(bodyAltitude(point,region.body)<20000){
    const radial=point.clone().sub(new Vector3(...region.body.center)).normalize();
    return bodySurfacePoint(radial,region.body,30000);
  }
  return point;
}
