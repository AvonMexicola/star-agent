import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
test('Pyre geography and resources render from orbit to ground without shader errors',async({page,browser})=>{
 const path='/tmp/star-agent-pyre',errors=[],states=[];await mkdir(path,{recursive:true});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'){errors.push(m.text());console.log(m.text().slice(0,1600));}});
 await page.goto('/?intro=0&debug&epoch=1788000000000');await page.waitForFunction(()=>window.starAgent?.state.ready);await page.keyboard.press('Tab');
 for(const shot of [{name:'orbit',altitude:900000,site:'field',lod:3},{name:'caldera-5km',altitude:5000,site:'volcano',lod:10},{name:'caldera-700m',altitude:700,site:'volcano',lod:12},{name:'lava-ground',altitude:1.75,site:'field',lod:16}]){
  await page.evaluate(({altitude,site})=>{
   const s=window.starAgent,n=s.navigation,d=site==='field'?s.pyreSites.fields[0].direction:s.pyreSites.volcanoes[0].direction;
   n.transitPyre(altitude,d);n.enabled=false;s.setRenderScale(.5);
   const up=n.normal,east=up.clone().set(0,1,0).cross(up).normalize();
   n.orientToward(n.position.clone().addScaledVector(up,-Math.max(1,altitude)).addScaledVector(east,altitude<10?4:altitude*.6),up);
  },shot);
  await page.waitForFunction(lod=>{const p=window.starAgent.state.pyre;return p.error||p.lod>=lod&&p.ready&&p.mapsReady;},shot.lod,{timeout:240000});
  expect(errors).toEqual([]);
  await page.evaluate(async()=>{window.starAgent.setRenderScale(1);for(let i=0;i<4;i++)await new Promise(r=>requestAnimationFrame(r));});
  const state=await page.evaluate(()=>window.starAgent.state);expect(state.pyre.error).toBeNull();expect(state.pyre.morphing).toBe(0);expect(state.body).toBe('pyre');expect(state.pyre.resources.weights.reduce((a,b)=>a+b,0)).toBeCloseTo(1,10);
  states.push({shot,state});await page.screenshot({path:`${path}/${shot.name}.png`});console.log(`Captured ${shot.name}`);
 }
 await page.keyboard.press('Tab');await expect(page.locator('#pyre-survey')).toBeVisible();await expect(page.locator('#pyre-composition')).toContainText('BASALT');await page.screenshot({path:`${path}/resource-survey.png`});
 for(const body of ['aeon','selene']){
  await page.evaluate(body=>{const n=window.starAgent.navigation;body==='aeon'?n.orbit():n.transitMoon(180);n.enabled=false;window.starAgent.setRenderScale(.5);},body);
  await page.waitForFunction(body=>window.starAgent.state.body===body,body);await page.waitForTimeout(2000);expect(errors).toEqual([]);
  await page.screenshot({path:`${path}/${body}-regression.png`});
 }
 const backend=await page.evaluate(()=>{const gl=document.querySelector('canvas').getContext('webgl2'),e=gl.getExtension('WEBGL_debug_renderer_info');return gl.getParameter(e.UNMASKED_RENDERER_WEBGL);});
 await writeFile(`${path}/environment.json`,JSON.stringify({browser:browser.version(),backend,viewport:[960,600],errors,states},null,2));
});


test('Pyre landing, ramp walk, reboarding and launch use the physical surface',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto('/?intro=0&debug&epoch=1788000000000');await page.waitForFunction(()=>window.starAgent?.state.ready);
 await page.evaluate(()=>{window.starAgent.setRenderScale(.4);window.starAgent.navigation.transitPyre(20);});
 await page.keyboard.press('b');await page.waitForFunction(()=>window.starAgent.state.mode==='landed',null,{timeout:90000});
 await page.waitForFunction(()=>window.starAgent.state.pyre.ready&&window.starAgent.state.pyre.lod>=16,null,{timeout:240000});
 const landed=await page.evaluate(()=>window.starAgent.state);expect(landed.body).toBe('pyre');
 await page.keyboard.press('f');await page.keyboard.down('w');await page.waitForFunction(()=>window.starAgent.state.shipLocal[2]>2.3);await page.keyboard.up('w');await page.keyboard.press('x');
 await page.keyboard.press('f');await page.waitForFunction(()=>window.starAgent.state.doorProgress===1);
 await page.keyboard.down('w');await page.waitForFunction(()=>window.starAgent.state.shipLocal[2]>12);await page.keyboard.up('w');await page.keyboard.press('x');
 const outside=await page.evaluate(()=>window.starAgent.state);expect(outside.insideShip).toBe(false);expect(outside.altitude).toBeCloseTo(1.75,4);expect(outside.body).toBe('pyre');
 await page.evaluate(()=>window.starAgent.setRenderScale(1));await page.keyboard.press('Tab');await page.screenshot({path:'/tmp/star-agent-pyre/walking.png'});
 await page.evaluate(()=>window.starAgent.setRenderScale(.4));
 await page.keyboard.down('s');await page.waitForFunction(()=>window.starAgent.state.shipLocal[2]<-1.4);await page.keyboard.up('s');await page.keyboard.press('x');
 await page.keyboard.press('f');await page.waitForFunction(()=>window.starAgent.state.mode==='landed');await page.keyboard.press('b');
 await page.waitForFunction(()=>window.starAgent.state.mode==='flight');expect(await page.evaluate(()=>window.starAgent.state.altitude)).toBeGreaterThan(10);
 await writeFile('/tmp/star-agent-pyre/journey.json',JSON.stringify({landed,outside,errors},null,2));expect(errors).toEqual([]);
 // Daylit hemisphere: distant basin geography and a close surface view.
 for(const altitude of [2500000,8]){
  await page.evaluate(altitude=>{const s=window.starAgent,n=s.navigation;n.transitPyre(altitude,n.sunDirection.toArray());n.enabled=false;const up=n.normal,east=up.clone().set(0,1,0).cross(up).normalize();n.orientToward(n.position.clone().addScaledVector(up,-altitude).addScaledVector(east,altitude<10?8:0),up);},altitude);
  await page.waitForFunction(()=>window.starAgent.state.pyre.ready,null,{timeout:240000});
  await page.evaluate(async()=>{window.starAgent.setRenderScale(1);for(let i=0;i<3;i++)await new Promise(r=>requestAnimationFrame(r));});
  await page.screenshot({path:`/tmp/star-agent-pyre/day-${altitude}.png`});await page.evaluate(()=>window.starAgent.setRenderScale(.4));
 }
 expect(errors).toEqual([]);
});
