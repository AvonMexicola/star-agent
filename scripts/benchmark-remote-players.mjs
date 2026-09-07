/** CPU-only comparison against another checkout:
 * node scripts/benchmark-remote-players.mjs --root /path/to/checkout
 * Add --poses-only for a deterministic hash of 240 frames of complete poses.
 * Loads real meshes/rigs/clips; omits textures and GPU rendering. This is not FPS.
 */
import { readFile, realpath } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';
import { createHash } from 'node:crypto';

const rootIndex = process.argv.indexOf('--root');
const root = await realpath(rootIndex < 0 ? fileURLToPath(new URL('..', import.meta.url)) : resolve(process.argv[rootIndex + 1]));
const moduleAt = path => import(pathToFileURL(resolve(root, path)).href);
const THREE = await moduleAt('node_modules/three/build/three.module.js');
const { GLTFLoader } = await moduleAt('node_modules/three/examples/jsm/loaders/GLTFLoader.js');
const { RemotePlayers } = await moduleAt('src/multiplayer/remote-players.js');
const { applyAuthoritativePeer } = await moduleAt('src/multiplayer/client.js');
globalThis.self ||= globalThis;
globalThis.ProgressEvent ||= class { constructor(type, init) { this.type = type; Object.assign(this, init); } };

const assets = new Map();
async function loadModel(url) {
  const bytes = await readFile(resolve(root, `public${url}`));
  const length = bytes.readUInt32LE(12);
  const json = JSON.parse(bytes.subarray(20, 20 + length).toString());
  json.buffers[0].uri = `data:application/octet-stream;base64,${bytes.subarray(28 + length).toString('base64')}`;
  json.materials = (json.materials || []).map(material => ({ name: material.name, pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1] } }));
  return new Promise((done, fail) => new GLTFLoader().parse(JSON.stringify(json), '', done, fail));
}
const loader = { load(url, done, progress, fail) {
  if (!assets.has(url)) assets.set(url, loadModel(url));
  assets.get(url).then(done, fail);
} };
const sockets = JSON.parse(await readFile(resolve(root, 'public/models/props/equipment-sockets.json')));
const peers = Array.from({ length: 9 }, (_, i) => ({
  id: `${i}`, colorIndex: i, mode: 'walk', body: 'aeon', physicsFrame: 'hangar:1', physicsUp: [0, 1, 0],
  position: [25_000_000_000 + i * 3, 1.75, 0], orientation: [0, 0, 0, 1], velocity: [0, 0, 1.7],
  shipId: i % 2 ? 'nomad' : 'atlas', shipPosition: [25_000_000_100 + i * 80, 0, 0], shipOrientation: [0, 0, 0, 1],
  weapon: ['rifle-laser', 'sidearm-pistol', 'mining-laser-tool'][i % 3], health: 100, shipHealth: 100, gearProgress: 1,
}));
const scene = new THREE.Scene(), manager = new RemotePlayers(scene, { loader, sockets });
manager.sync(peers, 'self');
await Promise.all([...manager.peers.values()].map(entry => entry.character.readyPromise));
await Promise.all([...manager.assets.values()]);
await Promise.all([...manager.peers.values()].map(entry => entry.equipment.equip(entry.peer.weapon)));
const origin = new THREE.Vector3(25_000_000_000, 0, 0);
if (process.argv.includes('--poses-only')) {
  const hash = createHash('sha256');
  const vector = new THREE.Vector3(), quaternion = new THREE.Quaternion();
  const bytes = numbers => hash.update(Buffer.from(new Float64Array(numbers).buffer));
  for (let step = 0; step < 240; step++) {
    if (step % 6 === 0) {
      for (let i = 0; i < peers.length; i++) {
        const phase = step * .09 + i, mode = ['walk', 'eva', 'dead', 'flight', 'walk'][Math.floor(step / 48)];
        peers[i] = { ...peers[i], mode, health: mode === 'dead' ? 0 : 100 - i * 3,
          position: [25_000_000_000 + i * 3 + Math.sin(phase), 1.75, Math.cos(phase) * 4],
          velocity: [Math.sin(phase) * 5, 0, Math.cos(phase) * 5],
          orientation: quaternion.setFromEuler(new THREE.Euler(Math.sin(phase) * 1.5, phase, Math.sin(phase) * .1)).toArray(),
          gearProgress: (Math.sin(phase) + 1) * .5,
        };
      }
      manager.sync(peers, 'self');
      await Promise.all([...manager.peers.values()].filter(entry => entry.equipment.equipped)
        .map(entry => entry.equipment.equip(entry.equipment.equipped)));
    }
    for (const entry of manager.peers.values()) if (step % 19 === 0) manager.fire(entry.peer.id);
    origin.z = Math.sin(step * .04) * 20;
    manager.update(1 / 60, origin);
    scene.updateMatrixWorld(true);
    for (const { character, equipment, shipModel } of manager.peers.values()) {
      hash.update(character.state);
      for (const bone of character.skeleton.bones) { bytes(bone.quaternion.toArray()); bytes(bone.matrixWorld.elements); }
      character.model.traverse(node => { if (node.morphTargetInfluences) bytes(node.morphTargetInfluences); });
      if (equipment.muzzleWorldPosition(vector)) bytes(vector.toArray());
      if (equipment.muzzleWorldDirection(vector)) bytes(vector.toArray());
      shipModel.traverse(node => bytes(node.matrixWorld.elements));
    }
  }
  console.log(JSON.stringify({ root, frames: 240, peers: peers.length, poseHash: hash.digest('hex') }, null, 2));
  manager.dispose();
  process.exit(0);
}
let frame = 0;
function animate() {
  if (frame % 6 === 0) {
    for (let i = 0; i < peers.length; i++) {
      peers[i] = { ...peers[i], position: [25_000_000_000 + i * 3, 1.75, Math.sin(frame * .002) * 4] };
    }
    manager.sync(peers, 'self');
  }
  origin.z = Math.sin(frame++ * .003) * 7;
  manager.update(1 / 60, origin);
  scene.updateMatrixWorld(true);
}
function stats(samples, units) {
  const sorted = [...samples].sort((a, b) => a - b);
  return { median: sorted[Math.floor(sorted.length / 2)], p95: sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * .95))], units, samples };
}
function measure(operation, iterations, rounds = 9) {
  for (let i = 0; i < iterations; i++) operation();
  const samples = [];
  for (let round = 0; round < rounds; round++) {
    const start = performance.now();
    for (let i = 0; i < iterations; i++) operation();
    samples.push((performance.now() - start) / iterations);
  }
  return stats(samples, 'milliseconds per operation; samples are batch means');
}
const remoteFrame = measure(animate, 600);
let compositions = 0;
const originalCompose = THREE.Matrix4.prototype.compose;
THREE.Matrix4.prototype.compose = function (...args) { compositions++; return originalCompose.apply(this, args); };
try { animate(); } finally { THREE.Matrix4.prototype.compose = originalCompose; }

const shipRoots = [...manager.peers.values()].map(entry => entry.ship);
const hullTransforms = measure(() => {
  for (const ship of shipRoots) { ship.position.z += .01; ship.updateMatrixWorld(true); }
}, 2000);
const nav = { mode: 'walk', keys: new Set() };
const own = { ...peers[0], angularVelocity: [0, 0, 0], parkedShipPosition: peers[0].shipPosition, shipVelocity: [1, 2, 3], shipAngularVelocity: [0, 0, 0] };
applyAuthoritativePeer(nav, own, { snap: true });
const reconciliation = measure(() => applyAuthoritativePeer(nav, own), 100_000);
console.log(JSON.stringify({ root, node: process.version, remotePlayers: peers.length,
  method: 'CPU only: 60 Hz animation, 10 Hz snapshots, complete real rigs/tools/hulls; no textures, GPU or browser',
  remoteFrame, frameMatrixCompositions: compositions, hullTransforms, reconciliation,
}, null, 2));
manager.dispose();
