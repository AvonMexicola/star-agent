import {test, expect} from '@playwright/test';
import {mkdir, writeFile} from 'node:fs/promises';
import {MINING_KEY} from '../src/mining/store.js';
import {SANDBOX_PREFIX} from '../src/build/sandbox.js';
const out = process.env.FLOODLIGHT_EVIDENCE || '/tmp/star-agent-floodlights-01';
const frames = page => page.evaluate(async () => {for (let i = 0; i < 4; i++) await new Promise(r => requestAnimationFrame(r));});
const ready = page => page.waitForFunction(() => window.starAgent?.state.ready && window.starAgent.state.controller.armed, null, {timeout: 90000});
const saved = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), SANDBOX_PREFIX + MINING_KEY);
async function capture(page, name) {await page.screenshot({path: `${out}/${name}.png`}); await writeFile(`${out}/${name}.json`, JSON.stringify(await page.evaluate(() => window.starAgent?.state), null, 2));}
async function button(page, i, pressed) {await page.evaluate(({i, pressed}) => window.testPad.buttons[i] = {pressed, value: +pressed}, {i, pressed}); await frames(page);}
async function tap(page, i) {await button(page, i, true); await button(page, i, false);}
async function choose(page, key) {
  for (let i = 0; i < 95; i++) {
    if (await page.evaluate(key => document.activeElement?.dataset.controllerKey === key, key)) {await tap(page, 0); return;}
    await tap(page, 13);
  }
  throw Error(`Controller target not reached: ${key}`);
}
async function setup(page, url) {
  await mkdir(out, {recursive: true}); const errors = [], warnings = [];
  page.on('pageerror', e => errors.push(e.message)); page.on('console', m => {if (m.type() === 'error') errors.push(m.text()); if (m.type() === 'warning') warnings.push(m.text());});
  await page.route('**/api/auth/session', r => r.fulfill({json: {account: null}}));
  await page.addInitScript(() => {
    window.testPad = {id: 'Floodlight standard Gamepad', index: 0, connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons: Array.from({length: 17}, () => ({pressed: false, value: 0}))};
    navigator.getGamepads = () => window.padDisconnected ? [] : [window.testPad];
  });
  await page.goto(url); await ready(page); return {errors, warnings};
}
async function world(page, point) {return page.evaluate(point => {
  const n = window.starAgent.navigation, c = window.starAgent.state.build.claims[0];
  return n.position.clone().fromArray(point).applyQuaternion(n.orientation.clone().fromArray(c.quaternion)).add(n.position.clone().fromArray(c.origin)).toArray();
}, point);}
// Only Gamepad axes are written. Position, orientation and saves are observations.
async function steer(page, point, walking = false) {
  await page.evaluate(({point, walking}) => {
    window.routeDone = false; window.routeTimer = setInterval(() => {
      const n = window.starAgent.navigation, delta = n.position.clone().fromArray(point).sub(n.position);
      if (walking) {
        delta.projectOnPlane(n.normal);
        if (delta.length() < .2) {window.routeDone = true; window.testPad.axes.fill(0); clearInterval(window.routeTimer); return;}
        delta.applyQuaternion(n.orientation.clone().invert()); window.testPad.axes = [Math.max(-.65, Math.min(.65, delta.x)), Math.max(-.65, Math.min(.65, delta.z)), 0, 0];
      } else {
        delta.applyQuaternion(n.orientation.clone().invert()); const yaw = Math.atan2(delta.x, -delta.z), pitch = Math.atan2(delta.y, Math.hypot(delta.x, delta.z));
        if (Math.abs(yaw) < .025 && Math.abs(pitch) < .025) {window.routeDone = true; window.testPad.axes.fill(0); clearInterval(window.routeTimer); return;}
        const a = x => Math.abs(x) < .015 ? 0 : Math.sign(x) * Math.min(.8, .19 + Math.abs(x) * 2);
        window.testPad.axes = [0, 0, a(yaw), a(-pitch)];
      }
    }, 30);
  }, {point, walking});
  try {await page.waitForFunction(() => window.routeDone, null, {timeout: 25000});}
  finally {await page.evaluate(() => {clearInterval(window.routeTimer); window.testPad.axes.fill(0);});}
}
async function graphics(page) {return page.evaluate(() => {
  const s = window.starAgent.state, gl = document.querySelector('canvas').getContext('webgl2'), e = gl.getExtension('WEBGL_debug_renderer_info');
  return {width: innerWidth, height: innerHeight, backend: e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), drawCalls: s.drawCalls, triangles: s.triangles, fps: s.fps, resolution: s.renderResolution, floodlights: s.build.visuals.floodlights};
});}
async function focusGate(page) {
  const blank = await page.context().newPage(), game = await page.context().newCDPSession(page), other = await page.context().newCDPSession(blank);
  try {
    await blank.goto('about:blank'); await game.send('Emulation.setFocusEmulationEnabled', {enabled: false}); await other.send('Emulation.setFocusEmulationEnabled', {enabled: false});
    await page.bringToFront(); await page.waitForFunction(() => document.hasFocus() && window.starAgent.state.focused); await button(page, 7, true);
    await blank.bringToFront(); await page.waitForFunction(() => !window.starAgent.state.focused);
    await page.bringToFront(); await page.waitForFunction(() => document.hasFocus() && window.starAgent.state.focused); await frames(page);
    expect(await page.evaluate(() => window.starAgent.state.controller.armed)).toBe(false); await button(page, 7, false); await ready(page);
  } finally {await game.send('Emulation.setFocusEmulationEnabled', {enabled: true}); await other.send('Emulation.setFocusEmulationEnabled', {enabled: true}); await game.detach(); await other.detach(); await blank.close(); await page.bringToFront();}
}
test.afterEach(async ({page}, info) => {if (info.status !== info.expectedStatus) {try {await capture(page, 'failure');} catch {}}});

test('controller constructs floodlight, checks materials, switches it and returns after reload and input gates', async ({page, browser}) => {
  const {errors, warnings} = await setup(page, '/?sandbox=build&intro=0&debug&seed=7291');
  await page.waitForFunction(() => window.starAgent.state.build.assetsReady); const before = await saved(page);
  await steer(page, await world(page, [0, .3, 4])); await tap(page, 1);
  await page.waitForFunction(() => window.starAgent.navigation.gamepad.uiArmed);
  for (let i = 0; i < 9 && await page.locator('[data-controller-key="build-tab-power"]').getAttribute('aria-pressed') !== 'true'; i++) await tap(page, 5);
  await choose(page, 'build-piece-floodlight'); await ready(page);
  await page.waitForFunction(() => window.starAgent.state.build.preview?.valid);
  await capture(page, 'placement'); await tap(page, 0);
  await page.waitForFunction(() => window.starAgent.state.build.claims[0].pieces.some(p => p.type === 'floodlight'));
  await tap(page, 2); const placed = await saved(page), lamp = placed.build.claims[0].pieces.find(p => p.type === 'floodlight');
  for (const [item, cost] of Object.entries({'metal-stock': 8, conductor: 3, glass: 2})) {
    const total = save => Object.values(save.remote).reduce((sum, bin) => sum + (bin.items[item] || 0), 0);
    expect(total(before) - total(placed)).toBe(cost);
  }
  await tap(page, 8); await expect(page.locator('#cargo-dialog')).toBeVisible(); await capture(page, 'result-inventory');
  await button(page, 7, true); await tap(page, 1); expect(await page.evaluate(() => window.starAgent.state.controller.armed)).toBe(false);
  await button(page, 7, false); await ready(page);
  await steer(page, await world(page, [lamp.position[0], 1.95, lamp.position[2] + 2]), true);
  await steer(page, await world(page, [lamp.position[0], lamp.position[1] + 1.2, lamp.position[2] + .4]));
  await expect(page.locator('#state-text')).toContainText('Switch floodlight off');
  await page.waitForFunction(() => window.starAgent.state.build.visuals.floodlights.active === 1);
  await capture(page, 'lamp-on'); await button(page, 2, true); await page.waitForTimeout(600);
  expect((await saved(page)).build.claims[0].pieces.find(p => p.id === lamp.id).lightOn).toBe(false);
  await button(page, 2, false); await ready(page);
  await page.waitForFunction(() => window.starAgent.state.build.visuals.floodlights.active === 0); await capture(page, 'lamp-off');
  await focusGate(page); await button(page, 7, true); await page.evaluate(() => window.padDisconnected = true); await frames(page);
  expect(await page.evaluate(() => window.starAgent.state.controller.armed)).toBe(false); await page.evaluate(() => window.padDisconnected = false); await frames(page);
  expect(await page.evaluate(() => window.starAgent.state.controller.armed)).toBe(false); await button(page, 7, false); await ready(page);
  await page.reload(); await ready(page); expect((await saved(page)).build.claims[0].pieces.find(p => p.id === lamp.id).lightOn).toBe(false);
  await steer(page, await world(page, [lamp.position[0], 1.95, lamp.position[2] + 2]), true);
  await steer(page, await world(page, [lamp.position[0], lamp.position[1] + 1.2, lamp.position[2] + .4]));
  await tap(page, 2); await page.waitForFunction(() => window.starAgent.state.build.visuals.floodlights.active === 1);
  await page.keyboard.press('f'); await page.waitForFunction(() => window.starAgent.state.build.visuals.floodlights.active === 0);
  await page.keyboard.press('b'); await page.setViewportSize({width: 390, height: 844}); await frames(page);
  await page.locator('[data-controller-key="build-tab-power"]').tap(); await capture(page, 'power-phone');
  expect(await page.locator('#build-dialog').evaluate(d => d.scrollWidth <= d.clientWidth + 2)).toBe(true);
  await page.locator('[data-controller-key="build-piece-floodlight"]').tap(); await page.locator('[data-controller-key="build-hud-exit"]').tap();
  await page.waitForFunction(() => window.starAgent.state.enabled && !window.starAgent.state.build.active);
  expect((await saved(page)).build.claims[0].pieces.filter(p => p.type === 'floodlight')).toHaveLength(1); expect(errors).toEqual([]);
  await writeFile(`${out}/controller.json`, JSON.stringify({browser: browser.version(), graphics: await graphics(page), input: 'Injected standard Gamepad; actual shipped sandbox, no pose or inventory injection. Keyboard/phone closure separately.', physicalDevice: false, errors, warnings, lamp, materialsSpent: {'metal-stock': 8, conductor: 3, glass: 2}}, null, 2));
});

test('settlement floodlights illuminate all four actual worlds with bounded lighting', async ({page, browser}) => {
  const {errors, warnings} = await setup(page, '/?dev=1&ship=nomad&start=settlement-aeon&intro=0&debug&seed=7291'); const views = [];
  // Fixed art viewpoints are deliberately separate from the real input route.
  for (const body of ['aeon', 'selene', 'pyre', 'miasma']) {
    if (body !== 'aeon') {await page.goto(`/?dev=1&ship=nomad&start=settlement-${body}&intro=0&debug&seed=7291`); await ready(page);}
    await page.waitForFunction(() => window.starAgent.state.settlements.ready && window.starAgent.state.settlements.rendered > 0);
    await page.addStyleTag({content: 'body > :not(canvas) { visibility: hidden !important; }'});
    for (const [view, eye, target] of [['approach', [70, 42, 92], [0, 2, 12]], ['walk', [17, 1.75, 32], [0, 3, -18]]]) {
      await page.evaluate(({eye, target}) => {
        const n = window.starAgent.navigation, s = window.starAgent.state.settlements.sites.find(s => s.body === n.body.id), q = n.orientation.clone().fromArray(s.quaternion), origin = n.position.clone().fromArray(s.origin);
        const deck = n.position.clone().fromArray(s.pad).sub(origin).applyQuaternion(q.clone().invert()).y;
        const point = a => n.position.clone().fromArray(a).add(n.position.clone().set(0, deck, 0)).applyQuaternion(q).add(origin);
        n.mode = 'walk'; n.enabled = false; n.insideShip = false; n.position.copy(point(eye)); n.orientToward(point(target), n.normal); n.velocity.set(0, 0, 0);
      }, {eye, target});
      await frames(page); await page.waitForTimeout(2200); await capture(page, `${body}-${view}`);
      const g = await graphics(page); expect(g.floodlights.active).toBe(6); expect(g.floodlights.shadows).toBeLessThanOrEqual(2); views.push({body, view, ...g});
    }
  }
  expect(errors).toEqual([]); await writeFile(`${out}/worlds.json`, JSON.stringify({browser: browser.version(), views, errors, warnings, artViewpoints: true, performanceAcceptance: false}, null, 2));
});
