import {test,expect} from '@playwright/test';
const errorsFor=page=>{const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});return errors;};
const ready=async page=>{await page.waitForFunction(()=>window.starAgent?.state.ready);await page.evaluate(()=>window.starAgent.setRenderScale(.55));};
const playerOnly=async page=>{
  await expect(page.locator('.topbar')).toBeHidden();await expect(page.locator('.mission-panel')).toBeHidden();await expect(page.locator('.statusbar')).toBeHidden();
  await expect(page.locator('.telemetry')).toBeVisible();await expect(page.locator('#flight-state')).toBeVisible();
  await expect(page.locator('[data-destination]:visible')).toHaveCount(0);
  expect(await page.locator('.topbar').evaluate(e=>e.inert)).toBe(true);
};

test('W dismisses launcher; H exposes collapsed shortcuts without restoring it',async({page})=>{
  const errors=errorsFor(page);await page.goto('/?debug');await ready(page);
  await expect(page.locator('[data-destination]:visible')).toHaveCount(0);
  await page.keyboard.press('w');await page.waitForFunction(()=>window.starAgent.state.opening.phase==='playing');await playerOnly(page);
  await page.keyboard.press('Escape');await playerOnly(page);
  await page.screenshot({path:'/tmp/star-agent-player-ui-walk.png'});
  await page.keyboard.press('h');await expect(page.locator('#help-dialog')).toBeVisible();await expect(page.locator('#quick-transit-menu')).not.toHaveAttribute('open','');
  await page.locator('#quick-transit-menu > summary').click();await expect(page.locator('[data-destination]:visible')).toHaveCount(7);
  await page.screenshot({path:'/tmp/star-agent-player-ui-menu.png'});
  const position=await page.evaluate(()=>window.starAgent.state.position);
  await page.locator('[data-destination="moon"]').click({modifiers:['Shift']});
  await expect(page.locator('#help-dialog')).toBeHidden();expect(await page.evaluate(()=>window.starAgent.state.position)).toEqual(position);
  await expect(page.locator('#course-guidance')).toContainText('Selene');await playerOnly(page);
  await page.keyboard.press('h');await expect(page.locator('[data-destination]:visible')).toHaveCount(0);
  await page.locator('#map-button').click();await expect(page.locator('#system-map')).toBeVisible();
  expect(await page.evaluate(()=>window.starAgent.navigation.enabled)).toBe(false);
  await page.keyboard.press('m');await playerOnly(page);expect(await page.evaluate(()=>window.starAgent.navigation.enabled)).toBe(true);
  await page.keyboard.press('h');await page.locator('#quick-transit-menu > summary').click();await page.locator('[data-destination="orbit"]').click();
  await page.waitForFunction(()=>!window.starAgent.state.transiting);await playerOnly(page);
  await page.keyboard.press('h');await page.setViewportSize({width:390,height:844});await page.locator('#quick-transit-menu > summary').click();
  const bounds=await page.locator('.destination').evaluateAll(nodes=>nodes.map(n=>{const b=n.getBoundingClientRect();return [b.left,b.right];}));
  expect(bounds.every(([l,r])=>l>=0&&r<=390)).toBe(true);await expect(page.locator('#sound-button')).toBeVisible();
  await page.screenshot({path:'/tmp/star-agent-player-ui-mobile-menu.png'});expect(errors).toEqual([]);
});

test('left-stick handover dismisses launcher and controller Menu remains available',async({page})=>{
  const errors=errorsFor(page);
  await page.addInitScript(()=>{window.uiPad={id:'UI test pad',index:0,connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};Object.defineProperty(navigator,'getGamepads',{value:()=>[window.uiPad]});});
  await page.goto('/?debug');await ready(page);
  await page.evaluate(()=>{window.uiPad.buttons[0]={pressed:true,value:1};});await page.waitForTimeout(250);
  await page.evaluate(()=>{window.uiPad.buttons[0]={pressed:false,value:0};});await page.waitForTimeout(250);
  await page.evaluate(()=>{window.uiPad.axes[1]=-.8;});await page.waitForFunction(()=>window.starAgent.state.opening.phase==='playing');
  await page.evaluate(()=>{window.uiPad.axes[1]=0;});await playerOnly(page);
  await page.evaluate(()=>{window.uiPad.buttons[9]={pressed:true,value:1};});await expect(page.locator('#help-dialog')).toBeVisible();
  await page.evaluate(()=>{window.uiPad.buttons[9]={pressed:false,value:0};});await page.waitForTimeout(250);
  await page.evaluate(()=>{window.uiPad.buttons[9]={pressed:true,value:1};});await expect(page.locator('#help-dialog')).toBeHidden();
  await page.evaluate(()=>{window.uiPad.buttons[9]={pressed:false,value:0};});await playerOnly(page);expect(errors).toEqual([]);
});

test('orbital opt-out dismisses the launcher on keyboard movement',async({page})=>{
  await page.goto('/?intro=0&debug');await ready(page);await expect(page.locator('.topbar')).toBeVisible();
  await page.keyboard.press('w');await playerOnly(page);await page.keyboard.press('h');await page.keyboard.press('h');await playerOnly(page);
});
