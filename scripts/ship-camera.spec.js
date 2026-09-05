import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const dir='/tmp/star-agent-camera';

test('4 and camera button show the new ship, preserve flight, and respect typing and walking',async({page,browser},testInfo)=>{
  await mkdir(dir,{recursive:true});const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  await page.goto('/?seed=7291&debug');
  await page.waitForFunction(()=>window.starAgent?.state.ready&&window.starAgent.state.shipAsset==='ready');
  await page.evaluate(()=>window.starAgent.setRenderScale(.55));
  const original=await page.evaluate(()=>window.starAgent.state.position);
  await page.keyboard.press('4');
  await expect.poll(()=>page.evaluate(()=>window.starAgent.state.camera.mode)).toBe('external');
  expect(await page.evaluate(()=>window.starAgent.state.position)).toEqual(original);
  await expect(page.locator('#camera-button')).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('.mission-panel')).toHaveCSS('opacity','0');
  const capture=async name=>{
    await page.evaluate(async()=>{window.starAgent.setRenderScale(1);await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
    const path=`${dir}/${name}.png`;await page.screenshot({path});await testInfo.attach(name,{path,contentType:'image/png'});
    await page.evaluate(()=>window.starAgent.setRenderScale(.55));
  };
  await capture('orbit-external');
  await page.keyboard.press('Numpad4');
  await expect.poll(()=>page.evaluate(()=>window.starAgent.state.camera.mode)).toBe('cockpit');
  expect(await page.evaluate(()=>window.starAgent.state.position)).toEqual(original);
  expect(await page.evaluate(()=>window.starAgent.state.camera.shipVisible)).toBe(true);
  await page.locator('#camera-button').click();
  await expect.poll(()=>page.evaluate(()=>window.starAgent.state.camera.mode)).toBe('external');
  await page.keyboard.down('w');await page.waitForTimeout(700);await page.keyboard.up('w');
  expect(await page.evaluate(()=>window.starAgent.state.speed)).toBeGreaterThan(1);
  await page.keyboard.press('x');
  await page.locator('#help-button').click();
  await expect(page.locator('#help-dialog')).toContainText('Toggle external ship / cockpit view');
  await page.locator('#seed-input').fill('');await page.locator('#seed-input').pressSequentially('44');
  await expect(page.locator('#seed-input')).toHaveValue('44');
  expect(await page.evaluate(()=>window.starAgent.state.camera.selected)).toBe(true);
  await page.locator('#close-help').click();
  // Surface inspection fixture uses the real ship, terrain and render pipeline.
  await page.evaluate(()=>{
    const app=window.starAgent,nav=app.navigation;
    nav.transit(app.destinations.coast,100);nav.velocity.set(0,0,0);
  });
  await page.waitForTimeout(1500);
  await page.waitForFunction(()=>window.starAgent.state.lod>=12&&window.starAgent.state.pending<5);
  expect(await page.evaluate(()=>window.starAgent.state.camera.mode)).toBe('external');
  await capture('surface-external');
  await page.evaluate(()=>{
    const nav=window.starAgent.navigation,station=nav.station;
    nav.position.copy(station.padWorldPosition).addScaledVector(station.up,3.2);nav.dock();
  });
  await expect.poll(()=>page.evaluate(()=>window.starAgent.state.mode)).toBe('landed');
  await page.waitForFunction(()=>{const s=window.starAgent.state;return Math.hypot(...s.position.map((n,i)=>n-s.camera.position[i]))<40;});
  const stationView=await page.evaluate(()=>{
    const nav=window.starAgent.navigation,cam=nav.position.clone().fromArray(window.starAgent.state.camera.position);
    const local=nav.station.toLocal(cam,cam.clone()),box=nav.station.interiorBox;
    return {inside:box.containsPoint(local),camera:window.starAgent.state.camera};
  });
  expect(stationView.inside).toBe(true);
  await capture('hangar-camera');
  await page.keyboard.press('f');
  await expect.poll(()=>page.evaluate(()=>window.starAgent.state.mode)).toBe('walk');
  await expect.poll(()=>page.evaluate(()=>window.starAgent.state.camera.mode)).toBe('cockpit');
  await expect(page.locator('#camera-button')).toBeDisabled();
  await page.keyboard.press('4');expect(await page.evaluate(()=>window.starAgent.state.camera.selected)).toBe(false);
  const backend=await page.evaluate(()=>{
    const gl=document.querySelector('canvas').getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');
    return ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);
  });
  await writeFile(`${dir}/environment.json`,JSON.stringify({browser:browser.version(),backend,viewport:page.viewportSize(),stationView,errors},null,2));
  expect(errors).toEqual([]);
});

test('camera button stays accessible on a narrow screen',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/?seed=7291&debug');
  await page.waitForFunction(()=>window.starAgent?.state.ready);
  const layout=await page.locator('#camera-button').evaluate(button=>{
    const r=button.getBoundingClientRect(),logo=document.querySelector('.wordmark').getBoundingClientRect();
    return {left:r.left,right:r.right,logoRight:logo.right,width:innerWidth};
  });
  expect(layout.left).toBeGreaterThan(layout.logoRight);
  expect(layout.right).toBeLessThanOrEqual(layout.width);
  await page.locator('#camera-button').click();
  await expect.poll(()=>page.evaluate(()=>window.starAgent.state.camera.mode)).toBe('external');
});
