import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const out='/tmp/star-agent-effects-evidence';
function errorsFor(page){const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});return errors;}
test('production range compiles all shaders and renders all four effects',async({page,browser})=>{
 const errors=errorsFor(page);await mkdir(out,{recursive:true});await page.goto('/effects/');
 await page.waitForFunction(()=>window.effectsLab?.state.assetReady);const states={};
 for(const mode of ['engines','mining','weapons','travel']){
  await page.locator(`[data-scene="${mode}"]`).click();
  await page.waitForFunction(()=>window.effectsLab.state.particles>20);
  if(mode==='engines')await page.waitForFunction(()=>window.effectsLab.state.boost>.9);
  if(mode==='travel')await page.waitForFunction(()=>window.effectsLab.state.travel>.85);
  await page.waitForTimeout(900);states[mode]=await page.evaluate(()=>window.effectsLab.state);
  await page.screenshot({path:`${out}/${mode}.png`});
 }
 expect(states.engines.boost).toBeGreaterThan(.8);expect(states.mining.collectedBursts).toBeGreaterThan(0);expect(states.weapons.weaponShots).toBeGreaterThan(0);expect(states.travel.travel).toBeGreaterThan(.7);
 await page.locator('#motion').check();await page.waitForTimeout(500);expect(await page.evaluate(()=>window.effectsLab.state.travel)).toBe(0);
 await page.locator('[data-scene="engines"]').click();await page.locator('#pause').click();await page.locator('#bloom').uncheck();await page.screenshot({path:`${out}/bloom-off.png`});
 await page.locator('#bloom').check();await page.waitForTimeout(100);await page.screenshot({path:`${out}/bloom-on.png`});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:`${out}/mobile.png`});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);
 const gpu=await page.evaluate(()=>{const gl=window.effectsLab.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');return ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);});
 await writeFile(`${out}/environment.json`,JSON.stringify({browser:browser.version(),gpu,viewport:[1440,900],states,errors},null,2));expect(errors).toEqual([]);
});
test('game mining uses saved yields, flight emits pulses, and transit clears effects',async({page})=>{
 const errors=errorsFor(page);await page.goto('/?debug');await page.waitForFunction(()=>window.starAgent?.state.ready&&window.starAgent.state.mining.ready);
 await page.evaluate(()=>{const a=window.starAgent,n=a.navigation;n.transitMoon();const center=n.position.clone().fromArray(a.state.mining.position),up=n.normal,east=n.position.clone().set(1,0,0).cross(up).normalize();n.position.copy(center).addScaledVector(east,4.6).addScaledVector(up,.5);n.mode='walk';n.insideShip=false;n.velocity.set(0,0,0);n.orientToward(center,up);a.setRenderScale(.6);});
 await page.waitForFunction(()=>window.starAgent.state.mining.tool.hit!==null);
 await page.keyboard.down('t');await page.waitForFunction(()=>window.starAgent.state.effects.collectedBursts>2);await page.screenshot({path:`${out}/game-mining.png`});await page.keyboard.up('t');
 await page.waitForFunction(()=>!window.starAgent.state.mining.pending);const mined=await page.evaluate(()=>window.starAgent.state);expect(mined.mining.pack.reduce((a,b)=>a+b,0)).toBeGreaterThan(0);expect(mined.effects.miningContacts).toBeGreaterThan(0);
 await page.keyboard.press('h');await page.waitForFunction(()=>!window.starAgent.state.mining.tool.beaming);await page.keyboard.press('Escape');
 await page.keyboard.press('o');await page.waitForFunction(()=>!window.starAgent.state.transiting);expect(await page.evaluate(()=>window.starAgent.state.effects.collectedBursts)).toBe(mined.effects.collectedBursts);
 await page.keyboard.down('j');await page.waitForFunction(()=>window.starAgent.state.effects.weaponShots>1);await page.keyboard.up('j');
 await page.keyboard.down('w');await page.keyboard.down('Shift');await page.waitForFunction(()=>window.starAgent.state.effects.travel>.3);await page.screenshot({path:`${out}/game-travel.png`});await page.keyboard.up('w');await page.keyboard.up('Shift');
 expect(errors).toEqual([]);
});
