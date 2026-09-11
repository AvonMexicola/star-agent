import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
test('finished service corner renders shared materials, props, prints and task shadows',async({page,browser})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto('/?intro=0&seed=7291&debug=1');await page.waitForFunction(()=>window.starAgent?.state.ready&&starAgent.state.station.ready);
 expect(await page.evaluate(()=>starAgent.state.station.finish)).toBe('ready');
 await page.evaluate(()=>{const n=starAgent.navigation,s=n.station;starAgent.setRenderScale(1);n.enabled=false;n.velocity.set(0,0,0);n.mode='walk';n.dockedAtStation=true;n.insideShip=false;});
 await page.keyboard.press('Shift+Tab');
 await mkdir('/tmp/star-agent-hangar-finish-evidence',{recursive:true});
 const records=[];
 for(const [name,position,target] of [
  ['corner',[-12,-6.25,0],[-12,-6.25,22]],
  ['terminal',[-12,-6.25,19.6],[-12,-6.25,23]],
  ['posters',[-5.8,-6.25,21],[-6.5,-5.65,25.15]],
  ['props',[-14,-6.25,13],[-18.8,-6.4,18]],
  ['deck',[-10,-6.25,3],[-4,-8,10]],
  ['gallery',[-3,-6.25,15],[0,2,24]],
 ]){
  await page.evaluate(({position,target})=>{const n=starAgent.navigation,s=n.station,p=n.position.clone().set(...position);s.toWorld(p,n.position);n.orientToward(s.toWorld(p.clone().set(...target),p.clone()),s.up);},{position,target});
  await page.waitForTimeout(500);await page.screenshot({path:`/tmp/star-agent-hangar-finish-evidence/${name}.png`});
  records.push({name,state:await page.evaluate(()=>({station:starAgent.state.station,drawCalls:starAgent.state.drawCalls,triangles:starAgent.state.triangles}))});
 }
 expect(errors).toEqual([]);
 const textureState=await page.evaluate(()=>{const s=starAgent.navigation.station;return {shared:s.pods[0].model.getObjectByName('LandingDeck').geometry===s.pods[19].model.getObjectByName('LandingDeck').geometry,uv:Boolean(s.pods[0].model.getObjectByName('LandingDeck').geometry.attributes.uv),lamps:s.finishRig.lamps.length,shadows:s.finishRig.lamps.filter(l=>l.castShadow).length,prints:s.pods[0].model.getObjectByName('Sign_StationFinishedPrints').userData.prints.count};});
 expect(textureState).toEqual({shared:true,uv:true,lamps:4,shadows:1,prints:5});
 const gallery=await page.evaluate(()=>{const model=starAgent.navigation.station.pods[0].model,glass=model.getObjectByName('Detail_OperationsGlass');return {operations:model.getObjectByName('Sign_StationFinishedPrints').userData.operations,glassTransparent:glass.material.transparent,glassCastsShadow:glass.castShadow,freightLabelCastsShadow:model.getObjectByName('Sign_Freight').castShadow};});
 expect(gallery).toEqual({operations:{headers:1,consoles:6,stencils:6,sharedPrintAtlas:true},glassTransparent:true,glassCastsShadow:false,freightLabelCastsShadow:false});
 const backend=await page.evaluate(()=>{const gl=document.querySelector('canvas').getContext('webgl2'),e=gl.getExtension('WEBGL_debug_renderer_info');return e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);});
 await writeFile('/tmp/star-agent-hangar-finish-evidence/render-environment.json',JSON.stringify({browser:browser.version(),backend,viewport:{width:1440,height:900},renderScale:1,records,textureState,errors},null,2));
});

test('optional finish asset failures retain a usable station and a safe print fallback',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/models/station-props.glb',route=>route.abort());
 await page.goto('/?intro=0&seed=7291&debug=1');
 await page.waitForFunction(()=>window.starAgent?.state.ready&&starAgent.state.station.ready);
 expect(await page.evaluate(()=>({finish:starAgent.state.station.finish,pods:starAgent.state.station.pods,rig:starAgent.navigation.station.finishRig}))).toEqual({finish:'unavailable',pods:20,rig:null});
 await page.unroute('**/models/station-props.glb');
 await page.route('**/textures/station/poster-selene.webp',route=>route.abort());
 await page.reload();
 await page.waitForFunction(()=>window.starAgent?.state.ready&&starAgent.state.station.ready);
 expect(await page.evaluate(()=>starAgent.state.station.finish)).toBe('ready');
 expect(await page.evaluate(()=>Boolean(starAgent.navigation.station.pods[0].model.getObjectByName('Sign_Print_Selene').material.map.image))).toBe(true);
 expect(errors).toEqual([]);
});
