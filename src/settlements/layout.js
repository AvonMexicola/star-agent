import {Matrix4,Quaternion,Vector3} from 'three';
import {AEON,SELENE,PYRE,MIASMA,bodySurfacePoint} from '../celestial.js';
import {MOON_LANDING_DIRECTION} from '../moon-world.js';
import {pyreLandingDirection,pyreFrame} from '../pyre-world.js';
import {MIASMA_SITES} from '../miasma-world.js';
import {withClaimAnchor} from '../build/anchors.js';
import {findDestinations} from '../world.js';
import {SEED} from '../generation.js';
import {SETTLEMENTS} from './catalog.js';
const v=a=>new Vector3(...a);
const bodies={aeon:AEON,selene:SELENE,pyre:PYRE,miasma:MIASMA};

/** Deterministic survey around known regions; only canonical terrain is sampled.
 * Raised kit pads have 8 m piers. Reject sites that exceed their actual reach. */
export function surveySettlement(body,direction,fallback=false){
  const base=v(direction).normalize(),axis=body.id==='pyre'?v(pyreFrame().y):new Vector3(0,1,0);
  const east=axis.clone().cross(base).normalize(),north=base.clone().cross(east),candidates=[];
  const frame=up=>{const x=axis.clone().cross(up).normalize(),z=x.clone().cross(up);return new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(x,up,z));};
  const sample=(origin,q,step)=>{
    const up=new Vector3(0,1,0).applyQuaternion(q);let low=Infinity,high=-Infinity;
    // Whole occupied footprint, including slabs, piers and service approaches.
    for(let x=-41;x<=41;x+=step)for(let z=-34;z<=58;z+=step){
      const p=new Vector3(x,0,z).applyQuaternion(q).add(origin).sub(v(body.center)).normalize();
      const h=bodySurfacePoint(p,body).sub(origin).dot(up);low=Math.min(low,h);high=Math.max(high,h);
    }
    return {low,high,range:high-low};
  };
  for(let i=0;i<384;i++){
    const a=i*2.399963229728653,r=300+Math.sqrt(i)*150;
    const up=base.clone().addScaledVector(east,Math.cos(a)*r/body.radius).addScaledVector(north,Math.sin(a)*r/body.radius).normalize();
    const origin=bodySurfacePoint(up,body),q=frame(up);
    if(body.water&&origin.clone().sub(v(body.center)).length()-body.radius<15)continue;
    candidates.push({origin,q,...sample(origin,q,8)});
  }
  candidates.sort((a,b)=>a.range-b.range);
  for(const candidate of candidates.slice(0,24)){
    const terrain=sample(candidate.origin,candidate.q,2);
    if(terrain.range>6.8)continue;
    return {origin:candidate.origin.toArray(),quaternion:candidate.q.toArray(),deck:terrain.high+.45,terrain};
  }
  if(body.id==='aeon'&&!fallback){const destinations=findDestinations();for(const d of [destinations.coast,destinations.forest,destinations.polar].filter(Boolean)){try{return surveySettlement(body,d,true);}catch{}}}
  throw new Error(`No supported settlement site on ${body.name}.`);
}

/** Every solid comes from the player's existing 4 m kit, including pad piers.
 * Three enclosed buildings meet the large pad at flush, accessible thresholds. */
export function settlementLayout(def,index,site){
  let serial=10000+index*1000;const pieces=[];
  const put=(type,x,y,z,rotation=0,extra={})=>{const p={id:`build-piece-${++serial}`,type,position:[x,y,z],rotation,doorOpen:false,...extra};pieces.push(p);return p;};
  const y=site.deck;
  put('foundation-pad-large',0,y,20,0,{landingPad:true});
  const room=(cx,cz,doorSide,style)=>{
    put('foundation-pad-small',cx,y,cz);
    for(let a=-6;a<=6;a+=4){
      put(doorSide==='south'&&a===-2?'doorway':style==='glazed'?'window':'wall',cx+a,y,cz+8,0,{doorOpen:true});
      put(style==='glazed'?'window':'wall',cx+a,y,cz-8);
      put(doorSide==='west'&&a===-2?'doorway':'window',cx-8,y,cz+a,Math.PI/2,{doorOpen:true});
      put(doorSide==='east'&&a===-2?'doorway':'wall',cx+8,y,cz+a,Math.PI/2,{doorOpen:true});
    }
    for(let x=-6;x<=6;x+=4)for(let z=-6;z<=6;z+=4){
      put('floor',cx+x,y+3,cz+z);
      // Rounded perimeter makes the three roofs read as finished kit buildings.
      put(Math.abs(x)===6&&Math.abs(z)===6?'roof-corner':Math.abs(z)===6||Math.abs(x)===6?'roof-edge':'roof-flat',cx+x,y+3.006,cz+z,z===-6?Math.PI:x===6?Math.PI/2:x===-6?-Math.PI/2:0);
    }
    for(const [x,z]of [[-6,-6],[2,2]])put('ceiling-light',cx+x,y+2.82,cz+z,0,{lightOn:true});
  };
  room(0,-24,'south','glazed');
  room(-32,def.wings[0],'east',def.body==='aeon'?'glazed':'solid');
  room(32,def.wings[1],'west',def.body==='miasma'?'glazed':'solid');
  // Terminal at the front of the exchange; the central aisle stays unobstructed.
  const terminal=put('terminal',-2,y,-22,Math.PI);
  put('mainframe',5,y,-29,Math.PI);
  for(const [cx,cz] of [[-32,def.wings[0]],[32,def.wings[1]]]){
    for(const x of [-5,0,5])put('rack',cx+x,y,cz-6,0);
    for(const x of [-5,5])put('crate',cx+x,y,cz+5);
  }
  for(const x of [-6,2,6])put('solar-array',x,y+3.62,-26);
  put('battery',6,y,-18,Math.PI/2);
  put(def.body==='selene'?'helium-generator':'uranium-generator',-6,y,-28);
  if(def.body==='aeon'||def.body==='miasma')put('wind-turbine',32,y+3.62,def.wings[1]);
  else put('solar-array',32,y+3.62,def.wings[1]);
  const claim=withClaimAnchor({id:`build-claim-${10000+index*1000}`,body:def.body,name:def.name,owner:'Settlement authority',useBuffer:false,radius:96,origin:site.origin,quaternion:site.quaternion,pieces});
  return {...def,claim,terminalPiece:terminal,pad:pieces[0],terrain:site.terrain};
}
let cached,cachedSeed;
export const settlementLayoutErrors=[];
export function createSettlementLayouts(){
  if(cached&&cachedSeed===SEED)return cached;
  cachedSeed=SEED;settlementLayoutErrors.length=0;
  const directions={aeon:[.013692585,.605614277,.795640535],selene:MOON_LANDING_DIRECTION,pyre:pyreLandingDirection(),miasma:MIASMA_SITES[0].direction};
  cached=SETTLEMENTS.flatMap((def,i)=>{try{return [settlementLayout(def,i,surveySettlement(bodies[def.body],directions[def.body]))];}catch(error){settlementLayoutErrors.push(error.message);return [];}});
  return cached;
}
