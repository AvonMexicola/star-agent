import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { Worker as NodeWorker } from 'node:worker_threads';
import { setPlanetSeed, DEFAULT_SEED } from '../src/generation.js';
import { buildForestTile, forestTilesAround } from '../src/forest-distribution.js';
import { ForestStream } from '../src/forest-stream.js';
import { appearanceCoverage, VEGETATION_APPEAR_SECONDS } from '../src/tree-lod.js';
import { latLonDirection } from '../src/world.js';

const direction = (latitude, longitude) => {
  const [x, y, z] = latLonDirection(latitude, longitude);
  return { x, y, z };
};
const bytes = array => Buffer.from(array.buffer, array.byteOffset, array.byteLength);

class MockWorker {
  constructor() {
    this.messages = [];
    this.terminated = false;
    this.onmessage = null;
    this.onerror = null;
  }
  postMessage(message) {
    assert.equal(this.terminated, false, 'disposed stream posted more work');
    this.messages.push(message);
  }
  respond(request, fields = {}) {
    this.onmessage({ data: { id: request.id, key: request.tile.key, records: new Float64Array([request.id]), ...fields } });
  }
  fail(message = 'worker crashed') {
    this.onerror({ message });
  }
  terminate() {
    this.terminated = true;
  }
}

test('ForestStream keeps exactly one generation request active', t => {
  const worker = new MockWorker();
  const stream = new ForestStream(worker);
  t.after(() => stream.dispose());

  stream.plan(direction(19, 22));
  assert.equal(worker.messages.length, 1);
  assert.deepEqual(stream.active, { key: worker.messages[0].tile.key, id: worker.messages[0].id });

  stream.plan(direction(19.002, 22.002));
  stream.plan(direction(19.004, 22.004));
  assert.equal(worker.messages.length, 1, 'replanning must not start another concurrent request');

  const first = worker.messages[0];
  worker.respond(first);
  assert.equal(worker.messages.length, 2, 'completion should dispatch one successor');
  assert.equal(stream.active.id, worker.messages[1].id);
  assert.equal(stream.generated, 1);

  // A duplicate or stale reply cannot complete the successor.
  worker.respond(first);
  assert.equal(worker.messages.length, 2);
  assert.equal(stream.active.id, worker.messages[1].id);
});

test('publish adopts no more than four arrived tiles per frame', t => {
  const worker = new MockWorker();
  const stream = new ForestStream(worker);
  t.after(() => stream.dispose());
  stream.plan(direction(19, 22));

  for (let completed = 0; completed < 6; completed++) {
    const request = worker.messages.at(-1);
    worker.respond(request);
  }
  assert.equal(stream.arrivals.length, 6);
  assert.equal(stream.tiles.size, 0);

  assert.equal(stream.publish(12.5), true);
  assert.equal(stream.tiles.size, 4);
  assert.equal(stream.arrivals.length, 2);
  assert.deepEqual([...stream.tiles.values()].map(tile => tile.born), [12.5, 12.5, 12.5, 12.5]);

  assert.equal(stream.publish(12.75), true);
  assert.equal(stream.tiles.size, 6);
  assert.equal(stream.arrivals.length, 0);
  assert.equal(stream.publish(13), false);
});

test('resident tile birth time and appearance age survive overlapping replans', t => {
  const worker = new MockWorker();
  const stream = new ForestStream(worker);
  t.after(() => stream.dispose());
  stream.plan(direction(19, 22));
  worker.respond(worker.messages[0]);
  stream.publish(40);

  const [key, resident] = stream.tiles.entries().next().value;
  assert.equal(resident.born, 40);
  const records = resident.records;
  const ageBefore = appearanceCoverage(0.31);
  stream.plan(direction(19.001, 22.001));
  assert.ok(stream.wanted.has(key), 'test movement must retain the resident tile');
  assert.equal(stream.tiles.get(key).born, 40);
  assert.equal(stream.tiles.get(key).records, records);
  assert.ok(Math.abs(appearanceCoverage(40.31 - stream.tiles.get(key).born) - ageBefore) < 1e-12);

  assert.equal(VEGETATION_APPEAR_SECONDS, 0.8);
  assert.equal(appearanceCoverage(-1), 0);
  assert.equal(appearanceCoverage(0), 0);
  assert.equal(appearanceCoverage(VEGETATION_APPEAR_SECONDS / 2), 0.5);
  assert.equal(appearanceCoverage(VEGETATION_APPEAR_SECONDS), 1);
  assert.equal(appearanceCoverage(VEGETATION_APPEAR_SECONDS * 2), 1);
  let previous = -1;
  for (let step = 0; step <= 20; step++) {
    const coverage = appearanceCoverage(VEGETATION_APPEAR_SECONDS * step / 20);
    assert.ok(coverage >= previous && coverage >= 0 && coverage <= 1);
    previous = coverage;
  }
});

test('teleport drops queued arrivals and discards the stale active reply', t => {
  const worker = new MockWorker();
  const stream = new ForestStream(worker);
  t.after(() => stream.dispose());
  stream.plan(direction(19, 22));

  worker.respond(worker.messages[0]);
  assert.equal(stream.arrivals.length, 1);
  const staleActive = worker.messages.at(-1);
  const staleKeys = new Set([stream.arrivals[0].key, staleActive.tile.key]);

  stream.plan(direction(-28, -130));
  assert.equal(stream.arrivals.length, 0);
  for (const key of staleKeys) assert.equal(stream.wanted.has(key), false);
  worker.respond(staleActive);
  assert.equal(stream.arrivals.length, 0);
  assert.equal(stream.tiles.size, 0);
  assert.equal(stream.publish(100), false);
  assert.ok(stream.wanted.has(worker.messages.at(-1).tile.key), 'new location should begin streaming after stale completion');
});

test('worker errors and disposal leave the stream terminal and quiescent', () => {
  const failedWorker = new MockWorker();
  const failed = new ForestStream(failedWorker);
  failed.plan(direction(19, 22));
  failedWorker.fail('synthetic worker failure');
  assert.equal(failed.error, 'synthetic worker failure');
  assert.equal(failed.active, null);
  assert.equal(failed.pending, 0);
  const postsAtFailure = failedWorker.messages.length;
  failed.plan(direction(20, 23));
  assert.equal(failedWorker.messages.length, postsAtFailure);
  assert.equal(failed.pending, 0, 'terminal errors must not accumulate undispatchable work');
  failed.dispose();

  const dataErrorWorker = new MockWorker();
  const dataError = new ForestStream(dataErrorWorker);
  dataError.plan(direction(19, 22));
  const request = dataErrorWorker.messages[0];
  dataErrorWorker.respond(request, { error: 'generation rejected' });
  assert.equal(dataError.error, 'generation rejected');
  assert.equal(dataError.active, null);
  assert.equal(dataError.pending, 0);
  dataError.dispose();

  const disposalWorker = new MockWorker();
  const disposed = new ForestStream(disposalWorker);
  disposed.plan(direction(19, 22));
  disposed.arrivals.push({ key: 'queued', records: new Float64Array() });
  disposed.tiles.set('resident', { records: new Float64Array(), born: 2 });
  disposed.dispose();
  assert.equal(disposalWorker.terminated, true);
  assert.equal(disposed.disposed, true);
  assert.equal(disposed.tiles.size, 0);
  assert.equal(disposed.arrivals.length, 0);
  assert.equal(disposed.queue.length, 0);
  assert.equal(disposed.active, null);
  assert.equal(disposed.pending, 0);
  disposalWorker.respond(disposalWorker.messages[0]);
  assert.equal(disposed.tiles.size, 0);
});

test('real forest worker applies request seed and matches direct tile generation', async t => {
  t.after(() => setPlanetSeed(DEFAULT_SEED));
  const workerModule = new URL('../src/forest.worker.js', import.meta.url).href;
  const wrapper = `
    import { parentPort } from 'node:worker_threads';
    globalThis.self = {
      onmessage: null,
      postMessage(value, transfer) { parentPort.postMessage(value, transfer); }
    };
    await import(${JSON.stringify(workerModule)});
    parentPort.on('message', data => globalThis.self.onmessage({ data }));
    parentPort.postMessage({ ready: true });
  `;
  const worker = new NodeWorker(new URL(`data:text/javascript,${encodeURIComponent(wrapper)}`), { type: 'module' });
  t.after(() => worker.terminate());
  const [ready] = await once(worker, 'message');
  assert.equal(ready.ready, true);

  const seed = 43121;
  setPlanetSeed(seed);
  const tile = forestTilesAround(direction(19, 22), 100)[0];
  const expected = buildForestTile(tile);
  const responsePromise = once(worker, 'message');
  worker.postMessage({ id: 73, seed, tile });
  const [actual] = await responsePromise;
  assert.equal(actual.id, 73);
  assert.equal(actual.key, tile.key);
  assert.deepEqual(bytes(actual.records), bytes(expected.records));

  const errorPromise = once(worker, 'message');
  worker.postMessage({ id: 74, seed, tile: null });
  const [error] = await errorPromise;
  assert.equal(error.id, 74);
  assert.match(error.error, /forest tile descriptor/i);
});
