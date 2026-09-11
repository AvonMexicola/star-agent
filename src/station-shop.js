/** Local station stock. Purchases grant stored cargo, never combat or ship stats. */
export const STARTER_CREDITS = 1500;
export const STATION_SHOPS = Object.freeze({
  weapons: Object.freeze({
    name: 'WATCHKEEP ARMORY',
    category: 'WATCHKEEP / SECURITY SUPPLY',
    detail: 'For the watch ahead. Stored weapons only. Combat and equipping are not implemented.',
    offers: Object.freeze([
      Object.freeze({ itemId: 'sidearm', price: 350, stock: 3 }),
      Object.freeze({ itemId: 'rifle', price: 700, stock: 2 }),
    ]),
  }),
  equipment: Object.freeze({
    name: 'KESTREL SHIPWORKS',
    category: 'KESTREL / SHIP COMPONENTS',
    detail: 'Parts for the next departure. Supplies and replacement components are stored cargo. Item use and installation are not implemented.',
    offers: Object.freeze([
      Object.freeze({ itemId: 'repair', price: 120, stock: 8 }),
      Object.freeze({ itemId: 'scanner', price: 280, stock: 3 }),
      Object.freeze({ itemId: 'sample', price: 40, stock: 10 }),
      Object.freeze({ itemId: 'replacement', price: 220, stock: 4 }),
    ]),
  }),
  // Retail promenade, Deck 04 aft. Everyday transit-hub trade: nothing here
  // grants combat, ship or survival effects either.
  galley: Object.freeze({
    name: 'COSMIC CHICKEN',
    category: 'COSMIC CHICKEN / HAB RING LOCAL',
    detail: 'The board menu is dine-in at the counter. What you can carry away is sealed and goes to your station warehouse; eating and drinking are not implemented.',
    offers: Object.freeze([
      Object.freeze({ itemId: 'hotmeal', price: 18, stock: 12 }),
      Object.freeze({ itemId: 'brew', price: 12, stock: 16 }),
      Object.freeze({ itemId: 'ration', price: 15, stock: 20 }),
    ]),
  }),
  outfitter: Object.freeze({
    name: 'TIDEWELL OUTFITTERS',
    category: 'TIDEWELL / DECK CLOTHING',
    detail: 'Layers for cold decks and long shifts. Clothing is stored cargo; wearing and equipping are not implemented.',
    offers: Object.freeze([
      Object.freeze({ itemId: 'jacket', price: 240, stock: 4 }),
      Object.freeze({ itemId: 'gloves', price: 60, stock: 9 }),
    ]),
  }),
  hydroponics: Object.freeze({
    name: 'GREENSIDE HYDROPONICS',
    category: 'GREENSIDE / LIVE PLANTS',
    detail: 'Station-grown plants and starter trays. Growing, planting and food production are not implemented.',
    offers: Object.freeze([
      Object.freeze({ itemId: 'seedling', price: 95, stock: 6 }),
      Object.freeze({ itemId: 'herbs', price: 45, stock: 10 }),
    ]),
  }),
  souvenir: Object.freeze({
    name: 'WAYPOINT SOUVENIRS',
    category: 'WAYPOINT / GIFTS AND PRINTS',
    detail: 'Something to take home from Aeon. Models and prints are stored cargo with no gameplay effect.',
    offers: Object.freeze([
      Object.freeze({ itemId: 'hullmodel', price: 130, stock: 5 }),
      Object.freeze({ itemId: 'chart', price: 25, stock: 14 }),
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
