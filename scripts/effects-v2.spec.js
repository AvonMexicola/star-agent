import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const out='/tmp/star-agent-effects-v2';
test('slipstream and three distinct colorable weapons render in production',async({page,browser})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});await mkdir(out,{recursive:true});await page.goto('/effects/');await page.waitForFunction(()=>window.effectsLab?.state.assetReady);
 await page.locator('[data-scene="travel"]').click();await page.waitForFunction(()=>window.effectsLab.state.slipstream>.9);await page.screenshot({path:`${out}/slipstream.png`});
 await page.locator('#motion').check();await page.waitForFunction(()=>window.effectsLab.state.slipstream===0);await page.screenshot({path:`${out}/reduced-motion.png`});await page.locator('#motion').uncheck();
 await page.locator('[data-scene="weapons"]').click();
 for(const weapon of ['pulse','laser','void']){
  await page.locator(`[data-weapon="${weapon}"]`).click();await page.waitForFunction(id=>window.effectsLab.state.lastWeapon===id&&window.effectsLab.state.particles>35,weapon);
  if(weapon==='laser')await page.waitForFunction(()=>{if(window.effectsLab.state.lances>0){document.querySelector('#pause').click();return true;}return false;});
  else await page.waitForTimeout(800);
  await page.screenshot({path:`${out}/${weapon}.png`});if(weapon==='laser')await page.locator('#pause').click();
 }
 await page.locator('[data-weapon="laser"]').click();await page.locator('[data-color="viridian"]').click();await page.waitForFunction(()=>{if(window.effectsLab.state.lances>0){document.querySelector('#pause').click();return true;}return false;});await page.screenshot({path:`${out}/viridian-lance.png`});await page.locator('#pause').click();
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:`${out}/mobile-arsenal.png`});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);
 const gpu=await page.evaluate(()=>{const gl=window.effectsLab.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');return ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);});await writeFile(`${out}/range.json`,JSON.stringify({browser:browser.version(),gpu,errors},null,2));expect(errors).toEqual([]);
});

test('ground keyboard and touch fire, switching and modal focus require fresh input',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/?debug');await page.waitForFunction(()=>window.starAgent?.state.ready&&window.starAgent.state.mining.ready);
 // Focused keyboard/touch regression fixture; controller acceptance above uses
 // the complete physical route with no such setup mutation.
 await page.evaluate(()=>{const a=window.starAgent,n=a.navigation;n.transitMoon();const center=n.position.clone().fromArray(a.state.mining.position),up=n.normal,east=n.position.clone().set(1,0,0).cross(up).normalize();n.position.copy(center).addScaledVector(east,4.6).addScaledVector(up,.5);n.mode='walk';n.insideShip=false;n.velocity.set(0,0,0);n.orientToward(center,up);a.setRenderScale(.6);});
 await page.waitForFunction(()=>window.starAgent.state.mining.tool.active);
 await page.route('**/models/props/*',async route=>{await new Promise(r=>setTimeout(r,300));await route.continue();});
 for(const key of ['1','2','3'])await page.keyboard.press(key);await page.waitForTimeout(1200);expect(await page.evaluate(()=>window.starAgent.state.mining.tool.mountedItems)).toEqual(['mining-laser-tool']);
 await page.keyboard.press('1');await page.keyboard.down('t');await page.waitForFunction(()=>window.starAgent.state.effects.weaponImpacts>0);
 await page.keyboard.press('2');await page.waitForTimeout(400);const selected=await page.evaluate(()=>window.starAgent.state.effects.weaponShots);
 await page.keyboard.down('t');await page.waitForTimeout(300);expect(await page.evaluate(()=>window.starAgent.state.effects.weaponShots)).toBe(selected);
 await page.keyboard.up('t');await page.keyboard.down('t');await page.waitForFunction(n=>window.starAgent.state.effects.weaponShots>n,selected);
 await page.keyboard.press('h');await page.keyboard.press('Escape');const paused=await page.evaluate(()=>window.starAgent.state.effects.weaponShots);
 await page.keyboard.down('t');await page.waitForTimeout(350);expect(await page.evaluate(()=>window.starAgent.state.effects.weaponShots)).toBe(paused);await page.keyboard.up('t');
 const target=await page.locator('.mining-trigger').boundingBox(),before=await page.evaluate(()=>window.starAgent.state.effects.weaponShots),cdp=await page.context().newCDPSession(page);
 await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:true});await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:target.x+target.width/2,y:target.y+target.height/2}]});await page.waitForFunction(n=>window.starAgent.state.effects.weaponShots>n,before);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 expect(await page.evaluate(()=>window.starAgent.state.mining.revision)).toBe(0);expect(errors).toEqual([]);
});
