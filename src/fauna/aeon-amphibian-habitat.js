import { RADIUS, terrainSample, biomeAt } from '../world.js';
import { GENERATOR_VERSION } from '../generation.js';
import { createHabitatQueries } from './habitat-query.js';

export const AEON_AMPHIBIAN_HABITAT_VERSION = 1;
export const AEON_AMPHIBIAN_HABITAT = Object.freeze({
  id: 'aeon-amphibian', version: AEON_AMPHIBIAN_HABITAT_VERSION,
  terrainVersion: GENERATOR_VERSION, biome: 'COASTLAND', defaultSeed: 7291,
  cellSize: 120, density: .14, defaultRadius: 420, maxRadius: 500, maxSpawns: 6,
  minHeight: .5, maxHeight: 8, maxSlope: Math.tan(12 * Math.PI / 180),
  footprintRadii: Object.freeze([2, 5]),
  locomotionVersion: 1, footingRadii: Object.freeze([.35, .7]),
  maxVisitedCells: 14 ** 3,
});
/** Reproduction fixture for terrain seed7291, not an override of terrain or spawning.
 * Runtime starts should recompute the canonical floor for the active world seed. */
export const AEON_AMPHIBIAN_QA = Object.freeze({
  terrainSeed: 7291, populationSeed: 7291,
  direction: Object.freeze([.7112427874306442, .5709, -.4101303296854399]),
  position: Object.freeze([1132833.1345619268, 909301.9260802969, -653235.7658555222]),
  spawnId: 'aeon-amphibian-v1:7291:9439,7578,-5444',
  spawnPosition: Object.freeze([1132740.997670869, 909412.2911417502, -653250.4442113028]),
});
const identity = (x, y, z) => [x, y, z];
const queries = createHabitatQueries(AEON_AMPHIBIAN_HABITAT, {
  radius: RADIUS, position: [0, 0, 0], maxHeight: AEON_AMPHIBIAN_HABITAT.maxHeight,
  toBody: identity, fromBody: identity,
  directionSuitable: () => true, nearHabitat: () => true,
  sample: (x, y, z) => {
    const sample = terrainSample(x, y, z);
    return { ...sample, region: biomeAt(x, y, z, sample.height) };
  },
  suitable: (_direction, sample) => sample.region === 'COASTLAND'
    && sample.height >= AEON_AMPHIBIAN_HABITAT.minHeight
    && sample.height <= AEON_AMPHIBIAN_HABITAT.maxHeight,
});
/** Aeon's canonical low COASTLAND subset, not a new BEACH biome. Heights are
 * measured above canonical radius/mean sea level; all centre and footprint
 * samples must be .5–8m dry land with at most12deg slope. This is a low-shore
 * elevation proxy, not a computed horizontal distance to the nearest water.
 * Directions and output positions use Aeon's unrotated world frame, in doubles.
 * Terrain uses the active generation seed; query seed controls population only. */
export const sampleAeonAmphibianHabitat = queries.sampleHabitat;
/** Separate small-body locomotion footprint. Radii .35/.7m cover the measured1.065m width/1.312m length. Same canonical dry shore/slope rules;
 * no swimming, wave collision, swept obstacles or pathfinding is implemented. */
export const sampleAeonAmphibianFooting = queries.sampleFooting;
/** Stable Cartesian-shell anchors, <=6 within <=500m. Caller owns global cap,
 * persistence and streaming cadence. No mutable RNG or player-following poses. */
export const enumerateAeonAmphibianSpawns = queries.enumerateSpawns;
