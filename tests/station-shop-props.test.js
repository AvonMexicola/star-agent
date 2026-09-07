import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { StationComplex } from '../src/station-complex.js';
import { createStationShopPropLoader, createStationShopProps } from '../src/station-shop-props.js';

const ROLL = 'kestrel-maintenance-roll';
const JACKET = 'watchkeep-folded-protective-jacket';
const BOTH = [ROLL, JACKET];

// These tiny fixtures exercise resource and placement contracts only. Actual
// generated asset size, topology, shading and visual quality require intake QA.
function fixture() {
  const map = new THREE.Texture();
  const normalMap = new THREE.Texture();
  const material = new THREE.MeshStandardMaterial({ map, normalMap, roughness: .87 });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(.2, .1, .3), material);
  mesh.name = 'Generated_Detail_Sign_jacket';
  mesh.position.set(.01, .05, -.02);
  const scene = new THREE.Group();
  scene.add(mesh);
  return { scene, mesh, material, map, normalMap };
}

test('concurrent loads share one promise and wait for settled per-prop status', async () => {
  const calls = [], pending = [];
  const load = createStationShopPropLoader({ propIds: BOTH, loader: { loadAsync(url) {
    calls.push(url);
    return new Promise(resolve => pending.push(resolve));
  } } });
  const first = load(), second = load();
  assert.equal(first, second);
  assert.deepEqual(calls, [`/models/props/${ROLL}.glb`, `/models/props/${JACKET}.glb`]);
  let resolved = false;
  first.then(() => { resolved = true; });
  pending[0](fixture());
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(resolved, false, 'no final ready status while another request remains pending');
  pending[1](fixture());
  const resources = await first;
  assert.deepEqual(resources.status, { [ROLL]: 'ready', [JACKET]: 'ready' });
  assert.equal(await load(), resources);
  assert.equal(calls.length, 2);
});

test('one failed model leaves the other available and failures are cached', async () => {
  for (const failedId of [ROLL, JACKET]) {
    let calls = 0;
    const load = createStationShopPropLoader({ propIds: BOTH, loader: { loadAsync(url) {
      calls++;
      if (url.includes(failedId)) return Promise.reject(new Error('missing local GLB'));
      return Promise.resolve(fixture());
    } } });
    const resources = await load(), availableId = failedId === ROLL ? JACKET : ROLL;
    assert.deepEqual(resources.status, { [ROLL]: ROLL === failedId ? 'unavailable' : 'ready', [JACKET]: JACKET === failedId ? 'unavailable' : 'ready' });
    assert.equal(resources.scenes[failedId], undefined);
    const group = createStationShopProps(resources);
    assert.deepEqual(group.userData.shopProps, resources.status);
    assert.deepEqual(group.children.map(node => node.name), [availableId]);
    assert.equal(await load(), resources);
    assert.equal(calls, 2);
  }
});

test('synchronous loader errors and empty scenes resolve to unavailable dressing', async () => {
  const load = createStationShopPropLoader({ propIds: BOTH, loader: { loadAsync(url) {
    if (url.includes(ROLL)) throw new Error('loader setup failed');
    return { scene: new THREE.Group() };
  } } });
  const resources = await load();
  assert.deepEqual(resources.status, { [ROLL]: 'unavailable', [JACKET]: 'unavailable' });
  assert.equal(createStationShopProps(resources).children.length, 0);
});

test('attachments keep metre-local placements and independent nodes with shared PBR resources', async () => {
  const assets = [fixture(), fixture()];
  let index = 0;
  const load = createStationShopPropLoader({ propIds: BOTH, loader: { async loadAsync() { return assets[index++]; } } });
  const resources = await load(), first = createStationShopProps(resources), second = createStationShopProps(resources);
  const hub = new THREE.Group();
  hub.position.set(320, 170, -420);
  hub.rotation.set(.2, -.7, .1);
  hub.add(first);
  hub.updateMatrixWorld(true);
  for (const [i, id, position] of [[0, ROLL, [12.04, -6.908, -.25]], [1, JACKET, [-12.04, -6.908, -.25]]]) {
    const placement = first.getObjectByName(id), otherPlacement = second.getObjectByName(id);
    assert.deepEqual(placement.position.toArray(), position);
    const expectedWorld = hub.localToWorld(new THREE.Vector3(...position));
    assert.ok(placement.getWorldPosition(new THREE.Vector3()).distanceTo(expectedWorld) < 1e-10);
    const mesh = placement.children[0].children[0], otherMesh = otherPlacement.children[0].children[0];
    assert.notEqual(mesh, assets[i].mesh);
    assert.notEqual(mesh, otherMesh);
    assert.equal(mesh.geometry, otherMesh.geometry);
    assert.equal(mesh.geometry, assets[i].mesh.geometry);
    assert.equal(mesh.material, assets[i].material);
    assert.equal(mesh.material, otherMesh.material);
    assert.equal(mesh.material.map, assets[i].map);
    assert.equal(mesh.material.normalMap, assets[i].normalMap);
    assert.equal(mesh.material.roughness, .87);
    assert.equal(mesh.material.userData.stationFinished, true);
    assert.equal(mesh.material.userData.unweathered, true);
    assert.equal(mesh.castShadow, true);
    assert.equal(mesh.receiveShadow, true);
    assert.doesNotMatch(mesh.name, /Detail|Sign_/);
    assert.equal(assets[i].mesh.name, 'Generated_Detail_Sign_jacket');
    mesh.position.x += 1;
    assert.equal(otherMesh.position.x, .01);
    assert.equal(assets[i].mesh.position.x, .01);
  }
  assert.equal(first.userData.collisionBoxes, undefined);
  assert.equal(hub.userData.collisionBoxes, undefined);
});

test('default shipped selection requests Kestrel only and does not claim the absent jacket', async () => {
  const calls = [];
  const load = createStationShopPropLoader({ loader: { async loadAsync(url) {
    calls.push(url);
    return fixture();
  } } });
  const resources = await load();
  assert.deepEqual(calls, [`/models/props/${ROLL}.glb`]);
  assert.deepEqual(resources.status, { [ROLL]: 'ready' });
  const group = createStationShopProps(resources);
  assert.deepEqual(group.children.map(node => node.name), [ROLL]);
  assert.equal(group.userData.shopProps[JACKET], undefined);
});

test('station hookup keeps optional props under the hub and a failed prop leaves the station usable', async () => {
  const parse = async name => {
    const bytes = await readFile(new URL(`../public/models/${name}.glb`, import.meta.url));
    return new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  };
  const [stationAsset, elevator] = await Promise.all([parse('station'), parse('station-elevator')]);
  for (const available of [true, false]) {
    const asset = fixture();
    const resources = await createStationShopPropLoader({ loader: { async loadAsync() {
      if (!available) throw new Error('optional local asset unavailable');
      return asset;
    } } })();
    // Exercise the actual attachment path with a controlled finish fixture.
    // Source-asset quality and browser shading remain separate intake checks.
    class FinishedStation extends StationComplex {
      async loadFinish() {
        this.finishStatus = 'ready';
        return { materials: { apply() {} }, props: { scene: new THREE.Group() },
          graphics: new THREE.Group(), concourse: { scene: new THREE.Group() },
          elevator, shopProps: resources };
      }
    }
    const station = new FinishedStation(new THREE.Scene(), {
      gltf: { scene: stationAsset.scene.clone(true), animations: stationAsset.animations },
      lod: { scene: new THREE.Group() }, finish: true,
    });
    const hubColliders = station.hub.colliders;
    await station.readyPromise;
    assert.equal(station.error, null);
    assert.equal(station.ready, true);
    assert.equal(station.finishStatus, 'ready');
    assert.equal(station.pods.length, 20);
    assert.equal(station.hub.shopProps.parent, station.hub.group);
    assert.deepEqual(station.hub.shopProps.userData.shopProps, { [ROLL]: available ? 'ready' : 'unavailable' });
    assert.equal(station.hub.shopProps.children.length, Number(available));
    assert.equal(station.hub.colliders, hubColliders, 'counter dressing does not rebuild the room collision tree');
    assert.deepEqual(station.hub.staticBoxes, [], 'props add no collision boxes');
    for (const pod of station.pods) assert.equal(pod.group.getObjectByName('Shop counter props'), undefined);
    if (available) {
      const model = station.hub.shopProps.getObjectByName(ROLL).children[0].children[0];
      assert.equal(model.material, asset.material);
      assert.equal(model.castShadow, true, 'hub finish shadow policy keeps prop contact shadows');
    }
  }
});
