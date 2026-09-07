import {initialPower,advancePower,powerStatus,POWER_PARTS} from './power.js';
import {powerEnvironment} from './power-environment.js';
export const coreId=c=>`build-core-${c.id.split('-').at(-1)}`;
export function pruneBaseStorage(state,claims){
 const keep=new Set(claims.flatMap(c=>c.pieces.filter(p=>['mainframe','crate','rack'].includes(p.type)).map(p=>p.type==='mainframe'?coreId(c):`build-crate-${p.id.split('-').at(-1)}`)));
 const expired=Object.keys(state.remote).filter(id=>/^build-(core|crate)-\d+$/.test(id)&&!keep.has(id));
 return {...state,remote:Object.fromEntries(Object.entries(state.remote).filter(([id])=>!expired.includes(id))),boxes:Object.fromEntries(Object.entries(state.boxes).filter(([id])=>!expired.includes(id)))};
}
export class BasePower {
 constructor({store,build,sandbox=false,now=Date.now}){Object.assign(this,{store,build,sandbox,now});this.last=-Infinity;this.cloud=null;this.statusCache=new WeakMap();}
 update(){const now=this.now();if(now-this.last<10000||this.store.blocked||this.build.blocked||this.cloud?.enabled)return;this.last=now;
  const data=this.store.state.build;if(!data?.claims.length)return;
  const claims=data.claims.map(c=>{const start=this.sandbox?{...c,power:{...(c.power??initialPower(now)),health:100}}:c;return advancePower(start,now,t=>powerEnvironment(c,t),this.sandbox?{decayMs:Infinity}:undefined);}).filter(c=>c.power.health>0);
  this.store.write({...pruneBaseStorage(this.store.state,claims),build:{...data,claims}});
 }
 status(c){const second=Math.floor(this.now()/1000),cached=this.statusCache.get(c);if(cached?.second===second)return cached.value;const value=powerStatus(c,powerEnvironment(c,this.now()));this.statusCache.set(c,{second,value});return value;}
 action(claimId,action,item){
  if(this.cloud?.enabled)return this.cloud.action(claimId,action,item);
  const current=this.build.claims.find(c=>c.id===claimId);if(!current)return {ok:false,message:'Base is unavailable.'};
  const c=advancePower(current,this.now(),t=>powerEnvironment(current,t),this.sandbox?{decayMs:Infinity}:undefined);
  if(c.power.health<=0)return {ok:false,message:'This base has expired.'};
  const container=this.store.container(coreId(c)),items={...container?.items};
  if(action==='sandbox-fuel'&&this.sandbox){items['uranium-ore']=1;items['helium-3-regolith']=1;}else if(action==='fuel'){
   if(!c.pieces.some(p=>POWER_PARTS[p.type]?.fuel===item))return {ok:false,message:'Build the matching generator first.'};
   const amount=.1;if((items[item]??0)<amount||c.power.fuel[item]+amount>100)return {ok:false,message:'Move fuel into mainframe supplies first, or empty the full fuel tank.'};
   items[item]-=amount;c.power.fuel[item]+=amount;
  }else if(action==='repair'){
   if(c.power.health>=100)return {ok:false,message:'Base is at full health.'};if((items['metal-stock']??0)<5)return {ok:false,message:'Put 5 kg metal stock in mainframe supplies.'};items['metal-stock']-=5;c.power.health=Math.min(100,c.power.health+25);
  }else return {ok:false,message:'Unknown power action.'};
  const next=this.store.withItems(this.store.state,coreId(c),items);next.build={...next.build,claims:next.build.claims.map(old=>old.id===c.id?c:old)};
  if(!this.store.validContainers(next))return {ok:false,message:'Make room in mainframe supplies for the fuel.'};
  const ok=this.store.write(next);return {ok,message:ok?action==='fuel'?'Fuel loaded; surplus generation charges batteries.':action==='sandbox-fuel'?'Sandbox fuel supplied: 1 kg uranium and 1 kg helium-3 feedstock.':'Base repaired by 25 health.':this.store.warning};
 }
}
