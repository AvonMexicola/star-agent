import {test,expect} from '@playwright/test';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {verifyStationMarketTrade} from '../tests/browser/station-market-route.js';
const output=process.env.COMMUNITY_OUTPUT??'/home/cees/projects/.community-hub-qa/game-01',origin='http://127.0.0.1:5564';
const state=page=>page.evaluate(()=>starAgent.state);
async function pulse(page,index){await page.evaluate(i=>hubPad.buttons[i]={pressed:true,value:1},index);await page.waitForTimeout(90);await page.evaluate(i=>hubPad.buttons[i]={pressed:false,value:0},index);await page.waitForTimeout(110);}
async function activate(page,mode,key){
 const target=page.locator('dialog[open]').last().locator(`[data-controller-key="${key}"]`);await expect(target).toBeVisible();await expect(target).toBeEnabled();
 if(mode==='touch'){await target.tap();return;}
 for(let i=0;i<100;i++){
  const route=await target.evaluate(target=>{const d=[...document.querySelectorAll('dialog[open]')].at(-1),items=[...d.querySelectorAll('summary,button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),[tabindex="0"]')].filter(e=>!e.closest('[hidden],[inert]')&&e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden'),current=items.indexOf(document.activeElement),goal=items.indexOf(target);return {done:document.activeElement===target,back:(goal-current+items.length)%items.length>items.length/2};});
  if(route.done){if(mode==='controller')await pulse(page,0);else await page.keyboard.press('Enter');return;}
  if(mode==='controller')await pulse(page,route.back?12:13);else await page.keyboard.press(route.back?'Shift+Tab':'Tab');
 }
 throw Error('Could not reach '+key+' using '+mode);
}
async function setup(page,context,mode,callsign){
 const errors=[],warnings=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());if(m.type()==='warning')warnings.push(m.text());});
 await page.addInitScript(controller=>{window.hubPad={id:'Community standard acceptance controller',index:0,connected:controller,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};Object.defineProperty(navigator,'getGamepads',{value:()=>hubPad.connected?[hubPad]:[]});},mode==='controller');
 const response=await context.request.post('/api/auth/register',{headers:{Origin:origin},data:{email:callsign+'@example.test',callsign,password:'isolated community password'}});expect(response.status()).toBe(201);const account=(await response.json()).account;
 await page.goto('/?debug&intro=0');await expect.poll(()=>page.evaluate(()=>window.starAgent?.state.ready),{timeout:90000}).toBe(true);
 if(await page.locator('#dev-launcher').isVisible())await activate(page,mode,'tab-comms');
 await expect(page.locator('#multiplayer-account-dialog')).toBeVisible();await activate(page,mode,'join-multiplayer');await expect.poll(async()=>(await state(page)).multiplayer.connected).toBe(true);
 await close(page,mode);await expect.poll(()=>page.evaluate(()=>starAgent.navigation.enabled)).toBe(true);
 if(mode==='controller')await expect.poll(async()=>(await state(page)).controller.armed).toBe(true);
 return {errors,warnings,account};
}
async function close(page,mode){if(mode==='controller')await pulse(page,1);else if(mode==='keyboard')await page.keyboard.press('Escape');else await page.locator('dialog[open]').last().locator('.gameplay-resume').tap();await page.waitForTimeout(220);}
async function interact(page,mode){if(mode==='controller')await pulse(page,2);else if(mode==='keyboard')await page.keyboard.press('KeyF');else await page.locator('[data-cabin-interact]').tap();await page.waitForTimeout(120);}
async function menu(page,mode){if(mode==='controller')await pulse(page,9);else if(mode==='keyboard')await page.keyboard.press('Escape');else await page.locator('[data-cabin-menu]').tap();}
async function walker(page,context,mode){
 const cdp=mode==='touch'?await context.newCDPSession(page):null;let held=null,centers={};
 if(cdp)for(const key of ['KeyW','KeyA','KeyS','KeyD']){const box=await page.locator(`[data-cabin-key="${key}"]`).boundingBox();expect(box).toBeTruthy();centers[key]={x:box.x+box.width/2,y:box.y+box.height/2};}
 async function input(key,axes=[0,0,0,0]){
  if(mode==='controller'){await page.evaluate(a=>hubPad.axes=a,axes);return;}
  if(key===held)return;
  if(held){if(cdp)await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});else await page.keyboard.up(held);held=null;}
  if(key){if(cdp)await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...centers[key],id:1,radiusX:6,radiusY:6,force:1}]});else await page.keyboard.down(key);held=key;}
 }
 return {stop:()=>input(null),async walk(x,z){
  let last;
  for(let i=0;i<420;i++){
   const c=await page.evaluate(({x,z})=>{const n=starAgent.navigation,frame=n.station.frame,local=frame.toLocal(n.position,n.position.clone()),delta=frame.toWorld(local.clone().set(x,local.y,z),local.clone()).sub(n.position).applyQuaternion(n.orientation.clone().invert());return {local:local.toArray(),dx:delta.x,dz:delta.z,distance:Math.hypot(delta.x,delta.z),frame:n.physicsFrame};},{x,z});last=c;
   if(c.distance<.20){await input(null);await page.waitForTimeout(160);return c;}
   const key=Math.abs(c.dx)>Math.abs(c.dz)?c.dx>0?'KeyD':'KeyA':c.dz>0?'KeyS':'KeyW';
   const scale=Math.min(.70,Math.max(.30,c.distance*.5)),len=Math.hypot(c.dx,c.dz);
   await input(key,[c.dx/len*scale,c.dz/len*scale,0,0]);await page.waitForTimeout(70);
  }
  await input(null);throw Error('Physical walking blocked '+JSON.stringify({target:[x,z],last}));
 }};
}

for(const mode of ['controller','keyboard','touch'])test(`${mode}: physical berth, hands-free hub, finite market and return`,async({browser})=>{
 const context=await browser.newContext({viewport:mode==='touch'?{width:390,height:844}:{width:1440,height:900},hasTouch:mode==='touch',isMobile:mode==='touch',deviceScaleFactor:1});
 const page=await context.newPage(),folder=output+'/'+mode;await mkdir(folder,{recursive:true});let diagnostics={},record={mode,started:new Date().toISOString(),poseMutation:false,physicalController:false};
 try{
  diagnostics=await setup(page,context,mode,'Hub_'+mode+'_'+Date.now().toString().slice(-6));const initial=await state(page),berth=initial.multiplayer.hangar.id,ship=initial.shipPosition;
  const walk=await walker(page,context,mode);await walk.walk(8,-5.32);await walk.walk(8,20.4);await walk.walk(0,20.4);
  await interact(page,mode);await expect.poll(()=>page.evaluate(()=>starAgent.navigation.station.frame.lift.progress)).toBe(1);
  await walk.walk(0,24);await interact(page,mode);await expect(page.locator('#station-elevator-dialog')).toBeVisible();
  await page.screenshot({path:folder+'/01-elevator-destinations.png'});await activate(page,mode,'elevator-hub');
  await expect.poll(async()=>(await state(page)).multiplayer.hub?.frame,{timeout:15000}).toBe('station:hub');
  await expect.poll(async()=>(await state(page)).multiplayer.hub?.transit).toBeNull();await expect.poll(()=>page.evaluate(()=>starAgent.navigation.enabled)).toBe(true);
  await walk.walk(0,9.5);await page.screenshot({path:folder+'/02-community-concourse.png'});
  let s=await state(page);expect(s.multiplayer.hub.handsFree).toBe(true);expect(s.shipPosition).toEqual(ship);expect(s.multiplayer.inventory.weapon).toBeNull();
  // Actual selection UI shows the restriction; shared routes cannot draw a tool.
  await menu(page,mode);await activate(page,mode,'tab-inventory');
  await expect(page.locator('#multiplayer-inventory-dialog')).toContainText('Community hub');
  const equipment=page.locator('#multiplayer-inventory-dialog [data-inventory-request="equip"][data-weapon]:not([data-weapon=""])');
  expect(await equipment.count()).toBeGreaterThan(0);for(const button of await equipment.all())await expect(button).toBeDisabled();
  await page.screenshot({path:folder+'/03-hands-free-inventory.png'});await close(page,mode);
  if(mode==='controller')await pulse(page,15);else if(mode==='keyboard')await page.keyboard.press('Digit3');
  expect((await state(page)).multiplayer.inventory.weapon).toBeNull();
  await walk.walk(0,-8.5);await walk.walk(-5.5,-10.2);await interact(page,mode);
  await expect(page.locator('#trading-dialog')).toBeVisible();
  record.trade=await verifyStationMarketTrade({page,activate:key=>activate(page,mode,key),screenshotPath:folder+'/04-market.png'});
  // Closing a real modal with the trigger held must not resume a shot or tool.
  if(mode==='controller')await page.evaluate(()=>hubPad.buttons[7]={pressed:true,value:1});
  else if(mode==='keyboard')await page.keyboard.down('KeyT');
  await close(page,mode);await page.waitForTimeout(300);expect((await state(page)).multiplayer.inventory.weapon).toBeNull();
  if(mode==='controller'){expect((await state(page)).controller.armed).toBe(false);await page.evaluate(()=>hubPad.buttons[7]={pressed:false,value:0});await expect.poll(async()=>(await state(page)).controller.armed).toBe(true);}
  else if(mode==='keyboard')await page.keyboard.up('KeyT');
  await walk.walk(0,-8.5);await walk.walk(0,12.5);await walk.walk(0,15.95);await interact(page,mode);
  await activate(page,mode,`elevator-${berth}`);await expect.poll(async()=>(await state(page)).multiplayer.hub?.frame,{timeout:15000}).toBe(`hangar:${berth}`);
  await expect.poll(async()=>(await state(page)).multiplayer.hub?.transit).toBeNull();await walk.walk(0,20.4);await walk.walk(8,20.4);await walk.walk(8,-5.32);
  s=await state(page);expect(s.shipPosition).toEqual(ship);expect(s.multiplayer.hangar.id).toBe(berth);expect(s.multiplayer.hub.handsFree).toBe(false);expect(s.multiplayer.health).toBe(100);
  await page.screenshot({path:folder+'/05-return-to-berth.png'});record.final={position:s.position,station:s.station,shipPosition:s.shipPosition,hub:s.multiplayer.hub};expect(diagnostics.errors).toEqual([]);expect(diagnostics.warnings).toEqual([]);record.complete=true;
 }finally{
  await page.screenshot({path:folder+'/last-frame.png'}).catch(()=>{});record.last=await state(page).catch(()=>null);record.diagnostics=diagnostics;record.finished=new Date().toISOString();
  record.browser=browser.version();record.backend=await page.evaluate(()=>{const g=document.querySelector('#viewport')?.getContext('webgl2'),e=g?.getExtension('WEBGL_debug_renderer_info');return e?g.getParameter(e.UNMASKED_RENDERER_WEBGL):null;}).catch(()=>null);
  record.assetSHA=createHash('sha256').update(await readFile(new URL('../public/models/station-defense.glb',import.meta.url))).digest('hex');await writeFile(folder+'/journey.json',JSON.stringify(record,null,2));await context.close();
 }
});
