import { ITEMS } from '../ship-inventory.js';
import { fitsBox } from './containers.js';

/** Station commerce and field operations commit to the same mining/save ledger.
 * The bulk station warehouse remains distinct from the small expedition locker.
 */
export function bindStationLedger(inventory, store) {
  const purchaseStatus = inventory.purchaseStatus.bind(inventory);
  const failed = message => ({ok:false,message});
  const commit = next => store.write(next);
  inventory.purchase = (shopId, itemId) => {
    const check = purchaseStatus(shopId, itemId);
    if (!check.ok) return check;
    const supplies = structuredClone(store.state.supplies), economy = structuredClone(store.state.economy);
    supplies.station[itemId] = (supplies.station[itemId] ?? 0) + 1;
    economy.shopStock[shopId][itemId]--; economy.credits -= check.offer.price;
    if (!commit({...store.state,supplies,economy})) return failed('Purchase not saved. No credits spent or cargo delivered. '+store.warning);
    return {ok:true,itemId,destination:'station',cost:check.offer.price,credits:inventory.credits,
      message:`Purchased 1 ${check.item.name} for ${check.offer.price} credits. Delivered to your station warehouse. Balance: ${inventory.credits} credits.`};
  };
  const transfer = (state,id,from,to,quantity) => {
    const item=ITEMS.find(item=>item.id===id);
    if(!item||!['station','ship','pack'].includes(from)||!['station','ship','pack'].includes(to)||from===to)return null;
    if((state.supplies[from]?.[id]??0)<quantity)return null;
    const supplies=structuredClone(state.supplies);
    supplies[from][id]-=quantity;supplies[to][id]=(supplies[to][id]??0)+quantity;
    const next={...state,supplies};
    if(to==='station') {if(inventory.massOf(supplies.station)>inventory.capacity.station)return null;}
    else if(!fitsBox(store.container(to,next).items,next.boxes[to],store.limits(to,next)))return null;
    return next;
  };
  inventory.transfer=(id,from,to=from==='ship'?'pack':'ship')=>{
    const next=transfer(store.state,id,from,to,1);
    if(!next)return failed('No items available, or destination capacity reached.');
    return commit(next)?{ok:true,message:`${ITEMS.find(item=>item.id===id).name} transferred.`}:failed(store.warning);
  };
  inventory.transferAll=(from,to=from==='ship'?'pack':'ship')=>{
    let next=store.state,moved=0,mass=0;
    for(const item of ITEMS){
      while((next.supplies[from]?.[item.id]??0)>0){
        const planned=transfer(next,item.id,from,to,1);if(!planned)break;
        next=planned;moved++;mass+=item.mass;
      }
    }
    if(!moved)return failed('Nothing fits or the source is empty.');
    if(!commit(next))return failed(store.warning);
    const remaining=ITEMS.reduce((n,item)=>n+(next.supplies[from]?.[item.id]??0),0);
    return {ok:true,moved,mass,remaining,message:`Transferred ${moved} items (${mass.toFixed(1)} kg).${remaining?' Remaining items stay in storage; destination capacity reached.':''}`};
  };
  // Prevent old callers from writing a second, divergent manifest.
  inventory.persist=()=>commit(store.state);
  store.bindManifest(inventory);
}
