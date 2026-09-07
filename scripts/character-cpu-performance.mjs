/**
 * CPU-only baseline/candidate comparison on the shipped expedition rig.
 * node scripts/character-cpu-performance.mjs --baseline .performance-baseline/src \
 *   --baseline-label 4706d62 --output docs/qa/player-performance/character-cpu.json
 *
 * --baseline is a source directory containing character.js and character-ik.js;
 * its imports must resolve the same installed Three.js version. The fixture uses
 * current GLB geometry/animations with textures omitted. This does not measure FPS.
 */
import { performance } from 'node:perf_hooks';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { cpus } from 'node:os';
import * as THREE from 'three';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { Character as After } from '../src/character.js';
import { solveArm as solveAfter } from '../src/character-ik.js';
import { loadAsset } from '../tests/avatar-fixture.js';

const argument = name => {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
};
const baseline = argument('--baseline');
if (!baseline) throw new Error('Pass --baseline with a source directory containing the original character.js and character-ik.js.');
const baselinePath = resolve(baseline);
const { Character: Before } = await import(pathToFileURL(resolve(baselinePath, 'character.js')).href);
const { solveArm: solveBefore } = await import(pathToFileURL(resolve(baselinePath, 'character-ik.js')).href);

const gltf = await loadAsset('/models/props/player-expedition.glb');
const fixture = async Class => {
  const character = new Class(new THREE.Scene(), {
    placeholder: false,
    loader: { load(url, ready) { ready({ ...gltf, scene: clone(gltf.scene) }); } },
  });
  await character.readyPromise;
  return character;
};
const cases = [
  { speed: 0, health: 1 }, { speed: .6 }, { speed: 1.4 }, { speed: 4.5 },
  { speed: 4.5, aiming: 'rifle' }, { speed: 1.4, aiming: 'pistol' }, { speed: 0, aiming: 'tool' },
  { speed: 2, carrying: true }, { speed: 1, crouching: true }, { speed: 0, seated: true },
  { speed: 0, seated: false }, { speed: 0, climbing: true, climbSpeed: .344 },
  { speed: 0, climbing: true, climbSpeed: -.344 }, { speed: 0, resting: true },
  { speed: 0, aiming: 'rifle', firing: true }, { speed: 0, aiming: 'rifle', firing: false },
  { speed: 0, dead: true }, { speed: 0, health: 1 },
];
const before = await fixture(Before), after = await fixture(After);
let nodes = 0, skinned = 0;
before.model.traverse(node => { nodes++; if (node.isSkinnedMesh) skinned++; });
for (let frame = 0; frame < cases.length * 180; frame++) {
  const input = cases[Math.floor(frame / 180)], dt = frame % 119 === 0 ? 0 : 1 / 60;
  before.update(dt, input); after.update(dt, input);
  assert.equal(after.state, before.state);
  assert.equal(after.transition, before.transition);
  assert.deepEqual(after.weights, before.weights);
  for (const key of before._keys) {
    const a = after.actions[key], b = before.actions[key];
    assert.equal(a.time, b.time, key + ' phase');
    assert.equal(a.getEffectiveTimeScale(), b.getEffectiveTimeScale(), key + ' cadence');
  }
  const aNodes = [], bNodes = [];
  before.model.traverse(node => aNodes.push(node));
  after.model.traverse(node => bNodes.push(node));
  for (let i = 0; i < aNodes.length; i++) {
    assert.deepEqual(bNodes[i].quaternion.toArray(), aNodes[i].quaternion.toArray());
    assert.deepEqual(bNodes[i].position.toArray(), aNodes[i].position.toArray());
    assert.deepEqual(bNodes[i].scale.toArray(), aNodes[i].scale.toArray());
    assert.deepEqual(bNodes[i].morphTargetInfluences, aNodes[i].morphTargetInfluences);
  }
}
const run = (characters, iterations) => {
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    for (const character of characters) character.update(1 / 60, cases[Math.floor(i / 180) % 9]);
  }
  return performance.now() - start;
};
const median = samples => [...samples].sort((a, b) => a - b)[Math.floor(samples.length / 2)];
const manyBefore = await Promise.all(Array.from({ length: 10 }, () => fixture(Before)));
const manyAfter = await Promise.all(Array.from({ length: 10 }, () => fixture(After)));
run(manyBefore, 2000); run(manyAfter, 2000);
const oldTimes = [], newTimes = [];
for (let sample = 0; sample < 9; sample++) {
  if (sample % 2) {
    newTimes.push(run(manyAfter, 1800)); oldTimes.push(run(manyBefore, 1800));
  } else {
    oldTimes.push(run(manyBefore, 1800)); newTimes.push(run(manyAfter, 1800));
  }
}
const oldHand = before.model.getObjectByName('RightHand'), newHand = after.model.getObjectByName('RightHand');
const target = new THREE.Vector3(.2, 1.4, -.4), pole = new THREE.Vector3(.6, -.8, .15);
const ikRun = (hand, solve, iterations) => {
  const start = performance.now();
  for (let i = 0; i < iterations; i++) solve(null, hand, target, pole);
  return performance.now() - start;
};
ikRun(oldHand, solveBefore, 5000); ikRun(newHand, solveAfter, 5000);
const oldIK = [], newIK = [];
for (let sample = 0; sample < 9; sample++) {
  if (sample % 2) {
    newIK.push(ikRun(newHand, solveAfter, 10000)); oldIK.push(ikRun(oldHand, solveBefore, 10000));
  } else {
    oldIK.push(ikRun(oldHand, solveBefore, 10000)); newIK.push(ikRun(newHand, solveAfter, 10000));
  }
}
const result = {
  timestamp: new Date().toISOString(),
  baseline: argument('--baseline-label') || baseline,
  node: process.version,
  cpu: cpus()[0]?.model,
  method: 'CPU only, one process, alternating baseline/candidate batches after warmup; real expedition rig without textures or rendering. This is not game FPS.',
  rig: { nodes, skinned },
  poseParity: {
    frames: cases.length * 180, cases: cases.length,
    comparison: 'Exact action phases, weights and playback rates; all node positions, quaternions, scales and morph weights',
  },
  characters: {
    count: 10, framesPerSample: 1800, samples: 9,
    beforeMs: oldTimes, afterMs: newTimes,
    beforeMedianMs: median(oldTimes), afterMedianMs: median(newTimes),
    improvementPercent: 100 * (1 - median(newTimes) / median(oldTimes)),
  },
  ik: {
    solvesPerSample: 10000, samples: 9,
    beforeMs: oldIK, afterMs: newIK,
    beforeMedianMs: median(oldIK), afterMedianMs: median(newIK),
    improvementPercent: 100 * (1 - median(newIK) / median(oldIK)),
    eliminatedThreeObjectsPerSolve: 12,
  },
};
const json = JSON.stringify(result, null, 2) + '\n';
const output = argument('--output');
if (output) {
  const path = resolve(output);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, json);
}
console.log(json);
for (const character of [before, after, ...manyBefore, ...manyAfter]) character.dispose();
