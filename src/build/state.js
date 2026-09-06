import { BODIES } from '../celestial.js';
import { PIECES } from './definitions.js';
import { emptyItems } from '../inventory/containers.js';
import { getPlacementBounds } from './collision.js';

export const CLAIM_RADIUS=64, CLAIM_HEIGHT=32, MAX_CLAIMS=8, MAX_PIECES=64;
export const LOCAL_OWNER='local-player';
export const emptyBuild=()=>({version:1,nextId:1,claims:[]});
const vector=(v,n)=>Array.isArray(v)&&v.length===n&&v.every(Number.isFinite);
const id=s=>typeof s==='string'&&/^build-[a-z]+-\d+$/.test(s);
export function validBuild(state){
  if(state?.version!==1||!Number.isSafeInteger(state.nextId)||state.nextId<1||!Array.isArray(state.claims)||state.claims.length>MAX_CLAIMS)return false;
  const ids=new Set();
  for(const c of state.claims){
    if(!c||typeof c!=='object'||Array.isArray(c)||!Array.isArray(c.pieces)||c.pieces.some(p=>!p||typeof p!=='object'||Array.isArray(p)))return false;
    if(!id(c.id)||ids.has(c.id)||!BODIES.some(b=>b.id===c.body)||c.owner!==LOCAL_OWNER||typeof c.useBuffer!=='boolean'||!vector(c.origin,3)||c.origin.some(n=>Math.abs(n)>1e12)||!vector(c.quaternion,4)||Math.abs(Math.hypot(...c.quaternion)-1)>1e-5||c.radius!==CLAIM_RADIUS||typeof c.name!=='string'||c.name.length>80||!Array.isArray(c.pieces)||c.pieces.length>MAX_PIECES||c.pieces.filter(p=>p.type==='mainframe').length!==1)return false;
    ids.add(c.id);
    for(const p of c.pieces){
      if(!id(p.id)||ids.has(p.id)||typeof p.type!=='string'||!Object.hasOwn(PIECES,p.type)||!vector(p.position,3)||Math.hypot(p.position[0],p.position[2])>CLAIM_RADIUS||p.position[1]<-2||p.position[1]>CLAIM_HEIGHT||!Number.isFinite(p.rotation)||Math.abs(p.rotation/(Math.PI/2)-Math.round(p.rotation/(Math.PI/2)))>1e-5||typeof p.doorOpen!=='boolean')return false;
      ids.add(p.id);
      const bounds=getPlacementBounds(p);
      if(bounds.min[1]<-2||bounds.max[1]>CLAIM_HEIGHT||[bounds.min[0],bounds.max[0]].some(x=>[bounds.min[2],bounds.max[2]].some(z=>Math.hypot(x,z)>CLAIM_RADIUS)))return false;
    }
    // Resolve from grounded foundations outward. Unsupported islands and cycles
    // in a malformed save must not become walkable merely by being reloaded.
    const supported=new Set(c.pieces.filter(p=>p.type==='foundation').map(p=>p.id));
    let changed=true;
    while(changed){
      changed=false;
      for(const p of c.pieces){
        if(supported.has(p.id))continue;
        const near=(a,dy,reach)=>supported.has(a.id)&&Math.abs(a.position[1]+dy-p.position[1])<.03&&Math.hypot(a.position[0]-p.position[0],a.position[2]-p.position[2])<=reach;
        const panel=a=>['foundation','floor'].includes(a.type);
        const hasSupport=PIECES[p.type].category==='wall'?c.pieces.some(a=>panel(a)&&near(a,0,2.03))
          :p.type==='floor'?c.pieces.filter(a=>PIECES[a.type].category==='wall'&&near(a,3,2.03)).length>=2
          :p.type==='stairs'?c.pieces.some(a=>panel(a)&&near(a,0,.1)):false;
        if(hasSupport){supported.add(p.id);changed=true;}
      }
    }
    if(c.pieces.some(p=>['wall','floor','stairs'].includes(PIECES[p.type].category)&&!supported.has(p.id)))return false;
  }
  return [...ids].every(id=>Number(id.split('-').at(-1))<state.nextId);
}
export function planCost(store,state,cost,sources=['pack']){
  let next=state;
  const missing={};
  for(const [item,required] of Object.entries(cost)){
    let left=required;
    for(const source of [...new Set(sources)]){
      const c=store.container(source,next);if(!c)continue;
      const take=Math.min(left,c.items[item]??0);if(take<=0)continue;
      next=store.withItems(next,source,{...c.items,[item]:c.items[item]-take});left-=take;
    }
    if(left>1e-7)missing[item]=left;
  }
  return Object.keys(missing).length?{ok:false,missing,message:'Process more construction materials or fill the mainframe buffer.'}:{ok:true,next};
}
export function addBuildContainer(state,id,name){
  return {...state,boxes:{...state.boxes,[id]:2},remote:{...state.remote,[id]:{name,kind:'base',items:emptyItems()}}};
}
