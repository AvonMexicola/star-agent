import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const evidence='/tmp/star-agent-expedition-evidence';
test('ring survey, physical EVA exit, thruster approach, Xbox asteroid mining and backpack',async({page,browser})=>{
  test.setTimeout(240000);const errors=[];page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  await mkdir(evidence,{recursive:true});await page.goto('/?debug');await page.waitForFunction(()=>window.starAgent?.state.ready);
  await page.evaluate(()=>window.starAgent.setRenderScale(.65));
  await page.locator('[data-destination="ring"]').click();await page.waitForFunction(()=>!window.starAgent.state.transiting&&window.starAgent.state.mining.spaceRocks.some(rock=>rock.ready));
  await page.keyboard.press('x');await page.keyboard.press('f');await page.waitForFunction(()=>window.starAgent.state.mode==='walk'&&window.starAgent.state.eva.spaceParked);
  await page.keyboard.down('w');await page.waitForFunction(()=>window.starAgent.state.shipLocal[2]>2.3);await page.keyboard.up('w');await page.keyboard.press('x');
  await page.keyboard.press('f');await page.waitForFunction(()=>window.starAgent.state.doorProgress===1);
  await page.keyboard.down('w');await page.waitForFunction(()=>window.starAgent.state.mode==='eva');await page.keyboard.up('w');
  const brake=async()=>{await page.keyboard.down('x');await page.waitForFunction(()=>window.starAgent.state.speed<.01);await page.keyboard.up('x');};
  await brake();expect(await page.evaluate(()=>window.starAgent.state.insideShip)).toBe(false);
  // Move around the ship's wings with real suit input before approaching the
  // asteroid ahead of its nose. Only aiming orientation uses the debug seam.
  await page.keyboard.down('d');await page.waitForFunction(()=>Math.abs(window.starAgent.state.shipLocal[0])>12);await page.keyboard.up('d');await brake();
  const target=await page.evaluate(()=>window.starAgent.state.mining.activePosition);
  await page.evaluate(target=>{const nav=window.starAgent.navigation;nav.orientToward(nav.position.clone().fromArray(target),nav.position.clone().set(0,1,0));},target);
  await page.keyboard.down('w');await page.waitForFunction(target=>window.starAgent.navigation.position.distanceTo(window.starAgent.navigation.position.clone().fromArray(target))<8.4,target,{timeout:30000});await page.keyboard.up('w');await brake();
  await page.waitForFunction(()=>window.starAgent.state.mining.tool.active&&window.starAgent.state.mining.tool.hit!==null);
  expect(await page.evaluate(()=>window.starAgent.state.mode)).toBe('eva');
  await page.screenshot({path:`${evidence}/space-before.png`});
  await page.evaluate(()=>{window.spacePad={id:'Standard Xbox space mining test',index:0,connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};navigator.getGamepads=()=>[window.spacePad];});
  await page.waitForFunction(()=>window.starAgent.state.controller.armed);
  const before=await page.evaluate(()=>({revision:window.starAgent.state.mining.activeRevision,mass:window.starAgent.state.mining.pack.reduce((a,b)=>a+b,0),position:window.starAgent.state.position}));
  await page.evaluate(()=>window.spacePad.buttons[7]={pressed:true,value:1});
  await page.waitForFunction(previous=>window.starAgent.state.mining.activeRevision>=previous+3,before.revision,{timeout:60000});
  await page.waitForFunction(()=>window.starAgent.state.mining.tool.beaming);await page.screenshot({path:`${evidence}/space-laser.png`});
  await page.evaluate(()=>window.spacePad.buttons[7]={pressed:false,value:0});
  await page.waitForFunction(()=>window.starAgent.state.mining.spaceRocks.every(rock=>!rock.pending));
  const mined=await page.evaluate(()=>window.starAgent.state);
  expect(mined.mining.pack.reduce((a,b)=>a+b,0)).toBeGreaterThan(before.mass);
  expect(mined.speed).toBeLessThan(.01);expect(mined.mining.tool.toolError).toBe(null);expect(mined.mining.activeRock).toMatch(/^selene-ring-v1-/);
  // View opens the actual shared backpack dialog; the collected items are
  // visible without approaching the ship or a separate survey-only interface.
  await page.evaluate(()=>window.spacePad.buttons[8]={pressed:true,value:1});await page.waitForTimeout(180);await page.evaluate(()=>window.spacePad.buttons[8]={pressed:false,value:0});
  await expect(page.locator('dialog[open]')).toBeVisible();await expect(page.locator('dialog[open]')).toContainText(/backpack/i);
  await page.screenshot({path:`${evidence}/space-backpack.png`});
  const gpu=await page.evaluate(()=>{const gl=document.querySelector('canvas').getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');return ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);});
  await writeFile(`${evidence}/space-state.json`,JSON.stringify({browser:browser.version(),renderer:gpu,viewport:{width:1440,height:900},renderScale:.65,aiming:'Debug orientation only; Ring Survey UI transit and all suit translation are player inputs',before,mined,errors},null,2));expect(errors).toEqual([]);
});
