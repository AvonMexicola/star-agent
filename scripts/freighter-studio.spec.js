import { test, expect } from '@playwright/test';
test('Atlas Blender geometry renders with three independently animated cargo lifts and four MFDs',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto('/dev/freighter.html');
  await page.waitForFunction(()=>window.shipStudio?.ship.userData.assetStatus==='ready');
  for(const view of ['exterior','cockpit','cargo','rear']){
    await page.evaluate(view=>window.shipStudio.view(view),view);await page.waitForTimeout(700);
    await page.screenshot({path:`/tmp/atlas-${view}.png`});
  }
  await page.locator('[data-lift="main"]').click();
  await page.waitForFunction(()=>window.shipStudio.systems.lifts[0].y===0);
  await page.screenshot({path:'/tmp/atlas-elevator-lowered.png'});
  for(const id of ['port','starboard'])await page.locator(`[data-lift="${id}"]`).click();
  await page.waitForFunction(()=>window.shipStudio.systems.lifts.slice(1).every(l=>l.y===7));
  await page.evaluate(()=>window.shipStudio.view('cargo'));await page.waitForTimeout(700);
  await page.screenshot({path:'/tmp/atlas-cargo-lifts.png'});
  expect(await page.evaluate(()=>window.shipStudio.ship.displayState().length)).toBe(4);
  expect(errors).toEqual([]);
});
