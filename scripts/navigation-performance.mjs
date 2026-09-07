import { performance } from 'node:perf_hooks';
import { Vector3 } from 'three';
import { Navigation } from '../src/navigation.js';
import { BODIES, bodySurfacePoint, bodyAltitude } from '../src/celestial.js';

const rows = [];
for (const body of BODIES) {
  const nav = Object.create(Navigation.prototype);
  nav.position = bodySurfacePoint(new Vector3(.31, .82, -.48).normalize(), body, 100);
  const startPosition = nav.position.clone(), samples = { baseline: [], candidate: [] };
  let checksum = 0;
  for (let round = 0; round < 9; round++) {
    for (const mode of round % 2 ? ['candidate', 'baseline'] : ['baseline', 'candidate']) {
      nav.position.copy(startPosition);
      const start = performance.now();
      for (let i = 0; i < 1000; i++) {
        nav.position.x += .0001;
        for (let j = 0; j < 20; j++) checksum += mode === 'baseline'
          ? Math.max(0, bodyAltitude(nav.position, nav.body)) : nav.altitude;
      }
      if (round > 1) samples[mode].push(performance.now() - start);
    }
  }
  const median = values => values.sort((a, b) => a - b)[values.length >> 1];
  rows.push({ body: body.id, baselineMs: median(samples.baseline), candidateMs: median(samples.candidate), checksum });
}
console.log(JSON.stringify({ workload: '1000 positions × 20 altitude reads, 2 warmup and 7 alternating measured rounds; CPU microbenchmark, not game FPS', rows }, null, 2));
