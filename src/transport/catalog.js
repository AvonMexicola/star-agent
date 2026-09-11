import {SETTLEMENTS,settlementById} from '../settlements/catalog.js';

/** Stable authored contracts. A listing never grants or reserves a crate. */
export const TRANSPORT_ROUTES=Object.freeze(SETTLEMENTS.flatMap(from=>SETTLEMENTS.filter(to=>to.id!==from.id).map(to=>Object.freeze({
  id:`freight-${from.body}-${to.body}`,from:from.id,to:to.id,sbu:1,
  resource:from.body==='selene'?'ice':from.body==='miasma'?'copper':from.body==='pyre'?'conductor':'aggregate',
  name:`${from.name} (${from.body}) → ${to.name} (${to.body})`,reward:(['aeon','selene'].includes(from.body)===['aeon','selene'].includes(to.body))?350:800,
}))));
export const transportRoute=id=>TRANSPORT_ROUTES.find(r=>r.id===id);
export const transportSiteName=id=>settlementById(id)?.name??id;
export const transportCargo=c=>({id:c.id,sbu:c.sbu,resource:c.resource,...(c.transport?{transport:{...c.transport}}:{}),...(c.recovery?{recovery:{...c.recovery}}:{})});
export const cargoVisibleTo=(c,owner)=>(!c.transport||c.transport.owner===owner)&&(!c.recovery||c.recovery.owner===owner);
