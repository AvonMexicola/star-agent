import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const output = process.env.ATLAS_GROUND_RAMPS_OUT || '/tmp/star-agent-atlas-ground-ramps';
const frames = (page, count = 4) => page.evaluate(async count => {
  for (let i = 0; i < count; i++) await new Promise(requestAnimationFrame);
}, count);
async function held(page, index, down) {
  await page.evaluate(({ index, down }) => window.rampPad.buttons[index] = { pressed: down, value: Number(down) }, { index, down });
  await frames(page);
}
async function tap(page, index) { await held(page, index, true); await held(page, index, false); }
async function stop(page) {
  await page.evaluate(() => window.rampPad.axes.fill(0));
  await tap(page, 6);
}
async function walkTo(page, x, z, { speed = .8, timeout = 30000 } = {}) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const distance = await page.evaluate(({ x, z, speed }) => {
      const nav = window.starAgent.navigation, local = nav.toShipLocal();
      const direction = nav.position.clone().set(x - local.x, 0, z - local.z), distance = direction.length();
      direction.applyQuaternion(nav.shipOrientation).applyQuaternion(nav.orientation.clone().invert());
      const gain = distance > .7 ? speed : .35;
      window.rampPad.axes[0] = distance > .14 ? direction.x / distance * gain : 0;
      window.rampPad.axes[1] = distance > .14 ? direction.z / distance * gain : 0;
      return distance;
    }, { x, z, speed });
    if (distance < .14) { await stop(page); return; }
    await frames(page, 6);
  }
  await stop(page);
  const state = await page.evaluate(() => {
    const nav = window.starAgent.navigation;
    return { local: nav.toShipLocal().toArray(), mode: nav.mode, jump: nav.jumpHeight, interaction: nav.interaction, stage: window.rampRegression.stage };
  });
  throw Error(`Physical walk to ${x}, ${z} did not finish: ${JSON.stringify(state)}`);
}
async function lookAt(page, point) {
  const started = Date.now();
  while (Date.now() - started < 12000) {
    const angle = await page.evaluate(point => {
      const nav = window.starAgent.navigation;
      const direction = nav.fromShipLocal(nav.position.clone().fromArray(point)).sub(nav.position).applyQuaternion(nav.orientation.clone().invert()).normalize();
      const yaw = Math.atan2(-direction.x, -direction.z), pitch = Math.atan2(direction.y, Math.hypot(direction.x, direction.z));
      window.rampPad.axes[2] = Math.abs(yaw) > .06 ? Math.sign(-yaw) * Math.max(.3, Math.min(.9, Math.abs(yaw) * 2)) : 0;
      window.rampPad.axes[3] = Math.abs(pitch) > .06 ? Math.sign(-pitch) * Math.max(.3, Math.min(.9, Math.abs(pitch) * 2)) : 0;
      return Math.max(Math.abs(yaw), Math.abs(pitch));
    }, point);
    if (angle < .06) { await page.evaluate(() => { window.rampPad.axes[2] = window.rampPad.axes[3] = 0; }); return; }
    await frames(page, 4);
  }
  await page.evaluate(() => { window.rampPad.axes[2] = window.rampPad.axes[3] = 0; });
  throw Error(`Controller look did not reach ${point}`);
}
async function stage(page, name) { await page.evaluate(name => window.rampRegression.stage = name, name); }

test('both Atlas meadow ramp buttons, terrain boarding and jump crossings follow the physical surfaces', async ({ page, browser }) => {
  await mkdir(output, { recursive: true });
  const errors = [], report = { browser: browser.version(), viewport: { width: 1440, height: 900 }, input: 'Injected standard Gamepad; fresh explicit meadow scene, no later pose/time/speed overrides', ramps: [] };
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.addInitScript(() => {
    window.rampPad = { id: 'Atlas terrain ramp standard controller', index: 0, connected: true, mapping: 'standard',
      axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
    Object.defineProperty(navigator, 'getGamepads', { value: () => [window.rampPad] });
  });
  await page.route('**/api/auth/session', route => route.fulfill({ json: { account: null } }));
  try {
    await page.goto('/?dev=1&ship=atlas&start=grazer-habitat&rover=1&intro=0&seed=7291&meadow=1&debug');
    await page.bringToFront();
    // placeAtlasMeadow completes its actual Burrow exit after initial world load.
    await page.waitForFunction(() => document.title.startsWith('Atlas + Burrow')
      && window.starAgent?.navigation.mode === 'walk' && window.starAgent.navigation.gamepad.armed, null, { timeout: 150000 });
    report.start = await page.evaluate(() => {
      const nav = window.starAgent.navigation, gl = document.querySelector('#viewport').getContext('webgl2'), info = gl.getExtension('WEBGL_debug_renderer_info');
      return { position: nav.position.toArray(), shipLocal: nav.toShipLocal().toArray(), shipPosition: nav.shipPosition.toArray(), shipOrientation: nav.shipOrientation.toArray(),
        gpu: info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) };
    });
    await page.evaluate(async () => {
      const { bodyAltitude, bodyOffset, bodySurfacePoint } = await import('/src/celestial.js');
      const { ATLAS_RAMP_CALLS } = await import('/src/atlas-gameplay.js');
      const trace = [], monitor = window.rampRegression = { trace, stage: 'approach', running: true, calls: ATLAS_RAMP_CALLS };
      monitor.probe = id => {
        const nav = window.starAgent.navigation, ramp = nav.freighter.ramps.find(r => r.id === id);
        const toeZ = ramp.pivot[2] + ramp.outward * ramp.length * Math.cos(ramp.angle), samples = [];
        for (let i = 0; i <= 20; i++) {
          const x = ramp.pivot[0] + (i / 20 - .5) * (ramp.width - 1.2), z = toeZ - ramp.outward * .02;
          const local = nav.position.clone().set(x, ramp.pivot[1], z), surface = nav.freighter.rampSurfaceAt(local);
          const ground = bodySurfacePoint(bodyOffset(nav.fromShipLocal(local), nav.body), nav.body);
          const groundLocal = nav.toShipLocal(ground);
          samples.push({ x, z, rampY: surface?.y ?? null, terrainY: groundLocal.y, gap: surface ? surface.y - groundLocal.y : null });
        }
        const walk = samples.filter(s => s.gap !== null && s.gap >= -.03 && s.gap < .38).sort((a, b) => a.gap - b.gap)[0];
        return { id, outward: ramp.outward, angle: ramp.angle, openAngle: ramp.openAngle, toeZ, samples, walk, centre: samples[10] };
      };
      let previous = null, last = performance.now();
      const sample = now => {
        if (!monitor.running) return;
        const nav = window.starAgent.navigation, local = nav.toShipLocal(), surface = nav.freighter.rampSurfaceAt(local);
        if (trace.length < 20000) trace.push({ time: now, dt: (now - last) / 1000, stage: monitor.stage,
          position: nav.position.toArray(), local: local.toArray(), mode: nav.mode, inside: nav.insideShip,
          jumpHeight: nav.jumpHeight, jumpVelocity: nav.jumpVelocity,
          terrainClearance: bodyAltitude(nav.position, nav.body) - nav.layout.eyeHeight,
          ramp: surface?.ramp ?? null, footAboveRamp: surface ? local.y - nav.layout.eyeHeight - surface.y : null,
          displacement: previous ? nav.position.distanceTo(previous) : 0,
          upwardStep: previous ? nav.position.clone().sub(previous).dot(nav.normal) : 0 });
        previous = nav.position.clone(); last = now; requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
    await walkTo(page, 36, -36); await walkTo(page, 6.65, -36);
    for (const id of ['front', 'aft']) {
      const call = await page.evaluate(id => window.rampRegression.calls.find(call => call.id === id), id);
      await stage(page, `${id}-call`); await walkTo(page, call.approach[0], call.approach[2]);
      await lookAt(page, call.anchor);
      const button = await page.evaluate(() => {
        const nav = window.starAgent.navigation, local = nav.toShipLocal();
        return { local: local.toArray(), bootHeight: local.y - nav.layout.eyeHeight, interaction: nav.freighter.interactionAt(local), exterior: nav.freighter.exteriorRampCallAt(local) };
      });
      expect(button.interaction).toBe(`ramp:${id}`); expect(button.exterior.anchor).toEqual(call.anchor);
      if (id === 'aft') expect(button.bootHeight).toBeGreaterThan(.45);
      await page.screenshot({ path: `${output}/${id}-button.png` });
      await tap(page, 2);
      await page.waitForFunction(id => {
        const ramp = window.starAgent.navigation.freighter.ramps.find(r => r.id === id);
        return !ramp.moving && Math.abs(ramp.angle - ramp.openAngle) < 1e-6;
      }, id, { timeout: 10000 });
      const probe = await page.evaluate(id => window.rampRegression.probe(id), id);
      expect(probe.walk, `${id} has a capsule-width approach within a 0.38 m walking step`).toBeTruthy();
      report.ramps.push({ id, button, probe });
      const outside = probe.toeZ + probe.outward * 1.2, inside = probe.toeZ - probe.outward * 2;
      await stage(page, `${id}-approach-toe`); await walkTo(page, 6.65, outside); await walkTo(page, probe.walk.x, outside);
      await lookAt(page, [probe.walk.x, probe.walk.rampY + .15, probe.toeZ - probe.outward * 2]);
      await page.screenshot({ path: `${output}/${id}-toe.png` });
      await stage(page, `${id}-walk-on`); await walkTo(page, probe.walk.x, inside, { speed: .6 });
      const contact = await page.evaluate(() => {
        const nav = window.starAgent.navigation, local = nav.toShipLocal(), surface = nav.freighter.rampSurfaceAt(local);
        return { ramp: surface?.ramp, gap: surface ? local.y - nav.layout.eyeHeight - surface.y : null, jump: nav.jumpHeight };
      });
      expect(contact.ramp).toBe(id); expect(Math.abs(contact.gap)).toBeLessThan(.06); expect(contact.jump).toBe(0);
      await page.screenshot({ path: `${output}/${id}-walk-supported.png` });
      await stage(page, `${id}-walk-out`); await walkTo(page, probe.walk.x, outside, { speed: .6 });
      await stage(page, `${id}-jump-approach`); await walkTo(page, 0, outside); await walkTo(page, 0, probe.toeZ + probe.outward * .75);
      await stage(page, `${id}-jump`);
      // Start the ordinary jump on canonical terrain, then steer through the
      // real toe while airborne. Only Gamepad axes/buttons drive navigation.
      const jumping = walkTo(page, 0, inside, { speed: .68 });
      await tap(page, 0); await jumping;
      await page.waitForFunction(() => window.starAgent.navigation.jumpHeight === 0, null, { timeout: 5000 });
      const jump = await page.evaluate(id => {
        const nav = window.starAgent.navigation, local = nav.toShipLocal(), surface = nav.freighter.rampSurfaceAt(local);
        const trace = window.rampRegression.trace.filter(row => row.stage === `${id}-jump`);
        return { landedRamp: surface?.ramp, landingGap: surface ? local.y - nav.layout.eyeHeight - surface.y : null,
          airborneBeforeRamp: trace.some(row => !row.ramp && row.jumpHeight > .02),
          airborneOverRamp: trace.some(row => row.ramp === id && row.jumpHeight > .02 && row.footAboveRamp > .04),
          maximumUpwardStep: Math.max(...trace.map(row => row.upwardStep)) };
      }, id);
      expect(jump.airborneBeforeRamp).toBe(true); expect(jump.airborneOverRamp).toBe(true);
      expect(jump.landedRamp).toBe(id); expect(Math.abs(jump.landingGap)).toBeLessThan(.06);
      expect(jump.maximumUpwardStep).toBeLessThan(.6);
      report.ramps.at(-1).jump = jump;
      await page.screenshot({ path: `${output}/${id}-jump-landed.png` });
      await stage(page, `${id}-return`); await walkTo(page, 0, outside, { speed: .6 }); await walkTo(page, 6.65, outside);
      if (id === 'front') {
        await walkTo(page, 6.65, -36); await walkTo(page, 22, -36); await walkTo(page, 22, 36); await walkTo(page, 6.65, 36);
      }
    }
    const trace = await page.evaluate(() => { window.rampRegression.running = false; return window.rampRegression.trace; });
    expect(trace.every(row => row.mode === 'walk')).toBe(true);
    expect(trace.every(row => row.displacement < Math.min(row.dt, .1) * 12 + .45)).toBe(true);
    expect(errors).toEqual([]);
    report.maximumDisplacement = Math.max(...trace.map(row => row.displacement));
    report.errors = errors;
    await writeFile(`${output}/trace.json`, JSON.stringify(trace));
    await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
  } catch (error) {
    const failure = await page.evaluate(() => ({ stage: window.rampRegression?.stage, trace: window.rampRegression?.trace,
      state: window.starAgent?.state })).catch(readError => ({ error: readError.message }));
    await writeFile(`${output}/failure.json`, JSON.stringify({ message: error.message, errors, report, failure }, null, 2));
    throw error;
  } finally {
    await page.evaluate(() => { window.rampPad?.axes.fill(0); if (window.rampPad) for (const button of window.rampPad.buttons) { button.pressed = false; button.value = 0; }
      if (window.rampRegression) window.rampRegression.running = false; }).catch(() => {});
  }
});
