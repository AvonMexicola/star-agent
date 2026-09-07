import { SBU_SIZES, capacitySBU, placeCrate, validGrid, canRemoveCrate } from '../cargo/grid.js';
import { tractorCommand,validLooseCargo } from '../cargo/tractor-ledger.js';
import { AEON_MARKET_ID,createMarket,validMarkets,marketIdForTerminal,quoteMarket } from './market.js';
export const TRADE_RESOURCES=Object.freeze([
  {id:'basalt',name:'Basalt concentrate',kgPerSBU:16,buy:20,sell:12,color:0x9aa4ac},
  {id:'copper',name:'Copper ore',kgPerSBU:16,buy:48,sell:30,color:0xc58c60},
  {id:'ice',name:'Water ice',kgPerSBU:16,buy:24,sell:15,color:0x8ed9e4},
  {id:'aggregate',name:'Aggregate',kgPerSBU:16,buy:28,sell:17,color:0xb5aaa0},
  {id:'metal-stock',name:'Metal stock',kgPerSBU:16,buy:64,sell:40,color:0xa0b8b0},
  {id:'conductor',name:'Conductor stock',kgPerSBU:16,buy:80,sell:50,color:0xd9ad72},
]);
export const resourceById=id=>TRADE_RESOURCES.find(r=>r.id===id);
export const shipKey=(owner,hull)=>`${owner}:${hull}`;
export const emptyCommerce=()=>({version:1,marketVersion:1,revision:0,nextId:1,accounts:{},ships:{},terminals:{},receipts:{},markets:{[AEON_MARKET_ID]:createMarket(TRADE_RESOURCES)}});
const check=(condition,message)=>{if(!condition)throw new Error(message);};
const int=(n,max=1e9)=>Number.isSafeInteger(n)&&n>=0&&n<=max;
const safe=id=>typeof id==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9:_-]{0,119}$/.test(id)&&!['constructor','prototype','__proto__'].includes(id);
export function ensureAccount(state,owner,credits=1500){
  check(safe(owner),'Invalid account.');
  if(!Object.hasOwn(state.accounts,owner)){
    state.accounts[owner]={credits,carried:null,resources:{}};
    for(const hull of ['nomad','atlas'])state.ships[shipKey(owner,hull)]={id:shipKey(owner,hull),owner,hull,crates:[]};
  }
  return state.accounts[owner];
}
export function validCommerce(s){
  try{
    check(s?.version===1&&int(s.revision)&&int(s.nextId)&&s.nextId>0,'version');
    check(s.accounts&&s.ships&&s.terminals&&s.receipts,'state');
    // Absence alone identifies the legacy fixed-price ledger. Partial/corrupt
    // market records must never be repaired by resetting their finite supply.
    const legacy=!Object.hasOwn(s,'markets')&&!Object.hasOwn(s,'marketVersion');
    check(legacy||s.marketVersion===1&&validMarkets(s.markets,TRADE_RESOURCES),'markets');
    const ids=new Set();
    const crate=c=>{check(c&&safe(c.id)&&!ids.has(c.id)&&SBU_SIZES.includes(c.sbu)&&resourceById(c.resource),'crate');ids.add(c.id);};
    for(const [id,a] of Object.entries(s.accounts)){check(safe(id)&&int(a.credits)&&Object.entries(a.resources??{}).every(([r,n])=>resourceById(r)&&Number.isFinite(n)&&n>=0&&n<=48),'account');if(a.carried){crate(a.carried);check(a.carried.sbu===1,'carry');}}
    for(const [id,h] of Object.entries(s.ships)){check(id===shipKey(h.owner,h.hull)&&s.accounts[h.owner]&&capacitySBU(h.hull)>0&&validGrid(h.hull,h.crates),'ship');h.crates.forEach(crate);}
    check(validLooseCargo(s.loose??{}),'loose cargo');for(const c of Object.values(s.loose??{}))crate(c);
    for(const [id,t] of Object.entries(s.terminals)){
      check(safe(id)&&s.accounts[t.owner]&&Array.isArray(t.position)&&t.position.length===3&&t.position.every(Number.isFinite)&&t.stock&&t.prices,'terminal');
      for(const r of TRADE_RESOURCES)check(int(t.stock[r.id]??0,100000)&&int(t.prices[r.id]??r.buy,10000)&&((t.prices[r.id]??r.buy)>0),'stock');
    }
    check(Object.keys(s.rocks??{}).length<=128&&Object.values(s.rocks??{}).every(r=>int(r.revision)&&r.revision>0&&typeof r.field==='string'&&r.field.length<400000&&Array.isArray(r.position)&&r.position.length===3&&r.position.every(Number.isFinite)),'excavation');
    return true;
  }catch{return false;}
}
/** Add finite NPC stock to the legacy JSON ledger. Call inside the existing save
 * transaction and persist the result once; normalized reads retain all stock. */
export function normalizeCommerce(source){
  check(validCommerce(source),'Cargo save is invalid; original data retained.');
  return Object.hasOwn(source,'markets')?source:{...structuredClone(source),marketVersion:1,markets:{[AEON_MARKET_ID]:createMarket(TRADE_RESOURCES)}};
}
/** Pure commands consume trusted context. Caller derives reach, docking and theft
 * permission from authoritative pose; no client-supplied permission is accepted. */
export function commerceCommand(source,owner,m,ctx){
  source=normalizeCommerce(source);
  check(safe(m.commandId),'Missing transaction identity.');
  const receiptKey=`${owner}:${m.commandId}`;
  if(Object.hasOwn(source.receipts,receiptKey))return {state:source,...source.receipts[receiptKey],replayed:true};
  check(m.revision===source.revision,'Cargo changed. Review the manifest and try again.');
  const s=structuredClone(source),a=ensureAccount(s,owner),ship=s.ships[m.ship],r=resourceById(m.resource),terminal=Object.hasOwn(s.terminals,m.terminal)?s.terminals[m.terminal]:null;
  let message='',resourceDelta=0,quote=null;
  const ownedShip=()=>check(ship?.owner===owner,'Choose your ship.');
  const docked=()=>{ownedShip();check(ctx.docked?.(ship,m.terminal),'Choose a ship docked at this terminal.');};
  const atTerminal=()=>check(ctx.terminal?.(m.terminal),'Walk up to the trade terminal.');
  const add=(c)=>{const placed=placeCrate(ship.hull,ship.crates,c);check(placed,'No cargo grid space for that crate. Smaller crates may fit.');ship.crates.push(placed);};
  const selected=()=>{const c=ship?.crates.find(c=>c.id===m.crate);check(c,'Crate no longer present.');check(canRemoveCrate(ship.hull,ship.crates,c.id),'Remove the crates above this one first.');return c;};
  const remove=c=>{ship.crates=ship.crates.filter(x=>x.id!==c.id);};
  const stationQuote=(side,sbu)=>{
    // The resolver is trusted server/local context, never a client market ID.
    const id=ctx.stationMarket?ctx.stationMarket(m.terminal):marketIdForTerminal(m.terminal);
    check(typeof id==='string'&&Object.hasOwn(s.markets,id),'Unknown station market.');
    quote=quoteMarket(s.markets[id],r,side,sbu);check(quote.ok,quote.reason);return quote;
  };
  if(['buy','sell','pack','stock'].includes(m.op)){
    atTerminal();docked();check(r,'Choose a resource.');
    check(SBU_SIZES.includes(m.sbu),'Choose a crate size.');
  }
  if(m.op.startsWith('tractor-')){
    message=tractorCommand(s,owner,m,ctx);
  }else if(m.op==='buy'){
    const price=terminal?(terminal.prices[r.id]??r.buy)*m.sbu:stationQuote('buy',m.sbu).total;
    check(a.credits>=price,'Insufficient credits.');
    if(terminal){check((terminal.stock[r.id]??0)>=m.sbu,'Seller does not have that much stock.');check(terminal.owner!==owner,'Use Withdraw stock for your own terminal.');}
    add({id:`sbu-${s.nextId++}`,resource:r.id,sbu:m.sbu});
    a.credits-=price;
    if(terminal){terminal.stock[r.id]-=m.sbu;s.accounts[terminal.owner].credits+=price;}
    else s.markets[quote.marketId].stock[r.id]=quote.stockAfter;
    message=`Loaded ${m.sbu} SBU of ${r.name} aboard ${ship.hull} for ${price} CR.`;
  }else if(m.op==='sell'){
    check(!terminal,'Player terminals buy only stock deposited by their owner.');
    const c=selected();check(c.resource===r.id&&c.sbu===m.sbu,'Crate changed.');stationQuote('sell',c.sbu);
    remove(c);a.credits+=quote.total;s.markets[quote.marketId].stock[r.id]=quote.stockAfter;
    message=`Sold ${c.sbu} SBU of ${r.name} for ${quote.total} CR.`;
  }else if(m.op==='pack'){
    check(ctx.resources?.(r.id)>=r.kgPerSBU*m.sbu,'Not enough loose resources in the selected source.');
    add({id:`sbu-${s.nextId++}`,resource:r.id,sbu:m.sbu});resourceDelta=-r.kgPerSBU*m.sbu;
    message=`Packed ${m.sbu} SBU aboard ${ship.hull}.`;
  }else if(m.op==='stock'){
    check(terminal?.owner===owner,'Only the terminal owner can deposit stock.');
    const c=selected();check(c.resource===r.id&&c.sbu===m.sbu,'Crate changed.');
    remove(c);terminal.stock[r.id]=(terminal.stock[r.id]??0)+c.sbu;message=`Listed ${c.sbu} SBU for visitors to buy.`;
  }else if(m.op==='withdraw'){
    atTerminal();docked();check(terminal?.owner===owner&&r&&SBU_SIZES.includes(m.sbu),'Choose your stock.');
    check((terminal.stock[r.id]??0)>=m.sbu,'Not enough stock.');add({id:`sbu-${s.nextId++}`,resource:r.id,sbu:m.sbu});terminal.stock[r.id]-=m.sbu;message='Stock loaded aboard.';
  }else if(m.op==='price'){
    atTerminal();check(terminal?.owner===owner&&r&&int(m.price,10000)&&m.price>0,'Choose a price from 1 to 10,000 credits.');terminal.prices[r.id]=m.price;message='Price saved.';
  }else if(m.op==='take'){
    check(!Object.values(s.loose??{}).some(c=>c.holder===owner&&c.until>(ctx.now?.()??Date.now())),'Release your tractor crate before hand carrying.');
    const c=selected();check(ctx.crate?.(ship,c),'Walk within reach of the crate through an open hatch.');
    check(ship.owner===owner||ctx.loot?.(ship,c),'Board the ship or disable it before taking cargo.');
    check(c.sbu===1,'Only a 1 SBU crate can be carried by hand.');check(!a.carried,'Your hands are already full.');remove(c);a.carried={id:c.id,resource:c.resource,sbu:c.sbu};message='Carrying 1 SBU. Walk to a cargo grid to stow it.';
  }else if(m.op==='stow'){
    ownedShip();check(a.carried,'You are not carrying a crate.');check(ctx.grid?.(ship),'Walk within reach of the cargo grid.');add(a.carried);a.carried=null;message='Crate secured on the cargo grid.';
  }else if(m.op==='haul'){
    throw new Error('Equip the tractor beam to move larger crates physically.');
  }else throw new Error('Unknown cargo command.');
  check(int(a.credits)&&(!terminal||int(s.accounts[terminal.owner].credits)),'Credit limit exceeded.');
  s.revision++;const receipt={message,resourceDelta,...(m.resource?{resource:m.resource}:{}),...(quote?{quote}:{})};s.receipts[receiptKey]=receipt;
  // Bounded history plus revision validation: old retries cannot execute again.
  const keys=Object.keys(s.receipts);if(keys.length>512)delete s.receipts[keys[0]];
  check(validCommerce(s),'Cargo transaction failed validation.');return {state:s,...receipt};
}
