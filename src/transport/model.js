import {transportRoute} from './catalog.js';
import {canRemoveCrate} from '../cargo/grid.js';
const check=(ok,message)=>{if(!ok)throw new Error(message);};
const record=x=>x&&typeof x==='object'&&!Array.isArray(x);
const integer=n=>Number.isSafeInteger(n)&&n>=0&&n<=1e9;
const locations=s=>[
  ...Object.values(s.ships).flatMap(ship=>ship.crates.map(crate=>({crate,ship,owner:ship.owner}))),
  ...Object.entries(s.accounts).flatMap(([owner,a])=>a.carried?[{crate:a.carried,owner,carried:a}]:[]),
  ...Object.values(s.loose??{}).map(crate=>({crate,loose:true})),
];

/** Optional, additive ledger fields. Legacy cargo is untouched; malformed freight
 * never gets repaired by issuing a replacement or resetting completion history. */
export function validTransports(s){
  try{
    const crates=locations(s),ids=new Set();
    for(const [owner,a] of Object.entries(s.accounts)){
      if(!Object.hasOwn(a,'transport'))continue;
      const f=a.transport;check(record(f)&&f.version===1&&integer(f.completed)&&integer(f.earned)&&Array.isArray(f.history)&&f.history.length<=8,'freight ledger');
      check(f.history.every(h=>record(h)&&transportRoute(h.route)&&typeof h.id==='string'&&integer(h.paid)&&h.paid===transportRoute(h.route).reward),'freight history');
      if(f.active===null)continue;
      const m=f.active,r=transportRoute(m?.route);
      check(record(m)&&r&&/^freight-[1-9][0-9]*$/.test(m.id)&&!ids.has(m.id)&&['accepted','issued'].includes(m.phase),'freight mission');ids.add(m.id);
      const matching=crates.filter(({crate:c})=>c.transport?.id===m.id);
      if(m.phase==='accepted'){check(m.crate===null&&matching.length===0,'unissued crate');continue;}
      check(typeof m.crate==='string'&&matching.length===1,'one sealed crate');
      const {crate:c,owner:carriedBy}=matching[0];
      check(c.id===m.crate&&c.transport.owner===owner&&(!carriedBy||carriedBy===owner)&&(!c.holder||c.holder===owner)&&c.sbu===r.sbu&&c.resource===r.resource,'freight seal');
    }
    for(const {crate:c} of crates){if(!Object.hasOwn(c,'transport'))continue;const seal=c.transport;
      check(record(seal)&&Object.keys(seal).length===2&&Object.hasOwn(s.accounts,seal.owner),'freight owner');
      const m=s.accounts[seal.owner].transport?.active;
      check(m?.phase==='issued'&&m.id===seal.id&&m.crate===c.id,'orphan freight');
    }
    return true;
  }catch{return false;}
}

/** Runs inside the existing commerce CAS/idempotency/save transaction. Context is
 * derived by local navigation or the server, never from submitted pose or owner. */
export function transportCommand(s,owner,m,ctx){
  const account=s.accounts[owner];
  account.transport??={version:1,active:null,completed:0,earned:0,history:[]};
  const freight=account.transport,active=freight.active;
  if(m.op==='transport-accept'){
    const route=transportRoute(m.route);check(route,'Choose an available transport contract.');
    check(!active,'Complete or abandon your current transport contract first.');
    check(ctx.transportAvailable?.(route),'Transport sites are unavailable in this world.');
    freight.active={id:`freight-${s.nextId++}`,route:route.id,phase:'accepted',crate:null};
    return 'Contract accepted. Fly to the pickup site and order your sealed crate at its terminal.';
  }
  check(active&&m.mission===active.id,'This transport contract is not yours or is no longer active.');
  const route=transportRoute(active.route);
  if(m.op==='transport-abandon'){
    const entry=locations(s).find(({crate:c})=>c.transport?.id===active.id);
    if(entry?.ship){check(canRemoveCrate(entry.ship.hull,entry.ship.crates,entry.crate.id),'Unload crates above the mission crate before abandoning.');entry.ship.crates=entry.ship.crates.filter(c=>c.id!==entry.crate.id);}
    if(entry?.carried)entry.carried.carried=null;
    if(entry?.loose)delete s.loose[entry.crate.id];
    freight.active=null;return 'Transport abandoned. The sealed mission crate was recalled; no payment issued.';
  }
  const pickup=m.op==='transport-order';
  check(pickup||m.op==='transport-deposit','Unknown transport command.');
  check(m.terminal===(pickup?route.from:route.to),pickup?'Order at the contracted pickup site.':'Deposit at the contracted destination.');
  check(ctx.terminal?.(m.terminal),'Walk up to the transport terminal.');
  const ship=s.ships[m.ship];check(ship?.owner===owner,'Choose your own cargo ship.');
  check(ctx.docked?.(ship,m.terminal),'Land your selected ship on this site’s pad first.');
  if(pickup){
    check(active.phase==='accepted','Your mission crate has already been issued. Retrieve the existing crate.');
    const pose=ctx.transportPickup?.(m.terminal,ship);
    check(pose,'The pickup apron is blocked. Clear it before ordering.');
    const id=`sbu-${s.nextId++}`;s.loose??={};
    s.loose[id]={id,sbu:route.sbu,resource:route.resource,transport:{id:active.id,owner},...pose,holder:null,until:0,movedAt:Math.floor(ctx.now?.()??Date.now())};
    active.phase='issued';active.crate=id;
    return 'Your sealed crate is on the loading apron. Equip the tractor beam and secure it aboard your ship.';
  }
  check(active.phase==='issued'&&m.crate===active.crate,'Order and transport your assigned crate first.');
  const crate=ship.crates.find(c=>c.id===active.crate);
  check(crate?.transport?.id===active.id&&crate.transport.owner===owner,'Your assigned sealed crate must be secured on this ship’s cargo grid.');
  check(canRemoveCrate(ship.hull,ship.crates,crate.id),'Unload the crates above the mission crate first.');
  check(integer(account.credits+route.reward)&&integer(freight.earned+route.reward)&&integer(freight.completed+1),'Transport credit limit reached.');
  ship.crates=ship.crates.filter(c=>c.id!==crate.id);account.credits+=route.reward;
  freight.completed++;freight.earned+=route.reward;
  freight.history.unshift({id:active.id,route:route.id,paid:route.reward});freight.history.length=Math.min(8,freight.history.length);freight.active=null;
  return `Sealed crate deposited. Transport complete · ${route.reward} CR paid.`;
}
