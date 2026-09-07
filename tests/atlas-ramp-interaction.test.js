import test from 'node:test';
import assert from 'node:assert/strict';
import { Quaternion, Vector3 } from 'three';
import { AtlasGameplaySystems, ATLAS_RAMP_CALLS } from '../src/atlas-gameplay.js';
import { AEON, bodyOffset, bodySurfacePoint } from '../src/celestial.js';
import { SEED, setPlanetSeed } from '../src/generation.js';

test('both exterior panels work at the canonical Atlas meadow start, including the raised aft terrain', () => {
  const previousSeed = SEED;
  try {
    setPlanetSeed(7291);
    // The explicit development scene in src/dev-atlas-meadow.js, sampled through
    // the same canonical bodySurfacePoint used for grounded navigation.
    const direction = new Vector3(0.013692585058580798, 0.6056142771291465, 0.7956405346962626);
    const orientation = new Quaternion(0.45198957488735714, -0.2555944019854732, -0.15162264421697483, 0.841063314874384);
    const origin = bodySurfacePoint(direction, AEON).addScaledVector(direction, .0234348951);
    const systems = new AtlasGameplaySystems();
    for (const call of ATLAS_RAMP_CALLS) {
      const approach = new Vector3(...call.approach).applyQuaternion(orientation).add(origin);
      const eye = bodySurfacePoint(bodyOffset(approach, AEON), AEON, systems.eyeHeight)
        .sub(origin).applyQuaternion(orientation.clone().invert());
      if (call.id === 'aft') assert.ok(eye.y - systems.eyeHeight > .5, 'the reported aft panel lies above the old 0.45 m height gate');
      assert.ok(eye.distanceTo(new Vector3(...call.anchor)) < 1.4, 'the visible panel is physically in reach');
      assert.equal(systems.exteriorRampCallAt(eye), call);
      assert.equal(systems.interactionAt(eye), `ramp:${call.id}`);
      assert.equal(systems.operate(`ramp:${call.id}`, eye).ok, true);
      assert.equal(systems.ramps.find(ramp => ramp.id === call.id).moving, true);
    }
  } finally { setPlanetSeed(previousSeed); }
});

test('exterior call reach follows the panel on either end without requiring level ground', () => {
  const systems = new AtlasGameplaySystems();
  for (const call of ATLAS_RAMP_CALLS) {
    for (const groundOffset of [-.65, -.46, 0, .46, .65]) {
      const eye = new Vector3(...call.approach);eye.y += groundOffset;
      const before = eye.clone();
      assert.equal(systems.exteriorRampCallAt(eye), call, `${call.id} at ground offset ${groundOffset}`);
      assert.equal(systems.interactionAt(eye), `ramp:${call.id}`);
      assert.deepEqual(eye, before, 'reach queries cannot change the physical player pose');
    }
    const ramp = systems.ramps.find(ramp => ramp.id === call.id);
    const internal = new Vector3(...ramp.control);internal.y += systems.eyeHeight;
    assert.equal(systems.exteriorRampCallAt(internal), null);
    assert.equal(systems.interactionAt(internal), `ramp:${call.id}`, 'authored cargo-deck controls remain available');
  }
});

test('ground calls reject cabin-side, other-deck and remote positions with a bounded 3D reach', () => {
  const systems = new AtlasGameplaySystems();
  for (const call of ATLAS_RAMP_CALLS) {
    const ramp = systems.ramps.find(ramp => ramp.id === call.id);
    const rejected = [
      new Vector3(call.anchor[0], 1.75, ramp.pivot[2] - ramp.outward * .5),
      new Vector3(...call.approach).add(new Vector3(0, systems.layout.cargo.floor, 0)),
      new Vector3(...call.approach).add(new Vector3(0, systems.layout.upper.floor, 0)),
      new Vector3(...call.approach).add(new Vector3(0, -4, 0)),
      new Vector3(...call.approach).add(new Vector3(5, 0, 0)),
      new Vector3(...call.approach).add(new Vector3(0, 0, ramp.outward * 5)),
    ];
    for (const eye of rejected) {
      assert.equal(systems.exteriorRampCallAt(eye), null);
      assert.equal(systems.interactionAt(eye), null, `${call.id} unreachable from ${eye.toArray()}`);
    }
    const boundary = new Vector3(...call.anchor).add(new Vector3(0, 0, ramp.outward * 1.75));
    assert.equal(systems.exteriorRampCallAt(boundary), null, 'reach boundary is exclusive');
    boundary.z -= ramp.outward * 1e-6;
    assert.equal(systems.exteriorRampCallAt(boundary), call);
  }
  for (const point of [null, {}, { x: NaN, y: 1, z: 2 }, { x: 6.65, y: Infinity, z: 25 }]) assert.equal(systems.exteriorRampCallAt(point), null);
});
