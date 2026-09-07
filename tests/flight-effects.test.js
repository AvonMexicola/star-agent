import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createFlightEffects } from '../src/effects/flight-effects.js';
import { EnergyEffects } from '../src/effects/energy-effects.js';
import { SHIP_LAYOUT } from '../src/boarding.js';

const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
function documentStub() {
  const element = () => ({ children: [], nodes: new Map(), dataset: {},
    append(node) { this.children.push(node); }, addEventListener() {}, setAttribute() {},
    querySelector(selector) { if (!this.nodes.has(selector)) this.nodes.set(selector, element());return this.nodes.get(selector); },
    querySelectorAll() { return this.querySelector('.ship-weapon-options').children; },
  });
  return { createElement: element, body: element(), hidden: false, dialog: false,
    addEventListener() {}, querySelector() { return this.dialog ? {} : null; } };
}

test('flight adapter keeps unseated propulsion independent of weapon readiness and pauses through dialogs', t => {
  const previous = { document: globalThis.document, window: globalThis.window };
  const document = globalThis.document = documentStub();globalThis.window = { addEventListener() {} };
  t.after(() => Object.assign(globalThis, previous));
  const effects = new EnergyEffects(new THREE.Scene()), ship = new THREE.Group();
  ship.userData.assetStatus = 'ready';
  const live = { shipId: 'atlas', mode: 'walk', powered: true, cabinFlight: true, insideShip: true,
    focused: true, enabled: true, layout: SHIP_LAYOUT, gearProgress: 0, gearDeployed: false,
    position: v(25e9, 0, 0), shipPosition: v(25e9, -5, 8), orientation: new THREE.Quaternion(),
    shipOrientation: new THREE.Quaternion().setFromAxisAngle(v(0, 1, 0), Math.PI / 2),
    velocity: v(0, 0, 2), shipVelocity: v(-120, 0, 0), speed: 2, keys: new Set(['KeyW']),
    engineAcceleration: v(-14, 0, 0), flightEnvironment: { regime: 'SPACE' }, stationDistance: 1000,
    gamepad: { suspend() {} }, combatMode: true };
  const adapter = createFlightEffects({ effects, nav: live, camera: new THREE.PerspectiveCamera(), mining: {}, getShip: () => ship });
  t.after(() => effects.dispose());
  adapter.controller({ fire: 1, ui: false });
  for (let i = 0; i < 10; i++) adapter.update(.05, live.position);
  assert.equal(effects.state.engine.shipId, 'atlas');assert.equal(effects.state.engine.activeJets, 2);
  assert.ok(effects.state.engine.particles > 0);assert.equal(effects.state.weaponShots, 0, 'unseated RT cannot fire ship weapons');
  const expected = v(-13.1, 7.9, 30.92).applyQuaternion(live.shipOrientation).add(live.shipPosition).sub(live.position);
  assert.ok(effects.jets[0].mesh.position.distanceTo(expected) < .00001, 'pose follows the hull, not the walking pilot');
  document.dialog = true;adapter.update(.05, live.position);
  assert.equal(effects.state.engine.activeJets, 0);assert.equal(effects.state.engine.particles, 0);
  document.dialog = false;live.mode = 'flight';live.cabinFlight = false;live.shipPosition = null;
  live.velocity.set(0, 0, -2000);live.engineAcceleration.set(0, 0, 0);
  adapter.update(.05, live.position);
  assert.equal(effects.state.engine.state, 'idle');assert.equal(effects.state.engine.activeJets, 0, 'W plus cruise velocity is not engine demand');
  live.keys.clear();live.engineAcceleration.set(0, 0, -14);
  for (let i = 0; i < 8; i++) adapter.update(.05, live.position);
  assert.equal(effects.state.engine.activeJets, 2, 'controller/assist simulation output drives effects without a keyboard flag');
});
