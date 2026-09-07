import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {MINING_KEY} from '../src/mining/store.js';
import {SANDBOX_PREFIX} from '../src/build/sandbox.js';
const out='/tmp/star-agent-build-sandbox';
async function tap(page,i){await page.evaluate(i=>window.testPad.buttons[i]={pressed:true,value:1},i);await page.waitForFunction(i=>window.starAgent.navigation.gamepad.previous[i],i);await page.evaluate(i=>window.testPad.buttons[i]={pressed:false,value:0},i);await page.waitForFunction(i=>!window.starAgent.navigation.gamepad.previous[i],i);}
async function choose(page,key,navigates=false){const el=page.locator(`[data-controller-key="${key}"]`);for(let i=0;i<100;i++){if(await el.evaluate(e=>e===document.activeElement))break;await page.waitForFunction(()=>window.starAgent.navigation.gamepad.uiArmed);await tap(page,13);}await expect(el).toBeFocused();if(navigates)await page.evaluate(()=>window.testPad.buttons[0]={pressed:true,value:1});else await tap(page,0);}
const ready=page=>page.waitForFunction(()=>window.starAgent?.state.ready&&window.starAgent.state.controller.armed,null,{timeout:90000});
const saved=page=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),SANDBOX_PREFIX+MINING_KEY);
test.afterEach(async({page},info)=>{if(info.status===info.expectedStatus)return;await mkdir(out,{recursive:true});await page.screenshot({path:`${out}/failure.png`});await writeFile(`${out}/failure.json`,JSON.stringify(await page.evaluate(()=>window.starAgent?.state),null,2));});
test('controller enters supplied sandbox, builds, checks/refills stock, reloads and returns to regular save',async({page,browser})=>{
 test.setTimeout(240000);page.setDefaultTimeout(15000);await mkdir(out,{recursive:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 // Only Gamepad input is injected. The shipped sandbox prepares stock/site/spawn.
 await page.addInitScript(()=>{window.testPad={id:'Build sandbox standard controller',index:0,connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};navigator.getGamepads=()=>[window.testPad];});
 await page.goto('/?intro=0&debug&seed=7291');await ready(page);const original=await page.evaluate(key=>localStorage.getItem(key),MINING_KEY);
 await tap(page,9);await choose(page,'build-sandbox',true);await page.waitForURL(/sandbox=build/);await ready(page);
 expect(await page.evaluate(()=>window.starAgent.state.sandbox)).toBe(true);expect(await page.evaluate(()=>window.starAgent.state.mode)).toBe('walk');expect((await saved(page)).build.claims[0].pieces.length).toBe(10);
 await page.waitForFunction(()=>window.starAgent.state.build.assetsReady&&window.starAgent.state.moon.lod>=14);
 await page.screenshot({path:`${out}/arrival.png`});
 await tap(page,9);await choose(page,'build');await page.waitForFunction(()=>window.starAgent.navigation.gamepad.uiArmed);
 await page.evaluate(()=>window.testPad.axes=[.8,-.8,0,0]);await expect(page.locator('.build-wheel')).toHaveAttribute('data-selected','wall');
 await page.screenshot({path:`${out}/radial-desktop.png`});await page.setViewportSize({width:390,height:844});await page.screenshot({path:`${out}/radial-phone.png`});await page.setViewportSize({width:1440,height:900});
 await tap(page,0);await page.evaluate(()=>window.testPad.axes.fill(0));await ready(page);await page.waitForFunction(()=>window.starAgent.state.build.preview?.valid);
 const before=await saved(page);await page.screenshot({path:`${out}/wall-preview.png`});await tap(page,7);await page.waitForFunction(()=>window.starAgent.state.build.pieceCount===11);await tap(page,1);
 const after=await saved(page);expect(after.remote['sandbox-supply-0'].items.concrete).toBe(before.remote['sandbox-supply-0'].items.concrete-8);
 await tap(page,9);await choose(page,'build-sandbox');await expect(page.locator('#build-dialog')).toContainText('3,064 kg');await page.screenshot({path:`${out}/supplies-desktop.png`});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:`${out}/supplies-phone.png`});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.setViewportSize({width:1440,height:900});
 await choose(page,'sandbox-refill');await expect(page.locator('.build-feedback')).toContainText('4,608 kg');await expect(page.locator('#build-dialog')).toContainText('3,072 kg');await tap(page,1);await ready(page);
 await tap(page,8);await expect(page.locator('#cargo-dialog')).toBeVisible();await tap(page,1);await ready(page);
 const final=await saved(page);await page.reload();await ready(page);expect((await saved(page)).build).toEqual(final.build);expect((await saved(page)).remote).toEqual(final.remote);
 await tap(page,9);await choose(page,'sandbox-exit',true);await page.waitForURL(url=>!url.searchParams.has('sandbox'));await ready(page);expect(await page.evaluate(key=>localStorage.getItem(key),MINING_KEY)).toBe(original);expect(await page.evaluate(()=>window.starAgent.state.sandbox)).toBe(false);expect(errors).toEqual([]);
 await writeFile(`${out}/journey.json`,JSON.stringify({browser:browser.version(),viewport:'1440x900 / 390x844',input:'Injected Gamepad only; no physical Xbox',fixture:'No pose or inventory injection; real sandbox setup',before:before.remote['sandbox-supply-0'].items.concrete,after:after.remote['sandbox-supply-0'].items.concrete,errors},null,2));
});
