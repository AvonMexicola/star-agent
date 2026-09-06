import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const evidence='/tmp/star-agent-ship-marker-evidence';
const axes=(page,values)=>page.evaluate(v=>window.markerPad.axes=v,values);
const button=(page,index,pressed)=>page.evaluate(({index,pressed})=>window.markerPad.buttons[index]={pressed,value:Number(pressed)},{index,pressed});
async function tap(page,index){await button(page,index,true);await page.waitForFunction(i=>window.starAgent.navigation.gamepad.previous[i],index);await button(page,index,false);await page.waitForFunction(i=>!window.starAgent.navigation.gamepad.previous[i],index);}
async function brake(page){await button(page,6,true);await page.waitForFunction(()=>window.starAgent.state.speed<.01);await button(page,6,false);}
async function aimAtBeacon(page){
  for(let i=0;i<100;i++){
    const error=await page.evaluate(()=>{const n=window.starAgent.navigation,p=n.position.clone().fromArray(window.starAgent.state.shipMarker.target).sub(n.position).applyQuaternion(n.orientation.clone().invert());return [Math.atan2(p.x,-p.z),Math.atan2(p.y,Math.hypot(p.x,p.z))];});
    if(Math.abs(error[0])<.015&&Math.abs(error[1])<.015){await axes(page,[0,0,0,0]);return;}
    const axis=v=>Math.sign(v)*Math.min(1,.18+Math.abs(v)*1.6);
    await axes(page,[0,0,axis(error[0]),axis(-error[1])]);await page.waitForTimeout(100);
  }
  throw Error('Controller could not align with ship beacon');
}

test('controller EVA journey finds an off-screen ship beacon and returns to its ramp',async({page,browser})=>{
  test.setTimeout(240000);const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await mkdir(evidence,{recursive:true});
  await page.addInitScript(()=>{window.markerPad={id:'Standard Xbox ship beacon journey',index:0,connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};navigator.getGamepads=()=>[window.markerPad];});
  await page.goto('/?debug');await page.waitForFunction(()=>window.starAgent?.state.ready&&window.starAgent.state.controller.armed);
  await page.evaluate(()=>window.starAgent.setRenderScale(.65));
  const marker=page.locator('#ship-marker');await expect(marker).toBeHidden();
  // Actual controller interactions and translation from the normal game start.
  // Debug reads guide aiming; there are no position/orientation/interaction calls.
  await tap(page,1);await tap(page,2);await page.waitForFunction(()=>window.starAgent.state.mode==='walk'&&window.starAgent.state.eva.spaceParked);
  await expect(marker).toBeHidden();
  await axes(page,[0,-1,0,0]);await page.waitForFunction(()=>window.starAgent.state.shipLocal[2]>2.3);await axes(page,[0,0,0,0]);
  await tap(page,2);await page.waitForFunction(()=>window.starAgent.state.doorProgress===1);
  await axes(page,[0,-1,0,0]);await page.waitForFunction(()=>window.starAgent.state.mode==='eva');await page.waitForFunction(()=>window.starAgent.state.shipMarker.distance>25);await axes(page,[0,0,0,0]);await brake(page);
  await expect(marker).toBeVisible();await expect(marker).toHaveAttribute('data-behind','true');await expect(marker).toContainText('TURN BACK');
  const behind=await page.evaluate(()=>window.starAgent.state.shipMarker);
  await page.screenshot({path:`${evidence}/ship-behind-edge-arrow.png`});
  await aimAtBeacon(page);await expect(marker).toHaveAttribute('data-edge','false');
  const ahead=await page.evaluate(()=>window.starAgent.state.shipMarker);expect(ahead.distance).toBeCloseTo(behind.distance,1);
  await page.screenshot({path:`${evidence}/ship-ahead-ramp-beacon.png`});
  // Modal input remains routed through the existing controller system.
  await tap(page,8);await expect(page.locator('#cargo-dialog')).toBeVisible();await tap(page,1);await page.waitForFunction(()=>window.starAgent.state.controller.armed);
  await page.setViewportSize({width:390,height:844});
  await page.waitForFunction(()=>Math.abs(window.starAgent.state.shipMarker.x-195)<15);
  const phone=await marker.boundingBox();expect(phone.x).toBeGreaterThanOrEqual(0);expect(phone.x+phone.width).toBeLessThanOrEqual(390);
  await page.screenshot({path:`${evidence}/ship-beacon-phone.png`});await page.setViewportSize({width:1440,height:900});
  // A moderate forward input reaches the ramp below the 4m/s attachment limit.
  await axes(page,[0,-.5,0,0]);await page.waitForFunction(()=>window.starAgent.state.shipMarker.distance<12);await axes(page,[0,0,0,0]);await brake(page);await aimAtBeacon(page);
  await axes(page,[0,-.28,0,0]);await page.waitForFunction(()=>window.starAgent.state.mode==='walk',null,{timeout:45000});await axes(page,[0,0,0,0]);
  await axes(page,[0,-1,0,0]);await page.waitForFunction(()=>window.starAgent.state.shipLocal[2]<-1.4);await axes(page,[0,0,0,0]);
  await expect(marker).toBeHidden();await tap(page,2);await page.waitForFunction(()=>window.starAgent.state.mode==='flight');await expect(marker).toBeHidden();
  const environment=await page.evaluate(()=>{const gl=document.querySelector('canvas').getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');return {renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),renderScale:window.starAgent.state.renderScale};});
  await writeFile(`${evidence}/journey.json`,JSON.stringify({browser:browser.version(),environment,input:'Injected standard Gamepad; no keyboard, pointer or debug gameplay mutations. Read-only diagnostics guide stick aiming. No physical Xbox sequence.',behind,ahead,phone,final:await page.evaluate(()=>({mode:window.starAgent.state.mode,marker:window.starAgent.state.shipMarker})),errors},null,2));expect(errors).toEqual([]);
});
