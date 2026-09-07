import {itemById, itemMass} from './containers.js';

export const EQUIPMENT_SLOTS=Object.freeze([
  {id:'weapon1',name:'Weapon 1',kind:'weapon',key:'1'},
  {id:'weapon2',name:'Weapon 2',kind:'weapon',key:'2'},
  {id:'tool',name:'Tool',kind:'tool',key:'3'},
  {id:'backpack',name:'Backpack',kind:'backpack'},
  {id:'ammo1',name:'Ammo 1',kind:'ammo'},
  {id:'ammo2',name:'Ammo 2',kind:'ammo'},
  ...Array.from({length:4},(_,i)=>({id:`quick${i+1}`,name:`Quick ${i+1}`,kind:'quick',key:String(i+4)})),
]);
export const HELD_SLOTS=['weapon1','weapon2','tool'];
const stack=(item,quantity=1)=>({item,quantity});
export function defaultLoadout(){return {version:1,active:'tool',quickIndex:0,health:100,bleeding:false,slots:{
  weapon1:stack('rifle-laser'),weapon2:stack('sidearm-pistol'),tool:stack('mining-laser-tool'),backpack:stack('backpack-life-support'),
  ammo1:stack('carbine-charge',60),ammo2:stack('sidearm-charge',36),quick1:stack('bandage',3),quick2:stack('healing-stim',2),quick3:null,quick4:null,
}};}
export function slotAccepts(id,item){const slot=EQUIPMENT_SLOTS.find(s=>s.id===id),spec=itemById(item);return Boolean(slot&&spec?.category&&slot.kind===spec.category);}
export function validLoadout(l){
  return l?.version===1&&l.slots&&typeof l.slots==='object'&&!Array.isArray(l.slots)
    &&Object.keys(l.slots).length===EQUIPMENT_SLOTS.length&&EQUIPMENT_SLOTS.every(s=>{
      const entry=l.slots[s.id];return entry===null||entry&&slotAccepts(s.id,entry.item)&&Number.isSafeInteger(entry.quantity)&&entry.quantity>0&&entry.quantity<=itemById(entry.item).stack;
    })&&(l.active===null||HELD_SLOTS.includes(l.active)&&Boolean(l.slots[l.active]))
    &&Number.isSafeInteger(l.quickIndex)&&l.quickIndex>=0&&l.quickIndex<4
    &&Number.isFinite(l.health)&&l.health>=0&&l.health<=100&&typeof l.bleeding==='boolean';
}

/** Gear and cargo share the MiningStore transaction, including migration and failure rollback.
 * UI owns physical container access. Slot methods never create or duplicate items. */
export class Loadout {
  constructor(store){this.store=store;}
  get state(){return this.store.state.loadout;}
  get active(){return this.state.active;}
  get item(){return this.state.slots[this.active]?.item??null;}
  get mass(){return itemMass(Object.values(this.state.slots).filter(Boolean).reduce((items,s)=>({...items,[s.item]:(items[s.item]??0)+s.quantity}),{}));}
  result(next,message){
    if(!validLoadout(next.loadout)||!this.store.validContainers(next))return {ok:false,message:'Not enough storage space. Empty the backpack or free a stack slot first.'};
    const ok=this.store.write(next);return {ok,message:ok?message:this.store.warning};
  }
  save(loadout,message){return this.result({...this.store.state,loadout},message);}
  select(id){
    if(id!==null&&(!HELD_SLOTS.includes(id)||!this.state.slots[id]))return {ok:false,message:'That equipment slot is empty.'};
    if(this.active===id)return {ok:true,message:'Already selected.'};
    return this.save({...this.state,active:id},id?`${itemById(this.state.slots[id].item).name} selected.`:'Hands free.');
  }
  cycle(){const available=HELD_SLOTS.filter(id=>this.state.slots[id]);return available.length?this.select(available[(available.indexOf(this.active)+1)%available.length]):this.select(null);}
  toggleTool(){return this.select(this.active==='tool'?null:'tool');}
  assign(id,item,from='pack'){
    if(!slotAccepts(id,item))return {ok:false,message:'That item does not fit this slot.'};
    const source=this.store.container(from);if(!source)return {ok:false,message:'Choose an available container.'};
    const spec=itemById(item),current=this.state.slots[id],same=current?.item===item;
    const amount=Math.min(source.items[item]??0,spec.stack-(same?current.quantity:0));
    if(amount<1)return {ok:false,message:same?'That slot is full.':'No matching items in this container.'};
    const items={...source.items,[item]:source.items[item]-amount};
    if(current&&!same)items[current.item]=(items[current.item]??0)+current.quantity;
    const slots={...this.state.slots,[id]:stack(item,amount+(same?current.quantity:0))};
    const next=this.store.withItems({...this.store.state,loadout:{...this.state,slots}},from,items);
    return this.result(next,`${spec.name} equipped in ${EQUIPMENT_SLOTS.find(s=>s.id===id).name.toLowerCase()}.`);
  }
  stow(id,to='pack'){
    const current=this.state.slots[id],target=this.store.container(to);
    if(!current||!target)return {ok:false,message:'Choose equipped gear and an available container.'};
    if(id==='backpack'&&to==='pack')return {ok:false,message:'An empty backpack must be stowed in external storage.'};
    const slots={...this.state.slots,[id]:null},loadout={...this.state,slots,active:this.active===id?null:this.active};
    const next=this.store.withItems({...this.store.state,loadout},to,{...target.items,[current.item]:(target.items[current.item]??0)+current.quantity});
    return this.result(next,`${itemById(current.item).name} stowed in ${target.name}.`);
  }
  ammoFor(item=this.item){const ammo=itemById(item)?.ammo;if(!ammo)return 0;return ['ammo1','ammo2'].reduce((sum,id)=>sum+(this.state.slots[id]?.item===ammo?this.state.slots[id].quantity:0),0);}
  /** Called by Equipment's fire gate before a shot is emitted. Save failure cancels the shot. */
  spendRound(item){
    if(item!==this.item)return false;
    const ammo=itemById(item)?.ammo,id=['ammo1','ammo2'].find(id=>this.state.slots[id]?.item===ammo);
    if(!ammo||!id)return false;
    const current=this.state.slots[id],slots={...this.state.slots,[id]:current.quantity>1?stack(ammo,current.quantity-1):null};
    return this.save({...this.state,slots},'Charge fired.').ok;
  }
  selectQuick(index){if(!Number.isSafeInteger(index)||index<0||index>3)return {ok:false,message:'Unknown quick slot.'};return this.save({...this.state,quickIndex:index},`Quick ${index+1} selected.`);}
  useQuick(index=this.state.quickIndex){
    const id=`quick${index+1}`,current=this.state.slots[id],item=itemById(current?.item);
    if(!Number.isSafeInteger(index)||index<0||index>3||!item?.heal)return {ok:false,message:'Assign a consumable to this quick slot.'};
    if(this.state.health<=0)return {ok:false,message:'Medical items cannot revive a downed character.'};
    if(this.state.health>=100&&!(item.stopsBleeding&&this.state.bleeding))return {ok:false,message:'Health is full. Item retained.'};
    const slots={...this.state.slots,[id]:current.quantity>1?stack(item.id,current.quantity-1):null};
    return this.save({...this.state,slots,health:Math.min(100,this.state.health+item.heal),bleeding:item.stopsBleeding?false:this.state.bleeding},`${item.name} used.`);
  }
  /** Hook for future authoritative injury systems; no ambient damage is invented here. */
  injure(amount,{bleeding=false}={}){
    if(!Number.isFinite(amount)||amount<=0)return {ok:false,message:'Invalid injury.'};
    return this.save({...this.state,health:Math.max(0,this.state.health-amount),bleeding:this.state.bleeding||bleeding},'Suit medical status updated.');
  }
}
