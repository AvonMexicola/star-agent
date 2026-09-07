/** Versioned, finite development starter allocation. Never recalculate an issued
 * kit from changing recipes: the persisted receipt prevents repeat grants. */
export const STARTER_CONSTRUCTION_PIECES = Object.freeze({mainframe:1,foundation:3,wall:2,doorway:1,window:1,stairs:1,floor:1,crate:1});
export const STARTER_CONSTRUCTION_ITEMS = Object.freeze({concrete:80,'metal-stock':16,conductor:3,glass:4});
export const defaultStarterConstruction = () => ({version:1,claimed:false});
export function validStarterConstruction(value) {
  return Boolean(value && typeof value==='object' && !Array.isArray(value)
    && value.version===1 && typeof value.claimed==='boolean');
}
