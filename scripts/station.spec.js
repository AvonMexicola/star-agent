import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

async function openQuickTransit(page){
  await page.keyboard.press('KeyH');
  await expect(page.locator('#help-dialog')).toBeVisible();
  const menu=page.locator('#quick-transit-menu');
  const summary=page.locator('#quick-transit-menu > summary');
  await expect(summary).toHaveText('Quick transit');
  await expect.poll(()=>menu.evaluate(element=>element.open)).toBe(false);
  await summary.click();
  await expect.poll(()=>menu.evaluate(element=>element.open)).toBe(true);
  return menu;
}
async function chooseDestination(page,name,modifiers=[]){
  const menu=await openQuickTransit(page);
  await menu.locator(`[data-destination="${name}"]`).click({modifiers});
  await expect(page.locator('#help-dialog')).toBeHidden();
  await expect.poll(()=>menu.evaluate(element=>element.open)).toBe(false);
}

test('fly through station doors, dock, walk down the ramp onto deck, return and launch', async ({ page, browser }, testInfo) => {
  const errors=[],captures=[];
  await mkdir('/tmp/star-agent-station',{recursive:true});
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  await page.goto('/?intro=0&seed=7291&debug=1');
  await page.waitForFunction(()=>window.starAgent?.state.ready&&window.starAgent.state.station.ready);
  await page.evaluate(()=>window.starAgent.setRenderScale(.4));
  const before=await page.evaluate(()=>window.starAgent.state.position);
  await chooseDestination(page,'station',['Shift']);
  expect(await page.evaluate(()=>window.starAgent.state.position)).toEqual(before);
  await expect(page.locator('#course-guidance')).toContainText('Aeon Orbital');
  await chooseDestination(page,'station');
  await page.waitForFunction(()=>!window.starAgent.state.transiting);
  const backend=await page.evaluate(()=>{
    const gl=document.querySelector('canvas').getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');
    return ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);
  });
  const capture=async name=>{
    await page.evaluate(async()=>{window.starAgent.setRenderScale(1);await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
    const path=`/tmp/star-agent-station/${name}.png`;await page.screenshot({path});await testInfo.attach(name,{path,contentType:'image/png'});
    captures.push({name,state:await page.evaluate(()=>window.starAgent.state)});
    console.log(name,captures.at(-1).state.station);expect(errors).toEqual([]);
    await page.evaluate(()=>window.starAgent.setRenderScale(.4));
  };
  await capture('approach');
  await page.waitForFunction(()=>window.starAgent.state.station.doorsOpen>.99);
  // After this optional starting shortcut, the entire journey uses play controls.
  await page.keyboard.down('KeyW');
  await page.waitForFunction(()=>window.starAgent.state.station.local[2]>0,null,{timeout:150000});
  await page.keyboard.up('KeyW');await page.keyboard.press('KeyX');
  expect(await page.evaluate(()=>window.starAgent.state.station.canDock)).toBe(true);
  await page.keyboard.press('KeyL');
  await page.waitForFunction(()=>window.starAgent.state.station.docked);
  await capture('docked');
  await page.keyboard.press('KeyF');
  await page.keyboard.down('KeyW');
  await page.waitForFunction(()=>window.starAgent.state.shipLocal[2]>2.2);
  await page.keyboard.up('KeyW');await page.keyboard.press('KeyX');await page.keyboard.press('KeyF');
  await page.waitForFunction(()=>window.starAgent.state.doorProgress===1);
  await page.keyboard.down('KeyW');
  await page.waitForFunction(()=>window.starAgent.state.shipLocal[2]>9);
  await page.keyboard.up('KeyW');await page.keyboard.press('KeyX');
  const outside=await page.evaluate(()=>window.starAgent.state);
  expect(outside.insideShip).toBe(false);expect(outside.station.docked).toBe(true);
  expect(outside.station.deckClearance).toBeCloseTo(1.75,3);
  expect(outside.altitude).toBeGreaterThan(99000);
  await page.evaluate(()=>window.starAgent.navigation.look(Math.PI,0));
  await capture('hangar-deck');
  await page.evaluate(()=>window.starAgent.navigation.look(-Math.PI,0));
  await page.keyboard.press('KeyF');
  expect(await page.evaluate(()=>window.starAgent.state.mode)).toBe('walk');
  await page.keyboard.down('KeyS');
  await page.waitForFunction(()=>window.starAgent.state.shipLocal[2]<-1.4);
  await page.keyboard.up('KeyS');await page.keyboard.press('KeyX');await page.keyboard.press('KeyF');
  await page.waitForFunction(()=>window.starAgent.state.mode==='landed');
  const launchStart=await page.evaluate(()=>window.starAgent.state.position);
  await page.keyboard.press('KeyL');
  const launch=await page.evaluate(()=>window.starAgent.state);
  expect(launch.mode).toBe('flight');
  expect(Math.hypot(...launch.position.map((v,i)=>v-launchStart[i]))).toBeLessThan(2);
  await page.waitForFunction(()=>!window.starAgent.state.station.lifting);
  expect(await page.evaluate(()=>window.starAgent.state.station.deckClearance)).toBeLessThan(7);
  await page.keyboard.down('KeyS');
  await page.waitForFunction(()=>window.starAgent.state.station.local[2]<-70);
  await page.keyboard.up('KeyS');await page.keyboard.press('KeyX');
  await capture('departed');
  let menu=await openQuickTransit(page);
  const desktop=await menu.evaluate(element=>({
    menu:element.getBoundingClientRect().toJSON(),
    buttons:[...element.querySelectorAll('.destination')].map(button=>button.getBoundingClientRect().toJSON()),
  }));
  expect(desktop.buttons).toHaveLength(7);
  expect(desktop.buttons.every(button=>button.width>0&&button.left>=desktop.menu.left&&button.right<=desktop.menu.right)).toBe(true);
  await page.keyboard.press('KeyH');
  await expect(page.locator('#help-dialog')).toBeHidden();
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(async()=>{window.starAgent.setRenderScale(.4);await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
  menu=await openQuickTransit(page);
  const mobile=await menu.evaluate(element=>({
    menu:element.getBoundingClientRect().toJSON(),
    buttons:[...element.querySelectorAll('.destination')].map(button=>button.getBoundingClientRect().toJSON()),
  }));
  expect(mobile.buttons).toHaveLength(7);
  expect(mobile.menu.left).toBeGreaterThanOrEqual(0);
  expect(mobile.menu.right).toBeLessThanOrEqual(390);
  expect(mobile.buttons.every(button=>button.width>0&&button.left>=mobile.menu.left&&button.right<=mobile.menu.right)).toBe(true);
  await page.screenshot({path:'/tmp/star-agent-station/mobile-controls.png'});
  await writeFile('/tmp/star-agent-station/render-environment.json' ,JSON.stringify({browser:browser.version(),backend,viewport:{width:1440,height:900},captures},null,2));
  expect(errors).toEqual([]);
});
