import {settlementById} from './catalog.js';
import {TRADE_RESOURCES} from '../trading/resources.js';
/** Read-only projections of the same finite warehouse used by transactions. */
export function settlementGoods(market){
  const site=settlementById(market?.id);if(!site)return [];
  return TRADE_RESOURCES.map(resource=>{const stock=market.stock[resource.id],target=site.targets[resource.id];return {id:resource.id,name:resource.name,stock,target,need:Math.max(0,target-stock),export:site.exports.includes(resource.id),reason:site.uses[resource.id]??'Replenishes the local export reserve.'};});
}
export function settlementSummary(market){
  const goods=settlementGoods(market);if(!goods.length)return {summary:'Local stock unavailable',sales:''};
  const exports=goods.filter(g=>g.export&&g.stock>0),needs=goods.filter(g=>g.need>0).sort((a,b)=>Number(a.export)-Number(b.export)||b.need/b.target-a.need/a.target);
  const short=values=>values.slice(0,3).join(', ')+(values.length>3?` · +${values.length-3} more`:'');
  return {summary:exports.length?'Stocks: '+short(exports.map(g=>`${g.name} ${g.stock} SBU`)):'Export stock depleted',sales:needs.length?'Needs: '+short(needs.map(g=>`${g.name} ${g.need} SBU`)):'Needs supplied'};
}
