import test from 'node:test';
import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';
import * as THREE from 'three';
import { parsePlanetSeed, setPlanetSeed, DEFAULT_SEED } from '../src/generation.js';
import { terrainHeight, findDestinations, generatePatch, RADIUS } from '../src/world.js';
import { Navigation } from '../src/navigation.js';

test('numeric seed links accept the full uint32 range and reject ambiguous values', () => {
  assert.equal(parsePlanetSeed(null), DEFAULT_SEED);
  for (const seed of [0, 42, 7291, 4294967295]) assert.equal(parsePlanetSeed(String(seed)), seed);
  for (const seed of ['-1', '1.5', '1e3', 'abc', '4294967296']) assert.throws(() => parsePlanetSeed(seed));
});

test('same seed reconstructs terrain and destinations, different seeds change the world', t => {
  t.after(() => setPlanetSeed(DEFAULT_SEED));
  const sample = () => [[1,0,0], [0,1,0], [0,0,1]].map(d => terrainHeight(...d));
  setPlanetSeed(42); const first = sample(), destinations = findDestinations();
  setPlanetSeed(777); assert.notDeepEqual(sample(), first);
  setPlanetSeed(42); assert.deepEqual(sample(), first); assert.deepEqual(findDestinations(), destinations);
  for (const seed of [0, 42, DEFAULT_SEED, 4294967295]) {
    setPlanetSeed(seed);
    for (const name of ['coast','forest','mountain','polar']) assert.equal(findDestinations()[name]?.length, 3, `${seed}: ${name} exists`);
  }
});

test('terrain worker uses the same seed and geometry as main-thread collision queries', async t => {
  t.after(() => setPlanetSeed(DEFAULT_SEED));
  const moduleURL = new URL('../src/terrain.worker.js', import.meta.url).href;
  const worker = new Worker(`const {parentPort}=require('node:worker_threads');
    globalThis.self={postMessage:data=>parentPort.postMessage(data)};
    import(${JSON.stringify(moduleURL)}).then(()=>parentPort.on('message',data=>self.onmessage({data})));`, { eval: true });
  t.after(() => worker.terminate());
  for (const seed of [42, 777]) {
    setPlanetSeed(seed);
    const parameters = { id: seed, seed, face: 4, level: 12, ix: 2048, iy: 2048 };
    const actual = await new Promise((resolve, reject) => {
      worker.once('message', resolve); worker.once('error', reject); worker.postMessage(parameters);
    });
    assert.equal(actual.error, undefined);
    const expected = generatePatch(parameters);
    assert.deepEqual(actual.positions, expected.positions);
    assert.deepEqual(actual.colors, expected.colors);
    assert.deepEqual(actual.heights, expected.heights);
  }
});

test('regular flight crosses the atmosphere, lands and climbs back to space without transit', t => {
  const oldDocument = globalThis.document, oldWindow = globalThis.window;
  globalThis.document = { addEventListener() {}, querySelector() { return null; }, body: { classList: { toggle() {} } } };
  globalThis.window = { addEventListener() {} };
  t.after(() => { globalThis.document = oldDocument; globalThis.window = oldWindow; });
  setPlanetSeed(DEFAULT_SEED);
  const nav = new Navigation({ addEventListener() {} }, () => {});
  const d = new THREE.Vector3(...findDestinations().forest);
  nav.position.copy(d).multiplyScalar(RADIUS + terrainHeight(...d) + 180000);
  nav.orientToward(new THREE.Vector3(), new THREE.Vector3(0,1,0));
  nav.transit = nav.orbit = () => assert.fail('continuous flight invoked a teleport');
  nav.keys.add('KeyW');
  let previous = nav.position.clone(), layers = new Set();
  for (let frame = 0; frame < 60 * 600 && nav.mode === 'flight'; frame++) {
    nav.update(1/60);
    const distance = nav.position.distanceTo(previous);
    assert.ok(distance < 3000, `continuous step: ${distance}m`);
    previous.copy(nav.position);
    for (const threshold of [70000,10000,1500,100]) if (nav.altitude < threshold) layers.add(threshold);
  }
  assert.equal(nav.mode, 'landed'); assert.equal(layers.size, 4);
  nav.keys.clear(); nav.landOrLaunch(); nav.keys.add('Space'); nav.keys.add('ShiftLeft');
  for (let frame = 0; frame < 60 * 600 && nav.altitude < 100000; frame++) nav.update(1/60);
  assert.equal(nav.mode, 'flight'); assert.ok(nav.altitude > 70000);
});

test('flight can cross between forest and coast coordinates using steering and thrust alone', t => {
  const oldDocument=globalThis.document, oldWindow=globalThis.window;
  globalThis.document={addEventListener(){},querySelector(){return null;},body:{classList:{toggle(){}}}};
  globalThis.window={addEventListener(){}};
  t.after(()=>{globalThis.document=oldDocument;globalThis.window=oldWindow;});
  setPlanetSeed(DEFAULT_SEED);
  const destinations=findDestinations(), nav=new Navigation({addEventListener(){}},()=>{});
  nav.position.set(...destinations.forest).multiplyScalar(RADIUS+100000);
  nav.transit=nav.orbit=()=>assert.fail('zone flight invoked a teleport');
  nav.keys.add('KeyW');nav.keys.add('ShiftLeft');
  const target=new THREE.Vector3(...destinations.coast);
  let angle=Infinity;
  for(let frame=0;frame<60*120;frame++){
    const normal=nav.normal;
    angle=normal.angleTo(target);
    if(angle<.001)break;
    // A small look-ahead follows the globe, like a pilot steering toward the
    // bearing. Position is changed only by Navigation.update and its thrust.
    const lookAhead=normal.clone().lerp(target,Math.min(.04,.004/angle)).normalize().multiplyScalar(RADIUS+100000);
    nav.orientToward(lookAhead,normal);
    const before=nav.position.clone();nav.update(1/60);
    assert.ok(nav.position.distanceTo(before)<10000);
    assert.equal(nav.mode,'flight');assert.ok(nav.altitude>70000);
  }
  assert.ok(angle<.001,'arrived above coast coordinates through continuous flight');
});
