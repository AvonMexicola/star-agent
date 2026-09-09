import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {setupNavigation,frames} from '../tests/browser/navigation-helpers.js';
const evidence=process.env.NAV_EVIDENCE||'/tmp/star-agent-focused-arrows';
const markerIds=page=>page.locator('.navigation-marker').evaluateAll(nodes=>nodes.map(n=>n.dataset.id).sort());
async function capture(page,name){await mkdir(evidence,{recursive:true});await page.screenshot({path:`${evidence}/${name}.png`});}

test('quiet startup, selected POI and next patrol objective through controller map controls',async({page,browser})=>{
  const {tap,choose,errors}=await setupNavigation(page);
  expect(await markerIds(page)).toEqual([]);
  expect(await page.evaluate(()=>starAgent.state.navigationTargets.targets.length)).toBeGreaterThan(10);
  await capture(page,'startup-after');
  await tap(9);await expect(page.locator('#patrol-console')).toBeVisible();
  await choose('patrol-accept');await tap(1);await page.waitForFunction(()=>starAgent.state.controller.armed);
  await tap(9);await choose('tab-map');await choose('map-body-aeon');await choose('map-view-locations');await choose('map-signal-site-coast');
  await tap(1);await page.waitForFunction(()=>starAgent.state.controller.armed);
  expect(await markerIds(page)).toEqual(['mission-patrol','site-coast']);
  await capture(page,'objective-and-selected-poi');
  await tap(9);await choose('map-view-filters');await choose('map-filter-missions');await choose('map-filter-ships');
  await choose('map-view-locations');await choose('map-signal-site-forest');await tap(1);await page.waitForFunction(()=>starAgent.state.controller.armed);
  expect(await markerIds(page)).toEqual(['mission-patrol','site-forest']);
  await page.setViewportSize({width:390,height:844});await frames(page);await capture(page,'phone-objective-and-poi');
  await page.setViewportSize({width:1440,height:900});await tap(9);await choose('map-clear');await tap(1);await page.waitForFunction(()=>starAgent.state.controller.armed);
  expect(await markerIds(page)).toEqual(['mission-patrol']);
  await tap(9);await choose('tab-contracts');await choose('patrol-abort');await tap(1);await page.waitForFunction(()=>starAgent.state.controller.armed);
  await expect.poll(()=>markerIds(page)).toEqual([]);
  // Existing saved all-category preferences must not bring back the startup arrows.
  await page.evaluate(()=>localStorage.setItem('star-agent-nav-filters',JSON.stringify(Object.fromEntries(Object.keys(starAgent.state.navigationTargets.filters).map(key=>[key,true])))));
  await page.reload();await page.waitForFunction(()=>starAgent?.state.ready&&starAgent.state.enabled&&!starAgent.state.transiting,null,{timeout:90000});
  expect(await markerIds(page)).toEqual([]);
  const gl=await page.evaluate(()=>{const gl=document.querySelector('#viewport').getContext('webgl2'),e=gl.getExtension('WEBGL_debug_renderer_info');return e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):'unknown';});
  await writeFile(`${evidence}/navigation.json`,JSON.stringify({browser:browser.version(),renderer:gl,errors,input:'Injected standard Gamepad, no gameplay state mutations; storage preference set for migration check.'},null,2));
  expect(errors).toEqual([]);
});

test('ship bearing while driving, and unoccupied Burrow and Sentry bearings',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.route('**/api/auth/session',route=>route.fulfill({json:{account:null}}));
  await page.goto('/?dev=1&ship=nomad&start=rover-surface&intro=0&debug&seed=7291');
  await page.waitForFunction(()=>starAgent?.state.ready&&starAgent.state.rover?.occupied&&!starAgent.state.transiting,null,{timeout:90000});
  await expect(page.locator('#ship-marker')).toBeVisible();expect(await markerIds(page)).toEqual([]);
  await capture(page,'driving-ship-bearing');
  await page.keyboard.press('f');await page.waitForFunction(()=>!starAgent.state.rover.occupied&&!starAgent.state.rover.busy,null,{timeout:30000});
  await expect.poll(()=>markerIds(page)).toEqual(['your-burrow']);
  await expect(page.locator('#ship-marker')).toBeVisible();await capture(page,'parked-burrow-and-ship');
  await page.goto('/?dev=1&ship=nomad&start=sentry-surface&intro=0&debug&seed=7291');
  await page.waitForFunction(()=>starAgent?.state.ready&&starAgent.state.sentry.vehicles.length&&!starAgent.state.transiting,null,{timeout:90000});
  await expect.poll(async()=> (await markerIds(page)).filter(id=>id.startsWith('your-sentry-')).length).toBe(1);
  await capture(page,'parked-sentry-and-ship');
  expect(errors).toEqual([]);
});
