// Unit checks for src/character.js — pure logic only, no WebGL context needed.
//   node --test --test-isolation=none tests/character.test.js
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CLIPS, STATES, SPEED, STRIDE, WOUNDED_HEALTH, CLIP_FALLBACKS, FALLBACK_TIME_SCALE,
  resolveState, returnStateAfterOneShot, blendWeights, locomotionTimeScale,
  resolveClip, walkClipForState, isLocomotionState, isUpperBodyTrack,
  Character, CharacterCamera,
} from '../src/character.js';

const ALL = new Set(CLIPS);
const base = (over = {}) => ({
  speed: 0, grounded: true, jumping: false, crouching: false, carrying: false,
  health: 1, aiming: 'none', firing: false, seated: false, ...over,
});

// ------------------------------------------------------------------- contract

test('the clip contract retains locomotion and adds traversal, gestures and distinct equipment poses', () => {
  assert.deepEqual([...CLIPS], [
    'idle', 'walk', 'run', 'jump', 'crouch-walk', 'sit-down', 'sit-idle', 'stand-up',
    'carry-walk', 'wounded-walk', 'aim-rifle', 'fire-rifle', 'fire-pistol', 'death',
    'crouch-idle','crouch-strafe-left','crouch-strafe-right','crouch-backward','walk-backward','strafe-left','strafe-right','stand-to-crouch','crouch-to-stand',
    'rest-pose', 'climb-ladder', 'climb-idle', 'wave', 'take-damage', 'aim-pistol',
    'use-tool', 'reload-rifle', 'reload-pistol', 'interact',
    'climb-mount', 'climb-finish',
  ]);
  assert.equal(new Set(CLIPS).size, CLIPS.length);
});

test('every contract clip has a fallback chain and every chain member is a contract clip', () => {
  for (const name of CLIPS) {
    assert.ok(Array.isArray(CLIP_FALLBACKS[name]), `${name} has no fallback entry`);
    for (const candidate of CLIP_FALLBACKS[name]) {
      assert.ok(CLIPS.includes(candidate), `${name} falls back to unknown clip ${candidate}`);
      assert.notEqual(candidate, name);
    }
  }
});

test('the module exports the classes main.js wires in', () => {
  assert.equal(typeof Character, 'function');
  assert.equal(typeof CharacterCamera, 'function');
});

// -------------------------------------------------------------- state resolution

test('state resolution table', () => {
  const cases = [
    // [description, input, prevState, expected]
    ['standing still', base(), 'idle', 'idle'],
    ['creeping below the idle threshold', base({ speed: 0.2 }), 'idle', 'idle'],
    ['just over the idle threshold', base({ speed: 0.21 }), 'idle', 'walk'],
    ['brisk walk', base({ speed: 1.6 }), 'walk', 'walk'],
    ['exactly at the run threshold', base({ speed: SPEED.run }), 'walk', 'run'],
    ['sprint', base({ speed: 6 }), 'run', 'run'],

    ['crouch-walking', base({ speed: 1.2, crouching: true }), 'walk', 'crouch'],
    ['crouched and still', base({ crouching: true }), 'idle', 'crouch'],
    ['crouch beats a run speed', base({ speed: 6, crouching: true }), 'run', 'crouch'],

    ['carrying cargo at walking pace', base({ speed: 1.2, carrying: true }), 'walk', 'carry'],
    ['carrying while standing', base({ carrying: true }), 'idle', 'carry'],

    ['hurt below 40 % health', base({ speed: 1.2, health: 0.39 }), 'walk', 'wounded'],
    ['exactly at 40 % health is not wounded', base({ speed: 1.2, health: WOUNDED_HEALTH }), 'walk', 'walk'],
    ['wounded outranks carrying', base({ speed: 1.2, health: 0.2, carrying: true }), 'walk', 'wounded'],
    ['crouch outranks wounded', base({ speed: 1.2, health: 0.2, crouching: true }), 'walk', 'crouch'],

    ['airborne by jump flag', base({ jumping: true }), 'idle', 'jump'],
    ['airborne because not grounded', base({ speed: 3, grounded: false }), 'run', 'jump'],
    ['jump outranks crouch', base({ jumping: true, crouching: true }), 'idle', 'jump'],

    ['seated outranks the jump', base({ seated: true, jumping: true }), 'idle', 'sit'],
    ['seated while carrying', base({ seated: true, carrying: true }), 'walk', 'sit'],

    ['standing aim reads as its own pose', base({ aiming: 'rifle' }), 'idle', 'aim-rifle'],
    ['a pistol has a distinct aim pose', base({ aiming: 'pistol' }), 'idle', 'aim-pistol'],
    ['a tool has a distinct working pose', base({ aiming: 'tool' }), 'idle', 'use-tool'],
    ['ladder traversal releases weapon aiming', base({ climbing: true, aiming: 'rifle', firing: true }), 'fire-rifle', 'climb'],
    ['sitting releases a held trigger', base({ seated: true, aiming: 'rifle', firing: true }), 'fire-rifle', 'sit'],
    ['rest pose is available for inspection', base({ resting: true }), 'idle', 'rest'],
    ['aiming while walking keeps the locomotion base', base({ speed: 1.2, aiming: 'rifle' }), 'walk', 'walk'],
    ['aiming while running keeps the run base', base({ speed: 5, aiming: 'rifle' }), 'run', 'run'],

    ['firing a rifle', base({ aiming: 'rifle', firing: true }), 'idle', 'fire-rifle'],
    ['firing a pistol', base({ aiming: 'pistol', firing: true }), 'idle', 'fire-pistol'],
    ['firing while running still fires', base({ speed: 5, aiming: 'rifle', firing: true }), 'run', 'fire-rifle'],
    ['firing without a weapon raised is ignored', base({ firing: true }), 'idle', 'idle'],

    ['zero health is death', base({ health: 0 }), 'run', 'dead'],
    ['negative health is death', base({ health: -1 }), 'idle', 'dead'],
    ['an explicit dead flag', base({ dead: true }), 'walk', 'dead'],
    ['death outranks everything', base({ health: 0, seated: true, firing: true, aiming: 'rifle' }), 'idle', 'dead'],
  ];
  for (const [description, input, prev, expected] of cases) {
    assert.equal(resolveState(input, prev), expected, description);
  }
});

test('every resolved state is a declared state', () => {
  for (const speed of [0, 0.5, 1.5, 3, 8]) {
    for (const health of [0, 0.2, 1]) {
      for (const aiming of ['none', 'rifle', 'pistol']) {
        for (const flag of ['crouching', 'carrying', 'seated', 'jumping', 'firing', null]) {
          const input = base({ speed, health, aiming });
          if (flag) input[flag] = true;
          assert.ok(STATES.includes(resolveState(input, 'idle')), JSON.stringify(input));
        }
      }
    }
  }
});

test('resolveState is pure: it does not touch the input object', () => {
  const input = base({ speed: 3, aiming: 'rifle', firing: true });
  const before = JSON.stringify(input);
  resolveState(input, 'idle');
  resolveState(input, 'fire-rifle');
  returnStateAfterOneShot('fire-rifle', input);
  assert.equal(JSON.stringify(input), before);
});

test('missing or malformed input degrades to idle rather than throwing', () => {
  assert.equal(resolveState(undefined, 'idle'), 'idle');
  assert.equal(resolveState({}, 'idle'), 'idle');
  assert.equal(resolveState({ speed: NaN, health: NaN }, 'idle'), 'idle');
  assert.equal(resolveState({ speed: -5 }, 'idle'), 'idle');
});

// -------------------------------------------------- one-shot return-to-previous

test('a held trigger stays in its fire state instead of retriggering every frame', () => {
  const input = base({ speed: 1.2, aiming: 'rifle', firing: true });
  assert.equal(resolveState(input, 'walk'), 'fire-rifle');
  assert.equal(resolveState(input, 'fire-rifle'), 'fire-rifle');
  assert.equal(resolveState(input, 'fire-pistol'), 'fire-pistol', 'a held trigger does not switch weapons mid-shot');
});

test('a finished fire one-shot returns to the state the input describes', () => {
  // Fired from a standing aim, trigger still held: the shot ends back in the aim pose.
  assert.equal(returnStateAfterOneShot('fire-rifle', base({ aiming: 'rifle', firing: true })), 'aim-rifle');
  // Fired while running: back to the run.
  assert.equal(returnStateAfterOneShot('fire-rifle', base({ speed: 5, aiming: 'rifle', firing: true })), 'run');
  // Fired while walking wounded: back to the limp.
  assert.equal(returnStateAfterOneShot('fire-pistol', base({ speed: 1.2, health: 0.2, aiming: 'pistol', firing: true })), 'wounded');
  // Fired and then killed: death wins over the return.
  assert.equal(returnStateAfterOneShot('fire-rifle', base({ health: 0, aiming: 'rifle', firing: true })), 'dead');
  // The trigger released before the clip ended.
  assert.equal(returnStateAfterOneShot('fire-pistol', base({ speed: 0.4, aiming: 'pistol' })), 'walk');
});

test('the return state is never another fire state, so a one-shot cannot loop', () => {
  for (const state of ['fire-rifle', 'fire-pistol']) {
    for (const aiming of ['rifle', 'pistol']) {
      const next = returnStateAfterOneShot(state, base({ speed: 2, aiming, firing: true }));
      assert.notEqual(next, 'fire-rifle');
      assert.notEqual(next, 'fire-pistol');
    }
  }
});

test('death is terminal while health stays at zero, and releases on revival', () => {
  assert.equal(resolveState(base({ health: 0, speed: 4 }), 'dead'), 'dead');
  assert.equal(resolveState(base({ health: 1, speed: 4 }), 'dead'), 'run');
});

// ---------------------------------------------------------------- clip fallbacks

test('a complete rig uses every authored clip directly', () => {
  for (const name of CLIPS) {
    const info = resolveClip(name, ALL);
    assert.deepEqual(info, { name, source: name, fallback: false, timeScale: 1 });
  }
});

test('fallback mapping when clips are missing', () => {
  const minimal = new Set(['idle', 'walk']);
  const expected = {
    'crouch-idle':['idle',1], 'crouch-strafe-left':['idle',1], 'crouch-strafe-right':['idle',1], 'crouch-backward':['idle',1], 'walk-backward':['walk',1], 'strafe-left':['walk',1], 'strafe-right':['walk',1], 'stand-to-crouch':['idle',1], 'crouch-to-stand':['idle',1],
    'idle': ['idle', 1],
    'walk': ['walk', 1],
    'run': ['walk', FALLBACK_TIME_SCALE.run],
    'jump': ['idle', 1],
    'crouch-walk': ['walk', FALLBACK_TIME_SCALE['crouch-walk']],
    'carry-walk': ['walk', 1],
    'wounded-walk': ['walk', FALLBACK_TIME_SCALE['wounded-walk']],
    'sit-down': ['idle', 1],
    'sit-idle': ['idle', 1],
    'stand-up': ['idle', 1],
    'aim-rifle': ['idle', 1],
    'fire-rifle': ['idle', 1],
    'fire-pistol': ['idle', 1],
    'death': ['idle', 1],
    'rest-pose': ['idle', 1], 'climb-ladder': ['idle', 1], 'climb-idle': ['idle', 1],
    'wave': ['idle', 1], 'take-damage': ['idle', 1], 'aim-pistol': ['idle', 1],
    'use-tool': ['idle', 1], 'reload-rifle': ['idle', 1], 'reload-pistol': ['idle', 1],
    'interact': ['idle', 1], 'climb-mount': ['idle', 1], 'climb-finish': ['idle', 1],
  };
  for (const name of CLIPS) {
    const info = resolveClip(name, minimal);
    const [source, timeScale] = expected[name];
    assert.equal(info.source, source, `${name} → ${info.source}, expected ${source}`);
    assert.equal(info.timeScale, timeScale, `${name} time scale`);
    assert.equal(info.fallback, name !== source || !minimal.has(name));
  }
});

test('wounded-walk falls back to a slowed walk and run to a sped-up walk', () => {
  const noVariants = new Set(['idle', 'walk']);
  assert.ok(resolveClip('wounded-walk', noVariants).timeScale < 1);
  assert.ok(resolveClip('run', noVariants).timeScale > 1);
});

test('walk falls back to run when only a run exists', () => {
  const info = resolveClip('walk', new Set(['idle', 'run']));
  assert.equal(info.source, 'run');
  assert.ok(info.timeScale < 1, 'a run used as a walk plays slower');
});

test('the fire chain degrades through aim before idle', () => {
  assert.equal(resolveClip('fire-pistol', new Set(['idle', 'fire-rifle'])).source, 'fire-rifle');
  assert.equal(resolveClip('fire-pistol', new Set(['idle', 'aim-rifle'])).source, 'aim-rifle');
  assert.equal(resolveClip('fire-rifle', new Set(['idle'])).source, 'idle');
});

test('the seat chain degrades to whatever the seat has', () => {
  assert.equal(resolveClip('sit-down', new Set(['idle', 'sit-idle'])).source, 'sit-idle');
  assert.equal(resolveClip('stand-up', new Set(['idle', 'sit-down'])).source, 'sit-down');
});

test('an animation-free GLB reports no source instead of crashing', () => {
  for (const name of CLIPS) {
    const info = resolveClip(name, new Set());
    assert.equal(info.source, null);
    assert.equal(info.fallback, true);
  }
});

test('resolveClip accepts a Set, an array or a plain object', () => {
  assert.equal(resolveClip('run', ['idle', 'run']).source, 'run');
  assert.equal(resolveClip('run', { idle: true, walk: true }).source, 'walk');
});

test('a rig with an unrelated single clip still resolves to something playable', () => {
  const info = resolveClip('walk', new Set(['t-pose']));
  assert.equal(info.source, 't-pose');
  assert.equal(info.fallback, true);
});

// ----------------------------------------------------------------- blend weights

test('blend weights follow the 0.2 / 2.2 m/s thresholds', () => {
  assert.deepEqual(blendWeights(0), { idle: 1, walk: 0, run: 0 });
  assert.deepEqual(blendWeights(SPEED.idle), { idle: 1, walk: 0, run: 0 });
  assert.deepEqual(blendWeights(SPEED.walkFull), { idle: 0, walk: 1, run: 0 });
  assert.deepEqual(blendWeights(SPEED.run), { idle: 0, walk: 1, run: 0 });
  assert.deepEqual(blendWeights(SPEED.runFull), { idle: 0, walk: 0, run: 1 });
  assert.deepEqual(blendWeights(20), { idle: 0, walk: 0, run: 1 });
});

test('blend weights always sum to one and stay in range', () => {
  for (let speed = -1; speed <= 8; speed += 0.05) {
    const w = blendWeights(speed);
    assert.ok(Math.abs(w.idle + w.walk + w.run - 1) < 1e-9, `sum at ${speed}`);
    for (const value of [w.idle, w.walk, w.run]) {
      assert.ok(value >= 0 && value <= 1, `range at ${speed}`);
    }
  }
});

test('the idle→walk and walk→run blends are monotonic', () => {
  let previousIdle = 1, previousRun = 0;
  for (let speed = 0; speed <= 6; speed += 0.05) {
    const w = blendWeights(speed);
    assert.ok(w.idle <= previousIdle + 1e-12, `idle rises at ${speed}`);
    assert.ok(w.run >= previousRun - 1e-12, `run falls at ${speed}`);
    previousIdle = w.idle; previousRun = w.run;
  }
});

test('blendWeights writes into a caller-supplied object (no per-frame allocation)', () => {
  const out = { idle: 0, walk: 0, run: 0 };
  const returned = blendWeights(3, out);
  assert.equal(returned, out);
  assert.ok(out.run > 0 && out.walk > 0);
});

test('halfway between thresholds the two clips share the weight', () => {
  const mid = blendWeights((SPEED.idle + SPEED.walkFull) / 2);
  assert.ok(Math.abs(mid.idle - 0.5) < 1e-9 && Math.abs(mid.walk - 0.5) < 1e-9);
  const fast = blendWeights((SPEED.run + SPEED.runFull) / 2);
  assert.ok(Math.abs(fast.walk - 0.5) < 1e-9 && Math.abs(fast.run - 0.5) < 1e-9);
});

// ------------------------------------------------------------------- time scales

test('the walk clip plays at 1x at its authored stride speed', () => {
  assert.equal(locomotionTimeScale(STRIDE.walk, 'walk'), 1);
  assert.equal(locomotionTimeScale(STRIDE.run, 'run'), 1);
});

test('time scale is proportional to speed inside the clamp band', () => {
  assert.ok(Math.abs(locomotionTimeScale(STRIDE.walk / 2, 'walk') - 0.5) < 1e-12);
  assert.ok(Math.abs(locomotionTimeScale(STRIDE.walk * 1.5, 'walk') - 1.5) < 1e-12);
  assert.ok(Math.abs(locomotionTimeScale(STRIDE.run * 1.2, 'run') - 1.2) < 1e-12);
});

test('time scale is clamped so the feet never scrub or freeze', () => {
  assert.equal(locomotionTimeScale(0, 'walk'), 0.5);
  assert.equal(locomotionTimeScale(100, 'walk'), 1.8);
  assert.equal(locomotionTimeScale(0, 'run'), 0.6);
  assert.equal(locomotionTimeScale(100, 'run'), 1.6);
  assert.equal(locomotionTimeScale(-3, 'walk'), 0.5);
});

test('every walk variant follows the walk stride, and non-locomotion clips stay at 1x', () => {
  for (const clip of ['walk', 'carry-walk', 'wounded-walk', 'crouch-walk']) {
    assert.equal(locomotionTimeScale(STRIDE.walk, clip), 1, clip);
    assert.ok(locomotionTimeScale(0.7, clip) < 1, clip);
  }
  for (const clip of ['idle', 'jump', 'sit-idle', 'death', 'aim-rifle', 'aim', 'fire-pistol']) {
    assert.equal(locomotionTimeScale(4, clip), 1, clip);
  }
});

// ----------------------------------------------------------- state → clip mapping

test('each locomotion state uses its own walk variant', () => {
  assert.equal(walkClipForState('crouch'), 'crouch-walk');
  assert.equal(walkClipForState('carry'), 'carry-walk');
  assert.equal(walkClipForState('wounded'), 'wounded-walk');
  for (const state of ['idle', 'walk', 'run', 'aim-rifle', 'fire-rifle', 'fire-pistol']) {
    assert.equal(walkClipForState(state), 'walk', state);
  }
  assert.ok(CLIPS.includes(walkClipForState('crouch')));
});

test('traversal and gestures own the body; equipment aiming retains locomotion', () => {
  const fullBody = ['jump', 'sit', 'dead', 'rest', 'climb', 'wave', 'hit', 'reload-rifle', 'reload-pistol', 'interact', 'climb-mount', 'climb-finish'];
  for (const state of fullBody) assert.equal(isLocomotionState(state), false, state);
  for (const state of STATES.filter((s) => !fullBody.includes(s))) {
    assert.equal(isLocomotionState(state), true, state);
  }
});

// ---------------------------------------------------------- upper-body aim layer

test('the aim layer only touches Spine1 upward, both arms and the fingers', () => {
  for (const bone of ['mixamorigSpine1', 'mixamorigSpine2', 'mixamorigNeck', 'mixamorigHead',
    'mixamorigLeftShoulder', 'mixamorigRightArm', 'mixamorigRightForeArm', 'mixamorigRightHand',
    'mixamorigRightHandIndex1', 'RightForeArm']) {
    assert.equal(isUpperBodyTrack(`${bone}.quaternion`), true, bone);
  }
  for (const bone of ['mixamorigHips', 'mixamorigSpine', 'mixamorigLeftUpLeg', 'mixamorigRightLeg',
    'mixamorigLeftFoot', 'mixamorigRightToeBase']) {
    assert.equal(isUpperBodyTrack(`${bone}.quaternion`), false, bone);
  }
});

test('the root translation track is never additive (no double root motion)', () => {
  assert.equal(isUpperBodyTrack('mixamorigHips.position'), false);
  assert.equal(isUpperBodyTrack('Armature.position'), false);
});
