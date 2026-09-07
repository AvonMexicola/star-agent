import {Matrix4,Quaternion,Vector3} from 'three';
import {SELENE,bodySurfacePoint,bodyOffset} from '../celestial.js';
import {MOON_LANDING_DIRECTION} from '../moon-world.js';
import {emptyItems} from '../inventory/containers.js';
import {emptyBuild,validBuild,addBuildContainer} from './state.js';
import {withClaimAnchor} from './anchors.js';
import {getWorldBoxes,capsuleIntersectsBox} from './collision.js';

export const SANDBOX_PREFIX='star-agent.build-sandbox.v1:';
export const SANDBOX_BINS=Object.freeze(['concrete','concrete','concrete','concrete','concrete','concrete','concrete','concrete','metal-stock','metal-stock','glass','conductor'].map((item,i)=>Object.freeze({id:`sandbox-supply-${i}`,item,quantity:384})));
export function sandboxStorage(storage){
  // All inventory, fleet and legacy migrations receive this same namespace.
  // Missing/denied storage must still fail through the ordinary save guards.
  return storage?{getItem:key=>storage.getItem(SANDBOX_PREFIX+key),setItem:(key,value)=>storage.setItem(SANDBOX_PREFIX+key,value),removeItem:key=>storage.removeItem(SANDBOX_PREFIX+key)}:undefined;
}
export function sandboxURL(href,enabled=true){const url=new URL(href);if(enabled){url.searchParams.delete('rover');url.searchParams.delete('exteriorView');url.searchParams.set('sandbox','build');url.searchParams.set('intro','0');url.searchParams.set('seed','7291');}else url.searchParams.delete('sandbox');return url.href;}
export function sandboxClaim(){
  const up=new Vector3(...MOON_LANDING_DIRECTION).normalize(),east=new Vector3(0,1,0).cross(up).normalize(),north=east.clone().cross(up).normalize();
  const pieces=[{id:'build-piece-2',type:'mainframe',position:[8,0,0],rotation:Math.PI,doorOpen:false}];
  for(const x of [-4,0,4])for(const z of [-4,0,4])pieces.push({id:`build-piece-${pieces.length+2}`,type:'foundation',position:[x,.3,z],rotation:0,doorOpen:false});
  return withClaimAnchor({id:'build-claim-1',body:'selene',name:'Selene build sandbox',owner:'local-player',useBuffer:false,radius:64,origin:bodySurfacePoint(up,SELENE).toArray(),quaternion:new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(east,up,north)).toArray(),pieces});
}
function stock(state){
  let next={...state,boxes:{...state.boxes},remote:{...state.remote}};
  for(const bin of SANDBOX_BINS){next.boxes[bin.id]=8;next.remote[bin.id]={name:`Sandbox ${bin.item} ${Number(bin.id.split('-').at(-1))+1}`,kind:'base',items:{...emptyItems(),[bin.item]:bin.quantity}};}
  return next;
}
export function prepareSandbox(store){
  if(store.blocked)return {ok:false,message:store.warning};
  // The saved bank is the allocation receipt: reload never refills spent stock.
  if(store.state.buildSandbox===1)return {ok:true};
  if(store.state.buildSandbox!==undefined||store.state.build!==undefined)return {ok:false,message:'Sandbox save is unrecognized. Existing data retained.'};
  const claim=sandboxClaim();let next=stock({...store.state,buildSandbox:1,starterConstruction:{version:1,claimed:true},build:{...emptyBuild(),nextId:12,claims:[claim]}});
  next=addBuildContainer(next,'build-core-1','Sandbox mainframe supplies');
  if(!validBuild(next.build)||!store.validContainers(next))return {ok:false,message:'Sandbox supplies could not be prepared.'};
  const ok=store.write(next);return {ok,message:ok?'Sandbox ready.':store.warning};
}
export function refillSandbox(store){
  if(store.state.buildSandbox!==1||store.blocked)return {ok:false,message:store.warning||'Open the build sandbox to refill.'};
  const next=stock(store.state);if(!store.validContainers(next))return {ok:false,message:'Sandbox supply validation failed.'};
  const ok=store.write(next);return {ok,message:ok?'Sandbox bank refilled: 4,608 kg.':store.warning};
}
export function sandboxTotals(store){return Object.fromEntries(['concrete','metal-stock','glass','conductor'].map(item=>[item,SANDBOX_BINS.reduce((sum,bin)=>sum+(store.container(bin.id)?.items[item]??0),0)]));}
export function spawnInSandbox(nav,build){
  const c=build.claims.find(c=>c.id==='build-claim-1');if(!c)throw Error('Sandbox mainframe is unavailable.');
  const origin=new Vector3(...c.origin),rotation=new Quaternion(...c.quaternion),up=bodyOffset(origin,SELENE).normalize();
  // Reload beside the pad, never inside a wall that was built over the old spawn.
  let point;
  for(const radius of [10,14,18,24,32,44,60,72]){
    for(let i=0;i<16;i++){
      const local=new Vector3(Math.sin(i*Math.PI/8)*radius,0,Math.cos(i*Math.PI/8)*radius);
      const ground=bodySurfacePoint(bodyOffset(local.applyQuaternion(rotation).add(origin),SELENE).normalize(),SELENE);
      const feet=build.toLocal(ground,c);
      if(!c.pieces.some(p=>getWorldBoxes(p).some(b=>capsuleIntersectsBox(feet,.4,1.8,b)))){point=ground;break;}
    }if(point)break;
  }
  if(!point)throw Error('No clear sandbox arrival point.');
  nav.transitMoon();nav.position.copy(point).addScaledVector(up,nav.layout.eyeHeight);nav.mode='walk';nav.insideShip=false;nav.shipPosition=null;nav.jumpHeight=0;nav.jumpVelocity=0;nav.velocity.set(0,0,0);nav.angularVelocity.set(0,0,0);
  nav.orientToward(new Vector3(0,.3,4).applyQuaternion(rotation).add(origin),up);nav.keys.clear();nav.gamepad.suspend();
}
