import { emptyCommerce,ensureAccount,normalizeCommerce,commerceCommand } from './model.js';
import { POST_COST,tradeSite } from './sites.js';
import * as THREE from 'three';
export const LOCAL_TRADER='local-player';
/** MiningStore keeps cuts, loose ore, cash and SBU cargo in one atomic save. */
export class LocalTrading {
  constructor(store){this.store=store;this.error='';
    this.unavailable={...emptyCommerce(),markets:{}};ensureAccount(this.unavailable,LOCAL_TRADER,store.state.economy.credits);
    if(store.blocked){this.error=store.warning;return;}
    try{
      const previous=store.state.commerce;
      let next=Object.hasOwn(store.state,'commerce')?normalizeCommerce(previous):emptyCommerce();
      if(!next.accounts[LOCAL_TRADER]){next=structuredClone(next);ensureAccount(next,LOCAL_TRADER,store.state.economy.credits);}
      // One normalizing save, including initial stock, before quoting. A read of
      // an exhausted market never creates fresh inventory or writes a new save.
      if(next!==previous&&!store.write({...store.state,commerce:next}))this.error=store.warning;
    }catch(e){this.error=e.message;}
  }
  get state(){
    return this.error?this.unavailable:this.store.state.commerce??this.unavailable;
  }
  command(m,ctx){
    if(this.error||this.store.blocked)throw new Error(this.error||this.store.warning);
    const s=structuredClone(this.state);s.accounts[LOCAL_TRADER].credits=this.store.state.economy.credits;
    const result=commerceCommand(s,LOCAL_TRADER,m,ctx);if(result.replayed)return result;
    let next={...this.store.state,commerce:result.state,economy:{...this.store.state.economy,credits:result.state.accounts[LOCAL_TRADER].credits}};
    if(result.resourceDelta){const items=this.store.container(m.source??'pack').items;next=this.store.withItems(next,m.source??'pack',{...items,[result.resource]:items[result.resource]+result.resourceDelta});}
    if(!this.store.write(next))throw new Error(this.store.warning);return result;
  }
  deploy(nav){
    if(this.error||this.store.blocked)throw new Error(this.error||this.store.warning);
    const s=structuredClone(this.state),a=s.accounts[LOCAL_TRADER];a.credits=this.store.state.economy.credits;
    if(a.credits<POST_COST)throw new Error(`A terminal and landing pad cost ${POST_COST} credits.`);
    if(nav.mode!=='walk'||nav.insideShip||nav.dockedAtStation)throw new Error('Stand outside on the ground to build a trading pad.');
    if(Object.values(s.terminals).length>=4)throw new Error('Four trading pads per owner.');
    const site=tradeSite(nav.position,new THREE.Vector3(0,0,-1).applyQuaternion(nav.orientation));
    if(Object.values(s.terminals).some(t=>new THREE.Vector3(...t.origin).distanceTo(new THREE.Vector3(...site.origin))<100))throw new Error('Keep100m between trading pads.');
    const id=`trade-${s.nextId++}`;s.terminals[id]={id,owner:LOCAL_TRADER,name:'Your trading pad',...site,stock:{},prices:{}};a.credits-=POST_COST;s.revision++;
    if(!this.store.write({...this.store.state,commerce:s,economy:{...this.store.state.economy,credits:a.credits}}))throw new Error(this.store.warning);
    return {message:'Trade terminal and landing pad built. Land centrally to stock it.'};
  }
}
