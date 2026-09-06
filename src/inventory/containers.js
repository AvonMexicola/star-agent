import { ITEMS } from '../ship-inventory.js';

export const RESOURCE_IDS = ['basalt', 'copper', 'ice'];
export const CATALOG = Object.freeze([
  ...ITEMS.map(item => ({ ...item, unit: 'item', stack: item.id === 'ration' ? 10 : 1, color: '#b5c8bc' })),
  { id: 'basalt', name: 'Basalt concentrate', detail: 'Collected rock concentrate', mass: 1, unit: 'kg', stack: 4, color: '#b4b7c4' },
  { id: 'copper', name: 'Copper ore', detail: 'Metal-bearing mineral', mass: 1, unit: 'kg', stack: 4, color: '#df9c68' },
  { id: 'ice', name: 'Water ice', detail: 'Recovered frozen volatiles', mass: 1, unit: 'kg', stack: 4, color: '#8bdfed' },
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
  const resources = RESOURCE_IDS.reduce((n, id) => n + (items[id] ?? 0), 0);
  const supplies = itemMass(items) - resources;
  return stacksFor(items).length <= boxes * SLOTS_PER_BOX
    && resources <= (limits.resources ?? boxes * 12) + EPSILON
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
