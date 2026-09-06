// Independent production-renderer captures for QUALITY.md §4. Run this file
// yourself; it neither consumes earlier screenshots nor substitutes model files.
// node scripts/hangar-integration-tour.mjs --url http://127.0.0.1:5239 \
//   --out /tmp/star-agent-hangar-opus/screens --extras --perf1440
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import * as THREE from 'three';
import { RADIUS, terrainHeight } from '../src/world.js';

const options = { url: 'http://127.0.0.1:5239', out: '/tmp/star-agent-hangar-opus/screens', extras: false, perf1440: false };
for (let i = 2; i < process.argv.length; i++) {
  const flag = process.argv[i];
  if (flag === '--url' || flag === '--out') {
    const value = process.argv[++i];
    if (!value || value.startsWith('--')) throw new Error(`${flag} requires a value`);
    options[flag.slice(2)] = value;
  } else if (flag === '--extras') options.extras = true;
  else if (flag === '--perf1440') options.perf1440 = true;
  else if (flag === '--help') {
    console.log('Usage: node scripts/hangar-integration-tour.mjs [--url URL] [--out DIRECTORY] [--extras] [--perf1440]');
    process.exit(0);
  } else throw new Error(`Unknown argument: ${flag}`);
}
const base = new URL(options.url);
if (!['http:', 'https:'].includes(base.protocol)) throw new Error('--url must use HTTP(S)');
const out = resolve(options.out);
await mkdir(out, { recursive: true });
const launchArgs = ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'];
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium', args: launchArgs });
const context = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
const page = await context.newPage();
page.setDefaultTimeout(240_000);
page.setDefaultNavigationTimeout(120_000);
const errors = [], warnings = [], captures = [], requestsFailed = [];
let backend = null, failure = null;
page.on('pageerror', error => errors.push({ url: page.url(), message: error.message }));
page.on('console', message => {
  if (message.type() === 'error') errors.push({ url: page.url(), message: message.text() });
  if (message.type() === 'warning') warnings.push({ url: page.url(), message: message.text() });
});
page.on('requestfailed', request => requestsFailed.push({ url: request.url(), failure: request.failure()?.errorText }));

async function frames(count = 3) {
  await page.evaluate(count => new Promise(resolve => {
    const tick = () => { if (--count > 0) requestAnimationFrame(tick); else resolve(); };
    requestAnimationFrame(tick);
  }), count);
}

// A root-ready flag alone is insufficient after transit. Require drained terrain
// workers, an appropriate actual visible LOD and stable patch counts across four
// consecutive render frames spanning at least one second (the LOD selector polls
// every 160 ms). Fail with state evidence instead of accepting holes.
async function terrainSettled(minLevel) {
  console.log(`Waiting for terrain: visible LOD >= ${minLevel}, pending = 0, stable patch count`);
  await page.evaluate(() => { window.__reviewTerrain = { signature: null, stable: 0, since: 0 }; });
  await page.waitForFunction(minLevel => {
    const state = window.starAgent?.state;
    if (!state?.ready || state.pending !== 0 || state.lod < minLevel || state.patches < 1) {
      window.__reviewTerrain.stable = 0;
      window.__reviewTerrain.since = 0;
      return false;
    }
    const signature = `${state.lod}:${state.patches}:${state.pending}`;
    const record = window.__reviewTerrain;
    if (signature !== record.signature || !record.since) record.since = performance.now();
    record.stable = signature === record.signature ? record.stable + 1 : 0;
    record.signature = signature;
    return record.stable >= 4 && performance.now() - record.since >= 1000;
  }, minLevel, { polling: 'raf', timeout: 240_000 });
}

async function boot(intro) {
  const url = new URL('/', base);
  url.search = new URLSearchParams({ intro: String(intro), seed: '7291', debug: '1' }).toString();
  await page.goto(url.href, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.starAgent?.state.ready && window.starAgent.state.station.ready);
  await page.evaluate(() => {
    const app = window.starAgent;
    app.setRenderScale(.4);
    app.navigation.enabled = false;
    app.navigation.keys.clear();
    app.navigation.velocity.set(0, 0, 0);
    document.querySelectorAll('body > :not(canvas):not(script)').forEach(element => { element.style.visibility = 'hidden'; });
  });
  const status = await page.evaluate(() => ({ finish: window.starAgent.state.station.finish, pods: window.starAgent.navigation.station.pods.length }));
  if (status.finish !== 'ready' || status.pods !== 20) throw new Error(`Finished StationComplex not loaded: ${JSON.stringify(status)}`);
  backend = await page.evaluate(() => {
    const canvas = document.querySelector('#viewport');
    const gl = canvas.getContext('webgl2');
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return { renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
      vendor: ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR), version: gl.getParameter(gl.VERSION) };
  });
}

async function cadence() {
  return page.evaluate(() => new Promise(resolve => {
    const stamps = [];
    const tick = time => {
      stamps.push(time);
      if (stamps.length < 9) return requestAnimationFrame(tick);
      const intervals = stamps.slice(1).map((time, index) => time - stamps[index]);
      const sorted = [...intervals].sort((a, b) => a - b);
      resolve({ samples: intervals.length, meanMs: intervals.reduce((sum, value) => sum + value, 0) / intervals.length,
        medianMs: (sorted[3] + sorted[4]) / 2, minMs: sorted[0], maxMs: sorted.at(-1) });
    };
    requestAnimationFrame(tick);
  }));
}

async function capture(name, fixture, minLevel = 0) {
  await terrainSettled(minLevel);
  await page.evaluate(() => window.starAgent.setRenderScale(1));
  await frames(4);
  const path = resolve(out, `${name}.png`);
  await page.screenshot({ path });
  const state = await page.evaluate(() => window.starAgent.state);
  const observedRaf = await cadence();
  const record = { name, path, url: page.url(), fixture, viewport: page.viewportSize(), state, observedRaf };
  if (options.perf1440 && ['05-hangar-t10', '06-cockpit', '07-corner', '08-gallery'].includes(name)) {
    await page.setViewportSize({ width: 1440, height: 900 });
    await frames(4);
    const perfState = await page.evaluate(() => window.starAgent.state);
    record.perf1440 = { viewport: page.viewportSize(), renderScale: perfState.renderScale,
      drawCalls: perfState.drawCalls, triangles: perfState.triangles, observedRaf: await cadence() };
    await page.setViewportSize({ width: 1600, height: 900 });
    await frames(3);
  }
  captures.push(record);
  console.log(`${name}: ${state.drawCalls} draws, ${state.triangles} triangles, LOD ${state.lod}, pending ${state.pending}, observed RAF ${observedRaf.meanMs.toFixed(1)} ms`);
  await page.evaluate(() => window.starAgent.setRenderScale(.4));
}

// Use the same authoritative terrain function as rendering to face the sea from
// the fixed coast destination. There is no invented floor or second generator.
function seaDirection(direction) {
  const up = new THREE.Vector3(...direction);
  const east = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), up).normalize();
  const north = new THREE.Vector3().crossVectors(up, east).normalize();
  let best = null;
  for (let i = 0; i < 64; i++) {
    const angle = i * Math.PI * 2 / 64;
    const forward = north.clone().multiplyScalar(Math.cos(angle)).addScaledVector(east, Math.sin(angle));
    const samples = [1500, 4000, 8000].map(distance => {
      const sample = up.clone().multiplyScalar(RADIUS).addScaledVector(forward, distance).normalize();
      return terrainHeight(...sample.toArray());
    });
    const score = samples.reduce((sum, height) => sum + height, 0);
    if (!best || score < best.score) best = { score, forward: forward.toArray(), sampledHeights: samples, azimuthRadians: angle };
  }
  return best;
}

try {
  await boot(0);
  await capture('01-orbit', { type: 'initial orbit', seed: 7291 }, 0);
  for (const [name, destination, altitude] of [['02-coast', 'coast', 95], ['03-forest', 'forest', 95], ['04-highlands', 'mountain', 700]]) {
    const direction = await page.evaluate(name => window.starAgent.destinations[name], destination);
    const sea = destination === 'coast' ? seaDirection(direction) : null;
    await page.evaluate(({ destination, altitude, sea }) => {
      const app = window.starAgent, nav = app.navigation;
      nav.transit(app.destinations[destination], altitude);
      nav.enabled = false;
      if (sea) nav.orientToward(nav.position.clone().addScaledVector(nav.position.clone().fromArray(sea.forward), 1000).addScaledVector(nav.normal, -180), nav.normal);
    }, { destination, altitude, sea });
    await capture(name, { type: 'fixed surface destination', destination, altitudeAboveTerrain: altitude, direction, sea }, 13);
  }

  // The opening is the explicit exception to intro=0. Evaluate its authored
  // cinematic to exactly t=10, then freeze it. This avoids frame-rate-dependent
  // overshoot and does not replace or reposition the StationComplex render group.
  await boot(1);
  await page.evaluate(() => {
    const app = window.starAgent, opening = app.openingSequence, nav = app.navigation;
    opening.elapsed = 0;
    opening.start();
    opening.update(10);
    nav.enabled = false;
    nav.keys.clear();
    nav.velocity.set(0, 0, 0);
  });
  await capture('05-hangar-t10', { type: 'authored opening cinematic', intro: 1, elapsed: 10 });
  const openingState = captures.at(-1).state;
  if (Math.abs(openingState.opening.elapsed - 10) > .0001) throw new Error('Opening fixture was not frozen at t=10');

  // Camera fixture only: physical boarding is verified by the browser suite.
  await page.evaluate(() => {
    const app = window.starAgent, nav = app.navigation;
    app.openingSequence.leave();
    nav.enabled = false; nav.keys.clear(); nav.velocity.set(0, 0, 0);
    nav.mode = 'landed'; nav.insideShip = true;
    nav.position.copy(nav.fromShipLocal(nav.position.clone().fromArray(nav.layout.seatEye)));
    nav.orientation.copy(nav.shipOrientation);
  });
  await capture('06-cockpit', { type: 'seated camera fixture', physicalBoardingClaim: false });

  if (options.extras) {
    for (const [name, eye, target] of [
      ['07-corner', [-12, -6.25, 0], [-12, -6.25, 22]],
      ['08-gallery', [-3, -6.25, 15], [0, 2, 24]],
    ]) {
      await page.evaluate(({ eye, target }) => {
        const nav = window.starAgent.navigation, station = nav.station;
        nav.enabled = false; nav.mode = 'walk'; nav.insideShip = false; nav.dockedAtStation = true;
        nav.keys.clear(); nav.velocity.set(0, 0, 0);
        // Use the active berth's double-precision transform, not a single-station
        // group.position assignment: all twenty pods keep their own transforms.
        station.toWorld(nav.position.clone().fromArray(eye), nav.position);
        nav.orientToward(station.toWorld(nav.position.clone().fromArray(target), nav.position.clone()), station.up);
      }, { eye, target });
      await capture(name, { type: 'active berth local camera fixture', eye, target });
    }
  }
  if (errors.length || warnings.length) throw new Error(`Browser reported ${errors.length} errors and ${warnings.length} warnings; see evidence.json`);
} catch (error) {
  failure = error.stack ?? error.message;
  try { await page.screenshot({ path: resolve(out, 'failure.png') }); } catch { /* browser may have lost its context */ }
  throw error;
} finally {
  let lastState = null;
  try { lastState = await page.evaluate(() => window.starAgent?.state ?? null); } catch { /* preserve the failure report */ }
  await writeFile(resolve(out, 'evidence.json'), JSON.stringify({
    generatedAt: new Date().toISOString(), browser: browser.version(), backend, launchArgs, options,
    seed: 7291, qualityViewport: { width: 1600, height: 900 }, captures, errors, warnings, requestsFailed, failure, lastState,
    timingNote: 'Observed requestAnimationFrame intervals on the recorded Chromium backend, including CPU and software-rendering costs. These are not GPU timings or evidence that laptop GPU frame budgets pass.',
    fixtureNote: 'Review camera fixtures only; no gameplay or physical-boarding pass is claimed. Surface views use intro=0; hangar uses the authored intro=1 cinematic evaluated and frozen at t=10.',
  }, null, 2));
  await browser.close();
}
