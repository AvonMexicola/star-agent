import { RADIUS, terrainSample, biomeAt } from '../world.js';
import { GENERATOR_VERSION } from '../generation.js';
import { createHabitatQueries } from './habitat-query.js';

export const AEON_GRAZER_HABITAT_VERSION = 1;
export const AEON_GRAZER_HABITAT = Object.freeze({
  id: 'aeon-grazer', version: AEON_GRAZER_HABITAT_VERSION,
  terrainVersion: GENERATOR_VERSION, biome: 'GRASSLAND', defaultSeed: 7291,
  cellSize: 120, density: .08, defaultRadius: 420, maxRadius: 500, maxSpawns: 4,
  minHeight: 100, maxHeight: 1800, maxSlope: Math.tan(12 * Math.PI / 180),
  footprintRadii: Object.freeze([3, 6]),
  locomotionVersion: 1, footingRadii: Object.freeze([1, 2.5]),
  maxVisitedCells: 14 ** 3,
});
/** Reproduction only for terrain/population seed7291. Recompute canonical
 * height when starting another active world seed; never force this saved floor. */
export const AEON_GRAZER_QA = Object.freeze({
  terrainSeed: 7291, populationSeed: 7291,
  direction: Object.freeze([.013597990268841662, .6051666666666666, .795982663263594]),
  position: Object.freeze([21664.746198126722, 964170.5856299691, 1268184.638816021]),
  spawnId: 'aeon-grazer-v1:7291:181,8033,10564',
  spawnPosition: Object.freeze([21788.04334153623, 964299.9587349487, 1268044.8105517782]),
});
const identity = (x, y, z) => [x, y, z];
const queries = createHabitatQueries(AEON_GRAZER_HABITAT, {
  radius: RADIUS, position: [0, 0, 0], maxHeight: AEON_GRAZER_HABITAT.maxHeight,
  toBody: identity, fromBody: identity,
  directionSuitable: () => true, nearHabitat: () => true,
  sample: (x, y, z) => {
    const sample = terrainSample(x, y, z);
    return { ...sample, region: biomeAt(x, y, z, sample.height) };
  },
  suitable: (_direction, sample) => sample.region === 'GRASSLAND'
    && sample.height >= AEON_GRAZER_HABITAT.minHeight
    && sample.height <= AEON_GRAZER_HABITAT.maxHeight,
});
/** Inland canonical GRASSLAND,100–1800m above Aeon's radius and at most12deg
 * footprint slope. Centre and all broad3m/6m samples must remain in this dry
 * biome. This supplies actual canonical positions, never a second floor.
 * Population seed does not change the active canonical terrain generation seed. */
export const sampleAeonGrazerHabitat = queries.sampleHabitat;
/** Large-body1m/2.5m footing covers the measured1.797m width/4.090m length.
 * Same canonical dry grassland and slope rules; swept obstacles/pathfinding and
 * the animal's peaceful behavior are owned by runtime, not this pure sampler. */
export const sampleAeonGrazerFooting = queries.sampleFooting;
/** <=4 stable anchors within <=500m. Query together with other Aeon fauna:
 * caller must choose the combined nearest population under its global cap. */
export const enumerateAeonGrazerSpawns = queries.enumerateSpawns;
