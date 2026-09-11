import { itemById, itemMass, validItems } from '../src/inventory/containers.js';
export const CAPACITY = Object.freeze({pack:20,ship:120,station:10000});
export function initialInventory() {
  return {revision:0,containers:{pack:{'rifle-laser':1,'sidearm-pistol':1,'mining-laser-tool':1,'tractor-beam-tool':1,'carbine-charge':60,'sidearm-charge':36,bandage:3},ship:{ration:4},station:{}},capacity:{...CAPACITY}};
}
export function restoreInventory(value) {
  if (!value || !Number.isSafeInteger(value.revision) || value.revision<0) return initialInventory();
  for (const key of Object.keys(CAPACITY)) if (!validItems(value.containers?.[key]) || itemMass(value.containers[key])>CAPACITY[key]+1e-7) return initialInventory();
  return {revision:value.revision,containers:structuredClone(value.containers),capacity:{...CAPACITY}};
}
export function quantity(item,amount) {
  const spec=itemById(item);
  if(!spec || !Number.isFinite(amount) || amount<=0 || amount>10000 || (spec.unit!=='kg'&&!Number.isSafeInteger(amount)))throw new Error('Choose a valid item quantity.');
}
export function transferInventory(inventory,{from,to,item,quantity:amount,revision}) {
  if(revision!==inventory.revision)throw new Error('Inventory changed. Review the current contents and try again.');
  if(from===to || !Object.hasOwn(CAPACITY,from)||!Object.hasOwn(CAPACITY,to))throw new Error('Choose different containers.');
  quantity(item,amount);
  if((inventory.containers[from][item]??0)<amount)throw new Error('Not enough items in the source.');
  const next=structuredClone(inventory);
  next.containers[from][item]-=amount;
  next.containers[to][item]=(next.containers[to][item]??0)+amount;
  if(!validItems(next.containers[to])||itemMass(next.containers[to])>CAPACITY[to]+1e-7)throw new Error('Destination capacity exceeded.');
  next.revision++;return next;
}
