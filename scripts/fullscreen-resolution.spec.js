import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const output='/tmp/star-agent-fullscreen-evidence';
test('actual fullscreen increases buffer resolution, exits cleanly and preserves explicit graphics scale',async({page,browser})=>{
  await mkdir(output,{recursive:true});const errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(['error','warning'].includes(m.type()))errors.push(m.text());});
  await page.goto('/?intro=0&debug&seed=7291');await page.waitForFunction(()=>window.starAgent?.state.ready);
  const capture=async(name)=>{
    const result=await page.evaluate(()=>{const s=window.starAgent.state,c=document.querySelector('#viewport');return {policy:s.renderResolution,buffer:[c.width,c.height],viewport:[innerWidth,innerHeight],aspect:s.camera.fov,graphics:s.graphics};});
    await page.screenshot({path:`${output}/${name}.png`});return result;
  };
  // A trusted click enters the actual browser Fullscreen API. This temporary
  // harness button is not a shipped fullscreen control or a claimed F11 test.
  await page.evaluate(()=>{const b=document.createElement('button');b.id='fullscreen-test-entry';b.textContent='Enter fullscreen test';b.style='position:fixed;top:110px;left:20px;z-index:999';b.onclick=()=>document.documentElement.requestFullscreen();document.body.append(b);});
  const windowed=await capture('windowed');expect(windowed.policy.fullscreen).toBe(false);expect(windowed.policy.pixelRatio).toBe(1.25);
  await page.click('#fullscreen-test-entry');
  await page.waitForFunction(()=>document.fullscreenElement&&window.starAgent.state.renderResolution.fullscreen&&window.starAgent.state.renderResolution.pixelRatio===2);
  const full=await capture('fullscreen');expect(full.policy.scale).toBe(1);
  expect(full.buffer).toEqual([full.policy.width,full.policy.height]);expect(full.buffer[0]/full.viewport[0]).toBeCloseTo(2,2);
  expect(full.buffer[0]*full.buffer[1]).toBeGreaterThan(windowed.buffer[0]*windowed.buffer[1]);
  await page.evaluate(()=>document.exitFullscreen());await page.waitForFunction(()=>!window.starAgent.state.renderResolution.fullscreen);
  expect((await capture('windowed-restored')).policy.pixelRatio).toBe(1.25);
  await page.click('#graphics-button');
  await page.locator('[data-controller-key="resolution"]').click(); // Automatic ->60%.
  await page.getByRole('button',{name:'Close graphics'}).click();
  await page.waitForFunction(()=>window.starAgent.state.renderScale===.6);
  await page.click('#fullscreen-test-entry');await page.waitForFunction(()=>window.starAgent.state.renderResolution.fullscreen);
  const manual=await capture('fullscreen-manual');expect(manual.policy.scale).toBe(.6);expect(manual.graphics.resolution).toBe(.6);
  expect(manual.buffer).toEqual([manual.policy.width,manual.policy.height]);
  await page.evaluate(()=>document.exitFullscreen());await page.waitForFunction(()=>!window.starAgent.state.renderResolution.fullscreen);
  expect((await page.evaluate(()=>window.starAgent.state)).renderScale).toBe(.6);
  const renderer=await page.evaluate(()=>{const gl=document.querySelector('canvas').getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');return gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);});
  await writeFile(`${output}/metadata.json`,JSON.stringify({browser:browser.version(),renderer,windowed,full,manual,errors},null,2));
  expect(errors).toEqual([]);
});
