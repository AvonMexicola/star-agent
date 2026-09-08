import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { modelRevisions } from '../scripts/model-revisions.mjs';
import { createModelURLModifier } from '../src/model-cache.js';

test('model URLs follow content, including nested textures, across release builds', t => {
  const directory = mkdtempSync(join(tmpdir(), 'star-agent-models-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  mkdirSync(join(directory, 'finish'));
  writeFileSync(join(directory, 'nomad.glb'), 'old hull');
  writeFileSync(join(directory, 'finish', 'deck normal.png'), 'same texture');
  const before = modelRevisions(directory);
  assert.deepEqual(modelRevisions(directory), before);
  writeFileSync(join(directory, 'nomad.glb'), 'new hull');
  const after = modelRevisions(directory);
  assert.notEqual(after['/models/nomad.glb'], before['/models/nomad.glb']);
  assert.equal(after['/models/finish/deck%20normal.png'], before['/models/finish/deck%20normal.png']);
  assert.match(after['/models/nomad.glb'], /^[a-f0-9]{64}$/);
  const oldURL = createModelURLModifier(before, 'https://play.example/')('/models/nomad.glb');
  const newURL = createModelURLModifier(after, 'https://play.example/')('/models/nomad.glb');
  assert.notEqual(newURL, oldURL, 'a changed model cannot reuse the previous release cache key');
});

test('same-origin model variants share one revision and keep other URL data', () => {
  const modify = createModelURLModifier({ '/models/nomad.glb': 'new' }, 'https://play.example/?intro=0');
  for (const input of ['/models/nomad.glb', './models/nomad.glb', 'https://play.example/models/nomad.glb']) {
    assert.equal(modify(input), 'https://play.example/models/nomad.glb?v=new');
    assert.equal(modify(modify(input)), modify(input));
  }
  assert.equal(modify('/models/nomad.glb?quality=high&v=old#mesh'),
    'https://play.example/models/nomad.glb?quality=high&v=new#mesh');
});

test('external, embedded, unlisted and already bundled resources remain untouched', () => {
  const modify = createModelURLModifier({ '/models/nomad.glb': 'new' }, 'https://play.example/');
  for (const input of ['https://cdn.example/models/nomad.glb', 'http://play.example/models/nomad.glb',
    'blob:https://play.example/123', 'data:image/png;base64,AAAA', '/assets/kestrel-hash.glb',
    '/models/missing.glb', '/toString', 'http://[bad']) assert.equal(modify(input), input);
  assert.equal(createModelURLModifier({}, undefined)('/models/nomad.glb'), '/models/nomad.glb');
});
