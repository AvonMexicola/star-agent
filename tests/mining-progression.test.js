import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultMiningProgression, validMiningProgression, awardMiningXP, miningSkill, MAX_MINING_LEVEL, MAX_MINING_XP } from '../src/mining/progression.js';

test('mining skill starts at level one and advances only on collected mass', () => {
  const fresh = defaultMiningProgression();
  assert.deepEqual(miningSkill(fresh), {level:1,xp:0,levelXP:0,requiredXP:1000,nextLevelXP:1000,progress:0,atMaxLevel:false});
  assert.equal(awardMiningXP(fresh, 0), fresh, 'empty or exhausted cuts do not award XP');
  const partial = awardMiningXP(fresh, 2.5);
  assert.equal(miningSkill(partial).progress, .25);
  const leveled = awardMiningXP(partial, 7.5);
  assert.deepEqual(miningSkill(leveled), {level:2,xp:1000,levelXP:0,requiredXP:2000,nextLevelXP:3000,progress:0,atMaxLevel:false});
  assert.equal(miningSkill(awardMiningXP(leveled, 20)).level, 3);
  assert.equal(fresh.mining.xp, 0, 'prospective awards never mutate the preceding save');
});

test('fractional cuts and one large cut earn equal XP within numeric tolerance', () => {
  let split = defaultMiningProgression();
  for (let i = 0; i < 1000; i++) split = awardMiningXP(split, .00001);
  const single = awardMiningXP(defaultMiningProgression(), .01);
  assert.ok(Math.abs(split.mining.xp - single.mining.xp) < 1e-10);
  assert.ok(split.mining.xp > .99, 'small cuts are not individually rounded away');
  assert.deepEqual(JSON.parse(JSON.stringify(split)), split, 'fractional XP survives persistence');
});

test('progression rejects malformed saves and invalid accepted mass', () => {
  for (const bad of [null, [], {}, {mining:null}, {mining:[]}, {mining:{xp:-1}}, {mining:{xp:'1'}}, {mining:{xp:NaN}}, {mining:{xp:Infinity}}, {mining:{xp:MAX_MINING_XP+1}}]) {
    assert.equal(validMiningProgression(bad), false);
    assert.throws(() => miningSkill(bad), TypeError);
  }
  for (const bad of [-1, NaN, Infinity, '1', null]) assert.throws(() => awardMiningXP(defaultMiningProgression(), bad), TypeError);
});

test('level cap stays finite and awards preserve unrelated progression fields', () => {
  const old = {...defaultMiningProgression(), exploration:{xp:42}};
  const capped = awardMiningXP(old, Number.MAX_VALUE);
  assert.equal(capped.mining.xp, MAX_MINING_XP);
  assert.deepEqual(capped.exploration, {xp:42});
  assert.deepEqual(miningSkill(capped), {level:MAX_MINING_LEVEL,xp:MAX_MINING_XP,levelXP:0,requiredXP:0,nextLevelXP:null,progress:1,atMaxLevel:true});
  assert.equal(awardMiningXP(capped, 1), capped);
  assert.equal(old.mining.xp, 0);
});
