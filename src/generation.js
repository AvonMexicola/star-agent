export const DEFAULT_SEED = 7291;
export const GENERATOR_VERSION = 3;

export function parsePlanetSeed(value) {
  if (value === null || value === undefined || value === '') return DEFAULT_SEED;
  const text = String(value);
  const number = Number(text);
  if (!/^\d+$/.test(text) || !Number.isSafeInteger(number) || number < 0 || number > 0xffffffff) {
    throw new Error('Planet seed must be a whole number from 0 to 4294967295.');
  }
  return number;
}

// Workers receive the seed in their first generation request. The browser reads
// it before any destination, geometry or scatter query can run.
function initialSeed() {
  try { return parsePlanetSeed(typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('seed')); }
  catch { return DEFAULT_SEED; }
}
export let SEED = initialSeed();
export function setPlanetSeed(value) { SEED = parsePlanetSeed(value); }
