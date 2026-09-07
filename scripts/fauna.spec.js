import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const out='test-results/fauna-evidence';
import {frames,pad,tap,state,walkLocal,aim,approach} from './fauna-controller-helpers.js';
test.afterEach(async({page},info)=>{if(info.status!==info.expectedStatus){await mkdir(out,{recursive:true});await writeFile(`${out}/failure.json`,JSON.stringify(await page.evaluate(()=>({state:window.starAgent?.state,fatal:document.querySelector('.fatal')?.textContent})).catch(e=>({error:e.message})),null,2));}});
for(const [species,start,hp,rounds]of[['pyrebear','pyrebear-habitat',240,8],['suloher','suloher-habitat',90,3]])test(`${species}: controller lands, exits physically, shoots and holds death`,async({page,browser})=>{
 await mkdir(out,{recursive:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('fonts.googleapis'))errors.push(m.text());});
 await page.addInitScript(()=>{window.faunaPad={id:'Fauna standard controller',index:0,connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};Object.defineProperty(navigator,'getGamepads',{value:()=>[window.faunaPad]});});
 await page.route('**/api/auth/session',r=>r.fulfill({json:{account:null}}));await page.goto(`/?dev=1&ship=nomad&start=${start}&intro=0&debug&epoch=1788000000000`);
 await page.waitForFunction(()=>window.starAgent?.state.ready&&!window.starAgent.state.transiting&&window.starAgent.state.controller.armed,null,{timeout:120000});
 await page.waitForFunction(species=>window.starAgent.state.fauna.assets[species]?.status==='ready',species,{timeout:90000});
 console.log('Fauna assets ready; landing');await tap(page,3);await page.waitForFunction(()=>window.starAgent.state.mode==='landed',null,{timeout:90000});
 console.log('Landed; leaving pilot seat');await tap(page,2);await page.waitForFunction(()=>window.starAgent.state.mode==='walk');
 await walkLocal(page,0,2.7);await tap(page,2);await page.waitForFunction(()=>window.starAgent.state.doorProgress===1);
 await walkLocal(page,0,13,.4);expect((await state(page)).insideShip).toBe(false);
 let s=await state(page);const candidate=s.fauna.entities.filter(e=>e.species===species&&e.health>0).sort((a,b)=>Math.hypot(...a.position.map((x,i)=>x-s.position[i]))-Math.hypot(...b.position.map((x,i)=>x-s.position[i])))[0];expect(candidate).toBeTruthy();expect(candidate.health).toBe(hp);
 console.log('Outside; approaching',candidate.id);await approach(page,candidate.id,species==='suloher'?18:40);
 if(species==='suloher'){console.log('At dog approach',JSON.stringify(await page.evaluate(()=>({position:window.starAgent.state.position,fauna:window.starAgent.state.fauna}))));await page.waitForFunction(()=>window.starAgent.state.loadout.health<100,null,{timeout:15000});await pad(page);const injured=await state(page);expect(injured.fauna.totalBites).toBeGreaterThan(0);const quantity=injured.loadout.slots.quick1.quantity;const healed=page.waitForFunction(({quantity,health})=>{const l=window.starAgent.state.loadout;return l.slots.quick1.quantity===quantity-1&&l.health>health&&!l.bleeding;},{quantity,health:injured.loadout.health});await tap(page,13);await healed;}
 await aim(page,candidate.id);
 // Existing D-pad weapon cycling, never mutate loadout or trigger through debug.
 for(let i=0;i<4&&(await state(page)).mining.tool.item!=='rifle-laser';i++)await tap(page,14);
 await page.screenshot({path:`${out}/${species}-alive.png`});
 const before=await state(page);await pad(page,undefined,{7:1});
 await page.waitForFunction(id=>window.starAgent.state.fauna.entities.find(e=>e.id===id)?.health===0,candidate.id,{timeout:15000});await pad(page,undefined,{7:0});
 await page.waitForFunction(id=>window.starAgent.state.fauna.entities.find(e=>e.id===id)?.deathTime>2.2,candidate.id);await page.screenshot({path:`${out}/${species}-dead.png`});
 const after=await state(page);await approach(page,candidate.id,5);await aim(page,candidate.id);await page.screenshot({path:`${out}/${species}-corpse-close.png`});expect(after.fauna.kills).toBe(1);expect(after.fauna.shots-before.fauna.shots).toBe(rounds);
 const defeated=after.fauna.defeated;await pad(page,undefined,{7:1});await frames(page,12);await pad(page,undefined,{7:0});expect((await state(page)).fauna.defeated).toBe(defeated);
 // Menu + held RT must neither spend ammunition nor hurt another creature.
 await tap(page,9);const hits=(await state(page)).fauna.shots;await pad(page,undefined,{7:1});await tap(page,1);await frames(page,12);expect((await state(page)).fauna.shots).toBe(hits);expect((await state(page)).controller.armed).toBe(false);await pad(page,undefined,{7:0});
 if(species==='suloher'){
  const current=await state(page),other=current.fauna.entities.filter(e=>e.health>0).sort((a,b)=>Math.hypot(...a.position.map((x,i)=>x-current.position[i]))-Math.hypot(...b.position.map((x,i)=>x-current.position[i])))[0];
  expect(other).toBeTruthy();console.log('Walking to second dog for medical recovery route');await approach(page,other.id,8);
  await page.waitForFunction(()=>window.starAgent.state.fauna.medical.open,null,{timeout:60000});
  const downed=await state(page),slots=JSON.stringify(downed.loadout.slots);expect(downed.loadout.health).toBe(0);expect(downed.enabled).toBe(false);
  await tap(page,1);await expect(page.locator('#pyrebear-medical-dialog')).toBeVisible();
  await page.screenshot({path:`${out}/suloher-medical.png`});await tap(page,0);
  await page.waitForFunction(()=>window.starAgent.state.loadout.health===100&&!window.starAgent.state.fauna.medical.open);
  const recovered=await state(page);expect(recovered.body).toBe('aeon');expect(recovered.mode).toBe('flight');expect(JSON.stringify(recovered.loadout.slots)).toBe(slots);
  console.log('Emergency evacuation returned to orbit with inventory retained');
 }
 const backend=await page.evaluate(()=>{const gl=document.querySelector('canvas').getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');return gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);});
 await writeFile(`${out}/${species}.json`,JSON.stringify({browser:browser.version(),backend,resolution:[1280,800],input:'Injected standard Gamepad; no physical device',before,after,errors},null,2));expect(errors).toEqual([]);
});
