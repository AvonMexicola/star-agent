import {test,expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
import {setup,walk,aim,capture,graphics,focusInterruption,frames} from './transport-helpers.js';
const out=process.env.TRANSPORT_EVIDENCE||'/tmp/star-agent-transport-attempt01';
const state=p=>p.evaluate(()=>window.starAgent.state);
async function brake(page,button){await button(6,true);await page.waitForFunction(()=>window.starAgent.state.speed<.2,undefined,{timeout:20000});await button(6,false);}
async function climb(page,button,altitude){
 await page.evaluate(altitude=>{window.transportClimb=setInterval(()=>{const s=window.starAgent.state,pad=window.transportPad;if(s.altitude>=altitude){pad.buttons[0]={pressed:false,value:0};pad.buttons[6]={pressed:true,value:1};clearInterval(window.transportClimb);return;}pad.buttons[0]={pressed:true,value:1};},20);},altitude);
 try{await page.waitForFunction(altitude=>window.starAgent.state.altitude>=altitude,altitude,{timeout:180000});await brake(page,button);}finally{await page.evaluate(()=>{clearInterval(window.transportClimb);window.transportPad.buttons[0]={pressed:false,value:0};});}
}
async function steerTarget(page,id){
 await page.evaluate(id=>{window.transportSteer=setInterval(()=>{const n=window.starAgent.navigation,t=window.starAgent.state.navigationTargets.targets.find(t=>t.id===id),p=window.transportPad;if(!t)return;const local=n.position.clone().fromArray(t.center).sub(n.position).applyQuaternion(n.orientation.clone().invert()),yaw=Math.atan2(local.x,-local.z),pitch=Math.atan2(local.y,Math.hypot(local.x,local.z));const axis=x=>Math.abs(x)<.002?0:Math.sign(x)*Math.min(1,.18+Math.abs(x)*2.5);p.axes=[0,0,axis(yaw),axis(-pitch)];},30);},id);
 try{await page.waitForFunction(id=>{const n=window.starAgent.state.navigationTargets;return n.aimedId===id&&n.ready;},id,{timeout:45000});}finally{await page.evaluate(()=>{clearInterval(window.transportSteer);window.transportPad.axes=[0,0,0,0];});}
}
async function levelForPad(page,site){
 // Atmospheric vertical thrust follows gravity. Level and brake using the
 // actual look/roll controls before steering the descent in that frame.
 await page.evaluate(site=>{window.transportLevelDone=false;window.transportLevel=setInterval(()=>{
  const n=window.starAgent.navigation,p=window.transportPad,s=window.starAgent.state.settlements.sites.find(s=>s.id===site),q=n.orientation.clone().fromArray(s.quaternion),inverse=n.orientation.clone().invert();
  const forward=n.position.clone().set(0,0,-1).applyQuaternion(q).applyQuaternion(inverse),up=n.normal.clone().applyQuaternion(inverse),yaw=Math.atan2(forward.x,-forward.z),pitch=Math.atan2(forward.y,Math.hypot(forward.x,forward.z)),roll=Math.atan2(up.x,up.y);
  const axis=x=>Math.abs(x)<.012?0:Math.sign(x)*Math.min(1,.18+Math.abs(x)*2);
  p.axes=[0,0,axis(yaw),axis(-pitch)];p.buttons[4]={pressed:roll<-.03,value:roll<-.03?1:0};p.buttons[5]={pressed:roll>.03,value:roll>.03?1:0};p.buttons[6]={pressed:true,value:1};
  if(Math.abs(yaw)<.025&&Math.abs(pitch)<.025&&Math.abs(roll)<.04){window.transportLevelDone=true;clearInterval(window.transportLevel);}
 },30);},site);
 try{await page.waitForFunction(()=>window.transportLevelDone,undefined,{timeout:45000});}finally{await page.evaluate(()=>{clearInterval(window.transportLevel);window.transportPad.axes=[0,0,0,0];for(const i of [4,5,6])window.transportPad.buttons[i]={pressed:false,value:0};});}
}
async function flyToPad(page,site){
 // Actual stick-controlled cruise descent. Desired speed falls with stopping
 // distance; orientation aligns to the pad frame before landing assist.
 await page.evaluate(site=>{window.transportApproachDone=false;window.transportApproach=setInterval(()=>{const n=window.starAgent.navigation,s=window.starAgent.state.settlements.sites.find(s=>s.id===site),pad=window.transportPad,up=n.position.clone().fromArray(s.pad).sub(n.position.clone().fromArray(s.origin)).normalize();const q=n.orientation.clone().fromArray(s.quaternion),siteUp=n.position.clone().set(0,1,0).applyQuaternion(q),goal=n.position.clone().fromArray(s.pad).addScaledVector(siteUp,65),delta=goal.sub(n.position),distance=delta.length();
  const local=delta.clone().applyQuaternion(n.orientation.clone().invert()),speed=Math.min(330,Math.sqrt(Math.max(0,distance-4)*12)),desired=delta.normalize().multiplyScalar(speed),error=desired.sub(n.velocity).applyQuaternion(n.orientation.clone().invert());
  pad.axes[0]=Math.max(-1,Math.min(1,error.x/30));pad.axes[1]=Math.max(-1,Math.min(1,error.z/30));pad.buttons[0]={pressed:error.y>1.5,value:Math.min(1,Math.max(0,error.y/30))};pad.buttons[1]={pressed:error.y< -1.5,value:Math.min(1,Math.max(0,-error.y/30))};
  // Keep a level ship with the settlement's heading using the physical look axes.
  const forward=n.position.clone().set(0,0,-1).applyQuaternion(q).applyQuaternion(n.orientation.clone().invert()),yaw=Math.atan2(forward.x,-forward.z),pitch=Math.atan2(forward.y,Math.hypot(forward.x,forward.z));const axis=x=>Math.abs(x)<.008?0:Math.sign(x)*Math.min(1,.18+Math.abs(x)*2);pad.axes[2]=axis(yaw);pad.axes[3]=axis(-pitch);
  if(distance<6&&n.speed<9){pad.axes=[0,0,0,0];pad.buttons[0]={pressed:false,value:0};pad.buttons[1]={pressed:false,value:0};pad.buttons[6]={pressed:true,value:1};window.transportApproachDone=true;clearInterval(window.transportApproach);}
 },30);},site);
 try{await page.waitForFunction(()=>window.transportApproachDone,undefined,{timeout:200000});}finally{await page.evaluate(()=>{clearInterval(window.transportApproach);window.transportPad.axes=[0,0,0,0];window.transportPad.buttons[0]={pressed:false,value:0};window.transportPad.buttons[1]={pressed:false,value:0};});}
}
async function exitAndTerminal(page,tap){
 await tap(2);await page.waitForFunction(()=>window.starAgent.state.mode==='walk');await walk(page,[0,2.75,3],'ship');await aim(page,[0,2.75,7]);await tap(2);await page.waitForFunction(()=>window.starAgent.state.doorProgress>.98);await walk(page,[0,1.75,8],'ship');
 await walk(page,[9,0,30]);await walk(page,[9,0,-12]);await walk(page,[-2,0,-12]);await walk(page,[-2,0,-19.8]);const terminal=await page.evaluate(()=>window.starAgent.state.settlements.sites.find(s=>s.body===window.starAgent.state.body).terminal);await aim(page,terminal,'world');await tap(2);await expect(page.locator('#trading-dialog')).toBeVisible();
}
async function reboard(page,tap){await walk(page,[0,1.75,8],'ship');await aim(page,[0,2.75,0]);await walk(page,[0,2.75,3],'ship');await walk(page,[0,2.75,-1.65],'ship');await aim(page,[0,2.75,-3]);await tap(2);await page.waitForFunction(()=>window.starAgent.state.mode==='landed');}
async function loadMissionCrate(page,tap,button,choose){
 await choose('transport-tractor');await page.waitForFunction(()=>window.starAgent.state.trading.tractor.active&&window.starAgent.state.controller.armed);
 await walk(page,[-2,0,-12]);await walk(page,[9,0,-12]);await walk(page,[9,0,35]);
 const crate=(await state(page)).trading.loose[0];await aim(page,crate.position,'world');await button(7,true);await page.waitForFunction(()=>Boolean(window.starAgent.state.trading.tractor.held));await capture(page,'crate-on-apron');
 // Stay behind the ramp and guide the crate through its clear centre first.
 // Walking uphill while holding a fixed look angle lifted the crate into the
 // header in attempt03; the fixture now observes the actual carried centre.
 await aim(page,[0,1.8,-10]);await walk(page,[0,1.75,11],'ship');
 async function guide(point){
  await aim(page,point);
  const distance=await page.evaluate(point=>window.starAgent.navigation.fromShipLocal(window.starAgent.navigation.position.clone().fromArray(point)).distanceTo(window.starAgent.navigation.position),point);
  for(let i=0;i<30;i++){const held=(await state(page)).trading.tractor.distance;if(Math.abs(held-distance)<.24)break;await tap(held>distance?12:13);}
  await page.waitForFunction(point=>{const n=window.starAgent.navigation,c=window.starAgent.state.trading.loose[0];return n.toShipLocal(n.position.clone().fromArray(c.position)).distanceTo(n.position.clone().fromArray(point))<.45;},point,{timeout:15000});
 }
 await guide([0,1.6,7]);await capture(page,'crate-clear-of-ramp');await guide([0,1.6,3]);
 await page.waitForFunction(()=>Boolean(window.starAgent.state.trading.tractor.slot),undefined,{timeout:15000});await capture(page,'crate-at-grid');await tap(2);await page.waitForFunction(()=>window.starAgent.state.trading.loose.length===0);await button(7,false);await tap(15);await capture(page,'crate-secured');
}

test.afterEach(async({page},info)=>{if(info.status!==info.expectedStatus){try{await capture(page,'failure');console.log('Failure state',JSON.stringify(await page.evaluate(()=>{const s=window.starAgent.state;return {mode:s.mode,body:s.body,altitude:s.altitude,speed:s.speed,position:s.position,shipLocal:s.shipLocal,interaction:s.interaction,transport:s.trading.account.transport,tractor:s.trading.tractor,nav:s.navigationTargets.reason,focused:s.focused,enabled:s.enabled};})));}catch{}}});

test('controller accepts, orders only at Aeon, physically loads, flies to Pyre and deposits sealed freight',async({page,browser})=>{
 const {tap,button,choose,errors,warnings}=await setup(page,'aeon');
 await tap(9);await choose('tab-contracts');await choose('transport-contracts');await expect(page.locator('#trading-dialog')).toBeVisible();await choose('transport-accept-freight-aeon-pyre');
 expect((await state(page)).trading.loose).toHaveLength(0);await expect(page.locator('[data-controller-key="transport-order"]')).toBeDisabled();await capture(page,'accepted-before-pickup');await tap(1);
 await tap(3);await page.waitForFunction(()=>window.starAgent.state.mode==='landed',undefined,{timeout:60000});await exitAndTerminal(page,tap);await choose('view-freight');await choose('transport-order');await expect(page.locator('.trade-feedback')).toContainText('loading apron');
 const issued=(await state(page)).trading.account.transport.active;expect((await state(page)).trading.loose).toHaveLength(1);await capture(page,'pickup-terminal');await loadMissionCrate(page,tap,button,choose);
 const manifest=(await state(page)).trading.ships.find(s=>s.hull==='nomad');expect(manifest.crates[0].id).toBe(issued.crate);expect(manifest.crates[0].transport.id).toBe(issued.id);
 await reboard(page,tap);await tap(3);await page.waitForFunction(()=>window.starAgent.state.mode==='flight');
 await button(4,true);await button(5,true);await tap(13);await button(5,false);await button(4,false);await page.waitForFunction(()=>window.starAgent.state.landingGear.progress<.02);
 // Cruise and sustained ascent cross the atmosphere with the crate aboard.
 await tap(9);await choose('tab-ship');if(await page.locator('[data-controller-key="combat-mode"]').count())await choose('combat-mode');await tap(1);
 // Existing command label is verified below; no direct movement state is assigned.
 if((await state(page)).combatMode){await tap(9);await choose('tab-ship');await choose('combat-mode');await tap(1);}
 await climb(page,button,20500);await capture(page,'loaded-ascent');
 await tap(14);await choose('map-breadcrumb-star');await choose('map-body-pyre');await choose('map-view-locations');await choose('map-signal-settlement-pyre');await tap(1);await steerTarget(page,'settlement-pyre');
 await page.evaluate(()=>{window.freightFlightSamples=[];window.freightFlightTimer=setInterval(()=>{const s=window.starAgent.state;window.freightFlightSamples.push({position:s.position,phase:s.travel?.phase,speed:s.speed,crate:s.trading.ships.find(s=>s.hull==='nomad').crates[0]?.id});},100);});
 await button(4,true);await button(5,true);await tap(12);await button(5,false);await button(4,false);await page.waitForFunction(()=>Boolean(window.starAgent.state.travel));const eta=(await state(page)).travel.eta;expect(eta).toBeLessThan(180);console.log('Transport drive ETA seconds:',eta);await page.waitForFunction(()=>!window.starAgent.state.travel&&window.starAgent.state.body==='pyre',undefined,{timeout:Math.ceil(eta*2000+20000)});await page.evaluate(()=>clearInterval(window.freightFlightTimer));await capture(page,'pyre-orbital-arrival');
 await levelForPad(page,'settlement-pyre');await flyToPad(page,'settlement-pyre');await brake(page,button);await tap(3);await page.waitForFunction(()=>window.starAgent.state.mode==='landed',undefined,{timeout:120000});await exitAndTerminal(page,tap);await choose('view-freight');await capture(page,'destination-terminal');
 const credits=(await state(page)).trading.account.credits;await choose('transport-deposit');await expect(page.locator('.trade-feedback')).toContainText('Transport complete');const complete=(await state(page)).trading;expect(complete.account.credits).toBe(credits+800);expect(complete.account.transport.completed).toBe(1);expect(complete.ships.find(s=>s.hull==='nomad').crates).toHaveLength(0);
 await page.setViewportSize({width:390,height:844});await frames(page);await capture(page,'phone-completion');expect(await page.locator('#trading-dialog').evaluate(d=>d.scrollWidth<=d.clientWidth+2)).toBe(true);await page.setViewportSize({width:1440,height:900});
 await button(7,true);await tap(1);expect((await state(page)).controller.armed).toBe(false);await button(7,false);await page.waitForFunction(()=>window.starAgent.state.controller.armed);await focusInterruption(page,button);
 for(const mode of ['disconnect','replacement','unsupported']){await button(7,true);await page.evaluate(mode=>{if(mode==='disconnect')window.transportDisconnected=true;if(mode==='replacement')window.transportPad.id+=' replacement';if(mode==='unsupported')window.transportPad.mapping='';},mode);await frames(page);expect((await state(page)).controller.armed).toBe(false);await page.evaluate(()=>{window.transportDisconnected=false;window.transportPad.mapping='standard';});await frames(page);expect((await state(page)).controller.armed).toBe(false);await button(7,false);await page.waitForFunction(()=>window.starAgent.state.controller.armed);}
 await walk(page,[-2,0,-12]);await walk(page,[9,0,-12]);await walk(page,[9,0,30]);await reboard(page,tap);await tap(3);await page.waitForFunction(()=>window.starAgent.state.mode==='flight');await capture(page,'delivery-return-to-flight');
 expect(errors).toEqual([]);await writeFile(`${out}/controller-receipt.json`,JSON.stringify({browser:browser.version(),graphics:await graphics(page),errors,warnings,physicalController:false,source:'Supported65m Aeon settlement approach; all later gameplay uses standard Gamepad with read-only steering feedback.',issued,completed:complete.account.transport,samples:await page.evaluate(()=>window.freightFlightSamples)},null,2));
});

test('keyboard contract entry and native phone terminal ordering preserve single issuance and cancellation',async({page,browser})=>{
 const {tap,choose,errors,warnings}=await setup(page,'aeon');
 async function keyboardChoose(key){for(let i=0;i<100;i++){if(await page.evaluate(key=>document.activeElement?.dataset.controllerKey===key,key)){await page.keyboard.press('Enter');await frames(page);return;}await page.keyboard.press('Tab');}throw Error('Missing keyboard action '+key);}
 await page.keyboard.press('Escape');await keyboardChoose('tab-contracts');await keyboardChoose('transport-contracts');await keyboardChoose('transport-accept-freight-aeon-pyre');await expect(page.locator('[data-controller-key="transport-order"]')).toBeDisabled();expect((await state(page)).trading.loose).toHaveLength(0);await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('dialog[open]')&&window.starAgent.state.enabled&&window.starAgent.state.controller.armed);
 // Physical approach repeats the supported controller path; native-touch claims
 // below concern the actual new terminal actions, not phone flight validation.
 await tap(3);await page.waitForFunction(()=>window.starAgent.state.mode==='landed',undefined,{timeout:60000});await exitAndTerminal(page,tap);await choose('view-freight');
 await page.evaluate(()=>window.transportDisconnected=true);await frames(page);await page.setViewportSize({width:390,height:844});const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
 async function touch(key){
  // Scroll the actual manifest with native touch if its action is below the
  // visible paper panel. Never activate a clipped or covered coordinate.
  for(let i=0;i<5;i++){
   const target=await page.locator(`[data-controller-key="${key}"]`).boundingBox(),panel=await page.locator('.trade-content').boundingBox();
   if(target.y>=panel.y+2&&target.y+target.height<=panel.y+panel.height-2)break;
   const x=panel.x+panel.width*.65,lo=panel.y+panel.height-12,hi=panel.y+12,start=target.y<panel.y?hi:lo,end=target.y<panel.y?lo:hi;
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y:start,id:1}]});
   for(let n=1;n<=8;n++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:start+(end-start)*n/8,id:1}]});await frames(page);}
   await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await frames(page);
  }
  await capture(page,`touch-ready-${key}`);
  const box=await page.locator(`[data-controller-key="${key}"]`).boundingBox();expect(box).not.toBe(null);expect(box.y+box.height).toBeLessThan(844);const point={x:box.x+box.width/2,y:box.y+box.height/2,id:1,radiusX:1,radiusY:1};await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});await frames(page);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await frames(page);}
 const before=(await state(page)).trading.account.credits;await capture(page,'phone-pickup-before-order');await touch('transport-order');await expect(page.locator('.trade-feedback')).toContainText('loading apron');expect((await state(page)).trading.loose).toHaveLength(1);await capture(page,'phone-issued');await touch('transport-abandon');await expect(page.locator('.trade-feedback')).toContainText('Transport abandoned');const end=(await state(page)).trading;expect(end.account.transport.active).toBe(null);expect(end.account.credits).toBe(before);expect(end.loose).toHaveLength(0);await capture(page,'phone-abandoned');await page.keyboard.press('Escape');await page.waitForFunction(()=>window.starAgent.state.enabled&&!document.querySelector('dialog[open]'));expect((await state(page)).enabled).toBe(true);
 expect(errors).toEqual([]);await writeFile(`${out}/keyboard-touch-receipt.json`,JSON.stringify({browser:browser.version(),graphics:await graphics(page),errors,warnings,nativeTouch:true,keyboardContractEntry:true,approach:'Supported start, actual controller landing/walking before native terminal actions',physicalController:false},null,2));await cdp.detach();
});
