import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SEED, setPlanetSeed } from '../src/generation.js';
import { findDestinations, latLonDirection } from '../src/world.js';
import {
  FOREST_CELL_SIZE,
  FOREST_RECORD_STRIDE,
  FOREST_TILE_CELLS,
  buildForestTile,
  forestDensity,
  forestTilesAround,
} from '../src/forest-distribution.js';

const asDirection = ([x, y, z]) => ({ x, y, z });
const bytes = array => Buffer.from(array.buffer, array.byteOffset, array.byteLength);

test('forest tiles are fixed, bounded candidate grids ordered nearest first', () => {
  assert.equal(FOREST_CELL_SIZE, 16);
  assert.equal(FOREST_TILE_CELLS, 16);
  assert.equal(FOREST_RECORD_STRIDE, 9);
  const plans = forestTilesAround(asDirection(latLonDirection(24, 17)), 1700);
  assert.ok(plans.length > 100 && plans.length < 250);
  assert.equal(new Set(plans.map(tile => tile.key)).size, plans.length);
  for (let index = 1; index < plans.length; index++) {
    assert.ok(plans[index - 1].distance <= plans[index].distance);
  }
  for (const tile of plans.slice(0, 8)) {
    const result = buildForestTile(tile);
    assert.equal(result.key, tile.key);
    assert.equal(result.records.length % FOREST_RECORD_STRIDE, 0);
    assert.ok(result.records.length / FOREST_RECORD_STRIDE <= FOREST_TILE_CELLS ** 2);
  }
});

test('forest records are byte-stable for a seed and change with the live world seed', t => {
  t.after(() => setPlanetSeed(DEFAULT_SEED));
  setPlanetSeed(7291);
  const tile = forestTilesAround(asDirection(findDestinations().forest), 300)[0];
  const first = buildForestTile(tile);
  setPlanetSeed(9173);
  const alternate = buildForestTile(tile);
  assert.notDeepEqual(bytes(alternate.records), bytes(first.records));
  setPlanetSeed(7291);
  const repeated = buildForestTile({ ...tile });
  assert.deepEqual(bytes(repeated.records), bytes(first.records));
});

test('overlapping plans preserve tile IDs and records across movement and the dateline', t => {
  t.after(() => setPlanetSeed(DEFAULT_SEED));
  setPlanetSeed(7291);
  const a = forestTilesAround(asDirection(latLonDirection(18, 31)), 900);
  const b = forestTilesAround(asDirection(latLonDirection(18.002, 31.003)), 900);
  const bKeys = new Set(b.map(tile => tile.key));
  const shared = a.filter(tile => bKeys.has(tile.key));
  assert.ok(shared.length > 20);
  const fromB = new Map(b.map(tile => [tile.key, tile]));
  for (const tile of shared.slice(0, 4)) {
    const moved = fromB.get(tile.key);
    assert.deepEqual(
      [moved.row, moved.column, moved.columns, moved.latitude, moved.longitude, moved.rowSize, moved.columnSize],
      [tile.row, tile.column, tile.columns, tile.latitude, tile.longitude, tile.rowSize, tile.columnSize],
    );
    assert.deepEqual(bytes(buildForestTile(tile).records), bytes(buildForestTile(moved).records));
  }

  const west = forestTilesAround(asDirection(latLonDirection(12, 179.998)), 700);
  const east = forestTilesAround(asDirection(latLonDirection(12, -179.998)), 700);
  const eastKeys = new Set(east.map(tile => tile.key));
  const datelineShared = west.find(tile => eastKeys.has(tile.key));
  assert.ok(datelineShared);
  assert.deepEqual(
    bytes(buildForestTile(datelineShared).records),
    bytes(buildForestTile(east.find(tile => tile.key === datelineShared.key)).records),
  );
  assert.equal(new Set(west.map(tile => tile.key)).size, west.length);
  assert.equal(new Set(east.map(tile => tile.key)).size, east.length);
});

test('density has hard biome bounds and forest destination is patchy with reduced occupancy', t => {
  t.after(() => setPlanetSeed(DEFAULT_SEED));
  setPlanetSeed(7291);
  assert.equal(forestDensity(1, 0, 0, 11.99), 0);
  assert.equal(forestDensity(1, 0, 0, 2200.01), 0);
  assert.equal(forestDensity(Math.sqrt(1 - 0.85 ** 2), 0.85, 0, 100), 0);
  for (let longitude = -180; longitude < 180; longitude += 7) {
    const [x, y, z] = latLonDirection(22, longitude);
    assert.ok(forestDensity(x, y, z, 500) >= 0 && forestDensity(x, y, z, 500) <= 0.65);
  }

  const destination = asDirection(findDestinations().forest);
  const tiles = forestTilesAround(destination, 1200);
  const occupancies = tiles.map(tile => buildForestTile(tile).records.length / FOREST_RECORD_STRIDE);
  const trees = occupancies.reduce((sum, count) => sum + count, 0);
  assert.ok(trees > 500, `expected a visible forest, got ${trees} trees`);
  assert.ok(trees < 10000, `expected much less work than the old ~40k trees, got ${trees}`);
  assert.ok(occupancies.some(count => count <= 8), 'expected substantial clearing tiles');
  assert.ok(occupancies.some(count => count >= 40), 'expected recognisable grove tiles');
});
