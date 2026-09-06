import {test,expect} from '@playwright/test';

for(const intro of [true,false])test(`startup preloads the ${intro?'station':'orbital'} view before accepting play`,async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  const start=Date.now();
  await page.goto(`/?debug&intro=${Number(intro)}`);
  await page.waitForFunction(()=>window.starAgent?.state.preload);
  expect(await page.evaluate(()=>window.starAgent.state.ready)).toBe(false);
  await expect(page.locator('#loading')).not.toHaveClass(/hidden/);
  await expect(page.locator('#loading-progress')).toBeVisible();
  if(intro)await page.waitForFunction(()=>window.starAgent.state.opening.phase==='cinematic');
  const before=await page.evaluate(()=>window.starAgent.state.position);
  for(const key of ['w','p','l','f','m','Tab'])await page.keyboard.press(key);
  await page.waitForTimeout(200);
  const loading=await page.evaluate(()=>window.starAgent.state);
  expect(loading.ready).toBe(false);expect(loading.position).toEqual(before);
  expect(loading.powered).toBe(true);expect(loading.audio.created).toBe(false);
  expect(loading.mapOpen).toBe(false);
  await page.keyboard.down('w');
  await page.screenshot({path:`/tmp/star-agent-preload-${intro?'station':'orbit'}.png`});
  await page.waitForFunction(()=>window.starAgent.state.ready,null,{timeout:120000});
  const ready=await page.evaluate(()=>window.starAgent.state);
  console.log('Preload complete',JSON.stringify({seconds:(Date.now()-start)/1000,preload:ready.preload,scale:ready.renderScale,terrain:ready.terrainLod}));
  expect(ready.preload.phase).toBe('ready');expect(ready.preload.orbitalResolution).toBe(4096);
  expect(ready.preload.orbitalComplete).toBe(true);
  expect(ready.preload.completed).toBe(ready.preload.total);
  expect(ready.audio.created).toBe(false);
  if(intro)expect(ready.opening.elapsed).toBeLessThan(1);
  await expect(page.locator('#loading')).toHaveClass(/hidden/);
  await page.keyboard.down('w'); // browser repeat from a key held through loading
  await page.waitForTimeout(100);
  expect(await page.evaluate(()=>window.starAgent.state.speed)).toBe(0);
  await page.keyboard.up('w');
  await page.keyboard.down('w');
  await page.waitForFunction(()=>window.starAgent.state.speed>0);
  await page.keyboard.up('w');
  expect(errors).toEqual([]);
});
