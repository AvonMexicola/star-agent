import record from '../assets/stratum/flight-parts.json' with { type: 'json' };

/** Conservative independent solids. Closed access, all gear and mining poses. */
export const STRATUM_FLIGHT_PARTS = Object.freeze(record.parts.map(part => Object.freeze({
  id: part.id, min: Object.freeze(part.min), max: Object.freeze(part.max),
})));
export const STRATUM_FLIGHT_PARTS_ASSET = record.assetSha256;
