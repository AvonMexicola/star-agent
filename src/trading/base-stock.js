import { TRADE_RESOURCES,resourceById } from './resources.js';
import { fitsBox,emptyItems } from '../inventory/containers.js';
import { PIECES } from '../build/definitions.js';
import { pieceContainer } from '../build/removal.js';
const check=(ok,message)=>{if(!ok)throw Error(message);};
const own=(o,k)=>Object.hasOwn(o??{},k);
const quantity=n=>Number.isSafeInteger(n)&&n>=0&&n<=100000;
export const baseStoragePieces=claim=>claim.pieces.filter(p=>['crate','rack','mainframe'].includes(p.type));
export const offered=(terminal,source,resource)=>terminal.base?.offers[source]?.[resource]??0;
export function baseStorage(claim,getContainer){
  return Object.fromEntries(baseStoragePieces(claim).map(p=>{
    const id=pieceContainer(claim,p),c=getContainer?.(id);
    return [id,{name:c?.name??PIECES[p.type].label,boxes:c?.boxes??PIECES[p.type].storageBoxes??2,items:{...emptyItems(),...c?.items}}];
  }));
}
export function saleStock(base){return Object.fromEntries(TRADE_RESOURCES.map(r=>[r.id,Object.values(base.offers).reduce((sum,o)=>sum+(o[r.id]??0),0)]));}
export function validBaseStock(t){
  try{
    const b=t.base;check(b?.version===1&&typeof b.shared==='boolean'&&typeof b.public==='boolean'&&typeof b.open==='boolean','base');
    check(b.storage&&b.offers&&Object.keys(b.storage).length<=64,'storage');
    const sources=new Set(baseStoragePieces(b.claim).map(p=>pieceContainer(b.claim,p)));
    check(Object.keys(b.storage).length===sources.size,'sources');
    for(const [id,c] of Object.entries(b.storage)){
      check(sources.has(id)&&typeof c.name==='string'&&c.name.length<=80&&fitsBox(c.items,c.boxes),'container');
      const p=baseStoragePieces(b.claim).find(p=>pieceContainer(b.claim,p)===id);check(!b.shared||c.boxes===(PIECES[p.type].storageBoxes??2),'capacity');
    }
    for(const [id,offers] of Object.entries(b.offers)){
      check(own(b.storage,id)&&offers&&typeof offers==='object'&&!Array.isArray(offers),'source');
      for(const [resource,n] of Object.entries(offers)){const r=resourceById(resource);check(r&&quantity(n)&&b.storage[id].items[resource]+1e-7>=n*r.kgPerSBU,'reservation');}
    }
    const stock=saleStock(b);check(TRADE_RESOURCES.every(r=>(t.stock[r.id]??0)===stock[r.id]),'stock');return true;
  }catch{return false;}
}
export function setBaseOffer(t,source,resource,sbu,price){
  const r=resourceById(resource),b=t.base;
  check(r&&own(b.storage,source)&&quantity(sbu),'Choose local stock and an offered quantity.');
  check(Number.isSafeInteger(price)&&price>0&&price<=10000,'Choose a price from 1 to 10,000 credits.');
  check(b.storage[source].items[resource]+1e-7>=sbu*r.kgPerSBU,'The offered quantity exceeds this container’s stock.');
  b.offers[source]={...b.offers[source],[resource]:sbu};t.prices[resource]=price;t.stock=saleStock(b);
}
export function consumeBaseOffer(t,resource,sbu){
  let left=sbu;const r=resourceById(resource);
  for(const id of Object.keys(t.base.offers).sort()){
    const n=Math.min(left,offered(t,id,resource));if(!n)continue;
    t.base.offers[id][resource]-=n;t.base.storage[id].items[resource]-=n*r.kgPerSBU;left-=n;
  }
  check(left===0,'Stock changed. Refresh the offer.');t.stock=saleStock(t.base);
}
/** Every local save passes this gate, including crafting, transfer, cloud restore
 * and decay. It never duplicates storage: the ledger holds a checked projection. */
export function reconcileLocalBaseStock(next){
  const terminals=next.commerce?.terminals;if(!terminals)return next;
  let commerce=null;
  for(const [id,t] of Object.entries(terminals)){
    if(!t.base||t.base.shared)continue;
    const claim=next.build?.claims.find(c=>c.id===t.base.claim.id),reserved=Object.values(t.stock).some(n=>n>0);
    if(!claim||!claim.pieces.some(p=>p.id===t.base.terminalPiece&&p.type==='terminal')){
      check(!reserved,'Unlist the base’s sale stock before removing its terminal or storage.');
      commerce??=structuredClone(next.commerce);delete commerce.terminals[id];continue;
    }
    const storage=baseStorage(claim,key=>next.remote[key]?{...next.remote[key],boxes:next.boxes[key]}:null);
    for(const [source,offers] of Object.entries(t.base.offers))for(const [r,n] of Object.entries(offers))
      check(!n||storage[source]&&next.remote[source]&&storage[source].items[r]+1e-7>=n*resourceById(r).kgPerSBU,'Some of this stock is reserved for sale. Reduce the offer at the trade terminal first.');
    const offers=Object.fromEntries(Object.entries(t.base.offers).filter(([source])=>own(storage,source)));
    if(JSON.stringify([storage,claim,offers])!==JSON.stringify([t.base.storage,t.base.claim,t.base.offers])){
      commerce??=structuredClone(next.commerce);Object.assign(commerce.terminals[id].base,{storage,claim:structuredClone(claim),offers});
    }
  }
  if(commerce)commerce.revision++;return commerce?{...next,commerce}:next;
}
export const basePadSummary=t=>t.base?`Landing pads: ${[...new Set(t.base.claim.pieces.filter(p=>p.landingPad).map(p=>PIECES[p.type]?.label).filter(Boolean))].join(', ')}`:'';
export function publicBaseTerminal(t,owner,{near=false}={}){
  if(!t.base||t.owner===owner)return t;
  const {storage,offers,claim,...base}=t.base;
  return {...t,padSummary:basePadSummary(t),base:{...base,claim:near?claim:{id:claim.id,name:claim.name,body:claim.body,origin:claim.origin,quaternion:claim.quaternion,anchor:claim.anchor,radius:claim.radius,pieces:[]}}};
}
export function tradeSummary(t){
  const goods=TRADE_RESOURCES.filter(r=>(t.stock[r.id]??0)>0);
  return `${t.base?.open===false?'Shop closed':goods.length?'Sells: '+goods.slice(0,3).map(r=>r.name).join(', ')+(goods.length>3?` · +${goods.length-3} more`:''):'No goods listed'}`;
}

/** Full immutable layouts are sent on nearby-set changes, not every room tick. */
export function hydrateBaseCommerce(previous,incoming){
  if(!incoming)return incoming;
  const layouts=incoming.baseLayouts??previous?.baseLayouts??[];
  return {...incoming,baseLayouts:layouts,terminals:(incoming.terminals??[]).map(t=>{
    if(!t.base)return t;const layout=layouts.find(l=>l.id===t.id);return layout?{...t,base:{...t.base,claim:layout.claim}}:t;
  })};
}

/** Trusted upkeep/cloud reconciliation may remove a site or reduce its storage.
 * Cancel only the now-invalid offers before committing that same lifecycle save. */
export function releaseInvalidBaseOffers(next){
  if(!next.commerce)return next;let commerce=null;
  for(const [id,t] of Object.entries(next.commerce.terminals)){
    if(!t.base||t.base.shared)continue;
    const claim=next.build?.claims.find(c=>c.id===t.base.claim.id);
    if(!claim||!claim.pieces.some(p=>p.id===t.base.terminalPiece)){
      commerce??=structuredClone(next.commerce);delete commerce.terminals[id];continue;
    }
    for(const [source,offers] of Object.entries(t.base.offers))for(const [resource,n]of Object.entries(offers)){
      const available=Math.floor((next.remote[source]?.items[resource]??0)/resourceById(resource).kgPerSBU);
      if(n<=available)continue;commerce??=structuredClone(next.commerce);commerce.terminals[id].base.offers[source][resource]=available;
    }
    if(commerce?.terminals[id])commerce.terminals[id].stock=saleStock(commerce.terminals[id].base);
  }
  if(commerce)commerce.revision++;return commerce?{...next,commerce}:next;
}
