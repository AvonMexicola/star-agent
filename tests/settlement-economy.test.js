import test from 'node:test';
import assert from 'node:assert/strict';
import {SETTLEMENTS,settlementMarketId} from '../src/settlements/catalog.js';
import {settlementGoods,settlementSummary} from '../src/settlements/economy.js';
import {TRADE_RESOURCES,resourceById} from '../src/trading/resources.js';
import {emptyCommerce,ensureAccount,normalizeSettlementMarkets,commerceCommand} from '../src/trading/model.js';
import {quoteMarket,MARKET_STOCK_LIMIT} from '../src/trading/market.js';
import {MiningStore} from '../src/mining/store.js';
import {LocalTrading} from '../src/trading/local.js';
const ctx={terminal:()=>true,docked:()=>true,stationMarket:settlementMarketId};
const fresh=()=>{const s=normalizeSettlementMarkets(emptyCommerce());ensureAccount(s,'pilot');return s;};
const order=(s,op,terminal,resource,extra={})=>({op,terminal,resource,ship:'pilot:nomad',sbu:1,commandId:`order-${s.revision}`,revision:s.revision,...extra});
test('every settlement has explicit finite local stock, reserve targets and role-based import needs',()=>{
 const state=fresh(),ids=TRADE_RESOURCES.map(r=>r.id).sort();
 for(const site of SETTLEMENTS){
  assert.deepEqual(Object.keys(site.stock).sort(),ids);assert.deepEqual(Object.keys(site.targets).sort(),ids);
  assert.deepEqual(state.markets[site.id].stock,site.stock);
  for(const r of ids){assert.ok(Number.isSafeInteger(site.targets[r])&&site.targets[r]>0&&site.targets[r]<=MARKET_STOCK_LIMIT);assert.ok(site.stock[r]>=0&&site.stock[r]<=site.targets[r]);}
  for(const g of settlementGoods(state.markets[site.id])){assert.ok(g.reason.length>10);assert.equal(g.need,site.targets[g.id]-site.stock[g.id]);if(g.export)assert.equal(g.need,0);else assert.ok(g.need>0);}
 }
 assert.match(settlementSummary(state.markets['settlement-pyre']).sales,/Copper ore/);
 assert.match(settlementSummary(state.markets['settlement-selene']).sales,/Metal stock/);
});
test('haul local ice to hot works: cargo, money, local stock and need change once in the same transaction',()=>{
 let s=fresh();const origin='settlement-selene',destination='settlement-pyre',before=structuredClone(s);
 s=commerceCommand(s,'pilot',order(s,'buy',origin,'ice'),ctx).state;
 const crate=s.ships['pilot:nomad'].crates[0],request=order(s,'sell',destination,'ice',{crate:crate.id}),need=settlementGoods(s.markets[destination]).find(g=>g.id==='ice').need;
 const result=commerceCommand(s,'pilot',request,ctx);s=result.state;
 assert.equal(s.ships['pilot:nomad'].crates.length,0);assert.equal(s.markets[origin].stock.ice,before.markets[origin].stock.ice-1);assert.equal(s.markets[destination].stock.ice,before.markets[destination].stock.ice+1);
 assert.equal(settlementGoods(s.markets[destination]).find(g=>g.id==='ice').need,need-1);assert.ok(s.accounts.pilot.credits>before.accounts.pilot.credits,'moving exports to a shortage pays');
 assert.equal(commerceCommand(s,'pilot',request,ctx).replayed,true);assert.throws(()=>commerceCommand(s,'pilot',{...request,commandId:'stale'},ctx),/Cargo changed/);
 assert.deepEqual(s.markets['settlement-aeon'],before.markets['settlement-aeon']);
});
test('filled needs reject excess deliveries without consuming cargo or paying credits',()=>{
 let s=fresh();s=commerceCommand(s,'pilot',order(s,'buy','settlement-selene','ice'),ctx).state;
 const id='settlement-pyre',crate=s.ships['pilot:nomad'].crates[0];s.markets[id].stock.ice=SETTLEMENTS.find(s=>s.id===id).targets.ice;
 const before=structuredClone(s);assert.throws(()=>commerceCommand(s,'pilot',order(s,'sell',id,'ice',{crate:crate.id}),ctx),/needs 0 SBU/);assert.deepEqual(s,before);
 s.markets[id].stock.ice--;assert.equal(quoteMarket(s.markets[id],resourceById('ice'),'sell',2).ok,false);
 const next=commerceCommand(s,'pilot',order(s,'sell',id,'ice',{crate:crate.id}),ctx).state;assert.equal(settlementGoods(next.markets[id]).find(g=>g.id==='ice').need,0);
 assert.equal(quoteMarket(next.markets[id],resourceById('ice'),'sell',1).ok,false);
});
test('same-site roundtrip never earns money; larger deliveries reduce marginal bids and shortages',()=>{
 for(const site of SETTLEMENTS)for(const resource of TRADE_RESOURCES){
  const market={id:site.id,stock:{...site.stock}};const buy=quoteMarket(market,resource,'buy',1);market.stock[resource.id]--;const back=quoteMarket(market,resource,'sell',1);assert.ok(back.ok);assert.ok(back.total<buy.total);
  if(!site.exports.includes(resource.id)){const old=back.total;market.stock[resource.id]+=64;assert.ok(quoteMarket(market,resource,'sell',1).total<=old);}
 }
});
test('existing balances and depleted or surplus stock survive normalization and reload unchanged',()=>{
 const values=new Map(),storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)},store=new MiningStore(storage),local=new LocalTrading(store);
 const s=structuredClone(store.state);s.commerce.markets['settlement-pyre'].stock.ice=0;s.commerce.markets['settlement-selene'].stock.conductor=1024;s.commerce.accounts['local-player'].credits=999;s.economy.credits=999;assert.equal(store.write(s),true);
 const before=structuredClone(local.state);assert.equal(normalizeSettlementMarkets(local.state),local.state);
 const reloaded=new LocalTrading(new MiningStore(storage));assert.deepEqual(reloaded.state,before);assert.equal(settlementGoods(reloaded.state.markets['settlement-selene']).find(g=>g.id==='conductor').need,0);assert.equal(quoteMarket(reloaded.state.markets['settlement-selene'],resourceById('conductor'),'sell',1).ok,false);
});
test('failed local delivery save retains credits, cargo, warehouse stock and shortage',()=>{
 const entries=new Map(),storage={getItem:k=>entries.get(k)??null,setItem:(k,v)=>entries.set(k,v)},store=new MiningStore(storage),local=new LocalTrading(store);
 local.command({...order(local.state,'buy','settlement-selene','ice'),ship:'local-player:nomad'},ctx);
 const before=structuredClone(store.state),crate=local.state.ships['local-player:nomad'].crates[0];storage.setItem=()=>{throw Error('full disk');};
 assert.throws(()=>local.command({...order(local.state,'sell','settlement-pyre','ice',{crate:crate.id}),ship:'local-player:nomad'},ctx),/Save unavailable/);assert.deepEqual(store.state,before);
});
test('map summaries follow actual stock and stop advertising fulfilled needs or exhausted exports',()=>{
 const s=fresh(),id='settlement-miasma',market=s.markets[id];assert.match(settlementSummary(market).sales,/Water ice 720 SBU/);
 for(const site of SETTLEMENTS)if(site.id===id)Object.assign(market.stock,site.targets);assert.equal(settlementSummary(market).sales,'Needs supplied');
 market.stock.copper=0;market.stock.basalt=0;assert.equal(settlementSummary(market).summary,'Export stock depleted');assert.match(settlementSummary(market).sales,/Copper ore 2400 SBU/);
 assert.equal(settlementSummary(undefined).summary,'Local stock unavailable');
});
