import { TRADE_RESOURCES } from './resources.js';
import { offered } from './base-stock.js';
/** One resource per page leaves room for readable stock and controller actions. */
export function renderBaseStock({content,selection,button,terminal:t,source,size,page,busy,near,dock,run}){
  const r=TRADE_RESOURCES[page],c=t.base.storage[source];
  if(!c){const p=document.createElement('p');p.textContent='No local storage is linked to this terminal.';content.append(p);return;}
  selection.append(button(t.base.public?'Beacon: Public':'Beacon: Private','base-public',()=>run({op:'base-settings',setting:'public',value:!t.base.public}),busy||!near),button(t.base.open?'Shop: Open':'Shop: Closed','base-open',()=>run({op:'base-settings',setting:'open',value:!t.base.open}),busy||!near));
  const n=offered(t,source,r.id),kg=c.items[r.id]??0,price=t.prices[r.id]??r.buy;
  const row=document.createElement('article');row.className='base-stock-row';
  const text=document.createElement('div'),title=document.createElement('h3');title.textContent=r.name;
  const detail=document.createElement('p');detail.textContent=`Stored: ${kg.toFixed(1)} kg · For sale: ${n} SBU (${n*r.kgPerSBU} kg) · Kept: ${(kg-n*r.kgPerSBU).toFixed(1)} kg`;
  const value=document.createElement('p');value.textContent=`${price} CR / SBU · ${r.kgPerSBU} kg / SBU · ${c.name}`;text.append(title,detail,value);
  const actions=document.createElement('div');actions.className='base-stock-actions';
  const offer=(quantity,p=price)=>run({op:'base-offer',resource:r.id,quantity,price:p});
  actions.append(button(`Offer +${size} SBU`,'base-offer-add',()=>offer(n+size),busy||!near||(n+size)*r.kgPerSBU>kg+1e-7),button(`Offer −${size} SBU`,'base-offer-less',()=>offer(Math.max(0,n-size)),busy||!near||!n),button('Stop selling','base-unlist',()=>offer(0),busy||!near||!n));
  for(const delta of [-5,5])actions.append(button(`${delta>0?'+':''}${delta} CR`,'base-price-'+delta,()=>offer(n,Math.max(1,Math.min(10000,price+delta))),busy||!near||(delta<0?price===1:price===10000)));
  actions.append(button(`Load ${size} SBU aboard`,'base-withdraw',()=>run({op:'base-withdraw',resource:r.id,sbu:size}),busy||!near||!dock||kg-n*r.kgPerSBU+1e-7<size*r.kgPerSBU));
  row.append(text,actions);content.append(row);
  const note=document.createElement('p');note.textContent='Only the offered quantity is reserved for visitors. New deposits stay unlisted. Prices apply to this resource across the base.';content.append(note);
}
