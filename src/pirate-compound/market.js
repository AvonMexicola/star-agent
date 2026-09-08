import {PIRATE_MARKET} from './catalog.js';
import {createMarket} from '../trading/market.js';
import {TRADE_RESOURCES} from '../trading/resources.js';
/** Add once to the existing atomic solo commerce document. Never refill reads. */
export function normalizePirateMarket(state){
  const exists=Object.hasOwn(state.markets,PIRATE_MARKET.id);
  if(Object.hasOwn(state,'pirateMarketVersion')){
    if(state.pirateMarketVersion!==1||!exists)throw new Error('Pirate market is invalid. Original save retained.');
    return state;
  }
  const next=structuredClone(state);next.pirateMarketVersion=1;
  if(!exists){const market=createMarket(TRADE_RESOURCES,PIRATE_MARKET.id);Object.assign(market.stock,PIRATE_MARKET.stock);next.markets[PIRATE_MARKET.id]=market;}
  return next;
}
