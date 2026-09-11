import { STARTER_CREDITS, STATION_SHOPS, initialShopStock, shopOffer } from './station-shop.js';
export const INVENTORY_KEY = 'star-agent.nomad-inventory.v1';
export const ITEMS = Object.freeze([
  Object.freeze({ id: 'repair', name: 'Repair kit', detail: 'Tools & replacement parts', mass: 4 }),
  Object.freeze({ id: 'ration', name: 'Field ration', detail: 'Sealed expedition supplies', mass: .5 }),
  Object.freeze({ id: 'sample', name: 'Sample case', detail: 'Empty specimen container', mass: 2 }),
  Object.freeze({ id: 'scanner', name: 'Survey scanner', detail: 'Portable survey equipment', mass: 3 }),
  Object.freeze({ id: 'sidearm', name: 'Security sidearm', detail: 'Stored weapon · combat and equipping unavailable', mass: 2 }),
  Object.freeze({ id: 'rifle', name: 'Patrol rifle', detail: 'Stored weapon · combat and equipping unavailable', mass: 5 }),
  Object.freeze({ id: 'replacement', name: 'Replacement components', detail: 'Crated ship parts · installation unavailable', mass: 8 }),
  Object.freeze({ id: 'hotmeal', name: 'Hot meal tray', detail: 'Sealed galley meal · eating unavailable', mass: 1.2 }),
  Object.freeze({ id: 'brew', name: 'Brew flask', detail: 'Insulated flask of hot brew · drinking unavailable', mass: .9 }),
  Object.freeze({ id: 'jacket', name: 'Insulated jacket', detail: 'Layered deck jacket · wearing unavailable', mass: 2.4 }),
  Object.freeze({ id: 'gloves', name: 'Work gloves', detail: 'Reinforced grip gloves · wearing unavailable', mass: .4 }),
  Object.freeze({ id: 'seedling', name: 'Seedling tray', detail: 'Nine-cell hydroponic starter tray', mass: 3 }),
  Object.freeze({ id: 'herbs', name: 'Culinary herb pot', detail: 'Live potted herbs in growing medium', mass: 1.6 }),
  Object.freeze({ id: 'hullmodel', name: 'Scale hull model', detail: 'Desk-scale display hull on a stand', mass: 1.1 }),
  Object.freeze({ id: 'chart', name: 'Printed system chart', detail: 'Folded Aeon system chart', mass: .2 }),
]);
/** The catalogue a version 3 manifest was first written with. Items and shops
 * added afterwards are migrated in — zero owned, full shop stock — instead of
 * failing the integrity check and locking the player out of their own save.
 * A value that IS present is still validated exactly as strictly as before. */
export const VERSION3_ITEM_IDS = Object.freeze(['repair', 'ration', 'sample', 'scanner', 'sidearm', 'rifle', 'replacement']);
export const VERSION3_SHOP_IDS = Object.freeze(['weapons', 'equipment']);
export const CAPACITY = Object.freeze({ ship: 120, pack: 20, station: 10000 });
const LEGACY_ITEMS = ITEMS.slice(0, 4);
const emptyItems = () => Object.fromEntries(ITEMS.map(item => [item.id, 0]));
const initialLegacy = () => ({ ship: { repair: 3, ration: 12, sample: 6, scanner: 1 }, pack: { repair: 0, ration: 2, sample: 0, scanner: 0 }, station: { repair: 12, ration: 80, sample: 30, scanner: 4 } });

const initial = () => Object.fromEntries(Object.entries(initialLegacy()).map(([id, items]) => [id, { ...emptyItems(), ...items }]));

/** Small local manifest. Item use and resource gathering are not simulated yet. */
export class ShipInventory {
  constructor(storage, capacity = CAPACITY.ship) {
    this.storage = storage;this.capacity={ship:capacity,pack:CAPACITY.pack,station:CAPACITY.station};
    this.containers = initial();
    this.credits = STARTER_CREDITS;
    this.shopStock = initialShopStock();
    this.saved = false;
    this.persistenceBlocked = false;
    this.loadError = '';
    this.persistedRaw = null;
    try {
      const raw = storage?.getItem(INVENTORY_KEY) ?? null;
      this.persistedRaw = raw;
      if (raw !== null) {
        const data = JSON.parse(raw);
        if (!data || ![1, 2, 3].includes(data.version)) throw Error('Unsupported manifest');
        const containers = data.version === 1 ? ['ship', 'pack'] : ['ship', 'pack', 'station'];
        const items = data.version === 3 ? ITEMS : LEGACY_ITEMS;
        // A value this manifest predates may be absent; a value it carries must
        // still be a valid count. `migrated` records that the save was short.
        let migrated = false;
        const known = (container, item) => {
          const saved = data[container]?.[item.id];
          if (saved !== undefined) return Number.isSafeInteger(saved) && saved >= 0;
          if (data.version === 3 && !VERSION3_ITEM_IDS.includes(item.id)) { migrated = true; return true; }
          return false;
        };
        if (!containers.every(container => items.every(item => known(container, item))
          && this.massOf({ ...emptyItems(), ...data[container] }) <= (container === 'ship' ? 2400 : CAPACITY[container]))) {
          throw Error('Invalid cargo manifest');
        }
        if (data.version === 3) {
          const stock = (id, offer) => {
            const saved = data.shopStock?.[id]?.[offer.itemId];
            if (saved !== undefined) return Number.isSafeInteger(saved) && saved >= 0 && saved <= offer.stock;
            if (!VERSION3_SHOP_IDS.includes(id) || !VERSION3_ITEM_IDS.includes(offer.itemId)) { migrated = true; return true; }
            return false;
          };
          if (!Number.isSafeInteger(data.credits) || data.credits < 0 || data.credits > 1_000_000_000
            || !Object.entries(STATION_SHOPS).every(([id, shop]) => shop.offers.every(offer => stock(id, offer)))) {
            throw Error('Invalid purchase manifest');
          }
          this.credits = data.credits;
          this.shopStock = Object.fromEntries(Object.entries(STATION_SHOPS).map(([id, shop]) =>
            [id, Object.fromEntries(shop.offers.map(offer => [offer.itemId, data.shopStock?.[id]?.[offer.itemId] ?? offer.stock]))]));
        }
        for (const container of containers) {
          this.containers[container] = { ...emptyItems(), ...Object.fromEntries(items.map(item => [item.id, data[container][item.id] ?? 0])) };
        }
        // A complete v3 save is never rewritten; only a migrated one is, so a
        // later session does not repeat the same catalogue reconstruction.
        if (data.version === 3) { this.saved = true; if (migrated) this.persist(); return; }
      }
      // Save the one-time grant with migration/new cargo; future loads never regrant it.
      this.persist();
    } catch {
      // Keep unreadable data intact. Never replace an old save with starter money.
      this.saved = false; this.persistenceBlocked = true; this.credits = 0;
      this.loadError = 'The saved manifest could not be read. Purchases are unavailable; the original save has been kept.';
    }
  }
  massOf(items) { return ITEMS.reduce((sum, item) => sum + items[item.id] * item.mass, 0); }
  mass(container) { return this.massOf(this.containers[container]); }
  count(container, id) { return this.containers[container]?.[id] ?? 0; }
  get snapshot() { return { ship: { ...this.containers.ship }, pack: { ...this.containers.pack }, station: { ...this.containers.station }, stationMass: this.mass('station'), shipMass: this.mass('ship'), packMass: this.mass('pack'), saved: this.saved, credits: this.credits, shopStock: structuredClone(this.shopStock), loadError: this.loadError }; }
  manifest(containers = this.containers, credits = this.credits, shopStock = this.shopStock) {
    return { version: 3, ...containers, credits, shopStock };
  }
  persist() {
    try {
      if (!this.storage || this.persistenceBlocked) throw Error('Storage unavailable');
      const raw = JSON.stringify(this.manifest());
      // Cargo, credits and remaining shop stock always share one committed value.
      this.storage.setItem(INVENTORY_KEY, raw);
      this.persistedRaw = raw; this.saved = true;
      return true;
    } catch { this.saved = false; return false; }
  }
  purchaseStatus(shopId, itemId) {
    const offer = shopOffer(shopId, itemId), item = ITEMS.find(item => item.id === itemId);
    if (!offer || !item) return { ok: false, message: 'Unknown shop item.' };
    if (this.persistenceBlocked) return { ok: false, message: this.loadError };
    if (this.shopStock[shopId][itemId] < 1) return { ok: false, message: 'This item is sold out.' };
    if (this.credits < offer.price) return { ok: false, message: `Insufficient credits. ${offer.price} credits required.` };
    if (this.mass('station') + item.mass > this.capacity.station) return { ok: false, message: 'Station warehouse is full.' };
    return { ok: true, offer, item };
  }
  purchase(shopId, itemId) {
    const check = this.purchaseStatus(shopId, itemId);
    if (!check.ok) return check;
    const containers = structuredClone(this.containers), stock = structuredClone(this.shopStock);
    containers.station[itemId]++; stock[shopId][itemId]--;
    const credits = this.credits - check.offer.price;
    const raw = JSON.stringify(this.manifest(containers, credits, stock));
    try {
      if (!this.storage) throw Error('Storage unavailable');
      // Reject an already-observed stale session. This does not claim multi-tab locking.
      if ((this.storage.getItem(INVENTORY_KEY) ?? null) !== this.persistedRaw) {
        return { ok: false, message: 'Your saved manifest changed in another session. Reload before purchasing.' };
      }
      this.storage.setItem(INVENTORY_KEY, raw);
    } catch {
      return { ok: false, message: 'Purchase not saved. No credits spent or cargo delivered. Browser storage is unavailable.' };
    }
    // Commit memory only after the single storage write succeeds.
    this.containers = containers; this.shopStock = stock; this.credits = credits;
    this.persistedRaw = raw; this.saved = true;
    return { ok: true, itemId, destination: 'station', cost: check.offer.price, credits,
      message: `Purchased 1 ${check.item.name} for ${check.offer.price} credits. Delivered to your station warehouse. Balance: ${credits} credits.` };
  }
  transfer(id, from, to = from === 'ship' ? 'pack' : 'ship') {
    const item = ITEMS.find(item => item.id === id);
    if (!item || !Object.hasOwn(this.containers,from) || !Object.hasOwn(this.containers,to) || from===to) return { ok: false, message: 'Unknown cargo transfer.' };
    if (this.count(from,id)<1) return {ok:false,message:'No items left in this container.'};
    if (this.mass(to)+item.mass>this.capacity[to]) return {ok:false,message:`${to==='pack'?'Backpack':to==='station'?'Station warehouse':'Ship storage'} is full.`};
    this.containers[from][id]--;this.containers[to][id]++;this.persist();
    return {ok:true,message:`${item.name} ${to==='pack'?'taken into backpack':to==='station'?'stored at the station':'stowed aboard'}.`};
  }
  transferAll(from, to = from === 'ship' ? 'pack' : 'ship') {
    if(!Object.hasOwn(this.containers,from)||!Object.hasOwn(this.containers,to)||from===to)return {ok:false,message:'Unknown cargo transfer.'};
    let free=this.capacity[to]-this.mass(to),moved=0,mass=0;
    for(const item of ITEMS){
      const count=Math.max(0,Math.min(this.count(from,item.id),Math.floor((free+1e-9)/item.mass)));
      this.containers[from][item.id]-=count;this.containers[to][item.id]+=count;
      moved+=count;mass+=count*item.mass;free-=count*item.mass;
    }
    if(moved)this.persist();
    const remaining=ITEMS.reduce((n,item)=>n+this.count(from,item.id),0);
    return {ok:moved>0,moved,mass,remaining,message:moved?`Transferred ${moved} items (${mass.toFixed(1)} kg).${remaining?' Remaining items stay in storage; destination capacity reached.':''}`:'Nothing fits or the source is empty.'};
  }
}
