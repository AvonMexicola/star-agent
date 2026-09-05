import { test, expect } from '@playwright/test';
test('inspect the Blender exterior, readable cockpit, and hinged cargo container', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => { errors.push(error.message);console.log('PAGE ERROR', error.message); });
  page.on('console', message => { if (['error', 'warning'].includes(message.type())) console.log(message.type(), message.text());if (message.type() === 'error' && /THREE|WebGL|shader/i.test(message.text())) errors.push(message.text()); });
  await page.goto('/dev/ship.html');
  await page.waitForFunction(() => window.shipStudio?.ship.userData.assetStatus === 'ready', null, { timeout: 20000 });
  for (const name of ['exterior', 'rear', 'cockpit', 'cargo']) {
    await page.getByRole('button', { name: name === 'rear' ? 'BOARDING' : name.toUpperCase(), exact: true }).click();
    await page.waitForTimeout(750);
    await page.screenshot({ path: `/tmp/nomad-${name}.png` });
  }
  await page.getByRole('button', { name: 'OPEN / CLOSE STORAGE' }).click();
  await page.waitForFunction(() => window.shipStudio.ship.userData.storageProgress === 1);
  await page.screenshot({ path: '/tmp/nomad-cargo-open.png' });
  expect(await page.evaluate(() => window.shipStudio.ship.displayState().length)).toBe(4);
  expect(errors).toEqual([]);
});
