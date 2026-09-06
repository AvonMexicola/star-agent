import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const out='/tmp/star-agent-loadout-evidence';
test('equipment saves, medical slots work on an injured save, and mouse/touch can manage gear on mobile',async({page,browser})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});await mkdir(out,{recursive:true});
  await page.goto('/?intro=0&debug');await page.waitForFunction(()=>window.starAgent?.state.ready);
  await page.keyboard.press('k');await expect(page.locator('.inventory-equipment')).toBeVisible();
  await page.locator('[data-equipment-slot="tool"]').click();await page.locator('[data-controller-key="stow-tool-pack"]').click();expect(await page.evaluate(()=>window.starAgent.state.loadout.slots.tool)).toBeNull();
  await page.locator('[data-controller-key="assign-tool-pack-mining-laser-tool"]').click();await page.locator('[data-controller-key="draw-tool"]').click();
  const before=await page.evaluate(()=>window.starAgent.state.loadout);await page.reload();await page.waitForFunction(()=>window.starAgent?.state.ready);expect(await page.evaluate(()=>window.starAgent.state.loadout)).toEqual(before);
  // Injured save fixture only. The game currently has no ambient injury source.
  await page.evaluate(()=>{const key='star-agent.selene-mining.v1',save=JSON.parse(localStorage.getItem(key));save.loadout.health=45;save.loadout.bleeding=true;localStorage.setItem(key,JSON.stringify(save));});
  await page.reload();await page.waitForFunction(()=>window.starAgent?.state.ready);await page.keyboard.press('k');
  await page.locator('[data-equipment-slot="quick1"]').click();await page.locator('[data-controller-key="use-quick1"]').click();
  expect(await page.evaluate(()=>window.starAgent.state.loadout.health)).toBe(60);expect(await page.evaluate(()=>window.starAgent.state.loadout.bleeding)).toBe(false);
  await page.locator('[data-equipment-slot="quick2"]').click();await page.locator('[data-controller-key="use-quick2"]').click();expect(await page.evaluate(()=>window.starAgent.state.loadout.health)).toBe(100);
  await page.locator('[data-controller-key="use-quick2"]').click();await expect(page.locator('.cargo-feedback')).toContainText('Item retained');
  await page.locator('[data-equipment-slot="backpack"]').click();await page.locator('[data-controller-key="stow-backpack-ship"]').click();await expect(page.locator('.cargo-feedback')).toContainText('Empty the backpack');
  await page.setViewportSize({width:390,height:844});await page.locator('#cargo-dialog').evaluate(el=>el.scrollTop=0);await page.screenshot({path:`${out}/equipment-mobile.png`});
  expect(await page.locator('#cargo-dialog').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
  const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:true});
  const slot=page.locator('[data-equipment-slot="weapon1"]');await slot.scrollIntoViewIfNeeded();const b=await slot.boundingBox();
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:b.x+b.width/2,y:b.y+b.height/2}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await expect(slot).toHaveAttribute('aria-pressed','true');await page.locator('[data-controller-key="draw-weapon1"]').click();
  await page.locator('.inventory-close').click();await expect(page.locator('#cargo-dialog')).not.toBeVisible();
  const final=await page.evaluate(()=>window.starAgent.state.loadout);await page.reload();await page.waitForFunction(()=>window.starAgent?.state.ready);expect(await page.evaluate(()=>window.starAgent.state.loadout)).toEqual(final);
  const renderer=await page.evaluate(()=>{const gl=document.getElementById('viewport').getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');return ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);});
  await writeFile(`${out}/ui.json`,JSON.stringify({browser:browser.version(),renderer,viewports:[[1440,900],[390,844]],fixture:'Medical test starts from an injured save; no natural gameplay injury claimed.',before,final,errors},null,2));expect(errors).toEqual([]);
});
