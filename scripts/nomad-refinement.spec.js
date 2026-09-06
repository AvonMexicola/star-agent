import { test, expect } from '@playwright/test';
test('Nomad has an unobstructed MFD view and a sculpted Blender pilot chair',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto('/dev/ship.html');await page.waitForFunction(()=>window.shipStudio?.ship.userData.assetStatus==='ready');
  expect(await page.evaluate(()=>window.shipStudio.ship.getObjectByName('PilotChair')?.children.length)).toBeGreaterThan(0);
  expect(await page.evaluate(()=>window.shipStudio.ship.getObjectByName('Pilot chair fallback').visible)).toBe(false);
  for(const view of ['chair','cockpit']){
    await page.evaluate(view=>window.shipStudio.view(view),view);await page.waitForTimeout(800);
    await page.screenshot({path:`/tmp/nomad-refined-${view}.png`});
  }
  expect(errors).toEqual([]);
});
