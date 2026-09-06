import {test,expect} from '@playwright/test';

test('controller recovers a destroyed ship through the command menu and reaches fleet registry',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.addInitScript(()=>{
    window.recoveryPad={id:'Integration recovery pad',index:0,mapping:'standard',connected:true,axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};navigator.getGamepads=()=>[window.recoveryPad];
  });
  await page.goto('/?intro=0&debug&seed=7291');await page.waitForFunction(()=>window.starAgent?.state.ready&&starAgent.state.controller.armed);
  await page.evaluate(()=>{
    starAgent.setRenderScale(.55);const n=starAgent.navigation;n.transit(starAgent.destinations.forest,10);n.flightAssist=false;n.velocity.copy(n.normal).multiplyScalar(-100);
  });
  await page.waitForFunction(()=>starAgent.state.mode==='crashed');const wreck=await page.evaluate(()=>starAgent.state.position);
  const tap=async i=>{
    await page.evaluate(i=>window.recoveryPad.buttons[i]={pressed:true,value:1},i);await page.waitForFunction(i=>starAgent.navigation.gamepad.previous[i],i);
    await page.evaluate(i=>window.recoveryPad.buttons[i]={pressed:false,value:0},i);await page.waitForFunction(i=>!starAgent.navigation.gamepad.previous[i],i);
  };
  const choose=async key=>{
    await tap(9);await expect(page.locator('#controller-menu')).toBeVisible();
    for(let i=0;i<60;i++){if(await page.locator(`[data-controller-key="${key}"]`).evaluate(el=>el===document.activeElement))break;await tap(13);}
    await expect(page.locator(`[data-controller-key="${key}"]`)).toBeFocused();await tap(0);
  };
  await choose('crash-recover');await page.waitForFunction(()=>starAgent.state.mode==='flight'&&!starAgent.state.crash&&!starAgent.state.transiting);
  expect(await page.evaluate(()=>starAgent.state.position)).not.toEqual(wreck);
  await page.waitForFunction(()=>starAgent.state.controller.armed);await choose('fleet');await expect(page.locator('#fleet-dialog')).toBeVisible();await tap(1);await expect(page.locator('#fleet-dialog')).toBeHidden();
  expect(errors).toEqual([]);
});
