import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const evidence = '/tmp/star-agent-pyre-evidence';
async function chooseDestination(page, name, modifiers = []) {
  await page.keyboard.press('KeyH');
  await expect(page.locator('#help-dialog')).toBeVisible();
  const menu = page.locator('#quick-transit-menu'), summary = page.locator('#quick-transit-menu > summary');
  await expect.poll(() => menu.evaluate(element => element.open)).toBe(false);
  await summary.click();
  await expect.poll(() => menu.evaluate(element => element.open)).toBe(true);
  await menu.locator(`[data-destination="${name}"]`).click({ modifiers });
  await expect(page.locator('#help-dialog')).toBeHidden();
}
test('Pyre transit, terminator arrival, landing, walking on basalt and return render without errors', async ({ page, browser }) => {
  test.setTimeout(420000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/?intro=0&debug&epoch=1788000000000'); await page.waitForFunction(() => window.starAgent?.state.ready);
  await page.evaluate(() => window.starAgent.setRenderScale(.55));
  await mkdir(evidence, { recursive: true });
  const before = await page.evaluate(() => window.starAgent.state.position);
  await chooseDestination(page, 'pyre', ['Shift']);
  await expect(page.locator('#course-guidance')).toContainText('Pyre');
  expect(await page.evaluate(() => window.starAgent.state.position)).toEqual(before);
  await chooseDestination(page, 'pyre');
  await page.waitForFunction(() => !window.starAgent.state.transiting && Number(getComputedStyle(document.getElementById('transit')).opacity) === 0, null, { timeout: 120000 });
  await expect(page.locator('#altitude-reference')).toHaveText('ABOVE PYRE');
  await expect(page.locator('#mode-label')).toContainText('PYRE');
  const arrival = await page.evaluate(() => window.starAgent.state);
  expect(arrival.body).toBe('pyre'); expect(arrival.altitude).toBeCloseTo(60000, -1);
  expect(arrival.atmosphereFraction).toBeGreaterThan(0); expect(arrival.flightRegime).not.toBe('SPACE');
  expect(arrival.biome).toMatch(/^PYRE · /); expect(arrival.heat).toBeGreaterThanOrEqual(0);
  await page.waitForFunction(() => window.starAgent.state.pyre.ready && window.starAgent.state.pyre.mapsReady, null, { timeout: 120000 });
  await page.keyboard.press('Tab'); await page.screenshot({ path: `${evidence}/terminator-60km.png` }); await page.keyboard.press('Tab');
  // Descend to a landing site near the terminator and land with L.
  await page.evaluate(() => { const nav = window.starAgent.navigation; nav.transitPyre(400); });
  await page.waitForFunction(() => window.starAgent.state.pyre.lod >= 12, null, { timeout: 180000 });
  await page.keyboard.press('l');
  await page.waitForFunction(() => window.starAgent.state.mode === 'landed', null, { timeout: 120000 });
  const landed = await page.evaluate(() => window.starAgent.state);
  expect(landed.body).toBe('pyre'); expect(landed.pyre.lod).toBeGreaterThanOrEqual(12);
  await page.keyboard.press('f');
  await page.keyboard.down('w'); await page.waitForFunction(() => window.starAgent.state.shipLocal[2] > 2.3); await page.keyboard.up('w'); await page.keyboard.press('x');
  await page.keyboard.press('f'); await page.waitForFunction(() => window.starAgent.state.doorProgress === 1);
  await page.keyboard.down('w'); await page.waitForFunction(() => window.starAgent.state.shipLocal[2] > 12); await page.keyboard.up('w'); await page.keyboard.press('x');
  const outside = await page.evaluate(() => window.starAgent.state);
  expect(outside.insideShip).toBe(false); expect(outside.altitude).toBeCloseTo(1.75, 3);
  await expect(page.locator('#mode-label')).toHaveText('PYRE EXPLORATION');
  await page.keyboard.press('Tab'); await page.screenshot({ path: `${evidence}/surface.png` }); await page.keyboard.press('Tab');
  await page.keyboard.press('o'); await page.waitForFunction(() => !window.starAgent.state.transiting);
  expect(await page.evaluate(() => window.starAgent.state.body)).toBe('aeon');
  const gpu = await page.evaluate(() => { const gl = document.querySelector('canvas').getContext('webgl2'), ext = gl.getExtension('WEBGL_debug_renderer_info'); return { renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), viewport: [innerWidth, innerHeight] }; });
  await writeFile(`${evidence}/environment.json`, JSON.stringify({ browser: browser.version(), ...gpu, arrival, landed, outside, errors }, null, 2));
  expect(errors).toEqual([]);
});
