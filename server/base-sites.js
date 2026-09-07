import {emptyBuild,validBuild} from '../src/build/state.js';
import {validClaimAnchor} from '../src/build/anchors.js';
import {initialPower,advancePower,POWER_PARTS} from '../src/build/power.js';
import {powerEnvironment} from '../src/build/power-environment.js';
import {validItems,fitsBox} from '../src/inventory/containers.js';
const fail=(status,message)=>Object.assign(new Error(message),{status});
export const emptyBaseSites=()=>({build:emptyBuild(),buffers:{},storage:{},revision:0});
function settle(state,now){
 const build={...state.build,claims:state.build.claims.map(c=>advancePower(c,now,t=>powerEnvironment(c,t))).filter(c=>c.power.health>0)};
 const ids=new Set(build.claims.map(c=>c.id)),containers=new Set(build.claims.flatMap(c=>c.pieces.map(p=>p.type==='mainframe'?`build-core-${c.id.split('-').at(-1)}`:`build-crate-${p.id.split('-').at(-1)}`)));
 return {...state,build,storage:Object.fromEntries(Object.entries(state.storage??{}).filter(([id])=>containers.has(id))),buffers:Object.fromEntries(Object.entries(state.buffers).filter(([id])=>ids.has(id)))};
}
/** Account-scoped solo saves. Layout/progression are trusted solo data; UTC upkeep
 * and fuel consumption are server-owned. Never import this into competitive inventory. */
export function updateBaseSites(previous,command,now){
 const current=settle(previous??emptyBaseSites(),now);
 if(command.action==='read')return {...current,revision:current.revision+1};
 if(command.revision!==current.revision)throw fail(409,'Server base save changed. Reload it before saving again.');
 if(command.action==='save'){
  const incoming=command.build;
  if(!validBuild(incoming)||incoming.claims.some(c=>!validClaimAnchor(c)||c.body==='star'))throw fail(400,'Invalid base layout or body anchor.');
  if(incoming.nextId<current.build.nextId)throw fail(409,'This base save is older than the server copy.');
  const known=new Map(current.build.claims.map(c=>[c.id,c]));
  const claims=incoming.claims.flatMap(c=>{
   const old=known.get(c.id);
   // A previously used identity never revives a decayed site, even from an old tab.
   if(!old&&Number(c.id.split('-').at(-1))<current.build.nextId)return [];
   if(old&&JSON.stringify(c.anchor)!==JSON.stringify(old.anchor))throw fail(400,'A saved site cannot change its anchor.');
   if(old&&old.pieces.some(p=>{const next=c.pieces.find(n=>n.id===p.id);return !next||next.type!==p.type||JSON.stringify(next.position)!==JSON.stringify(p.position)||next.rotation!==p.rotation;}))throw fail(409,'Existing pieces cannot be removed or moved by a stale save.');
   return [{...c,power:old?.power??initialPower(now)}];
  });
  // Omission is not demolition. A stale/offline client cannot erase another saved site.
  for(const old of known.values())if(!claims.some(c=>c.id===old.id))claims.push(old);
  const build={...incoming,claims};if(!validBuild(build))throw fail(400,'Combined base save is invalid.');
  const buffers={...current.buffers};
  for(const c of claims){const items=command.buffers?.[c.id];if(items!==undefined){if(!validItems(items))throw fail(400,'Invalid mainframe contents.');buffers[c.id]=structuredClone(items);}}
  const storage={...current.storage};
  for(const c of claims)for(const p of c.pieces.filter(p=>['mainframe','crate','rack'].includes(p.type))){
   const id=p.type==='mainframe'?`build-core-${c.id.split('-').at(-1)}`:`build-crate-${p.id.split('-').at(-1)}`,value=command.storage?.[id]??storage[id];
   if(!value||typeof value.name!=='string'||value.name.length>80||!fitsBox(value.items,value.boxes))throw fail(400,'Missing or invalid base container.');
   storage[id]={name:value.name,kind:'base',boxes:value.boxes,items:structuredClone(value.items)};
   if(p.type==='mainframe')buffers[c.id]=storage[id].items;
  }
  return {build,buffers,storage,revision:current.revision+1};
 }
 const claim=current.build.claims.find(c=>c.id===command.claimId);if(!claim)throw fail(404,'Base has expired or is unavailable.');
 if(command.action==='fuel'){
  const def=Object.values(POWER_PARTS).find(d=>d.fuel===command.item);
  if(!def||!claim.pieces.some(p=>POWER_PARTS[p.type]?.fuel===command.item))throw fail(400,'Build the matching generator first.');
  const amount=command.amount,items=current.buffers[claim.id]??{};
  if(!Number.isFinite(amount)||amount<=0||amount>10||(items[command.item]??0)<amount||claim.power.fuel[command.item]+amount>100)throw fail(400,'Not enough fuel in mainframe supplies, or fuel tank full.');
  items[command.item]-=amount;claim.power.fuel[command.item]+=amount;
 }else if(command.action==='repair'){
  const items=current.buffers[claim.id]??{};if((items['metal-stock']??0)<5)throw fail(400,'Put 5 kg metal stock in mainframe supplies.');
  if(claim.power.health>=100)throw fail(400,'Base is already at full health.');
  items['metal-stock']-=5;claim.power.health=Math.min(100,claim.power.health+25);
 }else throw fail(400,'Unknown base command.');
 const core=`build-core-${claim.id.split('-').at(-1)}`;if(current.storage[core])current.storage[core].items=structuredClone(current.buffers[claim.id]);
 return {...current,revision:current.revision+1};
}
export function createBaseSites({store,now=Date.now}){
 return {async command(accountId,command){return store.mutateBaseSites(accountId,old=>updateBaseSites(old,command,now()));},
  async sweep(){return store.sweepBaseSites(old=>({...settle(old,now()),revision:old.revision+1}));}};
}
