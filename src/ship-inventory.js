export const INVENTORY_KEY = 'star-agent.nomad-inventory.v1';
export const ITEMS = Object.freeze([
  Object.freeze({ id: 'repair', name: 'Repair kit', detail: 'Tools & replacement parts', mass: 4 }),
  Object.freeze({ id: 'ration', name: 'Field ration', detail: 'Sealed expedition supplies', mass: .5 }),
  Object.freeze({ id: 'sample', name: 'Sample case', detail: 'Empty specimen container', mass: 2 }),
  Object.freeze({ id: 'scanner', name: 'Survey scanner', detail: 'Portable survey equipment', mass: 3 }),
]);
export const CAPACITY = Object.freeze({ ship: 120, pack: 20, station: 10000 });
const initial = () => ({ ship: { repair: 3, ration: 12, sample: 6, scanner: 1 }, pack: { repair: 0, ration: 2, sample: 0, scanner: 0 }, station: { repair: 12, ration: 80, sample: 30, scanner: 4 } });

/** Small local manifest. Item use and resource gathering are not simulated yet. */
export class ShipInventory {
  constructor(storage, capacity = CAPACITY.ship) {
    this.storage = storage;this.capacity={ship:capacity,pack:CAPACITY.pack,station:CAPACITY.station};
    this.containers = initial();
    this.saved = Boolean(storage);
    try {
      const raw = storage?.getItem(INVENTORY_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if ([1,2].includes(data.version) && (data.version===2?['ship','pack','station']:['ship','pack']).every(container =>
          ITEMS.every(item => Number.isSafeInteger(data[container]?.[item.id]) && data[container][item.id] >= 0)
          && this.massOf(data[container]) <= (container==='ship'?2400:CAPACITY[container]))) {
          this.containers = { ...this.containers, ...Object.fromEntries((data.version===2?['ship','pack','station']:['ship','pack']).map(container => [container,
            Object.fromEntries(ITEMS.map(item => [item.id, data[container][item.id]]))])) };
        }
      }
    } catch { this.saved = false; }
  }
  massOf(items) { return ITEMS.reduce((sum, item) => sum + items[item.id] * item.mass, 0); }
  mass(container) { return this.massOf(this.containers[container]); }
  count(container, id) { return this.containers[container]?.[id] ?? 0; }
  get snapshot() { return { ship: { ...this.containers.ship }, pack: { ...this.containers.pack }, station: { ...this.containers.station }, stationMass: this.mass('station'), shipMass: this.mass('ship'), packMass: this.mass('pack'), saved: this.saved }; }
  persist() {
    try {
      if (!this.storage) throw new Error('Storage unavailable');
      // One write commits all three containers; there is no cross-key partial transfer.
      this.storage.setItem(INVENTORY_KEY, JSON.stringify({ version: 2, ...this.containers }));
      this.saved = true;
    } catch { this.saved = false; }
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
