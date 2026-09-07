import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FlightAudio } from '../src/audio.js';
import { Station, stationQuaternion } from '../src/station.js';

if (!globalThis.ProgressEvent) {
  globalThis.ProgressEvent = class ProgressEvent {
    constructor(type, init = {}) { this.type = type; Object.assign(this, init); }
  };
}

const MODEL_URL = new URL('../public/models/station.glb', import.meta.url);
const DIRECTION = new THREE.Vector3(.23, .91, .34).normalize();
let modelBytes;

async function stationGltf() {
  modelBytes ??= await readFile(MODEL_URL);
  const buffer = modelBytes.buffer.slice(modelBytes.byteOffset, modelBytes.byteOffset + modelBytes.byteLength);
  return new GLTFLoader().parseAsync(buffer, '');
}

async function createStation(options = {}) {
  const station = new Station(new THREE.Scene(), {
    gltf: await stationGltf(), lodUrl: null, direction: DIRECTION, ...options,
  });
  await station.readyPromise;
  return station;
}

const near = (actual, expected, tolerance = 1e-7) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
const nearVector = (actual, expected, tolerance = 1e-7) =>
  assert.ok(actual.distanceTo(expected) <= tolerance, `${actual.toArray()} != ${expected.toArray()}`);
const doorPose = station => station.doors.map(door => door.position.toArray());
const colliderPose = station => station.doorBoxes.map(box => [...box.min.toArray(), ...box.max.toArray()]);

test('opening control evaluates the authored door and collision pose deterministically', async t => {
  const station = await createStation();
  t.after(() => station.dispose());
  const bayLights = station.group.children.filter(child => child.isPointLight);
  assert.equal(bayLights.length, 2);
  assert.ok(bayLights.every(light => light.color.getHex() === 0xffdfb4), 'bay light bars use muted warm lamps');
  const worldPosition = station.worldPosition.clone();
  const orientation = station.quaternion.clone();
  const renderOrigin = station.worldPosition.clone();
  const sun = new THREE.Vector3(1, 0, 0);
  const nearTrigger = station.doorTriggerWorldPosition.clone();
  const farFromTrigger = nearTrigger.clone().addScaledVector(station.up, 2_000);
  const deckY = station.interiorBox.min.y + 3.2;
  const outside = station.toWorld(new THREE.Vector3(0, deckY, -60), new THREE.Vector3());
  const pad = station.toWorld(new THREE.Vector3(0, deckY, station.padLocal.z), new THREE.Vector3());

  station.openDoors();
  station.update(nearTrigger, renderOrigin, sun, 6);
  near(station.doorsOpen, 1, 1e-6);
  station.beginOpening();
  assert.equal(station.openingControlled, true);
  assert.equal(station.doorAction.paused, true);
  near(station.doorsOpen, 0);
  assert.equal(station.constrainStep(outside, pad, station.padQuaternion).hit, true,
    'beginOpening immediately restores the sealed collider');
  nearVector(station.worldPosition, worldPosition, 0);
  assert.ok(station.quaternion.equals(orientation), 'opening control does not move or rotate the station');

  station.update(nearTrigger, renderOrigin, sun, 6);
  near(station.doorsOpen, 0, 0, 'nearby camera cannot auto-open controlled doors');
  station.setOpeningProgress(.4);
  const pose = doorPose(station);
  const colliders = colliderPose(station);
  near(station.doorsOpen, .4);
  station.update(farFromTrigger, renderOrigin, sun, 6);
  near(station.doorsOpen, .4, 1e-12, 'distant camera cannot auto-close controlled doors');

  station.setOpeningProgress(.8);
  assert.notDeepEqual(doorPose(station), pose);
  assert.notDeepEqual(colliderPose(station), colliders);
  station.setOpeningProgress(.4);
  assert.deepEqual(doorPose(station), pose);
  assert.deepEqual(colliderPose(station), colliders);
  assert.equal(station.setOpeningProgress(2), 1);
  assert.equal(station.constrainStep(outside, pad, station.padQuaternion).hit, false,
    'fully evaluated opening admits the ship');
  assert.equal(station.setOpeningProgress(-1), 0);

  station.setOpeningProgress(.4);
  const releasedAt = station.endOpening();
  assert.equal(station.openingControlled, false);
  near(releasedAt, .4);
  near(station.doorsOpen, .4, 1e-12, 'release itself preserves the current clip time');
  station.update(nearTrigger, renderOrigin, sun, .25);
  assert.ok(station.doorsOpen > .4, 'normal proximity automation resumes after release');
});

test('an optional orientation keeps position fixed and defines the true deck normal', async t => {
  const radial = stationQuaternion(DIRECTION, new THREE.Quaternion());
  const supplied = radial.clone().multiply(
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), THREE.MathUtils.degToRad(20)),
  ).normalize();
  const expectedOrientation = supplied.clone();
  const station = await createStation({ orientation: supplied });
  t.after(() => station.dispose());
  supplied.identity();

  assert.ok(station.quaternion.equals(expectedOrientation), 'constructor stores its own orientation clone');
  nearVector(station.worldPosition, DIRECTION.clone().multiplyScalar(station.worldPosition.length()), 1e-8);
  const expectedUp = new THREE.Vector3(0, 1, 0).applyQuaternion(expectedOrientation).normalize();
  nearVector(station.up, expectedUp, 1e-12);
  assert.ok(station.up.distanceTo(DIRECTION) > .1, 'fixture exercises a non-radial deck normal');
  nearVector(new THREE.Vector3(0, 1, 0).applyQuaternion(station.padQuaternion), station.up, 1e-12,
    'landed ship and deck use the same up axis');
  nearVector(station.transitParams().up, station.up, 1e-12);

  station.update(station.padWorldPosition, station.worldPosition, new THREE.Vector3(1, 0, 0), 1);
  assert.ok(station.quaternion.equals(expectedOrientation), 'frame updates preserve the authored orientation');
});

function parameter() {
  return {
    value: NaN,
    calls: [],
    setTargetAtTime(value, time, constant) { this.value = value; this.calls.push({ value, time, constant }); },
  };
}

test('hangar and door audio fades use the existing graph without autoplay', t => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'AudioContext');
  let contextsCreated = 0;
  Object.defineProperty(globalThis, 'AudioContext', {
    configurable: true,
    value: class AudioContext { constructor() { contextsCreated++; } },
  });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, 'AudioContext', previous);
    else delete globalThis.AudioContext;
  });

  const audio = new FlightAudio();
  audio.update({ mode: 'walk', inHangar: true, doorMotion: 1 });
  assert.equal(contextsCreated, 0);
  assert.equal(audio.context, null, 'update never creates or resumes an audio context');

  audio.context = { currentTime: 12, state: 'running' };
  audio.enabled = true;
  audio.hum = { gain: parameter() };
  audio.overtoneGain = { gain: parameter() };
  audio.wind = { gain: parameter() };
  audio.engine = { frequency: parameter() };
  audio.overtone = { frequency: parameter() };
  audio.windFilter = { frequency: parameter() };

  audio.update({ mode: 'walk', airless: true, inHangar: true, doorMotion: 0 });
  const quietHum = audio.hum.gain.value;
  const quietOvertone = audio.overtoneGain.gain.value;
  assert.ok(quietHum > 0 && quietOvertone > 0 && audio.wind.gain.value > 0,
    'the occupied hangar has a low ambient bed');
  for (const node of [audio.hum.gain, audio.overtoneGain.gain, audio.wind.gain,
    audio.engine.frequency, audio.overtone.frequency, audio.windFilter.frequency]) {
    assert.deepEqual(node.calls.at(-1), { value: node.value, time: 12, constant: .18 });
  }

  audio.update({ mode: 'walk', airless: true, inHangar: true, doorMotion: 1 });
  assert.ok(audio.hum.gain.value > quietHum);
  assert.ok(audio.overtoneGain.gain.value > quietOvertone);
  assert.ok(audio.engine.frequency.value < 36 && audio.overtone.frequency.value < 54,
    'door motion shifts both existing oscillators into a deeper rumble');
  assert.ok(audio.wind.gain.value > .009, 'filtered noise adds motor texture');

  audio.update({ mode: 'walk', airless: true, inHangar: false, doorMotion: 0 });
  assert.equal(audio.hum.gain.value, 0);
  assert.equal(audio.overtoneGain.gain.value, 0);
  assert.equal(audio.wind.gain.value, 0);
});
