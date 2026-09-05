import { test,expect } from '@playwright/test';
import { mkdir,writeFile } from 'node:fs/promises';
const dir='/tmp/star-agent-reentry';
function watchErrors(page){
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  return errors;
}

test('production hull shader renders cold, plasma-hot and cooled with no extra draws',async({page,browser},testInfo)=>{
  const errors=watchErrors(page);await mkdir(dir,{recursive:true});
  await page.goto('/scripts/reentry-fixture.html');
  await page.waitForFunction(()=>window.reentryFixture);
  const captures={};
  for(const state of ['cold','hot','cooled']){
    captures[state]=await page.evaluate(state=>window.reentryFixture.render(state),state);
    expect(errors).toEqual([]);
    const path=`${dir}/hull-${state}.png`;await page.screenshot({path});
    await testInfo.attach(state,{path,contentType:'image/png'});
  }
  expect(captures.hot.heat).toBeGreaterThan(.98);
  expect(captures.cooled.heat).toBeLessThan(.001);
  expect(captures.hot.red).toBeGreaterThan(captures.cold.red*1.1);
  expect(Math.abs(captures.cold.red-captures.cooled.red)).toBeLessThan(captures.cold.red*.001);
  expect(captures.hot.calls).toBe(captures.cold.calls);
  expect(captures.hot.triangles).toBe(captures.cold.triangles);
  const backend=await page.evaluate(()=>{
    const gl=window.reentryFixture.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');
    return ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);
  });
  await writeFile(`${dir}/environment.json`,JSON.stringify({browser:browser.version(),backend,viewport:page.viewportSize(),captures,errors},null,2));
});

test('game flight drives heating from shared density, cools in vacuum and clears on transit',async({page},testInfo)=>{
  const errors=watchErrors(page);
  await page.goto('/?seed=7291&debug');
  await page.waitForFunction(()=>window.starAgent?.state.ready);
  await page.locator('#begin-button').click();
  await page.evaluate(()=>{
    window.starAgent.setRenderScale(.55);
    const nav=window.starAgent.navigation;
    // Freeze a diagnostic re-entry pose; production frame code still supplies
    // the density, speed, orientation and heat uniforms used during real flight.
    nav.enabled=false;nav.locked=true;nav.mode='flight';nav.flightAssist=false;
    nav.position.normalize().multiplyScalar(1592750+30000);
    nav.velocity.set(0,0,-3000).applyQuaternion(nav.orientation);
  });
  await expect.poll(()=>page.evaluate(()=>window.starAgent.state.reentryHeat),{timeout:30000}).toBeGreaterThan(.9);
  const path=`${dir}/cockpit-hot.png`;await page.screenshot({path});await testInfo.attach('cockpit',{path,contentType:'image/png'});
  const hot=await page.evaluate(()=>window.starAgent.state.reentryHeat);
  await page.evaluate(()=>{window.starAgent.navigation.position.normalize().multiplyScalar(1592750+71000);});
  await expect.poll(()=>page.evaluate(()=>window.starAgent.state.reentryHeat),{timeout:20000}).toBeLessThan(hot*.8);
  await page.evaluate(()=>{void window.starAgent.transit('orbit');});
  await expect.poll(()=>page.evaluate(()=>window.starAgent.state.reentryHeat),{timeout:10000}).toBe(0);
  expect(errors).toEqual([]);
});
