import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { AEON, bodyAltitude, bodySurfacePoint } from '../src/celestial.js';
import { SEED, setPlanetSeed } from '../src/generation.js';
import { AtlasGameplaySystems, ATLAS_LAYOUT } from '../src/atlas-gameplay.js';
import { BuildSystem } from '../src/build/system.js';
import { ATLAS_MARK_II_LAYOUT } from '../src/atlas-mark-ii-systems.js';
import { atlasRampGroundAngle, updateAtlasRampGround } from '../src/atlas-ramp-ground.js';
import { readGLBGeometry } from './helpers/gltf-geometry.js';

function meadow(t) {
  const seed = SEED; setPlanetSeed(7291); t.after(() => setPlanetSeed(seed));
  const direction = new THREE.Vector3(.013692585058580798, .6056142771291465, .7956405346962626);
  return {
    shipId: 'atlas', mode: 'landed', freighter: new AtlasGameplaySystems(),
    shipPosition: bodySurfacePoint(direction, AEON).addScaledVector(direction, .0234348951),
    shipOrientation: new THREE.Quaternion(.45198957488735714, -.2555944019854732, -.15162264421697483, .841063314874384),
  };
}
function rampPoint(ramp, along, x = 0, angle = ramp.openAngle) {
  return new THREE.Vector3(
    ramp.pivot[0] + x,
    ramp.pivot[1] - ramp.outward * along * Math.sin(angle),
    ramp.pivot[2] + ramp.outward * along * Math.cos(angle),
  );
}
function clearance(nav, local) {
  return bodyAltitude(local.clone().applyQuaternion(nav.shipOrientation).add(nav.shipPosition), AEON);
}
function openRamps(systems) {
  for (const ramp of systems.ramps) assert.equal(systems.toggleRamp(ramp.id), true);
  for (let i = 0; i < 100 && systems.ramps.some(ramp => ramp.moving); i++) systems.update(.1);
  assert.ok(systems.ramps.every(ramp => !ramp.moving && ramp.angle === ramp.openAngle && ramp.tipAngle === 0));
}

test('flat landing planes retain the authored angle and unreachable surfaces have no fabricated contact', () => {
  for (const ramp of ATLAS_MARK_II_LAYOUT.ramps) {
    const angle = atlasRampGroundAngle(ramp, point => point.y);
    assert.ok(Math.abs(angle - ramp.openAngle) < 1e-6);
    assert.ok(Math.abs(rampPoint(ramp, ramp.length, 0, angle).y) < 1e-5);
    assert.equal(atlasRampGroundAngle(ramp, point => point.y + 1000), null, 'ground is beyond the physical ramp length');
    assert.equal(atlasRampGroundAngle(ramp, point => point.y - 1000), null, 'ground already intersects the highest permitted ramp');
  }
});

test('meadow ramps bridge the reported forward gap and stop before cutting through either terrain path', t => {
  const nav = meadow(t), [front, aft] = nav.freighter.ramps;
  const originalFrontGap = clearance(nav, rampPoint(front, front.length));
  const originalAftGap = clearance(nav, rampPoint(aft, aft.length));
  assert.ok(originalFrontGap > 1.2, 'the supplied meadow reproduces the suspended forward toe');
  assert.ok(originalAftGap < -.25, 'the supplied meadow reproduces the buried aft toe');
  updateAtlasRampGround(nav);
  assert.notEqual(front.openAngle, front.nominalOpenAngle);
  assert.notEqual(aft.openAngle, aft.nominalOpenAngle);
  for (const ramp of nav.freighter.ramps) {
    let minimum = Infinity, tipMinimum = Infinity;
    // Independent 6.25 cm longitudinal / 9.06 cm lateral samples include
    // terrain between the fitter's contact probes, along both leaves.
    for (let lengthIndex = 1; lengthIndex <= 128; lengthIndex++) {
      for (let widthIndex = 0; widthIndex <= 128; widthIndex++) {
        const gap = clearance(nav, rampPoint(ramp, ramp.length * lengthIndex / 128, ramp.width * (widthIndex / 128 - .5)));
        minimum = Math.min(minimum, gap);
        if (lengthIndex === 128) tipMinimum = Math.min(tipMinimum, gap);
      }
    }
    assert.ok(minimum >= -.002, `${ramp.id}: physical surface penetrates terrain by ${-minimum} m`);
    assert.ok(tipMinimum >= -.002 && tipMinimum < .015, `${ramp.id}: the real toe must contact terrain, gap ${tipMinimum} m`);
  }
});

test('actual GLB main and folding toe match the adapted walking floor and normal', async t => {
  const nav = meadow(t); updateAtlasRampGround(nav);
  const { scene } = await readGLBGeometry(new URL('../public/models/atlas-mark-ii/atlas-mark-ii.glb', import.meta.url));
  nav.freighter.bind(scene); openRamps(nav.freighter);
  const ray = new THREE.Raycaster();
  for (const ramp of nav.freighter.ramps) {
    assert.equal(ramp.tipNodeObject.rotation.x, 0, 'the existing rigid toe unfolds into the same visible plane');
    for (const along of [1, 5.5, 6.3, 7.3, 7.99]) {
      const expected = rampPoint(ramp, along);
      const walker = expected.clone().add(new THREE.Vector3(0, nav.freighter.eyeHeight, 0));
      const surface = nav.freighter.rampSurfaceAt(walker);
      assert.ok(surface, `${ramp.id}/${along} has physical support`);
      assert.ok(Math.abs(surface.y - expected.y) < 1e-10);
      assert.ok(Math.abs(nav.freighter.floorAt(walker) - expected.y) < 1e-10);
      ray.set(new THREE.Vector3(expected.x, 20, expected.z), new THREE.Vector3(0, -1, 0));
      const hit = ray.intersectObject(ramp.nodeObject, true)[0];
      assert.ok(hit, `${ramp.id}/${along} is actually rendered geometry`);
      assert.ok(Math.abs(hit.point.y - surface.y) < .0001, `${ramp.id}/${along}: GLB and support floor disagree`);
      const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
      assert.ok(normal.dot(surface.normal) > .99999, 'contact normal follows the same authored top face');
      assert.equal(along > ramp.hingeLength, hit.object.name.includes('Tip'), 'both real rigid leaves were inspected');
    }
    const beyond = rampPoint(ramp, ramp.length + .02).add(new THREE.Vector3(0, nav.freighter.eyeHeight, 0));
    assert.equal(nav.freighter.rampSurfaceAt(beyond), null, 'no invisible floor extends beyond the physical toe');
  }
});

test('a translated and rotated landing plane keeps double precision at a distant origin', () => {
  const quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(.31, -.74, .19));
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(quaternion);
  const origin = new THREE.Vector3(25_000_000_000, -1_000_000_000, 8_000_000_000);
  const world = new THREE.Vector3();
  for (const ramp of ATLAS_MARK_II_LAYOUT.ramps) {
    const local = atlasRampGroundAngle(ramp, point => point.y - .4);
    const distant = atlasRampGroundAngle(ramp, point => world.copy(point).applyQuaternion(quaternion).add(origin).sub(origin).dot(up) - .4);
    assert.ok(Math.abs(local - distant) < 2e-6, 'world translation cannot quantize the contact angle');
    assert.ok(Math.abs(rampPoint(ramp, ramp.length, 0, distant).y - .4) < .00002);
  }
});

test('unchanged parked poses reuse contact while movements, systems and seed changes resample', t => {
  const nav = meadow(t); let calls = 0;
  nav.cargoLandingSurface = () => { calls++; return null; };
  updateAtlasRampGround(nav); assert.ok(calls > 0);
  calls = 0;
  for (let i = 0; i < 60; i++) updateAtlasRampGround(nav);
  assert.equal(calls, 0, 'stationary frames do not sample the terrain again');
  nav.shipPosition.x += .00001; updateAtlasRampGround(nav); assert.ok(calls > 0);
  calls = 0;
  nav.shipOrientation.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), .00001));
  updateAtlasRampGround(nav); assert.ok(calls > 0);
  calls = 0;
  nav.freighter = new AtlasGameplaySystems(); updateAtlasRampGround(nav); assert.ok(calls > 0);
  calls = 0;
  setPlanetSeed(7292); updateAtlasRampGround(nav); assert.ok(calls > 0, 'canonical seed is part of the contact sample identity');
});

test('station docking restores nominal deployment and returning to the meadow refits', t => {
  const nav = meadow(t); updateAtlasRampGround(nav); openRamps(nav.freighter);
  const groundAngles = nav.freighter.ramps.map(ramp => ramp.openAngle);
  nav.dockedAtStation = true; updateAtlasRampGround(nav);
  for (const ramp of nav.freighter.ramps) {
    assert.equal(ramp.openAngle, ramp.nominalOpenAngle);
    assert.equal(ramp.target, ramp.nominalOpenAngle);
  }
  for (let i = 0; i < 100 && nav.freighter.ramps.some(ramp => ramp.moving); i++) nav.freighter.update(.1);
  assert.ok(nav.freighter.ramps.every(ramp => ramp.angle === ramp.nominalOpenAngle));
  nav.dockedAtStation = false; updateAtlasRampGround(nav);
  assert.deepEqual(nav.freighter.ramps.map(ramp => ramp.openAngle), groundAngles);
});

test('a raised build pad supports the parked hull independently of the pilot or walker pose', t => {
  const nav = meadow(t);
  nav.shipPosition.addScaledVector(new THREE.Vector3(0, 1, 0).applyQuaternion(nav.shipOrientation), 1.5);
  nav.layout = ATLAS_LAYOUT;
  nav.body = AEON;
  nav.position = new THREE.Vector3(...ATLAS_LAYOUT.seatEye).applyQuaternion(nav.shipOrientation).add(nav.shipPosition);
  nav.orientation = nav.shipOrientation.clone();
  const claim = {
    body: AEON.id, origin: nav.shipPosition.toArray(), quaternion: nav.shipOrientation.toArray(),
    pieces: [{ id: 'pad', type: 'foundation-pad-large', landingPad: true, position: [0, 0, 0], rotation: 0 }],
  };
  const build = {
    nav, claims: [claim], toLocal: BuildSystem.prototype.toLocal, toWorld: BuildSystem.prototype.toWorld,
    doorFraction: () => 0,
  };
  nav.baseLandingSurface = pose => BuildSystem.prototype.landingSurface.call(build, pose);
  let revision = {};
  nav.baseLandingRevision = () => revision;
  assert.equal(nav.baseLandingSurface(), null, 'the actual forward pilot seat cannot be mistaken for the parked hull centre');
  const support = nav.baseLandingSurface({ position: nav.shipPosition, orientation: nav.shipOrientation });
  assert.ok(support, 'the complete parked hull fits on the actual 48 × 72 m build pad');
  assert.ok(support.point.distanceTo(nav.shipPosition) < 1e-8);
  for (const ramp of nav.freighter.ramps) {
    const terrainAngle = atlasRampGroundAngle(ramp, point => clearance(nav, point));
    assert.ok(terrainAngle !== null && Math.abs(terrainAngle - ramp.nominalOpenAngle) > .01, 'omitting the pad would visibly bury the ramp in its slab');
  }
  updateAtlasRampGround(nav);
  for (const ramp of nav.freighter.ramps) {
    assert.ok(Math.abs(ramp.openAngle - ramp.nominalOpenAngle) < 1e-6, 'ramp meets the real pad instead of cutting toward lower terrain');
  }
  nav.position.addScaledVector(new THREE.Vector3(1, 0, 0).applyQuaternion(nav.shipOrientation), 100);
  nav.orientation.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 3));
  updateAtlasRampGround(nav);
  for (const ramp of nav.freighter.ramps) assert.ok(Math.abs(ramp.openAngle - ramp.nominalOpenAngle) < 1e-6);
  claim.pieces = []; revision = {};
  updateAtlasRampGround(nav);
  for (const ramp of nav.freighter.ramps) assert.ok(Math.abs(ramp.openAngle - ramp.nominalOpenAngle) > .01, 'removing the pad invalidates support without requiring the ship to move');
});

test('snapshots retain adapted angles through motion, open contact and closing', t => {
  const nav = meadow(t); updateAtlasRampGround(nav);
  const recipient = new AtlasGameplaySystems();
  for (const ramp of nav.freighter.ramps) nav.freighter.toggleRamp(ramp.id);
  for (let frame = 0; frame < 120; frame++) {
    nav.freighter.update(.05);
    const snapshot = structuredClone(nav.freighter.snapshot);
    assert.equal(recipient.applySnapshot(snapshot), true);
    for (const source of nav.freighter.ramps) {
      const target = recipient.ramps.find(ramp => ramp.id === source.id);
      for (const field of ['angle', 'target', 'openAngle', 'tipAngle', 'moving']) assert.equal(target[field], source[field], `${source.id}/${field}`);
    }
    if (frame === 70) for (const ramp of nav.freighter.ramps) assert.equal(nav.freighter.toggleRamp(ramp.id), true);
  }
});
