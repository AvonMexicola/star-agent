import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

/** Diagnostic run for reported hitching while walking the retail promenade.
 *
 * The walk is driven from inside the page: a Playwright round trip per frame
 * costs tens of milliseconds and would bury the very stalls being measured, so
 * this pushes the same keys the keyboard handler sets and samples every
 * animation frame without leaving the browser. It wraps the WebGL calls that
 * actually block a frame, so a spike is attributed to a real driver call.
 *
 * A wrapped call only shows work done on the page's thread. Chromium runs the
 * driver in its GPU process, so a shader compile or an upload that stalls there
 * arrives here as a long frame with no event — the same signature as garbage
 * collection. Two extra samples tell those apart: the Long Tasks API reports a
 * frame the page's own thread spent busy, and the JS heap is read every frame so
 * a collection shows as a drop. A long frame with neither is time spent waiting
 * on the GPU process.
 *
 * This is measurement, not an acceptance journey: the physical controller and
 * keyboard journeys in station-promenade.spec.js remain the input evidence.
 */
const frames = (page, n = 3) => page.evaluate(n => new Promise(resolve => {
  const tick = () => --n <= 0 ? resolve() : requestAnimationFrame(tick);
  requestAnimationFrame(tick);
}), n);

test('profile every frame of the promenade walk and attribute the stalls', async ({ page }) => {
  await page.route('**/api/auth/session', route => route.request().method() === 'GET'
    ? route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ account: null }) })
    : route.continue());
  await page.addInitScript(() => {
    navigator.getGamepads = () => [];
    const profile = { frames: [], times: [], heap: [], programs: [], tasks: [], events: [], marks: [] };
    window.__profile = profile;
    for (const proto of [globalThis.WebGL2RenderingContext?.prototype, globalThis.WebGLRenderingContext?.prototype]) {
      if (!proto) continue;
      for (const [name, kind] of [['linkProgram', 'link'], ['getProgramParameter', 'programQuery'],
        ['getShaderParameter', 'programQuery'], ['getProgramInfoLog', 'programQuery'],
        ['compileShader', 'compile'], ['texImage2D', 'texture'], ['texSubImage2D', 'texture'],
        ['texStorage2D', 'texture'], ['compressedTexImage2D', 'texture'], ['generateMipmap', 'texture'],
        ['bufferData', 'buffer'], ['bufferSubData', 'buffer'],
        ['useProgram', 'programUse'], ['drawElements', 'draw'], ['drawArrays', 'draw'],
        ['drawElementsInstanced', 'draw'], ['drawArraysInstanced', 'draw'],
        ['readPixels', 'sync'], ['finish', 'sync'], ['flush', 'sync'], ['getError', 'sync'], ['clientWaitSync', 'sync']]) {
        const original = proto[name];
        if (typeof original !== 'function') continue;
        proto[name] = function (...args) {
          const started = performance.now();
          const result = original.apply(this, args);
          const ms = performance.now() - started;
          if (ms > 1) profile.events.push({ kind, name, ms: +ms.toFixed(2), frame: profile.frames.length });
          return result;
        };
      }
    }
    try {
      new PerformanceObserver(list => {
        for (const entry of list.getEntries()) profile.tasks.push({ start: +entry.startTime.toFixed(1), ms: +entry.duration.toFixed(1) });
      }).observe({ type: 'longtask', buffered: true });
    } catch {}
    let previous = performance.now();
    const tick = now => {
      profile.frames.push(+(now - previous).toFixed(2));
      profile.times.push(+now.toFixed(1));
      profile.heap.push(performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null);
      profile.programs.push(window.starAgent?.renderer?.info.programs.length ?? null);
      previous = now; requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  await page.goto('/?dev=1&ship=nomad&start=hangar&intro=0&debug&seed=7291');
  await page.waitForFunction(() => window.starAgent?.state.ready && window.starAgent.state.shipAsset === 'ready');
  await page.waitForFunction(() => window.starAgent.state.station.docked && window.starAgent.state.station.ready);
  await page.waitForFunction(() => window.starAgent.state.station.finish === 'ready', null, { timeout: 90000 });

  // Ride to the hub with ordinary input, then hand the walk to the page.
  await page.evaluate(() => document.querySelector('#viewport')?.focus());
  await page.keyboard.press('KeyF');
  await page.waitForFunction(() => window.starAgent.state.mode === 'walk');
  const route = await page.evaluate(async () => {
    const n = window.starAgent.navigation, profile = window.__profile;
    const step = () => new Promise(resolve => requestAnimationFrame(resolve));
    const mark = label => profile.marks.push({ label, frame: profile.frames.length });
    const press = async (code, held = 3) => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code }));
      document.dispatchEvent(new KeyboardEvent('keydown', { code }));
      for (let i = 0; i < held; i++) await step();
      document.dispatchEvent(new KeyboardEvent('keyup', { code }));
      window.dispatchEvent(new KeyboardEvent('keyup', { code }));
      for (let i = 0; i < 2; i++) await step();
    };
    // The look sign depends on the handler's convention; calibrate it once.
    let lookSign = 1;
    const local = () => n.mode === 'walk' ? (n.stationLocal ?? n.toShipLocal()) : null;
    // Pressed against furniture, a player feels for the open side and takes
    // it. Try each direction briefly and commit to the one that moved.
    const feel = async where => {
      n.keys.delete('KeyW');
      let open = 'KeyS', moved = 0;
      for (const key of ['KeyS', 'KeyA', 'KeyD']) {
        const from = where()?.clone();
        n.keys.add(key); for (let i = 0; i < 8; i++) await step(); n.keys.delete(key);
        const travelled = from && where() ? from.distanceTo(where()) : 0;
        if (travelled > moved) { moved = travelled; open = key; }
      }
      n.keys.add(open); for (let i = 0; i < 30; i++) await step(); n.keys.delete(open);
    };
    const bearing = (frame, x, z) => {
      const here = frame === 'ship' ? n.toShipLocal() : n.stationLocal;
      if (!here) return null;
      const inverse = (frame === 'ship' ? n.shipOrientation : n.station.quaternion).clone().invert();
      const desired = here.clone().set(x - here.x, 0, z - here.z), d = desired.length();
      desired.normalize();
      const forward = here.clone().set(0, 0, -1).applyQuaternion(n.orientation).applyQuaternion(inverse); forward.y = 0; forward.normalize();
      const right = here.clone().set(1, 0, 0).applyQuaternion(n.orientation).applyQuaternion(inverse); right.y = 0; right.normalize();
      return { d, yaw: Math.atan2(desired.dot(right), desired.dot(forward)) };
    };
    async function walkTo(frame, x, z, label, seconds = 25) {
      mark(`walk ${label}`);
      const deadline = performance.now() + seconds * 1000;
      let best = Infinity, stalled = 0;
      while (performance.now() < deadline) {
        const at = bearing(frame, x, z);
        if (!at) { n.keys.delete('KeyW'); return false; }
        if (at.d < .4) { n.keys.delete('KeyW'); n.keys.delete('KeyA'); n.keys.delete('KeyD'); mark(`at ${label}`); return true; }
        if (Math.abs(at.yaw) > .05) {
          const before = Math.abs(at.yaw);
          n.look(lookSign * Math.max(-.25, Math.min(.25, at.yaw)), 0);
          const after = Math.abs(bearing(frame, x, z)?.yaw ?? before);
          if (after > before + 1e-4) lookSign = -lookSign;
        }
        if (at.d < best - .05) { best = at.d; stalled = 0; }
        else if (++stalled > 40) { stalled = 0; best = Infinity; await feel(local); }
        n.keys.add('KeyW');
        await step();
      }
      n.keys.delete('KeyW');
      mark(`blocked ${label}`);
      return false;
    }
    const idle = async (n2 = 30) => { for (let i = 0; i < n2; i++) await step(); };

    await walkTo('ship', 0, 2.7, 'ship hatch');
    await press('KeyF');
    await idle(20);
    await walkTo('ship', 0, 13, 'outside ramp');
    await walkTo('station', 0, 20, 'hangar lift');
    await press('KeyF');
    await idle(40);
    await walkTo('station', 0, 24, 'inside lift');
    return { reachedLift: Boolean(n.stationLocal), marks: profile.marks.length };
  });
  expect(route.reachedLift).toBe(true);

  await page.keyboard.press('KeyF');
  await expect(page.locator('#station-elevator-dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Central hub · Hands free' }).click();
  await page.waitForFunction(() => window.starAgent.state.station.location === 'hub'
    && window.starAgent.navigation.enabled && window.starAgent.state.station.elevator > .99);
  await frames(page, 20);

  const walked = await page.evaluate(async () => {
    const n = window.starAgent.navigation, profile = window.__profile;
    const step = () => new Promise(resolve => requestAnimationFrame(resolve));
    const mark = label => profile.marks.push({ label, frame: profile.frames.length });
    const feel = async where => {
      n.keys.delete('KeyW');
      let open = 'KeyS', moved = 0;
      for (const key of ['KeyS', 'KeyA', 'KeyD']) {
        const from = where()?.clone();
        n.keys.add(key); for (let i = 0; i < 8; i++) await step(); n.keys.delete(key);
        const travelled = from && where() ? from.distanceTo(where()) : 0;
        if (travelled > moved) { moved = travelled; open = key; }
      }
      n.keys.add(open); for (let i = 0; i < 30; i++) await step(); n.keys.delete(open);
    };
    let lookSign = 1;
    const bearing = (x, z) => {
      const here = n.stationLocal;
      if (!here) return null;
      const inverse = n.station.quaternion.clone().invert();
      const desired = here.clone().set(x - here.x, 0, z - here.z), d = desired.length();
      desired.normalize();
      const forward = here.clone().set(0, 0, -1).applyQuaternion(n.orientation).applyQuaternion(inverse); forward.y = 0; forward.normalize();
      const right = here.clone().set(1, 0, 0).applyQuaternion(n.orientation).applyQuaternion(inverse); right.y = 0; right.normalize();
      return { d, yaw: Math.atan2(desired.dot(right), desired.dot(forward)) };
    };
    async function walkTo(x, z, label, seconds = 25) {
      mark(`walk ${label}`);
      const deadline = performance.now() + seconds * 1000;
      let best = Infinity, stalled = 0;
      while (performance.now() < deadline) {
        const at = bearing(x, z);
        if (!at) break;
        if (at.d < .4) { n.keys.delete('KeyW'); mark(`at ${label}`); return true; }
        if (Math.abs(at.yaw) > .05) {
          const before = Math.abs(at.yaw);
          n.look(lookSign * Math.max(-.25, Math.min(.25, at.yaw)), 0);
          const after = Math.abs(bearing(x, z)?.yaw ?? before);
          if (after > before + 1e-4) lookSign = -lookSign;
        }
        if (at.d < best - .05) { best = at.d; stalled = 0; }
        else if (++stalled > 40) { stalled = 0; best = Infinity; await feel(() => n.stationLocal); }
        n.keys.add('KeyW');
        await step();
      }
      n.keys.delete('KeyW');
      mark(`blocked ${label}`);
      return false;
    }
    mark('hub arrival settled');
    for (let i = 0; i < 40; i++) await step();
    // Lanes and counters are the points the acceptance journeys already reach.
    const route = [
      [0, 6, 'concourse centre'], [0, -12, 'before the portal'], [0, -22, 'promenade entry'],
      [-3.4, -25.7, 'galley lane'], [-8.6, -25.7, 'galley counter'], [-3.4, -25.7, 'galley lane out'],
      [3.4, -25.7, 'outfitter lane'], [8.6, -25.7, 'outfitter counter'], [3.4, -25.7, 'outfitter lane out'],
      [0, -32.3, 'mid court'],
      [-3.4, -38.9, 'hydroponics lane'], [-8.6, -38.9, 'hydroponics counter'], [-3.4, -38.9, 'hydroponics out'],
      [3.4, -38.9, 'souvenir lane'], [8.6, -38.9, 'souvenir counter'], [3.4, -38.9, 'souvenir out'],
      [0, -45, 'sealed door'], [0, -30, 'aft hall out'], [0, -22, 'returning'],
      [0, -12, 'back through the portal'], [0, 6, 'back in the concourse'],
      [0, -22, 'second entry'], [0, -45, 'second aft walk'], [0, -12, 'second return'],
    ];
    const reached = [];
    for (const [x, z, label] of route) {
      reached.push([label, await walkTo(x, z, label)]);
      for (let i = 0; i < 12; i++) await step();
    }
    return reached;
  });

  const profile = await page.evaluate(() => window.__profile);
  // Which programs were created during the walk, and how do their keys differ
  // from the programs already in use? Names the materials behind a first-look
  // compile without guessing.
  const programDump = await page.evaluate(() => {
    const R = window.starAgent.renderer;
    return R ? R.info.programs.map(p => ({ name: p.name, key: p.cacheKey, used: p.usedTimes })) : null;
  });
  const dir = process.env.PROMENADE_PROFILE_OUT || 'test-results/promenade-profile';
  await mkdir(dir, { recursive: true });
  const after = profile.marks.find(m => m.label === 'hub arrival settled')?.frame ?? 0;
  const walking = profile.frames.slice(after);
  const sorted = [...walking].sort((a, b) => a - b);
  const median = sorted[sorted.length >> 1];
  const spikes = [];
  profile.frames.forEach((ms, index) => {
    if (index < after || ms < Math.max(35, median * 3)) return;
    const events = profile.events.filter(e => e.frame >= index - 1 && e.frame <= index);
    const nearest = [...profile.marks].reverse().find(m => m.frame <= index);
    // The frame ran from the previous tick to this one; a long task overlapping
    // that window is page-thread work, and a heap drop is a collection.
    const from = profile.times[index - 1] ?? 0, to = profile.times[index] ?? from;
    const tasks = profile.tasks.filter(t => t.start < to && t.start + t.ms > from);
    const heap = profile.heap[index], heapBefore = profile.heap[index - 1];
    const programs = profile.programs[index], programsBefore = profile.programs[index - 1];
    spikes.push({ index, ms, after: nearest?.label ?? 'start',
      events: events.map(e => `${e.kind} ${e.ms}ms`), eventMs: +events.reduce((s, e) => s + e.ms, 0).toFixed(2),
      pageThreadMs: +tasks.reduce((s, t) => s + t.ms, 0).toFixed(1),
      heapDeltaMb: heap == null || heapBefore == null ? null : +(heap - heapBefore).toFixed(1),
      newPrograms: programs == null || programsBefore == null ? null : programs - programsBefore });
  });
  const byKind = {};
  for (const e of profile.events) {
    const phase = e.frame >= after ? 'walking' : 'load';
    const key = `${phase}:${e.kind}`;
    byKind[key] = { count: (byKind[key]?.count ?? 0) + 1, ms: +((byKind[key]?.ms ?? 0) + e.ms).toFixed(1) };
  }
  const walkingTasks = profile.tasks.filter(t => t.start >= (profile.times[after] ?? 0));
  const programsAtSettle = profile.programs[after] ?? null;
  const newPrograms = programDump && programsAtSettle != null ? programDump.slice(programsAtSettle) : [];
  if (programDump) {
    console.log('PROGRAMS', JSON.stringify({ atSettle: programsAtSettle, atEnd: programDump.length }));
    const older = programDump.slice(0, programsAtSettle);
    for (const program of newPrograms) {
      const a = program.key.split(','), sibling = older.find(o => o.name === program.name);
      const b = sibling ? sibling.key.split(',') : [];
      const diff = a.map((v, i) => v !== b[i] ? `${i}:${b[i] ?? '-'}->${v}` : null).filter(Boolean);
      console.log('NEWPROGRAM', JSON.stringify({ name: program.name, used: program.used, differsFromSibling: diff.slice(0, 40), keyLength: a.length }));
    }
  }
  const report = { totalFrames: profile.frames.length, walkingFrames: walking.length,
    walkingMedianMs: median, walkingP95Ms: sorted[Math.floor(sorted.length * .95)], walkingMaxMs: sorted.at(-1),
    spikeCount: spikes.length, byKind,
    walkingLongTasks: { count: walkingTasks.length, ms: +walkingTasks.reduce((s, t) => s + t.ms, 0).toFixed(1) },
    heapMb: { start: profile.heap[after] ?? null, end: profile.heap.at(-1) ?? null },
    programs: { atSettle: programsAtSettle, atEnd: programDump?.length ?? null, created: newPrograms.map(p => p.name) },
    route: walked, spikes: spikes.slice(0, 80), marks: profile.marks };
  await writeFile(`${dir}/profile.json`, JSON.stringify(report, null, 1));
  console.log('PROFILE', JSON.stringify({ walkingFrames: report.walkingFrames, medianMs: median,
    p95Ms: report.walkingP95Ms, maxMs: report.walkingMaxMs, spikeCount: spikes.length, byKind,
    walkingLongTasks: report.walkingLongTasks, heapMb: report.heapMb }));
  for (const spike of spikes.slice(0, 20)) console.log('SPIKE', JSON.stringify(spike));
  // Measurement, not acceptance: the legs the freeze report is about must be
  // walked; a storefront the coarse walker could not reach is reported, not failed.
  const required = ['concourse centre', 'before the portal', 'promenade entry', 'galley lane', 'back through the portal', 'second entry', 'second return'];
  const missed = walked.filter(([, ok]) => !ok).map(([label]) => label);
  if (missed.length) console.log('UNREACHED', JSON.stringify(missed));
  expect(missed.filter(label => required.includes(label))).toEqual([]);
});
