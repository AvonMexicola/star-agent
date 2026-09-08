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
 expect(await page.evaluate(()=>window.starAgent.state.build.controllerAvailable)).toBe(true);await tap(page,1);await page.waitForFunction(()=>window.starAgent.navigation.gamepad.uiArmed);
 await page.evaluate(()=>window.testPad.axes=[.8,-.8,0,0]);await expect(page.locator('.build-wheel')).toHaveAttribute('data-selected','wall');
 await page.screenshot({path:`${out}/radial-desktop.png`});await page.setViewportSize({width:390,height:844});await page.screenshot({path:`${out}/radial-phone.png`});await page.setViewportSize({width:1440,height:900});
 await tap(page,0);await page.evaluate(()=>window.testPad.axes.fill(0));await ready(page);await page.waitForFunction(()=>window.starAgent.state.build.preview?.valid);
 const initialRotation=await page.evaluate(()=>window.starAgent.state.build.preview.rotation);await tap(page,6);expect(Math.abs((await page.evaluate(()=>window.starAgent.state.build.preview.rotation))-initialRotation)).toBeCloseTo(Math.PI);await tap(page,7);expect(await page.evaluate(()=>window.starAgent.state.build.preview.rotation)).toBe(initialRotation);await page.waitForFunction(()=>window.starAgent.state.build.preview?.valid);
 expect(await page.evaluate(()=>window.starAgent.state.build.pieceCount)).toBe(10);expect(await page.evaluate(()=>window.starAgent.navigation.toolTrigger)).toBe(0);
 const before=await saved(page);await page.screenshot({path:`${out}/wall-preview.png`});await tap(page,0);await page.waitForFunction(()=>window.starAgent.state.build.pieceCount===11);expect(await page.evaluate(()=>window.starAgent.navigation.jumpHeight)).toBe(0);await tap(page,2);
 const after=await saved(page);expect(after.remote['sandbox-supply-0'].items.concrete).toBe(before.remote['sandbox-supply-0'].items.concrete-8);
 await tap(page,9);await choose(page,'build-sandbox');await expect(page.locator('#build-dialog')).toContainText('3,064 kg');await page.screenshot({path:`${out}/supplies-desktop.png`});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:`${out}/supplies-phone.png`});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.setViewportSize({width:1440,height:900});
 await choose(page,'sandbox-refill');await expect(page.locator('.build-feedback')).toContainText('4,608 kg');await expect(page.locator('#build-dialog')).toContainText('3,072 kg');await tap(page,1);await ready(page);
 await tap(page,8);await expect(page.locator('#cargo-dialog')).toBeVisible();await tap(page,1);await ready(page);
 const final=await saved(page);await page.reload();await ready(page);expect((await saved(page)).build).toEqual(final.build);expect((await saved(page)).remote).toEqual(final.remote);
 await tap(page,9);await choose(page,'sandbox-exit',true);await page.waitForURL(url=>!url.searchParams.has('sandbox'));await ready(page);expect(await page.evaluate(key=>localStorage.getItem(key),MINING_KEY)).toBe(original);expect(await page.evaluate(()=>window.starAgent.state.sandbox)).toBe(false);expect(errors).toEqual([]);
 await writeFile(`${out}/journey.json`,JSON.stringify({browser:browser.version(),viewport:'1440x900 / 390x844',input:'Injected Gamepad only; no physical Xbox',fixture:'No pose or inventory injection; real sandbox setup',before:before.remote['sandbox-supply-0'].items.concrete,after:after.remote['sandbox-supply-0'].items.concrete,errors},null,2));
});

async function aimAt(page,point){for(let i=0;i<140;i++){const error=await page.evaluate(point=>{const n=window.starAgent.navigation,local=n.position.clone().fromArray(point).sub(n.position).applyQuaternion(n.orientation.clone().invert());return [Math.atan2(local.x,-local.z),Math.atan2(local.y,Math.hypot(local.x,local.z))];},point);if(error.every(v=>Math.abs(v)<.03)){await page.evaluate(()=>window.testPad.axes.fill(0));return;}await page.evaluate(e=>window.testPad.axes=[0,0,...[e[0],-e[1]].map(v=>Math.sign(v)*Math.min(.7,.2+Math.abs(v)))],error);await page.waitForTimeout(90);}throw Error('Controller aim did not converge');}
const worldPoint=(page,p)=>page.evaluate(p=>{const c=window.starAgent.state.build.claims[0],n=window.starAgent.navigation;return n.position.clone().fromArray(p).applyQuaternion(n.orientation.clone().fromArray(c.quaternion)).add(n.position.clone().fromArray(c.origin)).toArray();},p);
async function selectBuild(page,id,tab){await tap(page,1);await page.waitForFunction(()=>window.starAgent.navigation.gamepad.uiArmed);for(let i=0;i<6&&!(await page.locator(`[data-controller-key="build-tab-${tab}"]`).getAttribute('aria-pressed')==='true');i++){await tap(page,5);await page.waitForFunction(()=>window.starAgent.navigation.gamepad.uiArmed);}await choose(page,`build-piece-${id}`);await ready(page);}
async function buildPiece(page,id,tab,point){await aimAt(page,await worldPoint(page,point));await selectBuild(page,id,tab);await page.waitForFunction(()=>window.starAgent.state.build.preview?.valid,null,{timeout:10000});const before=await page.evaluate(()=>window.starAgent.state.build.pieceCount);await tap(page,0);await page.waitForFunction(n=>window.starAgent.state.build.pieceCount===n+1,before);await tap(page,2);}

test('controller builds new shapes, open roofs and workshop storage through the production sandbox',async({page})=>{
 test.setTimeout(360000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.testPad={id:'Expansion controller',index:0,connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};navigator.getGamepads=()=>[window.testPad];});
 await page.goto('/?sandbox=build&intro=0&debug&seed=7291');await ready(page);await page.waitForFunction(()=>window.starAgent.state.build.assetsReady);
 await buildPiece(page,'rack','facilities',[0,.3,2]);await buildPiece(page,'terminal','facilities',[3,.3,2]);
 await buildPiece(page,'wall','pieces',[4,.3,6]);await buildPiece(page,'floor','pieces',[4,3.3,4]);
 await buildPiece(page,'foundation-triangle','shapes',[8,.3,4]);
 await buildPiece(page,'foundation-quarter','shapes',[-8,.3,4]);
 const quarter=await page.evaluate(()=>window.starAgent.state.build.claims[0].pieces.find(p=>p.type==='foundation-quarter').position);
 await buildPiece(page,'window-quarter','shapes',quarter);await buildPiece(page,'floor-quarter','shapes',[quarter[0],quarter[1]+3,quarter[2]]);
 await page.screenshot({path:`${out}/expansion-built.png`});
 const terminal=await page.evaluate(()=>window.starAgent.state.build.claims[0].pieces.find(p=>p.type==='terminal').position);await walkTo(page,await worldPoint(page,[terminal[0]-.8,terminal[1]+1.75,terminal[2]+2]));
 await aimAt(page,await worldPoint(page,[terminal[0],terminal[1]+.8,terminal[2]]));await tap(page,2);await expect(page.locator('#build-dialog')).toContainText('Storage and trade terminal');await page.waitForFunction(()=>window.starAgent.navigation.gamepad.uiArmed);await choose(page,'terminal-build-crate-12');await expect(page.locator('#cargo-dialog')).toBeVisible();await expect(page.locator('[data-container="build-crate-12"] .inventory-box')).toHaveCount(8);await page.screenshot({path:`${out}/terminal-rack.png`});await tap(page,1);await ready(page);

 const before=await saved(page);expect(Object.values(before.boxes).filter(n=>n===8).length).toBe(13);expect(before.build.claims[0].pieces.length).toBe(18);
 await tap(page,8);await expect(page.locator('#cargo-dialog')).toBeVisible();await tap(page,1);await ready(page);await page.reload();await ready(page);expect((await saved(page)).build).toEqual(before.build);expect(errors).toEqual([]);
 await writeFile(`${out}/expansion-journey.json`,JSON.stringify({input:'Injected Gamepad, no pose/inventory fixture',pieces:before.build.claims[0].pieces.map(p=>p.type),errors},null,2));
});

async function walkTo(page,point){await aimAt(page,point);await page.evaluate(()=>window.testPad.axes=[0,-.5,0,0]);await page.waitForFunction(point=>{const n=window.starAgent.navigation,c=window.starAgent.state.build.claims[0],delta=n.position.clone().fromArray(point).sub(n.position).applyQuaternion(n.orientation.clone().fromArray(c.quaternion).invert());return Math.hypot(delta.x,delta.z)<.45;},point,{timeout:45000});await page.evaluate(()=>window.testPad.axes.fill(0));}
test('controller places and designates a Nomad pad, builds its ramp and opens a traversable hangar door',async({page})=>{
 test.setTimeout(360000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.testPad={id:'Hangar construction controller',index:0,connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};navigator.getGamepads=()=>[window.testPad];});
 await page.goto('/?sandbox=build&intro=0&debug&seed=7291');await ready(page);await page.waitForFunction(()=>window.starAgent.state.build.assetsReady);
 await walkTo(page,await worldPoint(page,[-6,1.75,6]));await buildPiece(page,'foundation-pad-small','facilities',[-9,0,4]);
 await walkTo(page,await worldPoint(page,[-9,2.05,8]));await tap(page,2);await expect(page.locator('#build-dialog')).toContainText('Landing pad S');await page.waitForFunction(()=>window.starAgent.navigation.gamepad.uiArmed);await choose(page,'pad-designate');await expect(page.locator('.build-feedback')).toContainText('Landing pad marked');await tap(page,1);await ready(page);
 await walkTo(page,await worldPoint(page,[-10,2.05,4]));await buildPiece(page,'hangar-door','facilities',[-16,.3,-4]);
 await walkTo(page,await worldPoint(page,[-16,2.05,-1.5]));await aimAt(page,await worldPoint(page,[-16,1.3,-4]));await tap(page,2);await page.waitForFunction(()=>window.starAgent.state.build.visuals.doors.some(d=>d.fraction===1));await walkTo(page,await worldPoint(page,[-16,1.75,-6]));await page.screenshot({path:`${out}/hangar-traversed.png`});
 await walkTo(page,await worldPoint(page,[-26,1.75,-6]));await walkTo(page,await worldPoint(page,[-26,1.75,16]));await buildPiece(page,'foundation-ramp','facilities',[-22,.3,14]);await page.screenshot({path:`${out}/pad-ramp.png`});
 const before=await saved(page);expect(before.build.claims[0].pieces.find(p=>p.type==='foundation-pad-small').landingPad).toBe(true);expect(before.build.claims[0].pieces.find(p=>p.type==='hangar-door').doorOpen).toBe(true);await page.reload();await ready(page);expect((await saved(page)).build).toEqual(before.build);expect(errors).toEqual([]);
 await writeFile(`${out}/pad-journey.json`,JSON.stringify({input:'Injected Gamepad only, no pose/inventory fixture',pieces:before.build.claims[0].pieces.map(p=>p.type),errors},null,2));
});
