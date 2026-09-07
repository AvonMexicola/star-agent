import {landmarkExcludes} from './landmark-distribution.js';
import { RADIUS, hash, moisture, noise, smoothstep, terrainSample } from './world.js';

// Layout version is independent of the unchanged terrain generator.
export const FOREST_GENERATOR_VERSION = 3;
export const FOREST_CELL_SIZE = 16;
export const FOREST_TILE_CELLS = 16;
export const FOREST_RECORD_STRIDE = 9;

const TAU = Math.PI * 2;
const HALF_PI = Math.PI / 2;
const TILE_SIZE = FOREST_CELL_SIZE * FOREST_TILE_CELLS;
const ROW_SIZE = TILE_SIZE / RADIUS;
const TILE_REACH = Math.SQRT2 * TILE_SIZE * 0.5;
const POLAR_LIMIT = 0.84;

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const wrap = (value, period) => ((value % period) + period) % period;

function rowMetadata(row) {
  const latitude = -HALF_PI + (row + 0.5) * ROW_SIZE;
  if (latitude <= -HALF_PI || latitude >= HALF_PI) return null;
  const columns = Math.max(1, Math.round(TAU * RADIUS * Math.cos(latitude) / TILE_SIZE));
  return { latitude, columns, columnSize: TAU / columns };
}

function tileDescriptor(row, column, distance = 0) {
  const metadata = rowMetadata(row);
  if (!metadata) return null;
  const wrappedColumn = wrap(column, metadata.columns);
  const longitude = -Math.PI + (wrappedColumn + 0.5) * metadata.columnSize;
  return {
    key: `${row}/${wrappedColumn}`,
    row,
    column: wrappedColumn,
    columns: metadata.columns,
    latitude: metadata.latitude,
    longitude,
    rowSize: ROW_SIZE,
    columnSize: metadata.columnSize,
    distance,
  };
}

/**
 * Return the fixed global forest tiles which intersect a surface-radius query.
 * Tile keys and all generation metadata are independent of the query position;
 * only `distance` changes as the viewer moves.
 */
export function forestTilesAround(direction, radius = 1700) {
  const length = Math.hypot(direction?.x ?? 0, direction?.y ?? 0, direction?.z ?? 0);
  if (!(length > 0) || !Number.isFinite(radius) || radius < 0) return [];

  const x = direction.x / length, y = direction.y / length, z = direction.z / length;
  const latitude = Math.asin(clamp(y, -1, 1));
  const longitude = Math.atan2(x, z);
  const firstRow = Math.floor((latitude + HALF_PI - radius / RADIUS) / ROW_SIZE) - 1;
  const lastRow = Math.floor((latitude + HALF_PI + radius / RADIUS) / ROW_SIZE) + 1;
  const found = new Map();

  for (let row = firstRow; row <= lastRow; row++) {
    const metadata = rowMetadata(row);
    if (!metadata || Math.abs(Math.sin(metadata.latitude)) > POLAR_LIMIT) continue;
    const centerColumn = Math.floor((longitude + Math.PI) / metadata.columnSize);
    // At the supported latitudes a tile remains approximately 256 m wide.
    const reach = Math.ceil((radius + TILE_REACH) / TILE_SIZE) + 1;
    for (let offset = -reach; offset <= reach; offset++) {
      const descriptor = tileDescriptor(row, centerColumn + offset);
      if (found.has(descriptor.key)) continue;
      const cosLatitude = Math.cos(descriptor.latitude);
      const tx = cosLatitude * Math.sin(descriptor.longitude);
      const ty = Math.sin(descriptor.latitude);
      const tz = cosLatitude * Math.cos(descriptor.longitude);
      const distance = Math.hypot(tx - x, ty - y, tz - z) * RADIUS;
      if (distance > radius + TILE_REACH) continue;
      descriptor.distance = distance;
      found.set(descriptor.key, descriptor);
    }
  }

  return [...found.values()].sort((a, b) => a.distance - b.distance || a.row - b.row || a.column - b.column);
}

/**
 * Probability that a fixed candidate cell contains a tree. The broad field
 * makes kilometre-scale clearings while its second band breaks grove edges up
 * at roughly 500 m. Height is supplied by the shared terrain generator.
 */
export function forestDensity(x, y, z, height = 100) {
  if (Math.abs(y) > POLAR_LIMIT || height < 12 || height > 2200) return 0;

  const wet = smoothstep(0.40, 0.59, moisture(x, y, z));
  if (wet <= 0) return 0;
  const broad = noise(x * 1050 + 37.1, y * 1050 - 18.7, z * 1050 + 91.3);
  const middle = noise(x * 3200 - 53.7, y * 3200 + 29.1, z * 3200 + 11.9);
  // Requiring both bands to be favourable leaves broad open country and also
  // cuts smaller glades through an otherwise dense kilometre-scale grove.
  const grove = smoothstep(0.48, 0.68, broad);
  const edge = smoothstep(0.45, 0.68, middle);
  return Math.min(0.65, 0.65 * wet * grove * edge);
}

/** Build the deterministic tree records for one descriptor from forestTilesAround. */
export function buildForestTile(tile) {
  if (!tile || !Number.isInteger(tile.row) || !Number.isInteger(tile.column)) {
    throw new TypeError('A forest tile descriptor requires integer row and column fields.');
  }
  const descriptor = tileDescriptor(tile.row, tile.column);
  if (!descriptor || descriptor.column !== tile.column || Math.abs(Math.sin(descriptor.latitude)) > POLAR_LIMIT) {
    return { key: tile.key ?? `${tile.row}/${tile.column}`, records: new Float64Array() };
  }

  const values = [];
  for (let cellRow = 0; cellRow < FOREST_TILE_CELLS; cellRow++) {
    for (let cellColumn = 0; cellColumn < FOREST_TILE_CELLS; cellColumn++) {
      const globalRow = descriptor.row * FOREST_TILE_CELLS + cellRow;
      const globalColumn = descriptor.column * FOREST_TILE_CELLS + cellColumn;
      const jitterLatitude = 0.12 + hash(globalColumn, globalRow, 711) * 0.76;
      const jitterLongitude = 0.12 + hash(globalColumn, globalRow, 752) * 0.76;
      const latitude = -HALF_PI + (descriptor.row + (cellRow + jitterLatitude) / FOREST_TILE_CELLS) * ROW_SIZE;
      const longitude = -Math.PI + (descriptor.column + (cellColumn + jitterLongitude) / FOREST_TILE_CELLS) * descriptor.columnSize;
      const cosLatitude = Math.cos(latitude);
      const x = cosLatitude * Math.sin(longitude);
      const y = Math.sin(latitude);
      const z = cosLatitude * Math.cos(longitude);
      if (Math.abs(y) > POLAR_LIMIT) continue;

      // Height only gates the density, so the maximum in-range probability is
      // an exact cheap rejection test before invoking the terrain generator.
      const density = forestDensity(x, y, z, 100);
      if (hash(globalColumn, globalRow, 911) > density) continue;
      const { height, rockRelief } = terrainSample(x, y, z);
      if (rockRelief > .12 || height < 12 || height > 2200 || landmarkExcludes(x,y,z,12)) continue;

      const tintA = hash(globalColumn, globalRow, 1103);
      const tintB = hash(globalColumn, globalRow, 1144);
      const size = 7 + tintA * 13;
      const width = size * (0.83 + tintB * 0.28);
      const yaw = hash(globalColumn, globalRow, 1185) * TAU;
      values.push(x, y, z, height, width, size, yaw, tintA, tintB);
    }
  }
  return { key: descriptor.key, records: new Float64Array(values) };
}
