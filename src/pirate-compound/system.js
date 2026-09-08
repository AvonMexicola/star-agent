import {PIRATE_MARKETS,pirateMarketById} from './catalog.js';
import {pirateLayout} from './layout.js';
import {createPirateSite} from './site-system.js';

/** Each body owns its market, discovery, airlock and one perimeter battery. */
export function createPirateCompound(options){
 const sites=PIRATE_MARKETS.map(market=>createPirateSite({...options,layout:pirateLayout(market.id)}));
 const current=()=>sites.find(site=>site.layout.body===options.nav.body.id)??sites[0],byId=id=>sites.find(site=>site.layout.id===id);
 return {nav:options.nav,sites,get layout(){return current().layout;},get tower(){return current().tower;},get policy(){return current().policy;},get buildings(){return current().buildings;},
  get layouts(){return sites.map(site=>site.layout);},get claims(){return sites.flatMap(site=>site.claims);},get grounded(){return sites.some(site=>site.grounded);},
  attachInteractions(){sites.forEach(site=>site.attachInteractions());},
  terminalStatus:id=>byId(id)?.terminalStatus(id),terminalPosition:id=>byId(id)?.terminalPosition(id)??null,docked:(id,pose)=>byId(id)?.docked(id,pose)??false,
  beacons:()=>sites.flatMap(site=>site.beacons()),
  constrainWalker(a,b){return sites.reduce((first,site)=>{const second=site.constrainWalker(a,first.point);return {...second,hit:first.hit||second.hit,grounded:first.grounded||second.grounded};},{point:b,hit:false,grounded:false});},
  raycast:(...args)=>sites.map(site=>site.raycast(...args)).filter(Boolean).sort((a,b)=>a.distance-b.distance)[0]??null,
  landingSurface:pose=>sites.map(site=>site.landingSurface(pose)).find(Boolean)??null,
  approach:(id='pirate-hush')=>byId(id)?.approach()??false,update:(dt,origin)=>sites.forEach(site=>site.update(dt,origin)),
  get state(){return {...current().state,sites:sites.map(site=>({id:site.layout.id,body:site.layout.body,discovered:site.discovered,unlocked:site.policy.disabled,phase:site.policy.phase}))};},
  dispose:()=>sites.forEach(site=>site.dispose()),
 };
}
/** Combine collision and commerce adapters without changing regular layouts. */
export function withPirateCompound(settlements,pirate){return {
 nav:settlements.nav,buildings:settlements.buildings,get layouts(){return [...settlements.layouts,...pirate.layouts];},get claims(){return [...settlements.claims,...pirate.claims];},get grounded(){return settlements.grounded||pirate.grounded;},
 terminalStatus:id=>pirate.terminalStatus(id)??settlements.terminalStatus?.(id),terminalPosition:id=>pirate.terminalPosition(id)??settlements.terminalPosition(id),docked:(id,pose)=>pirateMarketById(id)?pirate.docked(id,pose):settlements.docked(id,pose),beacons:()=>[...settlements.beacons(),...pirate.beacons()],
 constrainWalker(a,b){const first=settlements.constrainWalker(a,b),second=pirate.constrainWalker(a,first.point);return {...second,hit:first.hit||second.hit,grounded:first.grounded||second.grounded};},
 raycast:(...args)=>[settlements.raycast(...args),pirate.raycast(...args)].filter(Boolean).sort((a,b)=>a.distance-b.distance)[0]??null,landingSurface:pose=>settlements.landingSurface(pose)??pirate.landingSurface(pose),
 update(dt,origin){settlements.update(dt,origin);pirate.update(dt,origin);},approach:id=>pirateMarketById(id)?pirate.approach(id):settlements.approach(id),get state(){return settlements.state;},dispose(){settlements.dispose();pirate.dispose();}};}
