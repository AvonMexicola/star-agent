import {test,expect} from '@playwright/test';
import {steer} from '../tests/browser/navigation-helpers.js';
import {mkdir,writeFile} from 'node:fs/promises';
const evidence='/tmp/star-agent-stellar';
test('star renders at observation distance, damages the hull and permits explicit recovery',async({page,browser})=>{
 await mkdir(evidence,{recursive:true});const errors=[],states=[];
 page.on('pageerror',e=>{errors.push(e.message);console.log(e.message);});page.on('console',m=>{if(m.type()==='error'){errors.push(m.text());console.log(m.text().slice(0,1800));}});
 await page.goto('/?intro=0&debug&epoch=1788000000000');await page.waitForFunction(()=>window.starAgent?.state.ready);
 await page.evaluate(()=>window.starAgent.setRenderScale(.5));
 // A physical diameter, not a special Pyre-only scale adjustment.
 const aeonAngle=await page.evaluate(()=>window.starAgent.state.sun.angularRadius);
 await page.evaluate(()=>{const s=window.starAgent,n=s.navigation;n.transitPyre();n.orientToward(n.position.clone().addScaledVector(n.sunDirection,10000000),n.normal);});
 await page.waitForFunction(()=>window.starAgent.state.body==='pyre');await page.waitForTimeout(1500);
 expect(await page.evaluate(()=>window.starAgent.state.sun.angularRadius)).toBeGreaterThan(aeonAngle*2.4);
 await page.keyboard.press('Shift+Tab');await page.screenshot({path:`${evidence}/from-pyre.png`});await page.keyboard.press('Shift+Tab');
 await page.keyboard.press('h');await page.locator('#quick-transit-menu > summary').click();await page.locator('[data-destination="star"]').click();
 await page.waitForFunction(()=>window.starAgent.state.body==='star'&&!window.starAgent.state.transiting,null,{timeout:120000});
 await page.evaluate(async()=>{window.starAgent.setRenderScale(1);for(let i=0;i<4;i++)await new Promise(r=>requestAnimationFrame(r));});
 let s=await page.evaluate(()=>window.starAgent.state);states.push(s);expect(s.sun.clearance).toBeCloseTo(500000000,-1);expect(s.stellarThermal.hull).toBe(100);expect(s.sun.sphereVisible).toBe(true);expect(errors).toEqual([]);
 await page.keyboard.press('Shift+Tab');await page.screenshot({path:`${evidence}/observation.png`});
 await page.waitForTimeout(3000);await page.screenshot({path:`${evidence}/observation-later.png`});await page.keyboard.press('Shift+Tab');
 await page.locator('#viewport').click();await page.waitForFunction(()=>window.starAgent.state.mfds[2].values.some(v=>v.includes('SHIELD TEMPERATURE')));
 await page.screenshot({path:`${evidence}/cockpit.png`});await page.keyboard.press('Escape');
 await page.evaluate(()=>{const n=window.starAgent.navigation;n.updateStellarThermal(120);});
 expect(await page.evaluate(()=>window.starAgent.state.stellarThermal.hull)).toBe(100);
 // Advance thermal simulation at a fixed real position; never set hull or temperature.
 await page.evaluate(()=>{const n=window.starAgent.navigation;n.position.addScaledVector(n.sunDirection,350000000);n.updateStellarThermal(45);window.starAgent.setRenderScale(.5);});
 await page.waitForFunction(()=>window.starAgent.state.stellarThermal.hull<100);
 s=await page.evaluate(()=>window.starAgent.state);expect(s.mode).toBe('flight');expect(s.stellarThermal.hull).toBeGreaterThan(0);states.push(s);
 await expect(page.locator('#stellar-status')).toHaveText('THERMAL DAMAGE · RETREAT');await page.screenshot({path:`${evidence}/thermal-warning.png`});
 await page.evaluate(()=>{const n=window.starAgent.navigation;n.updateStellarThermal(120);});
 await page.waitForFunction(()=>window.starAgent.state.mode==='destroyed');await expect(page.locator('#stellar-loss')).toBeVisible();
 const destroyed=await page.evaluate(()=>window.starAgent.state.position);await page.keyboard.press('l');await page.keyboard.press('f');await page.keyboard.press('j');await page.keyboard.press('w');
 expect(await page.evaluate(()=>window.starAgent.state.mode)).toBe('destroyed');expect(await page.evaluate(()=>window.starAgent.state.position)).toEqual(destroyed);
 await page.screenshot({path:`${evidence}/destroyed.png`});await page.locator('#stellar-recover').click();await page.waitForFunction(()=>window.starAgent.state.body==='aeon');
 expect(await page.evaluate(()=>window.starAgent.state.stellarThermal.hull)).toBe(100);await expect(page.locator('#stellar-loss')).toBeHidden();
 await page.keyboard.press('m');await page.locator('[data-travel-target="star"]').click();await expect(page.locator('#map-approach')).toHaveText('500,000 km');await page.screenshot({path:`${evidence}/map.png`});
 const gl=await page.evaluate(()=>{const gl=document.querySelector('canvas').getContext('webgl2'),e=gl.getExtension('WEBGL_debug_renderer_info');return gl.getParameter(e.UNMASKED_RENDERER_WEBGL);});
 await writeFile(`${evidence}/environment.json`,JSON.stringify({browser:browser.version(),backend:gl,viewport:[1100,750],states,errors},null,2));expect(errors).toEqual([]);
});


test('the system drive continuously reaches the stellar observation point',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto('/?intro=0&debug&epoch=1788000000000');await page.waitForFunction(()=>window.starAgent?.state.ready);await page.evaluate(()=>window.starAgent.setRenderScale(.4));
 await page.keyboard.press('m');await page.locator('[data-travel-target="star"]').click();await expect(page.locator('#map-engage')).toBeEnabled();
 const start=await page.evaluate(()=>window.starAgent.state.position);await page.locator('#map-engage').click();await steer(page,'star','keyboard');await page.keyboard.press('n');
 await page.waitForFunction(()=>window.starAgent.state.travel?.phase==='cruising',null,{timeout:90000});
 const during=await page.evaluate(()=>window.starAgent.state);expect(during.position).not.toEqual(start);expect(during.travel.progress).toBeGreaterThan(0);expect(during.travel.progress).toBeLessThan(1);
 await page.waitForFunction(()=>!window.starAgent.state.travel&&window.starAgent.state.body==='star',null,{timeout:240000});
 const arrived=await page.evaluate(()=>window.starAgent.state);expect(arrived.sun.clearance).toBeCloseTo(500000000,-1);expect(arrived.stellarThermal.hull).toBe(100);
 await page.keyboard.press('Shift+Tab');await page.screenshot({path:`${evidence}/drive-arrival.png`});
 // Retreat is normal thrust and must increase the actual distance from the star.
 await page.keyboard.down('Space');await page.keyboard.down('Shift');
 await page.waitForFunction(d=>window.starAgent.state.sun.distance>d+1000000,arrived.sun.distance,{timeout:30000});
 await page.keyboard.up('Space');await page.keyboard.up('Shift');await page.keyboard.press('x');
 expect(errors).toEqual([]);await writeFile(`${evidence}/drive.json`,JSON.stringify({start,during,arrived,errors},null,2));
});


test('stellar composite preserves Aeon, Selene and Pyre rendering',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto('/?intro=0&debug&epoch=1788000000000');await page.waitForFunction(()=>window.starAgent?.state.ready);await page.keyboard.press('Shift+Tab');
 await page.evaluate(()=>window.starAgent.setRenderScale(.5));
 for(const body of ['aeon','selene','pyre']){
  await page.evaluate(body=>{const s=window.starAgent,n=s.navigation;if(body==='aeon')n.orbit();else if(body==='selene'){n.transitMoon(1000000);n.orientToward(n.position.clone().addScaledVector(n.normal,-1000000),n.normal.clone().set(0,1,0));}else n.transitPyre();},body);
  await page.waitForFunction(body=>window.starAgent.state.body===body,body);await page.waitForTimeout(2000);
  await page.screenshot({path:`${evidence}/${body}-regression.png`});expect(errors).toEqual([]);
 }
});
