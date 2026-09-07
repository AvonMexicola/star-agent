import { PYRE_RADIUS, PYRE_POSITION, PYRE_GENERATOR_VERSION, PYRE_MAX_HEIGHT, pyreSurfaceBody, toPyreBody, fromPyreBody } from '../pyre-world.js';
import { createHabitatQueries } from './habitat-query.js';

export const PYREBEAR_HABITAT_VERSION = 1;
export const PYREBEAR_HABITAT = Object.freeze({
  id: 'pyrebear', version: PYREBEAR_HABITAT_VERSION, terrainVersion: PYRE_GENERATOR_VERSION,
  biome: 'TERMINATOR · BASALT PLAINS', defaultSeed: 7291,
  cellSize: 120, density: .10, defaultRadius: 420, maxRadius: 500, maxSpawns: 6,
  maxBodyZ: .04, maxActivity: .08, maxFresh: .08,
  maxSlope: Math.tan(18 * Math.PI / 180), footprintRadii: Object.freeze([2, 5]),
  // 2 * (500 * 1200000 / 1180000 + 240) / 120 < 13 cell widths.
  maxVisitedCells: 14 ** 3,
});

const queries = createHabitatQueries(PYREBEAR_HABITAT, {
  radius: PYRE_RADIUS, position: PYRE_POSITION, maxHeight: PYRE_MAX_HEIGHT,
  sample: pyreSurfaceBody, toBody: toPyreBody, fromBody: fromPyreBody,
  directionSuitable: d => Math.abs(d[2]) <= PYREBEAR_HABITAT.maxBodyZ,
  nearHabitat: (d, angle) => Math.abs(d[2]) <= PYREBEAR_HABITAT.maxBodyZ + angle,
  suitable: (d, sample) => Math.abs(d[2]) <= PYREBEAR_HABITAT.maxBodyZ
    && sample.region === 'BASALT PLAINS' && sample.activity < PYREBEAR_HABITAT.maxActivity
    && sample.fresh < PYREBEAR_HABITAT.maxFresh,
});
/** Body-frame direction -> canonical position/world normal, or null if unsafe.
 * Samples the centre and eight 2m/5m footprint points, including biome edges. */
export const samplePyrebearHabitat = queries.sampleHabitat;
/** World position array/Vector3 + {seed?,radius?,diagnostics?} -> <=6 stable anchors.
 * Body-frame120m shell cells, actual distance <=500m, no pole/longitude seams.
 * Call at streaming cadence. Consumer owns persistent death/animation state. */
export const enumeratePyrebearSpawns = queries.enumerateSpawns;
