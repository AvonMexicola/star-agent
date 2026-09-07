import { MIASMA_RADIUS, MIASMA_POSITION, MIASMA_MAX_HEIGHT, MIASMA_GENERATOR_VERSION, miasmaSurface } from '../miasma-world.js';
import { createHabitatQueries } from './habitat-query.js';

export const SULOHER_HABITAT_VERSION = 1;
export const SULOHER_HABITAT = Object.freeze({
  id: 'suloher', version: SULOHER_HABITAT_VERSION, terrainVersion: MIASMA_GENERATOR_VERSION,
  biome: 'SULPHUR UPLANDS', defaultSeed: 7291,
  cellSize: 120, density: .16, defaultRadius: 420, maxRadius: 500, maxSpawns: 6,
  maxActivity: .08, maxFresh: .08,
  maxSlope: Math.tan(18 * Math.PI / 180), footprintRadii: Object.freeze([2, 5]),
  maxVisitedCells: 14 ** 3,
});
const identity = (x, y, z) => [x, y, z];
const queries = createHabitatQueries(SULOHER_HABITAT, {
  radius: MIASMA_RADIUS, position: MIASMA_POSITION, maxHeight: MIASMA_MAX_HEIGHT,
  sample: miasmaSurface, toBody: identity, fromBody: identity,
  directionSuitable: () => true, nearHabitat: () => true,
  suitable: (_d, sample) => sample.region === 'SULPHUR UPLANDS'
    && sample.activity < SULOHER_HABITAT.maxActivity && sample.fresh < SULOHER_HABITAT.maxFresh,
});
/** Miasma's canonical terrain is WORLD-framed. bodyDirection/bodyNormal in the
 * shared result therefore mean unrotated planet-relative world directions.
 * No extra moon rotation or imaginary lake floor is introduced. Returns null
 * near named mineral basins, basin edges or steep 2m/5m footprint samples. */
export const sampleSuloherHabitat = queries.sampleHabitat;
/** Array/Vector3 world position + {seed?,radius?,diagnostics?} -> <=6 stable
 * anchors.120m Cartesian shell cells, maximum500m actual activation distance.
 * The caller enforces its combined fauna population cap and persistence. */
export const enumerateSuloherSpawns = queries.enumerateSpawns;
