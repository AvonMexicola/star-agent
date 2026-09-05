import * as THREE from 'three';

export const WATER_SCALES = Object.freeze([1.7, 8.3, 37, 173, 6100]);

const rotation = new THREE.Matrix3().setFromMatrix4(
  new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(.63, 1.17, .29)),
);
Object.freeze(rotation.elements);
export const WATER_ROTATION = Object.freeze(rotation);

export const WATER_ADVECTION = Object.freeze([
  Object.freeze([.12, .03, .07]),
  Object.freeze([-.21, .04, .15]),
  Object.freeze([.35, .09, -.28]),
  Object.freeze([.65, -.07, .3]),
  Object.freeze([0, 0, 0]),
]);

const COMPONENTS = WATER_SCALES.length * 3;
// WebGL uploads Matrix3 uniforms as Float32. Use those exact coefficients for
// the double-precision CPU anchor so origin and camera-relative terms cancel.
const ROTATION_ELEMENTS = Array.from(WATER_ROTATION.elements, Math.fround);

export function createWaterAnchors() {
  return {
    cells: new Int32Array(COMPONENTS),
    fractions: new Float32Array(COMPONENTS),
  };
}

function validateOutput(out) {
  if (!out || !(out.cells instanceof Int32Array) || out.cells.length !== COMPONENTS ||
      !(out.fractions instanceof Float32Array) || out.fractions.length !== COMPONENTS) {
    throw new TypeError(`Water anchors require Int32Array and Float32Array buffers of length ${COMPONENTS}.`);
  }
}

function rotatedComponent(axis, x, y, z) {
  const e = ROTATION_ELEMENTS;
  return e[axis] * x + e[axis + 3] * y + e[axis + 6] * z;
}

function coordinate(layer, axis, rotated, time) {
  return (rotated + WATER_ADVECTION[layer][axis] * time) / WATER_SCALES[layer];
}

/**
 * Split planet-anchored water coordinates into signed hash cells and small
 * fractions. The result depends only on the supplied world origin and time.
 */
export function updateWaterAnchors(out, origin, time = 0) {
  validateOutput(out);
  if (!origin?.isVector3 || !Number.isFinite(origin.x) || !Number.isFinite(origin.y) ||
      !Number.isFinite(origin.z) || !Number.isFinite(time)) {
    throw new RangeError('Water origin and time must contain finite numbers.');
  }

  const x = origin.x, y = origin.y, z = origin.z;
  const rx = rotatedComponent(0, x, y, z);
  const ry = rotatedComponent(1, x, y, z);
  const rz = rotatedComponent(2, x, y, z);
  if (!Number.isFinite(rx) || !Number.isFinite(ry) || !Number.isFinite(rz)) {
    throw new RangeError('Rotated water origin must remain finite.');
  }

  // Validate every derived coordinate before changing either output buffer.
  for (let layer = 0; layer < WATER_SCALES.length; layer++) {
    if (!Number.isFinite(coordinate(layer, 0, rx, time)) ||
        !Number.isFinite(coordinate(layer, 1, ry, time)) ||
        !Number.isFinite(coordinate(layer, 2, rz, time))) {
      throw new RangeError('Water coordinates must remain finite.');
    }
  }

  for (let layer = 0; layer < WATER_SCALES.length; layer++) {
    for (let axis = 0; axis < 3; axis++) {
      const index = layer * 3 + axis;
      const value = coordinate(layer, axis, axis === 0 ? rx : axis === 1 ? ry : rz, time);
      let cell = Math.floor(value);
      let fraction = Math.fround(value - cell);
      // Float32 can round a value immediately below a boundary to 1. Keep the
      // split canonical so shader-side floor/fract reconstruction stays exact.
      if (fraction >= 1) {
        cell += 1;
        fraction = 0;
      }
      out.cells[index] = cell;
      out.fractions[index] = fraction;
    }
  }
  return out;
}
