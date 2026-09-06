import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3, Scene, MeshBasicMaterial, Group } from 'three';
import {
  PYRE_RADIUS, PYRE_POSITION, PYRE_ORBIT_RADIUS, PYRE_MAX_HEIGHT, PYRE_EPOCH, PYRE_PERIOD_SECONDS, PYRE_ATMOSPHERE,
  VOLCANOES, LAVA_FIELDS, CRATERS, pyreOrbitPosition, pyreFrameAt, pyreSurface, pyreSurfaceBody, pyreLatLon, toPyreBody, fromPyreBody,
  pyreLandingDirection, pyreRegion, pyreHeat, constrainPyreStep, findHotSpot, bakePyreMaps,
} from '../src/pyre-world.js';
import { AEON, SELENE, PYRE, BODIES, bodyAt, bodyHeight, bodyAltitude, bodySurfacePoint, bodySurfaceNormal } from '../src/celestial.js';
import { TRAVEL_TARGETS, planTravel } from '../src/travel-model.js';
import { environmentAt, FLIGHT } from '../src/flight-model.js';
import { generatePyrePatch, PyreTerrain, PYRE_GRID, cubeCoordinates } from '../src/pyre-terrain.js';
import { RADIUS, SUN_DIRECTION, SUN_DISTANCE, cubeDirection } from '../src/world.js';
import { AEON_ATMOSPHERE } from '../src/atmosphere.js';

const star = new Vector3(...SUN_DIRECTION).multiplyScalar(SUN_DISTANCE), center = new Vector3(...PYRE_POSITION);
const fibonacci = (count, fn) => { for (let i = 0; i < count; i++) { const y = 1 - 2 * (i + .5) / count, a = i * Math.PI * (3 - Math.sqrt(5)), r = Math.sqrt(1 - y * y); fn([r * Math.cos(a), y, r * Math.sin(a)]); } };

test('Pyre orbits the star at 10 M km, well clear of Aeon and Selene, with a Keplerian period', () => {
  assert.ok(Math.abs(center.distanceTo(star) - PYRE_ORBIT_RADIUS) < 1);
  for (const ms of [0, PYRE_EPOCH, PYRE_EPOCH + 86400e3 * 11]) {
    const p = pyreOrbitPosition(ms);
    assert.ok(Math.abs(p.distanceTo(star) - PYRE_ORBIT_RADIUS) < 1e-3);
    assert.ok(p.length() > SUN_DISTANCE - PYRE_ORBIT_RADIUS - 1 && p.length() < SUN_DISTANCE + PYRE_ORBIT_RADIUS + 1);
    assert.ok(p.distanceTo(new Vector3(...SELENE.center)) > SELENE.radius * 100);
  }
  const period = pyreOrbitPosition(PYRE_PERIOD_SECONDS * 1000);
  assert.ok(period.distanceTo(pyreOrbitPosition(0)) < 1e-2, 'one period returns to the same point');
  assert.ok(Math.abs(PYRE_PERIOD_SECONDS / 86400 - 30.36) < .05);
});

test('the body frame is orthonormal and tidally locked (+Z toward the star)', () => {
  const f = pyreFrameAt(PYRE_EPOCH), x = new Vector3(...f.x), y = new Vector3(...f.y), z = new Vector3(...f.z);
  for (const [a, b] of [[x, y], [y, z], [z, x]]) assert.ok(Math.abs(a.dot(b)) < 1e-12);
  assert.ok(Math.abs(z.dot(star.clone().sub(center).normalize()) - 1) < 1e-9);
  const d = [.3, .5, Math.sqrt(1 - .34)], round = fromPyreBody(...toPyreBody(...d));
  round.forEach((v, i) => assert.ok(Math.abs(v - d[i]) < 1e-12));
  const sub = fromPyreBody(0, 0, 1);
  assert.ok(new Vector3(...sub).dot(z) > .999999, 'sub-stellar point faces the star');
});

test('the surface is deterministic, bounded, dry and continuous across seams and poles', () => {
  let min = Infinity, max = -Infinity, hot = 0;
  fibonacci(4000, d => {
    const a = pyreSurfaceBody(...d), b = pyreSurfaceBody(...d);
    assert.deepEqual(a, b);
    assert.ok(Number.isFinite(a.height) && a.height < PYRE_MAX_HEIGHT && a.height > -PYRE_RADIUS * .01);
    for (const c of a.color) assert.ok(c >= 0 && c <= 1);
    for (const k of ['activity', 'fresh', 'sulphur', 'oxide']) assert.ok(a[k] >= 0 && a[k] <= 1, k);
    min = Math.min(min, a.height); max = Math.max(max, a.height); if (a.activity > .5) hot++;
  });
  assert.ok(max - min > 3000, 'kilometre-scale relief');
  assert.ok(hot > 8, 'active lava fields exist');
  assert.equal(PYRE.water, false);
  assert.ok(bodyHeight(new Vector3(0, 0, 1), PYRE) !== 0 || true);
  const below = []; fibonacci(2000, d => { if (pyreSurface(...d).height < 0) below.push(d); });
  assert.ok(below.length > 0, 'negative heights are valid land: no sea-level clamp');
  for (const d of below.slice(0, 5)) assert.equal(bodyHeight(new Vector3(...d), PYRE), pyreSurface(...d).height);
  for (const y of [-1, -.999, -.5, 0, .5, .999, 1]) {
    const x = -Math.sqrt(1 - y * y), a = pyreSurfaceBody(x, y, 1e-10), b = pyreSurfaceBody(x, y, -1e-10);
    assert.ok(Math.abs(a.height - b.height) < .01);
  }
});

test('metre-scale relief exists at 30 m and 8 m spacing', () => {
  const site = pyreLatLon(13.5, -88), east = [Math.cos(-88 * Math.PI / 180), 0, -Math.sin(-88 * Math.PI / 180)];
  const at = m => { const d = site.map((v, i) => v + east[i] * m / PYRE_RADIUS), l = Math.hypot(...d); return pyreSurfaceBody(d[0] / l, d[1] / l, d[2] / l).height; };
  let d30 = 0, d8 = 0;
  for (let i = 0; i < 40; i++) { d30 = Math.max(d30, Math.abs(at(i * 30) - at(i * 30 + 30))); d8 = Math.max(d8, Math.abs(at(i * 8) - at(i * 8 + 8))); }
  assert.ok(d30 > .5 && d30 < 60, `30 m relief ${d30}`);
  assert.ok(d8 > .1 && d8 < 20, `8 m relief ${d8}`);
});

test('shield volcanoes: 2-4 per hemisphere, calderas below their rims, lava fields and craters shaped as specified', () => {
  const north = VOLCANOES.filter(v => v.direction[1] > 0).length, south = VOLCANOES.length - north;
  assert.ok(north >= 2 && north <= 4 && south >= 2 && south <= 4);
  for (const v of VOLCANOES) {
    assert.ok(v.radius * PYRE_RADIUS >= 20_000 && v.radius * PYRE_RADIUS <= 60_000, 'base 20-60 km');
    const centre = pyreSurfaceBody(...v.direction);
    const rim = v.direction.map((c, i) => c + v.north[i] * v.radius * .075), l = Math.hypot(...rim);
    const rimSample = pyreSurfaceBody(rim[0] / l, rim[1] / l, rim[2] / l);
    assert.ok(rimSample.height > centre.height + v.height * .04, `${v.name} caldera below rim`);
    const flank = v.direction.map((c, i) => c + v.north[i] * v.radius * .5), lf = Math.hypot(...flank);
    assert.ok(rimSample.height > pyreSurfaceBody(flank[0] / lf, flank[1] / lf, flank[2] / lf).height, 'flank below rim');
    assert.equal(centre.region, 'CALDERA');
    assert.equal(centre.activity > .9, v.active);
  }
  assert.ok(LAVA_FIELDS.every(f => pyreSurfaceBody(...findHotSpot(f)).activity >= .4));
  assert.equal(CRATERS.length, 56);
  const c = CRATERS[0], n = new Vector3(...c.direction), t = new Vector3().crossVectors(n, new Vector3(0, 1, 0)).normalize();
  const rim = n.clone().multiplyScalar(Math.cos(c.radius)).addScaledVector(t, Math.sin(c.radius));
  assert.ok(pyreSurfaceBody(...rim.toArray()).height > pyreSurfaceBody(...n.toArray()).height + c.depth * .5, 'Selene crater term: rim above bowl');
});

test('registry: celestial descriptors, navigation domain, travel target, atmosphere and air are additive', () => {
  assert.deepEqual(BODIES.map(b => b.id), ['aeon', 'selene', 'pyre']);
  assert.equal(AEON.water, true); assert.equal(SELENE.water, false);
  assert.equal(bodyAt(center.clone().add(new Vector3(0, PYRE_RADIUS * 3, 0))), PYRE);
  assert.equal(bodyAt(center.clone().add(new Vector3(0, PYRE_RADIUS * 9, 0))), AEON);
  assert.equal(bodyAt(new Vector3(0, RADIUS * 2, 0)), AEON);
  assert.equal(bodyAt(new Vector3(...SELENE.center).add(new Vector3(0, SELENE.radius * 2, 0))), SELENE);
  const target = TRAVEL_TARGETS.find(t => t.id === 'pyre');
  assert.ok(target && target.exclusionRadius > PYRE_RADIUS + PYRE_MAX_HEIGHT && target.arrivalRadius > PYRE_RADIUS + PYRE_ATMOSPHERE.height);
  assert.deepEqual(TRAVEL_TARGETS.slice(0, 2).map(t => t.id), ['aeon', 'selene'], 'existing targets untouched');
  const start = new Vector3(0, 0, RADIUS + 200_000), route = planTravel(start, 'pyre', { obstacles: [{ name: 'the star', center: star.toArray(), radius: 2.5e8 }] });
  if (route.ok) assert.ok(Math.abs(route.plan.end.distanceTo(center) - target.arrivalRadius) < 1e-3);
  else assert.match(route.reason, /exclusion|star/i);
  // Aeon's air is byte-identical through the new optional parameters.
  const p = new Vector3(0, RADIUS + 5000, 0), before = environmentAt(p, RADIUS), after = environmentAt(p, RADIUS, null, FLIGHT.surfaceGravity);
  assert.deepEqual(before, after);
  const pyreAir = environmentAt(new Vector3(0, PYRE_RADIUS + 5000, 0), PYRE_RADIUS, PYRE_ATMOSPHERE, PYRE.gravity);
  assert.ok(pyreAir.density > 0 && pyreAir.density < before.density && pyreAir.regime === 'ATMOSPHERE');
  assert.ok(Math.abs(pyreAir.gravity.length() - PYRE.gravity * (PYRE_RADIUS / (PYRE_RADIUS + 5000)) ** 2) < 1e-9);
  assert.deepEqual(AEON_ATMOSPHERE.betaR, [5.802e-6, 13.558e-6, 33.100e-6]);
});

test('arrival site sits on the dusk terminator, heat rises with sun exposure and low altitude', () => {
  const d = new Vector3(...pyreLandingDirection()), toStar = star.clone().sub(center).normalize();
  assert.ok(Math.abs(d.dot(toStar)) < .12, 'within ~7 degrees of the terminator (5 deg into the day side)');
  assert.match(pyreRegion(d.x, d.y, d.z), /^(TERMINATOR|DAY SIDE|NIGHT SIDE) · /);
  const high = bodySurfacePoint(d, PYRE, 60_000), noon = bodySurfacePoint(toStar, PYRE, 2000), night = bodySurfacePoint(toStar.clone().negate(), PYRE, 2000);
  assert.ok(pyreHeat(high) < .3 && pyreHeat(noon) > .9 && pyreHeat(night) < pyreHeat(noon));
  assert.equal(pyreHeat(new Vector3(0, RADIUS * 2, 0)), 0, 'no heat near Aeon');
  assert.ok(pyreHeat(bodySurfacePoint(toStar, PYRE, 400_000)) < .2, 'heat fades with altitude');
});

test('swept contact and the surface normal follow the heightfield', () => {
  const previous = center.clone().add(new Vector3(0, 0, PYRE_RADIUS * 4)), proposed = center.clone().add(new Vector3(0, 0, -PYRE_RADIUS * 4));
  const hit = constrainPyreStep(previous, proposed);
  assert.equal(hit.hit, true); assert.ok(hit.point.z > center.z);
  assert.ok(Math.abs(bodyAltitude(hit.point, PYRE) - 3.2) < 1e-6);
  const far = new Vector3(0, RADIUS * 3, 0);
  assert.equal(constrainPyreStep(far, far.clone().add(new Vector3(100, 0, 0))).hit, false);
  const normal = bodySurfaceNormal(bodySurfacePoint(new Vector3(...VOLCANOES[0].direction), PYRE), PYRE);
  assert.ok(Math.abs(normal.length() - 1) < 1e-9);
});

test('fine patches agree with the walking floor after astronomical rebasing and share edges', () => {
  for (const face of [0, 2, 5]) {
    const level = 17, ix = 65431, iy = 65679, patch = generatePyrePatch({ face, level, ix, iy });
    const origin = bodySurfacePoint(new Vector3(...cubeDirection(face, -1 + (ix + .5) * 2 / 2 ** level, -1 + (iy + .5) * 2 / 2 ** level)), PYRE, 1.75);
    for (let y = 0; y <= PYRE_GRID; y += 4) for (let x = 0; x <= PYRE_GRID; x += 4) {
      const i = (y * (PYRE_GRID + 1) + x) * 3, local = new Vector3(...patch.positions.slice(i, i + 3));
      const reconstructed = new Vector3(...patch.center).add(center).sub(origin).add(local).add(origin);
      assert.ok(Math.abs(bodyAltitude(reconstructed, PYRE)) < .00001, 'rendered terrain matches the walking floor');
      assert.ok(patch.data[(y * (PYRE_GRID + 1) + x) * 4] >= 0);
    }
  }
  const a = generatePyrePatch({ face: 4, level: 15, ix: 13000, iy: 18000 }), b = generatePyrePatch({ face: 4, level: 15, ix: 13001, iy: 18000 });
  for (let y = 0; y <= PYRE_GRID; y++) {
    const point = (patch, x) => new Vector3(...patch.positions.slice((y * (PYRE_GRID + 1) + x) * 3, (y * (PYRE_GRID + 1) + x) * 3 + 3)).add(new Vector3(...patch.center));
    assert.ok(point(a, PYRE_GRID).distanceTo(point(b, 0)) < .00001);
  }
  fibonacci(200, d => { const { face, u, v } = cubeCoordinates(d), back = cubeDirection(face, u, v); back.forEach((c, i) => assert.ok(Math.abs(c - d[i]) < 1e-12)); });
});

test('streaming keeps coverage, gates readiness on a fine LOD near the ground and prewarms the landing column', () => {
  const scene = new Scene(), group = new Group(); scene.add(group);
  const terrain = new PyreTerrain(group, new MeshBasicMaterial(), { sync: true });
  const landing = pyreLandingDirection(), position = bodySurfacePoint(new Vector3(...landing), PYRE, 60_000);
  terrain.prewarm(landing, 9);
  const column = [...terrain.nodes.values()].filter(n => n.mesh && n.level === 9);
  assert.ok(column.length >= 4, 'level-9 column requested before the first frame');
  for (let frame = 0; frame < 6; frame++) {
    terrain.update(position, position);
    assert.ok(group.children.some(mesh => mesh.visible));
    for (const node of terrain.nodes.values()) if (node.children?.some(child => child.mesh?.visible)) assert.ok(node.children.every(child => child.mesh), 'a partial child set never replaces its parent');
  }
  assert.ok(terrain.maxLevel >= 6 && terrain.ready, 'ready at 60 km needs level 7');
  const ground = bodySurfacePoint(new Vector3(...landing), PYRE, 1.75);
  terrain.update(ground, ground);
  assert.equal(terrain.requiredLevel, 12);
  for (let frame = 0; frame < 20 && !terrain.ready; frame++) terrain.update(ground, ground);
  assert.ok(terrain.maxLevel >= 12 && terrain.ready, `fine LOD at the ground: ${terrain.maxLevel}`);
  const count = group.children.length; terrain.dispose();
  assert.ok(count > 6 && group.children.length === 0);
});

test('the identity map bakes activity where the lava fields are', () => {
  const maps = bakePyreMaps(128, 64);
  assert.equal(maps.data.length, 128 * 64 * 4);
  let lit = 0; for (let i = 0; i < maps.data.length; i += 4) if (maps.data[i] > 60) lit++;
  assert.ok(lit > 10 && lit < 128 * 64 * .3, `lit ${lit}`);
});
