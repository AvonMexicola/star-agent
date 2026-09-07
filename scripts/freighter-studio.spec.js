import {test,expect} from '@playwright/test';
// The old bookmark is an alias; the retired hull/elevator UI is never loaded.
test('old Atlas studio bookmark opens the current full-size asset',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/dev/freighter.html');await page.waitForURL(/dev\/atlas-mark-ii\.html/);
  await page.waitForFunction(()=>window.atlasMarkIIStudio?.model);
  expect(await page.evaluate(()=>window.atlasMarkIIStudio.stats.triangles)).toBeGreaterThan(50000);
  expect(await page.evaluate(()=>window.atlasMarkIIStudio.systems.gear.legs.length)).toBe(6);
  expect(errors).toEqual([]);
});
