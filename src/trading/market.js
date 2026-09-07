import { AEON_MARKET_ID, stationTerminalMarket } from './station-terminals.js';
export { AEON_MARKET_ID } from './station-terminals.js';
/** Shared NPC warehouse stock and discrete marginal prices. No clocks/refills. */
export const MARKET_INITIAL_STOCK = 1024;
export const MARKET_STOCK_LIMIT = 4096;
export const MARKET_LIMIT = 32;

const record = value => value && typeof value === 'object' && !Array.isArray(value);
const integer = (value, max) => Number.isSafeInteger(value) && value >= 0 && value <= max;
const validId = id => typeof id === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9:_-]{0,119}$/.test(id)
  && !['constructor', 'prototype', '__proto__'].includes(id);
const require = (condition, message) => { if (!condition) throw new Error(message); };

export function createMarket(resources, id = AEON_MARKET_ID) {
  require(validId(id), 'Invalid station market.');
  return { id, stock: Object.fromEntries(resources.map(resource => [resource.id, MARKET_INITIAL_STOCK])) };
}

export function validMarkets(markets, resources) {
  if (!record(markets) || !Object.hasOwn(markets, AEON_MARKET_ID)
    || Object.keys(markets).length > MARKET_LIMIT) return false;
  return Object.entries(markets).every(([id, market]) => validId(id) && record(market)
    && market.id === id && record(market.stock)
    && Object.keys(market.stock).length === resources.length
    && resources.every(resource => Object.hasOwn(market.stock, resource.id)
      && integer(market.stock[resource.id], MARKET_STOCK_LIMIT)));
}

/** Existing berth IDs all address one warehouse. Explicit mappings never fall back. */
export function marketIdForTerminal(terminal, mapping) {
  if (mapping !== undefined) return record(mapping) && Object.hasOwn(mapping, terminal) ? mapping[terminal] : null;
  return stationTerminalMarket(terminal);
}

/** Price the unit whose addition leaves `inventoryLevel` SBU in the warehouse.
 * Both directions use this same level; rounding preserves a positive spread. */
export function marginalPrices(resource, inventoryLevel) {
  require(resource && integer(resource.buy, 10000) && resource.buy > 1
    && integer(resource.sell, 10000) && resource.sell > 0 && resource.sell < resource.buy,
  'Invalid resource prices.');
  require(integer(inventoryLevel, MARKET_STOCK_LIMIT) && inventoryLevel > 0, 'Invalid inventory level.');
  const numerator = MARKET_INITIAL_STOCK * 2, denominator = MARKET_INITIAL_STOCK + inventoryLevel;
  const ask = Math.max(2, Math.ceil(resource.buy * numerator / denominator));
  const bid = Math.max(1, Math.min(ask - 1, Math.floor(resource.sell * numerator / denominator)));
  return { ask, bid };
}

/** Integrate a bulk order over its actual stock interval, in integer credits.
 * Buying S→S-q and reselling S-q→S visits the identical q inventory levels.
 * Thus split orders and bulk orders settle identically, and a roundtrip loses
 * the spread rather than profiting from its own change to the stock price. */
export function quoteMarket(market, resource, side, sbu) {
  require(market && validId(market.id) && record(market.stock) && resource, 'Station market unavailable.');
  require(side === 'buy' || side === 'sell', 'Choose buy or sell.');
  require(integer(sbu, MARKET_STOCK_LIMIT) && sbu > 0, 'Choose a positive SBU quantity.');
  const stock = market.stock[resource.id];
  require(integer(stock, MARKET_STOCK_LIMIT), 'Station stock is invalid; original data retained.');
  const after = stock + (side === 'buy' ? -sbu : sbu);
  const quote = { marketId: market.id, resource: resource.id, side, sbu, stockBefore: stock,
    stockAfter: after, stockLimit: MARKET_STOCK_LIMIT };
  if (after < 0) return { ...quote, ok: false, reason: `Only ${stock} SBU in station stock.`, total: null };
  if (after > MARKET_STOCK_LIMIT) return { ...quote, ok: false,
    reason: `Station has room for ${MARKET_STOCK_LIMIT - stock} SBU.`, total: null };
  let total = 0, unitMin = Infinity, unitMax = 0;
  const low = Math.min(stock, after) + 1, high = Math.max(stock, after);
  for (let level = low; level <= high; level++) {
    const prices = marginalPrices(resource, level), price = side === 'buy' ? prices.ask : prices.bid;
    total += price; unitMin = Math.min(unitMin, price); unitMax = Math.max(unitMax, price);
  }
  return { ...quote, ok: true, total, unitMin, unitMax };
}

export function quoteStation(state, terminal, resource, side, sbu) {
  const id = marketIdForTerminal(terminal, state.marketTerminals);
  const market = id && Object.hasOwn(state.markets ?? {}, id) ? state.markets[id] : null;
  if (!market) return { ok: false, reason: 'Station market unavailable.', total: null };
  return quoteMarket(market, resource, side, sbu);
}
