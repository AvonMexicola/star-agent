import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const evidence='/tmp/star-agent-mining-evidence';

test('land, walk to the deposit, mine with the laser, persist cuts and stow collected samples',async({page,browser})=>{
  test.setTimeout(300000);const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await mkdir(evidence,{recursive:true});await page.goto('/?debug');await page.waitForFunction(()=>window.starAgent?.state.ready&&window.starAgent.state.mining.ready);
  await page.evaluate(()=>window.starAgent.setRenderScale(.65));
  await page.locator('[data-destination="moon"]').click();await page.waitForFunction(()=>!window.starAgent.state.transiting);
  await page.keyboard.press('l');await page.waitForFunction(()=>window.starAgent.state.mode==='landed');
  await page.keyboard.press('f');await page.keyboard.down('w');await page.waitForFunction(()=>window.starAgent.state.shipLocal[2]>2.3);await page.keyboard.up('w');await page.keyboard.press('x');
  await page.keyboard.press('f');await page.waitForFunction(()=>window.starAgent.state.doorProgress===1);
  await page.keyboard.down('w');await page.waitForFunction(()=>window.starAgent.state.shipLocal[2]>12);await page.keyboard.up('w');await page.keyboard.press('x');
  expect(await page.evaluate(()=>window.starAgent.state.insideShip)).toBe(false);
  await page.evaluate(()=>{const n=window.starAgent.navigation;n.orientToward(n.position.clone().fromArray(window.starAgent.state.mining.position),n.normal);});
  await page.keyboard.down('w');await page.waitForFunction(()=>window.starAgent.navigation.position.distanceTo(window.starAgent.navigation.position.clone().fromArray(window.starAgent.state.mining.position))<5);await page.keyboard.up('w');await page.keyboard.press('x');
  await page.waitForFunction(()=>window.starAgent.state.mining.tool.hit!==null);await page.waitForTimeout(1000);
  await page.screenshot({path:`${evidence}/before.png`});
  await page.keyboard.down('t');await page.waitForFunction(()=>window.starAgent.state.mining.revision>=8,null,{timeout:90000});await page.keyboard.up('t');
  await page.waitForFunction(()=>!window.starAgent.state.mining.pending);const mined=await page.evaluate(()=>window.starAgent.state.mining);
  expect(mined.pack.reduce((a,b)=>a+b,0)).toBeGreaterThan(.5);expect(mined.saved).toBe(true);expect(mined.tool.toolError).toBe(null);
  await page.screenshot({path:`${evidence}/after.png`});
  const save=await page.evaluate(()=>localStorage.getItem('star-agent.selene-mining.v1'));
  // Modal focus cancels a held tool and does not resume it after closing.
  await page.keyboard.press('h');const paused=await page.evaluate(()=>window.starAgent.state.mining.revision);await page.waitForTimeout(600);expect(await page.evaluate(()=>window.starAgent.state.mining.revision)).toBe(paused);await page.keyboard.press('Escape');
  const position=await page.evaluate(()=>window.starAgent.state.position),orientation=await page.evaluate(()=>window.starAgent.navigation.orientation.toArray());
  await page.reload();await page.waitForFunction(()=>window.starAgent?.state.ready&&window.starAgent.state.mining.ready);
  expect(await page.evaluate(()=>localStorage.getItem('star-agent.selene-mining.v1'))).toBe(save);
  expect(await page.evaluate(()=>window.starAgent.state.mining.revision)).toBe(mined.revision);
  await page.evaluate(({position,orientation})=>{const n=window.starAgent.navigation;n.transitMoon();n.position.fromArray(position);n.orientation.fromArray(orientation);n.mode='walk';}, {position,orientation});
  await page.waitForFunction(()=>window.starAgent.state.mining.tool.active);await page.waitForTimeout(1200);await page.screenshot({path:`${evidence}/reloaded.png`});
  // Standard Xbox trigger uses the same armed gamepad input and mining adapter.
  await page.evaluate(()=>{window.testPad={id:'Mining Xbox test',index:0,connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};navigator.getGamepads=()=>[window.testPad];});
  await page.waitForFunction(()=>window.starAgent.state.controller.armed);
  const prePad=await page.evaluate(()=>window.starAgent.state.mining.revision);
  await page.evaluate(()=>{window.testPad.buttons[7]={pressed:true,value:1};});await page.waitForFunction(previous=>window.starAgent.state.mining.revision>previous,prePad);await page.evaluate(()=>{window.testPad.buttons[7]={pressed:false,value:0};});
  await page.waitForFunction(()=>!window.starAgent.state.mining.pending);
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(500);await page.screenshot({path:`${evidence}/phone.png`});
  const bounds=await page.locator('#mining-panel').boundingBox();expect(bounds.x).toBeGreaterThanOrEqual(0);expect(bounds.x+bounds.width).toBeLessThanOrEqual(390);
  // Real touch input holds the same accessible mining button.
  await page.evaluate(()=>window.starAgent.navigation.look(.07,.035));
  await page.waitForFunction(()=>window.starAgent.state.mining.tool.hit!==null);
  const trigger=await page.locator('.mining-trigger').boundingBox(),preTouch=await page.evaluate(()=>window.starAgent.state.mining.revision);
  const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:true});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:trigger.x+trigger.width/2,y:trigger.y+trigger.height/2}]});
  await page.waitForFunction(previous=>window.starAgent.state.mining.revision>previous,preTouch);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForFunction(()=>!window.starAgent.state.mining.pending);
  // The survey container is integrated with the real cargo dialog. Restore a
  // landed ship after reload, then enter its storage interaction position.
  await page.evaluate(()=>{const n=window.starAgent.navigation;n.transitMoon(3.2);n.touchDown();n.embark();n.position.copy(n.fromShipLocal(n.position.clone().set(.4,2.75,1.15)));n.openInventory();});
  await page.getByRole('button',{name:'Stow survey pouch'}).click();
  expect(await page.evaluate(()=>window.starAgent.state.mining.pack.reduce((a,b)=>a+b,0))).toBe(0);
  expect(await page.evaluate(()=>window.starAgent.state.mining.ship.reduce((a,b)=>a+b,0))).toBeGreaterThan(.5);
  await page.screenshot({path:`${evidence}/cargo.png`});
  const gpu=await page.evaluate(()=>{const gl=document.querySelector('canvas').getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');return ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);});
  await writeFile(`${evidence}/state.json`,JSON.stringify({browser:browser.version(),renderer:gpu,mined,errors},null,2));expect(errors).toEqual([]);
});
