import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const output=process.env.COMBAT_EVIDENCE||'/tmp/star-agent-combat-evidence';
for(const ship of ['nomad','kestrel'])test(`${ship}: controller patrol console, physical flight, targeting, engagement and combat report`,async({page,browser})=>{
 const evidence=`${output}/${ship}`;await mkdir(evidence,{recursive:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.addInitScript(()=>{
  window.combatPad={id:'Combat test standard controller',index:0,connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};
  Object.defineProperty(navigator,'getGamepads',{value:()=>[window.combatPad]});
 });
 const frames=()=>page.evaluate(async()=>{for(let i=0;i<4;i++)await new Promise(r=>requestAnimationFrame(r));});
 const button=async(i,down)=>{await page.evaluate(({i,down})=>window.combatPad.buttons[i]={pressed:down,value:+down},{i,down});await frames();};
 const tap=async i=>{await button(i,true);await button(i,false);};
 async function choose(key){
  const tab=key==='patrol-console'?'contracts':key==='combat-target'||key.startsWith('weapon-')?'ship':key==='controller-layout'?'settings':null;
  if(tab&&await page.locator('dialog[open].gameplay-screen').count()){
   for(let i=0;i<8&&await page.locator('dialog[open]').getAttribute('data-gameplay-tab')!==tab;i++)await tap(5);
   if(key==='patrol-console')return;
  }
  for(let i=0;i<70;i++){if(await page.evaluate(key=>document.activeElement?.dataset.controllerKey===key,key)){await tap(0);return;}await tap(13);}
  throw Error(`Controller could not find ${key}`);
 }
 await page.route('**/api/auth/session',route=>route.fulfill({json:{account:null}}));
 await page.goto(`/?dev=1&ship=${ship}&start=orbit&intro=0&debug&seed=7291`);await page.waitForFunction(()=>window.starAgent?.state.ready&&window.starAgent.state.controller.armed&&window.starAgent.state.mode==='flight'&&!window.starAgent.state.transiting,{},{timeout:90000});
 // The complete controller-only help route returns safely to flight.
 await tap(9);await choose('controller-layout');await frames();
 await expect(page.locator('#controller-layout')).toBeVisible();
 await expect(page.locator('#controller-layout')).toHaveAttribute('data-context','flight');
 expect(await page.locator('#controller-layout').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
 await page.screenshot({path:`${evidence}/controller-layout.png`});
 for(const context of ['walk','eva','shortcuts','flight']){
  await choose(`layout-${context}`);await expect(page.locator('#controller-layout')).toHaveAttribute('data-context',context);
 }
 await tap(1);await page.waitForFunction(()=>window.starAgent.state.controller.armed);
 // A supplies vertical thrust, B supplies downward thrust, LT brakes, RT never thrusts.
 for(const [i,sign] of [[0,1],[1,-1]]){
  await button(i,true);await page.waitForFunction(sign=>{const n=window.starAgent.navigation;return n.velocity.clone().applyQuaternion(n.orientation.clone().invert()).y*sign>1;},sign);
  expect(await page.evaluate(()=>window.starAgent.state.effects.controllerFire)).toBe(false);
  await button(i,false);await tap(6);
 }
 await button(7,true);await frames();expect(await page.evaluate(()=>window.starAgent.state.speed)).toBeLessThan(.1);await button(7,false);
 await tap(9);await choose('patrol-console');await expect(page.locator('#patrol-console')).toBeVisible();await frames();await tap(0);
 await page.waitForFunction(()=>window.starAgent.state.combat.phase==='transit');
 await page.screenshot({path:`${evidence}/console.png`});
 await tap(1);await page.waitForFunction(()=>window.starAgent.state.controller.armed);
 // Navigate the accepted waypoint only by the flight stick; no pose/teleport calls.
 await page.evaluate(()=>{window.combatPad.axes[1]=-.65;});await page.waitForFunction(()=>window.starAgent.state.combat.phase==='engage',{},{timeout:45000}).catch(async e=>{console.log('Arrival state',await page.evaluate(()=>({combat:window.starAgent.state.combat,position:window.starAgent.state.position,speed:window.starAgent.state.speed,enabled:window.starAgent.state.enabled,controller:window.starAgent.state.controller,mode:window.starAgent.state.mode,keys:[...window.starAgent.navigation.keys],focused:window.starAgent.state.focused,transiting:window.starAgent.state.transiting})));throw e;});
 await page.evaluate(()=>{window.combatPad.axes[1]=0;});await button(6,true);await button(6,false);
 await page.waitForFunction(()=>window.starAgent.state.combat.models===2);
 await page.screenshot({path:`${evidence}/arrival.png`});
 // Switch target through the real command menu, then select the hitscan ship gun.
 const first=await page.evaluate(()=>window.starAgent.state.combat.targetId);
 await tap(9);await choose('combat-target');expect(await page.evaluate(()=>window.starAgent.state.combat.targetId)).not.toBe(first);
 await page.waitForFunction(()=>window.starAgent.state.controller.armed);await tap(9);await choose('weapon-laser');await page.waitForFunction(()=>window.starAgent.state.controller.armed);
 // Hold fire through modal close and all input interruptions. No stale shot may replay.
 await tap(9);await button(7,true);await button(1,true);await button(1,false);await frames();
 let shots=await page.evaluate(()=>window.starAgent.state.combat.shots);await frames();expect(await page.evaluate(()=>window.starAgent.state.combat.shots)).toBe(shots);
 await button(7,false);await page.waitForFunction(()=>window.starAgent.state.controller.armed);
 for(const kind of ['focus','disconnect','replacement','unsupported']){
  await button(7,true);
  await page.evaluate(kind=>{const p=window.combatPad;if(kind==='focus')window.dispatchEvent(new Event('blur'));if(kind==='disconnect')p.connected=false;if(kind==='replacement')p.id+=' replacement';if(kind==='unsupported')p.mapping='';},kind);await frames();
  shots=await page.evaluate(()=>window.starAgent.state.combat.shots);
  await page.evaluate(()=>{window.combatPad.connected=true;window.combatPad.mapping='standard';window.dispatchEvent(new Event('focus'));});await frames();await frames();
  expect(await page.evaluate(()=>window.starAgent.state.combat.shots)).toBe(shots);
  await button(7,false);await page.waitForFunction(()=>window.starAgent.state.controller.armed);
 }
 // Read-only pose feedback steers injected right-stick axes; RT is the sole firing route.
 await page.evaluate(()=>{
  window.combatPilot=setInterval(()=>{
   const s=window.starAgent.state,n=window.starAgent.navigation,pad=window.combatPad,t=s.combat.enemies.find(e=>e.id===s.combat.targetId&&e.hull>0);
   if(!t||s.combat.phase!=='engage'){pad.axes=[0,0,0,0];pad.buttons[7]={pressed:false,value:0};return;}
   const local=n.position.clone().fromArray(t.position).sub(n.position).applyQuaternion(n.orientation.clone().invert());
   const yaw=Math.atan2(local.x,-local.z),pitch=Math.atan2(local.y,Math.hypot(local.x,local.z));
   const command=value=>Math.abs(value)<.003?0:Math.sign(value)*Math.min(1,.18+Math.abs(value)*2.5);
   pad.axes[2]=command(yaw);pad.axes[3]=command(-pitch);
   const fire=Math.abs(yaw)<.045&&Math.abs(pitch)<.045;pad.buttons[7]={pressed:fire,value:+fire};
  },35);
 });
 await page.waitForFunction(()=>window.starAgent.state.combat.hits>0,undefined,{timeout:60000});
 await page.screenshot({path:`${evidence}/engagement.png`});
 await writeFile(`${evidence}/engagement.json`,JSON.stringify(await page.evaluate(()=>{const s=window.starAgent.state;return {combat:s.combat,drawCalls:s.drawCalls,triangles:s.triangles,fps:s.fps,renderResolution:s.renderResolution};}),null,2));
 await page.waitForFunction(()=>['complete','failed'].includes(window.starAgent.state.combat.phase),undefined,{timeout:120000});
 await page.evaluate(()=>{clearInterval(window.combatPilot);window.combatPad.axes=[0,0,0,0];window.combatPad.buttons[7]={pressed:false,value:0};});await frames();
 expect(await page.evaluate(()=>window.starAgent.state.combat.phase)).toBe('complete');
 await page.waitForFunction(()=>window.starAgent.state.controller.armed);await tap(9);await choose('patrol-console');await choose('patrol-debrief');
 expect(await page.evaluate(()=>window.starAgent.state.combat.completed)).toBe(1);await expect(page.locator('.patrol-log')).toContainText('2 / 2');
 await page.screenshot({path:`${evidence}/report.png`});await tap(1);await page.waitForFunction(()=>window.starAgent.state.enabled&&window.starAgent.state.controller.armed);
 const state=await page.evaluate(()=>window.starAgent.state);expect(state.shipId).toBe(ship);expect(state.combat.incomingHits).toBeGreaterThan(0);
 const backend=await page.evaluate(()=>{const gl=document.querySelector('#viewport').getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');return ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'unavailable';});
 await writeFile(`${evidence}/controller.json`,JSON.stringify({browser:browser.version(),backend,viewport:[1440,900],state,errors,physicalController:false},null,2));expect(errors).toEqual([]);
});

test('keyboard and pointer fire, authored NPC close-ups, loss and recovery',async({page})=>{
 await page.addInitScript(()=>Object.defineProperty(navigator,'getGamepads',{value:()=>[]}));
 await mkdir(`${output}/inspection`,{recursive:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/auth/session',route=>route.fulfill({json:{account:null}}));
 await page.goto('/?dev=1&ship=kestrel&start=orbit&intro=0&debug&seed=7291');await page.waitForFunction(()=>window.starAgent?.state.ready&&window.starAgent.state.enabled&&window.starAgent.state.mode==='flight'&&!window.starAgent.state.transiting,{},{timeout:90000});
 await page.locator('#patrol-console-button').click();await page.getByRole('button',{name:'Accept patrol',exact:true}).click();await page.waitForFunction(()=>window.starAgent.state.combat.phase==='transit');await page.getByRole('button',{name:'Close patrol console',exact:true}).click();
 await page.waitForFunction(()=>window.starAgent.state.enabled&&document.activeElement?.id==='viewport');
 await page.evaluate(async()=>{for(let i=0;i<3;i++)await new Promise(r=>requestAnimationFrame(r));});
 await page.keyboard.down('w');await page.waitForFunction(()=>window.starAgent.state.combat.phase==='engage',{},{timeout:45000}).catch(async e=>{console.log('Arrival state',await page.evaluate(()=>({combat:window.starAgent.state.combat,position:window.starAgent.state.position,speed:window.starAgent.state.speed,enabled:window.starAgent.state.enabled,controller:window.starAgent.state.controller,mode:window.starAgent.state.mode,keys:[...window.starAgent.navigation.keys],focused:window.starAgent.state.focused,transiting:window.starAgent.state.transiting})));throw e;});await page.keyboard.up('w');await page.keyboard.press('x');
 await page.keyboard.down('t');await page.waitForFunction(()=>window.starAgent.state.combat.shots>1);await page.keyboard.up('t');
 const shots=await page.evaluate(()=>window.starAgent.state.combat.shots);
 await page.locator('.ship-trigger').hover();await page.mouse.down();await page.waitForFunction(shots=>window.starAgent.state.combat.shots>shots,shots);await page.mouse.up();
 const target=await page.evaluate(()=>window.starAgent.state.combat.targetId);await page.keyboard.press('Tab');expect(await page.evaluate(()=>window.starAgent.state.combat.targetId)).not.toBe(target);
 // Separate controlled visual inspection. These pose changes are NOT controller journey evidence.
 for(const ship of ['nomad','kestrel']){
  await page.evaluate(ship=>{
   const n=window.starAgent.navigation,e=window.starAgent.state.combat.enemies.find(e=>e.ship===ship);
   const target=n.position.clone().fromArray(e.position),q=n.orientation.clone().fromArray(e.orientation);
   n.position.copy(target).add(n.velocity.clone().set(20,12,-27).applyQuaternion(q));n.velocity.set(0,0,0);n.angularVelocity.set(0,0,0);n.orientToward(target,n.normal.clone().set(0,1,0).applyQuaternion(q));n.enabled=false;
  },ship);
  await page.waitForTimeout(300);await page.screenshot({path:`${output}/inspection/${ship}-npc.png`});
 }
 await page.evaluate(()=>{window.starAgent.navigation.enabled=true;});
 await page.waitForFunction(()=>window.starAgent.state.combat.phase==='failed',undefined,{timeout:120000});
 expect(await page.evaluate(()=>window.starAgent.state.combat.player.hull)).toBe(0);await page.screenshot({path:`${output}/inspection/loss.png`});
 await page.keyboard.press('Enter');await page.waitForFunction(()=>window.starAgent.state.mode==='flight'&&window.starAgent.state.combat.player.hull>0);
 expect(await page.evaluate(()=>window.starAgent.state.combat.enemies.length)).toBe(0);expect(await page.evaluate(()=>window.starAgent.state.combat.phase)).toBe('idle');
 await page.keyboard.press('h');await page.locator('#controller-layout-help').click();
 await expect(page.locator('#controller-layout')).toBeVisible();
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:`${output}/inspection/phone-layout.png`});
 expect(await page.locator('#controller-layout').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
 await page.getByRole('button',{name:'EVA',exact:true}).click();await expect(page.locator('#controller-layout')).toHaveAttribute('data-context','eva');
 await page.keyboard.press('Escape');await page.waitForFunction(()=>window.starAgent.state.enabled);
 await page.locator('#patrol-console-button').click();await page.screenshot({path:`${output}/inspection/phone-console.png`});
 expect(await page.locator('#patrol-console').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
 await page.getByRole('button',{name:'Close patrol console',exact:true}).click();expect(errors).toEqual([]);
});

test('controller layout fits desktop and phone, scrolls and returns safely to play',async({page,browser})=>{
 const dir=`${output}/layout`;await mkdir(dir,{recursive:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.addInitScript(()=>{
  window.layoutPad={id:'Standard layout test',index:0,connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};
  Object.defineProperty(navigator,'getGamepads',{value:()=>[window.layoutPad]});
 });
 const frames=()=>page.evaluate(async()=>{for(let i=0;i<4;i++)await new Promise(r=>requestAnimationFrame(r));});
 const button=async(i,down)=>{await page.evaluate(({i,down})=>window.layoutPad.buttons[i]={pressed:down,value:+down},{i,down});await frames();};
 const tap=async i=>{await button(i,true);await button(i,false);};
 async function choose(key){if(key==='controller-layout'&&await page.locator('dialog[open].gameplay-screen').count()){for(let i=0;i<8&&await page.locator('dialog[open]').getAttribute('data-gameplay-tab')!=='settings';i++)await tap(5);}for(let i=0;i<70;i++){if(await page.evaluate(key=>document.activeElement?.dataset.controllerKey===key,key)){await tap(0);return;}await tap(13);}throw Error(`Missing ${key}`);}
 await page.route('**/api/auth/session',r=>r.fulfill({json:{account:null}}));
 await page.goto('/?dev=1&ship=nomad&start=orbit&intro=0&debug');await page.waitForFunction(()=>window.starAgent?.state.ready&&window.starAgent.state.controller.armed,undefined,{timeout:90000});
 await tap(9);await expect(page.locator('.combat-hint')).toContainText('RT · Fire');await choose('controller-layout');await expect(page.locator('#controller-layout')).toBeVisible();
 const position=await page.evaluate(()=>window.starAgent.state.position);
 for(const mode of ['flight','walk','eva','shortcuts']){
  await choose(`layout-${mode}`);expect(await page.locator('#controller-layout').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
  await page.screenshot({path:`${dir}/desktop-${mode}.png`});
 }
 expect(await page.evaluate(()=>window.starAgent.state.position)).toEqual(position);
 await button(7,true);await tap(1);await frames();expect(await page.evaluate(()=>window.starAgent.state.controller.armed)).toBe(false);expect(await page.evaluate(()=>window.starAgent.state.effects.controllerFire)).toBe(false);
 await button(7,false);await page.waitForFunction(()=>window.starAgent.state.controller.armed);
 await page.keyboard.press('h');await page.locator('#controller-layout-help').click();await page.setViewportSize({width:390,height:844});
 for(const mode of ['flight','walk','eva','shortcuts']){
  await page.locator(`[data-layout="${mode}"]`).click();
  expect(await page.locator('#controller-layout').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
  await page.locator('#controller-layout').evaluate(el=>el.scrollTop=0);await page.screenshot({path:`${dir}/phone-${mode}.png`});
 }
 await page.locator('#controller-layout .gameplay-footer, #controller-layout:not(.gameplay-screen) footer').scrollIntoViewIfNeeded();await page.screenshot({path:`${dir}/phone-bottom.png`});
 await page.keyboard.press('Escape');await page.waitForFunction(()=>window.starAgent.state.enabled&&window.starAgent.state.controller.armed);
 await writeFile(`${dir}/result.json`,JSON.stringify({browser:browser.version(),errors,physicalController:false},null,2));expect(errors).toEqual([]);
});
