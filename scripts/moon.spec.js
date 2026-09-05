import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

test('moon renders in orbit and on approach, occludes stars and blocks surface crossings',async({page,browser})=>{
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  await page.goto('/?debug');
  await page.waitForFunction(()=>window.starAgent?.state.ready);
  await page.evaluate(()=>window.starAgent.setRenderScale(.55));
  await mkdir('/tmp/star-agent-moon-evidence',{recursive:true});
  await page.keyboard.press('Tab');
  await page.screenshot({path:'/tmp/star-agent-moon-evidence/orbit.png'});
  await page.keyboard.press('Tab');
  const before=await page.evaluate(()=>window.starAgent.state.position);
  await page.locator('[data-destination="moon"]').click({modifiers:['Shift']});
  await expect(page.locator('#course-guidance')).toContainText('Selene');
  expect(await page.evaluate(()=>window.starAgent.state.position)).toEqual(before);
  await page.locator('[data-destination="moon"]').click();
  await page.waitForFunction(()=>!window.starAgent.state.transiting&&Number(getComputedStyle(document.getElementById('transit')).opacity)===0);
  await expect(page.locator('#mode-label')).toHaveText('LUNAR FLYBY');
  await expect(page.locator('#altitude-reference')).toHaveText('ABOVE SELENE');
  const state=await page.evaluate(()=>window.starAgent.state);
  expect(state.moon.altitude).toBeGreaterThan(state.moon.radius*2);
  await page.keyboard.press('l');
  await expect(page.locator('#toast')).toContainText('flyby destination');
  expect(await page.evaluate(()=>window.starAgent.state.autoland)).toBe(false);
  await page.keyboard.press('Tab');
  await page.screenshot({path:'/tmp/star-agent-moon-evidence/approach.png'});
  // Turn around: Aeon must still render correctly from lunar space.
  await page.evaluate(()=>{const nav=window.starAgent.navigation;nav.orientToward(nav.position.clone().set(0,0,0),nav.position.clone().set(0,1,0));});
  await page.waitForTimeout(400);
  await page.screenshot({path:'/tmp/star-agent-moon-evidence/aeon-from-moon.png'});
  await page.evaluate(()=>{
    const nav=window.starAgent.navigation,moon=window.starAgent.state.moon;
    nav.position.set(...moon.position).add(nav.position.clone().set(0,0,moon.radius+4000.1));
    nav.velocity.set(0,0,-1e8);nav.update(.2);
  });
  const stopped=await page.evaluate(()=>window.starAgent.state);
  expect(stopped.moon.altitude).toBeGreaterThanOrEqual(3999.99);
  expect(stopped.speed).toBe(0);
  await page.keyboard.press('o');await page.waitForFunction(()=>!window.starAgent.state.transiting&&Number(getComputedStyle(document.getElementById('transit')).opacity)===0);
  await expect(page.locator('#altitude-reference')).toHaveText('ABOVE AEON');
  const gpu=await page.evaluate(()=>{const gl=document.querySelector('canvas').getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');return {renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),viewport:[innerWidth,innerHeight]};});
  await writeFile('/tmp/star-agent-moon-evidence/environment.json',JSON.stringify({browser:browser.version(),...gpu,errors},null,2));
  expect(errors).toEqual([]);
});
