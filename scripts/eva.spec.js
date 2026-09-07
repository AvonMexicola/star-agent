import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const evidence='/tmp/star-agent-eva-evidence';
test('physically exit into space, thrust, coast, brake, return through ramp and reseat',async({page,browser})=>{
  test.setTimeout(180000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await mkdir(evidence,{recursive:true});await page.goto('/?debug');await page.waitForFunction(()=>window.starAgent?.state.ready);
  await page.evaluate(()=>window.starAgent.setRenderScale(.65));
  await page.keyboard.press('x');await page.keyboard.press('f');await page.waitForFunction(()=>window.starAgent.navigation.spaceParked&&window.starAgent.state.mode==='walk');
  await page.keyboard.down('w');await page.waitForFunction(()=>window.starAgent.state.shipLocal[2]>2.3);await page.keyboard.up('w');await page.keyboard.press('x');
  await page.keyboard.press('f');await page.waitForFunction(()=>window.starAgent.state.doorProgress===1);
  await page.keyboard.down('w');await page.waitForFunction(()=>window.starAgent.state.mode==='eva');await page.keyboard.up('w');
  await page.keyboard.down('x');await page.waitForFunction(()=>window.starAgent.state.speed<.01);await page.keyboard.up('x');
  const outside=await page.evaluate(()=>window.starAgent.state.position);await page.keyboard.press('f');expect(await page.evaluate(()=>window.starAgent.state.mode)).toBe('eva');
  // Move away from the ramp, coast without input, then brake before returning.
  await page.keyboard.down('w');await page.waitForTimeout(400);await page.keyboard.up('w');
  await page.waitForTimeout(1500);const coast=await page.evaluate(()=>({speed:window.starAgent.state.speed,position:window.starAgent.state.position}));
  expect(coast.speed).toBeGreaterThan(.5);expect(coast.position).not.toEqual(outside);
  await page.keyboard.down('x');await page.waitForFunction(()=>window.starAgent.state.speed<.01);await page.keyboard.up('x');
  // Turn the camera to inspect the parked ship, then restore orientation only.
  const orientation=await page.evaluate(()=>window.starAgent.navigation.orientation.toArray());
  await page.evaluate(()=>{const n=window.starAgent.navigation;n.orientToward(n.shipPosition,n.position.clone().set(0,1,0).applyQuaternion(n.shipOrientation));});
  await page.screenshot({path:`${evidence}/eva-ship.png`});
  await page.evaluate(a=>window.starAgent.navigation.orientation.fromArray(a),orientation);
  await page.keyboard.down('s');await page.waitForTimeout(350);await page.keyboard.up('s');
  await page.waitForFunction(()=>window.starAgent.state.mode==='walk',null,{timeout:30000});
  await page.keyboard.down('s');await page.waitForFunction(()=>window.starAgent.state.shipLocal[2]<-1.4);await page.keyboard.up('s');await page.keyboard.press('x');await page.keyboard.press('f');
  expect(await page.evaluate(()=>window.starAgent.state.mode)).toBe('flight');expect(await page.evaluate(()=>window.starAgent.navigation.spaceParked)).toBe(false);
  const gpu=await page.evaluate(()=>{const gl=document.querySelector('canvas').getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');return ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);});
  await writeFile(`${evidence}/state.json`,JSON.stringify({browser:browser.version(),renderer:gpu,viewport:{width:1440,height:900},coast,final:await page.evaluate(()=>window.starAgent.navigation.evaState),errors},null,2));expect(errors).toEqual([]);
});
