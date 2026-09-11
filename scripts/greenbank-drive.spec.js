import {test,expect} from '@playwright/test';
import {setupNavigation,frames} from '../tests/browser/navigation-helpers.js';
import {mkdir,writeFile} from 'node:fs/promises';
const out=process.env.GREENBANK_OUT||'/tmp/star-agent-greenbank-evidence';
const greenbank='settlement-aeon';
// Read the live bearing; steer exclusively through the standard Gamepad sticks.
async function aim(page,id,{ready=true}={}){
 await page.evaluate(id=>{window.greenbankPilot=setInterval(()=>{
  const n=window.starAgent.navigation,t=window.starAgent.state.navigationTargets.targets.find(t=>t.id===id);
  const p=n.viewPoint(n.position.clone().fromArray(t.center)).sub(n.position).applyQuaternion(n.orientation.clone().invert());
  const yaw=Math.atan2(p.x,-p.z),pitch=-Math.atan2(p.y,Math.hypot(p.x,p.z));
  const command=x=>Math.abs(x)<.002?0:Math.sign(x)*Math.min(1,.18+Math.abs(x)*2.5);
  window.greenbankAligned=Math.abs(yaw)<.002&&Math.abs(pitch)<.002;
  window.navPad.axes=[0,0,command(yaw),command(pitch)];
 },20);},id);
 try{await page.waitForFunction(({id,ready})=>window.greenbankAligned&&(!ready||window.starAgent.state.navigationTargets.aimedId===id&&window.starAgent.state.navigationTargets.ready),{id,ready},{timeout:60000});}
 finally{await page.evaluate(()=>{clearInterval(window.greenbankPilot);window.navPad.axes=[0,0,0,0];});}
}
test('controller acquires Greenbank instead of Aeon, retains its selection and arrives above its pad',async({page,browser})=>{
 await mkdir(out,{recursive:true});const {tap,button,choose,drive,errors,requests}=await setupNavigation(page);
 expect(await page.evaluate(()=>window.starAgent.state.navigationTargets.selectedId)).toBe(null);
 await aim(page,greenbank);
 await expect(page.locator('#navigation-lock strong')).toContainText('Greenbank Supply');
 const automatic=await page.evaluate(()=>window.starAgent.state.navigationTargets);
 await page.screenshot({path:`${out}/automatic-greenbank.png`});
 await tap(14);await choose('map-body-aeon');await choose('map-view-locations');
 // Settlement follows the four expedition sites, on the second page.
 await choose('nav-page-next');await choose(`map-signal-${greenbank}`);
 await expect(page.locator('#map-target-name')).toHaveText('Greenbank Supply');await expect(page.locator('#map-approach')).toHaveText('35 km');
 await tap(1);await page.waitForFunction(()=>window.starAgent.state.controller.armed);
 await aim(page,'aeon',{ready:false});await frames(page);
 const away=await page.evaluate(()=>window.starAgent.state.navigationTargets);
 expect(away.selectedId).toBe(greenbank);expect(away.aimedId).toBe(null);expect(away.charge).toBe(0);
 await drive();expect(await page.evaluate(()=>window.starAgent.state.travel)).toBe(null);
 // Clear target restores automatic world acquisition through the real map.
 await tap(14);await choose('map-clear');await tap(1);await page.waitForFunction(()=>window.starAgent.state.controller.armed);await aim(page,'aeon');
 expect(await page.evaluate(()=>window.starAgent.state.navigationTargets.aimedId)).toBe('aeon');
 await tap(14);await choose(`map-signal-${greenbank}`);await tap(1);await page.waitForFunction(()=>window.starAgent.state.controller.armed);await aim(page,greenbank);
 // The existing neutral-input gates must still discard a Greenbank charge.
 for(const kind of ['focus','disconnect','replacement']){
  await button(4,true);await button(5,true);
  await page.evaluate(kind=>{if(kind==='focus')window.dispatchEvent(new Event('blur'));if(kind==='disconnect')window.navPad.connected=false;if(kind==='replacement')window.navPad.id+=' replacement';},kind);await frames(page);
  expect(await page.evaluate(()=>window.starAgent.state.navigationTargets.ready)).toBe(false);await button(12,true);
  await page.evaluate(()=>{window.navPad.connected=true;window.dispatchEvent(new Event('focus'));});await frames(page);
  expect(await page.evaluate(()=>window.starAgent.state.travel)).toBe(null);
  await button(12,false);await button(5,false);await button(4,false);await page.waitForFunction(()=>window.starAgent.state.controller.armed);await aim(page,greenbank);
 }
 await drive();await page.waitForFunction(()=>window.starAgent.state.travel?.targetId==='settlement-aeon');
 await page.waitForFunction(()=>!window.starAgent.state.travel&&window.starAgent.state.controller.armed);
 const arrival=await page.evaluate(()=>{
  const n=window.starAgent.navigation,t=window.starAgent.state.navigationTargets.targets.find(t=>t.id==='settlement-aeon'),pad=n.position.clone().fromArray(t.center);
  return {altitude:n.altitude,speed:n.speed,distance:n.position.distanceTo(pad),radialError:n.position.clone().normalize().angleTo(pad.clone().normalize()),target:window.starAgent.state.navigationTargets.selectedId,position:n.position.toArray(),pad:pad.toArray()};
 });
 await writeFile(`${out}/arrival.json`,JSON.stringify(arrival,null,2));
 // Sampled terrain height moves slightly with rotation after the drive ends;
 // measure the actual raised-pad distance as well as the altitude readout.
 expect(arrival.target).toBe(greenbank);expect(Math.abs(arrival.altitude-35000)).toBeLessThan(10);expect(arrival.distance).toBeGreaterThan(34990);expect(arrival.distance).toBeLessThan(35010);expect(arrival.radialError).toBeLessThan(.00005);expect(arrival.speed).toBeLessThan(.1);
 await page.screenshot({path:`${out}/greenbank-arrival.png`});await button(0,true);await page.waitForFunction(()=>window.starAgent.state.speed>1);await button(0,false);await tap(6);
 const renderer=await page.evaluate(()=>{const gl=document.querySelector('#viewport').getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');return ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'unknown';});
 await writeFile(`${out}/journey.json`,JSON.stringify({browser:browser.version(),renderer,physicalController:false,automatic:{selectedId:automatic.selectedId,aimedId:automatic.aimedId},away:{selectedId:away.selectedId,aimedId:away.aimedId,charge:away.charge},arrival,errors,requests},null,2));expect(errors).toEqual([]);expect(requests).toEqual([]);
});
