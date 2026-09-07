import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { FlightAudio } from '../src/audio.js';
import { createShipMFDs } from '../src/ship-mfd.js';
import { createShipPowerUI } from '../src/ship-power-ui.js';

function canvasDocument() {
  const context = {
    setTransform() {}, fillRect() {}, fillText() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {},
  };
  return {
    createElement(name) {
      assert.equal(name, 'canvas');
      return { width: 0, height: 0, getContext: type => type === '2d' ? context : null };
    },
  };
}

function audioParameter() {
  return {
    value: NaN,
    setTargetAtTime(value) { this.value = value; },
  };
}

test('powered-off MFDs immediately show emergency status and retain true ship telemetry', t => {
  const previousDocument = globalThis.document;
  globalThis.document = canvasDocument();
  t.after(() => { globalThis.document = previousDocument; });

  const mfds = createShipMFDs();
  t.after(() => mfds.traverse(object => {
    object.geometry?.dispose();
    object.material?.map?.dispose();
    object.material?.dispose();
  }));
  const nav = {
    powered: false,
    cabinFlight: true,
    shipSpeed: 82.5,
    speed: 1.2,
    shipVelocity: new THREE.Vector3(0, 3.25, -82),
    velocity: new THREE.Vector3(1.2, 0, 0),
    shipOrientation: new THREE.Quaternion(),
    orientation: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 1),
    flightEnvironment: { regime: 'LOW ATMOSPHERE', atmosphereFraction: .8 },
    normal: new THREE.Vector3(0, 1, 0),
    altitude: 120,
    mode: 'walk',
    flightAssist: true,
    freighter: null,
    doorOpen: false,
    doorProgress: 0,
    boost: false,
    position: new THREE.Vector3(),
  };
  const inventory = { mass: () => 12.5, capacity: { ship: 80, pack: 18 } };

  mfds.update(0, nav, inventory, null);
  const offline = mfds.snapshot();
  assert.equal(offline.length, 4);
  assert.ok(offline.every(screen => screen.values.includes('MAIN POWER: OFF')));
  assert.ok(offline[0].values.includes('SHIP VELOCITY: 82.5 m/s'));
  assert.ok(offline[2].values.includes('CABIN ACCESS: AVAILABLE'));

  nav.powered = true;
  mfds.update(0, nav, inventory, null);
  const online = mfds.snapshot();
  assert.ok(online[0].values.includes('VELOCITY: 82.5 m/s'), 'walking speed does not replace ship speed');
  assert.ok(online[0].values.includes('FLIGHT CONTROL: CABIN / ASSIST'));
  assert.ok(online[2].values.includes('LOCAL VERTICAL: 3.3 m/s'),
    'cabin flight uses ship velocity and orientation for local telemetry');
});

test('power control reports state and only invokes Navigation from the pilot seat', () => {
  const label = { textContent: '' };
  const attributes = new Map();
  const listeners = new Map();
  const button = {
    disabled: false,
    title: '',
    querySelector: selector => selector === 'span' ? label : null,
    setAttribute: (name, value) => attributes.set(name, value),
    addEventListener: (name, listener) => listeners.set(name, listener),
    removeEventListener: (name, listener) => {
      if (listeners.get(name) === listener) listeners.delete(name);
    },
  };
  const nav = {
    powered: true,
    canTogglePower: false,
    calls: 0,
    togglePower() { this.calls++;this.powered = !this.powered;return this.powered; },
  };
  const ui = createShipPowerUI(nav, button);
  assert.equal(label.textContent, 'MAIN POWER ON');
  assert.equal(attributes.get('aria-pressed'), 'true');
  assert.equal(button.disabled, true);

  listeners.get('click')();
  assert.equal(nav.calls, 0, 'a synthetic click cannot bypass the seat guard');
  nav.canTogglePower = true;
  ui.update();
  assert.equal(button.disabled, false);
  listeners.get('click')();
  assert.equal(nav.calls, 1);
  assert.equal(label.textContent, 'MAIN POWER OFF');
  assert.equal(attributes.get('aria-pressed'), 'false');
  ui.dispose();
  assert.equal(listeners.has('click'), false);
});

test('power loss mutes propulsion without creating audio or silencing environment sound', () => {
  const audio = new FlightAudio();
  audio.update({ powered: false, mode: 'flight', speed: 200 });
  assert.equal(audio.context, null, 'state updates never create an audio context');

  audio.context = { currentTime: 4 };
  audio.enabled = true;
  audio.hum = { gain: audioParameter() };
  audio.overtoneGain = { gain: audioParameter() };
  audio.wind = { gain: audioParameter() };
  audio.engine = { frequency: audioParameter() };
  audio.overtone = { frequency: audioParameter() };
  audio.windFilter = { frequency: audioParameter() };

  audio.update({ powered: true, mode: 'flight', speed: 200, altitude: 100 });
  assert.ok(audio.hum.gain.value > 0 && audio.overtoneGain.gain.value > 0);
  audio.update({ powered: false, mode: 'flight', speed: 200, altitude: 100 });
  assert.equal(audio.hum.gain.value, 0);
  assert.equal(audio.overtoneGain.gain.value, 0);
  assert.ok(audio.wind.gain.value > 0, 'airflow remains audible while an unpowered ship coasts');

  audio.update({ powered: false, mode: 'flight', speed: 0, airless: true, inHangar: true });
  assert.ok(audio.hum.gain.value > 0 && audio.overtoneGain.gain.value > 0,
    'hangar ambience remains independent of ship propulsion power');
});
