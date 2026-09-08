import {test,expect} from '@playwright/test';import {mkdir,writeFile} from 'node:fs/promises';
const out=process.env.PIRATE_EVIDENCE||'/tmp/star-agent-pirates-qa';
test('asset motion and weapon review',async({page,browser})=>{
 await mkdir(out,{recursive:true});const errors=[],warnings=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(`${m.text()} ${m.location().url}`);if(m.type()==='warning')warnings.push(m.text());});
 await page.goto('/dev/pirates.html');await page.waitForFunction(()=>window.pirateStudio?.state.ready);
 const receipts=[];
 for(const motion of ['idle','walk','run','crouch-idle','crouch-strafe-left','crouch-strafe-right','carry-walk','death']){
  await page.locator('#motion').selectOption(motion);await page.waitForTimeout(650);
  await page.screenshot({path:`${out}/${motion}.png`});receipts.push(await page.evaluate(()=>window.pirateStudio.state));
 }
 await page.locator('#motion').selectOption('aim-rifle');await page.locator('#armed').check();await page.waitForTimeout(650);await page.screenshot({path:`${out}/armed.png`});
 const backend=await page.evaluate(()=>{const gl=window.pirateStudio.renderer.getContext(),e=gl.getExtension('WEBGL_debug_renderer_info');return gl.getParameter(e.UNMASKED_RENDERER_WEBGL);});
 await writeFile(`${out}/asset-review.json`,JSON.stringify({browser:browser.version(),backend,receipts,errors,warnings},null,2));expect(errors).toEqual([]);expect(warnings).toEqual([]);
});
import {frames,pad,tap,state} from './fauna-controller-helpers.js';
async function choose(page,key){for(let i=0;i<100;i++){const focus=await page.evaluate(()=>document.activeElement?.dataset.controllerKey);if(focus===key){await tap(page,0);return;}if(focus?.startsWith('page-')&&await page.locator(`[data-controller-key="${focus}"]`).getAttribute('aria-disabled')!=='true'&&!(await page.locator(`[data-controller-key="${key}"]`).isVisible())){await tap(page,0);continue;}await tap(page,13);}throw Error(`Controller could not focus ${key}`);}
async function physicalWalk(page,target,shipLocal,stop){
 await page.evaluate(({target,shipLocal,stop})=>new Promise((resolve,reject)=>{
  const deadline=performance.now()+120000,n=window.starAgent.navigation;
  function step(){
   if(performance.now()>deadline){window.faunaPad.axes=[0,0,0,0];reject(Error('Physical walking timed out'));return;}
   const desired=shipLocal?n.fromShipLocal(n.position.clone().set(target[0],n.layout.eyeHeight,target[1])):n.position.clone().fromArray(target);
   const delta=desired.sub(n.position).projectOnPlane(n.normal),distance=delta.length();
   if(distance<=stop){window.faunaPad.axes=[0,0,0,0];resolve();return;}
   delta.normalize();const speed=Math.min(.8,Math.max(.17,(distance-stop)*.5));
   const forward=n.position.clone().set(0,0,-1).applyQuaternion(n.orientation).projectOnPlane(n.normal).normalize(),right=n.position.clone().set(1,0,0).applyQuaternion(n.orientation).projectOnPlane(n.normal).normalize();
   window.faunaPad.axes=[delta.dot(right)*speed,-delta.dot(forward)*speed,0,0];requestAnimationFrame(step);
  }step();
 }),{target,shipLocal,stop});await pad(page);
}
const walkLocal=(page,x,z,stop=.25)=>physicalWalk(page,[x,z],true,stop);
const walkWorld=(page,target,stop=1)=>physicalWalk(page,target,false,stop);
for(const site of ['aeon-pirates','selene-pirates'])test(`${site}: controller lands, fights, crouches, loots and returns`,async({page,browser},info)=>{
 const evidence=`${out}/${site}`;await mkdir(evidence,{recursive:true});const errors=[],warnings=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(`${m.text()} ${m.location().url}`);if(m.type()==='warning')warnings.push(m.text());});
 await page.addInitScript(()=>{window.faunaPad={id:'Pirate standard controller',index:0,connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};window.piratePadPresent=true;Object.defineProperty(navigator,'getGamepads',{value:()=>window.piratePadPresent?[window.faunaPad]:[]});});
 await page.route('**/api/auth/session',r=>r.fulfill({json:{account:null}}));
 try{
 await page.goto(`/?dev=1&ship=nomad&start=${site}&intro=0&debug&seed=7291&epoch=1788000000000`);
 await page.waitForFunction(()=>window.starAgent?.state.ready&&!window.starAgent.state.transiting&&window.starAgent.state.controller.armed,undefined,{timeout:120000});
 await page.waitForFunction(()=>window.starAgent.state.pirates.ready,undefined,{timeout:60000});console.log(site,'ready');
 await tap(page,9);await choose(page,'pirate-contracts');await expect(page.locator('#pirate-console')).toBeVisible();await page.screenshot({path:`${evidence}/contracts.png`});await choose(page,`pirate-visit-${site}`);await page.waitForFunction(()=>!window.starAgent.state.transiting&&window.starAgent.state.controller.armed&&window.starAgent.state.pirates.ready);
 await tap(page,3);await page.waitForFunction(()=>window.starAgent.state.mode==='landed',undefined,{timeout:90000});await tap(page,2);await page.waitForFunction(()=>window.starAgent.state.mode==='walk');
 await walkLocal(page,0,2.7);await tap(page,2);await page.waitForFunction(()=>window.starAgent.state.doorProgress===1);await walkLocal(page,0,13,.4);expect((await state(page)).insideShip).toBe(false);await walkLocal(page,12,13,.4);await walkLocal(page,12,-12,.4);
 for(let i=0;i<4&&(await state(page)).mining.tool.item!=='rifle-laser';i++)await tap(page,14);
 await pad(page,undefined,{4:1,5:1});await tap(page,15);await pad(page,undefined,{4:0,5:0});await tap(page,11);await page.waitForFunction(()=>window.starAgent.state.crouching);await page.screenshot({path:`${evidence}/player-crouch.png`});await pad(page,[-.7,0,0,0]);await frames(page,30);await pad(page);expect((await state(page)).crouching).toBe(true);await tap(page,11);await pad(page,undefined,{4:1,5:1});await tap(page,15);await pad(page,undefined,{4:0,5:0});
 console.log(site,'landed and crouch checked');const initial=await state(page);
 // Steer only injected sticks/trigger. Debug state supplies targeting feedback;
 // no pose, health, inventory or damage mutations are permitted in this route.
 await page.evaluate(()=>{window.piratePilot=setInterval(()=>{
  const n=window.starAgent.navigation,s=window.starAgent.state,pad=window.faunaPad;pad.axes=[0,0,0,0];pad.buttons[7]={pressed:false,value:0};
  if(!s.enabled||s.pirates.cleared)return;
  const alive=s.pirates.entities.filter(e=>e.health>0);let e=alive.sort((a,b)=>n.position.distanceTo(n.position.clone().fromArray(a.position))-n.position.distanceTo(n.position.clone().fromArray(b.position)))[0];if(!e)return;
  const up=n.position.clone().fromArray(e.normal),target=n.position.clone().fromArray(e.position).addScaledVector(up,e.crouching?1.15:1.25),delta=target.clone().sub(n.position),distance=delta.length(),local=delta.clone().applyQuaternion(n.orientation.clone().invert()),yaw=Math.atan2(local.x,-local.z),pitch=Math.atan2(local.y,Math.hypot(local.x,local.z)),axis=v=>Math.abs(v)<.003?0:Math.sign(v)*Math.min(.9,.13+Math.abs(v)*2.3);
  pad.axes[2]=axis(yaw);pad.axes[3]=axis(-pitch);
  const obstruction=n.pirateCoverRaycast(n.position,delta.clone().normalize(),distance),line=obstruction?false:Math.abs(yaw)<.014&&Math.abs(pitch)<.014;
  pad.buttons[7]={pressed:line&&s.pirates.damage>0,value:+(line&&s.pirates.damage>0)};
  if(distance>27&&Math.abs(yaw)<.2)pad.axes[1]=-.65;
  if(obstruction&&distance<36)pad.axes[0]=.65;
 },40);});
 await page.waitForFunction(()=>window.starAgent.state.pirates.playerHits>0,undefined,{timeout:60000});await page.screenshot({path:`${evidence}/fight.png`});
 await page.waitForFunction(()=>window.starAgent.state.pirates.cleared,undefined,{timeout:90000});await page.evaluate(()=>clearInterval(window.piratePilot));await pad(page,undefined,{7:0});
 console.log(site,'camp cleared');const cleared=await state(page);expect(cleared.pirates.shots).toBeGreaterThan(0);expect(cleared.pirates.damage).toBeGreaterThan(0);expect(cleared.pirates.kills).toBe(site==='aeon-pirates'?3:2);expect(cleared.loadout.slots.ammo1.quantity).toBeLessThan(initial.loadout.slots.ammo1.quantity);await page.screenshot({path:`${evidence}/cleared.png`});await tap(page,13);expect((await state(page)).loadout.bleeding).toBe(false);
 // Real modal/blur/disconnect/replacement gates: a held RT never spends a round.
 await tap(page,9);const ammo=(await state(page)).loadout.slots.ammo1.quantity;await pad(page,undefined,{7:1});await tap(page,1);await frames(page,14);expect((await state(page)).controller.armed).toBe(false);expect((await state(page)).loadout.slots.ammo1.quantity).toBe(ammo);await pad(page,undefined,{7:0});await page.waitForFunction(()=>window.starAgent.state.controller.armed);
 const other=await page.context().newPage(),gameCDP=await page.context().newCDPSession(page),otherCDP=await page.context().newCDPSession(other);
 await other.goto('about:blank');await gameCDP.send('Emulation.setFocusEmulationEnabled',{enabled:false});await otherCDP.send('Emulation.setFocusEmulationEnabled',{enabled:false});
 await other.bringToFront();await page.waitForFunction(()=>!document.hasFocus()&&!window.starAgent.state.focused);
 await page.evaluate(()=>{window.faunaPad.buttons[7]={pressed:true,value:1};});await page.bringToFront();await page.waitForFunction(()=>document.hasFocus()&&window.starAgent.state.focused);await frames(page,14);
 expect((await state(page)).controller.armed).toBe(false);expect((await state(page)).loadout.slots.ammo1.quantity).toBe(ammo);await pad(page,undefined,{7:0});
 await gameCDP.send('Emulation.setFocusEmulationEnabled',{enabled:true});await otherCDP.send('Emulation.setFocusEmulationEnabled',{enabled:true});await gameCDP.detach();await otherCDP.detach();await other.close();await page.waitForFunction(()=>window.starAgent.state.controller.armed);
 await page.evaluate(()=>window.piratePadPresent=false);await frames(page,8);await page.evaluate(()=>{window.piratePadPresent=true;window.faunaPad.id='Replacement pirate controller';window.faunaPad.buttons[7]={pressed:true,value:1};});await frames(page,12);expect((await state(page)).controller.armed).toBe(false);expect((await state(page)).loadout.slots.ammo1.quantity).toBe(ammo);await pad(page,undefined,{7:0});await page.waitForFunction(()=>window.starAgent.state.controller.armed);
 await page.evaluate(()=>{window.faunaPad.mapping='';window.faunaPad.buttons[7]={pressed:true,value:1};});await frames(page,12);expect((await state(page)).controller.armed).toBe(false);expect((await state(page)).loadout.slots.ammo1.quantity).toBe(ammo);
 await page.evaluate(()=>window.faunaPad.mapping='standard');await frames(page,8);expect((await state(page)).controller.armed).toBe(false);await pad(page,undefined,{7:0});await page.waitForFunction(()=>window.starAgent.state.controller.armed);
 const cache=cleared.pirates.site.cache;await walkWorld(page,cache,1.6);await tap(page,2);await expect(page.locator('#cargo-dialog')).toBeVisible();await page.screenshot({path:`${evidence}/loot-inventory.png`});
 const cacheId=`pirate-cache:${site}:v1`,beforeLoot=await state(page);
 const packBefore=beforeLoot.containers.containers.find(c=>c.id==='pack').items;
 for(const item of ['carbine-charge','healing-stim','bandage']){
  const slot=page.locator(`[data-from="${cacheId}"][data-item="${item}"]`);
  await choose(page,await slot.getAttribute('data-controller-key'));await choose(page,'transfer-stack');
 }
 const afterLoot=await state(page),packAfter=afterLoot.containers.containers.find(c=>c.id==='pack').items;
 expect(packAfter['carbine-charge']-packBefore['carbine-charge']).toBe(24);
 expect(packAfter['healing-stim']-packBefore['healing-stim']).toBe(1);
 expect(packAfter.bandage-packBefore.bandage).toBe(2);
 expect(Object.values(afterLoot.containers.containers.find(c=>c.id===cacheId).items).every(v=>v===0)).toBe(true);
 await page.screenshot({path:`${evidence}/loot-result.png`});await tap(page,1);await page.waitForFunction(()=>window.starAgent.state.controller.armed);
 // Return around the camp cover, then board via the same physical rear ramp.
 const n=await page.evaluate(()=>{const n=window.starAgent.navigation;return n.fromShipLocal(n.position.clone().set(12,n.layout.eyeHeight,13)).toArray();});await walkWorld(page,n,1.5);await walkLocal(page,0,13,.4);await walkLocal(page,0,7,.3);await walkLocal(page,0,2.7,.3);await walkLocal(page,0,-2.7,.3);await tap(page,2);await page.waitForFunction(()=>window.starAgent.state.mode==='landed');
 const backend=await page.evaluate(()=>{const gl=document.getElementById('viewport').getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');return gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);});const final=await state(page);await page.screenshot({path:`${evidence}/returned.png`});await writeFile(`${evidence}/journey.json`,JSON.stringify({browser:browser.version(),backend,input:'Injected standard Gamepad, physical-device test not performed',initial,cleared,afterLoot,final,errors,warnings},null,2));expect(errors).toEqual([]);expect(warnings).toEqual([]);
 }catch(error){await page.evaluate(()=>clearInterval(window.piratePilot)).catch(()=>{});await writeFile(`${evidence}/failure.json`,JSON.stringify({state:await state(page).catch(()=>null),errors,warnings,message:error.message},null,2));throw error;}
});

test('Lizzy arm and greeting review',async({page,browser})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(['error','warning'].includes(m.type()))errors.push(m.text());});
 await mkdir(`${out}/lizzy`,{recursive:true});await page.goto('/dev/pirates.html?guide=1');await page.waitForFunction(()=>window.pirateStudio?.state.ready);
 for(const clip of ['idle','walk','run','wave']){await page.locator('#motion').selectOption(clip);await page.waitForTimeout(700);await page.screenshot({path:`${out}/lizzy/${clip}.png`});}
 const backend=await page.evaluate(()=>{const gl=window.pirateStudio.renderer.getContext(),e=gl.getExtension('WEBGL_debug_renderer_info');return gl.getParameter(e.UNMASKED_RENDERER_WEBGL);});await writeFile(`${out}/lizzy/review.json`,JSON.stringify({browser:browser.version(),backend,errors},null,2));expect(errors).toEqual([]);
});
