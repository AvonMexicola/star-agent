import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createCosmicChickenLoader, createCosmicChickenGraphics, COSMIC_CHICKEN_PRINTS } from '../src/station-cosmic-chicken.js';
import { STATION_SHOPS } from '../src/station-shop.js';
import { PROMENADE_SHOPS } from '../src/station-promenade.js';

const vector = point => new THREE.Vector3(...point);
let cached;
async function asset() {
  if (!cached) cached = (async () => {
    const bytes = await readFile(new URL('../public/models/station-promenade.glb', import.meta.url));
    return new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  })();
  return cached;
}

test('the tenant fit-out gives every print a real cassette that faces into the room', async () => {
  const scene = (await asset()).scene.clone(true);
  scene.updateMatrixWorld(true);
  // The unit occupies X -13..-4.6, Z -30..-21.4. Each print must sit on a wall
  // of that room and look inward, or the artwork faces the structure.
  const room = new THREE.Box3(vector([-13.05, -8, -30.05]), vector([-4.55, -4.5, -21.35]));
  for (const { node, size, yaw } of COSMIC_CHICKEN_PRINTS) {
    const anchor = scene.getObjectByName(node);
    assert.ok(anchor, `${node} survives material batching`);
    const position = anchor.getWorldPosition(new THREE.Vector3());
    assert.ok(room.containsPoint(position), `${node} hangs inside the galley unit at ${position.toArray()}`);
    const normal = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    // A print reads only if the wall is behind it: cast back along its normal.
    const behind = new THREE.Raycaster(position.clone().addScaledVector(normal, .01), normal.clone().negate(), 0, .3);
    const hit = behind.intersectObject(scene, true)[0];
    assert.ok(hit, `${node} has a physical backing`);
    assert.equal(hit.object.material.name, 'FinishPaper', `${node} is not buried in its own frame or the wall`);
    const gap = position.clone().sub(hit.point).dot(normal);
    assert.ok(gap > 0 && gap < .02, `${node} print-to-paper clearance ${gap}`);
    // The room in front of the print must be open for the whole print height.
    const ahead = new THREE.Raycaster(position.clone().addScaledVector(normal, .05), normal, 0, 1.2);
    assert.equal(ahead.intersectObject(scene, true).length, 0, `${node} is not facing into a fixture`);
    assert.ok(size[0] > .9 && size[1] > .9, `${node} is a wall piece, not a label`);
  }
  // The two posters share a portrait aspect and the board is landscape, matching
  // the retained masters; a squashed print would be visible immediately.
  const [fore, aft, menu] = COSMIC_CHICKEN_PRINTS;
  assert.ok(Math.abs(fore.size[0] / fore.size[1] - 1122 / 1402) < .005);
  assert.ok(Math.abs(aft.size[0] / aft.size[1] - 1122 / 1402) < .005);
  assert.ok(Math.abs(menu.size[0] / menu.size[1] - 1448 / 1086) < .005);
});

test('prints become one plane each, share no collider and survive a missing image', async () => {
  const props = (await asset()).scene.clone(true);
  for (const outcome of ['ready', 'unavailable']) {
    const loader = { async loadAsync(url) {
      if (outcome === 'unavailable') throw new Error(`offline ${url}`);
      const map = new THREE.DataTexture(new Uint8Array([200, 180, 120, 255]), 1, 1);
      map.needsUpdate = true;
      return map;
    } };
    const resources = await createCosmicChickenLoader({ loader })();
    assert.deepEqual(Object.values(resources.status), [outcome, outcome, outcome]);
    const group = createCosmicChickenGraphics(props, resources);
    assert.equal(group.children.length, COSMIC_CHICKEN_PRINTS.length);
    for (const mesh of group.children) {
      assert.match(mesh.name, /^Sign_Cosmic_/, 'named so the room collider and shadow pass skip it');
      assert.equal(mesh.castShadow, false);
      assert.ok(mesh.material.map, 'a failed image still leaves a printed board');
      assert.equal(mesh.material.userData.stationFinished, true, 'the station finish must not repaint a print');
    }
    // Three prints, three materials, three draws: no per-print duplication.
    assert.equal(new Set(group.children.map(mesh => mesh.material.uuid)).size, 3);
  }
});

test('prints stay on their cassettes below a placed and rotated station', async () => {
  // The finish arrives after the station has been positioned and rebased, so
  // the kit's parent is never at the origin when the prints are hung. Reading
  // anchors back in world metres put the artwork kilometres from the room and
  // left bare paper on every board; this pins the print to its anchor in the
  // parent's own frame, whatever that frame is.
  const props = (await asset()).scene.clone(true), parent = new THREE.Group();
  parent.position.set(-416.03, -824.46, 435.35);
  parent.quaternion.set(.331, -.431, -.511, .666).normalize();
  parent.add(props);
  const map = new THREE.DataTexture(new Uint8Array([200, 180, 120, 255]), 1, 1);
  map.needsUpdate = true;
  const group = createCosmicChickenGraphics(props, await createCosmicChickenLoader({ loader: { loadAsync: async () => map } })());
  parent.add(group);
  parent.updateMatrixWorld(true);
  for (const { node, yaw } of COSMIC_CHICKEN_PRINTS) {
    const mesh = group.getObjectByName(`Sign_Cosmic_${node}`), anchor = props.getObjectByName(node);
    const gap = mesh.getWorldPosition(new THREE.Vector3()).distanceTo(anchor.getWorldPosition(new THREE.Vector3()));
    assert.ok(gap < 1e-6, `${node} is ${gap} m from its cassette`);
    // The print must still face into the room, in the room's own frame.
    const expected = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw).transformDirection(parent.matrixWorld);
    const actual = new THREE.Vector3(0, 0, 1).transformDirection(mesh.matrixWorld);
    assert.ok(actual.dot(expected) > .99999, `${node} normal follows the station`);
  }
});

test('the galley unit is branded as its tenant everywhere the player reads it', () => {
  const unit = PROMENADE_SHOPS.find(shop => shop.shopId === 'galley');
  assert.equal(unit.name, 'COSMIC CHICKEN', 'storefront fascia and interaction prompt');
  assert.equal(STATION_SHOPS.galley.name, unit.name, 'modal title agrees with the fascia');
  assert.match(STATION_SHOPS.galley.category, /COSMIC CHICKEN/);
  // The board is decoration; the catalogue stays the honest list of what a
  // purchase actually delivers, and still says what is not implemented.
  assert.match(STATION_SHOPS.galley.detail, /board menu is dine-in/i);
  assert.match(STATION_SHOPS.galley.detail, /not implemented/i);
  assert.ok(STATION_SHOPS.galley.offers.length >= 3);
});
