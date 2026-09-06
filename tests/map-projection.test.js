import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { TRAVEL_TARGETS } from '../src/travel-model.js';
import { createMapProjection } from '../src/map-projection.js';

const near = (actual, expected, epsilon = 1e-9) =>
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`);

const shiftedTargets = (targets, offset) => targets.map(target => ({
  ...target,
  center: new Vector3(...target.center).add(offset).toArray(),
}));

test('the fixed Aeon-to-Selene plane preserves system positions and signed depth', () => {
  const projection = createMapProjection({ targets: TRAVEL_TARGETS });
  const aeon = new Vector3(...TRAVEL_TARGETS[0].center);
  const selene = new Vector3(...TRAVEL_TARGETS[1].center);
  const right = selene.clone().sub(aeon).normalize();
  const up = new Vector3(0, 1, 0).projectOnPlane(right).normalize();
  const normal = new Vector3().crossVectors(right, up);
  const a = projection.project(aeon), b = projection.project(selene);
  assert.ok(b.x > a.x);
  near(a.y, b.y);
  near(a.depth, 0);
  near(b.depth, 0, 1e-6);
  const above = projection.project(aeon.clone().addScaledVector(up, 100_000));
  const outside = projection.project(aeon.clone().addScaledVector(normal, 75_000));
  assert.ok(above.y < a.y);
  near(outside.x, a.x);
  near(outside.y, a.y);
  near(outside.depth, 75_000, 1e-7);
});

test('fitted bounds contain target exclusion circles and route positions', () => {
  const targets = [
    { id: 'aeon', center: [0, 0, 0], radius: 5, exclusionRadius: 10 },
    { id: 'selene', center: [100, 0, 0], radius: 5, exclusionRadius: 20 },
  ];
  const positions = [new Vector3(45, 80, 30), [35, -50, -70]];
  const width = 640, height = 440, padding = 64;
  const projection = createMapProjection({ targets, positions, width, height, padding });
  for (const target of targets) {
    const point = projection.project(target.center);
    const radius = target.exclusionRadius / projection.metersPerPixel;
    assert.ok(point.x - radius >= padding - 1e-9);
    assert.ok(point.x + radius <= width - padding + 1e-9);
    assert.ok(point.y - radius >= padding - 1e-9);
    assert.ok(point.y + radius <= height - padding + 1e-9);
  }
  for (const position of positions) {
    const point = projection.project(position);
    assert.ok(point.x >= padding && point.x <= width - padding);
    assert.ok(point.y >= padding && point.y <= height - padding);
  }
});

test('zoom is clamped and centers either the fitted bounds or supplied focus', () => {
  const targets = [
    { id: 'aeon', center: [0, 0, 0], exclusionRadius: 10 },
    { id: 'selene', center: [1_000, 0, 0], exclusionRadius: 10 },
  ];
  const fitted = createMapProjection({ targets, zoom: 1 });
  const doubled = createMapProjection({ targets, zoom: 2 });
  near(doubled.metersPerPixel, fitted.metersPerPixel / 2);
  const midpoint = fitted.project([500, 0, 0]);
  near(midpoint.x, 320); near(midpoint.y, 220);

  const focus = new Vector3(740, 25, 40);
  const focused = createMapProjection({ targets, positions: focus, focus, zoom: 100 });
  assert.equal(focused.zoom, 32);
  const center = focused.project(focus);
  near(center.x, 320); near(center.y, 220);
  assert.equal(createMapProjection({ targets, zoom: .01 }).zoom, .5);
});

test('anchored double projection is invariant to a large shared origin shift', () => {
  const positions = [new Vector3(3_000_000, 250_000, -400_000), [-700_000, -80_000, 900_000]];
  const probe = new Vector3(1_234_000, 56_000, -78_000);
  const base = createMapProjection({ targets: TRAVEL_TARGETS, positions, focus: positions[0], zoom: 3.5 });
  const offset = new Vector3(8_000_000_000_000, -4_000_000_000_000, 6_000_000_000_000);
  const translatedPositions = positions.map(value => new Vector3(...value).add(offset));
  const moved = createMapProjection({
    targets: shiftedTargets(TRAVEL_TARGETS, offset),
    positions: translatedPositions,
    focus: translatedPositions[0],
    zoom: 3.5,
  });
  const before = base.project(probe);
  const after = moved.project(probe.clone().add(offset));
  near(after.x, before.x, 1e-7);
  near(after.y, before.y, 1e-7);
  // At an 8e12 m translated origin, a double's coordinate ULP is about 1 mm.
  near(after.depth, before.depth, 1e-3);
  near(moved.metersPerPixel, base.metersPerPixel, 1e-3);
  assert.deepEqual(positions[0].toArray(), [3_000_000, 250_000, -400_000]);
});

test('scale bar uses a finite 1-2-5 distance at a readable length', () => {
  const projection = createMapProjection({ targets: TRAVEL_TARGETS, width: 640, height: 440, padding: 64 });
  const { metres, pixels } = projection.scaleBar;
  assert.ok(Number.isFinite(metres) && metres > 0);
  assert.ok(Number.isFinite(pixels) && pixels >= 30 && pixels <= 150);
  near(pixels * projection.metersPerPixel, metres, metres * 1e-12);
  const exponent = 10 ** Math.floor(Math.log10(metres));
  assert.ok([1, 2, 5].some(step => Math.abs(metres / exponent - step) < 1e-12));
});

test('degenerate finite charts stay usable and invalid coordinates fail clearly', () => {
  for (const projection of [
    createMapProjection(),
    createMapProjection({ targets: [{ id: 'aeon', center: [4, -2, 8], exclusionRadius: 0 }], positions: [[4, -2, 8]] }),
    createMapProjection({ width: 1, height: 1, padding: 500, zoom: NaN }),
  ]) {
    const point = projection.project([4, -2, 8]);
    assert.ok([point.x, point.y, point.depth, projection.metersPerPixel,
      projection.scaleBar.pixels, projection.scaleBar.metres].every(Number.isFinite));
    assert.ok(projection.metersPerPixel > 0);
  }
  assert.throws(() => createMapProjection({ positions: [[Infinity, 0, 0]] }), /finite/i);
  assert.throws(() => createMapProjection({ targets: [{ center: [0, 0, 0], exclusionRadius: -1 }] }), /nonnegative/i);
  assert.throws(() => createMapProjection({ width: 0 }), /positive/i);
});
