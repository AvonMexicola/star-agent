export const INVENTORY_KEY = 'star-agent.nomad-inventory.v1';
export const ITEMS = Object.freeze([
  Object.freeze({ id: 'repair', name: 'Repair kit', detail: 'Tools & replacement parts', mass: 4 }),
  Object.freeze({ id: 'ration', name: 'Field ration', detail: 'Sealed expedition supplies', mass: .5 }),
  Object.freeze({ id: 'sample', name: 'Sample case', detail: 'Empty specimen container', mass: 2 }),
  Object.freeze({ id: 'scanner', name: 'Survey scanner', detail: 'Portable survey equipment', mass: 3 }),
]);
export const CAPACITY = Object.freeze({ ship: 120, pack: 20 });
const initial = () => ({ ship: { repair: 3, ration: 12, sample: 6, scanner: 1 }, pack: { repair: 0, ration: 2, sample: 0, scanner: 0 } });

/** Small local manifest. Item use and resource gathering are not simulated yet. */
export class ShipInventory {
  constructor(storage, capacity = CAPACITY.ship) {
    this.storage = storage;this.capacity={ship:capacity,pack:CAPACITY.pack};
    this.containers = initial();
    this.saved = Boolean(storage);
    try {
      const raw = storage?.getItem(INVENTORY_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (data.version === 1 && ['ship', 'pack'].every(container =>
          ITEMS.every(item => Number.isSafeInteger(data[container]?.[item.id]) && data[container][item.id] >= 0)
          && this.massOf(data[container]) <= (container==='ship'?2400:CAPACITY.pack))) {
          this.containers = Object.fromEntries(['ship', 'pack'].map(container => [container,
            Object.fromEntries(ITEMS.map(item => [item.id, data[container][item.id]]))]));
        }
      }
    } catch { this.saved = false; }
  }
  massOf(items) { return ITEMS.reduce((sum, item) => sum + items[item.id] * item.mass, 0); }
  mass(container) { return this.massOf(this.containers[container]); }
  count(container, id) { return this.containers[container]?.[id] ?? 0; }
  get snapshot() { return { ship: { ...this.containers.ship }, pack: { ...this.containers.pack }, shipMass: this.mass('ship'), packMass: this.mass('pack'), saved: this.saved }; }
  transfer(id, from) {
    const item = ITEMS.find(item => item.id === id);
    if (!item || !['ship', 'pack'].includes(from)) return { ok: false, message: 'Unknown cargo item.' };
    const to = from === 'ship' ? 'pack' : 'ship';
    if (this.count(from, id) < 1) return { ok: false, message: 'No items left in this container.' };
    if (this.mass(to) + item.mass > this.capacity[to]) return { ok: false, message: `${to === 'pack' ? 'Backpack' : 'Ship storage'} is full.` };
    this.containers[from][id]--;
    this.containers[to][id]++;
    try {
      if (!this.storage) throw new Error('Storage unavailable');
      this.storage.setItem(INVENTORY_KEY, JSON.stringify({ version: 1, ...this.containers }));
      this.saved = true;
    } catch { this.saved = false; }
    return { ok: true, message: `${item.name} ${to === 'pack' ? 'taken into backpack' : 'stowed aboard'}.` };
  }
}
