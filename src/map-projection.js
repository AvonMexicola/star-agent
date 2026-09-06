import { Vector3 } from 'three';

const WORLD_UP = new Vector3(0, 1, 0);
const FALLBACK_RIGHT = new Vector3(1, 0, 0);
const FALLBACK_UP = new Vector3(0, 0, 1);
const MIN_ZOOM = .5;
const MAX_ZOOM = 32;

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

function coordinate(value, label) {
  let result;
  if (value?.isVector3) result = value.clone();
  else if ((Array.isArray(value) || ArrayBuffer.isView(value)) && value.length >= 3)
    result = new Vector3(value[0], value[1], value[2]);
  else throw new TypeError(`${label} must be a Vector3 or [x, y, z].`);
  if (![result.x, result.y, result.z].every(Number.isFinite))
    throw new RangeError(`${label} must contain finite coordinates.`);
  return result;
}

function positionList(positions) {
  if (positions == null) return [];
  if (positions?.isVector3 || ((Array.isArray(positions) || ArrayBuffer.isView(positions))
    && positions.length >= 3 && [positions[0], positions[1], positions[2]].every(Number.isFinite)))
    return [coordinate(positions, 'Map position')];
  if (!Array.isArray(positions)) throw new TypeError('Map positions must be coordinates or an array of coordinates.');
  return positions.map((position, index) => coordinate(position, `Map position ${index}`));
}

function targetList(targets) {
  if (!Array.isArray(targets)) throw new TypeError('Map targets must be an array.');
  return targets.map((target, index) => {
    if (!target) throw new TypeError(`Map target ${index} is required.`);
    const radius = target.exclusionRadius ?? target.radius ?? 0;
    if (!Number.isFinite(radius) || radius < 0)
      throw new RangeError(`Map target ${index} exclusion radius must be finite and nonnegative.`);
    return { id: target.id, center: coordinate(target.center, `Map target ${index} center`), radius };
  });
}

function chartFrame(targets) {
  const aeon = targets.find(target => target.id === 'aeon');
  const selene = targets.find(target => target.id === 'selene');
  const anchor = (aeon ?? targets[0])?.center.clone() ?? new Vector3();
  const right = aeon && selene
    ? selene.center.clone().sub(aeon.center)
    : new Vector3();
  if (!Number.isFinite(right.lengthSq()) || right.lengthSq() < 1e-20) right.copy(FALLBACK_RIGHT);
  else right.normalize();

  const up = WORLD_UP.clone().addScaledVector(right, -WORLD_UP.dot(right));
  if (!Number.isFinite(up.lengthSq()) || up.lengthSq() < 1e-20) {
    up.copy(FALLBACK_UP).addScaledVector(right, -FALLBACK_UP.dot(right));
    if (up.lengthSq() < 1e-20) up.set(1, 0, 0).addScaledVector(right, -right.x);
  }
  up.normalize();
  const normal = new Vector3().crossVectors(right, up).normalize();
  return { anchor, right, up, normal };
}

function niceScaleBar(metresPerPixel, availableWidth) {
  const wantedPixels = clamp(availableWidth * .2, 48, 120);
  const wantedMetres = metresPerPixel * wantedPixels;
  const magnitude = 10 ** Math.floor(Math.log10(wantedMetres));
  const choices = [1, 2, 5, 10].map(step => step * magnitude).filter(Number.isFinite);
  const metres = choices.reduce((best, value) =>
    Math.abs(Math.log(value / wantedMetres)) < Math.abs(Math.log(best / wantedMetres)) ? value : best,
  choices[0] ?? wantedMetres);
  return Object.freeze({ pixels: metres / metresPerPixel, metres });
}

/**
 * Construct a deterministic orthographic chart for system-navigation positions.
 * Inputs remain in JavaScript doubles; projection subtracts a nearby target anchor
 * before taking dot products so a shared world-origin shift does not disturb the map.
 */
export function createMapProjection({
  targets = [], positions = [], width = 640, height = 440, padding = 64, focus = null, zoom = 1,
} = {}) {
  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0)
    throw new RangeError('Map width and height must be finite and positive.');
  if (!Number.isFinite(padding) || padding < 0) throw new RangeError('Map padding must be finite and nonnegative.');
  const safePadding = Math.min(padding, Math.max(0, Math.min(width, height) / 2 - .5));
  const availableWidth = Math.max(1, width - safePadding * 2);
  const availableHeight = Math.max(1, height - safePadding * 2);
  const safeZoom = clamp(Number.isFinite(zoom) ? zoom : 1, MIN_ZOOM, MAX_ZOOM);
  const mapTargets = targetList(targets);
  const mapPositions = positionList(positions);
  const frame = chartFrame(mapTargets);
  const components = point => {
    const local = point.clone().sub(frame.anchor);
    return { u: local.dot(frame.right), v: local.dot(frame.up), depth: local.dot(frame.normal) };
  };

  let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
  const include = ({ u, v }, radius = 0) => {
    minU = Math.min(minU, u - radius); maxU = Math.max(maxU, u + radius);
    minV = Math.min(minV, v - radius); maxV = Math.max(maxV, v + radius);
  };
  for (const target of mapTargets) include(components(target.center), target.radius);
  for (const position of mapPositions) include(components(position));
  if (minU === Infinity) minU = maxU = minV = maxV = 0;

  const spanU = maxU - minU, spanV = maxV - minV;
  if (![spanU, spanV].every(Number.isFinite)) throw new RangeError('Map bounds exceed the supported coordinate range.');
  const fitMetresPerPixel = Math.max(spanU / availableWidth, spanV / availableHeight);
  const metresPerPixel = (fitMetresPerPixel > 0 ? fitMetresPerPixel : 1) / safeZoom;
  const fittedU = minU / 2 + maxU / 2;
  const fittedV = minV / 2 + maxV / 2;
  const focusComponents = focus == null ? null : components(coordinate(focus, 'Map focus'));
  const centerU = focusComponents?.u ?? fittedU;
  const centerV = focusComponents?.v ?? fittedV;

  const project = value => {
    const point = components(coordinate(value, 'Projected position'));
    return {
      x: width / 2 + (point.u - centerU) / metresPerPixel,
      y: height / 2 - (point.v - centerV) / metresPerPixel,
      depth: point.depth,
    };
  };

  return Object.freeze({
    project,
    metersPerPixel: metresPerPixel,
    scaleBar: niceScaleBar(metresPerPixel, availableWidth),
    zoom: safeZoom,
  });
}

