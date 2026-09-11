import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {MiningStore} from '../src/mining/store.js';
import {LocalTrading} from '../src/trading/local.js';
import {settlementMarketId} from '../src/settlements/catalog.js';
const out='/tmp/star-agent-settlement-needs-evidence';
const frames=p=>p.evaluate(async()=>{for(let i=0;i<4;i++)await new Promise(r=>requestAnimationFrame(r));});
async function setup(page,site='selene'){
 await mkdir(out,{recursive:true});const errors=[],warnings=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());if(m.type()==='warning')warnings.push(m.text());});
 const entries=new Map(),storage={getItem:k=>entries.get(k)??null,setItem:(k,v)=>entries.set(k,v)},store=new MiningStore(storage),local=new LocalTrading(store);
 for(let i=0;i<2;i++)local.command({op:'buy',terminal:'settlement-pyre',ship:'local-player:nomad',resource:'conductor',sbu:1,revision:local.state.revision,commandId:`fixture-${i}`},{terminal:()=>true,docked:()=>true,stationMarket:settlementMarketId});
 const saved=structuredClone(store.state);saved.commerce.markets['settlement-selene'].stock.conductor=255;store.write(saved);
 await page.addInitScript(seed=>{window.__starAgentCargoTestSeed=seed;window.settlementPad={id:'Settlement standard Gamepad',mapping:'standard',index:0,connected:true,axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};Object.defineProperty(navigator,'getGamepads',{value:()=>window.settlementDisconnected?[]:[window.settlementPad]});},[...entries]);
 await page.route('**/api/auth/session',r=>r.fulfill({json:{account:null}}));
 await page.goto(`/?dev=1&ship=nomad&start=settlement-${site}&intro=0&debug&seed=7291&cargo-test=1`);
 await page.waitForFunction(()=>window.starAgent?.state.ready&&window.starAgent.state.enabled&&!window.starAgent.state.transiting&&window.starAgent.state.controller.armed,undefined,{timeout:90000});
 await page.waitForFunction(()=>window.starAgent.state.settlements.ready&&window.starAgent.state.settlements.rendered>0);
 const button=async(i,pressed)=>{await page.evaluate(({i,pressed})=>window.settlementPad.buttons[i]={pressed,value:+pressed},{i,pressed});await frames(page);};
 const tap=async i=>{await button(i,true);await button(i,false);};
 const choose=async key=>{for(let i=0;i<95;i++){if(await page.evaluate(k=>document.activeElement?.dataset.controllerKey===k,key)){await tap(0);return;}await tap(13);}throw Error(`Missing controller action ${key}`);};
 return {tap,button,choose,errors,warnings};
}
// Navigation state is read only. Steering writes only standard Gamepad axes.
async function walk(page,target,frame='site'){
 await page.evaluate(({target,frame})=>{window.settlementWalkDone=false;window.settlementWalkTimer=setInterval(()=>{const n=window.starAgent.navigation,s=window.starAgent.state.settlements.sites.find(s=>s.body===n.body.id),q=n.shipOrientation.clone().fromArray(s.quaternion),goal=frame==='ship'?n.fromShipLocal(n.position.clone().fromArray(target)):n.position.clone().fromArray(target).applyQuaternion(q).add(n.position.clone().fromArray(s.origin));const delta=goal.sub(n.position).projectOnPlane(n.normal);if(delta.length()<.22){window.settlementPad.axes=[0,0,0,0];window.settlementWalkDone=true;clearInterval(window.settlementWalkTimer);return;}delta.applyQuaternion(n.orientation.clone().invert());window.settlementPad.axes=[Math.max(-1,Math.min(1,delta.x)),Math.max(-1,Math.min(1,delta.z)),0,0];},30);},{target,frame});
 try{await page.waitForFunction(()=>window.settlementWalkDone,undefined,{timeout:35000});}finally{await page.evaluate(()=>{clearInterval(window.settlementWalkTimer);window.settlementPad.axes=[0,0,0,0];});}await frames(page);
}
async function aim(page,target,frame='ship'){
 await page.evaluate(({target,frame})=>{window.settlementAimDone=false;window.settlementAimTimer=setInterval(()=>{const n=window.starAgent.navigation,goal=frame==='ship'?n.fromShipLocal(n.position.clone().fromArray(target)):n.position.clone().fromArray(target),local=goal.sub(n.position).applyQuaternion(n.orientation.clone().invert()),yaw=Math.atan2(local.x,-local.z),pitch=Math.atan2(local.y,Math.hypot(local.x,local.z));if(Math.abs(yaw)<.025&&Math.abs(pitch)<.025){window.settlementPad.axes=[0,0,0,0];window.settlementAimDone=true;clearInterval(window.settlementAimTimer);return;}const a=x=>Math.abs(x)<.015?0:Math.sign(x)*Math.min(1,.19+Math.abs(x)*2);window.settlementPad.axes=[0,0,a(yaw),a(-pitch)];},30);},{target,frame});
 try{await page.waitForFunction(()=>window.settlementAimDone,undefined,{timeout:20000});}finally{await page.evaluate(()=>{clearInterval(window.settlementAimTimer);window.settlementPad.axes=[0,0,0,0];});}await frames(page);
}
async function capture(page,name){await page.screenshot({path:`${out}/${name}.png`});await writeFile(`${out}/${name}.json`,JSON.stringify(await page.evaluate(()=>window.starAgent.state),null,2));}
async function graphics(page){return page.evaluate(()=>{const canvas=document.querySelector('canvas'),gl=canvas?.getContext('webgl2')||canvas?.getContext('webgl'),debug=gl?.getExtension('WEBGL_debug_renderer_info');return {viewport:{width:innerWidth,height:innerHeight},renderer:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):gl?.getParameter(gl.RENDERER),vendor:debug?gl.getParameter(debug.UNMASKED_VENDOR_WEBGL):gl?.getParameter(gl.VENDOR)};});}
async function focusInterruption(page,button){
 const context=page.context(),blank=await context.newPage(),game=await context.newCDPSession(page),other=await context.newCDPSession(blank);
 try{
  await blank.goto('about:blank');await game.send('Emulation.setFocusEmulationEnabled',{enabled:false});await other.send('Emulation.setFocusEmulationEnabled',{enabled:false});
  await page.bringToFront();await page.waitForFunction(()=>document.hasFocus()&&window.starAgent.state.focused);await button(7,true);
  await blank.bringToFront();await page.waitForFunction(()=>!window.starAgent.state.focused);expect(await page.evaluate(()=>window.starAgent.state.controller.armed)).toBe(false);
  await page.bringToFront();await page.waitForFunction(()=>document.hasFocus()&&window.starAgent.state.focused);await frames(page);expect(await page.evaluate(()=>window.starAgent.state.controller.armed)).toBe(false);
  await button(7,false);await page.waitForFunction(()=>window.starAgent.state.controller.armed);
 }finally{await game.send('Emulation.setFocusEmulationEnabled',{enabled:true});await other.send('Emulation.setFocusEmulationEnabled',{enabled:true});await game.detach();await other.detach();await blank.close();await page.bringToFront();}
}

test.afterEach(async({page},info)=>{if(info.status!==info.expectedStatus){try{await capture(page,'failure-'+info.retry);}catch{}}});

test('controller delivers imported conductors, fills the local need, buys ice and leaves with cargo',async({page,browser})=>{
 const {tap,button,choose,errors,warnings}=await setup(page);
 await capture(page,'selene-approach');
 await tap(9);await choose('tab-map');await choose('map-body-aeon');await choose('map-body-selene');await choose('map-view-locations');await choose('map-signal-settlement-selene');
 await expect(page.locator('#map-target-name')).toHaveText('Stillwater Exchange');await expect(page.locator('#map-target-kind')).toContainText('Conductor stock 1 SBU');await capture(page,'map-desktop');await tap(1);await frames(page);
 await button(4,true);await button(5,true);await tap(13);await button(5,false);await button(4,false);
 await page.waitForFunction(()=>window.starAgent.state.landingGear.progress>.98);await tap(3);await page.waitForFunction(()=>window.starAgent.state.mode==='landed',undefined,{timeout:60000});
 await capture(page,'landed');await tap(2);await page.waitForFunction(()=>window.starAgent.state.mode==='walk');
 await walk(page,[0,2.75,3],'ship');await aim(page,[0,2.75,7]);await tap(2);await page.waitForFunction(()=>window.starAgent.state.doorProgress>.98);await walk(page,[0,1.75,8],'ship');
 // Leave via the actual ramp, skirt the hull, then approach the exchange door.
 await walk(page,[9,0,30]);await walk(page,[9,0,-12]);await walk(page,[-2,0,-12]);await walk(page,[-2,0,-19.8]);
 const terminal=await page.evaluate(()=>window.starAgent.state.settlements.sites.find(s=>s.body==='selene').terminal);await aim(page,terminal,'world');await capture(page,'exchange-entrance');
 await tap(2);await expect(page.locator('#trading-dialog')).toBeVisible();await expect(page.locator('.trade-place')).toHaveText('Stillwater Exchange');
 const before=await page.evaluate(()=>window.starAgent.state.trading);
 await choose('next-page');await expect(page.locator('[data-need-resource="conductor"]')).toContainText('Needs 1 SBU');await expect(page.locator('[data-need-resource="conductor"]')).toContainText('Power wiring');
 for(const viewport of [{width:1440,height:900},{width:390,height:844}]){await page.setViewportSize(viewport);await frames(page);await capture(page,`local-stock-${viewport.width}`);if(viewport.width===390){await page.locator('[data-controller-key="previous-page"]').tap();await page.locator('[data-controller-key="next-page"]').tap();await expect(page.locator('[data-need-resource="conductor"]')).toContainText('Needs 1 SBU');}expect(await page.locator('#trading-dialog').evaluate(d=>d.scrollWidth<=d.clientWidth+2)).toBe(true);}
 await page.setViewportSize({width:1440,height:900});for(const key of ['previous-page','next-page']){for(let i=0;i<60&&await page.evaluate(k=>document.activeElement?.dataset.controllerKey!==k,key);i++)await page.keyboard.press('Tab');expect(await page.evaluate(()=>document.activeElement?.dataset.controllerKey)).toBe(key);await page.keyboard.press('Enter');}await choose('view-cargo');const crates=before.ships.find(s=>s.hull==='nomad').crates;
 await choose(`sell-${crates[0].id}`);await expect(page.locator('.trade-feedback')).toContainText('Sold 1 SBU');
 const supplied=await page.evaluate(()=>window.starAgent.state.trading);expect(supplied.markets['settlement-selene'].stock.conductor).toBe(256);expect(supplied.account.credits).toBeGreaterThan(before.account.credits);expect(supplied.ships.find(s=>s.hull==='nomad').crates).toHaveLength(1);
 await expect(page.locator(`[data-controller-key="sell-${crates[1].id}"]`)).toBeDisabled();await expect(page.locator('.trade-content')).toContainText('needs 0 SBU');await capture(page,'delivery-filled');
 await choose('view-buy');await choose('next-page');await expect(page.locator('[data-need-resource="conductor"]')).toContainText('Needs supplied');
 await choose('previous-page');await choose('purchase-ice');await expect(page.locator('.trade-feedback')).toContainText('Loaded 1 SBU');
 const bought=await page.evaluate(()=>window.starAgent.state.trading);expect(bought.markets['settlement-selene'].stock.ice).toBe(2399);expect(bought.ships.find(s=>s.hull==='nomad').crates).toHaveLength(2);
 await choose('view-cargo');await capture(page,'cargo-result');
 await choose('tab-map');await expect(page.locator('#map-target-kind')).not.toContainText('Conductor stock 1 SBU');await expect(page.locator('#map-target-kind')).toContainText('Needs:');
 await page.setViewportSize({width:390,height:844});await capture(page,'map-needs-phone');expect(await page.locator('#system-map').evaluate(d=>d.scrollWidth<=d.clientWidth+2)).toBe(true);await page.setViewportSize({width:1440,height:900});
 await button(7,true);await tap(1);await frames(page);expect(await page.evaluate(()=>window.starAgent.state.controller.armed)).toBe(false);await button(7,false);await page.waitForFunction(()=>window.starAgent.state.controller.armed);
 // Held translation cannot replay after focus or disconnect transitions.
 await focusInterruption(page,button);await button(7,true);await page.evaluate(()=>window.settlementDisconnected=true);await frames(page);expect(await page.evaluate(()=>window.starAgent.state.controller.armed)).toBe(false);await page.evaluate(()=>window.settlementDisconnected=false);await frames(page);expect(await page.evaluate(()=>window.starAgent.state.controller.armed)).toBe(false);await button(7,false);await page.waitForFunction(()=>window.starAgent.state.controller.armed);
 await walk(page,[-2,0,-12]);await walk(page,[9,0,-12]);await walk(page,[9,0,30]);await walk(page,[0,1.75,8],'ship');await aim(page,[0,2.75,0]);await walk(page,[0,2.75,3],'ship');await walk(page,[0,2.75,-1.65],'ship');await aim(page,[0,2.75,-3]);await tap(2);await page.waitForFunction(()=>window.starAgent.state.mode==='landed');await tap(3);await page.waitForFunction(()=>window.starAgent.state.mode==='flight');
 await capture(page,'returned-to-flight');expect(errors).toEqual([]);await writeFile(`${out}/controller.json`,JSON.stringify({browser:browser.version(),graphics:await graphics(page),errors,warnings,physicalController:false,start:'Explicit approach at 65 m with two previously purchased conductor crates and destination reserve 255/256 SBU. All subsequent navigation uses injected standard Gamepad; terminal pagination also checks keyboard and native touch. No pose mutation.',state:await page.evaluate(()=>window.starAgent.state)},null,2));
});

