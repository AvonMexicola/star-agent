import test from 'node:test';
import assert from 'node:assert/strict';
import { createHostileSimulation, FAUNA_SPECIES, FAUNA_WEAPON_DAMAGE } from '../src/fauna/hostile-simulation.js';

const spawn = (id = 'bear', x = 40) => ({ id, position: [x, 0, 0], normal: [0, 1, 0], heading: 0, phase: .3 });
const player = (x = 42) => ({ position: [x, 1.75, 0], active: true, health: 100 });
const flat = (_species, p) => ({ position: [p[0], 0, p[2]], normal: [0, 1, 0] });
function fixture(species = 'pyrebear', options = {}) {
  const bites = [], sim = createHostileSimulation({ sampleGround: flat, onBite: (damage, info) => bites.push({ damage, ...info }), ...options });
  sim.reconcile([spawn()], species, [0, 1.75, 0]);
  return { sim, bites };
}
function advance(sim, seconds, p = player()) {
  const count = Math.round(seconds / .05);
  for (let i = 0; i < count; i++) sim.update(.05, p);
}

test('both species have intended health/weapons, deterministic patrol and stable reconciliation', () => {
  assert.equal(FAUNA_SPECIES.pyrebear.maxHealth, 240);
  assert.equal(FAUNA_SPECIES.suloher.maxHealth, 90);
  assert.deepEqual(FAUNA_WEAPON_DAMAGE, { rifle: 30, pistol: 18 });
  const a = fixture().sim, b = fixture().sim;
  advance(a, 2, player(0)); advance(b, 2, player(0));
  assert.deepEqual(a.entities, b.entities);
  const before = structuredClone(a.entities);
  a.reconcile([spawn()], 'pyrebear', [0, 1.75, 0]);
  assert.deepEqual(a.entities, before);
  assert.notDeepEqual(a.entities[0].position, [40, 0, 0]);
  const e = a.entities[0];
  assert.ok(Math.abs(Math.hypot(...e.forward)-1) < 1e-12);
  assert.ok(Math.abs(e.forward[1]) < 1e-12);
});

test('bear telegraphs .6s, deals14 and respects recovery plus the next windup', () => {
  const { sim, bites } = fixture();
  sim.update(.05, player()); assert.equal(sim.entities[0].state, 'windup');
  advance(sim, .55); assert.equal(bites.length, 0);
  sim.update(.05, player());
  assert.deepEqual(bites, [{ damage: 14, creatureName: 'Pyrebear' }]);
  assert.equal(sim.entities[0].state, 'recovery');
  advance(sim, 1.75); assert.equal(bites.length, 1);
  advance(sim, .8); assert.equal(bites.length, 2);
});

test('Suloher can reach a standing eye from1.5m horizontal distance but not a roof', () => {
  const { sim, bites } = fixture('suloher');
  advance(sim, .7, player(41.5));
  assert.deepEqual(bites, [{ damage: 8, creatureName: 'Suloher dog' }]);
  const roof = fixture('suloher');
  advance(roof.sim, 3, { ...player(40), position: [40, 5, 0] });
  assert.equal(roof.bites.length, 0);
});

test('impact rechecks escape range, vertical separation and obstructed line of sight', () => {
  for (const change of ['range', 'height', 'wall']) {
    let visible = true;
    const { sim, bites } = fixture('pyrebear', { lineOfSight: () => visible });
    advance(sim, .3);
    assert.equal(sim.entities[0].state, 'windup');
    const escaped = change === 'range' ? player(50) : change === 'height' ? { ...player(), position: [42, 5, 0] } : player();
    if (change === 'wall') visible = false;
    advance(sim, .4, escaped);
    assert.equal(bites.length, 0, change);
    assert.equal(sim.entities[0].state, 'recovery');
  }
});

test('wall-blocked aggro and swept movement never move a creature through an obstacle', () => {
  const wall = fixture('pyrebear', { lineOfSight: () => false, canMove: () => false });
  advance(wall.sim, 2);
  assert.equal(wall.bites.length, 0);
  assert.equal(wall.sim.entities[0].state, 'patrol');
  assert.deepEqual(wall.sim.entities[0].position, [40, 0, 0]);
  const blocked = fixture('pyrebear', { canMove: () => false });
  advance(blocked.sim, 1, player(50));
  assert.equal(blocked.sim.entities[0].state, 'chase');
  assert.deepEqual(blocked.sim.entities[0].position, [40, 0, 0]);
  assert.equal(blocked.sim.entities[0].speed, 0);
});

test('finite substeps, unsafe ground and discontinuous ground callbacks prevent teleports', () => {
  let maxSegment = 0;
  const bounded = fixture('suloher', { canMove: (from, to) => { maxSegment = Math.max(maxSegment, Math.hypot(...to.map((v, i) => v-from[i]))); return true; } });
  bounded.sim.update(10, player(60));
  assert.equal(bounded.sim.state.steps, 5);
  assert.equal(bounded.sim.state.droppedTime, 9.75);
  assert.ok(maxSegment <= .2 + 1e-12);
  assert.ok(bounded.sim.entities[0].position[0] <= 41.00001);
  for (const sampleGround of [() => null, (_s, p) => ({ position: [p[0]+100, 0, 0], normal: [0, 1, 0] })]) {
    const { sim } = fixture('pyrebear', { sampleGround });
    advance(sim, 1, player(50)); assert.deepEqual(sim.entities[0].position, [40, 0, 0]);
  }
});

test('leash escape returns toward home instead of following a distant player', () => {
  const { sim } = fixture();
  advance(sim, 1, player(55));
  assert.ok(sim.entities[0].position[0] > 40);
  advance(sim, .1, player(200));
  assert.equal(sim.entities[0].state, 'return');
  advance(sim, 3, player(200));
  assert.ok(Math.hypot(...sim.entities[0].position.map((v, i) => v-sim.entities[0].home[i])) < 8);
});

test('zero dt freezes attack/death clocks; inactive or downed players cannot be bitten', () => {
  const { sim, bites } = fixture();
  advance(sim, .3);
  const before = structuredClone(sim.entities);
  for (const dt of [0, -1, NaN, Infinity]) sim.update(dt, player());
  assert.deepEqual(sim.entities, before);
  advance(sim, 1, { ...player(), active: false });
  assert.equal(bites.length, 0);
  assert.equal(sim.entities[0].state, 'return');
  advance(sim, 1, { ...player(), health: 0 });
  assert.equal(bites.length, 0);
  sim.hit('bear', 1000);
  const death = structuredClone(sim.entities);
  sim.update(0, player()); assert.deepEqual(sim.entities, death);
  sim.update(.1, player()); assert.ok(sim.entities[0].deathTime > 0);
});

test('global cap8,30m spawn exclusion and600m unloading apply across both species', () => {
  const { sim } = fixture();
  sim.reconcile([spawn('too-close', 10), spawn('too-far', 510)], 'suloher', [0, 1.75, 0]);
  assert.equal(sim.entities.length, 1);
  sim.reconcile(Array.from({ length: 5 }, (_, i) => spawn(`b${i}`, 80+i*30)), 'pyrebear', [0, 1.75, 0]);
  sim.reconcile(Array.from({ length: 5 }, (_, i) => spawn(`d${i}`, 100+i*30)), 'suloher', [0, 1.75, 0]);
  assert.equal(sim.entities.length, 8);
  assert.equal(new Set(sim.entities.map(e => e.id)).size, 8);
  sim.reconcile([], null, [2000, 1.75, 0]); assert.equal(sim.entities.length, 0);
});

test('wounds survive unload; corpses hold their pose and defeated IDs never respawn', () => {
  const { sim, bites } = fixture();
  assert.equal(sim.hit('bear', 30).health, 210);
  sim.reconcile([], 'pyrebear', [2000, 1.75, 0]);
  sim.reconcile([spawn()], 'pyrebear', [0, 1.75, 0]);
  assert.equal(sim.entities[0].health, 210);
  assert.deepEqual(sim.hit('bear', 210), { ok: true, killed: true, damage: 210, health: 0 });
  const pose = [...sim.entities[0].position];
  advance(sim, 3); assert.equal(bites.length, 0);
  assert.deepEqual(sim.entities[0].position, pose);
  assert.equal(sim.entities[0].state, 'dead');
  assert.equal(sim.hit('bear', 1).ok, false);
  sim.reconcile([spawn()], 'pyrebear', [0, 1.75, 0]); assert.equal(sim.entities[0].state, 'dead');
  sim.reconcile([], 'pyrebear', [2000, 1.75, 0]);
  sim.reconcile([spawn()], 'pyrebear', [0, 1.75, 0]); assert.equal(sim.entities.length, 0);
  assert.equal(sim.state.defeated, 1);
});

test('multiple attackers stop publishing bites once this update downs the player', () => {
  const { sim, bites } = fixture();
  sim.reconcile([spawn('other', 40.5)], 'pyrebear', [0, 1.75, 0]);
  advance(sim, .6, { ...player(), health: 5 });
  sim.update(.1, { ...player(), health: 5 });
  assert.equal(bites.length, 1);
});

test('invalid hits cannot heal, poison health or restart death', () => {
  const { sim } = fixture();
  for (const damage of [0, -10, NaN, Infinity]) assert.equal(sim.hit('bear', damage).ok, false);
  assert.equal(sim.hit('missing', 30).ok, false);
  assert.equal(sim.entities[0].health, 240);
});

test('attack audio cue fires once at windup entry and stays silent while paused',()=>{
 const cues=[],{sim}=fixture('pyrebear',{onAttack:event=>cues.push(event)});
 sim.update(.05,player());assert.equal(cues.length,1);assert.equal(cues[0].type,'creature-attack');assert.equal(cues[0].species,'pyrebear');
 sim.update(0,player());advance(sim,.55);assert.equal(cues.length,1);
 advance(sim,.1);advance(sim,1.8);advance(sim,.1);assert.equal(cues.length,2);
});
