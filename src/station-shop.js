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
