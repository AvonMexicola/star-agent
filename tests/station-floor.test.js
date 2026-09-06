import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

if (!globalThis.ProgressEvent) {
  globalThis.ProgressEvent = class ProgressEvent {
    constructor(type, init = {}) { this.type = type; Object.assign(this, init); }
  };
}

const MODEL_FILES = ['station.glb', 'station_lod1.glb'];
const DECK_TOP = -8;
const RAY_POINT = new THREE.Vector2(17, 12);
const EPSILON = 1e-5;

const near = (actual, expected, tolerance = EPSILON, description = 'value') =>
  assert.ok(Math.abs(actual - expected) <= tolerance,
    `${description}: ${actual} differs from ${expected} by more than ${tolerance}`);

async function loadModel(file) {
  const url = new URL(`../public/models/${file}`, import.meta.url);
  const bytes = await readFile(url);
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const gltf = await new GLTFLoader().parseAsync(buffer, '');
  gltf.scene.updateMatrixWorld(true);
  return gltf.scene;
}

for (const file of MODEL_FILES) {
  test(`${file} keeps the structural hull below the visible landing deck`, async () => {
    const scene = await loadModel(file);
    const deck = scene.getObjectByName('LandingDeck');
    const hull = scene.getObjectByName('Hull');
    const pad = scene.getObjectByName('LandingPad');
    assert.ok(deck?.isMesh, `${file} has the authored LandingDeck mesh`);
    assert.ok(hull, `${file} has the merged Hull hierarchy`);
    assert.ok(pad, `${file} has the landing pad anchor`);

    const deckBox = new THREE.Box3().setFromObject(deck);
    near(deckBox.max.y, DECK_TOP, EPSILON, `${file} deck top`);
    assert.ok(deckBox.min.y < deckBox.max.y - .1, `${file} deck retains physical thickness`);
    const padPosition = pad.getWorldPosition(new THREE.Vector3());
    near(padPosition.x, 0, EPSILON, `${file} pad x`);
    near(padPosition.y, DECK_TOP, EPSILON, `${file} pad deck height`);
    near(padPosition.z, 2, EPSILON, `${file} pad z`);

    // This point is inside the walkable deck and clear of the ship, painted
    // markings, walls, and fixtures in both authored LODs.
    const origin = new THREE.Vector3(RAY_POINT.x, deckBox.max.y + .5, RAY_POINT.y);
    const ray = new THREE.Raycaster(origin, new THREE.Vector3(0, -1, 0), 0, 10);
    const sceneHits = ray.intersectObject(scene, true);
    assert.equal(sceneHits.some(hit => hit.object.name.startsWith('DeckMarkings')), false,
      `${file} regression ray remains clear of raised deck markings`);
    assert.equal(sceneHits.some(hit => hit.point.y > deckBox.max.y + EPSILON), false,
      `${file} regression ray remains clear above the walking surface`);

    const deckHits = ray.intersectObject(deck, true);
    const hullHits = ray.intersectObject(hull, true);
    assert.ok(deckHits.length >= 2, `${file} ray crosses the deck top and bottom`);
    assert.ok(hullHits.length >= 2, `${file} ray crosses the structural hull floor`);
    const rayDeckTop = Math.max(...deckHits.map(hit => hit.point.y));
    const rayDeckBottom = Math.min(...deckHits.map(hit => hit.point.y));
    const hullTop = Math.max(...hullHits.map(hit => hit.point.y));
    near(rayDeckTop, deckBox.max.y, EPSILON, `${file} ray deck top`);
    near(rayDeckBottom, deckBox.min.y, EPSILON, `${file} ray deck bottom`);
    assert.ok(hullTop <= rayDeckBottom + EPSILON,
      `${file} hull top ${hullTop} must be at or below deck bottom ${rayDeckBottom}`);
  });
}
