import { ROCK_ID, ROCK_VERSION, SIDE, createDensity, encodeDensity, decodeDensity } from './volume.js';
import { STARTER_CREDITS, STATION_SHOPS, initialShopStock } from '../station-shop.js';
import { ShipInventory, ITEMS } from '../ship-inventory.js';
import { defaultLoadout, validLoadout } from '../inventory/loadout.js';
import { CATALOG, MATERIAL_IDS, PROCESSED_IDS, resourceItems, resourceAmounts, emptyItems, fitsBox, planTransfer, validItems, MAX_BOXES } from '../inventory/containers.js';
export const MINING_KEY = 'star-agent.selene-mining.v1';
export const POUCH_CAPACITY = 12;
// Exact snapshots: 17 fields including the legacy deposit stay below 3.3M
// serialized characters. Never evict edits or restore exhausted ore to make room.
export const MAX_SAVED_ROCKS = 16;
const validField = field => field?.length === SIDE ** 3 && Array.from(field).every(n => Number.isFinite(n) && Math.abs(n) < 20);
const decodeField = field => typeof field === 'string' ? decodeDensity(field) : new Float32Array(field);
const safeId = id => typeof id === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,119}$/.test(id) && !['constructor', 'prototype', '__proto__'].includes(id);

// Terrain edits, resources, supply manifests and all container transfers use one
// localStorage transaction. Legacy manifests remain untouched during migration.
export class MiningStore {
  constructor(storage) {
    this.storage = storage; this.saved = Boolean(storage); this.warning = ''; this.initialRocks = new Map(); this.encodedFields = new WeakMap();
    const legacy = new ShipInventory(storage), oldSupplies = legacy.containers;
    this.persistedRaw = null;
    this.state = {
      id: ROCK_ID, version: ROCK_VERSION, revision: 0, field: createDensity(), pack: [0, 0, 0], ship: [0, 0, 0],
      economy: {credits:legacy.credits,shopStock:structuredClone(legacy.shopStock)},
      boxes: { pack: 1, ship: 4, station: 2 }, supplies: oldSupplies, loadout: defaultLoadout(),
      materials: { pack: {}, ship: {} },
      remote: { station: { name: 'Aeon orbital locker', kind: 'station', items: emptyItems() } }, rocks: {},
    };
    const initialState = this.state;
    try {
      const raw = storage?.getItem(MINING_KEY);this.persistedRaw=raw??null;
      if(!raw&&legacy.persistenceBlocked){this.blocked=true;this.saved=false;this.warning=legacy.loadError;return;}
      if (raw) {
        const d = JSON.parse(raw); const rawField = d.field; d.field = decodeField(d.field);
        if (typeof rawField === 'string') this.encodedFields.set(d.field, rawField);
        if (d.id !== ROCK_ID || d.version !== ROCK_VERSION || !Number.isSafeInteger(d.revision) || d.revision < 0 || !validField(d.field)
          || !['pack', 'ship'].every(k => Array.isArray(d[k]) && d[k].length === 3 && d[k].every(n => Number.isFinite(n) && n >= 0))) throw Error('Unrecognized mining save');
        // Defaults migrate v1 mining saves and the old supply manifest exactly once.
        this.state = { ...this.state, ...d };
        this.state.supplies={...oldSupplies,...this.state.supplies};
        for(const id of ['station','ship','pack'])this.state.supplies[id]={...Object.fromEntries(ITEMS.map(item=>[item.id,0])),...this.state.supplies[id]};
        if (!this.state.rocks || typeof this.state.rocks !== 'object' || Array.isArray(this.state.rocks) || Object.keys(this.state.rocks).length > MAX_SAVED_ROCKS) throw Error('Invalid rock registry');
        for (const [id, rock] of Object.entries(this.state.rocks)) {
          const rawRockField = rock.field; rock.field = decodeField(rock.field);
          if (typeof rawRockField === 'string') this.encodedFields.set(rock.field, rawRockField);
          if (!safeId(id) || !Number.isSafeInteger(rock.revision) || rock.revision < 0 || !validField(rock.field)) throw Error('Invalid rock save');
        }
        if (!Number.isSafeInteger(this.state.economy?.credits) || this.state.economy.credits<0 || this.state.economy.credits>STARTER_CREDITS || !Object.entries(STATION_SHOPS).every(([id,shop])=>shop.offers.every(offer=>Number.isSafeInteger(this.state.economy.shopStock?.[id]?.[offer.itemId])&&this.state.economy.shopStock[id][offer.itemId]>=0&&this.state.economy.shopStock[id][offer.itemId]<=offer.stock)))throw Error('Invalid shop ledger');
        if (!validLoadout(this.state.loadout) || !this.validContainers(this.state)) throw Error('Invalid containers');
      }
    } catch {
      this.state = initialState;
      this.saved = false; this.warning = 'Inventory save could not be read. Original save retained; mining and transfers are paused.'; this.blocked = true;
    }
  }
  get mass() { const items=this.container('pack').items; return MATERIAL_IDS.reduce((sum,id)=>sum+items[id],0); }
  get capacity() { return this.state.loadout.slots.backpack ? this.state.boxes.pack * POUCH_CAPACITY : 0; }
  get free() { return Math.max(0, this.capacity - this.mass); }
  container(id, state = this.state) {
    if (!safeId(id)) return null;
    if (id === 'pack' || id === 'ship') return { id, name: id === 'pack' ? 'Backpack' : 'Nomad cargo', kind: id === 'pack' ? 'backpack' : 'ship', boxes: state.boxes[id], items: { ...emptyItems(), ...state.supplies[id], ...state.materials?.[id], ...resourceItems(state[id]) } };
    const remote = Object.hasOwn(state.remote, id) ? state.remote[id] : null;
    return remote ? { id, ...remote, boxes: state.boxes[id], items: { ...emptyItems(), ...remote.items } } : null;
  }
  limits(id, state = this.state) {
    if(id==='pack'&&!state.loadout.slots.backpack)return {resources:0,supplies:0};
    return { resources: state.boxes[id] * 12, supplies: id === 'pack' ? 20 : id === 'ship' ? (this.manifest?.capacity.ship??2400) : state.boxes[id] * 30 };
  }
  validContainers(state) {
    if (!state.materials || Array.isArray(state.materials) || typeof state.materials !== 'object' || !['pack','ship'].every(id => { const items=state.materials[id]; return items && !Array.isArray(items) && validItems(items) && Object.keys(items).every(key=>PROCESSED_IDS.includes(key)); })) return false;
    if (!state.boxes || !state.supplies || !state.remote || Array.isArray(state.remote) || typeof state.remote !== 'object'
      || Object.keys(state.remote).length > 64 || !['pack', 'ship'].every(id => validItems(state.supplies[id]) && ITEMS.every(item => Number.isSafeInteger(state.supplies[id][item.id]??0)) && Object.keys(state.supplies[id]).every(key => CATALOG.some(item => item.id === key && item.unit === 'item')))) return false;
    return ['pack', 'ship', ...Object.keys(state.remote)].every(id => {
      if (!safeId(id)) return false;
      const c = this.container(id, state);
      return c && ['backpack', 'ship', 'station', 'base'].includes(c.kind) && typeof c.name === 'string' && c.name.length <= 80 && fitsBox(c.items, c.boxes, this.limits(id, state));
    });
  }
  encode(field, supplied) {
    if (supplied) this.encodedFields.set(field, supplied);
    if (!this.encodedFields.has(field)) this.encodedFields.set(field, encodeDensity(field));
    return this.encodedFields.get(field);
  }
  write(next, encodedField) {
    if (this.blocked) return false;
    try {
      if (!this.storage) throw Error('Browser storage unavailable');
      const rocks = Object.fromEntries(Object.entries(next.rocks).map(([id, rock]) => [id, { ...rock, field: this.encode(rock.field), encodedField: undefined }]));
      if((this.storage.getItem(MINING_KEY)??null)!==this.persistedRaw)throw Error('Save changed in another session');
      const raw=JSON.stringify({ ...next, field: this.encode(next.field, encodedField), rocks });
      this.storage.setItem(MINING_KEY, raw);this.persistedRaw=raw;
      this.saved = true; this.warning = '';
    } catch {
      this.saved = false; this.blocked = true; this.warning = 'Save unavailable. Previous cuts and cargo retained. Reload to retry.'; return false;
    }
    this.state = next; this.syncManifest(); return true;
  }
  bindManifest(manifest) { this.manifest = manifest; this.syncManifest(); }
  syncManifest() {
    if (!this.manifest) return;
    this.manifest.containers = structuredClone(this.state.supplies);
    this.manifest.saved = this.saved;
    this.manifest.credits=this.state.economy.credits;this.manifest.shopStock=structuredClone(this.state.economy.shopStock);
    this.manifest.persistenceBlocked=Boolean(this.blocked);
  }
  commit(result, revision) { return this.commitRock(ROCK_ID, result, revision); }
  getRock(id, initialField) {
    if (!safeId(id)) throw Error('Invalid rock identifier');
    if (id === ROCK_ID) return { field: this.state.field, revision: this.state.revision };
    if (Object.hasOwn(this.state.rocks, id)) return this.state.rocks[id];
    if (!this.initialRocks.has(id)) {
      if (!validField(initialField)) throw Error('Invalid initial rock field');
      this.initialRocks.set(id, { field: initialField, revision: 0 });
    }
    return this.initialRocks.get(id);
  }
  releaseRock(id) { this.initialRocks.delete(id); }
  canEditRock(id) { return safeId(id) && !this.blocked && (id === ROCK_ID || Object.hasOwn(this.state.rocks, id) || Object.keys(this.state.rocks).length < MAX_SAVED_ROCKS); }
  commitRock(id, result, revision) {
    if (!this.canEditRock(id)) { this.warning = this.blocked ? this.warning : `Rock save slots are full (${MAX_SAVED_ROCKS} surveyed deposits). Existing deposits remain mineable.`; return false; }
    const rock = id === ROCK_ID ? this.state : this.state.rocks[id] ?? this.initialRocks.get(id);
    if (!rock || revision !== rock.revision || !Array.isArray(result.yieldVolume) || result.yieldVolume.length !== 3 || !result.yieldVolume.every(n => Number.isFinite(n) && n >= 0) || !validField(result.field)) return false;
    const added = result.yieldVolume.map(v => v * 12);
    if (added.reduce((a, b) => a + b, 0) > this.free + 1e-7) { this.warning = 'Backpack mineral boxes are full.'; return false; }
    if (result.encodedField) this.encodedFields.set(result.field, result.encodedField);
    const next = { ...this.state, pack: this.state.pack.map((v, i) => v + added[i]) };
    if (!fitsBox(this.container('pack', next).items, next.boxes.pack, this.limits('pack', next))) { this.warning = 'Backpack stack slots are full. Stow items or attach another box.'; return false; }
    if (id === ROCK_ID) { next.field = result.field; next.revision = revision + 1; }
    else next.rocks = { ...this.state.rocks, [id]: { field: result.field, revision: revision + 1 } };
    return this.write(next, id === ROCK_ID ? result.encodedField : undefined);
  }
  withItems(state, id, items) {
    if (id === 'pack' || id === 'ship') return { ...state, [id]: resourceAmounts(items), materials: {...state.materials, [id]: Object.fromEntries(PROCESSED_IDS.map(key=>[key,items[key]??0]))}, supplies: { ...state.supplies, [id]: Object.fromEntries(CATALOG.filter(item=>item.unit==='item').map(item => [item.id, items[item.id] ?? 0])) } };
    return { ...state, remote: { ...state.remote, [id]: { ...state.remote[id], items } } };
  }
  transfer(id, from, to, quantity) {
    const source = this.container(from), target = this.container(to);
    if (!source || !target || from === to) return { ok: false, message: 'Choose a nearby destination container.' };
    const result = planTransfer(source.items, target.items, id, quantity, target.boxes, this.limits(to));
    if (!result.ok) return result;
    const next = this.withItems(this.withItems(this.state, from, result.from), to, result.to);
    if (!this.write(next)) return { ok: false, message: this.warning };
    return result;
  }
  stow() {
    let next = this.state;
    for (const id of MATERIAL_IDS) {
      const source = this.container('pack', next), target = this.container('ship', next), amount = source.items[id];
      if (amount <= 1e-7) continue;
      const result = planTransfer(source.items, target.items, id, amount, target.boxes, this.limits('ship', next));
      if (!result.ok) { this.warning = result.message; return false; }
      next = this.withItems(this.withItems(next, 'pack', result.from), 'ship', result.to);
    }
    return this.write(next);
  }
  addBox(id) {
    if(id==='pack'&&!this.state.loadout.slots.backpack)return {ok:false,message:'Equip a backpack first.'};
    const c = this.container(id), max = id === 'pack' ? 2 : MAX_BOXES;
    if (!c || c.boxes >= max) return { ok: false, message: `All ${max} box mounts are occupied.` };
    const ok = this.write({ ...this.state, boxes: { ...this.state.boxes, [id]: c.boxes + 1 } });
    return { ok, message: ok ? 'Empty box attached: 8 stack slots and 12 kg mineral capacity added.' : this.warning };
  }
  registerContainer({ id, name, kind = 'base', boxes = 2 }) {
    if (!safeId(id) || ['pack', 'ship', 'station'].includes(id) || !['base', 'station', 'ship'].includes(kind) || typeof name !== 'string' || name.length > 80 || !Number.isSafeInteger(boxes) || boxes < 1 || boxes > MAX_BOXES) return false;
    if (this.container(id)) return true;
    const next = { ...this.state, boxes: { ...this.state.boxes, [id]: boxes }, remote: { ...this.state.remote, [id]: { name, kind, items: emptyItems() } } };
    if (!this.validContainers(next)) return false;
    return this.write(next);
  }
}
