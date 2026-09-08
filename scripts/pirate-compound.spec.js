import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const out=process.env.PIRATE_EVIDENCE||'test-results/pirate-01';
const frames=p=>p.evaluate(async()=>{for(let i=0;i<4;i++)await new Promise(r=>requestAnimationFrame(r));});
async function setup(page,site='selene'){
 await mkdir(out,{recursive:true});const errors=[],warnings=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());if(m.type()==='warning')warnings.push(m.text());});
 await page.addInitScript(()=>{window.settlementPad={id:'Settlement standard Gamepad',mapping:'standard',index:0,connected:true,axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};Object.defineProperty(navigator,'getGamepads',{value:()=>window.settlementDisconnected?[]:[window.settlementPad]});});
 await page.route('**/api/auth/session',r=>r.fulfill({json:{account:null}}));
 await page.goto(`/?dev=1&ship=nomad&start=pirate-hush&intro=0&debug&seed=7291&epoch=1788876000000`);
 await page.waitForFunction(()=>window.starAgent?.state.ready&&window.starAgent.state.enabled&&!window.starAgent.state.transiting&&window.starAgent.state.controller.armed,undefined,{timeout:90000});
 await page.waitForFunction(()=>window.starAgent.state.pirateCompound.ready&&window.starAgent.state.pirateCompound.rendered>0);
 const button=async(i,pressed)=>{await page.evaluate(({i,pressed})=>window.settlementPad.buttons[i]={pressed,value:+pressed},{i,pressed});await frames(page);};
 const tap=async i=>{await button(i,true);await button(i,false);};
 const choose=async key=>{for(let i=0;i<95;i++){if(await page.evaluate(k=>document.activeElement?.dataset.controllerKey===k,key)){await tap(0);return;}await tap(13);}throw Error(`Missing controller action ${key}`);};
 return {tap,button,choose,errors,warnings};
}
// Navigation state is read only. Steering writes only standard Gamepad axes.
async function walk(page,target,frame='site'){
 console.log('walk',frame,target);
 await page.evaluate(({target,frame})=>{window.settlementWalkDone=false;window.settlementWalkTimer=setInterval(()=>{const n=window.starAgent.navigation,s=window.starAgent.state.pirateCompound.site,q=n.shipOrientation.clone().fromArray(s.quaternion),goal=frame==='ship'?n.fromShipLocal(n.position.clone().fromArray(target)):n.position.clone().fromArray(target).applyQuaternion(q).add(n.position.clone().fromArray(s.origin));const delta=goal.sub(n.position).projectOnPlane(n.normal);if(delta.length()<.22){window.settlementPad.axes=[0,0,0,0];window.settlementWalkDone=true;clearInterval(window.settlementWalkTimer);return;}delta.applyQuaternion(n.orientation.clone().invert());window.settlementPad.axes=[Math.max(-1,Math.min(1,delta.x)),Math.max(-1,Math.min(1,delta.z)),0,0];},30);},{target,frame});
 try{await page.waitForFunction(()=>window.settlementWalkDone,undefined,{timeout:120000});}finally{await page.evaluate(()=>{clearInterval(window.settlementWalkTimer);window.settlementPad.axes=[0,0,0,0];});}await frames(page);console.log('walk reached',frame,target);
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


test('controller physically approaches, isolates tower, trades and returns to play',async({page,browser})=>{
 const {tap,button,choose,errors,warnings}=await setup(page);
 await capture(page,'outer-approach');
 await page.evaluate(()=>{for(const i of [4,5])window.settlementPad.buttons[i]={pressed:true,value:1};});await frames(page);await tap(13);await page.evaluate(()=>{for(const i of [4,5])window.settlementPad.buttons[i]={pressed:false,value:0};});await frames(page);await page.waitForFunction(()=>window.starAgent.state.landingGear.progress>.98);await tap(3);await page.waitForFunction(()=>window.starAgent.state.mode==='landed',undefined,{timeout:60000});
 await tap(2);await page.waitForFunction(()=>window.starAgent.state.mode==='walk');await walk(page,[0,2.75,3],'ship');await aim(page,[0,2.75,7]);await tap(2);await page.waitForFunction(()=>window.starAgent.state.doorProgress>.98);await walk(page,[0,1.75,8],'ship');
 // Actual pad ramp -> lunar terrain -> actual compound service ramp.
 for(const p of [[17,0,278],[17,0,314],[30,0,314],[30,0,75],[17,0,75],[17,0,30],[-16,0,26],[-16,0,-5.5]])await walk(page,p);
 await aim(page,await page.evaluate(()=>window.starAgent.state.pirateCompound.site.panel),'world');await capture(page,'tower-panel');await tap(2);await expect(page.locator('#pirate-service')).toBeVisible();await choose('hush-isolate');await expect(page.locator('[data-isolate]')).toBeDisabled();expect(await page.evaluate(()=>window.starAgent.state.pirateCompound.unlocked)).toBe(true);
 await button(7,true);await tap(1);await frames(page);expect(await page.evaluate(()=>window.starAgent.state.controller.armed)).toBe(false);await button(7,false);await page.waitForFunction(()=>window.starAgent.state.controller.armed);
 for(const p of [[-16,0,20],[20,0,20],[20,0,-8],[6,0,-8],[6,0,-19.8]])await walk(page,p);
 await aim(page,await page.evaluate(()=>window.starAgent.state.pirateCompound.site.terminal),'world');await capture(page,'trader-door');await tap(2);await expect(page.locator('#trading-dialog')).toBeVisible();await expect(page.locator('.trade-place')).toHaveText('Hush Exchange');
 const before=await page.evaluate(()=>({stock:window.starAgent.state.trading.markets['pirate-hush'].stock.ice,credits:window.starAgent.state.trading.account.credits}));await choose('purchase-ice');await expect(page.locator('.trade-feedback')).toContainText('Loaded 1 SBU');
 const after=await page.evaluate(()=>window.starAgent.state.trading);expect(after.markets['pirate-hush'].stock.ice).toBe(before.stock-1);expect(after.account.credits).toBeLessThan(before.credits);const crate=after.ships.find(s=>s.hull==='nomad').crates[0];expect(crate.resource).toBe('ice');await choose('view-cargo');await capture(page,'trade-cargo');await choose(`sell-${crate.id}`);await expect(page.locator('.trade-feedback')).toContainText('Sold 1 SBU');
 await button(7,true);await tap(1);await frames(page);expect(await page.evaluate(()=>window.starAgent.state.controller.armed)).toBe(false);await button(7,false);await page.waitForFunction(()=>window.starAgent.state.controller.armed);await focusInterruption(page,button);
 await button(7,true);await page.evaluate(()=>window.settlementDisconnected=true);await frames(page);await page.evaluate(()=>window.settlementDisconnected=false);await frames(page);expect(await page.evaluate(()=>window.starAgent.state.controller.armed)).toBe(false);await button(7,false);await page.waitForFunction(()=>window.starAgent.state.controller.armed);await walk(page,[6,0,-8]);await capture(page,'returned-to-play');
 expect(errors).toEqual([]);await writeFile(`${out}/controller.json`,JSON.stringify({browser:browser.version(),graphics:await graphics(page),errors,warnings,physicalController:false,controlledStart:'Explicit developer outer-pad approach; subsequent pose and interactions through injected Gamepad only.',before,after:after.markets['pirate-hush'],state:await page.evaluate(()=>window.starAgent.state.pirateCompound)},null,2));
});

test('tower telegraphs weaker fire, stops on retreat, and renders in compound',async({page,browser})=>{
 const {errors,warnings}=await setup(page);
 // Art/balance fixture only; this does not establish controller navigation.
 await page.evaluate(()=>{const n=window.starAgent.navigation,s=window.starAgent.state.pirateCompound.site,q=n.orientation.clone().fromArray(s.quaternion),o=n.position.clone().fromArray(s.origin);n.position.set(0,s.deck+40,100).applyQuaternion(q).add(o);n.velocity.set(0,0,0);n.orientToward(n.position.clone().fromArray(s.tower),n.normal);});
 await page.waitForFunction(()=>window.starAgent.state.pirateCompound.phase==='charge',undefined,{timeout:25000});await capture(page,'charging-tower');const before=await page.evaluate(()=>window.starAgent.state.combat.player);await page.waitForFunction(()=>window.starAgent.state.pirateCompound.shots>=3,undefined,{timeout:15000});const after=await page.evaluate(()=>window.starAgent.state.combat.player);expect(after.hull).toBe(before.hull);expect(after.shield).toBeGreaterThan(0);expect(after.shield).toBeLessThan(before.shield);await capture(page,'survived-burst');
 await page.evaluate(()=>{const n=window.starAgent.navigation,s=window.starAgent.state.pirateCompound.site;n.position.set(0,s.deck+40,350).applyQuaternion(n.orientation.clone().fromArray(s.quaternion)).add(n.position.clone().fromArray(s.origin));n.velocity.set(0,0,0);});const shots=await page.evaluate(()=>window.starAgent.state.pirateCompound.shots);await page.waitForTimeout(2500);expect(await page.evaluate(()=>window.starAgent.state.pirateCompound.shots)).toBe(shots);
 await page.evaluate(()=>{const n=window.starAgent.navigation,s=window.starAgent.state.pirateCompound.site,q=n.orientation.clone().fromArray(s.quaternion),o=n.position.clone().fromArray(s.origin);n.mode='walk';n.enabled=false;n.insideShip=false;n.position.set(48,s.deck+28,61).applyQuaternion(q).add(o);n.orientToward(n.position.clone().set(0,s.deck+5,-10).applyQuaternion(q).add(o),n.normal);n.velocity.set(0,0,0);});await page.waitForFunction(()=>window.starAgent.state.moon.pending===0&&window.starAgent.state.moon.effects.settled,undefined,{timeout:60000});await frames(page);await page.addStyleTag({content:'body > :not(canvas) { visibility: hidden !important; }'});await capture(page,'compound-overview');
 for(const [name,eye,look] of [['crimson-work-yard',[-2,3,24],[-8,1,8]],['cylindrical-tower',[-2,10,7],[-16,7,-12]],['crimson-generator',[-7,2,-21],[-10,1,-27]],['locked-exchange',[6,1.75,-18],[6,1.3,-22]]]){
  await page.evaluate(({eye,look})=>{const n=window.starAgent.navigation,s=window.starAgent.state.pirateCompound.site,q=n.orientation.clone().fromArray(s.quaternion),o=n.position.clone().fromArray(s.origin),world=a=>n.position.clone().fromArray([a[0],s.deck+a[1],a[2]]).applyQuaternion(q).add(o);n.position.copy(world(eye));n.orientToward(world(look),n.normal);},{eye,look});await frames(page);await capture(page,name);
 }
 expect(errors).toEqual([]);await writeFile(`${out}/visual-balance.json`,JSON.stringify({browser:browser.version(),graphics:await graphics(page),errors,warnings,before,after,retreatShots:shots,fixture:true,state:await page.evaluate(()=>window.starAgent.state.pirateCompound)},null,2));
});

test('keyboard and native phone use the service panel and actual trade handlers',async({page,browser})=>{
 const {errors,warnings}=await setup(page);
 // Presentation regression uses explicit nearby poses, separate from the full controller route.
 async function pose(x,z){await page.evaluate(({x,z})=>{const n=window.starAgent.navigation,s=window.starAgent.state.pirateCompound.site,q=n.orientation.clone().fromArray(s.quaternion),o=n.position.clone().fromArray(s.origin);n.mode='walk';n.insideShip=false;n.cabinFlight=false;n.enabled=true;n.position.set(x,s.deck+n.layout.eyeHeight,z).applyQuaternion(q).add(o);n.orientation.copy(q);n.velocity.set(0,0,0);n.shipPosition=n.position.clone().fromArray(s.pad);n.shipOrientation.copy(q);n.shipVelocity.set(0,0,0);},{x,z});await frames(page);}
 await pose(-16,-5.5);await page.keyboard.press('f');await expect(page.locator('#pirate-service')).toBeVisible();await capture(page,'service-keyboard');await page.keyboard.press('Escape');await expect(page.locator('#pirate-service')).not.toBeVisible();
 await page.setViewportSize({width:390,height:844});await frames(page);await page.locator('.pirate-service-action').tap();await expect(page.locator('#pirate-service')).toBeVisible();await page.locator('[data-isolate]').tap();expect(await page.evaluate(()=>window.starAgent.state.pirateCompound.unlocked)).toBe(true);expect(await page.locator('#pirate-service').evaluate(d=>d.scrollWidth<=d.clientWidth+2)).toBe(true);await capture(page,'service-phone');await page.locator('#pirate-service [data-close]').tap();
 await pose(6,-19.8);await page.keyboard.press('f');await expect(page.locator('#trading-dialog')).toBeVisible();const before=await page.evaluate(()=>window.starAgent.state.trading.markets['pirate-hush'].stock.ice);await page.locator('[data-controller-key="purchase-ice"]').tap();await expect(page.locator('.trade-feedback')).toContainText('Loaded 1 SBU');expect(await page.evaluate(()=>window.starAgent.state.trading.markets['pirate-hush'].stock.ice)).toBe(before-1);await page.locator('[data-controller-key="view-cargo"]').tap();await capture(page,'trade-phone');expect(await page.locator('#trading-dialog').evaluate(d=>d.scrollWidth<=d.clientWidth+2)).toBe(true);await page.locator('#trading-dialog [data-close]').tap();await page.waitForFunction(()=>window.starAgent.state.enabled);
 expect(errors).toEqual([]);await writeFile(`${out}/native-phone.json`,JSON.stringify({browser:browser.version(),graphics:await graphics(page),errors,warnings,controlledPose:true,physicalController:false},null,2));
});
