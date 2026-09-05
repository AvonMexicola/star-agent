import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  WATER_ADVECTION,
  WATER_ROTATION,
  WATER_SCALES,
  createWaterAnchors,
  updateWaterAnchors,
} from '../src/water-field.js';

const near = (actual, expected, tolerance = 1e-6) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);

function expectedSplit(value) {
  let cell = Math.floor(value);
  let fraction = Math.fround(value - cell);
  if (fraction >= 1) { cell += 1; fraction = 0; }
  return { cell: cell | 0, fraction };
}

function shaderCoordinate(anchors, layer, relativePosition) {
  const rotated = relativePosition.clone().applyMatrix3(WATER_ROTATION).multiplyScalar(1 / WATER_SCALES[layer]);
  const result = [];
  for (let axis = 0; axis < 3; axis++) {
    const local = rotated.getComponent(axis) + anchors.fractions[layer * 3 + axis];
    result.push({
      cell: (anchors.cells[layer * 3 + axis] + Math.floor(local)) | 0,
      fraction: local - Math.floor(local),
    });
  }
  return result;
}

test('water field constants define distinct scales and an orthonormal non-axis rotation', () => {
  assert.deepEqual(WATER_SCALES, [1.7, 8.3, 37, 173, 6100]);
  assert.equal(WATER_ADVECTION.length, WATER_SCALES.length);
  const e = WATER_ROTATION.elements;
  const columns = [0, 1, 2].map(column => new THREE.Vector3(e[column * 3], e[column * 3 + 1], e[column * 3 + 2]));
  for (const column of columns) near(column.length(), 1, 1e-12);
  near(columns[0].dot(columns[1]), 0, 1e-12);
  near(columns[0].dot(columns[2]), 0, 1e-12);
  near(columns[1].dot(columns[2]), 0, 1e-12);
  near(WATER_ROTATION.determinant(), 1, 1e-12);
  assert.ok(columns.every(column => Math.max(Math.abs(column.x), Math.abs(column.y), Math.abs(column.z)) < .99));
});

test('anchor updates are deterministic, fresh, and do not mutate their inputs', () => {
  const origin = new THREE.Vector3(-1834.25, 917.125, -41.75);
  const originalOrigin = origin.clone(), originalRotation = WATER_ROTATION.clone();
  const first = createWaterAnchors(), second = createWaterAnchors();
  assert.notEqual(first.cells, second.cells);
  assert.notEqual(first.fractions, second.fractions);
  assert.equal(updateWaterAnchors(first, origin, 123.5), first);
  updateWaterAnchors(second, origin, 123.5);
  assert.deepEqual(first.cells, second.cells);
  assert.deepEqual(first.fractions, second.fractions);
  assert.ok(origin.equals(originalOrigin));
  assert.deepEqual(WATER_ROTATION.elements, originalRotation.elements);
  first.cells.fill(123); first.fractions.fill(.5);
  const fresh = createWaterAnchors();
  assert.deepEqual(fresh.cells, new Int32Array(15));
  assert.deepEqual(fresh.fractions, new Float32Array(15));
});

test('every layer matches an independent integer and fraction split for negative coordinates', () => {
  const origin = new THREE.Vector3(-712.75, 91.125, -301.5);
  const time = -37.25;
  const rotated = origin.clone().applyMatrix3(WATER_ROTATION);
  const anchors = updateWaterAnchors(createWaterAnchors(), origin, time);
  for (let layer = 0; layer < WATER_SCALES.length; layer++) {
    for (let axis = 0; axis < 3; axis++) {
      const value = (rotated.getComponent(axis) + WATER_ADVECTION[layer][axis] * time) / WATER_SCALES[layer];
      const expected = expectedSplit(value), index = layer * 3 + axis;
      assert.equal(anchors.cells[index], expected.cell);
      assert.equal(anchors.fractions[index], expected.fraction);
      assert.ok(anchors.fractions[index] >= 0 && anchors.fractions[index] < 1);
    }
  }
});

test('shader reconstruction is stable across a camera-origin cell boundary', () => {
  const scale = WATER_SCALES[0];
  const inverse = WATER_ROTATION.clone().transpose();
  const originA = new THREE.Vector3(10.99 * scale, -3.2 * scale, .4 * scale).applyMatrix3(inverse);
  const originB = new THREE.Vector3(11.01 * scale, -3.2 * scale, .4 * scale).applyMatrix3(inverse);
  const worldPoint = new THREE.Vector3(13.375 * scale, -1.75 * scale, 2.125 * scale).applyMatrix3(inverse);
  const anchorsA = updateWaterAnchors(createWaterAnchors(), originA);
  const anchorsB = updateWaterAnchors(createWaterAnchors(), originB);
  assert.notEqual(anchorsA.cells[0], anchorsB.cells[0], 'camera origin crosses the rotated cell boundary');
  const sampleA = shaderCoordinate(anchorsA, 0, worldPoint.clone().sub(originA));
  const sampleB = shaderCoordinate(anchorsB, 0, worldPoint.clone().sub(originB));
  for (let axis = 0; axis < 3; axis++) {
    assert.equal(sampleA[axis].cell, sampleB[axis].cell);
    near(sampleA[axis].fraction, sampleB[axis].fraction, 1e-6);
  }
});

test('centimetre camera shifts at large world coordinates preserve a fixed water sample', () => {
  const originA = new THREE.Vector3(25_000_000_000.125, -18_000_000_000.25, 9_000_000_000.5);
  const originB = originA.clone().add(new THREE.Vector3(.01, -.02, .015));
  const worldPoint = originA.clone().add(new THREE.Vector3(11.25, -7.5, 3.75));
  const anchorsA = updateWaterAnchors(createWaterAnchors(), originA, 86400.25);
  const anchorsB = updateWaterAnchors(createWaterAnchors(), originB, 86400.25);
  assert.notDeepEqual(anchorsA.fractions, anchorsB.fractions, 'centimetre origin motion remains represented');
  for (let layer = 0; layer < WATER_SCALES.length; layer++) {
    const sampleA = shaderCoordinate(anchorsA, layer, worldPoint.clone().sub(originA));
    const sampleB = shaderCoordinate(anchorsB, layer, worldPoint.clone().sub(originB));
    for (let axis = 0; axis < 3; axis++) {
      assert.equal(sampleA[axis].cell, sampleB[axis].cell, `layer ${layer} axis ${axis} hash cell`);
      near(sampleA[axis].fraction, sampleB[axis].fraction, 4e-6);
    }
  }
});

test('long-time advection remains finite, repeatable, and leaves the static swell fixed', () => {
  const origin = new THREE.Vector3(-2_100_000, 870_000, 4_300_000);
  const time = 20 * 365.25 * 86400;
  const first = updateWaterAnchors(createWaterAnchors(), origin, time);
  const repeat = updateWaterAnchors(createWaterAnchors(), origin, time);
  const later = updateWaterAnchors(createWaterAnchors(), origin, time + .5);
  assert.deepEqual(first.cells, repeat.cells);
  assert.deepEqual(first.fractions, repeat.fractions);
  assert.notDeepEqual(first.fractions.slice(0, 12), later.fractions.slice(0, 12));
  assert.deepEqual(first.cells.slice(12), later.cells.slice(12));
  assert.deepEqual(first.fractions.slice(12), later.fractions.slice(12));
  for (const fraction of later.fractions) assert.ok(Number.isFinite(fraction) && fraction >= 0 && fraction < 1);
});

test('invalid inputs fail before changing existing anchor buffers', () => {
  const anchors = createWaterAnchors();
  anchors.cells.fill(-73); anchors.fractions.fill(.375);
  const cells = anchors.cells.slice(), fractions = anchors.fractions.slice();
  for (const origin of [
    new THREE.Vector3(NaN, 0, 0),
    new THREE.Vector3(0, Infinity, 0),
    new THREE.Vector3(Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE),
  ]) assert.throws(() => updateWaterAnchors(anchors, origin), RangeError);
  assert.throws(() => updateWaterAnchors(anchors, new THREE.Vector3(), Infinity), RangeError);
  assert.throws(() => updateWaterAnchors({ cells: new Int32Array(14), fractions: new Float32Array(15) }, new THREE.Vector3()), TypeError);
  assert.deepEqual(anchors.cells, cells);
  assert.deepEqual(anchors.fractions, fractions);
});
