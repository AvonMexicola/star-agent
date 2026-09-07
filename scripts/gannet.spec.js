import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {tmpdir} from 'node:os';
const output=process.env.GANNET_EVIDENCE??resolve(tmpdir(),'star-agent-gannet-browser-evidence');
test('authored hull, full access cycle and real camera views on desktop and phone',async({page})=>{
  const diagnostics=[];
  page.on('pageerror',e=>diagnostics.push(`page: ${e.message}`));
  page.on('console',m=>{if(m.type()==='error')diagnostics.push(`console: ${m.text()}`);});
  await mkdir(output,{recursive:true});await page.goto('/');
  await page.evaluate(async()=>{await window.gannetStudio.ready;});
  await expect(page.locator('#asset-state')).toContainText('geometry loaded');
  for(const name of ['exterior','rear','side','top','underside','cockpit']){
    await page.locator(`[data-view=${name}]`).click();await page.waitForTimeout(300);
    await page.screenshot({path:resolve(output,`desktop-${name}.png`)});
  }
  await page.locator('[data-command=open]').click();
  await expect.poll(()=>page.evaluate(()=>window.gannetStudio.systems.hatch.progress)).toBe(1);
  await page.locator('[data-view=bay]').click();
  await page.locator('#rover').click();
  await expect(page.locator('#rover')).toHaveAttribute('aria-pressed','true');
  await page.screenshot({path:resolve(output,'desktop-bay-burrow.png')});
  await page.locator('[data-command=lower]').click();
  await expect.poll(()=>page.evaluate(()=>window.gannetStudio.systems.lift.y)).toBe(0);
  await page.locator('[data-view=rear]').click();await page.screenshot({path:resolve(output,'desktop-lowered.png')});
  await page.locator('[data-command=raise]').click();
  await expect.poll(()=>page.evaluate(()=>window.gannetStudio.systems.lift.y)).toBe(1.4);
  await page.locator('[data-view=cabin]').click();await page.screenshot({path:resolve(output,'desktop-cabin.png')});
  await page.locator('[data-command=close]').click();
  await expect.poll(()=>page.evaluate(()=>window.gannetStudio.systems.secured)).toBe(true);
  await page.locator('#gear').click();await page.waitForTimeout(2000);
  await page.locator('[data-view=underside]').click();await page.screenshot({path:resolve(output,'desktop-gear-stowed.png')});
  await page.setViewportSize({width:390,height:844});
  for(const name of ['exterior','top','cockpit']){
    await page.locator(`[data-view=${name}]`).click();await page.waitForTimeout(300);
    await page.screenshot({path:resolve(output,`phone-${name}.png`)});
  }
  const state=await page.evaluate(()=>{const {renderer,ship,systems}=window.gannetStudio;const gl=renderer.getContext();const ext=gl.getExtension('WEBGL_debug_renderer_info');return{status:ship.userData.assetStatus,displayState:ship.displayState(),secured:systems.secured,renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),draws:renderer.info.render.calls,triangles:renderer.info.render.triangles};});
  await writeFile(resolve(output,'state.json'),JSON.stringify({state,diagnostics,scope:'Studio and injected pointer inspection only; no flight/carrier/controller gameplay or FPS acceptance'},null,2)+'\n');
  expect(state.status).toBe('ready');expect(diagnostics).toEqual([]);
});
