import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const evidence='/tmp/star-agent-mining-particle-evidence';

test('mining particles follow real mouse/touch cuts and suppress held controller input across interruptions',async({page,browser})=>{
  test.setTimeout(180000);const errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await mkdir(evidence,{recursive:true});
  await page.addInitScript(()=>{window.particlePad={id:'Standard Xbox particle regression',index:0,mapping:'standard',connected:true,axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};navigator.getGamepads=()=>[window.particlePad];});
  await page.goto('/?debug');await page.waitForFunction(()=>window.starAgent?.state.ready&&window.starAgent.state.mining.ready);
  // Bounded visual/input regression fixture. Full controller travel/landing/aiming
  // is covered separately by controller-gameplay and regional-deposits.
  await page.evaluate(()=>{const a=window.starAgent,n=a.navigation;n.transitMoon();const center=n.position.clone().fromArray(a.state.mining.position),up=n.normal,east=n.position.clone().set(1,0,0).cross(up).normalize();n.position.copy(center).addScaledVector(east,4.6).addScaledVector(up,.5);n.mode='walk';n.insideShip=false;n.velocity.set(0,0,0);n.orientToward(center,up);a.setRenderScale(.65);});
  await page.waitForFunction(()=>window.starAgent.state.mining.tool.hit!==null&&window.starAgent.state.controller.armed);
  const button=async(index,down)=>{await page.evaluate(({index,down})=>window.particlePad.buttons[index]={pressed:down,value:Number(down)},{index,down});await page.waitForFunction(({index,down})=>Boolean(window.starAgent.navigation.gamepad.previous[index])===down,{index,down});};
  const tap=async index=>{await button(index,true);await button(index,false);};
  const quiet=async()=>{await page.waitForFunction(()=>!window.starAgent.state.effects.beamVisible&&!window.starAgent.state.mining.pending);const before=await page.evaluate(()=>({revision:window.starAgent.state.mining.activeRevision,bursts:window.starAgent.state.effects.collectedBursts}));await page.waitForTimeout(350);expect(await page.evaluate(()=>({revision:window.starAgent.state.mining.activeRevision,bursts:window.starAgent.state.effects.collectedBursts}))).toEqual(before);};
  const trigger=await page.locator('.mining-trigger').boundingBox();
  await page.mouse.move(trigger.x+trigger.width/2,trigger.y+trigger.height/2);await page.mouse.down();
  await page.waitForFunction(()=>{const e=window.starAgent.state.effects;return e.beamVisible&&e.collectedBursts>0&&e.particles>0;});
  await page.screenshot({path:`${evidence}/mouse-mining.png`});await page.mouse.up();await quiet();
  const mouse=await page.evaluate(()=>({effects:window.starAgent.state.effects,pack:window.starAgent.state.mining.pack}));
  await button(7,true);await page.waitForFunction(()=>window.starAgent.state.effects.beamVisible);
  await tap(8);await expect(page.locator('#cargo-dialog')).toBeVisible();await quiet();
  // Arm the menu neutrally, then close while RT is held. Gameplay must stay disarmed.
  await button(7,false);await page.waitForFunction(()=>window.starAgent.navigation.gamepad.uiArmed);
  await button(7,true);await tap(1);await expect(page.locator('#cargo-dialog')).not.toBeVisible();await quiet();
  expect(await page.evaluate(()=>window.starAgent.state.controller.armed)).toBe(false);
  await button(7,false);await page.waitForFunction(()=>window.starAgent.state.controller.armed);
  for(const transition of ['focus','disconnect']){
    await button(7,true);await page.waitForFunction(()=>window.starAgent.state.effects.beamVisible);
    await page.evaluate(transition=>{if(transition==='focus')window.dispatchEvent(new Event('blur'));else window.particlePad.connected=false;},transition);
    await quiet();
    await page.evaluate(transition=>{if(transition==='focus')window.dispatchEvent(new Event('focus'));else window.particlePad.connected=true;},transition);
    await quiet();expect(await page.evaluate(()=>window.starAgent.state.controller.armed)).toBe(false);
    await button(7,false);await page.waitForFunction(()=>window.starAgent.state.controller.armed);
  }
  await tap(9);await expect(page.locator('#controller-menu')).toBeVisible();
  const select=async selector=>{for(let i=0;i<40;i++){if(await page.locator(selector).evaluate(el=>el===document.activeElement))break;await page.waitForFunction(()=>window.starAgent.navigation.gamepad.uiArmed);await tap(13);}await expect(page.locator(selector)).toBeFocused();await tap(0);};
  await select('[data-controller-key="help"]');await expect(page.locator('#help-dialog')).toBeVisible();
  await select('#mining-bloom');await select('#mining-reduced-motion');await tap(1);
  await expect(page.locator('#help-dialog')).not.toBeVisible();
  expect(await page.evaluate(()=>window.starAgent.state.effects.reducedMotion)).toBe(true);
  expect(await page.evaluate(()=>window.starAgent.state.effects.bloom)).toBe(false);
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(250);
  await expect(page.locator('.mining-trigger')).toBeVisible();
  const mobile=await page.locator('.mining-trigger').boundingBox(),bursts=await page.evaluate(()=>window.starAgent.state.effects.collectedBursts);
  const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:true});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:mobile.x+mobile.width/2,y:mobile.y+mobile.height/2}]});
  await page.waitForFunction(bursts=>window.starAgent.state.effects.collectedBursts>bursts,bursts);
  await page.screenshot({path:`${evidence}/touch-reduced-motion.png`});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await quiet();
  // Empty sky keeps the beam but cannot create contact sparks or collect ore.
  await page.evaluate(()=>{const n=window.starAgent.navigation;n.orientToward(n.position.clone().addScaledVector(n.normal,5),n.position.clone().set(1,0,0));});
  await page.waitForFunction(()=>window.starAgent.state.mining.tool.hit===null);await page.waitForTimeout(1800);
  const misses=await page.evaluate(()=>window.starAgent.state.effects);await button(7,true);await page.waitForFunction(()=>window.starAgent.state.effects.beamVisible);await page.waitForTimeout(300);
  const after=await page.evaluate(()=>window.starAgent.state.effects);expect(after.miningContacts).toBe(misses.miningContacts);expect(after.collectedBursts).toBe(misses.collectedBursts);expect(after.particles).toBe(0);await button(7,false);
  const environment=await page.evaluate(()=>{const gl=document.getElementById('viewport').getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');return {renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),renderScale:window.starAgent.state.renderScale};});
  await writeFile(`${evidence}/regressions.json`,JSON.stringify({browser:browser.version(),environment,desktop:[1440,900],mobile:[390,844],fixture:'Debug initial position/aim, actual pointer/touch/Gamepad inputs; synthetic browser focus events; no physical Xbox',mouse,after,errors},null,2));expect(errors).toEqual([]);
});
