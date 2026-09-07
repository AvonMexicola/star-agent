import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {latLonDirection,findDestinations} from '../src/world.js';
const destinations=findDestinations();
const shots=[... [1400,500,100,5].map(altitude=>({name:`meadow-${altitude}m`,direction:latLonDirection(15.74,22.44),altitude})),
 ... ['forest','coast','mountain','polar'].map(name=>({name,direction:destinations[name],altitude:100}))];
test('biome surfaces stay varied through the meadow descent',async({page,browser},info)=>{
 const path=`/tmp/star-agent-biomes/${info.project.name}`,errors=[],captures=[];await mkdir(path,{recursive:true});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto('/?debug&seed=7291');await page.waitForFunction(()=>window.starAgent?.state.ready);await page.keyboard.press('Tab');
 for(const shot of shots){
  if(info.project.name==='before'&&!shot.name.startsWith('meadow'))continue;
  await page.evaluate(({direction,altitude})=>{
   const s=window.starAgent,nav=s.navigation;nav.transit(direction,altitude);nav.enabled=false;
   const up=nav.normal,east=up.clone().set(0,1,0).cross(up).normalize();
   nav.orientToward(nav.position.clone().addScaledVector(up,-altitude).addScaledVector(east,altitude*.6),up);s.setRenderScale(.5);
  },shot);
  await page.waitForTimeout(500);
  await page.waitForFunction(alt=>{const s=window.starAgent.state;return s.terrainDetail.settled&&s.lod>=(alt>1000?11:alt>20?13:16);},shot.altitude,{timeout:180000});
  await page.evaluate(async()=>{for(let i=0;i<8;i++)await new Promise(r=>requestAnimationFrame(r));window.starAgent.setRenderScale(1);await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
  await page.screenshot({path:`${path}/${shot.name}.png`});expect(errors).toEqual([]);
  captures.push({shot,state:await page.evaluate(()=>window.starAgent.state)});console.log(`${info.project.name}: ${shot.name}`);
 }
 const gl=await page.evaluate(()=>{const g=document.querySelector('canvas').getContext('webgl2'),e=g.getExtension('WEBGL_debug_renderer_info');return g.getParameter(e.UNMASKED_RENDERER_WEBGL);});
 await writeFile(`${path}/environment.json`,JSON.stringify({browser:browser.version(),backend:gl,viewport:[1280,800],scale:1,errors,captures},null,2));
});


test('mixed tree crowns render through their distance transitions',async({page},info)=>{
 test.skip(info.project.name==='before');
 await page.setViewportSize({width:960,height:600});
 const path='/tmp/star-agent-biomes/after',errors=[],states=[];await mkdir(path,{recursive:true});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto('/?debug&seed=7291');await page.waitForFunction(()=>window.starAgent?.state.ready);await page.keyboard.press('Tab');
 for(const distance of [450,120,35]){
  await page.evaluate(({direction,distance})=>{
   const nav=window.starAgent.navigation;nav.transit(direction,12);nav.enabled=false;
   const up=nav.normal,east=up.clone().set(0,1,0).cross(up).normalize();
   const target=nav.position.clone().addScaledVector(up,-4);
   const eye=up.clone().addScaledVector(east,distance/1592750).normalize();
   nav.transit(eye.toArray(),12);nav.enabled=false;nav.orientToward(target,nav.normal);
   window.starAgent.setRenderScale(.5);
  },{direction:destinations.forest,distance});
  await page.waitForFunction(()=>window.starAgent.state.terrainDetail.settled);
  await page.evaluate(async()=>{for(let i=0;i<8;i++)await new Promise(r=>requestAnimationFrame(r));window.starAgent.setRenderScale(1);await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
  const state=await page.evaluate(()=>window.starAgent.state);states.push(state);
  expect(state.vegetation.species.every(n=>n>0)).toBe(true);expect(errors).toEqual([]);
  await page.screenshot({path:`${path}/trees-${distance}m.png`});console.log(`trees: ${distance}m`);
 }
 await writeFile(`${path}/trees.json`,JSON.stringify({errors,states},null,2));
});
