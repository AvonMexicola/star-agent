import {test,expect} from '@playwright/test';
import {RADIUS,latLonDirection,terrainHeight} from '../src/world.js';
const direction=latLonDirection(-38,102);

test('ocean renders near waves, distant glints and the grazing horizon',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto('/?intro=0&debug&seed=7291');
  await page.waitForFunction(()=>window.starAgent?.state.ready,{}, {timeout:60000});
  expect(terrainHeight(...direction)).toBeLessThan(-300);
  await page.evaluate(()=>{window.starAgent.navigation.enabled=false;window.starAgent.setRenderScale(1);
    document.querySelectorAll('body > :not(canvas):not(script)').forEach(e=>e.style.visibility='hidden');});
  const label=process.env.WATER_BASELINE?'before':'after';
  for(const height of [40,300,2000,20000,100000]){
    await page.evaluate(({direction,height,RADIUS})=>{
      const nav=window.starAgent.navigation,d=nav.position.clone().set(...direction),target=d.clone().multiplyScalar(RADIUS);
      const sun=nav.sunDirection,view=sun.clone().negate().addScaledVector(d,2*d.dot(sun)).normalize();
      const cosine=view.dot(d),distance=-RADIUS*cosine+Math.sqrt(RADIUS*RADIUS*cosine*cosine+2*RADIUS*height+height*height);
      nav.position.copy(target).addScaledVector(view,distance);nav.velocity.set(0,0,0);nav.orientToward(target,d);
    },{direction,height,RADIUS});
    await page.waitForFunction(()=>window.starAgent.state.pending===0,{}, {timeout:60000});
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))));
    expect(errors).toEqual([]);
    const state=await page.evaluate(()=>window.starAgent.state);
    expect(Math.hypot(...state.position)-RADIUS).toBeCloseTo(height,0);
    console.log(label,height,{patches:state.patches,lod:state.lod,drawCalls:state.drawCalls,triangles:state.triangles,renderScale:state.renderScale});
    await page.screenshot({path:`/tmp/star-agent-water-${label}-${height}.png`});
  }
  await page.evaluate(({direction,RADIUS})=>{
    const nav=window.starAgent.navigation,d=nav.position.clone().set(...direction),sun=nav.sunDirection;
    const tangent=sun.clone().addScaledVector(d,-sun.dot(d)).normalize();
    nav.position.copy(d).multiplyScalar(RADIUS+300);nav.orientToward(nav.position.clone().addScaledVector(tangent,10000).addScaledVector(d,-800),d);
  },{direction,RADIUS});
  await page.waitForFunction(()=>window.starAgent.state.pending===0,{}, {timeout:60000});
  await page.screenshot({path:`/tmp/star-agent-water-${label}-horizon.png`});
  expect(errors).toEqual([]);
  console.log('Browser',await page.evaluate(()=>{const gl=document.querySelector('canvas').getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');return {agent:navigator.userAgent,renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)};}));
});


test('shared shoreline renders shallow water beside dry terrain',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  const shore=[.40247476276530786,.25723568151191434,.878546452667194];
  expect(Math.abs(terrainHeight(...shore))).toBeLessThan(.01);
  await page.goto('/?intro=0&debug&seed=7291');
  await page.waitForFunction(()=>window.starAgent?.state.ready,{}, {timeout:60000});
  await page.evaluate(({shore,RADIUS})=>{
    const app=window.starAgent,nav=app.navigation;nav.enabled=false;app.setRenderScale(1);
    document.querySelectorAll('body > :not(canvas):not(script)').forEach(e=>e.style.visibility='hidden');
    const d=nav.position.clone().set(...shore),target=d.clone().multiplyScalar(RADIUS);
    const east=d.clone().set(0,1,0).cross(d).normalize();
    nav.position.copy(target).addScaledVector(d,150).addScaledVector(east,400);nav.orientToward(target,d);
  },{shore,RADIUS});
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))));
  await page.waitForFunction(()=>window.starAgent.state.pending===0,{}, {timeout:60000});
  await page.screenshot({path:`/tmp/star-agent-water-${process.env.WATER_BASELINE?'before':'after'}-coast.png`});
  expect(errors).toEqual([]);
});
