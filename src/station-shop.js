import { GamepadInput } from './gamepad.js';

/** Local station stock. Purchases grant stored cargo, never combat or ship stats. */
export const STARTER_CREDITS = 1500;
export const STATION_SHOPS = Object.freeze({
  weapons: Object.freeze({
    name: 'Security supply',
    detail: 'Stored weapons only. Combat and equipping are not implemented.',
    offers: Object.freeze([
      Object.freeze({ itemId: 'sidearm', price: 350, stock: 3 }),
      Object.freeze({ itemId: 'rifle', price: 700, stock: 2 }),
    ]),
  }),
  equipment: Object.freeze({
    name: 'Ship outfitter',
    detail: 'Supplies and replacement parts are stored cargo. Item use and installation are not implemented.',
    offers: Object.freeze([
      Object.freeze({ itemId: 'repair', price: 120, stock: 8 }),
      Object.freeze({ itemId: 'scanner', price: 280, stock: 3 }),
      Object.freeze({ itemId: 'sample', price: 40, stock: 10 }),
      Object.freeze({ itemId: 'replacement', price: 220, stock: 4 }),
    ]),
  }),
});
export function shopOffer(shopId, itemId) {
  return Object.hasOwn(STATION_SHOPS, shopId)
    ? STATION_SHOPS[shopId].offers.find(offer => offer.itemId === itemId) : undefined;
}
export function initialShopStock() {
  return Object.fromEntries(Object.entries(STATION_SHOPS).map(([id, shop]) =>
    [id, Object.fromEntries(shop.offers.map(offer => [offer.itemId, offer.stock]))]));
}
export function purchaseStationItem(inventory, shopId, itemId) {
  return inventory.purchase(shopId, itemId);
}


/** Dialog-only controller edges; the UI owns its polling lifetime. */
export class StationShopController {
  constructor(read) { this.input = new GamepadInput(read); this.direction = 0; }
  reset() { this.input.suspend(); this.direction = 0; }
  poll(focused = true) {
    const pad = this.input.poll({ focused, enabled: true });
    if (!this.input.armed) { this.direction = 0; return null; }
    const direction = pad.forward < -.5 ? 1 : pad.forward > .5 ? -1 : 0;
    const stickEdge = direction && direction !== this.direction;
    this.direction = direction;
    if (pad.pressed.has(1) || pad.pressed.has(9)) return 'close';
    if (pad.pressed.has(13) || pad.pressed.has(15) || stickEdge && direction === 1) return 'next';
    if (pad.pressed.has(12) || pad.pressed.has(14) || stickEdge && direction === -1) return 'previous';
    if (pad.pressed.has(0)) return 'activate';
    return null;
  }
}
