import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {MINING_KEY} from '../src/mining/store.js';
import {SANDBOX_PREFIX} from '../src/build/sandbox.js';
const out=process.env.FACTION_EVIDENCE;
const errorsByPage=new WeakMap();
const frames=page=>page.evaluate(async()=>{for(let i=0;i<4;i++)await new Promise(r=>requestAnimationFrame(r));});
const ready=page=>page.waitForFunction(()=>window.starAgent?.state.ready&&window.starAgent.state.enabled&&window.starAgent.state.controller.armed,undefined,{timeout:90000});
const neutral=page=>page.waitForFunction(()=>window.starAgent.navigation.gamepad.uiArmed);
const saved=page=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),SANDBOX_PREFIX+MINING_KEY);
// Charge and its clock legitimately advance during a real reload. Retain every
// structural/cosmetic field and stable power health/fuel/version in this comparison.
const persistedStructure=build=>({...build,claims:build.claims.map(claim=>({...claim,power:claim.power?{version:claim.power.version,health:claim.power.health,fuel:claim.power.fuel}:undefined}))});
async function button(page,i,pressed){await page.evaluate(({i,pressed})=>window.factionPad.buttons[i]={pressed,value:+pressed},{i,pressed});await frames(page);}
async function tap(page,i){await button(page,i,true);await button(page,i,false);}
async function choose(page,key,hold=false){
 for(let i=0;i<85;i++){
  if(await page.evaluate(key=>document.activeElement?.dataset.controllerKey===key,key)){await button(page,0,true);if(!hold)await button(page,0,false);return;}
  await neutral(page);await tap(page,13);
 }
 throw Error(`Controller could not reach ${key}`);
}
async function tab(page,id){for(let i=0;i<12;i++){if(await page.locator(`[data-controller-key="build-tab-${id}"]`).getAttribute('aria-pressed')==='true')return;await neutral(page);await tap(page,5);}throw Error(`Missing build tab ${id}`);}
async function gameplayTab(page,id){for(let i=0;i<12;i++){if(await page.locator(`dialog[open] [data-controller-key="tab-${id}"]`).getAttribute('aria-selected')==='true')return;await neutral(page);await tap(page,5);}throw Error(`Missing gameplay tab ${id}`);}
async function diagnostics(page){return page.evaluate(()=>{const gl=document.querySelector('canvas').getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info'),s=window.starAgent.state;return {browserGraphics:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),viewport:[innerWidth,innerHeight],resolution:s.renderResolution,draws:s.drawCalls,triangles:s.triangles,physicalDevice:false};});}
async function capture(page,name){await page.screenshot({path:`${out}/${name}.png`});await writeFile(`${out}/${name}.json`,JSON.stringify({state:await page.evaluate(()=>window.starAgent.state),diagnostics:await diagnostics(page)},null,2));console.log(`Captured ${name}`);}
async function artCapture(page,name){const style=await page.addStyleTag({content:'body > :not(canvas){visibility:hidden!important}'});try{await capture(page,name);}finally{await style.evaluate(el=>el.remove());}}
async function warmSample(page){return page.evaluate(async()=>{const times=[],start=performance.now();let previous=start;while(performance.now()-start<5000){await new Promise(r=>requestAnimationFrame(r));const now=performance.now();times.push(now-previous);previous=now;}times.sort((a,b)=>a-b);return {durationMs:performance.now()-start,samples:times.length,medianMs:times[Math.floor(times.length*.5)],p95Ms:times[Math.floor(times.length*.95)],acceptance:false};});}
async function setup(page,pad=true){
 await mkdir(out,{recursive:true});const record={errors:[],warnings:[]};errorsByPage.set(page,record);page.on('pageerror',e=>record.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')record.errors.push(m.text());if(m.type()==='warning')record.warnings.push(m.text());});
 await page.route('**/api/auth/session',r=>r.fulfill({json:{account:null}}));
 if(pad)await page.addInitScript(()=>{window.factionPad={id:'Faction finish standard Gamepad',mapping:'standard',index:0,connected:true,axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};navigator.getGamepads=()=>window.factionDisconnected?[]:[window.factionPad];});
 return record;
}
async function aim(page,point){
 for(let i=0;i<180;i++){
  const error=await page.evaluate(point=>{const n=window.starAgent.navigation,d=n.position.clone().fromArray(point).sub(n.position).applyQuaternion(n.orientation.clone().invert());return [Math.atan2(d.x,-d.z),Math.atan2(d.y,Math.hypot(d.x,d.z))];},point);
  if(error.every(x=>Math.abs(x)<.02)){await page.evaluate(()=>window.factionPad.axes.fill(0));await frames(page);return;}
  await page.evaluate(e=>{const axis=x=>Math.abs(x)<.012?0:Math.sign(x)*Math.min(.8,.2+Math.abs(x)*1.7);window.factionPad.axes=[0,0,axis(e[0]),axis(-e[1])];},error);await frames(page);
 }throw Error('Gamepad aim did not converge');
}
async function pointForWall(page){return page.evaluate(()=>{const n=window.starAgent.navigation,c=window.starAgent.state.build.claims[0],p=c.pieces.find(p=>p.type==='wall');return n.position.clone().fromArray(p.position).add(n.position.clone().set(0,1.55,0)).applyQuaternion(n.orientation.clone().fromArray(c.quaternion)).add(n.position.clone().fromArray(c.origin)).toArray();});}
async function heldFocusAndDevices(page){
 const blank=await page.context().newPage(),game=await page.context().newCDPSession(page),other=await page.context().newCDPSession(blank);
 try{
  await blank.goto('about:blank');await game.send('Emulation.setFocusEmulationEnabled',{enabled:false});await other.send('Emulation.setFocusEmulationEnabled',{enabled:false});
  await blank.bringToFront();await page.waitForFunction(()=>!window.starAgent.state.focused);await button(page,0,true);
  await page.bringToFront();await page.waitForFunction(()=>window.starAgent.state.focused);await frames(page);expect(await page.evaluate(()=>window.starAgent.state.controller.armed)).toBe(false);await button(page,0,false);await ready(page);
 }finally{await game.send('Emulation.setFocusEmulationEnabled',{enabled:true});await other.send('Emulation.setFocusEmulationEnabled',{enabled:true});await game.detach();await other.detach();await blank.close();await page.bringToFront();}
 await page.evaluate(()=>window.factionDisconnected=true);await frames(page);await button(page,0,true);await page.evaluate(()=>window.factionDisconnected=false);await frames(page);expect(await page.evaluate(()=>window.starAgent.state.controller.armed)).toBe(false);await button(page,0,false);await ready(page);
 await page.evaluate(()=>window.factionPad.mapping='');await frames(page);await button(page,0,true);await page.evaluate(()=>{window.factionPad.mapping='standard';window.factionPad.id='Replacement standard Gamepad';});await frames(page);expect(await page.evaluate(()=>window.starAgent.state.controller.armed)).toBe(false);await button(page,0,false);await ready(page);
}
test.afterEach(async({page},info)=>{if(info.status!==info.expectedStatus)try{await capture(page,`failure-${info.title.replace(/\W+/g,'-').slice(0,60)}`);await writeFile(`${out}/failure-diagnostics.json`,JSON.stringify(errorsByPage.get(page),null,2));}catch{}});

test('controller enters sandbox, chooses paint and print, builds, repaints, persists and returns',async({page,browser})=>{
 const record=await setup(page);await page.goto('/?intro=0&debug&seed=7291&epoch=1788876000000');await ready(page);
 const regular=await page.evaluate(key=>localStorage.getItem(key),MINING_KEY);await tap(page,9);await gameplayTab(page,'ship');await choose(page,'build-sandbox',true);await page.waitForURL(/sandbox=build/);await ready(page);
 await page.waitForFunction(()=>window.starAgent.state.build.assetsReady);const before=await saved(page);expect(before.build.claims[0].pieces).toHaveLength(10);
 await tap(page,1);await tab(page,'finishes');await choose(page,'build-finish-crimson');await choose(page,'build-graphic-crimson');await capture(page,'finishes-desktop');
 await tab(page,'pieces');await page.evaluate(()=>window.factionPad.axes=[.8,-.8,0,0]);await expect(page.locator('.build-wheel')).toHaveAttribute('data-selected','wall');await tap(page,0);await page.evaluate(()=>window.factionPad.axes.fill(0));await ready(page);await page.waitForFunction(()=>window.starAgent.state.build.preview?.valid);await capture(page,'crimson-placement');await tap(page,0);
 await page.waitForFunction(()=>window.starAgent.state.build.pieceCount===11);await tap(page,2);await ready(page);await aim(page,await pointForWall(page));
 // This wall faces away from the sun. Use the actual suit light for readable
 // paired art views, through the existing controller chord.
 await button(page,4,true);await button(page,5,true);await tap(page,14);await button(page,5,false);await button(page,4,false);await ready(page);await page.waitForFunction(()=>window.starAgent.state.utilities.suit);await artCapture(page,'wall-before-repaint');
 let current=await saved(page);expect(current.build.claims[0].pieces.find(p=>p.type==='wall')).toMatchObject({finish:'crimson',graphic:'crimson'});expect(current.remote['sandbox-supply-0'].items.concrete).toBe(before.remote['sandbox-supply-0'].items.concrete-8);
 const inventory=structuredClone(current.remote);
 await tap(page,1);await tab(page,'finishes');await choose(page,'build-finish-petrol');await choose(page,'build-graphic-tidemark');await choose(page,'build-paint-tool');await ready(page);await page.waitForFunction(()=>window.starAgent.state.build.preview?.valid);await tap(page,0);await frames(page);await artCapture(page,'wall-after-repaint');
 current=await saved(page);expect(current.build.claims[0].pieces.find(p=>p.type==='wall')).toMatchObject({finish:'petrol',graphic:'tidemark'});expect(current.remote).toEqual(inventory);
 // A held through the real palette close cannot confirm another paint operation.
 await tap(page,1);await tab(page,'finishes');await choose(page,'build-finish-ivory');await choose(page,'build-graphic-helmet');await choose(page,'build-paint-tool',true);await expect(page.locator('#build-dialog')).not.toBeVisible();expect(await page.evaluate(()=>window.starAgent.state.controller.armed)).toBe(false);
 expect((await saved(page)).build.claims[0].pieces.find(p=>p.type==='wall').finish).toBe('petrol');await button(page,0,false);await ready(page);await heldFocusAndDevices(page);
 expect((await saved(page)).build.claims[0].pieces.find(p=>p.type==='wall').finish).toBe('petrol');await tap(page,0);await tap(page,2);await ready(page);await artCapture(page,'helmet-painted');
 await tap(page,8);await expect(page.locator('#cargo-dialog')).toBeVisible();await capture(page,'result-inventory');await button(page,7,true);await tap(page,1);expect(await page.evaluate(()=>window.starAgent.state.controller.armed)).toBe(false);await button(page,7,false);await ready(page);
 const final=await saved(page);expect(final.build.claims[0].pieces.find(p=>p.type==='wall')).toMatchObject({finish:'ivory',graphic:'helmet'});expect(final.remote).toEqual(inventory);await page.reload();await ready(page);expect(persistedStructure((await saved(page)).build)).toEqual(persistedStructure(final.build));
 await tap(page,9);await gameplayTab(page,'ship');await choose(page,'sandbox-exit',true);await page.waitForURL(url=>!url.searchParams.has('sandbox'));await ready(page);expect(await page.evaluate(key=>localStorage.getItem(key),MINING_KEY)).toBe(regular);
 expect(record.errors).toEqual([]);await writeFile(`${out}/controller.json`,JSON.stringify({browser:browser.version(),...await diagnostics(page),...record,fixture:'Only standard Gamepad writes after normal game start; actual sandbox entry, aim/placement/repainting, save and inventory. No pose, save or action injection.',beforeCount:10,afterCount:11,concreteSpent:8,paintCost:0},null,2));
});

test('native phone chooses faction finish, places one wall and returns with keyboard entry regression',async({browser})=>{
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1}),page=await context.newPage();
 try{
  const record=await setup(page,false);await page.goto('/?sandbox=build&intro=0&debug&seed=7291&epoch=1788876000000');await page.waitForFunction(()=>window.starAgent?.state.ready&&window.starAgent.state.build.assetsReady&&window.starAgent.state.enabled,undefined,{timeout:90000});
  await page.locator('#build-shortcut').tap();await page.locator('[data-controller-key="build-tab-finishes"]').tap();await page.locator('[data-controller-key="build-finish-jade"]').tap();await page.locator('[data-controller-key="build-graphic-verdant"]').tap();await capture(page,'finishes-phone');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.locator('[data-controller-key="build-tab-pieces"]').tap();await page.locator('[data-controller-key="build-piece-wall"]').tap();await page.waitForFunction(()=>window.starAgent.state.build.preview?.valid);await page.locator('[data-controller-key="build-hud-place"]').tap();await page.waitForFunction(()=>window.starAgent.state.build.pieceCount===11);await page.locator('[data-controller-key="build-hud-exit"]').tap();await capture(page,'phone-built');
  expect((await saved(page)).build.claims[0].pieces.find(p=>p.type==='wall')).toMatchObject({finish:'jade',graphic:'verdant'});
  await page.keyboard.press('b');await expect(page.locator('#build-dialog')).toBeVisible();await page.keyboard.press('Escape');await expect(page.locator('#build-dialog')).not.toBeVisible();await page.waitForFunction(()=>window.starAgent.state.enabled);expect(record.errors).toEqual([]);
  await writeFile(`${out}/phone.json`,JSON.stringify({browser:browser.version(),...await diagnostics(page),...record,fixture:'Native mobile/touch from supported sandbox; keyboard B/Escape regression. No pose/save mutation.'},null,2));
 }finally{await context.close();}
});

for(const body of ['aeon','selene','pyre','miasma'])test(`corporate buildings and pad identity on ${body}`,async({page,browser})=>{
 const record=await setup(page,false);await page.goto(`/?dev=1&ship=nomad&start=settlement-${body}&intro=0&debug&seed=7291&epoch=1788876000000`);await page.waitForFunction(()=>window.starAgent?.state.ready&&window.starAgent.state.settlements.ready&&window.starAgent.state.settlements.rendered>0,undefined,{timeout:90000});
 await page.addStyleTag({content:'body > :not(canvas){visibility:hidden!important}'});
 for(const [name,eye,look] of [['approach',[70,42,92],[0,2,12]],['entrance',[8,2,-5],[2,1.5,-16]]]){
  // Art-only camera placement. Full controller construction is a separate test above.
  await page.evaluate(({body,eye,look})=>{const n=window.starAgent.navigation,s=window.starAgent.state.settlements.sites.find(s=>s.body===body),q=n.orientation.clone().fromArray(s.quaternion),o=n.position.clone().fromArray(s.origin),deck=n.position.clone().fromArray(s.pad).sub(o).applyQuaternion(q.clone().invert()).y,world=a=>n.position.clone().fromArray(a).add(n.position.clone().set(0,deck,0)).applyQuaternion(q).add(o);n.mode='walk';n.insideShip=false;n.enabled=false;n.position.copy(world(eye));n.orientToward(world(look),n.normal);n.velocity.set(0,0,0);},{body,eye,look});
  await page.waitForFunction(()=>{const s=window.starAgent.state;return s.body==='aeon'?s.terrainLod.settled:s.body==='selene'?s.moon.pending===0&&s.moon.effects.settled:s[s.body].pending===0&&s[s.body].morphing===0;},undefined,{timeout:60000});await frames(page);await capture(page,`${body}-${name}`);
 }
 expect(record.errors).toEqual([]);await writeFile(`${out}/${body}-art.json`,JSON.stringify({browser:browser.version(),...await diagnostics(page),...record,warm:await warmSample(page),fixture:'Fixed art camera only; corporate exterior/pad sign review, no traversal claim'},null,2));
});
