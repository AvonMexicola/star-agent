// Run with `node scripts/server-room-performance.mjs --compare-ref <git-ref>`
// for alternating, paired baseline/candidate samples in the same process.
// --baseline-ref <git-ref> and [path/to/baseline-room.js] retain single runs.
// Uses only a disposable memory store; never connects to the running dev server.
import { performance } from 'node:perf_hooks';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { cpus, loadavg } from 'node:os';
import { createWorld } from '../server/world.js';
import { createMemoryStore } from '../server/database.js';

const compare = process.argv[2] === '--compare-ref';
function baselineURL(ref) {
  // Use the old room implementation with the SAME current dependencies/nav.
  // Comparing complete old/new checkouts would conflate the navigation gain.
  if (!ref || ref.startsWith('-')) throw Error('Supply a Git ref after --baseline-ref or --compare-ref');
  const source = execFileSync('git', ['show', `${ref}:server/room.js`], { encoding: 'utf8' })
    .replace(/from\s+(['"])([^'"]+)\1/g, (_, quote, specifier) => {
      const url = specifier.startsWith('.') ? new URL(specifier, new URL('../server/room.js', import.meta.url)).href : import.meta.resolve(specifier);
      return `from ${JSON.stringify(url)}`;
    });
  return `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
}
const roomURL = compare || process.argv[2] === '--baseline-ref' ? baselineURL(process.argv[3])
  : process.argv[2] ? pathToFileURL(resolve(process.argv[2])).href : '../server/room.js';
const implementations = compare
  ? [{ name: 'baseline', ...await import(roomURL) }, { name: 'candidate', ...await import('../server/room.js') }]
  : [{ name: 'single', ...await import(roomURL) }];
const ticksPerSample = 120, samples = 9, warmupRounds = 4;
const startedAt = new Date().toISOString(), loadAtStart = loadavg();
const checksum = path => createHash('sha256').update(readFileSync(new URL(path, import.meta.url))).digest('hex');
const median = values => [...values].sort((a, b) => a - b)[values.length >> 1];
async function fixture(createRoom, simulate) {
  // Separate station objects give both implementations the same starting world;
  // neither room advances the other's rings, doors or active physics frame.
  const world = await createWorld();
  const store = createMemoryStore();
  const room = createRoom({ world, store, autoStart: false, now: () => 100000,
    onError(error) { throw error; } });
  let positionSnapshots = 0, packets = 0, characters = 0;
  for (let i = 0; i < 10; i++) {
    const account = await store.createAccount({ email: `benchmark${i}@example.test`, callsign: `Benchmark${i}`, passwordHash: 'fixture' });
    await room.join(account, message => {
      const wire = JSON.stringify(message);
      if (message.type === 'state') { packets++; characters += wire.length; }
    });
  }
  const players = [...room.players.values()];
  for (const p of players) {
    const toArray = p.nav.position.toArray.bind(p.nav.position);
    p.nav.position.toArray = (...args) => { positionSnapshots++; return toArray(...args); };
    if (!simulate) p.nav.look = p.nav.beginFrame = p.nav.update = () => {};
  }
  for (let i = 0; i < 100; i++) {
    const position = players[i % 10].nav.position.clone().addScalar(i % 5).toArray();
    room.drops.set(`drop${i}`, { id: `drop${i}`, item: 'bandage', quantity: 1, position, expiresAt: 400000 });
  }
  return {
    batch() {
      const cpuStart = process.cpuUsage(), start = performance.now();
      for (let i = 0; i < ticksPerSample; i++) room.tick();
      const elapsed = performance.now() - start, cpu = process.cpuUsage(cpuStart);
      return { msPerTick: elapsed / ticksPerSample, cpuMsPerTick: (cpu.user + cpu.system) / 1000 / ticksPerSample };
    },
    reset() { positionSnapshots = packets = characters = 0; },
    counts() { return { packets, positionSnapshots, characters }; },
    async close() { await room.close(); await store.close?.(); },
  };
}
const results = [];
for (const simulate of [false, true]) {
  const fixtures = new Map();
  try {
    for (const implementation of implementations) fixtures.set(implementation.name, await fixture(implementation.createRoom, simulate));
    const names = [...fixtures.keys()];
    const orderFor = round => round % 2 ? [...names].reverse() : names;
    // Warm both implementations and their common navigation/encoding dependencies.
    for (let round = 0; round < warmupRounds; round++) for (const name of orderFor(round)) fixtures.get(name).batch();
    for (const value of fixtures.values()) value.reset();
    const rounds = [];
    for (let sample = 0; sample < samples; sample++) {
      const order = orderFor(sample), timings = {};
      for (const name of order) timings[name] = fixtures.get(name).batch();
      rounds.push({ sample, order, timings,
        ...(compare ? { candidateToBaselineRatio: timings.candidate.msPerTick / timings.baseline.msPerTick,
          candidateToBaselineCpuRatio: timings.candidate.cpuMsPerTick / timings.baseline.cpuMsPerTick } : {}) });
    }
    const measurements = Object.fromEntries(names.map(name => [name, {
      ...fixtures.get(name).counts(), medianMsPerTick: median(rounds.map(round => round.timings[name].msPerTick)),
      p90MsPerTick: Math.max(...rounds.map(round => round.timings[name].msPerTick)),
      medianCpuMsPerTick: median(rounds.map(round => round.timings[name].cpuMsPerTick)),
    }]));
    results.push({ scenario: simulate ? 'ten stationary pilots, full navigation and wire encoding' : 'ten stationary pilots, room and wire encoding only',
      players: 10, drops: 100, ticks: ticksPerSample * samples,
      ...(compare ? { measurements, medianCandidateToBaselineRatio: median(rounds.map(round => round.candidateToBaselineRatio)),
        medianCandidateToBaselineCpuRatio: median(rounds.map(round => round.candidateToBaselineCpuRatio)) } : measurements.single), rounds });
  } finally { for (const value of fixtures.values()) await value.close(); }
}
console.log(JSON.stringify({ node: process.version, cpu: cpus()[0]?.model, startedAt, completedAt: new Date().toISOString(),
  sharedMachine: true, loadAtStart, loadAtEnd: loadavg(),
  ...(compare ? { comparison: { baselineRef: process.argv[3], alternatingOrder: true, sameProcess: true, sameCurrentDependencies: true,
    candidateRoomSHA256: checksum('../server/room.js'), navigationSHA256: checksum('../src/navigation.js') } } : {}),
  samples, ticksPerSample, warmupRounds, results }, null, 2));
