import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const out=process.env.MOMENTUM_EVIDENCE||'/tmp/star-agent-momentum-evidence';
async function setup(page,ship='nomad'){
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.addInitScript(()=>{window.testPad={id:'Momentum standard Gamepad',index:0,connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};Object.defineProperty(navigator,'getGamepads',{value:()=>[window.testPad]});});
 await page.route('**/api/auth/session',r=>r.fulfill({json:{account:null}}));
 await page.goto(`/?dev=1&ship=${ship}&start=orbit&intro=0&debug&seed=7291`);
 await page.waitForFunction(()=>window.starAgent?.state.dev?.ready&&document.body.classList.contains('player-active')&&getComputedStyle(document.querySelector('#loading')).opacity==='0'&&window.starAgent.state.ready&&window.starAgent.state.enabled&&window.starAgent.state.controller.armed&&window.starAgent.state.mode==='flight'&&!window.starAgent.state.transiting,undefined,{timeout:90000});
 await mkdir(out,{recursive:true});return errors;
}
const frames=page=>page.evaluate(async()=>{for(let i=0;i<4;i++)await new Promise(requestAnimationFrame);});
async function button(page,i,down){await page.evaluate(({i,down})=>window.testPad.buttons[i]={pressed:down,value:+down},{i,down});await frames(page);}
async function tap(page,i){await button(page,i,true);await button(page,i,false);}
async function choose(page,key){
 for(let i=0;i<100;i++){
  const focused=await page.evaluate(()=>document.activeElement?.dataset.controllerKey);
  if(focused===key){
   if(key==='dev-launch'){await Promise.all([page.waitForURL(url=>url.searchParams.get('start')==='moon'),page.evaluate(()=>window.testPad.buttons[0]={pressed:true,value:1})]);return;}
   await tap(page,0);return;
  }
  if(focused?.startsWith('page-')&&focused.endsWith('-next')&&!await page.locator(`[data-controller-key="${key}"]`).isVisible())await tap(page,0);
  else await tap(page,13);
 }
 throw Error(`Missing command ${key}`);
}
async function openTab(page,tab){
 await tap(page,9);await expect(page.locator('dialog[open].gameplay-screen')).toBeVisible();
 for(let i=0;i<8&&await page.locator('dialog[open]').getAttribute('data-gameplay-tab')!==tab;i++)await tap(page,5);
 await expect(page.locator('dialog[open]')).toHaveAttribute('data-gameplay-tab',tab);
}
async function command(page,key){
 await openTab(page,'ship');await choose(page,key);
 await page.waitForFunction(()=>window.starAgent.state.enabled&&window.starAgent.state.controller.armed&&!document.querySelector('dialog[open]'));
}
const axes=(page,a)=>page.evaluate(a=>window.testPad.axes=a,a);

test('controller mode selection, finite braking, and moving ship/on-foot muzzle effects',async({page,browser})=>{
 const errors=await setup(page);
 expect(await page.evaluate(()=>window.starAgent.state.effects.combatMode)).toBe(true);
 await command(page,'combat-mode');expect(await page.evaluate(()=>window.starAgent.state.effects.weaponStatus)).toContain('LOCKED');
 const locked=await page.evaluate(()=>window.starAgent.state.effects.weaponShots);await button(page,7,true);await frames(page);await button(page,7,false);expect(await page.evaluate(()=>window.starAgent.state.effects.weaponShots)).toBe(locked);
 await command(page,'combat-mode');await command(page,'weapon-laser');await command(page,'camera-view');
 await axes(page,[0,-1,0,0]);await page.waitForFunction(()=>window.starAgent.state.speed>70);
 await button(page,7,true);await page.waitForFunction(()=>window.starAgent.state.effects.lances>0);await page.screenshot({path:`${out}/ship-moving-laser.png`});
 const frame=await page.evaluate(async()=>{for(let i=0;i<120;i++){await new Promise(requestAnimationFrame);if(window.starAgent.state.effects.lances>0)return document.querySelector('#viewport').toDataURL('image/png');}throw Error('No visible laser frame');});
 await writeFile(`${out}/ship-moving-laser-frame.png`,Buffer.from(frame.split(',')[1],'base64'));await button(page,7,false);
 await axes(page,[0,0,0,0]);await tap(page,11);expect(await page.evaluate(()=>window.starAgent.state.flightAssist)).toBe(false);
 const coast=await page.evaluate(()=>window.starAgent.state.velocity);await page.waitForTimeout(500);const after=await page.evaluate(()=>window.starAgent.state.velocity);expect(Math.hypot(...after.map((v,i)=>v-coast[i]))).toBeLessThan(2);
 await tap(page,11);await button(page,6,true);await page.waitForFunction(()=>window.starAgent.state.speed<1);await button(page,6,false);
 await command(page,'camera-view');
 // Select a separate ground test start through the real controller launcher;
 // landing, leaving the cabin, using equipment and returning to play are physical.
 await openTab(page,'dev');await choose(page,'dev-location-moon');await choose(page,'dev-launch');
 await page.waitForFunction(()=>window.starAgent?.state.body==='selene'&&!window.starAgent.state.transiting&&window.starAgent.state.ready&&window.starAgent.state.controller.armed,undefined,{timeout:90000});
 await tap(page,3);await page.waitForFunction(()=>window.starAgent.state.mode==='landed',undefined,{timeout:45000});await tap(page,2);
 await axes(page,[0,-1,0,0]);await page.waitForFunction(()=>window.starAgent.state.shipLocal[2]>2.3);await axes(page,[0,0,0,0]);await tap(page,2);await page.waitForFunction(()=>window.starAgent.state.doorProgress===1);
 await axes(page,[0,-1,0,0]);await page.waitForFunction(()=>window.starAgent.state.shipLocal[2]>12);await axes(page,[0,0,0,0]);
 for(let i=0;i<4&&await page.evaluate(()=>window.starAgent.state.mining.tool.item!=='rifle-laser');i++)await tap(page,14);await page.waitForFunction(()=>window.starAgent.state.mining.tool.item==='rifle-laser'&&!window.starAgent.state.mining.tool.toolError);
 await axes(page,[.65,-.65,0,0]);const rounds=await page.evaluate(()=>window.starAgent.state.mining.tool.ammo);await button(page,7,true);
 await page.waitForFunction(()=>window.starAgent.state.effects.lances>0&&window.starAgent.state.speed>2);
 await page.screenshot({path:`${out}/ground-moving-laser.png`});
 const groundFrame=await page.evaluate(async()=>{for(let i=0;i<120;i++){await new Promise(requestAnimationFrame);if(window.starAgent.state.effects.lances>0)return document.querySelector('#viewport').toDataURL('image/png');}throw Error('No visible rifle laser frame');});
 await writeFile(`${out}/ground-moving-laser-frame.png`,Buffer.from(groundFrame.split(',')[1],'base64'));await page.waitForTimeout(600);await button(page,7,false);await axes(page,[0,0,0,0]);expect(await page.evaluate(()=>window.starAgent.state.mining.tool.ammo)).toBeLessThan(rounds);
 // Held trigger cannot replay through focus loss and restoration.
 await button(page,7,true);await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await frames(page);const shots=await page.evaluate(()=>window.starAgent.state.effects.weaponShots);await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await frames(page);expect(await page.evaluate(()=>window.starAgent.state.effects.weaponShots)).toBe(shots);await button(page,7,false);
 await page.waitForFunction(()=>window.starAgent.state.controller.armed);await tap(page,8);await expect(page.locator('#cargo-dialog')).toBeVisible();await tap(page,1);await page.waitForFunction(()=>window.starAgent.state.enabled&&window.starAgent.state.controller.armed);
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:`${out}/ground-phone.png`});
 const backend=await page.evaluate(()=>{const gl=document.querySelector('#viewport').getContext('webgl2'),e=gl.getExtension('WEBGL_debug_renderer_info');return e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):'unknown';});
 await writeFile(`${out}/controller.json`,JSON.stringify({browser:browser.version(),backend,errors,physicalController:false,state:await page.evaluate(()=>window.starAgent.state)},null,2));expect(errors).toEqual([]);
});

for(const ship of ['kestrel','nomad','atlas'])test(`${ship} controlled stopping and unlocked retreat inspection`,async({page})=>{
 const errors=await setup(page,ship);
 const result=await page.evaluate(()=>{
  const n=window.starAgent.navigation;n.velocity.set(0,0,-100);n.orientation.identity();n.flightAssist=true;
  const initial=n.position.clone();n.keys.add('KeyX');for(let i=0;i<60;i++)n.update(1/60);n.keys.clear();
  const speedAfterSecond=n.speed,distance=n.position.distanceTo(initial);
  n.flightAssist=false;n.velocity.set(0,0,-100);n.orientation.setFromAxisAngle(n.normal.clone().set(0,1,0),Math.PI);
  const before=n.velocity.clone();n.update(1/60);return {speedAfterSecond,distance,coastError:n.velocity.distanceTo(before)};
 });
 expect(result.speedAfterSecond).toBeGreaterThan(10);expect(result.speedAfterSecond).toBeLessThan(100);expect(result.distance).toBeGreaterThan(50);expect(result.coastError).toBeLessThan(.1);
 await page.keyboard.down('t');await page.waitForFunction(()=>window.starAgent.state.effects.weaponShots>0);await page.screenshot({path:`${out}/${ship}-retreat.png`});await page.keyboard.up('t');
 await writeFile(`${out}/${ship}-stopping.json`,JSON.stringify({result,errors},null,2));expect(errors).toEqual([]);
});
