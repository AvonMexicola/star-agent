import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';

const SHOTS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'test-results');

// Terrain generation is real CPU work and the run is software-rasterised, so the
// waits here are generous rather than optimistic.
const BOOT_TIMEOUT = 90_000;

function watchForFailures(page) {
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', error => pageErrors.push(error.stack ?? String(error)));
  return { consoleErrors, pageErrors };
}

async function bootPlanet(page) {
  const failures = watchForFailures(page);
  await page.goto('/?intro=0');
  // The loading veil is dismissed by adding the "hidden" class once the world exists.
  await expect(page.locator('#loading')).toHaveClass(/(^|\s)hidden(\s|$)/, { timeout: BOOT_TIMEOUT });
  return failures;
}

test('the planet boots into orbit without a page error', async ({ page }) => {
  const { consoleErrors, pageErrors } = await bootPlanet(page);

  // Either the terrain status has moved on, or telemetry is already reporting an altitude.
  await expect(async () => {
    const status = (await page.locator('#terrain-status').innerText()).trim();
    const altitude = (await page.locator('#altitude').innerText()).trim();
    expect(status !== 'BUILDING TERRAIN' || altitude !== '—',
      `terrain-status=${status} altitude=${altitude}`).toBeTruthy();
  }).toPass({ timeout: BOOT_TIMEOUT });

  const viewport = page.locator('canvas#viewport');
  await expect(viewport).toBeVisible();
  const box = await viewport.boundingBox();
  expect(box, 'canvas#viewport has a layout box').not.toBeNull();
  expect(box.width).toBeGreaterThan(0);
  expect(box.height).toBeGreaterThan(0);

  await page.screenshot({ path: path.join(SHOTS, 'orbit.png'), fullPage: false });

  expect(pageErrors, `uncaught page errors:\n${pageErrors.join('\n')}`).toEqual([]);
  if (consoleErrors.length) console.log('console errors observed:\n' + consoleErrors.join('\n'));
});

test('quick transit to the coast leaves the exosphere', async ({ page }) => {
  const { pageErrors } = await bootPlanet(page);

  await page.locator('button[data-destination="coast"]').click();
  await expect
    .poll(async () => (await page.locator('#biome').innerText()).trim(), { timeout: BOOT_TIMEOUT })
    .not.toBe('EXOSPHERE');

  // Let the full-screen transit card fade out so the screenshot shows the landscape.
  await expect
    .poll(async () => Number(await page.locator('#transit').evaluate(
      element => getComputedStyle(element).opacity)), { timeout: BOOT_TIMEOUT })
    .toBeLessThan(0.02);
  await page.screenshot({ path: path.join(SHOTS, 'coast.png'), fullPage: false });

  expect(pageErrors, `uncaught page errors:\n${pageErrors.join('\n')}`).toEqual([]);
});

test('setting a course preserves position and a shared seed survives reload', async ({ page }) => {
  await page.goto('/?intro=0&seed=42');
  await page.waitForFunction(()=>window.starAgent?.state.ready, null, {timeout:BOOT_TIMEOUT});
  await page.evaluate(()=>window.starAgent.setRenderScale(.55));
  const before=await page.evaluate(()=>({state:window.starAgent.state,destinations:window.starAgent.destinations}));
  await page.locator('[data-destination="coast"]').click({modifiers:['Shift']});
  await expect(page.locator('#course-guidance')).toContainText('Verdant coast');
  const after=await page.evaluate(()=>window.starAgent.state);
  expect(after.position).toEqual(before.state.position);
  expect(after.transiting).toBe(false);
  expect(after.seed).toBe(42);
  await page.reload();
  await page.waitForFunction(()=>window.starAgent?.state.ready, null, {timeout:BOOT_TIMEOUT});
  expect(await page.evaluate(()=>window.starAgent.destinations)).toEqual(before.destinations);
  await expect(page.locator('#planet-seed')).toContainText('42');
});
