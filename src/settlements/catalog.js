/** World-owned exchanges; IDs and initial stock are persistent commerce content. */
export const SETTLEMENTS = Object.freeze([
  {id:'settlement-aeon',body:'aeon',name:'Greenbank Supply',role:'Construction supplies',wings:[4,28],stock:{aggregate:1800,'metal-stock':1600,conductor:1200}},
  {id:'settlement-selene',body:'selene',name:'Stillwater Exchange',role:'Ice and mineral freight',wings:[24,4],stock:{ice:2400,basalt:1500,copper:600}},
  {id:'settlement-pyre',body:'pyre',name:'Ember Works',role:'Metal and conductor export',wings:[28,28],stock:{'metal-stock':2200,conductor:1800,ice:240}},
  {id:'settlement-miasma',body:'miasma',name:'Verdigris Prospect',role:'Copper prospecting',wings:[4,12],stock:{copper:2400,basalt:1600,'metal-stock':360}},
].map(s=>Object.freeze({...s,stock:Object.freeze(s.stock)})));
export const settlementById = id => SETTLEMENTS.find(s=>s.id===id);
export const settlementMarketId = id => settlementById(id) ? id : null;
