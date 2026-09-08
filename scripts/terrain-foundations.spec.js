import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {MiningStore,MINING_KEY} from '../src/mining/store.js';
import {prepareSandbox,sandboxStorage,SANDBOX_PREFIX,sandboxClaim} from '../src/build/sandbox.js';
import {pruneBaseStorage} from '../src/build/power-system.js';
import {Vector3,Quaternion} from 'three';
const out='/tmp/star-agent-foundations-evidence';
const map=new Map(),storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)},store=new MiningStore(sandboxStorage(storage));
prepareSandbox(store);store.write({...pruneBaseStorage(store.state,[]),build:{version:1,nextId:1,claims:[]}});
const startSave=Object.fromEntries(map),frame=sandboxClaim();
const point=p=>new Vector3(...p).applyQuaternion(new Quaternion(...frame.quaternion)).add(new Vector3(...frame.origin)).toArray();
const ready=page=>page.waitForFunction(()=>window.starAgent?.state.ready&&window.starAgent.state.controller.armed,null,{timeout:90000});
const state=page=>page.evaluate(()=>window.starAgent.state.build);
const saved=page=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),SANDBOX_PREFIX+MINING_KEY);
const axes=(page,a)=>page.evaluate(a=>window.testPad.axes=a,a);
const down=(page,i,on)=>page.evaluate(({i,on})=>window.testPad.buttons[i]={pressed:on,value:Number(on)},{i,on});
async function tap(page,i){await down(page,i,true);await page.waitForFunction(i=>window.starAgent.navigation.gamepad.previous[i],i);await down(page,i,false);await page.waitForFunction(i=>!window.starAgent.navigation.gamepad.previous[i],i);}
async function choose(page,key){const el=page.locator(`[data-controller-key="${key}"]`);for(let i=0;i<100;i++){if(await el.evaluate(e=>e===document.activeElement))break;await page.waitForFunction(()=>window.starAgent.navigation.gamepad.uiArmed);await tap(page,13);}await expect(el).toBeFocused();await tap(page,0);}
async function aim(page,p){for(let i=0;i<140;i++){const e=await page.evaluate(p=>{const n=window.starAgent.navigation,d=n.position.clone().fromArray(p).sub(n.position).applyQuaternion(n.orientation.clone().invert());return [Math.atan2(d.x,-d.z),Math.atan2(d.y,Math.hypot(d.x,d.z))];},p);if(e.every(v=>Math.abs(v)<.028)){await axes(page,[0,0,0,0]);return;}await axes(page,[0,0,...[e[0],-e[1]].map(v=>Math.sign(v)*Math.min(.65,.17+Math.abs(v)))]);await page.waitForTimeout(90);}throw Error('Aim did not converge');}
const localPoint=(page,p)=>page.evaluate(p=>{const c=window.starAgent.state.build.claims[0],n=window.starAgent.navigation;return n.position.clone().fromArray(p).applyQuaternion(n.orientation.clone().fromArray(c.quaternion)).add(n.position.clone().fromArray(c.origin)).toArray();},p);
async function walk(page,x,z){for(let i=0;i<260;i++){const s=await page.evaluate(({x,z})=>{const n=window.starAgent.navigation,c=window.starAgent.state.build.claims[0],q=n.orientation.clone().fromArray(c.quaternion),p=n.position.clone().sub(n.position.clone().fromArray(c.origin)).applyQuaternion(q.clone().invert()),d=p.clone().set(x-p.x,0,z-p.z);return {distance:d.length(),local:p.toArray(),d:d.applyQuaternion(q).applyQuaternion(n.orientation.clone().invert()).toArray()};},{x,z});if(s.distance<.15){await axes(page,[0,0,0,0]);await page.waitForTimeout(250);return;}const length=Math.hypot(s.d[0],s.d[2]),speed=s.distance<.7?.23:.55;await axes(page,[s.d[0]/length*speed,s.d[2]/length*speed,0,0]);await page.waitForTimeout(90);}throw Error(`Walk could not reach ${x},${z}`);}
async function select(page,type,tab='pieces'){
 await tap(page,1);await page.waitForFunction(()=>window.starAgent.navigation.gamepad.uiArmed);
 for(let i=0;i<7&&(await page.locator(`[data-controller-key="build-tab-${tab}"]`).getAttribute('aria-pressed'))!=='true';i++){await tap(page,5);await page.waitForFunction(()=>window.starAgent.navigation.gamepad.uiArmed);}
 await choose(page,`build-piece-${type}`);await ready(page);
}
async function place(page){await page.waitForFunction(()=>window.starAgent.state.build.preview?.valid,null,{timeout:10000});const b=await state(page);await tap(page,0);await page.waitForFunction(n=>window.starAgent.state.build.pieceCount===n+1,b.pieceCount);return (await state(page)).claims[0].pieces.at(-1);}
async function snapshot(page,name){await mkdir(out,{recursive:true});await page.screenshot({path:`${out}/${name}.png`});}
test.afterEach(async({page},info)=>{if(info.status===info.expectedStatus)return;await mkdir(out,{recursive:true});await snapshot(page,'failure');await writeFile(`${out}/failure.json`,JSON.stringify(await page.evaluate(()=>({state:window.starAgent?.state,enabled:window.starAgent?.navigation.enabled,focused:window.starAgent?.navigation.focused,pad:window.testPad})),null,2));});
test('controller builds an unsecured site, walks through, installs a deck mainframe and builds tall foundations',async({page,context,browser})=>{
 page.setDefaultTimeout(15000);const errors=[],warnings=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());if(m.type()==='warning')warnings.push(m.text());});
 // Only the initial save is prepared: empty sandbox + its ordinary finite bank.
 // All movement, aim, construction, inventory and interruption use real input.
 await page.addInitScript(save=>{if(!sessionStorage.getItem('terrain-fixture')){for(const [k,v]of Object.entries(save))localStorage.setItem(k,v);sessionStorage.setItem('terrain-fixture','1');}window.testPad={id:'Terrain foundations controller',index:0,connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};navigator.getGamepads=()=>window.testPad.connected?[window.testPad]:[];},startSave);
 await page.goto('/?sandbox=build&intro=0&debug&seed=7291');await ready(page);expect((await state(page)).pieceCount).toBe(0);await aim(page,point([0,0,4]));await select(page,'foundation');await snapshot(page,'foundation-first-preview');
 const before=await saved(page),slab=await place(page),c=(await state(page)).claims[0];expect(c.pieces.some(p=>p.type==='mainframe')).toBe(false);expect((await saved(page)).remote['sandbox-supply-0'].items.concrete).toBe(before.remote['sandbox-supply-0'].items.concrete-12);await tap(page,2);
 await walk(page,0,4);await aim(page,await localPoint(page,[0,slab.position[1],-2]));await select(page,'doorway');const door=await place(page);await tap(page,2);await page.waitForFunction(()=>window.starAgent.state.build.visuals.doors[0]?.fraction===1);await snapshot(page,'unsecured-door-open');
 await walk(page,0,-3);await walk(page,0,3);await snapshot(page,'walked-through-unsecured');
 await aim(page,await localPoint(page,[.5,slab.position[1],0]));await select(page,'mainframe');const core=await place(page);expect(core.position[1]).toBeCloseTo(slab.position[1],3);expect((await state(page)).claims).toHaveLength(1);await tap(page,2);await page.waitForFunction(()=>window.starAgent.state.build.visuals.doors[0]?.fraction===0);
 await snapshot(page,'mainframe-on-deck');await walk(page,3,3);await walk(page,3,-3.3);await walk(page,2.2,-3.3);await aim(page,await localPoint(page,[0,slab.position[1]+1,-2]));
 await page.waitForFunction(()=>window.starAgent.state.interaction.includes('base door'));await tap(page,2);await page.waitForFunction(()=>window.starAgent.state.build.visuals.doors[0]?.fraction===1);await walk(page,0,-3);await walk(page,-1,-3);await snapshot(page,'secured-owner-door-control');
 await walk(page,-5,-3);await aim(page,await localPoint(page,[-8,0,0]));await select(page,'foundation');for(let i=0;i<16;i++)await tap(page,12);await snapshot(page,'tall-foundation-preview');const tall=await place(page);expect(tall.supportDepth).toBeGreaterThan(4);await tap(page,2);await snapshot(page,'tall-foundation-built');
 await walk(page,4,-4);await aim(page,await localPoint(page,[8,0,0]));await select(page,'foundation-strut','shapes');for(let i=0;i<16;i++)await tap(page,12);await snapshot(page,'cliff-braces-preview');const cliff=await place(page);expect(cliff.supportDepth).toBeGreaterThan(4);await tap(page,2);await snapshot(page,'cliff-braces-built');
 // Use an invalid duplicate target: held edges must not create extra pieces.
 const count=(await state(page)).pieceCount;
 await tap(page,8);await expect(page.locator('#cargo-dialog')).toBeVisible();await snapshot(page,'inventory-result');await down(page,0,true);await tap(page,1);await page.waitForTimeout(300);expect((await state(page)).pieceCount).toBe(count);await down(page,0,false);await ready(page);
 await aim(page,await localPoint(page,[8,0,8]));await select(page,'foundation');
 await tap(page,1);await down(page,0,true);await page.waitForTimeout(150);await down(page,0,false);await ready(page); // choose current piece via real modal activation
 const armedCount=(await state(page)).pieceCount;
 const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setFocusEmulationEnabled',{enabled:false});await down(page,0,true);const other=await context.newPage();await other.goto('about:blank');await other.bringToFront();await page.waitForTimeout(200);const blurCount=(await state(page)).pieceCount;await page.bringToFront();await page.waitForTimeout(300);expect((await state(page)).pieceCount).toBe(blurCount);await down(page,0,false);await ready(page);await other.close();
 await page.evaluate(()=>{window.testPad.connected=false;window.testPad.buttons[0]={pressed:true,value:1};});await page.waitForTimeout(200);const disconnected=(await state(page)).pieceCount;await page.evaluate(()=>window.testPad.connected=true);await page.waitForTimeout(300);expect((await state(page)).pieceCount).toBe(disconnected);await down(page,0,false);await ready(page);await tap(page,2);
 const final=await saved(page);await page.reload();await ready(page);expect((await saved(page)).build.claims[0].pieces).toEqual(final.build.claims[0].pieces);await tap(page,8);await expect(page.locator('#cargo-dialog')).toBeVisible();await tap(page,1);await ready(page);
 // Keyboard and native touch use the same palette after the controller journey.
 await page.evaluate(()=>window.testPad.connected=false);await page.keyboard.press('b');await expect(page.locator('#build-dialog')).toBeVisible();await snapshot(page,'palette-desktop');await page.keyboard.press('Escape');
 await page.setViewportSize({width:390,height:844});await page.locator('#build-shortcut').tap();await expect(page.locator('#build-dialog')).toBeVisible();await snapshot(page,'palette-phone');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 expect(errors).toEqual([]);await writeFile(`${out}/journey.json`,JSON.stringify({browser:browser.version(),input:'Injected standard Gamepad; no physical device',setup:'Initial empty sandbox save and finite ordinary supply bank; no runtime pose or gameplay method calls',pieces:final.build.claims[0].pieces,errors,warnings},null,2));
});

test('hillside braces render on real steep terrain and controller replacement cannot replay placement',async({page,browser})=>{
 test.setTimeout(180000);page.setDefaultTimeout(12000);const errors=[],warnings=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());if(m.type()==='warning')warnings.push(m.text());});
 const {readFile}=await import('node:fs/promises');const {claim,spread}=JSON.parse(await readFile(new URL('../tests/fixtures/terrain-foundations-slope.json',import.meta.url)));
 const data=JSON.parse(startSave[SANDBOX_PREFIX+MINING_KEY]);data.build={version:1,nextId:3,claims:[claim]};
 await page.addInitScript(({key,data})=>{localStorage.setItem(key,JSON.stringify(data));window.testPad={id:'Hillside controller',index:0,connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};navigator.getGamepads=()=>window.testPad.connected?[window.testPad]:[];},{key:SANDBOX_PREFIX+MINING_KEY,data});
 await page.goto('/?sandbox=build&intro=0&debug&seed=7291');await ready(page);await page.waitForFunction(()=>window.starAgent.state.build.assetsReady);
 await aim(page,await localPoint(page,[0,2,0]));await snapshot(page,'hillside-arrival');await walk(page,8,8);await aim(page,await localPoint(page,[0,1,0]));await snapshot(page,'hillside-side');await walk(page,8,-8);await aim(page,await localPoint(page,[0,2,0]));await snapshot(page,'hillside-braces');
 // New device and unsupported mapping must stay unarmed with a held place input.
 await select(page,'foundation');const initial=(await state(page)).pieceCount;
 await page.evaluate(()=>{window.testPad.id='Replacement standard controller';window.testPad.buttons[0]={pressed:true,value:1};});await page.waitForTimeout(300);expect((await state(page)).pieceCount).toBe(initial);expect(await page.evaluate(()=>window.starAgent.state.controller.armed)).toBe(false);await down(page,0,false);await ready(page);
 await page.evaluate(()=>{window.testPad.mapping='';window.testPad.buttons[0]={pressed:true,value:1};});await page.waitForTimeout(250);expect((await state(page)).pieceCount).toBe(initial);await page.evaluate(()=>window.testPad.mapping='standard');await page.waitForTimeout(250);expect((await state(page)).pieceCount).toBe(initial);expect(await page.evaluate(()=>window.starAgent.state.controller.armed)).toBe(false);await down(page,0,false);await ready(page);await tap(page,2);await tap(page,8);await expect(page.locator('#cargo-dialog')).toBeVisible();await tap(page,1);await ready(page);
 const renderer=await page.evaluate(()=>{const gl=document.querySelector('canvas').getContext('webgl2'),ext=gl?.getExtension('WEBGL_debug_renderer_info');return ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):null;});
 expect(errors).toEqual([]);await writeFile(`${out}/hillside.json`,JSON.stringify({browser:browser.version(),renderer,viewport:'1440x900',terrainRelief:spread,claim,input:'Saved canonical hillside fixture; real controller movement/aim and replacement/mapping gates, no runtime pose writes',errors,warnings},null,2));
});
