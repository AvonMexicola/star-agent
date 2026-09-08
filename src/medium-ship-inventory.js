import { itemMass } from './inventory/containers.js';

/** Read-only display view of the unified local ledger, including supplies once.
 * Resource and supply limits are separate; the total has no single capacity.
 */
export function createMediumShipInventory(store, legacy) {
  const mass = id => {
    const items = store.container(id)?.items;
    return items ? itemMass(items) : legacy.mass(id);
  };
  return Object.freeze({ mass, massReadout: id => `${mass(id).toFixed(1)} kg` });
}
