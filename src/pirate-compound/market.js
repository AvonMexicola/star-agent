import {PIRATE_MARKET,PIRATE_MARKETS} from './catalog.js';
import {createMarket} from '../trading/market.js';
import {TRADE_RESOURCES} from '../trading/resources.js';
/** Add once to the existing atomic solo commerce document. Never refill reads. */
export function normalizePirateMarket(state){
  const version=state.pirateMarketVersion;
  if(Object.hasOwn(state,'pirateMarketVersion')&&(![1,2].includes(version)||!Object.hasOwn(state.markets,PIRATE_MARKET.id)||version===2&&PIRATE_MARKETS.some(site=>!Object.hasOwn(state.markets,site.id))))throw new Error('Pirate market is invalid. Original save retained.');
  if(version===2)return state;
  const next=structuredClone(state);next.pirateMarketVersion=2;
  for(const site of PIRATE_MARKETS)if(!Object.hasOwn(next.markets,site.id)){const market=createMarket(TRADE_RESOURCES,site.id);Object.assign(market.stock,site.stock);next.markets[site.id]=market;}
  return next;
}
