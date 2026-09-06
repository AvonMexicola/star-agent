import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

test('inertial controls coast and rotate, assist brakes, transition HUD renders', async ({ page, browser }) => {
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  await page.goto('/?intro=0&seed=7291&debug');
  await page.waitForFunction(()=>window.starAgent?.state.ready);
  await page.evaluate(()=>window.starAgent.setRenderScale(.55));
  await page.keyboard.press('KeyV');
  await expect.poll(()=>page.evaluate(()=>window.starAgent.state.flightAssist)).toBe(false);
  await expect(page.locator('#drive-label')).toHaveText('INERTIAL · V TO ASSIST');
  await page.keyboard.down('KeyW');await page.waitForTimeout(1200);await page.keyboard.up('KeyW');
  const thrust=await page.evaluate(()=>window.starAgent.state);
  expect(thrust.speed).toBeGreaterThan(10);
  await page.waitForTimeout(1200);
  const coast=await page.evaluate(()=>window.starAgent.state);
  expect(coast.speed).toBeGreaterThan(thrust.speed*.9);
  expect(coast.position).not.toEqual(thrust.position);
  await page.keyboard.down('KeyQ');await page.waitForTimeout(400);await page.keyboard.up('KeyQ');
  const spin=await page.evaluate(()=>window.starAgent.state.angularVelocity);
  expect(Math.abs(spin[2])).toBeGreaterThan(.05);
  await page.waitForTimeout(500);
  expect(await page.evaluate(()=>window.starAgent.state.angularVelocity)).toEqual(spin);
  await page.keyboard.press('KeyX');
  expect(await page.evaluate(()=>window.starAgent.state.angularVelocity)).toEqual([0,0,0]);
  await page.keyboard.press('KeyV');
  await page.keyboard.down('KeyW');await page.waitForTimeout(400);await page.keyboard.up('KeyW');
  const assisted=await page.evaluate(()=>window.starAgent.state.speed);
  await page.waitForTimeout(1200);
  expect(await page.evaluate(()=>window.starAgent.state.speed)).toBeLessThan(assisted*.25);
  // A diagnostic fixture checks the transition readout, not a transit journey.
  await page.evaluate(()=>{
    const nav=window.starAgent.navigation;nav.position.normalize().multiplyScalar(1592750+45000);nav.velocity.set(0,0,0);
  });
  await expect(page.locator('#mode-label')).toHaveText('TRANSITION · ATMO 50%');
  await page.keyboard.press('KeyH');
  await expect(page.locator('#help-dialog')).toContainText('Toggle flight assist / inertial flight');
  await page.keyboard.press('KeyH');
  await expect(page.locator('#help-dialog')).toBeHidden();
  await mkdir('/tmp/star-agent-flight',{recursive:true});
  await page.screenshot({path:'/tmp/star-agent-flight/transition.png'});
  const gpu=await page.evaluate(()=>{
    const gl=document.querySelector('canvas').getContext('webgl2');const ext=gl.getExtension('WEBGL_debug_renderer_info');
    return {renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),viewport:[innerWidth,innerHeight],state:window.starAgent.state};
  });
  await writeFile('/tmp/star-agent-flight/environment.json',JSON.stringify({browser:browser.version(),...gpu,errors},null,2));
  expect(errors).toEqual([]);
});
