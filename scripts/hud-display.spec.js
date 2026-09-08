import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const output='/tmp/star-agent-hud-qa';
const frames=page=>page.evaluate(async()=>{for(let i=0;i<4;i++)await new Promise(requestAnimationFrame);});
async function start(page,{controller=false}={}){
  const errors=[],warnings=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());if(m.type()==='warning')warnings.push(m.text());});
  if(controller)await page.addInitScript(()=>{
    window.hudPad={id:'Standard HUD controller',index:0,connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};
    Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[window.hudPad]});
  });
  await page.goto('/?dev=1&debug=1&ship=nomad&start=orbit&intro=0&seed=7291');
  await page.waitForFunction(()=>window.starAgent?.state.ready&&window.starAgent.state.enabled,undefined,{timeout:90000});
  await expect(page.locator('#loading')).toHaveClass(/hidden/);await frames(page);
  await mkdir(output,{recursive:true});
  return async name=>{
    const renderer=await page.evaluate(()=>{const gl=document.querySelector('canvas').getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');return ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);});
    await writeFile(`${output}/${name}.json`,JSON.stringify({browser:page.context().browser().version(),renderer,viewport:page.viewportSize(),errors,warnings},null,2));
    expect(errors).toEqual([]);
  };
}
async function mode(page,value){await expect(page.locator('body')).toHaveAttribute('data-hud-mode',value);}
async function capture(page,name){await frames(page);await page.screenshot({path:`${output}/${name}.png`});}

test('Tab cycles full → markers and reticle → none, preserving dialogs and target selection',async({page})=>{
  const finish=await start(page);
  await mode(page,'full');await expect(page.locator('.telemetry')).toBeVisible();await capture(page,'desktop-full');
  const target=await page.evaluate(()=>window.starAgent.state.combat.targetId);
  await page.keyboard.down('Tab');await mode(page,'markers');
  await page.keyboard.down('Tab');await mode(page,'markers');await page.keyboard.up('Tab');
  await expect(page.locator('.telemetry')).toBeHidden();await expect(page.locator('#reticle')).toBeVisible();
  await expect(page.locator('#navigation-markers')).toBeVisible();await capture(page,'desktop-markers');
  await page.keyboard.press('Tab');await mode(page,'none');await expect(page.locator('#reticle')).toBeHidden();
  const overlays=await page.evaluate(()=>[...document.body.children].filter(e=>!e.matches('canvas,dialog,script,style,link,#loading,#transit,#stellar-loss,#crash-panel')&&e.getClientRects().length&&getComputedStyle(e).display!=='none').map(e=>e.id||e.tagName));
  expect(overlays).toEqual([]);await capture(page,'desktop-none');
  expect(await page.evaluate(()=>window.starAgent.state.combat.targetId)).toBe(target);
  await page.keyboard.press('Escape');await expect(page.locator('dialog[open]')).toBeVisible();
  await page.locator('dialog[open] [data-tab="settings"]').click();await expect(page.locator('#hud-display-button')).toContainText('No HUD');
  await page.keyboard.press('Tab');await mode(page,'none');
  await page.keyboard.press('Escape');await page.keyboard.press('Tab');await mode(page,'full');
  await page.keyboard.press('KeyH');await page.locator('#seed-input').focus();await page.keyboard.press('Tab');await mode(page,'full');
  await page.keyboard.press('Escape');await finish('keyboard');
});

test('controller-only Settings journey cycles all modes and preserves neutral-input gates',async({page})=>{
  const finish=await start(page,{controller:true});
  await page.waitForFunction(()=>window.starAgent.state.controller.armed);
  const button=async(i,down)=>{await page.evaluate(({i,down})=>hudPad.buttons[i]={pressed:down,value:+down},{i,down});await frames(page);};
  const tap=async i=>{await button(i,true);await button(i,false);};
  await tap(9);await expect(page.locator('dialog[open]')).toBeVisible();
  for(let i=0;i<10&&await page.locator('dialog[open]').getAttribute('data-gameplay-tab')!=='settings';i++)await tap(5);
  await expect(page.locator('#graphics-settings')).toBeVisible();
  for(let i=0;i<30&&!await page.locator('#hud-display-button').evaluate(e=>e===document.activeElement);i++)await tap(13);
  await expect(page.locator('#hud-display-button')).toBeFocused();
  for(const value of ['markers','none','full','markers','none']){
    await button(0,true);await mode(page,value);await frames(page);await mode(page,value);await button(0,false);
  }
  await capture(page,'controller-settings');
  await button(7,true);await tap(1);await mode(page,'none');
  const shots=await page.evaluate(()=>window.starAgent.state.effects.weaponShots);
  for(const event of ['blur','disconnect']){
    await page.evaluate(event=>{if(event==='blur')window.dispatchEvent(new Event('blur'));else hudPad.connected=false;},event);await frames(page);
    await page.evaluate(()=>{hudPad.connected=true;window.dispatchEvent(new Event('focus'));});await frames(page);
    expect(await page.evaluate(()=>window.starAgent.state.controller.armed)).toBe(false);
    expect(await page.evaluate(()=>window.starAgent.state.effects.weaponShots)).toBe(shots);await mode(page,'none');
  }
  await button(7,false);await page.waitForFunction(()=>window.starAgent.state.controller.armed);
  await tap(9);await expect(page.locator('#graphics-settings')).toBeVisible();
  for(let i=0;i<30&&!await page.locator('#hud-display-button').evaluate(e=>e===document.activeElement);i++)await tap(13);
  await tap(0);await mode(page,'full');await tap(1);
  expect(await page.evaluate(()=>window.starAgent.state.enabled)).toBe(true);await finish('controller');
});

test('native phone touch can choose each view and restore a hidden HUD without visible controls',async({browser})=>{
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
  const page=await context.newPage();const finish=await start(page);const cdp=await context.newCDPSession(page);
  const restore=async()=>{await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,x:150,y:400},{id:2,x:230,y:400}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await mode(page,'full');};
  await capture(page,'phone-full');
  for(const value of ['markers','none']){
    await page.locator('[data-cabin-menu]').tap();await page.locator('dialog[open] [data-tab="settings"]').tap();
    await page.locator('#hud-display-button').tap();if(value==='none')await page.locator('#hud-display-button').tap();await mode(page,value);
    await capture(page,`phone-settings-${value}`);
    const bounds=await page.locator('#hud-display-button').boundingBox();expect(bounds.y+bounds.height).toBeLessThan(790);
    await page.locator('dialog[open] .gameplay-resume').tap();await capture(page,`phone-${value}`);
    await expect(page.locator('[data-cabin-menu]')).toBeHidden();await restore();await expect(page.locator('[data-cabin-menu]')).toBeVisible();
  }
  await finish('touch');await context.close();
});
