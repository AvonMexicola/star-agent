import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';

test('hard impact destroys ship, renders crash effects, blocks controls and recovers explicitly',async({page,browser})=>{
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  await page.goto('/?seed=7291&debug');
  await page.waitForFunction(()=>window.starAgent?.state.ready);
  await page.evaluate(()=>window.starAgent.setRenderScale(.55));
  await page.locator('[data-destination="coast"]').click();
  await page.waitForFunction(()=>!window.starAgent.state.transiting);
  // Use the real collision path from a controlled approach, not crashAt().
  await page.evaluate(()=>{
    const nav=window.starAgent.navigation;
    nav.position.addScaledVector(nav.normal,8-nav.altitude);
    nav.flightAssist=false;nav.velocity.copy(nav.normal).multiplyScalar(-45);
  });
  await page.waitForFunction(()=>window.starAgent.state.mode==='crashed');
  await expect(page.locator('#crash-panel')).toBeVisible();
  await expect(page.locator('#crash-panel')).toContainText('Ship destroyed.');
  await expect(page.locator('#mode-label')).toHaveText('SHIP DESTROYED');
  const impact=await page.evaluate(()=>window.starAgent.state.crash);
  expect(impact.impactSpeed).toBeGreaterThan(12);
  await mkdir('/tmp/star-agent-crash',{recursive:true});
  await page.screenshot({path:'/tmp/star-agent-crash/impact.png'});
  for(const key of ['KeyB','KeyF','KeyV','KeyX'])await page.keyboard.press(key);
  await page.keyboard.down('KeyW');await page.keyboard.down('Space');await page.waitForTimeout(700);
  await page.keyboard.up('KeyW');await page.keyboard.up('Space');
  const stopped=await page.evaluate(()=>window.starAgent.state);
  expect(stopped.mode).toBe('crashed');expect(stopped.speed).toBe(0);expect(stopped.position).toEqual(impact.position);
  // Recovery remains available with the HUD hidden and at phone width.
  await page.keyboard.press('Tab');await page.setViewportSize({width:390,height:844});
  await expect(page.locator('#crash-recover')).toBeVisible();
  const bounds=await page.locator('#crash-panel').boundingBox();expect(bounds.x).toBeGreaterThanOrEqual(0);expect(bounds.x+bounds.width).toBeLessThanOrEqual(390);
  await page.screenshot({path:'/tmp/star-agent-crash/mobile-recovery.png'});
  await page.locator('#crash-recover').click();
  await page.waitForFunction(()=>!window.starAgent.state.transiting);
  await expect(page.locator('#crash-panel')).toBeHidden();
  const recovered=await page.evaluate(()=>window.starAgent.state);
  expect(recovered.mode).toBe('flight');expect(recovered.crash).toBeNull();expect(recovered.seed).toBe(7291);expect(recovered.flightAssist).toBe(true);
  const renderer=await page.evaluate(()=>{
    const gl=document.querySelector('canvas').getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');
    return ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);
  });
  await writeFile('/tmp/star-agent-crash/environment.json',JSON.stringify({browser:browser.version(),renderer,viewport:[1440,900],mobile:[390,844],renderScale:.55,impact,errors},null,2));
  expect(errors).toEqual([]);
});
