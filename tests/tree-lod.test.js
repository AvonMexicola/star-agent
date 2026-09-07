import test from 'node:test';
import assert from 'node:assert/strict';
import { TREE_LODS, TREE_REBUILD_DISTANCE, treeLodCoverage, treeLodIncludes } from '../src/tree-lod.js';
import { createBranchGeometry, crownProfile } from '../src/foliage.js';
import { Vegetation, treeVariant } from '../src/vegetation.js';
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

test('tree species retain distinct crowns through near and middle geometry',()=>{
  const crowns=[];
  for(let variant=0;variant<3;variant++){
    const near=createBranchGeometry(false,variant),mid=createBranchGeometry(true,variant);
    near.computeBoundingBox();mid.computeBoundingBox();
    assert.ok(mid.attributes.position.count<near.attributes.position.count/3);
    assert.ok(Math.abs(near.boundingBox.max.y-mid.boundingBox.max.y)<.05);
    assert.ok(Math.abs(near.boundingBox.min.y-mid.boundingBox.min.y)<.05);
    crowns.push(crownProfile(.3,variant));near.dispose();mid.dispose();
  }
  assert.ok(crowns[1].y>crowns[0].y+.2,'pine has a visibly higher crown');
  assert.ok(crowns[2].spread>crowns[0].spread*1.5,'broadleaf crown is wider');
});

test('world cells retain species identity and cold regions favour conifers',()=>{
  const counts=[0,0,0];
  for(let row=0;row<50;row++)for(let col=0;col<30;col++){
    const variant=treeVariant(col,row,.25,500);counts[variant]++;
    assert.equal(treeVariant(col,row,.25,500),variant);
    assert.ok(treeVariant(col,row,.7,500)<2);assert.ok(treeVariant(col,row,.25,1900)<2);
  }
  assert.ok(counts.every(n=>n>200),'all three species appear in temperate stands');
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
