import { test, expect } from '@playwright/test';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { FLEET_KEY } from '../src/fleet.js';

const out = process.env.DIRECT_ENTRY_OUT || '/tmp/star-agent-direct-entry';
test.afterEach(async ({ page }, info) => {
  if (info.status !== info.expectedStatus) await writeFile(`${out}/failure.json`,
    JSON.stringify(await page.evaluate(() => window.starAgent?.state).catch(error => ({ error: error.message })), null, 2));
});
test('one initial load reaches the Nomad shoulder opening; scenes remain optional on keyboard and controller', async ({ page, browser }) => {
  await mkdir(out, { recursive: true });
  const errors = [], responses = [], documents = [], api = [];
  const savedFleet = JSON.stringify({ version: 1, active: 'atlas', unlocked: true, surfaceVisited: true });
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('request', request => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documents.push(request.url());
    if (/\/api\/|\/ws(?:\?|$)/.test(request.url())) api.push(request.url());
  });
  page.on('websocket', socket => api.push(socket.url()));
  page.on('response', response => {
    if (/\/models\/(nomad|station)\.glb\?/.test(response.url())) responses.push(response);
  });
  await page.addInitScript(({ key, value }) => {
    localStorage.setItem(key, value);
    window.entryPad = { id: 'Direct entry standard pad', index: 0, connected: true, mapping: 'standard',
      axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
    Object.defineProperty(navigator, 'getGamepads', { value: () => [window.entryPad] });
  }, { key: FLEET_KEY, value: savedFleet });
  const frames = () => page.evaluate(async () => { for (let i = 0; i < 4; i++) await new Promise(requestAnimationFrame); });
  const button = async (index, down) => {
    await page.evaluate(({ index, down }) => { window.entryPad.buttons[index] = { pressed: down, value: Number(down) }; }, { index, down });
    await frames();
  };
  const tap = async index => { await button(index, true); await button(index, false); };
  const state = () => page.evaluate(() => window.starAgent.state);
  await page.goto('/?seed=7291&debug');
  await page.waitForFunction(() => window.starAgent?.state.ready, null, { timeout: 120000 });
  const initial = await state();
  expect(initial.shipId).toBe('nomad');
  expect(initial.mode).toBe('walk');
  expect(initial.opening.phase).toBe('cinematic');
  expect(initial.character.visible).toBe(true);
  expect(initial.station.docked).toBe(true);
  expect(initial.dev.open).toBe(false);
  expect(initial.shipAsset).toBe('ready');
  expect(initial.shipAssetError).toBeFalsy();
  expect(Math.hypot(...initial.camera.position.map((n, i) => n - initial.position[i]))).toBeGreaterThan(3);
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  expect(documents).toHaveLength(1);
  await page.screenshot({ path: `${out}/nomad-opening.png` });
  await page.waitForFunction(doors => window.starAgent.state.opening.doors > doors, initial.opening.doors);
  await page.keyboard.press('F2');
  await expect(page.locator('#dev-launcher')).toBeVisible();
  await page.keyboard.press('F2');
  await expect(page.locator('#dev-launcher')).not.toBeVisible();
  await page.waitForFunction(() => window.starAgent.state.controller.armed);
  await tap(9);
  await expect(page.locator('#dev-launcher')).toBeVisible();
  await expect(page.locator('[data-controller-key="dev-ship-nomad"]')).toBeFocused();
  await page.screenshot({ path: `${out}/scene-options.png` });
  await button(7, true); await tap(1);
  await expect(page.locator('#dev-launcher')).not.toBeVisible();
  expect((await state()).controller.armed).toBe(false);
  await button(7, false);
  await page.waitForFunction(() => window.starAgent.state.controller.armed);
  await page.evaluate(() => { window.entryPad.axes[1] = -.7; });
  await page.waitForFunction(() => window.starAgent.state.opening.phase === 'playing' && window.starAgent.state.speed > 0);
  await page.evaluate(() => { window.entryPad.axes[1] = 0; }); await frames();
  expect(documents).toHaveLength(1);
  expect(await page.evaluate(key => localStorage.getItem(key), FLEET_KEY)).toBe(savedFleet);
  await page.screenshot({ path: `${out}/walking.png` });

  const assets = [];
  for (const response of responses) {
    const url = new URL(response.url());
    const expected = createHash('sha256').update(await readFile(`public${url.pathname}`)).digest('hex');
    expect(url.searchParams.get('v')).toBe(expected);
    expect(createHash('sha256').update(await response.body()).digest('hex')).toBe(expected);
    assets.push({ path: url.pathname, revision: expected, status: response.status() });
  }
  expect(new Set(assets.map(asset => asset.path))).toEqual(new Set(['/models/nomad.glb', '/models/station.glb']));

  // A different scene is loaded only after the player explicitly asks for it.
  await page.keyboard.press('F2');
  await page.locator('[data-ship="kestrel"]').click();
  await page.locator('[data-location="hangar"]').click();
  await page.locator('.dev-launch').click();
  await page.waitForURL(/ship=kestrel/);
  await page.waitForFunction(() => window.starAgent?.state.ready, null, { timeout: 120000 });
  const selected = await state();
  expect(selected.shipId).toBe('kestrel');
  expect(selected.dev.open).toBe(false);
  expect(selected.station.docked).toBe(true);
  expect(documents).toHaveLength(2);
  await page.screenshot({ path: `${out}/selected-kestrel.png` });
  expect(errors).toEqual([]); expect(api).toEqual([]);
  await writeFile(`${out}/receipt.json`, JSON.stringify({ browser: browser.version(), viewport: page.viewportSize(),
    initial, selected, assets, documents, errors, api, controller: 'Injected W3C standard Gamepad; no physical hardware test' }, null, 2));
});
