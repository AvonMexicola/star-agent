import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { shoot, capsuleDistance, shipDistance } from '../server/combat.js';
import { SHIP_LAYOUT } from '../src/boarding.js';
import { AEON, bodySurfacePoint } from '../src/celestial.js';
import { buildStationColliders } from '../src/station-collision.js';

const UP = new THREE.Vector3(0, 1, 0), FORWARD = new THREE.Vector3(0, 0, -1);
const HEIGHT = 1_900_000;
function player(id, x = 0, z = 0, extra = {}) {
  const p = { id, health: 100, shipHealth: 100, weapon: 'rifle-laser', lastShotAt: -Infinity,
    inventory: { revision: 0, containers: { pack: { 'rifle-laser': 1, 'sidearm-pistol': 1, 'mining-laser-tool': 1, 'carbine-charge': 10, 'sidearm-charge': 10 } } },
    nav: { position: new THREE.Vector3(x, HEIGHT, z), orientation: new THREE.Quaternion(),
      normal: UP.clone(), mode: 'walk', shipPosition: null, shipOrientation: new THREE.Quaternion(), shipId: 'nomad', layout: SHIP_LAYOUT }, ...extra };
  return p;
}
const near = (actual, expected, tolerance = 1e-6) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);
const fire = (shooter, targets = [], world = {}, now = 1000, extra = {}) => shoot({ shooter, players: [shooter, ...targets], world, now, ...extra });

test('only healthy on-foot/EVA players with their own weapon and compatible pack ammo may fire', () => {
  for (const patch of [p => p.health = 0, p => p.health = NaN, p => p.nav.mode = 'flight', p => p.nav.mode = 'landed',
    p => p.weapon = null, p => p.weapon = 'mining-laser-tool', p => p.weapon = 'unknown',
    p => p.inventory.containers.pack['rifle-laser'] = 0, p => p.inventory.containers.pack['carbine-charge'] = 0,
    p => p.inventory.containers.pack['carbine-charge'] = 1.5, p => p.nav.position.x = Infinity,
    p => p.nav.orientation.w = 99]) {
    const shooter = player('self'); patch(shooter);
    const before = structuredClone(shooter.inventory);
    assert.equal(fire(shooter), null);
    assert.deepEqual(shooter.inventory, before);
    assert.equal(shooter.lastShotAt, -Infinity);
  }
  const eva = player('eva'); eva.nav.mode = 'eva';
  assert.ok(fire(eva));
});

test('misses spend one round; cooldown, weapon switching and clock rollback cannot double fire', () => {
  const shooter = player('self');
  const shot = fire(shooter);
  assert.equal(shot.kind, null);
  assert.equal(shot.damage, 0);
  assert.equal(shot.distance, 250);
  assert.equal(shooter.inventory.containers.pack['carbine-charge'], 9);
  assert.equal(shooter.inventory.revision, 1);
  assert.equal(fire(shooter, [], {}, 1000), null);
  assert.equal(fire(shooter, [], {}, 1179), null);
  assert.equal(fire(shooter, [], {}, 500), null);
  shooter.weapon = 'sidearm-pistol';
  assert.equal(fire(shooter, [], {}, 1180), null);
  assert.ok(fire(shooter, [], {}, 1300));
  assert.equal(shooter.inventory.containers.pack['sidearm-charge'], 9);
});

test('closest capsule receives server damage independently of player iteration order', () => {
  const shooter = player('self'), nearTarget = player('near', 0, -10), farTarget = player('far', 0, -20);
  const shot = fire(shooter, [farTarget, nearTarget]);
  assert.equal(shot.targetId, 'near');
  assert.equal(shot.kind, 'player');
  assert.equal(shot.damage, 25);
  near(shot.distance, 10 - Math.sqrt(.25 ** 2 - .05 ** 2));
  assert.equal(nearTarget.health, 75);
  assert.equal(farTarget.health, 100);
});

test('capsule uses rounded head/side surfaces rather than a large player box', () => {
  const eye = new THREE.Vector3(0, 1.75, -10);
  const center = new THREE.Vector3(0, 1.75, 0);
  assert.ok(Number.isFinite(capsuleDistance(center, FORWARD, eye, UP)));
  const diagonal = center.clone().add(new THREE.Vector3(.24, .18, 0));
  assert.equal(capsuleDistance(diagonal, FORWARD, eye, UP), Infinity, 'rounded head corner is empty');
  assert.equal(capsuleDistance(center.clone().add(new THREE.Vector3(.251, -.7, 0)), FORWARD, eye, UP), Infinity);
  near(capsuleDistance(new THREE.Vector3(0, 5, -10), UP.clone().negate(), eye, UP), 3.05);
});

test('misses, dead bodies and out-of-range players do not receive damage', () => {
  const shooter = player('self'), side = player('side', .3, -10), far = player('far', 0, -251), dead = player('dead', 0, -5, { health: 0 });
  const shot = fire(shooter, [side, far, dead]);
  assert.equal(shot.kind, null);
  assert.equal(side.health, 100);
  assert.equal(far.health, 100);
  assert.equal(dead.health, 0);
});

test('authoritative occlusion and real station wall/door collision block damage', () => {
  const target = player('target', 0, -20);
  const blocked = fire(player('self'), [target], { occludes: () => 4 });
  assert.equal(blocked.targetId, undefined);
  assert.equal(blocked.distance, 4);
  const wall = new THREE.Mesh(new THREE.BoxGeometry(4, 4, .2), new THREE.MeshBasicMaterial());
  wall.position.set(0, 0, -5);
  const tree = buildStationColliders(wall);
  const pod = { colliders: tree, doorBoxes: [], toLocal: (point, out) => out.copy(point).sub(new THREE.Vector3(0, HEIGHT, 0)) };
  const wallHit = fire(player('self'), [target], { pods: [pod] });
  assert.equal(wallHit.kind, null);
  assert.ok(wallHit.distance > 4.8 && wallHit.distance < 5);
  const door = new THREE.Box3(new THREE.Vector3(-2, -2, -3), new THREE.Vector3(2, 2, -2.9));
  pod.colliders = null; pod.doorBoxes = [door];
  const doorHit = fire(player('self'), [target], { pods: [pod] });
  assert.ok(doorHit.distance > 2.8 && doorHit.distance < 3);
  assert.equal(target.health, 100);
  pod.doorBoxes = [];
  assert.equal(fire(player('self'), [target], { pods: [pod] }).targetId, 'target');
  wall.geometry.dispose(); wall.material.dispose();
});

test('canonical planetary terrain stops a downward shot before a buried target', () => {
  const shooter = player('self'), target = player('buried');
  const normal = new THREE.Vector3(.2, .9, .3).normalize();
  shooter.nav.position.copy(bodySurfacePoint(normal, AEON, 2));
  const down = normal.clone().negate();
  shooter.nav.orientation.setFromUnitVectors(FORWARD, down);
  target.nav.position.copy(shooter.nav.position).addScaledVector(down, 10);
  target.nav.normal.copy(normal);
  const shot = fire(shooter, [target]);
  assert.equal(shot.kind, null);
  assert.ok(shot.distance > 1.99 && shot.distance < 2.01, `canonical terrain hit at ${shot.distance}`);
  assert.equal(target.health, 100);
});

test('hull OBB takes the hit and shields pilots/occupants, including parked ships', () => {
  const shooter = player('self'), owner = player('owner', 50, -20), occupant = player('occupant', 0, -20);
  owner.nav.shipPosition = new THREE.Vector3(0, HEIGHT - 2, -20);
  const shot = fire(shooter, [occupant, owner]);
  assert.equal(shot.kind, 'ship');
  assert.equal(shot.targetId, 'owner');
  assert.equal(owner.shipHealth, 75);
  assert.equal(occupant.health, 100);
  const pilot = player('pilot', 0, -20); pilot.nav.mode = 'flight';
  const pilotHit = fire(player('self'), [pilot]);
  assert.equal(pilotHit.kind, 'ship');
  assert.equal(pilot.shipHealth, 75);
  assert.equal(pilot.health, 100);
});

test('rotated ship bounds and huge double coordinates preserve local hit distances', () => {
  const rotation = new THREE.Quaternion().setFromAxisAngle(UP, Math.PI / 2);
  const position = new THREE.Vector3(25_000_000_000, HEIGHT, -20);
  const origin = new THREE.Vector3(25_000_000_000, HEIGHT + 2, 0);
  near(shipDistance(origin, FORWARD, position, rotation, SHIP_LAYOUT.flightBounds), 20 - 6.05, 1e-5);
  const shooter = player('self', 25_000_000_000.125), target = player('target', 25_000_000_000.125, -20);
  const shot = fire(shooter, [target]);
  assert.equal(shot.targetId, 'target');
  near(shot.origin[0], 25_000_000_000.125);
  near(shot.distance, 20 - Math.sqrt(.25 ** 2 - .05 ** 2), 1e-4);
});

test('own hull and destroyed hulls block fire without self damage or shooting through wrecks', () => {
  const shooter = player('self'); shooter.nav.shipPosition = new THREE.Vector3(0, HEIGHT - 2, -20);
  const target = player('target', 0, -30);
  const shot = fire(shooter, [target]);
  assert.equal(shot.kind, null);
  assert.equal(target.health, 100);
  assert.equal(shooter.shipHealth, 100);
  const wreck = player('wreck', 10, -20, { shipHealth: 0 });
  wreck.nav.shipPosition = new THREE.Vector3(0, HEIGHT - 2, -20);
  const wreckHit = fire(player('fresh'), [target, wreck]);
  assert.equal(wreckHit.kind, null);
  assert.equal(wreck.shipHealth, 0);
  assert.equal(target.health, 100);
});

test('forged event ray/target/damage cannot override server pose and weapon rules; health clamps at zero', () => {
  const shooter = player('self'), target = player('target', 0, -10, { health: 12 }), sideways = player('forged', 20, 0);
  const shot = fire(shooter, [target, sideways], {}, 1000, {
    origin: [20, HEIGHT, 1], direction: [0, 0, -1], targetId: 'forged', damage: Infinity, range: 1e20,
  });
  assert.deepEqual(shot.origin, shooter.nav.position.toArray());
  assert.equal(shot.targetId, 'target');
  assert.equal(shot.damage, 12);
  assert.equal(target.health, 0);
  assert.equal(sideways.health, 100);
});
