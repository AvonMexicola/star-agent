import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const before = process.env.FLEET_ENGINE_BEFORE === '1';
const out = process.env.FLEET_ENGINE_OUT || `test-results/fleet-engine-captures/${before ? 'before' : 'after'}`;
const state = page => page.evaluate(() => window.starAgent.state);
const frames = (page, count = 4) => page.evaluate(async count => {
  for (let i = 0; i < count; i++) await new Promise(requestAnimationFrame);
}, count);
async function button(page, index, down) {
  await page.evaluate(({ index, down }) => { window.fleetPad.buttons[index] = { pressed: down, value: Number(down) }; }, { index, down });
  await frames(page);
}
async function tap(page, index) { await button(page, index, true); await button(page, index, false); }
async function axis(page, forward) { await page.evaluate(forward => { window.fleetPad.axes[1] = -forward; }, forward); }
async function chord(page, index) {
  await page.waitForFunction(() => window.starAgent.state.controller.armed);
  await page.evaluate(() => { for (const i of [4, 5]) window.fleetPad.buttons[i] = { pressed: true, value: 1 }; });
  await frames(page); await tap(page, index);
  await page.evaluate(() => { for (const i of [4, 5]) window.fleetPad.buttons[i] = { pressed: false, value: 0 }; });
  await frames(page);
}
async function focus(page, key) {
  for (let i = 0; i < 55; i++) {
    if (await page.evaluate(() => document.activeElement?.dataset.controllerKey) === key) return;
    await tap(page, 13);
  }
  throw Error(`Controller could not focus ${key}`);
}
async function screen(page, tab) {
  await tap(page, 9);
  await expect(page.locator('dialog[open]')).toHaveCount(1);
  if (await page.locator(`dialog[open][data-gameplay-tab="${tab}"]`).count()) return;
  await focus(page, `tab-${tab}`); await tap(page, 0);
  await expect(page.locator(`dialog[open][data-gameplay-tab="${tab}"]`)).toHaveCount(1);
}
async function power(page) {
  await screen(page, 'ship'); await focus(page, 'power'); await tap(page, 0);
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  await page.waitForFunction(() => window.starAgent.state.controller.armed);
}
async function signal(page) {
  return page.evaluate(async () => {
    const analyser = window.fleetAudioProbe;
    if (!analyser) return { rms: 0, peak: 0 };
    const data = new Float32Array(analyser.fftSize); let square = 0, peak = 0, count = 0;
    for (let i = 0; i < 12; i++) {
      analyser.getFloatTimeDomainData(data);
      for (const value of data) { square += value * value; peak = Math.max(peak, Math.abs(value)); count++; }
      await new Promise(resolve => setTimeout(resolve, 25));
    }
    return { rms: Math.sqrt(square / count), peak };
  });
}
async function capture(page, name, clean = true) {
  if (clean) await page.locator('body').evaluate(el => el.classList.add('photo-mode'));
  await page.screenshot({ path: `${out}/${name}.png` });
  if (clean) await page.locator('body').evaluate(el => el.classList.remove('photo-mode'));
}
test.beforeEach(async ({ page }) => {
  await mkdir(out, { recursive: true });
  await page.addInitScript(() => {
    window.fleetPad = { id: 'Fleet engine standard Gamepad fixture', index: 0, connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
    Object.defineProperty(navigator, 'getGamepads', { value: () => [window.fleetPad] });
    // Observe the real post-master signal without changing the destination path,
    // injecting a sound, mocking media decoding or relaxing browser autoplay.
    const connect = AudioNode.prototype.connect;
    AudioNode.prototype.connect = function (target, ...args) {
      const result = connect.call(this, target, ...args);
      if (target === this.context.destination && !window.fleetAudioProbe) {
        const analyser = this.context.createAnalyser(); analyser.fftSize = 2048;
        connect.call(this, analyser); window.fleetAudioProbe = analyser;
      }
      return result;
    };
  });
  await page.route('**/api/auth/session', route => route.fulfill({ json: { account: null } }));
});
test.afterEach(async ({ page }, info) => {
  if (info.status === info.expectedStatus) return;
  await writeFile(`${out}/${info.title.split(':')[0]}-failure.json`, JSON.stringify(await page.evaluate(() => window.starAgent?.state).catch(error => ({ error: error.message })), null, 2));
});

for (const ship of ['nomad', 'atlas', 'kestrel']) {
  test(`${ship}: ${before ? 'existing exhaust visual baseline' : 'real propulsion, sound and music survive controller flight and power changes'}`, async ({ page, browser }) => {
    const errors = [], stages = {};
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto(`/?dev=1&ship=${ship}&start=orbit&intro=0&seed=7291&epoch=1788000000000&debug`);
    await page.waitForFunction(() => window.starAgent?.state.ready && !window.starAgent.state.transiting && window.starAgent.state.controller.armed && window.starAgent.state.shipAsset === 'ready', null, { timeout: 120000 });
    await expect(page.locator('#loading')).toHaveCSS('opacity', '0');
    expect((await state(page)).audio.created).toBe(false);
    if (!before && ship === 'nomad') {
      // Gamepad polling is not browser user activation. A pending first resume
      // must not swallow the native touch gesture that follows it.
      await tap(page, 9); await expect(page.locator('dialog[open]')).toHaveCount(1);
      expect((await state(page)).audio.created).toBe(true);
      stages.controllerActivation = await state(page);
      await tap(page, 1); await expect(page.locator('dialog[open]')).toHaveCount(0);
      await page.waitForFunction(() => window.starAgent.state.controller.armed);
    }
    // Ordinary trusted gesture for the browser's audio policy. The flight and
    // power route below then uses the injected standard controller exclusively.
    if (ship === 'nomad') await page.locator('#camera-button').tap();
    else await page.keyboard.press('4');
    await page.waitForFunction(() => window.starAgent.state.camera.mode === 'external');
    if (!before) {
      await page.waitForFunction(() => window.starAgent.state.audio.contextState === 'running' && window.starAgent.state.audio.music?.time > 0, null, { timeout: 20000 });
      expect((await state(page)).audio.music.failed).toEqual([]);
      expect((await state(page)).audio.engine.shipId).toBe(ship);
    }
    if ((await state(page)).landingGear.target) { await chord(page, 13); await page.waitForFunction(() => window.starAgent.state.landingGear.progress === 0); }
    await axis(page, 1);
    await page.waitForFunction(() => window.starAgent.state.speed > 30);
    if (!before) await page.waitForFunction(() => window.starAgent.state.effects.engine.forwardThrottle > .2 && window.starAgent.state.effects.engine.particles > 0);
    stages.forward = await state(page); await capture(page, `${ship}-forward`);
    if (!before) {
      expect(stages.forward.effects.engine.nozzleCount).toBe(2);
      expect(stages.forward.effects.engine.activeJets).toBe(ship === 'kestrel' ? 0 : 2);
      expect(stages.forward.effects.engineVisuals.authoredCones).toBe(0);
      expect(stages.forward.audio.engine.load).toBeGreaterThan(.2);
      stages.forwardSignal = await signal(page); expect(stages.forwardSignal.rms).toBeGreaterThan(.00001);
    }
    await button(page, 10, true);
    if (!before) await page.waitForFunction(() => window.starAgent.state.effects.engine.boost && window.starAgent.state.audio.engine.boost);
    else await frames(page, 12);
    stages.boost = await state(page); await capture(page, `${ship}-boost`);
    if (!before) expect(stages.boost.effects.engineVisuals.authoredCones).toBe(ship === 'kestrel' ? 2 : 0);
    await button(page, 10, false); await axis(page, 0);
    if (before) {
      const gl = await page.evaluate(() => { const gl = document.querySelector('#viewport').getContext('webgl2'); return gl.getParameter(gl.getExtension('WEBGL_debug_renderer_info').UNMASKED_RENDERER_WEBGL); });
      await writeFile(`${out}/${ship}.json`, JSON.stringify({ browser: browser.version(), backend: gl, stages, errors }, null, 2));
      expect(errors).toEqual([]); return;
    }
    await tap(page, 11); await page.waitForFunction(() => !window.starAgent.state.flightAssist);
    await page.waitForFunction(() => window.starAgent.state.effects.engine.forwardThrottle === 0 && window.starAgent.state.effects.engine.particles === 0);
    stages.coast = await state(page);
    expect(stages.coast.speed).toBeGreaterThan(5);
    expect(stages.coast.audio.engine.load).toBeLessThan(.01);
    expect(stages.coast.effects.engine.activeJets).toBe(0);
    expect(stages.coast.tunnel.visible).toBe(false);
    expect(stages.coast.effects.engineVisuals.authoredCones).toBe(0);
    await capture(page, `${ship}-coast`);
    await axis(page, -1);
    await page.waitForFunction(() => window.starAgent.state.effects.engine.signedForwardDemand < -.2);
    stages.reverse = await state(page);
    expect(stages.reverse.audio.engine.load).toBeGreaterThan(.2);
    expect(stages.reverse.effects.engine.activeJets).toBe(0);
    expect(stages.reverse.effects.engine.particles).toBe(0);
    await axis(page, 0);
    await page.waitForFunction(() => window.starAgent.state.effects.engine.forwardThrottle === 0);
    // Power remains on while the two walkable hulls are flown from an empty seat.
    if (ship !== 'kestrel') {
      await tap(page, 2); await page.waitForFunction(() => window.starAgent.state.cabinFlight && window.starAgent.state.mode === 'walk');
      stages.cabin = await state(page);
      expect(stages.cabin.audio.engine.active).toBe(true);
      expect(stages.cabin.effects.engine.nozzleCount).toBe(2);
      await tap(page, 2); await page.waitForFunction(() => window.starAgent.state.mode === 'flight' && !window.starAgent.state.cabinFlight);
    }
    await power(page); await page.waitForFunction(() => !window.starAgent.state.powered && !window.starAgent.state.audio.engine.active);
    stages.off = await state(page); expect(stages.off.effects.engine.particles).toBe(0);
    expect(stages.off.effects.engineVisuals.intensity).toBe(0);
    expect(stages.off.effects.engineVisuals.authoredCones).toBe(0);
    expect(stages.off.effects.engine.activeJets).toBe(0);
    await capture(page, `${ship}-off`);
    await power(page); await page.waitForFunction(() => window.starAgent.state.powered && window.starAgent.state.audio.engine.active);
    await screen(page, 'settings'); await focus(page, 'menu-audio');
    await page.waitForFunction(() => window.starAgent.state.audio.suspended);
    await frames(page, 15); stages.menuSignal = await signal(page);
    expect(stages.menuSignal.rms).toBeLessThan(.001);
    await tap(page, 0); expect((await state(page)).audio.enabled).toBe(false);
    await axis(page, 1); await tap(page, 1); await frames(page);
    expect((await state(page)).controller.armed).toBe(false);
    expect((await state(page)).audio.enabled).toBe(false);
    await axis(page, 0); await page.waitForFunction(() => window.starAgent.state.controller.armed);
    await axis(page, 1); await frames(page, 8); await axis(page, 0);
    expect((await state(page)).audio.enabled).toBe(false);
    await screen(page, 'settings'); await focus(page, 'menu-audio'); await tap(page, 0); await tap(page, 1);
    await page.waitForFunction(() => window.starAgent.state.audio.audible && !window.starAgent.state.audio.music.paused);
    stages.returnSignal = await signal(page); expect(stages.returnSignal.rms).toBeGreaterThan(.00001);
    if (ship === 'nomad') {
      await page.setViewportSize({ width: 390, height: 844 }); await screen(page, 'settings');
      const sound = page.locator('dialog[open] [data-controller-key="menu-audio"]');
      await sound.tap(); expect((await state(page)).audio.enabled).toBe(false);
      await capture(page, 'sound-phone', false);
      expect(await page.locator('dialog[open]').evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
      await sound.tap(); await page.locator('dialog[open] .gameplay-resume').tap();
      await page.waitForFunction(() => window.starAgent.state.audio.audible);
    }
    stages.final = await state(page);
    const backend = await page.evaluate(() => { const gl = document.querySelector('#viewport').getContext('webgl2'); return gl.getParameter(gl.getExtension('WEBGL_debug_renderer_info').UNMASKED_RENDERER_WEBGL); });
    await writeFile(`${out}/${ship}.json`, JSON.stringify({ browser: browser.version(), backend, input: 'Trusted keyboard/touch audio gesture; injected standard Gamepad flight/power/menus; no physical hardware', stages, errors }, null, 2));
    expect(errors).toEqual([]);
  });
}
