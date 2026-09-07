import {test,expect} from '@playwright/test';
import {setupNavigation,frames,evidence,steer,record,mapBody} from './navigation-helpers.js';

test('controller map bearing, charge, abort, direct-sight moon arrival and return to flight',async({page,browser})=>{
 const {tap,button,choose,drive,errors,requests}=await setupNavigation(page);
 await tap(14);await choose('map-body-aeon');await choose('map-body-selene');await tap(1);await page.waitForFunction(()=>window.starAgent.state.controller.armed);
 await drive();expect(await page.evaluate(()=>window.starAgent.state.travel)).toBe(null);
 await steer(page,'selene');await page.screenshot({path:`${evidence}/controller-ready.png`});
 // Menu, focus and controller identity changes all invalidate a previous charge.
 await tap(14);expect(await page.evaluate(()=>window.starAgent.state.navigationTargets.charge)).toBe(0);await tap(1);await page.waitForFunction(()=>window.starAgent.state.controller.armed);await steer(page,'selene');
 for(const kind of ['focus','disconnect','replacement']){
  await page.evaluate(kind=>{if(kind==='focus')window.dispatchEvent(new Event('blur'));if(kind==='disconnect')window.navPad.connected=false;if(kind==='replacement')window.navPad.id+=' replacement';},kind);await frames(page);
  expect(await page.evaluate(()=>window.starAgent.state.navigationTargets.ready)).toBe(false);
  await page.evaluate(()=>{window.navPad.connected=true;window.dispatchEvent(new Event('focus'));});await page.waitForFunction(()=>window.starAgent.state.controller.armed);await steer(page,'selene');
 }
 await drive();await page.waitForFunction(()=>Boolean(window.starAgent.state.travel));await button(6,true);await button(6,false);await page.waitForFunction(()=>!window.starAgent.state.travel);
 // Clear map selection, then acquire the visible moon entirely by steering.
 await tap(14);await choose('map-clear');await tap(1);await page.waitForFunction(()=>window.starAgent.state.controller.armed);expect(await page.evaluate(()=>window.starAgent.state.navigationTargets.selectedId)).toBe(null);
 await steer(page,'selene');expect(await page.evaluate(()=>window.starAgent.state.navigationTargets.selectedId)).toBe(null);await page.screenshot({path:`${evidence}/direct-sight-ready.png`});
 await page.evaluate(()=>{window.navSamples=[];window.sampleNav=setInterval(()=>{const s=window.starAgent.state;window.navSamples.push({position:s.position,speed:s.speed,phase:s.travel?.phase});},20);});
 await drive();await page.waitForFunction(()=>window.starAgent.state.travel?.phase==='decelerating'||window.starAgent.state.body==='selene');
 await page.waitForFunction(()=>!window.starAgent.state.travel&&window.starAgent.state.body==='selene',undefined,{timeout:30000});
 await page.evaluate(()=>clearInterval(window.sampleNav));const arrival=await page.evaluate(()=>({alt:window.starAgent.state.altitude,speed:window.starAgent.state.speed,samples:window.navSamples}));
 expect(arrival.alt).toBeCloseTo(20000,0);expect(arrival.speed).toBeLessThan(.1);expect(arrival.samples.filter(s=>s.speed>1000).length).toBeGreaterThan(2);
 await page.screenshot({path:`${evidence}/moon-arrival.png`});await button(0,true);await page.waitForFunction(()=>window.starAgent.state.speed>1);await button(0,false);await tap(6);
 await record(page,browser,'controller-travel',{arrival,errors,requests});expect(errors).toEqual([]);
});

test('keyboard steering acquires a body without map selection and touch engages the charged drive',async({page,browser})=>{
 const {errors,requests}=await setupNavigation(page,'kestrel');
 await steer(page,'aeon','keyboard');await page.screenshot({path:`${evidence}/kestrel-ready.png`});
 expect(await page.evaluate(()=>window.starAgent.state.navigationTargets.selectedId)).toBe(null);
 await page.locator('#navigation-engage').click();await page.waitForFunction(()=>Boolean(window.starAgent.state.travel));
 await page.waitForFunction(()=>!window.starAgent.state.travel,undefined,{timeout:30000});expect(await page.evaluate(()=>window.starAgent.state.altitude)).toBeCloseTo(20000,0);
 await page.keyboard.press('m');await mapBody(page,'selene');await page.setViewportSize({width:390,height:844});await frames(page);await page.screenshot({path:`${evidence}/phone-route.png`});await page.keyboard.press('Escape');
 await record(page,browser,'keyboard-travel',{errors,requests});expect(errors).toEqual([]);
});
