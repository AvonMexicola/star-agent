import { test, expect } from '@playwright/test';

test('controller flies without pointer lock, pauses for help, reconnects and boards', async ({page}) => {
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{
    window.testPad={id:'Simulated standard controller',index:0,connected:true,mapping:'standard',axes:[0,0,0,0],
      buttons:Array.from({length:17},()=>({pressed:false,value:0}))};
    Object.defineProperty(navigator,'getGamepads',{value:()=>[window.testPad]});
  });
  await page.goto('/?debug');
  await page.waitForFunction(()=>window.starAgent?.state.ready);
  await page.evaluate(()=>window.starAgent.setRenderScale(.4));
  const frames=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const button=async(index,down)=>{await page.evaluate(({index,down})=>{
    window.testPad.buttons[index]={pressed:down,value:Number(down)};
  },{index,down});await frames();};
  const press=async index=>{await button(index,true);await button(index,false);};
  await page.evaluate(()=>{window.testPad.axes[1]=-.58;});
  await page.waitForFunction(()=>window.starAgent.state.speed>100);
  expect(await page.evaluate(()=>document.pointerLockElement)).toBeNull();
  await expect(page.locator('#controller-hints')).toBeVisible();
  await page.evaluate(()=>window.testPad.axes.fill(0));
  await button(1,true);await page.waitForFunction(()=>window.starAgent.state.speed===0);await button(1,false);
  await press(9);await expect(page.locator('#help-dialog')).toBeVisible();
  const paused=await page.evaluate(()=>window.starAgent.state.position);
  await page.evaluate(()=>{window.testPad.axes[1]=-1;window.testPad.axes[3]=1;});
  await button(11,true);
  await page.waitForFunction(()=>document.getElementById('help-dialog').scrollTop>100);
  expect(await page.evaluate(()=>window.starAgent.state.position)).toEqual(paused);
  expect(await page.evaluate(()=>window.starAgent.state.flightAssist)).toBe(true);
  await page.evaluate(()=>{window.testPad.axes[3]=0;});await frames();
  await page.locator('#controller-status').scrollIntoViewIfNeeded();
  await page.screenshot({path:'test-results/controller-help.png'});
  await press(9);await expect(page.locator('#help-dialog')).not.toBeVisible();
  await frames();expect(await page.evaluate(()=>window.starAgent.state.position)).toEqual(paused);
  await page.evaluate(()=>window.testPad.axes.fill(0));await button(11,false);await frames();
  await press(11);expect(await page.evaluate(()=>window.starAgent.state.flightAssist)).toBe(false);
  await press(11);
  await page.evaluate(()=>{window.testPad.connected=false;});await frames();
  expect(await page.evaluate(()=>window.starAgent.state.controller.connected)).toBe(false);
  await page.keyboard.down('w');await page.waitForFunction(()=>window.starAgent.state.speed>100);await page.keyboard.up('w');
  await page.keyboard.press('x');
  await page.evaluate(()=>{window.testPad.connected=true;window.testPad.axes[1]=-1;});await frames();
  expect(await page.evaluate(()=>window.starAgent.state.speed)).toBe(0);
  await page.evaluate(()=>window.testPad.axes.fill(0));await frames();
  await page.evaluate(()=>window.starAgent.transit('coast'));
  await page.waitForFunction(()=>!window.starAgent.state.transiting);await frames();
  await press(3);await page.waitForFunction(()=>window.starAgent.state.mode==='landed',null,{timeout:45000});
  await expect(page.locator('#state-text')).toContainText('X / □');
  await press(2);expect(await page.evaluate(()=>window.starAgent.state.mode)).toBe('walk');
  await page.evaluate(()=>{window.testPad.axes[1]=-.7;});
  await page.waitForFunction(()=>window.starAgent.state.shipLocal[2]>2.3);
  await page.evaluate(()=>window.testPad.axes.fill(0));await press(2);
  await page.waitForFunction(()=>window.starAgent.state.doorProgress===1);
  await page.screenshot({path:'test-results/controller-cabin.png'});
  expect(errors).toEqual([]);
});
