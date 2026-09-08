import {Vector3,Quaternion,Matrix4} from 'three';
import {SELENE,MIASMA,bodySurfacePoint} from '../celestial.js';
import {MOON_LANDING_DIRECTION} from '../moon-world.js';
import {MIASMA_SITES} from '../miasma-world.js';
import {withClaimAnchor} from '../build/anchors.js';
import {MAX_FOUNDATION_DEPTH} from '../build/foundations.js';
import {SEED} from '../generation.js';
import {PIRATE_MARKET,pirateMarketById} from './catalog.js';
import {pirateGroundRoute} from './ground-route.js';
const v=a=>new Vector3(...a);
const cache=new Map();
export function pirateLayout(id=PIRATE_MARKET.id){
  const key=`${SEED}:${id}`;if(cache.has(key))return cache.get(key);
  const market=pirateMarketById(id);if(!market)throw Error('Unknown pirate compound.');
  const body=market.body==='selene'?SELENE:MIASMA,base=v(body===SELENE?MOON_LANDING_DIRECTION:MIASMA_SITES[0].direction).normalize(),east=new Vector3(0,1,0).cross(base).normalize(),north=base.clone().cross(east),candidates=[];
  const frame=up=>{const x=new Vector3(0,1,0).cross(up).normalize(),z=x.clone().cross(up);return new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(x,up,z));};
  function sample(origin,q,cz,step=8){let low=Infinity,high=-Infinity;const up=new Vector3(0,1,0).applyQuaternion(q);
    for(let x=-24;x<=24;x+=step)for(let z=cz-36;z<=cz+36;z+=step){const d=new Vector3(x,0,z).applyQuaternion(q).add(origin).sub(v(body.center)).normalize(),h=bodySurfacePoint(d,body).sub(origin).dot(up);low=Math.min(low,h);high=Math.max(high,h);}
    return {low,high,range:high-low};
  }
  for(let i=0;i<(body===SELENE?256:1024);i++){
    const a=i*2.399963229728653,r=Math.sqrt(i)*(body===SELENE?110:350),up=base.clone().addScaledVector(east,(6500+Math.cos(a)*r)/body.radius).addScaledVector(north,Math.sin(a)*r/body.radius).normalize(),origin=bodySurfacePoint(up,body),q=frame(up);if(body===MIASMA)q.multiply(new Quaternion().setFromAxisAngle(new Vector3(0,1,0),(i%4)*Math.PI/2));
    const core=sample(origin,q,0),pad=sample(origin,q,260);candidates.push({origin,q,score:Math.max(core.range,pad.range)});
  }
  candidates.sort((a,b)=>a.score-b.score);let site;
  for(const c of candidates.slice(0,body===SELENE?24:128)){
    const core=sample(c.origin,c.q,0,2),pad=sample(c.origin,c.q,260,2);if(Math.max(core.range,pad.range)>6.8)continue;
    const up=new Vector3(0,1,0).applyQuaternion(c.q),height=(x,z)=>bodySurfacePoint(new Vector3(x,0,z).applyQuaternion(c.q).add(c.origin).sub(v(body.center)).normalize(),body).sub(c.origin).dot(up);
    const toe=(deck,z)=>{for(let i=0;i<24;i++)if(deck-i*.6-.6<height(17,z+4+i*4)+.12)return z+4+i*4;return null;};
    let route={points:[[17,314],[30,314],[30,75],[17,75]],maxSlope:null};
    if(body===MIASMA){const outerToe=toe(pad.high+.45,296),coreToe=toe(core.high+.45,36);if(outerToe===null||coreToe===null||coreToe>76||outerToe>336)continue;route=pirateGroundRoute(height,[17,outerToe+2],[17,coreToe+2]);if(!route)continue;}
    site={...c,core,pad,route};break;
  }
  if(!site)throw Error(`No supported ${market.name} site and ground approach on ${body.name}.`);
  const {origin,q,core,pad}=site,y=core.high+.45,py=pad.high+.45,pieces=[],rampSupports=[],claimNumber=body===SELENE?20000:22000;let serial=claimNumber;
  const structural=new Set(['foundation','foundation-pad-large','foundation-ramp','wall','window','doorway','floor','roof-flat']);
  const put=(type,x,y,z,rotation=0,extra={})=>{const p={id:`build-piece-${++serial}`,type,position:[x,y,z],rotation,...(structural.has(type)?{finish:'crimson'}:{}),...extra};pieces.push(p);return p;};
  const slab=put('foundation-pad-large',0,y,0);
  // Reclaimed kit wall perimeter, with an8m service opening aligned to the ramp.
  for(let x=-22;x<=22;x+=4){put('wall',x,y,-32);if(x!==14&&x!==18)put('wall',x,y,32,0,x===10?{graphic:'crimson'}:{});}
  for(let z=-30;z<=30;z+=4){put('wall',-22,y,z,Math.PI/2);put('wall',22,y,z,Math.PI/2);}
  // Rigid sealed habitat and8m vestibule. Both actual leaves start closed.
  for(let a=-6;a<=6;a+=4){put(a===-2?'doorway':'wall',8+a,y,-12,0,a===-2?{doorOpen:false,airlock:'inner'}:{});put('wall',8+a,y,-28,0,a===-2?{graphic:'crimson'}:{});put('window',0,y,-20+a,Math.PI/2);put('wall',16,y,-20+a,Math.PI/2);}
  for(let x=2;x<=14;x+=4)for(let z=-26;z<=-14;z+=4){put('floor',x,y+3,z);put('roof-flat',x,y+3.006,z);}
  put('doorway',6,y,-4,0,{doorOpen:false,airlock:'outer'});
  for(const z of [-6,-10]){put('wall',4,y,z,Math.PI/2,z===-6?{graphic:'helmet'}:{});put('wall',8,y,z,Math.PI/2,z===-10?{graphic:'airlock'}:{});put('floor',6,y+3,z);put('roof-flat',6,y+3.006,z);}
  put('ceiling-light',6,y+2.82,-8,0,{lightOn:true});
  const terminalPiece=put('terminal',6,y,-22,Math.PI);put('mainframe',13,y,-25);put('rack',3,y,-26);put('battery',13,y,-19);put('helium-generator',3,y,-24);
  for(const [x,z] of [[4,-24],[12,-16]])put('ceiling-light',x,y+2.82,z,0,{lightOn:true});
  for(const [x,z] of [[-21,31],[21,31],[21,-30]])put('floodlight',x,y,z,Math.atan2(x,z+12),{lightOn:true});
  // Repeated actual 0.6 m kit ramps terminate below the canonical terrain.
  function ramp(x,deck,z){for(let i=0;i<24;i++){
    const h=deck-i*.6,cz=z+2+i*4,rampPiece=put('foundation-ramp',x,h,cz),up=new Vector3(0,1,0).applyQuaternion(q);let low=Infinity;
    for(let dx=-2;dx<=2;dx+=.5)for(let dz=-2;dz<=2;dz+=.5){const sample=new Vector3(x+dx,0,cz+dz).applyQuaternion(q).add(origin).sub(v(body.center)).normalize();low=Math.min(low,bodySurfacePoint(sample,body).sub(origin).dot(up));}
    const supportIds=[];let top=h-.6;
    while(top>low-.1){const depth=Math.min(MAX_FOUNDATION_DEPTH,Math.max(.6,top-low+.1)),support=put('foundation',x,top,cz,0,{supportDepth:depth});supportIds.push(support.id);top-=depth;}
    rampSupports.push({rampId:rampPiece.id,supportIds,terrainLow:low});
    const at=new Vector3(x,0,cz+2).applyQuaternion(q).add(origin),normal=at.clone().sub(v(body.center)).normalize(),terrain=bodySurfacePoint(normal,body).sub(origin).dot(new Vector3(0,1,0).applyQuaternion(q));
    if(h-.6<terrain+.12)return;
  }throw Error(`${market.name} ramp cannot reach terrain.`);}
  ramp(17,y,36);
  const corePieces=pieces.splice(0),outerPad=put('foundation-pad-large',0,py,260,0,{landingPad:true,graphic:'crimson'});ramp(17,py,296);
  for(const x of [-22,22])put('floodlight',x,py,294,Math.atan2(x,34),{lightOn:true});
  const claim=(id,name,content,offset=0)=>withClaimAnchor({id,body:body.id,name,owner:market.name,useBuffer:false,radius:100,origin:new Vector3(0,0,offset).applyQuaternion(q).add(origin).toArray(),quaternion:q.toArray(),pieces:content.map(p=>({...p,position:[p.position[0],p.position[1],p.position[2]-offset]}))});
  const layout={...market,claim:claim(`build-claim-${claimNumber}`,market.name,corePieces),outerClaim:claim(`build-claim-${claimNumber+1000}`,`${market.name} outer landing area`,pieces,260),pad:outerPad,terminalPiece,terrain:{core,pad,routeSlope:site.route.maxSlope},groundRoute:site.route.points,tower:[-16,y,-12],panel:[-16,y+1.45,-7.75],approach:[0,py+65,260],deck:y,padDeck:py,coreSlab:slab,rampSupports};cache.set(key,layout);return layout;
}
