import {test,expect} from '@playwright/test';
import {setupNavigation,frames,fits} from '../tests/browser/navigation-helpers.js';
import {mkdir,writeFile} from 'node:fs/promises';
const out='/tmp/star-agent-planetary-drive-evidence';
async function aim(page,id){
 await page.evaluate(id=>{window.routePilot=setInterval(()=>{
  const n=window.starAgent.navigation,t=n.targeting?window.starAgent.state.navigationTargets.targets.find(t=>t.id===id):null;
  if(!t||n.travel){window.navPad.axes=[0,0,0,0];return;}
  const p=n.viewPoint(n.position.clone().fromArray(t.center)).sub(n.position).applyQuaternion(n.orientation.clone().invert());
  const command=x=>Math.abs(x)<.002?0:Math.sign(x)*Math.min(1,.18+Math.abs(x)*2.5);
  window.navPad.axes=[0,0,command(Math.atan2(p.x,-p.z)),command(-Math.atan2(p.y,Math.hypot(p.x,p.z)))];
 },20);},id);
 try{await page.waitForFunction(id=>{const n=window.starAgent.state.navigationTargets;return n.aimedId===id&&n.ready;},id,{timeout:60000});}
 finally{await page.evaluate(()=>{clearInterval(window.routePilot);window.navPad.axes=[0,0,0,0];});}
}
test('controller selects a far-side planetary location, charges, aborts, arrives and returns to flight',async({page,browser})=>{
 await mkdir(out,{recursive:true});const {tap,button,choose,drive,errors,requests}=await setupNavigation(page);
 // Fly from the launcher orbit to the real coast approach before asking for a limb route.
 await tap(14);await choose('map-body-aeon');await choose('map-view-locations');await choose('map-signal-site-coast');await tap(1);await page.waitForFunction(()=>window.starAgent.state.controller.armed);
 await aim(page,'site-coast');await drive();await page.waitForFunction(()=>!window.starAgent.state.travel&&window.starAgent.state.altitude<36000&&window.starAgent.state.controller.armed);
 const id=await page.evaluate(()=>{
  const n=window.starAgent.navigation,normal=n.position.clone().normalize();
  return window.starAgent.state.navigationTargets.targets.filter(t=>t.surface&&t.category==='locations'&&t.body==='aeon')
   .sort((a,b)=>normal.dot(n.position.clone().fromArray(a.center).normalize())-normal.dot(n.position.clone().fromArray(b.center).normalize()))[0].id;
 });
 await tap(14);await choose('map-view-locations');await choose(`map-signal-${id}`);
 await expect(page.locator('#map-approach')).toHaveText('35 km');await expect(page.locator('#map-route-status')).toContainText('Route around world');
 await page.screenshot({path:`${out}/desktop-route.png`});await tap(1);await page.waitForFunction(()=>window.starAgent.state.controller.armed);
 await aim(page,id);
 // A held drive shortcut cannot retain a charge across modal/focus/device gates.
 await tap(14);expect(await page.evaluate(()=>window.starAgent.state.navigationTargets.charge)).toBe(0);
 await tap(1);await page.waitForFunction(()=>window.starAgent.state.controller.armed);await aim(page,id);
 for(const kind of ['focus','disconnect','replacement']){
  await button(4,true);await button(5,true);
  await page.evaluate(kind=>{if(kind==='focus')window.dispatchEvent(new Event('blur'));if(kind==='disconnect')window.navPad.connected=false;if(kind==='replacement')window.navPad.id+=' replacement';},kind);await frames(page);
  expect(await page.evaluate(()=>window.starAgent.state.navigationTargets.ready)).toBe(false);await button(12,true);
  await page.evaluate(()=>{window.navPad.connected=true;window.dispatchEvent(new Event('focus'));});await frames(page);
  expect(await page.evaluate(()=>window.starAgent.state.travel)).toBe(null);
  await button(12,false);await button(5,false);await button(4,false);await page.waitForFunction(()=>window.starAgent.state.controller.armed);await aim(page,id);
 }
 await page.evaluate(()=>{window.routeAbortSamples=[];window.sawRouteAbort=false;window.abortRoute=setInterval(()=>{const s=window.starAgent.state;if(s.travel)window.routeAbortSamples.push({phase:s.travel.phase,aborting:s.travel.aborting,speed:s.speed,armed:s.controller.armed,brake:window.navPad.buttons[6].value});if(s.travel?.aborting){window.sawRouteAbort=true;window.navPad.buttons[6]={pressed:false,value:0};clearInterval(window.abortRoute);}else if(s.travel&&s.speed>1000000)window.navPad.buttons[6]={pressed:true,value:1};},5);});
 await drive();await page.waitForFunction(()=>window.sawRouteAbort,null,{timeout:8000}).catch(async error=>{console.log('Abort diagnostics',await page.evaluate(()=>({samples:window.routeAbortSamples,errors:window.starAgent.state.travel,controller:window.starAgent.state.controller})));throw error;});await page.waitForFunction(()=>!window.starAgent.state.travel&&window.starAgent.state.controller.armed);await aim(page,id);
 await page.screenshot({path:`${out}/far-side-ready.png`});
 await page.evaluate(()=>{window.routeSamples=[];window.routeArcs=[];window.routeRecorder=setInterval(()=>{const n=window.starAgent.navigation;if(n.travel){window.routeArcs=n.travel.plan.path?.filter(p=>p.kind==='arc').map(p=>p.body)??[];window.routeSamples.push({altitude:n.altitude,speed:n.speed,position:n.inertialPosition.toArray()});}},5);});
 await drive();await page.waitForFunction(()=>window.routeSamples.length>0);await page.waitForFunction(()=>!window.starAgent.state.travel&&window.starAgent.state.controller.armed);
 await page.evaluate(()=>clearInterval(window.routeRecorder));
 const arrival=await page.evaluate(id=>{const n=window.starAgent.navigation,t=window.starAgent.state.navigationTargets.targets.find(t=>t.id===id),target=n.position.clone().fromArray(t.center);return {altitude:n.altitude,speed:n.speed,radialError:n.position.clone().normalize().angleTo(target.normalize()),arcs:window.routeArcs,samples:window.routeSamples};},id);
 expect(arrival.arcs).toContain('aeon');expect(arrival.altitude).toBeCloseTo(35000,0);expect(arrival.radialError).toBeLessThan(.00005);expect(arrival.speed).toBeLessThan(.1);
 expect(Math.min(...arrival.samples.map(s=>s.altitude))).toBeGreaterThanOrEqual(34999);
 await page.screenshot({path:`${out}/surface-arrival.png`});await button(0,true);await page.waitForFunction(()=>window.starAgent.state.speed>1);await button(0,false);await tap(6);
 await page.keyboard.press('m');await page.setViewportSize({width:390,height:844});await frames(page);await fits(page);
 const locations=page.locator('button[data-map-view="locations"]');await locations.tap();await expect(page.locator('#map-approach')).toHaveText('35 km');await fits(page);await page.screenshot({path:`${out}/phone-location.png`});
 const renderer=await page.evaluate(()=>{const gl=document.querySelector('#viewport').getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');return ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'unknown';});
 await writeFile(`${out}/journey.json`,JSON.stringify({browser:browser.version(),renderer,physicalController:false,arrival,abortSamples:await page.evaluate(()=>window.routeAbortSamples),errors,requests},null,2));expect(errors).toEqual([]);
});
