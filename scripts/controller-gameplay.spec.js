import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const evidence='/tmp/star-agent-controller-evidence';
const setButton=(page,index,down)=>page.evaluate(({index,down})=>window.testPad.buttons[index]={pressed:down,value:Number(down)},{index,down});
const tap=async(page,index)=>{await setButton(page,index,true);await page.waitForFunction(i=>window.starAgent.navigation.gamepad.previous[i],index,{timeout:5000});await setButton(page,index,false);await page.waitForFunction(i=>!window.starAgent.navigation.gamepad.previous[i],index,{timeout:5000});};
const axes=(page,values)=>page.evaluate(values=>window.testPad.axes=values,values);
async function aimAtDeposit(page) {
  for(let i=0;i<120;i++) {
    const error=await page.evaluate(()=>{
      const n=window.starAgent.navigation;
      const local=n.position.clone().fromArray(window.starAgent.state.mining.activePosition).sub(n.position).applyQuaternion(n.orientation.clone().invert());
      return [Math.atan2(local.x,-local.z),Math.atan2(local.y,Math.hypot(local.x,local.z))];
    });
    if(Math.abs(error[0])<.025&&Math.abs(error[1])<.025){await axes(page,[0,0,0,0]);return;}
    const axis=v=>Math.sign(v)*Math.min(1,.2+Math.abs(v)*1.5);
    await axes(page,[0,0,axis(error[0]),axis(-error[1])]);await page.waitForTimeout(90);
  }
  throw new Error('Controller aim did not converge');
}
for(const destination of ['moon','resource-copper-ejecta-province']) test(`${destination}: controller alone transits, lands, walks out, aims, equips, mines with a visible beam and opens backpack`,async({page,browser})=>{
  test.setTimeout(300000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await mkdir(evidence,{recursive:true});
  await page.addInitScript(()=>{window.testPad={id:'Automated standard Xbox',index:0,mapping:'standard',connected:true,axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};navigator.getGamepads=()=>[window.testPad];});
  await page.goto('/?debug');await page.waitForFunction(()=>window.starAgent?.state.ready&&window.starAgent.state.controller.armed&&window.starAgent.state.mining.ready);
  // Reads debug state for assertions and steering feedback. No gameplay mutation,
  // teleport helper, keyboard event, mouse click or pointer capture is used.
  await tap(page,9);await expect(page.locator('#controller-menu')).toBeVisible();
  for(let i=0;i<36;i++) {if(await page.locator(`[data-controller-key="destination-${destination}"]`).evaluate(el=>el===document.activeElement))break;await tap(page,13);}
  await expect(page.locator(`[data-controller-key="destination-${destination}"]`)).toBeFocused();await tap(page,0);
  await page.waitForFunction(()=>window.starAgent.state.body==='selene'&&!window.starAgent.state.transiting);
  await page.waitForFunction(()=>window.starAgent.state.controller.armed);await tap(page,3);await page.waitForFunction(()=>window.starAgent.state.mode==='landed');
  await tap(page,2);await page.waitForFunction(()=>window.starAgent.state.mode==='walk');
  await axes(page,[0,-1,0,0]);await page.waitForFunction(()=>window.starAgent.state.shipLocal[2]>2.3);await axes(page,[0,0,0,0]);
  await tap(page,2);await page.waitForFunction(()=>window.starAgent.state.doorProgress===1);
  await axes(page,[0,-1,0,0]);await page.waitForFunction(()=>window.starAgent.state.shipLocal[2]>12);await axes(page,[0,0,0,0]);
  expect(await page.evaluate(()=>window.starAgent.state.insideShip)).toBe(false);
  await aimAtDeposit(page);
  await axes(page,[0,-1,0,0]);await page.waitForFunction(()=>{const n=window.starAgent.navigation;return n.position.distanceTo(n.position.clone().fromArray(window.starAgent.state.mining.activePosition))<5;});await axes(page,[0,0,0,0]);await aimAtDeposit(page);
  await page.waitForFunction(()=>window.starAgent.state.mining.tool.hit!==null);
  await tap(page,15);expect(await page.evaluate(()=>window.starAgent.state.mining.tool.selected)).toBe(false);
  await tap(page,15);expect(await page.evaluate(()=>window.starAgent.state.mining.tool.selected)).toBe(true);
  const revision=await page.evaluate(()=>window.starAgent.state.mining.activeRevision);
  await setButton(page,7,true);await page.waitForFunction(({revision,cuts})=>window.starAgent.state.mining.activeRevision>=revision+cuts,{revision,cuts:destination==='moon'?1:4});
  await page.waitForFunction(()=>window.starAgent.state.mining.tool.beaming);
  await page.screenshot({path:`${evidence}/${destination}-controller-held-beam.png`});
  await setButton(page,7,false);await page.waitForFunction(()=>!window.starAgent.state.mining.pending);
  const mined=await page.evaluate(()=>window.starAgent.state.mining);expect(mined.pack.reduce((a,b)=>a+b,0)).toBeGreaterThan(0);
  if(destination!=='moon'){expect(mined.pack[1]).toBeGreaterThan(mined.pack[0]);expect(mined.pack[1]).toBeGreaterThan(mined.pack[2]);}
  await tap(page,8);await expect(page.locator('#cargo-dialog')).toBeVisible();await page.screenshot({path:`${evidence}/${destination}-controller-backpack.png`});
  await tap(page,13);expect(await page.locator('#cargo-dialog [data-controller-selected]').count()).toBe(1);
  await tap(page,1);await expect(page.locator('#cargo-dialog')).not.toBeVisible();
  await writeFile(`${evidence}/${destination}-controller-gameplay.json`,JSON.stringify({browser:browser.version(),input:'Injected W3C standard Gamepad; no physical controller used',viewport:page.viewportSize(),mined,errors},null,2));
  expect(errors).toEqual([]);
});
