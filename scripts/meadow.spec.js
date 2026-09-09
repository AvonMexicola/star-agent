import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {latLonDirection} from '../src/world.js';

test('dense meadow renders wind, flowers and walking contact without shader errors',async({page,browser})=>{
 const path='/tmp/star-agent-meadow',errors=[],states=[];await mkdir(path,{recursive:true});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto('/?debug&seed=7291');await page.waitForFunction(()=>window.starAgent?.state.ready);await page.keyboard.press('Shift+Tab');
 await page.evaluate(direction=>{
  const s=window.starAgent,n=s.navigation;n.transit(direction,1.75);n.enabled=false;
  const up=n.normal,east=up.clone().set(0,1,0).cross(up).normalize();
  n.orientToward(n.position.clone().addScaledVector(east,5).addScaledVector(up,-1.2),up);s.setRenderScale(.5);
 },latLonDirection(15.74,22.44));
 await page.waitForFunction(()=>window.starAgent.state.terrainDetail.settled&&window.starAgent.state.lod>=16);
 const settle=async()=>page.evaluate(async()=>{window.starAgent.setRenderScale(1);for(let i=0;i<5;i++)await new Promise(r=>requestAnimationFrame(r));});
 await settle();
 let state=await page.evaluate(()=>window.starAgent.state);expect(state.vegetation.meadow.tufts).toBeGreaterThan(7000);expect(state.vegetation.meadow.flowers).toBeGreaterThan(100);expect(state.vegetation.meadow.contacts).toBe(0);
 states.push(state);await page.screenshot({path:`${path}/dense-meadow.png`});
 const windBefore=await page.screenshot({clip:{x:250,y:340,width:400,height:250}});
 await page.evaluate(async()=>{for(let i=0;i<10;i++)await new Promise(r=>requestAnimationFrame(r));});
 await page.screenshot({path:`${path}/wind.png`});
 const windAfter=await page.screenshot({clip:{x:250,y:340,width:400,height:250}});expect(windAfter.equals(windBefore)).toBe(false);
 await page.evaluate(()=>{const n=window.starAgent.navigation;n.mode='walk';const up=n.normal;n.orientToward(n.position.clone().addScaledVector(up,-1.5).addScaledVector(up.clone().set(0,1,0).cross(up).normalize(),.4),up);});
 await settle();state=await page.evaluate(()=>window.starAgent.state);expect(state.vegetation.meadow.contacts).toBeGreaterThan(0);states.push(state);
 await page.screenshot({path:`${path}/bent-grass.png`});
 await page.evaluate(()=>{const n=window.starAgent.navigation;n.position.addScaledVector(n.normal.clone().set(0,1,0).cross(n.normal).normalize(),2);});
 await settle();state=await page.evaluate(()=>window.starAgent.state);expect(state.vegetation.meadow.rebuilds).toBeGreaterThan(states[0].vegetation.meadow.rebuilds);states.push(state);
 await page.screenshot({path:`${path}/walking.png`});
 await page.evaluate(direction=>{
  const n=window.starAgent.navigation;n.transit(direction,4.5);n.enabled=true;
  const up=n.normal,east=up.clone().set(0,1,0).cross(up).normalize();
  n.orientToward(n.position.clone().addScaledVector(up,-5).addScaledVector(east,2),up);
 },latLonDirection(15.74,22.44));
 await settle();state=await page.evaluate(()=>window.starAgent.state);expect(state.vegetation.meadow.downwash).toBeGreaterThan(.05);states.push(state);
 await page.screenshot({path:`${path}/thruster-downwash.png`});
 await page.evaluate(()=>{window.starAgent.navigation.enabled=false;});
 await page.evaluate(async()=>{for(let i=0;i<20;i++)await new Promise(r=>requestAnimationFrame(r));});
 state=await page.evaluate(()=>window.starAgent.state);expect(state.vegetation.meadow.downwash).toBeLessThan(.01);
 await page.screenshot({path:`${path}/thrusters-off.png`});
 await page.evaluate(()=>{const n=window.starAgent.navigation;n.mode='flight';n.position.addScaledVector(n.normal,12);});await settle();expect((await page.evaluate(()=>window.starAgent.state)).vegetation.meadow.visible).toBe(false);
 expect(errors).toEqual([]);
 const backend=await page.evaluate(()=>{const g=document.querySelector('canvas').getContext('webgl2'),e=g.getExtension('WEBGL_debug_renderer_info');return g.getParameter(e.UNMASKED_RENDERER_WEBGL);});
 await writeFile(`${path}/environment.json`,JSON.stringify({browser:browser.version(),backend,viewport:[960,600],errors,states},null,2));
});
