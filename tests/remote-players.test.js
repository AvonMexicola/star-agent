import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { cloneCharacterGLTF, tintCharacterSuit, RemotePlayers, PLAYER_COLORS, applySuitColor, SHIP_URLS } from '../src/multiplayer/remote-players.js';
import { clearEquipmentCache } from '../src/equipment.js';
import { PLAYER_AVATAR } from '../src/player-avatar.js';
import { FreighterSystems } from '../src/freighter-layout.js';
import { atlasGearPose } from '../src/atlas-mark-ii-systems.js';

// Read real rig/bones/animations and real weapon geometry without a GPU or image
// decoder. Only PBR textures are omitted; browser coverage renders the textures.
globalThis.self ||= globalThis;
globalThis.ProgressEvent ||= class ProgressEvent { constructor(type, init) { this.type = type; Object.assign(this, init); } };
async function readModel(url) {
  const bytes = await readFile(new URL(`../public${url}`, import.meta.url));
  const length = bytes.readUInt32LE(12);
  const json = JSON.parse(bytes.subarray(20, 20 + length).toString());
  const binary = bytes.subarray(28 + length);
  json.buffers[0].uri = `data:application/octet-stream;base64,${binary.toString('base64')}`;
  json.materials = (json.materials || []).map(m => ({ name: m.name, pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1] } }));
  return new Promise((resolve, reject) => new GLTFLoader().parse(JSON.stringify(json), '', resolve, reject));
}
const rig = await readModel(PLAYER_AVATAR.url);
const sockets = JSON.parse(await readFile(new URL('../public/models/props/equipment-sockets.json', import.meta.url)));
const models = new Map([[PLAYER_AVATAR.url, rig]]);
const loader = { load(url, ready, progress, error) {
  if (!models.has(url)) models.set(url, readModel(url));
  Promise.resolve(models.get(url)).then(ready, error);
} };
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);
const meshOf = root => { let found; root.traverse(n => { if (n.isSkinnedMesh) found = n; }); return found; };
const peer = (id, extra = {}) => ({
  id, colorIndex: Number(id) || 0, position: [25_000_000_000.25, 1.75, 0], orientation: [0, 0, 0, 1],
  velocity: [0, 0, 0], mode: 'walk', shipId: 'nomad', shipPosition: [25_000_000_100, 0, 0],
  shipOrientation: [0, 0, 0, 1], gearProgress: 1, powered: true,
  weapon: 'rifle-laser', aiming: true, health: 100, shipHealth: 100, ...extra,
});
async function ready(manager) {
  await Promise.all([...manager.peers.values()].map(e => e.character.readyPromise));
  await Promise.all([...manager.assets.values()]);
  await Promise.all([...manager.peers.values()].filter(e => e.peer.weapon).map(e => e.equipment.equip(e.peer.weapon)));
  await Promise.resolve();
}

test('ten server colors are distinct and clones own their skeleton/materials', () => {
  assert.equal(new Set(PLAYER_COLORS).size, 10);
  const a = cloneCharacterGLTF(rig), b = cloneCharacterGLTF(rig);
  assert.deepEqual(a.asset.extras.requiredClips, rig.asset.extras.requiredClips);
  assert.equal(a.parser, rig.parser, 'optional shadow accessors use the cached parser');
  const am = meshOf(a.scene), bm = meshOf(b.scene), original = meshOf(rig.scene);
  assert.notEqual(am.skeleton, bm.skeleton);
  assert.notEqual(am.skeleton.bones[0], bm.skeleton.bones[0]);
  assert.notEqual(am.material, bm.material);
  assert.notEqual(am.material, original.material);
  assert.equal(am.geometry, bm.geometry, 'immutable geometry remains shared');
  const before = bm.skeleton.bones[0].quaternion.clone();
  am.skeleton.bones[0].rotation.x += .3;
  assert.deepEqual(bm.skeleton.bones[0].quaternion.toArray(), before.toArray());
  tintCharacterSuit(a.scene, PLAYER_COLORS[0]);
  tintCharacterSuit(b.scene, PLAYER_COLORS[1]);
  assert.notEqual(am.material.userData.remoteSuitColor.getHex(), bm.material.userData.remoteSuitColor.getHex());
  assert.equal(original.material.userData.remoteSuitColor, undefined);
});

test('suit mask preserves the actual head and bare hands and colors the torso', () => {
  const model = cloneCharacterGLTF(rig).scene;
  tintCharacterSuit(model, '#52d6ff');
  const mesh = meshOf(model), mask = mesh.geometry.getAttribute('remoteSuitMask');
  const index = mesh.geometry.getAttribute('skinIndex'), weight = mesh.geometry.getAttribute('skinWeight');
  let bare = 0, suit = 0;
  for (let i = 0; i < index.count; i++) {
    const bone = mesh.skeleton.bones[index.getX(i)];
    if (weight.getX(i) < .99) continue;
    if (/head|hand|thumb|index|middle|ring|pinky/i.test(bone.name)) { near(mask.getX(i), 0); bare++; }
    if (/spine|upleg/i.test(bone.name)) { near(mask.getX(i), 1); suit++; }
  }
  assert.ok(bare > 100 && suit > 100, 'real mesh has preserved and recolored vertices');
  const shader = { uniforms: {}, vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader };
  mesh.material.onBeforeCompile(shader);
  assert.match(shader.vertexShader, /vRemoteSuitMask = remoteSuitMask/);
  assert.match(shader.fragmentShader, /remoteSuitColor \* sqrt/);
  assert.match(shader.fragmentShader, /remoteSuitColor \* suitEmission/, 'the GLB emissive texture must also carry the assigned suit color');
  assert.match(shader.vertexShader, /logdepthbuf_vertex/);
  assert.match(shader.fragmentShader, /logdepthbuf_fragment/);
});

test('real remote rifle/pistol/cutter sockets follow the firing hand and aim direction', async () => {
  clearEquipmentCache();
  const scene = new THREE.Scene(), manager = new RemotePlayers(scene, { loader, sockets });
  manager.sync([peer('0'), peer('1', { weapon: 'sidearm-pistol' }), peer('2', { weapon: 'mining-laser-tool' })], 'self');
  await ready(manager);
  const origin = new THREE.Vector3(25_000_000_000, 0, 0);
  for (let i = 0; i < 25; i++) manager.update(1 / 60, origin);
  for (const entry of manager.peers.values()) {
    assert.equal(entry.character.ready, true);
    assert.equal(entry.ship.userData.assetStatus, 'ready');
    const held = entry.equipment.itemObject(entry.peer.weapon);
    assert.equal(held.parent.parent.name, 'RightHand');
    const direction = entry.equipment.muzzleWorldDirection();
    assert.ok(direction.dot(new THREE.Vector3(0, 0, -1)) > .9999, `barrel must face the remote aim: ${entry.peer.weapon}`);
    const target = entry.equipment.leftHandTargetWorld();
    if (target) {
      const hand = entry.character.skeleton.bones.find(bone => bone.name === 'LeftHand');
      const palm = hand.getWorldPosition(new THREE.Vector3()).add(origin)
        .add(new THREE.Vector3(-.007, .107, 0).applyQuaternion(hand.getWorldQuaternion(new THREE.Quaternion())));
      assert.ok(palm.distanceTo(target) < .04, `support palm must reach the actual two-handed grip: ${entry.peer.weapon} ${palm.distanceTo(target)}`);
    }
    const worldSize = new THREE.Box3().setFromObject(held).getSize(new THREE.Vector3()).length();
    assert.ok(worldSize > .2 && worldSize < 2, `socket scale must compensate the 0.01 armature: ${worldSize}`);
    near(entry.character.object.position.x, .25);
    near(entry.character.object.position.y, 0);
    assert.equal(entry.equipment.vfx.visible, false);
  }
  manager.sync([peer('0', { weapon: null })], 'self');
  const remaining = manager.peers.get('0');
  assert.equal(remaining.equipment.equipped, null);
  assert.equal(remaining.equipment.itemObject('rifle-laser').parent, null);
  assert.equal(manager.peers.size, 1);
  manager.dispose();
  assert.equal(scene.children.length, 0);
});

test('full snapshots exclude self, cap remote population and remove disconnected visuals', async () => {
  clearEquipmentCache();
  const scene = new THREE.Scene(), manager = new RemotePlayers(scene, { loader, sockets });
  manager.sync(Array.from({ length: 15 }, (_, i) => peer(String(i))), '0');
  assert.equal(manager.peers.size, 9);
  assert.equal(manager.peers.has('0'), false);
  await ready(manager);
  const removed = manager.peers.get('2');
  manager.sync([peer('1', { position: [25_000_000_010.25, 1.75, 0] })], '0');
  assert.equal(removed.character.disposed, true);
  assert.equal(removed.equipment.disposed, true);
  assert.equal(removed.ship.parent, null);
  const remaining = manager.peers.get('1');
  manager.update(.05, new THREE.Vector3(25_000_000_000, 0, 0));
  assert.ok(remaining.position.x > 25_000_000_000.25 && remaining.position.x < 25_000_000_010.25);
  manager.dispose();
  manager.dispose();
  assert.equal(scene.children.length, 0);
});

test('disconnect during loading cannot add late characters or ships', async () => {
  const pending = [], scene = new THREE.Scene();
  const delayedLoader = { load(url, resolve) { pending.push(() => resolve(rig)); } };
  const manager = new RemotePlayers(scene, { loader: delayedLoader, sockets });
  manager.sync([peer('1', { weapon: null })], 'self');
  manager.sync([], 'self');
  for (const finish of pending) finish();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(scene.children.length, 0);
  manager.dispose();
});

test('disconnect releases only the instance; cached skin buffers live until manager disposal', async () => {
  clearEquipmentCache();
  let loads = 0;
  const countingLoader = { load(url, done, progress, error) {
    if (url === PLAYER_AVATAR.url) loads++;
    loader.load(url, done, progress, error);
  } };
  const manager = new RemotePlayers(new THREE.Scene(), { loader: countingLoader, sockets });
  manager.sync([peer('1'), peer('2')], 'self');
  await ready(manager);
  assert.equal(loads, 1, 'the entire roster shares one parsed character asset');
  const removed = manager.peers.get('1'), retained = manager.peers.get('2');
  const geometry = meshOf(removed.character.model).geometry;
  let geometryDisposals = 0, materialDisposals = 0;
  const onDispose = () => geometryDisposals++;
  geometry.addEventListener('dispose', onDispose);
  meshOf(removed.character.model).material.addEventListener('dispose', () => materialDisposals++);
  manager.sync([peer('2')], 'self');
  assert.equal(materialDisposals, 1);
  assert.equal(geometryDisposals, 0);
  assert.equal(retained.character.disposed, false);
  manager.update(.05, new THREE.Vector3());
  assert.equal(retained.character.skeleton.bones[0].parent !== null, true);
  manager.dispose();
  await Promise.resolve();
  assert.equal(geometryDisposals, 1);
  geometry.removeEventListener('dispose', onDispose);
});

test('real ship models retain double poses and animate the actual landing assemblies', async () => {
  clearEquipmentCache();
  const manager = new RemotePlayers(new THREE.Scene(), { loader, sockets });
  manager.sync([peer('1', { mode: 'flight', shipId: 'atlas', shipPosition: null, gearProgress: 0, weapon: null })], 'self');
  await ready(manager);
  manager.update(.05, new THREE.Vector3(25_000_000_000, 0, 0));
  const entry = manager.peers.get('1');
  assert.equal(entry.ship.userData.assetStatus, 'ready');
  assert.equal(entry.ship.visible, true);
  assert.equal(entry.character.object.visible, false);
  let meshes = 0; entry.shipModel.traverse(node => { if (node.isMesh) meshes++; });
  assert.ok(meshes > 20, 'actual authored Atlas hierarchy is loaded');
  assert.equal(entry.gears.length, 0, 'retired stretching legs are absent');
  assert.equal(entry.atlasSystems.gear.legs.length, 6);
  for (const leg of entry.atlasSystems.gear.legs) {
    near(leg.nodeObject.rotation.x, atlasGearPose(0,leg.foldSign).angle);
    near(leg.footObject.rotation.x, atlasGearPose(0,leg.foldSign).padAngle);
    near(leg.nodeObject.scale.y, 1);
  }
  manager.sync([peer('1', { shipId: 'atlas', gearProgress: 1, weapon: null })], 'self');
  manager.update(.05, new THREE.Vector3(25_000_000_000, 0, 0));
  for (const leg of entry.atlasSystems.gear.legs) near(leg.nodeObject.rotation.x,atlasGearPose(1,leg.foldSign).angle);
  assert.ok(entry.ship.position.x < 101, 'ship was made camera relative before any GPU upload');
  manager.dispose();
});

test('cached ship transforms match authored hulls exactly across origin, attitude and gear changes', async () => {
  const scene = new THREE.Scene(), manager = new RemotePlayers(scene, { loader, sockets });
  for (const shipId of ['nomad', 'atlas']) {
    manager.sync([peer('1', { shipId, mode: 'flight', weapon: null })], 'self');
    await ready(manager);
    const entry = manager.peers.get('1');
    const source = await manager.assets.get(SHIP_URLS[shipId]);
    const reference = new THREE.Group();
    reference.add(source.scene.clone(true));
    const authority=shipId==='atlas'?new FreighterSystems().bind(reference.children[0]):null;
    const expectedNodes = [], actualNodes = [], gears = [];
    reference.children[0].traverse(node => {
      expectedNodes.push(node);
      if (!node.isMesh && node.name.startsWith('LandingGear_')) gears.push(node);
    });
    entry.shipModel.traverse(node => actualNodes.push(node));
    assert.equal(actualNodes.length, expectedNodes.length);
    assert.ok(actualNodes.length > 20, 'compare the complete authored hull hierarchy');
    let compositions = 0;
    for (const node of actualNodes) {
      const update = node.updateMatrix;
      node.updateMatrix = function () { compositions++; return update.call(this); };
    }
    for (const gear of [0, .37, 1, .62, 0]) {
      const attitude = new THREE.Quaternion().setFromEuler(new THREE.Euler(gear * .6, -.7, .2));
      const origin = new THREE.Vector3(25_000_000_000 + gear * 4000, gear * 1200, -gear * 700);
      if(authority){
        authority.setGear(gear,gear>=.5);
        for(const ramp of authority.ramps){ramp.target=ramp.openAngle;ramp.moving=true;}
        authority.update(.37);
      }
      manager.sync([peer('1', { shipId, mode: 'flight', weapon: null, gearProgress: gear, freighter:authority?.snapshot,
        shipPosition: [25_000_000_050 + gear * 8, gear * 5, gear * 7], shipOrientation: attitude.toArray() })], 'self');
      compositions = 0;
      manager.update(1 / 60, origin);
      scene.updateMatrixWorld(true);
      assert.equal(compositions, actualNodes.filter(node => entry.gears.includes(node)).length,
        'Nomad changes only moving gear; Atlas mechanisms are composed at snapshot receipt');
      reference.position.copy(entry.ship.position);
      reference.quaternion.copy(entry.ship.quaternion);
      const eased = gear * gear * (3 - 2 * gear);
      for (const node of gears) node.scale.y = .08 + .92 * eased;
      reference.updateMatrixWorld(true);
      for (let i = 0; i < actualNodes.length; i++) {
        assert.deepEqual(actualNodes[i].matrixWorld.elements, expectedNodes[i].matrixWorld.elements, actualNodes[i].name);
      }
      compositions = 0;
      manager.update(1 / 60, origin);
      scene.updateMatrixWorld(true);
      assert.equal(compositions, 0, 'interpolating the hull never recomposes unchanged descendant transforms');
    }
  }
  manager.dispose();
});

test('remote snapshot inputs refresh speed, gravity and damage while preserving one-frame fire pulses', async () => {
  const manager = new RemotePlayers(new THREE.Scene(), { loader, sockets });
  manager.sync([peer('1', { weapon: null, velocity: [3, 4, 0], health: 75,
    physicsFrame: 'hangar:1', physicsUp: [2, 0, 0] })], 'self');
  await ready(manager);
  const entry = manager.peers.get('1'), inputs = [];
  entry.character.update = (dt, input) => { inputs.push({ ...input }); };
  manager.fire('1');
  manager.update(1 / 60, new THREE.Vector3());
  manager.update(1 / 60, new THREE.Vector3());
  assert.equal(inputs[0].speed, 5);
  assert.equal(inputs[0].health, .75);
  assert.equal(inputs[0].firing, true);
  assert.equal(inputs[1].firing, false);
  assert.ok(entry.character.up.distanceTo(new THREE.Vector3(1, 0, 0)) < 1e-12);
  manager.sync([peer('1', { mode: 'eva', weapon: null, velocity: [30, 40, 0], health: 50 })], 'self');
  manager.update(1 / 60, new THREE.Vector3());
  assert.equal(inputs[2].speed, 0, 'EVA continues its authored floating pose');
  assert.equal(inputs[2].health, .5);
  assert.equal(inputs[2].firing, false);
  manager.dispose();
});


test('server color applied to the local player clones materials and leaves other assets unchanged', async () => {
  const model = cloneCharacterGLTF(rig).scene;
  const source = meshOf(model).material;
  const character = { model, ready: true, disposed: false };
  await applySuitColor(character, PLAYER_COLORS[3]);
  const own = meshOf(model).material;
  assert.notEqual(own, source);
  assert.equal(source.userData.remoteSuitColor, undefined);
  await applySuitColor(character, PLAYER_COLORS[4]);
  assert.equal(meshOf(model).material, own, 'changing server assignment reuses its owned material');
  assert.equal(own.userData.remoteSuitColor.getHexString(), new THREE.Color(PLAYER_COLORS[4]).getHexString());
});

test('looking up does not tilt remote boots off the canonical planetary floor', async () => {
  clearEquipmentCache();
  const manager = new RemotePlayers(new THREE.Scene(), { loader, sockets });
  const pitch = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), .6);
  manager.sync([peer('1', { body: 'aeon', position: [0, 1_592_751.75, 0], orientation: pitch.toArray(), shipPosition: null })], 'self');
  await ready(manager);
  const origin = new THREE.Vector3(0, 1_592_750, 0);
  for (let i = 0; i < 25; i++) manager.update(1/60, origin);
  const entry = manager.peers.get('1');
  near(entry.character.object.position.y, 0);
  assert.ok(entry.character.up.dot(new THREE.Vector3(0, 1, 0)) > .9999);
  const aim = new THREE.Vector3(0, 0, -1).applyQuaternion(pitch);
  assert.ok(entry.equipment.muzzleWorldDirection().dot(aim) > .9999);
  manager.dispose();
});

test('remote boots follow the server hangar gravity away from their parked ship',async()=>{
  clearEquipmentCache();
  const manager=new RemotePlayers(new THREE.Scene(),{loader,sockets});
  const up=new THREE.Vector3(1,1,0).normalize(),eye=new THREE.Vector3(0,1_692_751.75,0);
  const attitude=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),up);
  manager.sync([peer('1',{body:'aeon',position:eye.toArray(),orientation:attitude.toArray(),shipPosition:null,physicsFrame:'hangar:2',physicsUp:up.toArray()})],'self');
  await ready(manager);
  for(let i=0;i<25;i++)manager.update(1/60,eye);
  const entry=manager.peers.get('1');
  assert.ok(entry.character.up.dot(up)>.9999);
  assert.ok(entry.character.object.position.distanceTo(up.clone().multiplyScalar(-1.75))<1e-6);
  manager.dispose();
});
