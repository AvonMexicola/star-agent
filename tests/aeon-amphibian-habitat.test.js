import test from 'node:test';
import assert from 'node:assert/strict';
import { RADIUS, terrainSample, biomeAt } from '../src/world.js';
import { SEED } from '../src/generation.js';
import { AEON_AMPHIBIAN_HABITAT as config, AEON_AMPHIBIAN_QA as qa, sampleAeonAmphibianHabitat as habitat,
  sampleAeonAmphibianFooting as footing, enumerateAeonAmphibianSpawns as enumerate } from '../src/fauna/aeon-amphibian-habitat.js';

const site = [0.7112427874306442, .5709, -0.4101303296854399];
const normalize = d => { const r = Math.hypot(...d); return d.map(v => v/r); };
const position = (d, clearance=0) => d.map(v => v*(RADIUS+terrainSample(...d).height+clearance));
const distance = (a,b) => Math.hypot(...a.map((v,i) => v-b[i]));

test('real seed7291 low coast site supplies stable sparse beach population', () => {
  assert.equal(SEED,7291);
  const h = habitat(site), spawns = enumerate(h.position);
  assert.equal(h.region,'COASTLAND');
  assert.ok(Math.abs(h.height-1.6659315063302085)<1e-9);
  assert.equal(spawns.length,1);
  assert.equal(spawns[0].id,qa.spawnId);
  assert.deepEqual(h.position,qa.position);
  assert.deepEqual(spawns[0].position,qa.spawnPosition);
  enumerate(position([0,1,0]), {seed:42});
  assert.deepEqual(enumerate(h.position),spawns);
  assert.deepEqual(enumerate({x:h.position[0],y:h.position[1],z:h.position[2]}),spawns);
  assert.notDeepEqual(enumerate(h.position,{seed:42}),spawns);
});

test('spawn and body footing use the same canonical floor, dry shore and world normals', () => {
  const p=position(site);
  for(const spawn of enumerate(p)) {
    const h=habitat(spawn.bodyDirection), f=footing(spawn.bodyDirection);
    assert.ok(h && f);
    assert.deepEqual(spawn.position,h.position);
    assert.deepEqual(f.position,h.position);
    const canonical=terrainSample(...spawn.bodyDirection);
    assert.equal(h.height,canonical.height);
    assert.equal(biomeAt(...spawn.bodyDirection,canonical.height),'COASTLAND');
    assert.ok(canonical.height>=config.minHeight && canonical.height<=config.maxHeight);
    assert.ok(h.slope<=config.maxSlope && f.slope<=config.maxSlope);
    assert.ok(Math.abs(Math.hypot(...spawn.position)-RADIUS-canonical.height)<1e-8);
    assert.ok(Math.abs(Math.hypot(...spawn.normal)-1)<1e-12);
    assert.ok(distance(spawn.position,p)<=config.defaultRadius);
  }
  assert.deepEqual(config.footprintRadii,[2,5]);
});

test('ocean, inland forest, polar land and high flight are excluded', () => {
  for(const d of [[1,0,0],[-1,0,0],[0,1,0],[0,0,-1]]) {
    assert.equal(habitat(d),null);
    assert.equal(footing(d),null);
    assert.deepEqual(enumerate(position(d)),[]);
  }
  for(const p of [[0,0,0],[25e9,0,0],position(site,1000)]) assert.deepEqual(enumerate(p),[]);
});

test('walking traversal preserves overlapping IDs and exact world anchors', () => {
  const p=position(site), first=enumerate(p);
  const moved=enumerate(p.map((v,i)=>v+(i===2?20:0)));
  const common=first.filter(a=>moved.some(b=>b.id===a.id));
  assert.ok(common.length);
  for(const spawn of common)assert.deepEqual(moved.find(s=>s.id===spawn.id),spawn);
  assert.deepEqual(enumerate(p),first);
});

test('negative coordinates, poles and seams have bounded allocation/sampling and valid contracts', () => {
  const directions=[site,[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1],normalize([-1,-1,-1])];
  for(const d of directions) {
    const diagnostics={}, p=position(d), spawns=enumerate(p,{radius:500,diagnostics});
    assert.ok(diagnostics.visitedCells<=config.maxVisitedCells);
    assert.ok(spawns.length<=config.maxSpawns);
    assert.equal(new Set(spawns.map(s=>s.id)).size,spawns.length);
    for(const s of spawns)assert.ok(distance(s.position,p)<=500);
  }
  for(const radius of [0,-1,501,NaN,Infinity])assert.throws(()=>enumerate(position(site),{radius}),RangeError);
  assert.throws(()=>enumerate([Infinity,0,0]),TypeError);
  assert.equal(habitat([0,0,0]),null);
  assert.equal(footing([NaN,0,0]),null);
});
