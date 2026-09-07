import test from 'node:test';
import assert from 'node:assert/strict';
import { RADIUS, terrainSample, biomeAt } from '../src/world.js';
import { SEED } from '../src/generation.js';
import { AEON_GRAZER_HABITAT as config, AEON_GRAZER_QA as qa,
  sampleAeonGrazerHabitat as habitat, sampleAeonGrazerFooting as footing,
  enumerateAeonGrazerSpawns as enumerate } from '../src/fauna/aeon-grazer-habitat.js';
import { AEON_AMPHIBIAN_QA as beach } from '../src/fauna/aeon-amphibian-habitat.js';
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
const position=(d,clearance=0)=>d.map(v=>v*(RADIUS+terrainSample(...d).height+clearance));

test('real seed7291 grassland fixture has deterministic sparse large-animal anchors',()=>{
  assert.equal(SEED,7291);
  const h=habitat(qa.direction), spawns=enumerate(h.position);
  assert.equal(h.region,'GRASSLAND');
  assert.deepEqual(h.position,qa.position);
  assert.equal(spawns.length,3);
  assert.equal(spawns[0].id,qa.spawnId);
  assert.deepEqual(spawns[0].position,qa.spawnPosition);
  enumerate(position([0,-1,0]),{seed:42});
  assert.deepEqual(enumerate(h.position),spawns);
  assert.notDeepEqual(enumerate(h.position,{seed:42}),spawns);
});

test('large spawn footprint and locomotion use the identical canonical dry floor',()=>{
  for(const spawn of enumerate(qa.position)){
    const h=habitat(spawn.bodyDirection), f=footing(spawn.bodyDirection);
    assert.ok(h&&f);
    assert.deepEqual(h.position,spawn.position);
    assert.deepEqual(f.position,h.position);
    const canonical=terrainSample(...spawn.bodyDirection);
    assert.equal(h.height,canonical.height);
    assert.equal(biomeAt(...spawn.bodyDirection,canonical.height),'GRASSLAND');
    assert.ok(h.height>=config.minHeight&&h.height<=config.maxHeight);
    assert.ok(h.slope<=config.maxSlope&&f.slope<=config.maxSlope);
    assert.ok(Math.abs(Math.hypot(...spawn.position)-RADIUS-h.height)<1e-8);
    assert.ok(Math.abs(Math.hypot(...spawn.normal)-1)<1e-12);
    assert.ok(distance(spawn.position,qa.position)<=420);
  }
  assert.deepEqual(config.footprintRadii,[3,6]);
});

test('beach amphibian site, oceans, forest, ice and remote bodies do not seed grazers',()=>{
  for(const d of [beach.direction,[1,0,0],[-1,0,0],[0,1,0],[0,0,1]]){
    assert.equal(habitat(d),null);
    assert.equal(footing(d),null);
    assert.deepEqual(enumerate(position(d)),[]);
  }
  for(const p of [[0,0,0],[25e9,0,0],position(qa.direction,1000)])assert.deepEqual(enumerate(p),[]);
});

test('revisiting and reversed walking queries preserve overlapping anchors exactly',()=>{
  const original=enumerate(qa.position);
  const moved=enumerate(qa.position.map((v,i)=>v+(i===0?30:0)));
  const common=original.filter(a=>moved.some(b=>b.id===a.id));
  assert.ok(common.length>=2);
  for(const s of common)assert.deepEqual(moved.find(a=>a.id===s.id),s);
  assert.deepEqual(enumerate(qa.position),original);
});

test('poles, negative coordinates and maximum radius stay bounded',()=>{
  for(const d of [qa.direction,[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]]){
    const diagnostics={},p=position(d),spawns=enumerate(p,{radius:500,diagnostics});
    assert.ok(diagnostics.visitedCells<=config.maxVisitedCells);
    assert.ok(spawns.length<=4);
    assert.equal(new Set(spawns.map(s=>s.id)).size,spawns.length);
    for(const s of spawns)assert.ok(distance(s.position,p)<=500);
  }
  for(const radius of [0,-1,501,Infinity,NaN])assert.throws(()=>enumerate(qa.position,{radius}),RangeError);
  assert.equal(habitat([0,0,0]),null);
  assert.equal(footing([Infinity,0,0]),null);
});
