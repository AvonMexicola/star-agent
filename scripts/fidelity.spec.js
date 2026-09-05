import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

test('seeded planet renders orbit, ground materials, foliage, cabin and shadows', async ({ page, browser }, testInfo) => {
  await mkdir('/tmp/star-agent-fidelity', { recursive: true });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/?seed=7291&debug=1');
  await page.waitForFunction(() => window.starAgent?.state.ready, null, { timeout: 60000 });
  await page.evaluate(() => window.starAgent.setRenderScale(1));
  const backend = await page.evaluate(() => {
    const gl = document.querySelector('canvas').getContext('webgl2');
    const extension = gl.getExtension('WEBGL_debug_renderer_info');
    return extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  });
  console.log('RENDER ENVIRONMENT', { browser: browser.version(), backend, viewport: '1440x900' });
  const captures=[];
  const capture = async name => {
    await page.evaluate(async()=>{window.starAgent.setRenderScale(1);await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});
    await expect.poll(() => page.locator('#transit').evaluate(element => Number(getComputedStyle(element).opacity)), { timeout: 20000 }).toBeLessThan(.02);
    await page.waitForTimeout(1000);
    const path = `/tmp/star-agent-fidelity/${name}.png`;
    await page.screenshot({ path });
    await testInfo.attach(name, { path, contentType: 'image/png' });
    const state=await page.evaluate(() => window.starAgent.state);
    console.log(name,state);
    captures.push({name,renderScale:state.renderScale,fps:state.fps,drawCalls:state.drawCalls,triangles:state.triangles});
    await writeFile('/tmp/star-agent-fidelity/render-environment.json',JSON.stringify({browser:browser.version(),backend,viewport:{width:1440,height:900},captures},null,2));
    expect(errors).toEqual([]);
    await page.evaluate(()=>window.starAgent.setRenderScale(.55));
  };
  await capture('orbit');
  await page.evaluate(() => window.starAgent.setRenderScale(.6));
  await page.evaluate(() => window.starAgent.transit('forest'));
  await page.keyboard.press('KeyL');
  await page.waitForFunction(() => window.starAgent.state.mode === 'landed', null, { timeout: 60000 });
  await capture('forest-cockpit');
  await page.keyboard.press('KeyF');
  await capture('cabin');
  await page.keyboard.down('KeyW');
  await page.waitForFunction(() => window.starAgent.state.shipLocal[2] > 2.2);
  await page.keyboard.up('KeyW'); await page.keyboard.press('KeyX');
  await page.keyboard.press('KeyF');
  await page.waitForFunction(() => window.starAgent.state.doorProgress === 1);
  await page.keyboard.down('KeyW');
  await page.waitForFunction(() => window.starAgent.state.shipLocal[2] > 10);
  await page.keyboard.up('KeyW'); await page.keyboard.press('KeyX');
  expect(await page.evaluate(() => window.starAgent.state.insideShip)).toBe(false);
  await page.keyboard.press('Tab');
  await capture('forest-ground');
  await page.evaluate(() => window.starAgent.navigation.look(Math.PI, -.15));
  await capture('ship-exterior');
  for (const destination of ['coast', 'mountain', 'polar']) {
    await page.evaluate(name => window.starAgent.transit(name), destination);
    await capture(destination);
  }
  expect(await page.evaluate(() => window.starAgent.state.seed)).toBe(7291);
});

test('inspect coast material from low flight',async({page})=>{
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  await page.goto('/?seed=7291');
  await page.waitForFunction(()=>window.starAgent?.state.ready,null,{timeout:60000});
  await page.evaluate(()=>window.starAgent.setRenderScale(.55));
  await page.evaluate(()=>window.starAgent.transit('coast'));
  await expect.poll(()=>page.locator('#transit').evaluate(element=>Number(getComputedStyle(element).opacity))).toBeLessThan(.02);
  await page.keyboard.press('Tab');
  await page.evaluate(async()=>{window.starAgent.setRenderScale(1);await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});
  await page.screenshot({path:'/tmp/star-agent-fidelity/coast.png'});
  expect(errors).toEqual([]);
});
