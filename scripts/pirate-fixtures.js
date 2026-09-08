import {expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
export const out=process.env.PIRATE_EVIDENCE||'test-results/pirate-01';
export const frames=p=>p.evaluate(async()=>{for(let i=0;i<4;i++)await new Promise(r=>requestAnimationFrame(r));});
export async function setup(page,site='pirate-hush'){
 await mkdir(out,{recursive:true});const errors=[],warnings=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());if(m.type()==='warning')warnings.push(m.text());});
 await page.addInitScript(()=>{window.settlementPad={id:'Settlement standard Gamepad',mapping:'standard',index:0,connected:true,axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};Object.defineProperty(navigator,'getGamepads',{value:()=>window.settlementDisconnected?[]:[window.settlementPad]});});
 await page.route('**/api/auth/session',r=>r.fulfill({json:{account:null}}));
 await page.goto(`/?dev=1&ship=nomad&start=${site}&intro=0&debug&seed=7291&epoch=1788876000000`);
 await page.waitForFunction(()=>window.starAgent?.state.ready&&window.starAgent.state.enabled&&!window.starAgent.state.transiting&&window.starAgent.state.controller.armed,undefined,{timeout:90000});
 await page.waitForFunction(()=>window.starAgent.state.pirateCompound.ready&&window.starAgent.state.pirateCompound.rendered>0);
 const button=async(i,pressed)=>{await page.evaluate(({i,pressed})=>window.settlementPad.buttons[i]={pressed,value:+pressed},{i,pressed});await frames(page);};
 const tap=async i=>{await button(i,true);await button(i,false);};
 const choose=async key=>{for(let i=0;i<95;i++){if(await page.evaluate(k=>document.activeElement?.dataset.controllerKey===k,key)){await tap(0);return;}await tap(13);}throw Error(`Missing controller action ${key}`);};
 return {tap,button,choose,errors,warnings};
}
// Navigation state is read only. Steering writes only standard Gamepad axes.
export async function walk(page,target,frame='site'){
 console.log('walk',frame,target);
 await page.evaluate(({target,frame})=>{window.settlementWalkDone=false;window.settlementWalkTimer=setInterval(()=>{const n=window.starAgent.navigation,s=window.starAgent.state.pirateCompound.site,q=n.shipOrientation.clone().fromArray(s.quaternion),goal=frame==='ship'?n.fromShipLocal(n.position.clone().fromArray(target)):n.position.clone().fromArray(target).applyQuaternion(q).add(n.position.clone().fromArray(s.origin));const delta=goal.sub(n.position).projectOnPlane(n.normal);if(delta.length()<.22){window.settlementPad.axes=[0,0,0,0];window.settlementWalkDone=true;clearInterval(window.settlementWalkTimer);return;}if(delta.length()>1)delta.normalize();delta.applyQuaternion(n.orientation.clone().invert());window.settlementPad.axes=[Math.max(-1,Math.min(1,delta.x)),Math.max(-1,Math.min(1,delta.z)),0,0];},30);},{target,frame});
 try{await page.waitForFunction(()=>window.settlementWalkDone,undefined,{timeout:120000});}finally{await page.evaluate(()=>{clearInterval(window.settlementWalkTimer);window.settlementPad.axes=[0,0,0,0];});}await frames(page);console.log('walk reached',frame,target);
}
export async function aim(page,target,frame='ship'){
 await page.evaluate(({target,frame})=>{window.settlementAimDone=false;window.settlementAimTimer=setInterval(()=>{const n=window.starAgent.navigation,goal=frame==='ship'?n.fromShipLocal(n.position.clone().fromArray(target)):n.position.clone().fromArray(target),local=goal.sub(n.position).applyQuaternion(n.orientation.clone().invert()),yaw=Math.atan2(local.x,-local.z),pitch=Math.atan2(local.y,Math.hypot(local.x,local.z));if(Math.abs(yaw)<.025&&Math.abs(pitch)<.025){window.settlementPad.axes=[0,0,0,0];window.settlementAimDone=true;clearInterval(window.settlementAimTimer);return;}const a=x=>Math.abs(x)<.015?0:Math.sign(x)*Math.min(1,.19+Math.abs(x)*2);window.settlementPad.axes=[0,0,a(yaw),a(-pitch)];},30);},{target,frame});
 try{await page.waitForFunction(()=>window.settlementAimDone,undefined,{timeout:20000});}finally{await page.evaluate(()=>{clearInterval(window.settlementAimTimer);window.settlementPad.axes=[0,0,0,0];});}await frames(page);
}
export async function capture(page,name){await page.screenshot({path:`${out}/${name}.png`});await writeFile(`${out}/${name}.json`,JSON.stringify(await page.evaluate(()=>window.starAgent.state),null,2));}
export async function graphics(page){return page.evaluate(()=>{const canvas=document.querySelector('canvas'),gl=canvas?.getContext('webgl2')||canvas?.getContext('webgl'),debug=gl?.getExtension('WEBGL_debug_renderer_info');return {viewport:{width:innerWidth,height:innerHeight},renderer:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):gl?.getParameter(gl.RENDERER),vendor:debug?gl.getParameter(debug.UNMASKED_VENDOR_WEBGL):gl?.getParameter(gl.VENDOR)};});}
export async function focusInterruption(page,button){
 const context=page.context(),blank=await context.newPage(),game=await context.newCDPSession(page),other=await context.newCDPSession(blank);
 try{
  await blank.goto('about:blank');await game.send('Emulation.setFocusEmulationEnabled',{enabled:false});await other.send('Emulation.setFocusEmulationEnabled',{enabled:false});
  await page.bringToFront();await page.waitForFunction(()=>document.hasFocus()&&window.starAgent.state.focused);await button(7,true);
  await blank.bringToFront();await page.waitForFunction(()=>!window.starAgent.state.focused);expect(await page.evaluate(()=>window.starAgent.state.controller.armed)).toBe(false);
  await page.bringToFront();await page.waitForFunction(()=>document.hasFocus()&&window.starAgent.state.focused);await frames(page);expect(await page.evaluate(()=>window.starAgent.state.controller.armed)).toBe(false);
  await button(7,false);await page.waitForFunction(()=>window.starAgent.state.controller.armed);
 }finally{await game.send('Emulation.setFocusEmulationEnabled',{enabled:true});await other.send('Emulation.setFocusEmulationEnabled',{enabled:true});await game.detach();await other.detach();await blank.close();await page.bringToFront();}
}


export async function traverseAirlock(page,tap,direction){
 const sides=direction==='enter'?['outer','inner']:['inner','outer'];
 for(const side of sides){
  const target=await page.evaluate(side=>window.starAgent.state.pirateCompound.airlock.doors.find(door=>door.side===side).position,side);await aim(page,target,'world');
  await page.waitForFunction(side=>window.starAgent.state.interaction.includes(`Open ${side} airlock door`),side,{timeout:12000});await tap(2);
  await page.waitForFunction(side=>{const doors=window.starAgent.state.pirateCompound.airlock.doors;return doors.find(door=>door.side===side).fraction>.98&&doors.find(door=>door.side!==side).fraction<.001;},side,{timeout:12000});
  await page.waitForFunction(()=>window.starAgent.state.controller.armed);await capture(page,`${direction}-${side}-airlock`);
  if(direction==='enter'&&side==='outer'){
   // Walk into the actual leaf sweep, then request closing with X. Keep facing
   // through the opening; aiming at the close-up center would be near vertical.
   await walk(page,[6,0,-3.8]);await tap(2);
   await page.waitForFunction(()=>window.starAgent.state.pirateCompound.airlock.doors.find(d=>d.side==='outer').blocked,undefined,{timeout:12000});
   const blocked=await page.evaluate(()=>window.starAgent.state.pirateCompound.airlock);expect(blocked.doors.find(d=>d.side==='outer').fraction).toBeGreaterThan(0);expect(blocked.doors.find(d=>d.side==='inner').fraction).toBe(0);await capture(page,'outer-closing-blocked');
   await page.waitForFunction(()=>window.starAgent.state.controller.armed);await tap(2);await page.waitForFunction(()=>window.starAgent.state.pirateCompound.airlock.doors.find(d=>d.side==='outer').fraction>.98);await page.waitForFunction(()=>window.starAgent.state.controller.armed);
   await writeFile(`${out}/airlock-blocked-close.json`,JSON.stringify({blocked,reopened:await page.evaluate(()=>window.starAgent.state.pirateCompound.airlock),controlledPose:false},null,2));
  }
  await walk(page,[6,0,direction==='enter'?(side==='outer'?-9.5:-19.8):(side==='inner'?-6.5:-1.5)]);
 }
}

export async function pirateControllerJourney({page,browser},site='pirate-hush'){
 const {tap,button,choose,errors,warnings}=await setup(page,site);
 await capture(page,'outer-approach');
 await page.evaluate(()=>{for(const i of [4,5])window.settlementPad.buttons[i]={pressed:true,value:1};});await frames(page);await tap(13);await page.evaluate(()=>{for(const i of [4,5])window.settlementPad.buttons[i]={pressed:false,value:0};});await frames(page);await page.waitForFunction(()=>window.starAgent.state.landingGear.progress>.98);await tap(3);await page.waitForFunction(()=>window.starAgent.state.mode==='landed',undefined,{timeout:60000});
 await tap(2);await page.waitForFunction(()=>window.starAgent.state.mode==='walk');await walk(page,[.2,2.75,3.55],'ship');await aim(page,[0,2.75,7]);await page.waitForFunction(()=>window.starAgent.state.interaction.includes('HATCH'));await tap(2);await page.waitForFunction(()=>window.starAgent.state.doorProgress>.98);await walk(page,[0,1.75,8],'ship');
 // Actual pad ramp -> canonical body terrain -> actual compound service ramp.
 for(const p of [[17,0,278],...(await page.evaluate(()=>window.starAgent.state.pirateCompound.site.groundRoute)).map(([x,z])=>[x,0,z]),[17,0,30],[-16,0,26],[-16,0,-5.5]])await walk(page,p);
 await aim(page,await page.evaluate(()=>window.starAgent.state.pirateCompound.site.panel),'world');await capture(page,'tower-panel');await tap(2);await expect(page.locator('.pirate-service[open]')).toBeVisible();await choose(`${site.slice(7)}-isolate`);await expect(page.locator('.pirate-service[open] [data-isolate]')).toBeDisabled();expect(await page.evaluate(()=>window.starAgent.state.pirateCompound.unlocked)).toBe(true);
 await button(7,true);await tap(1);await frames(page);expect(await page.evaluate(()=>window.starAgent.state.controller.armed)).toBe(false);await button(7,false);await page.waitForFunction(()=>window.starAgent.state.controller.armed);
 for(const p of [[-16,0,20],[20,0,20],[20,0,-1.5],[6,0,-1.5]])await walk(page,p);
 await traverseAirlock(page,tap,'enter');
 await aim(page,await page.evaluate(()=>window.starAgent.state.pirateCompound.site.terminal),'world');await capture(page,'trader-door');await tap(2);await expect(page.locator('#trading-dialog')).toBeVisible();await expect(page.locator('.trade-place')).toHaveText(site==='pirate-hush'?'Hush Exchange':'Veil Exchange');
 const before=await page.evaluate(site=>({stock:window.starAgent.state.trading.markets[site].stock.ice,credits:window.starAgent.state.trading.account.credits}),site);await choose('purchase-ice');await expect(page.locator('.trade-feedback')).toContainText('Loaded 1 SBU');
 const after=await page.evaluate(()=>window.starAgent.state.trading);expect(after.markets[site].stock.ice).toBe(before.stock-1);expect(after.account.credits).toBeLessThan(before.credits);const crate=after.ships.find(s=>s.hull==='nomad').crates[0];expect(crate.resource).toBe('ice');await choose('view-cargo');await capture(page,'trade-cargo');await choose(`sell-${crate.id}`);await expect(page.locator('.trade-feedback')).toContainText('Sold 1 SBU');const sold=await page.evaluate(()=>window.starAgent.state.trading);expect(sold.markets[site].stock.ice).toBe(before.stock);expect(sold.ships.find(s=>s.hull==='nomad').crates.some(c=>c.id===crate.id)).toBe(false);expect(sold.account.credits).toBeGreaterThan(after.account.credits);
 await button(7,true);await tap(1);await frames(page);expect(await page.evaluate(()=>window.starAgent.state.controller.armed)).toBe(false);await button(7,false);await page.waitForFunction(()=>window.starAgent.state.controller.armed);await focusInterruption(page,button);
 await button(7,true);await page.evaluate(()=>window.settlementDisconnected=true);await frames(page);await page.evaluate(()=>window.settlementDisconnected=false);await frames(page);expect(await page.evaluate(()=>window.starAgent.state.controller.armed)).toBe(false);await button(7,false);await page.waitForFunction(()=>window.starAgent.state.controller.armed);
 await button(7,true);await page.evaluate(()=>window.settlementPad.id='Replacement standard Gamepad');await frames(page);expect(await page.evaluate(()=>window.starAgent.state.controller.armed)).toBe(false);await button(7,false);await page.waitForFunction(()=>window.starAgent.state.controller.armed);
 await button(7,true);await page.evaluate(()=>window.settlementPad.mapping='');await frames(page);expect(await page.evaluate(()=>window.starAgent.state.controller.armed)).toBe(false);await page.evaluate(()=>window.settlementPad.mapping='standard');await frames(page);expect(await page.evaluate(()=>window.starAgent.state.controller.armed)).toBe(false);await button(7,false);await page.waitForFunction(()=>window.starAgent.state.controller.armed);await walk(page,[6,0,-14.5]);await traverseAirlock(page,tap,'exit');await capture(page,'returned-to-play');
 expect(errors).toEqual([]);await writeFile(`${out}/controller-${site}.json`,JSON.stringify({browser:browser.version(),graphics:await graphics(page),errors,warnings,physicalController:false,controlledStart:'Explicit developer outer-pad approach; subsequent pose and interactions through injected Gamepad only.',before,after:after.markets[site],state:await page.evaluate(()=>window.starAgent.state.pirateCompound)},null,2));
}
