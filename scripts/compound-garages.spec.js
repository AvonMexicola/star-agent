import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const out=process.env.GARAGE_EVIDENCE;
const diagnostics=new WeakMap();
test('local preview serves checked garages and the paired healthy API',async({request})=>{
 test.skip(process.env.GARAGE_VERIFY_LOCAL!=='1','Opt-in check for the shared local preview.');
 const checks=[];
 for(const [url,needle] of [
  ['http://127.0.0.1:5178/api/health',null],
  ['http://127.0.0.1:8087/api/health',null],
  ['http://127.0.0.1:5178/src/main.js','createGarageSystem'],
  ['http://127.0.0.1:5178/src/settlements/garage-system.js','createGarageSystem'],
  ['http://127.0.0.1:5178/src/mining-rover.js','deployAt'],
  ['http://127.0.0.1:5178/src/multiplayer/protocol.js','PROTOCOL_VERSION'],
 ]){
  const response=await request.get(url);expect(response.status()).toBe(200);const content=await response.text();if(needle)expect(content).toContain(needle);
  checks.push({url,status:response.status(),bytes:Buffer.byteLength(content)});
 }
 await mkdir(out,{recursive:true});await writeFile(`${out}/local-preview.json`,JSON.stringify({verifiedAt:new Date().toISOString(),checks,mutations:false},null,2));
});
const frames=p=>p.evaluate(async()=>{for(let i=0;i<4;i++)await new Promise(r=>requestAnimationFrame(r));});
async function setup(page,site='selene'){
 await mkdir(out,{recursive:true});const errors=[],warnings=[];diagnostics.set(page,{errors,warnings});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());if(m.type()==='warning')warnings.push(m.text());});
 await page.addInitScript(()=>{window.settlementPad={id:'Garage standard Gamepad',mapping:'standard',index:0,connected:true,axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};Object.defineProperty(navigator,'getGamepads',{value:()=>window.settlementDisconnected?[]:[window.settlementPad]});});
 await page.route('**/api/auth/session',r=>r.fulfill({json:{account:null}}));
 await page.goto(`/?dev=1&ship=nomad&start=settlement-${site}&intro=0&debug&seed=7291&epoch=1788876000000`);
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
async function graphics(page){return page.evaluate(()=>{const canvas=document.querySelector('canvas'),gl=canvas?.getContext('webgl2')||canvas?.getContext('webgl'),debug=gl?.getExtension('WEBGL_debug_renderer_info');return {viewport:{width:innerWidth,height:innerHeight},renderer:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):gl?.getParameter(gl.RENDERER),vendor:debug?gl.getParameter(debug.UNMASKED_VENDOR_WEBGL):gl?.getParameter(gl.VENDOR),drawCalls:window.starAgent.state.drawCalls,triangles:window.starAgent.state.triangles,renderResolution:window.starAgent.state.renderResolution,fpsSample:window.starAgent.state.fps,performanceAcceptance:false};});}
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

test.afterEach(async({page},info)=>{if(info.status!==info.expectedStatus){try{await capture(page,'failure-'+info.retry);await writeFile(`${out}/failure-diagnostics.json`,JSON.stringify(diagnostics.get(page)));}catch{}}});

test('controller lands, walks to garage, deploys and physically boards Burrow, drives to terrain, opens ore and returns',async({page,browser})=>{
 const {tap,button,choose,errors,warnings}=await setup(page);
 await page.evaluate(()=>{for(const i of [4,5])window.settlementPad.buttons[i]={pressed:true,value:1};});await frames(page);await tap(13);await page.evaluate(()=>{for(const i of [4,5])window.settlementPad.buttons[i]={pressed:false,value:0};});await frames(page);
 await page.waitForFunction(()=>window.starAgent.state.landingGear.progress>.98);await tap(3);await page.waitForFunction(()=>window.starAgent.state.mode==='landed',undefined,{timeout:60000});
 await tap(2);await page.waitForFunction(()=>window.starAgent.state.mode==='walk');
 await walk(page,[0,2.75,3],'ship');await aim(page,[0,2.75,7]);await tap(2);await page.waitForFunction(()=>window.starAgent.state.doorProgress>.98);await walk(page,[0,1.75,8],'ship');
 await walk(page,[10,0,30]);await walk(page,[18,0,-2]);await walk(page,[23.2,0,-2]);
 const terminal=await page.evaluate(()=>window.starAgent.state.garages.sites.find(s=>s.body==='selene').terminal);await aim(page,terminal,'world');await capture(page,'garage-entry');
 await tap(2);await expect(page.locator('#garage-dialog')).toBeVisible();await choose('garage-retrieve');
 await expect(page.locator('.garage-status')).toContainText('Burrow is ready', {timeout:30000});await capture(page,'garage-deployed');
 const pose=await page.evaluate(()=>window.starAgent.state.position);await button(7,true);await tap(1);expect(await page.evaluate(()=>window.starAgent.state.controller.armed)).toBe(false);await button(7,false);await page.waitForFunction(()=>window.starAgent.state.controller.armed);
 expect(await page.evaluate(p=>window.starAgent.navigation.position.distanceTo(window.starAgent.navigation.position.clone().fromArray(p)),pose)).toBeLessThan(.005);
 await walk(page,[23.2,0,1.6]);await walk(page,[28,0,1.6]);await walk(page,[32.1,0,1.6]);await page.waitForFunction(()=>window.starAgent.state.rover.near);await capture(page,'port-door');
 await tap(2);await page.waitForFunction(()=>window.starAgent.state.rover.occupied&&!window.starAgent.state.rover.busy,undefined,{timeout:25000});await capture(page,'garage-cockpit');
 await page.evaluate(()=>window.settlementPad.axes=[0,-.5,0,0]);
 try{await page.waitForFunction(()=>{const s=window.starAgent.state,n=window.starAgent.navigation,site=s.settlements.sites.find(s=>s.body==='selene');return n.position.clone().fromArray(s.rover.position).sub(n.position.clone().fromArray(site.origin)).applyQuaternion(n.orientation.clone().fromArray(site.quaternion).invert()).x>79;},undefined,{timeout:30000});}finally{await page.evaluate(()=>window.settlementPad.axes.fill(0));}
 await button(6,true);await page.waitForFunction(()=>Math.abs(window.starAgent.state.rover.speed)<.01);await button(6,false);expect(await page.evaluate(()=>window.starAgent.state.rover.wheels.every(w=>w.source==='terrain'))).toBe(true);await capture(page,'driveway-exit');
 await tap(8);await expect(page.locator('#cargo-dialog')).toBeVisible();await capture(page,'ore-inventory');await button(7,true);await tap(1);expect(await page.evaluate(()=>window.starAgent.state.controller.armed)).toBe(false);await button(7,false);await page.waitForFunction(()=>window.starAgent.state.controller.armed);
 await focusInterruption(page,button);await button(7,true);await page.evaluate(()=>window.settlementDisconnected=true);await frames(page);await page.evaluate(()=>window.settlementDisconnected=false);await frames(page);expect(await page.evaluate(()=>window.starAgent.state.controller.armed)).toBe(false);await button(7,false);await page.waitForFunction(()=>window.starAgent.state.controller.armed);
 await button(7,true);await page.waitForTimeout(2200);await tap(2);await button(7,false);await page.waitForFunction(()=>!window.starAgent.state.rover.occupied&&!window.starAgent.state.rover.busy,undefined,{timeout:25000});await capture(page,'return-to-surface');
 const retained=await page.evaluate(()=>({mass:window.starAgent.state.rover.mass,charge:window.starAgent.state.rover.charge}));expect(retained.charge).toBeLessThan(1);
 // Walk the real driveway back and retrieve the parked vehicle with keyboard.
 await walk(page,[70,0,1.6]);await walk(page,[44,0,1.6]);await walk(page,[28,0,1.6]);await walk(page,[23.2,0,1.6]);await walk(page,[23.2,0,-2]);await aim(page,terminal,'world');
 await page.keyboard.press('f');await expect(page.locator('#garage-dialog')).toBeVisible();
 await page.setViewportSize({width:390,height:844});await frames(page);await capture(page,'garage-phone');expect(await page.locator('#garage-dialog').evaluate(d=>d.scrollWidth<=d.clientWidth+2)).toBe(true);
 await page.locator('[data-controller-key="garage-retrieve"]').tap();await expect(page.locator('.garage-status')).toContainText('Burrow is ready');expect(await page.evaluate(()=>({mass:window.starAgent.state.rover.mass,charge:window.starAgent.state.rover.charge}))).toEqual(retained);await page.locator('[data-controller-key="garage-close"]').tap();await page.waitForFunction(()=>window.starAgent.state.enabled);
 expect(errors).toEqual([]);await writeFile(`${out}/journey.json`,JSON.stringify({browser:browser.version(),graphics:await graphics(page),errors,warnings,controller:'Injected standard Gamepad, physical land/walk/board/drive/inventory/return; no pose or save mutation.',physicalDevice:false},null,2));
});

for(const body of ['aeon','selene','pyre','miasma'])test(`garage renders on ${body}`,async({page,browser})=>{
 const {errors,warnings}=await setup(page,body);
 await page.evaluate(()=>{const n=window.starAgent.navigation,s=window.starAgent.state.settlements.sites.find(s=>s.body===n.body.id),g=window.starAgent.state.garages.sites.find(s=>s.body===n.body.id),q=n.orientation.clone().fromArray(s.quaternion),o=n.position.clone().fromArray(s.origin),center=n.position.clone().fromArray(g.position).sub(o).applyQuaternion(q.clone().invert());const world=a=>n.position.clone().fromArray(a).applyQuaternion(q).add(o);n.mode='walk';n.enabled=false;n.insideShip=false;n.position.copy(world([72,center.y+24,center.z+44]));n.orientToward(world([32,center.y+2,center.z]),n.normal);n.velocity.set(0,0,0);});
 await page.addStyleTag({content:'body > :not(canvas){visibility:hidden!important}'});await page.waitForFunction(()=>{const s=window.starAgent.state;return s.body==='aeon'?s.terrainLod.settled:s.body==='selene'?s.moon.pending===0&&s.moon.effects.settled:s[s.body].pending===0&&s[s.body].morphing===0;},undefined,{timeout:60000});await page.waitForTimeout(1000);await capture(page,`${body}-compound`);
 await page.evaluate(()=>{const n=window.starAgent.navigation,s=window.starAgent.state.settlements.sites.find(s=>s.body===n.body.id),q=n.orientation.clone().fromArray(s.quaternion),o=n.position.clone().fromArray(s.origin),deck=n.position.clone().fromArray(s.pad).sub(o).applyQuaternion(q.clone().invert()).y,world=a=>n.position.clone().fromArray(a).add(n.position.clone().set(0,deck,0)).applyQuaternion(q).add(o);n.position.copy(world([70,42,92]));n.orientToward(world([0,2,12]),n.normal);});await frames(page);await page.waitForTimeout(1000);await capture(page,`${body}-approach`);expect(errors).toEqual([]);await writeFile(`${out}/${body}-art.json`,JSON.stringify({browser:browser.version(),graphics:await graphics(page),errors,warnings,artPoseOnly:true},null,2));
});
