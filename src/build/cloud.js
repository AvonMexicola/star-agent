import {restoreBuildAnchors} from './anchors.js';
import {validBuild} from './state.js';
import {pruneBaseStorage,coreId} from './power-system.js';
const KEY='star-agent.base-cloud.v1';
const storageKey=storage=>JSON.stringify(Object.entries(storage??{}).sort(([a],[b])=>a.localeCompare(b)).map(([id,v])=>[id,v.name,v.boxes,Object.entries(v.items).sort(([a],[b])=>a.localeCompare(b))]));
const layoutKey=build=>JSON.stringify(build?.claims.map(({power,origin,quaternion,...c})=>c)??[]);
export class BaseCloud {
 constructor({store,build,power,sandbox=false,fetchImpl=globalThis.fetch}){
  Object.assign(this,{store,build,power,sandbox,fetchImpl});this.enabled=false;this.busy=false;this.status=sandbox?'Sandbox · local only':'Browser save · not on server';this.profile=null;this.elapsed=0;
  power.cloud=this;const previousWrite=store.onWrite;store.onWrite=next=>{previousWrite?.(next);if(this.enabled&&!this.applying)this.status='Server save pending · local changes queued';};
 }
 async request(command){const response=await this.fetchImpl('/api/bases',{credentials:'same-origin',...(command?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...command,accountId:this.accountId})}:{})});const data=await response.json();if(!response.ok)throw Error(data.error??'Base server unavailable.');if(data.accountId&&this.accountId&&data.accountId!==this.accountId)throw Error('Account changed. Sign in to the account that owns these bases.');return data;}
 async account(){const response=await this.fetchImpl('/api/auth/session',{credentials:'same-origin'});const data=await response.json();if(!data.account?.id)throw Error('Sign in through Online, then return to solo play to connect base saves.');return data.account.id;}
 async connect({restore=false}={}){
  if(this.sandbox)return {ok:false,message:'Sandbox bases stay local and do not decay.'};if(this.busy)return {ok:false,message:'Server save in progress.'};this.busy=true;
  try{
   const account=await this.account(),previous=JSON.parse(this.store.storage.getItem(KEY)??'null');
   if(restore&&previous?.account!==account)throw Error('Sign in to the account that owns this base save.');
   this.accountId=account;this.profile=await this.request();
   // Preserve the complete local transaction before an explicit server restore.
   if(this.profile.build.claims.length||this.profile.build.nextId>1){this.store.storage.setItem(KEY+'.local-backup',this.store.persistedRaw??'');this.apply(this.profile);}
   else this.profile=await this.request(this.snapshot());
   this.apply(this.profile);this.enabled=true;this.store.storage.setItem(KEY,JSON.stringify({account}));this.status='Saved on server · upkeep continues offline';return {ok:true,message:this.status};
  }catch(error){this.status=error.message;return {ok:false,message:error.message};}finally{this.busy=false;}
 }
 async restore(){if(!this.sandbox&&this.store.storage?.getItem(KEY)){this.enabled=true;return this.connect({restore:true});}}
 snapshot(){const build=this.store.state.build??{version:1,nextId:1,claims:[]},storage={};for(const c of build.claims)for(const p of c.pieces.filter(p=>['mainframe','crate','rack'].includes(p.type))){const id=p.type==='mainframe'?coreId(c):`build-crate-${p.id.split('-').at(-1)}`,box=this.store.container(id);storage[id]={name:box.name,kind:'base',items:box.items,boxes:box.boxes};}return {action:'save',revision:this.profile.revision,build,storage};}
 apply(profile,{sent=null}={}){
  const restored=restoreBuildAnchors(profile.build);if(!restored.ok||!validBuild(restored.build))throw Error('Invalid server base save; local data retained.');
  let next=this.store.state,build=restored.build;
  // A save response may arrive after another local placement. Keep those new
  // changes queued while accepting server power and expired-site removal.
  if(sent&&layoutKey(next.build)!==layoutKey(sent.build)){
   const server=new Map(build.claims.map(c=>[c.id,c]));build={...next.build,claims:next.build.claims.filter(c=>server.has(c.id)||!sent.build.claims.some(p=>p.id===c.id)).map(c=>server.has(c.id)?{...c,power:server.get(c.id).power}:c)};
  }
  next={...pruneBaseStorage(next,build.claims),build,boxes:{...next.boxes},remote:{...next.remote}};
  next=pruneBaseStorage(next,build.claims);
  for(const [id,value] of Object.entries(profile.storage??{})){
   // Preserve transfers made while a save was in flight; the next save sends them.
   if(sent&&JSON.stringify(this.store.container(id)?.items)!==JSON.stringify(sent.storage[id]?.items))continue;
   next.boxes[id]=value.boxes;next.remote[id]={name:value.name,kind:'base',items:value.items};
  }
  this.applying=true;try{if(!this.store.validContainers(next)||!this.store.write(next))throw Error('Could not cache server bases locally. Reload to retry.');}finally{this.applying=false;}this.build.sync();
 }
 async sync(){if(!this.enabled||this.busy)return;if(this.store.blocked){this.status='Server save pending · reload to recover the local cache';return;}this.busy=true;
  try{
   const previous=this.profile,latest=await this.request();
   if(latest.build.claims.some(c=>{const prior=previous.build.claims.find(p=>p.id===c.id);return !prior||layoutKey({claims:[c]})!==layoutKey({claims:[prior]});})){throw Error('Another session changed these bases. Reconnect server save to load it.');}
   if(Object.entries(latest.storage??{}).some(([id,value])=>storageKey({[id]:value})!==storageKey({[id]:previous.storage?.[id]??{name:'',boxes:0,items:{}}})))throw Error('Server inventory changed. Reconnect server save to restore it.');
   this.profile=latest;const sent=this.snapshot();this.profile=await this.request(sent);this.apply(this.profile,{sent});const pending=this.snapshot();this.status=layoutKey(pending.build)!==layoutKey(this.profile.build)||storageKey(pending.storage)!==storageKey(this.profile.storage)?'Server save pending · local changes queued':'Saved on server · upkeep continues offline';
  }catch(error){this.status=`Server save pending · ${error.message}`;}finally{this.busy=false;}
 }
 update(dt){this.elapsed+=dt;if(this.elapsed>=10){this.elapsed=0;void this.sync();}}
 async action(claimId,action,item){
  await this.sync();if(this.busy||this.status.startsWith('Server save pending'))return {ok:false,message:this.status};this.busy=true;
  try{this.profile=await this.request({action,claimId,item,amount:.1,revision:this.profile.revision});this.apply(this.profile);return {ok:true,message:action==='fuel'?'Fuel loaded on server.':'Base repaired on server.'};}
  catch(error){return {ok:false,message:error.message};}finally{this.busy=false;}
 }
}
