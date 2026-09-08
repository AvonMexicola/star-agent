import test from 'node:test';
import assert from 'node:assert/strict';
import {Quaternion, Vector3} from 'three';
import {SELENE, bodyOffset, bodySurfacePoint} from '../src/celestial.js';
import {STRATUM_LAYOUT as S, stratumRampFloor} from '../src/stratum-layout.js';
import {analyzeStratumAccess, STRATUM_ACCESS_LIMITS as L} from '../scripts/stratum-access-continuity.js';

// A stationary tangent frame at a real large-origin Selene surface point. These
// are CPU-only trace inputs, never assignments to a browser or Navigation object.
const frame = () => ({position: bodySurfacePoint(new Vector3(0, 1, 0), SELENE).toArray(), orientation: [0, 0, 0, 1]});
function world(local, f) { return new Vector3(...local).applyQuaternion(new Quaternion(...f.orientation)).add(new Vector3(...f.position)).toArray(); }
function point(t, z, f, {x = 0, source = z <= S.ramp.hinge[2] ? 'stratum-deck' : 'stratum-ramp:aft', y} = {}) {
  const floor = source === 'stratum-deck' ? S.interior.floorY : stratumRampFloor(z);
  const local = [x, y ?? floor + L.eyeHeight, z];
  return {t, local, world: world(local, f), source, ramp: 1, mode: 'walk', floor, boost: false, jumpHeight: 0};
}
function terrain(t, z, f, x = 0) {
  const proposed = new Vector3(...world([x, L.eyeHeight, z], f));
  const supported = bodySurfacePoint(bodyOffset(proposed, SELENE).normalize(), SELENE, L.eyeHeight);
  const local = supported.clone().sub(new Vector3(...f.position)).applyQuaternion(new Quaternion(...f.orientation).invert()).toArray();
  return {t, local, world: supported.toArray(), source: 'terrain', floor: null, mode: 'walk', ramp: 1};
}
const kinds = receipt => receipt.offenders.map(o => o.kind);

test('legal unboosted ramp travel is independent of 240 Hz through 500 ms RAF cadence', () => {
  const f = frame();
  for (const milliseconds of [1000 / 240, 1000 / 120, 16.6, 50, 100, 166.6, 200, 500]) {
    const simulated = Math.min(milliseconds / 1000, .2);
    const points = [point(100, 10, f), point(100 + milliseconds, 10 - 4.5 * simulated, f)];
    const before = JSON.stringify(points), result = analyzeStratumAccess(points, f);
    assert.equal(result.ok, true, JSON.stringify({milliseconds, offenders: result.offenders}));
    assert.ok(Math.abs(result.maxHorizontalSpeed - 4.5) < 1e-9);
    assert.equal(result.cappedFrames, milliseconds > 200 ? 1 : 0);
    assert.equal(JSON.stringify(points), before, 'Analysis must leave actual recorded points untouched');
  }
});

test('cabin entry can retain legal ramp velocity above the 2.3 m/s cabin target', () => {
  const f = frame(), a = point(0, 6.8, f), b = point(50, 6.6, f);
  a.inside = b.inside = true;
  assert.equal(analyzeStratumAccess([a, b], f).ok, true);
});

test('a short high-cadence displacement fails even when far below the old .75 m limit', () => {
  const f = frame(), result = analyzeStratumAccess([point(0, 10, f), point(1000 / 120, 9.92, f)], f);
  assert.ok(result.maxStep < .75);
  assert.ok(kinds(result).includes('excess-horizontal-travel'));
  assert.ok(result.pairs[0].horizontalLimit < .038);
});

test('a tip-to-hinge teleport fails even after a long stalled render frame', () => {
  const f = frame(), result = analyzeStratumAccess([point(0, S.ramp.endZ, f), point(2000, S.ramp.hinge[2], f)], f);
  assert.equal(result.cappedFrames, 1);
  assert.ok(kinds(result).includes('excess-horizontal-travel'));
  assert.ok(Math.abs(result.pairs[0].simulatedDt - .2) < 1e-12);
  assert.ok(Math.abs(result.pairs[0].expectedRise - S.interior.floorY) < 1e-12);
});

test('a vertical off-floor point fails on deck, ramp and authoritative terrain', () => {
  const f = frame();
  for (const a of [point(0, 6, f), point(0, 10, f), terrain(0, 13, f)]) {
    const b = structuredClone(a); b.t = 100; b.local[1] += .02; b.world = world(b.local, f);
    const result = analyzeStratumAccess([a, b], f);
    assert.ok(kinds(result).includes('off-support'), a.source);
    assert.ok(kinds(result).includes('noncanonical-support-rise'), a.source);
  }
});

test('world-only and local-only position changes cannot hide behind the other coordinate frame', () => {
  const f = frame();
  for (const space of ['world', 'local']) {
    const a = point(0, 10, f), b = point(100, 9.9, f); b[space][0] += .1;
    assert.ok(kinds(analyzeStratumAccess([a, b], f)).includes('world-local-disagreement'), space);
  }
});

test('micrometre round-trip noise passes without introducing a centimetre contact allowance', () => {
  const f = frame(), a = point(0, 10, f), b = point(100, 9.9, f);
  b.local[1] += .000002; b.world = world(b.local, f);
  assert.equal(analyzeStratumAccess([a, b], f).ok, true);
  b.local[1] += .000020; b.world = world(b.local, f);
  assert.ok(kinds(analyzeStratumAccess([a, b], f)).includes('off-support'));
});

test('canonical terrain support is sampled at a large origin, without assuming a flat local Y floor', () => {
  const f = frame(), a = terrain(0, 13, f), b = terrain(100, 13.1, f);
  assert.ok(Math.hypot(...a.world) > 20_000_000);
  assert.equal(analyzeStratumAccess([a, b], f).ok, true);
  b.local[1] += .001; b.world = world(b.local, f);
  assert.ok(kinds(analyzeStratumAccess([a, b], f)).includes('off-support'));
});

test('non-increasing time, an unavailable ramp, boost, mode changes and invalid data remain failures', () => {
  const f = frame();
  for (const [change, expected] of [
    [b => b.t = 0, 'non-increasing-timestamp'],
    [b => b.ramp = .99, 'unavailable-ramp-support'],
    [b => b.boost = true, 'non-walking-input'],
    [b => b.mode = 'eva', 'non-walking-mode'],
    [b => b.local[0] = NaN, 'invalid-sample'],
  ]) {
    const a = point(0, 10, f), b = point(100, 9.9, f); change(b);
    assert.ok(kinds(analyzeStratumAccess([a, b], f)).includes(expected), expected);
  }
});

// Original keyboard01 accessPaths.in[31..32], source19e4ab0. The full FAIL
// receipt remains unchanged outside the repository; only these two samples are
// retained here as the reproducible cadence regression. Original receipt SHA256:
// cd0185d92b36259af67ff6a405928f6f7280d7f012bbe1da90b031ed35ef2d8d
const keyboard01Regression = {
  "shipFrame": {
    "position": [
      -2193710.9188813358,
      95029.40950440538,
      -23505094.44563594
    ],
    "orientation": [
      0.3248504435169121,
      -0.4059072922601989,
      -0.5337590241851045,
      0.6669428487792819
    ]
  },
  "points": [
    {
      "t": 82094.8,
      "world": [
        -2193717.150629794,
        95029.95660293856,
        -23505088.203809522
      ],
      "local": [
        0.05375371234779491,
        2.735814902339351,
        8.402787040939863
      ],
      "source": "stratum-ramp:aft",
      "ramp": 1,
      "mode": "walk"
    },
    {
      "t": 82261.4,
      "world": [
        -2193716.4204240236,
        95029.99020948034,
        -23505088.372489445
      ],
      "local": [
        0.06164845463682522,
        2.9243156803903543,
        7.676709969877703
      ],
      "source": "stratum-ramp:aft",
      "ramp": 1,
      "mode": "walk"
    }
  ]
};

test('the original 166.6 ms uphill step is continuous although its 3D distance exceeds .75 m', () => {
  const {points, shipFrame} = keyboard01Regression;
  const result = analyzeStratumAccess(points, shipFrame), pair = result.pairs[0];
  assert.ok(result.maxStep > .75, 'Preserve the original failing threshold reproduction');
  assert.equal(result.ok, true, JSON.stringify(result.offenders));
  assert.ok(Math.abs(pair.horizontal - .7261199901380039) < 1e-12);
  assert.ok(Math.abs(pair.horizontalSpeed - 4.358463326158716) < 1e-10);
  assert.ok(Math.abs(pair.expectedRise - .18850077804690968) < 1e-8);
  assert.ok(pair.horizontal < pair.horizontalLimit);
});

test('a real terrain point beneath the ramp cannot advertise a valid shortcut back to the ramp', () => {
  const f = frame(), a = terrain(0, 10, f), b = point(1000 / 60, 9.95, f);
  // Both contacts are individually real; choosing a different source does not
  // make their large vertical separation a legal walking step.
  const result = analyzeStratumAccess([a, b], f);
  assert.ok(kinds(result).includes('noncanonical-support-source'));
  assert.ok(kinds(result).includes('off-support'));
  assert.ok(kinds(result).includes('excess-vertical-travel'));
});

test('ramp-side ground transitions fail even when both horizontal footprints are individually valid', () => {
  const f = frame(), a = point(0, 10, f, {x: .94}), b = terrain(50, 10, f, .96);
  const result = analyzeStratumAccess([a, b], f);
  assert.ok(result.pairs[0].horizontal < result.pairs[0].horizontalLimit);
  assert.ok(!kinds(result).includes('noncanonical-support-source'));
  assert.ok(kinds(result).includes('invalid-access-transition'));
  assert.ok(kinds(result).includes('excess-vertical-travel'));
});

test('micrometre aft-tip crossings pass in both directions without widening the ramp footprint', () => {
  // Use the actual landed access frame here: the synthetic polar surface used
  // above is not a landing pad, and projecting onto it shifts the requested Z.
  const f = keyboard01Regression.shipFrame, a = point(0, S.ramp.endZ - .000001, f), b = terrain(1000 / 240, S.ramp.endZ + .000001, f);
  assert.ok(b.local[2] > S.ramp.endZ, 'The actual projected ground sample is beyond the exact tip');
  for (const points of [[a, b], [{...b, t: 0}, {...a, t: 1000 / 240}]]) {
    const result = analyzeStratumAccess(points, f);
    assert.equal(result.ok, true, JSON.stringify(result.offenders));
    assert.equal(result.pairs[0].transition.boundaryZ, S.ramp.endZ);
    assert.equal(result.pairs[0].transition.allowed, true);
    assert.ok(Number.isFinite(result.pairs[0].tipGap));
  }
});
