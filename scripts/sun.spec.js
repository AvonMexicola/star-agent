import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const evidence='/tmp/star-agent-sun-evidence';
async function chooseDestination(page,name){
  await page.keyboard.press('KeyH');
  await expect(page.locator('#help-dialog')).toBeVisible();
  const menu=page.locator('#quick-transit-menu'),summary=page.locator('#quick-transit-menu > summary');
  await summary.click();
  await expect.poll(()=>menu.evaluate(element=>element.open)).toBe(true);
  await menu.locator(`[data-destination="${name}"]`).click();
  await expect(page.locator('#help-dialog')).toBeHidden();
}
test('the star is a destination: transit, standoff view, exclusion clamp, map registration',async({page,browser})=>{
  test.setTimeout(300000);
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  await page.goto('/?intro=0&debug');await page.waitForFunction(()=>window.starAgent?.state.ready);
  await page.evaluate(()=>window.starAgent.setRenderScale(.55));
  await mkdir(evidence,{recursive:true});
  const orbit=await page.evaluate(()=>window.starAgent.state);
  expect(orbit.sun.sphereVisible).toBe(false);expect(orbit.sun.diskWeight).toBe(1);expect(orbit.sunHeat).toBe(0);
  // Map: the star is selectable and routes to the standoff.
  await page.keyboard.press('KeyM');await expect(page.locator('#system-map')).toBeVisible();
  await page.locator('[data-travel-target="star"]').click();
  await expect(page.locator('#map-target-name')).toHaveText('Our star');
  await expect(page.locator('#map-approach')).toHaveText('558,122 km');
  await page.screenshot({path:`${evidence}/map-star.png`});
  await page.keyboard.press('Escape');await expect(page.locator('#system-map')).toBeHidden();
  // Quick transit to the standoff.
  await chooseDestination(page,'star');
  await page.waitForFunction(()=>!window.starAgent.state.transiting&&Number(getComputedStyle(document.getElementById('transit')).opacity)===0);
  await page.waitForTimeout(1500);
  const standoff=await page.evaluate(()=>window.starAgent.state);
  expect(standoff.sun.distance/1000).toBeCloseTo(798122,-1);
  expect(standoff.sun.sphereVisible).toBe(true);expect(standoff.sun.glareVisible).toBe(true);expect(standoff.sun.diskWeight).toBe(0);
  expect(standoff.sun.angularRadius*2*180/Math.PI).toBeCloseTo(35,1);
  expect(standoff.sunHeat).toBeGreaterThan(.5);expect(standoff.sunHeat).toBeLessThan(.97);
  expect(standoff.drawCalls).toBeLessThanOrEqual(12);
  await expect(page.locator('#state-text')).toContainText('HULL TEMPERATURE HIGH');
  await expect(page.locator('#altitude-reference')).toHaveText('FROM OUR STAR');
  await expect(page.locator('#biome')).toHaveText('OUR STAR · CORONA');
  await page.keyboard.press('Tab');await page.screenshot({path:`${evidence}/standoff.png`});await page.keyboard.press('Tab');
  // Manual flight cannot enter the exclusion sphere; the HUD goes critical.
  await page.evaluate(()=>window.starAgent.sunApproach(3.02));
  await page.keyboard.down('w');await page.waitForTimeout(2500);await page.keyboard.up('w');
  await page.waitForFunction(()=>window.starAgent.state.sunHeat>=.97);
  await expect(page.locator('#state-text')).toContainText('HULL TEMPERATURE CRITICAL');
  const close=await page.evaluate(()=>window.starAgent.state);
  expect(close.sun.distance).toBeGreaterThanOrEqual(240_000_000*3-1);
  await page.keyboard.press('Tab');await page.screenshot({path:`${evidence}/close-pass.png`});await page.keyboard.press('Tab');
  await page.keyboard.press('o');await page.waitForFunction(()=>!window.starAgent.state.transiting);
  expect(await page.evaluate(()=>window.starAgent.state.sun.sphereVisible)).toBe(false);
  const gpu=await page.evaluate(()=>{const gl=document.querySelector('canvas').getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');return {renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),viewport:[innerWidth,innerHeight]};});
  await writeFile(`${evidence}/environment.json`,JSON.stringify({browser:browser.version(),...gpu,orbit:orbit.sun,standoff:{sun:standoff.sun,drawCalls:standoff.drawCalls,triangles:standoff.triangles},close:close.sun,errors},null,2));
  expect(errors).toEqual([]);
});
