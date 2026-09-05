import test from 'node:test';
import assert from 'node:assert/strict';
import { TREE_LODS, TREE_REBUILD_DISTANCE, treeLodCoverage, treeLodIncludes } from '../src/tree-lod.js';
import { createBranchGeometry } from '../src/foliage.js';
import { Vegetation } from '../src/vegetation.js';
import { findDestinations, RADIUS } from '../src/world.js';
import * as THREE from 'three';

test('adjacent tree representations cover the full approach without gaps or double density', () => {
  for (let distance = 0; distance <= 1200; distance += .5) {
    const coverage = TREE_LODS.reduce((sum, _, level) => sum + treeLodCoverage(distance, level), 0);
    assert.ok(Math.abs(coverage-1) < 1e-10, `coverage at ${distance} m: ${coverage}`);
  }
  assert.equal(treeLodCoverage(1400, 2), 0);
});

test('CPU LOD assignment retains every representation needed before the next rebuild', () => {
  for (let previous = 0; previous <= 1450; previous += 5) for (const movement of [-TREE_REBUILD_DISTANCE, 0, TREE_REBUILD_DISTANCE]) {
    const current = Math.max(0, previous + movement);
    for (let level = 0; level < 3; level++) if (treeLodCoverage(current, level) > 0) assert.ok(treeLodIncludes(previous, level));
  }
});

test('middle tree LOD substantially reduces geometry', () => {
  const near = createBranchGeometry(), mid = createBranchGeometry(true);
  assert.ok(mid.attributes.position.count < near.attributes.position.count / 3);
  near.dispose(); mid.dispose();
});

test('moving the vegetation origin preserves shared tree lattice positions and random values', () => {
  const center = new THREE.Vector3(...findDestinations().forest), shifted = center.clone().addScaledVector(new THREE.Vector3(1,0,0), 40/RADIUS).normalize();
  const sample = direction => {
    const records = new Map();
    Vegetation.prototype.scatter(direction, 200, 12, 711, (x,y,z,col,row,a,b) => records.set(`${col}/${row}`, [x,y,z,a,b]));
    return records;
  };
  const first = sample(center), next = sample(shifted); let shared = 0;
  for (const [key,value] of first) if (next.has(key)) { assert.deepEqual(next.get(key), value); shared++; }
  assert.ok(shared > first.size*.7);
});
