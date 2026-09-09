import {FACTIONS} from '../factions/catalog.js';
import {pirateMarketById} from '../pirate-compound/catalog.js';
/** World-owned exchanges. Initial supplies seed once; reserve targets describe
 * current demand without replacing any saved warehouse quantities. Units: SBU. */
export const SETTLEMENTS = Object.freeze([
  {id:'settlement-aeon',body:'aeon',faction:'verdant',name:'Greenbank Supply',role:'Construction supplies',wings:[4,28],
    activity:'Quarries aggregate and assembles construction supplies for surface bases.',
    exports:['aggregate','metal-stock','conductor'],
    stock:{basalt:120,copper:96,ice:96,aggregate:1800,'metal-stock':1600,conductor:1200},
    targets:{basalt:900,copper:600,ice:512,aggregate:1800,'metal-stock':1600,conductor:1200},
    uses:{basalt:'Raw stone for aggregate processing.',copper:'Copper feedstock for construction fittings.',ice:'Water for crews and concrete mixing.'}},
  {id:'settlement-selene',body:'selene',faction:'tidemark',name:'Stillwater Exchange',role:'Ice and mineral freight',wings:[24,4],
    activity:'Ships lunar ice and minerals; imports supplies to maintain its extraction equipment.',
    exports:['ice','basalt','copper'],
    stock:{basalt:1500,copper:600,ice:2400,aggregate:96,'metal-stock':64,conductor:32},
    targets:{basalt:1500,copper:600,ice:2400,aggregate:480,'metal-stock':384,conductor:256},
    uses:{aggregate:'Pad and pressure-habitat foundations.','metal-stock':'Replacement frames for ice extraction equipment.',conductor:'Power wiring for pumps and mining tools.'}},
  {id:'settlement-pyre',body:'pyre',faction:'cinder',name:'Ember Works',role:'Metal and conductor export',wings:[28,28],
    activity:'Processes imported ore into metal stock and conductors; needs water for cooling.',
    exports:['metal-stock','conductor'],
    stock:{basalt:160,copper:96,ice:240,aggregate:64,'metal-stock':2200,conductor:1800},
    targets:{basalt:1024,copper:1200,ice:1024,aggregate:512,'metal-stock':2200,conductor:1800},
    uses:{basalt:'Mineral feedstock for metal processing.',copper:'Copper feedstock for conductor production.',ice:'Cooling water for the hot processing works.',aggregate:'Heat-resistant foundations and maintenance.'}},
  {id:'settlement-miasma',body:'miasma',faction:'vesper',name:'Verdigris Prospect',role:'Copper prospecting',wings:[4,12],
    activity:'Exports copper ore; imports water and replacement equipment for a corrosive environment.',
    exports:['copper','basalt'],
    stock:{basalt:1600,copper:2400,ice:48,aggregate:64,'metal-stock':360,conductor:32},
    targets:{basalt:1600,copper:2400,ice:768,aggregate:512,'metal-stock':768,conductor:384},
    uses:{ice:'Clean water for sealed habitats.',aggregate:'Raised pads and sealed habitat foundations.','metal-stock':'Replacement frames damaged by corrosion.',conductor:'Replacement wiring for prospecting equipment.'}},
].map(s=>Object.freeze({...s,operator:FACTIONS[s.faction].name,activity:`${FACTIONS[s.faction].name} facility. ${s.activity}`,exports:Object.freeze(s.exports),stock:Object.freeze(s.stock),targets:Object.freeze(s.targets),uses:Object.freeze(s.uses)})));
export const settlementById = id => SETTLEMENTS.find(s=>s.id===id)??pirateMarketById(id);
export const settlementMarketId = id => settlementById(id) ? id : null;
