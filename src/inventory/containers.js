import { ITEMS } from '../ship-inventory.js';

export const MINERAL_CAPACITY_PER_BOX = 48;
export const MINERAL_STACK_KG = 16;
export const RESOURCE_IDS = ['basalt', 'copper', 'ice'];
export const PROCESSED_IDS = ['aggregate', 'mineral-binder', 'concrete', 'metal-stock', 'conductor', 'glass', 'uranium-ore', 'helium-3-regolith'];
export const MATERIAL_IDS = [...RESOURCE_IDS, ...PROCESSED_IDS];
export const CATALOG = Object.freeze([
  { id: 'rifle-laser', name: 'Laser rifle', detail: 'Solar laser beam · uses laser rifle charges', category: 'weapon', ammo: 'carbine-charge', mass: 3.6, unit: 'item', stack: 1, color: '#eab16c' },
  { id: 'sidearm-pistol', name: 'Energy sidearm', detail: 'Compact energy weapon · sidearm charges', category: 'weapon', ammo: 'sidearm-charge', mass: 1.1, unit: 'item', stack: 1, color: '#e88c8e' },
  { id: 'mining-laser-tool', name: 'Mining laser', detail: 'Rechargeable cutter · heat limited', category: 'tool', mass: 3, unit: 'item', stack: 1, color: '#9be8c6' },
  { id: 'backpack-life-support', name: 'Life-support backpack', detail: 'Field storage · two box mounts', category: 'backpack', mass: 4, unit: 'item', stack: 1, color: '#8acaca' },
  { id: 'carbine-charge', name: 'Laser rifle charges', detail: 'One charge per laser rifle shot', category: 'ammo', mass: .015, unit: 'item', stack: 90, color: '#eab16c' },
  { id: 'sidearm-charge', name: 'Sidearm charges', detail: 'One charge per sidearm pulse', category: 'ammo', mass: .01, unit: 'item', stack: 48, color: '#e88c8e' },
  { id: 'bandage', name: 'Bandage', detail: 'Stops bleeding and restores 15 health', category: 'quick', heal: 15, stopsBleeding: true, mass: .1, unit: 'item', stack: 5, color: '#d6ddd4' },
  { id: 'healing-stim', name: 'Healing stim', detail: 'Restores 40 health', category: 'quick', heal: 40, mass: .15, unit: 'item', stack: 5, color: '#8cdeb0' },
  ...PROCESSED_IDS.map(id => ({ id, name: ({aggregate:'Aggregate', 'mineral-binder':'Dry mineral binder', concrete:'Dry mineral concrete', 'metal-stock':'Metal stock', conductor:'Conductor stock', glass:'Basic glass', 'uranium-ore':'Uranium-bearing ore', 'helium-3-regolith':'Helium-3-rich regolith'})[id], detail:id==='uranium-ore'?'Rare Pyre outcrop concentrate · uranium generator fuel':id==='helium-3-regolith'?'Selene surface byproduct · enriched fusion feedstock':'Field-processed construction material', mass:1, unit:'kg', stack:MINERAL_STACK_KG, color:'#b5c8bc' })),
  ...ITEMS.map(item => ({ ...item, unit: 'item', stack: item.id === 'ration' ? 10 : 1, color: '#b5c8bc' })),
  { id: 'basalt', name: 'Basalt concentrate', detail: 'Collected rock concentrate', mass: 1, unit: 'kg', stack: MINERAL_STACK_KG, color: '#b4b7c4' },
  { id: 'copper', name: 'Copper ore', detail: 'Metal-bearing mineral', mass: 1, unit: 'kg', stack: MINERAL_STACK_KG, color: '#df9c68' },
  { id: 'ice', name: 'Water ice', detail: 'Recovered frozen volatiles', mass: 1, unit: 'kg', stack: MINERAL_STACK_KG, color: '#8bdfed' },
]);
export const SLOTS_PER_BOX = 8;
export const MAX_BOXES = 8;
export const EPSILON = 1e-7;
export const itemById = id => CATALOG.find(item => item.id === id);
export const quantityLabel = (item, amount) => item.unit === 'kg' ? `${amount.toFixed(2)} kg` : `${amount} ×`;
export const emptyItems = () => Object.fromEntries(CATALOG.map(item => [item.id, 0]));
export const resourceItems = amounts => Object.fromEntries(RESOURCE_IDS.map((id, i) => [id, amounts[i] ?? 0]));
export const resourceAmounts = items => RESOURCE_IDS.map(id => items[id] ?? 0);
export const itemMass = items => CATALOG.reduce((mass, item) => mass + (items[item.id] ?? 0) * item.mass, 0);

/** A type occupies its own stack; spare weight never creates an extra slot. */
export function stacksFor(items) {
  const stacks = [];
  for (const item of CATALOG) {
    let quantity = items[item.id] ?? 0;
    while (quantity > EPSILON) {
      const count = Math.min(item.stack, quantity);
      stacks.push({ item: item.id, quantity: count });
      quantity -= count;
      if (stacks.length > SLOTS_PER_BOX * MAX_BOXES) return stacks;
    }
  }
  return stacks;
}
export function validItems(items) {
  return items && Object.keys(items).every(id => itemById(id)) && CATALOG.every(item => {
    const n = items[item.id] ?? 0;
    return Number.isFinite(n) && n >= 0 && n <= 10000 && (item.unit === 'kg' || Number.isSafeInteger(n));
  });
}
export function fitsBox(items, boxes, limits = {}) {
  if (!validItems(items) || !Number.isSafeInteger(boxes) || boxes < 1 || boxes > MAX_BOXES) return false;
  const resources = MATERIAL_IDS.reduce((n, id) => n + (items[id] ?? 0), 0);
  const supplies = itemMass(items) - resources;
  return stacksFor(items).length <= boxes * SLOTS_PER_BOX
    && resources <= (limits.resources ?? boxes * MINERAL_CAPACITY_PER_BOX) + EPSILON
    && supplies <= (limits.supplies ?? boxes * 30) + EPSILON;
}
export function planTransfer(source, target, id, quantity, boxes, limits) {
  const item = itemById(id);
  if (!item || !Number.isFinite(quantity) || quantity <= EPSILON || (item.unit === 'item' && !Number.isSafeInteger(quantity))) return { ok: false, message: 'Choose a valid stack.' };
  if ((source[id] ?? 0) + EPSILON < quantity) return { ok: false, message: 'That stack has already changed.' };
  const from = { ...source, [id]: Math.max(0, (source[id] ?? 0) - quantity) };
  const to = { ...target, [id]: (target[id] ?? 0) + quantity };
  if (!fitsBox(to, boxes, limits)) return { ok: false, message: 'Destination is full. Add a box or free a stack slot.' };
  return { ok: true, from, to, message: `${quantityLabel(item, quantity)} ${item.name} transferred.` };
}
