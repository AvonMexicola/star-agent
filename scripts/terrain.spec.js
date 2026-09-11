import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import * as THREE from 'three';
import {findDestinations,RADIUS,terrainHeight} from '../src/world.js';

test('terrain transitions and layered ground render through descent and coastal travel',async({page,browser})=>{
  const errors=[],captures=[],baseline=!!process.env.TERRAIN_BASELINE_URL,shoreOnly=!!process.env.TERRAIN_SHORE_ONLY;
  const label=baseline?'before':'after';
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error'){errors.push(m.text());console.log(m.text());}else if(m.text().startsWith('terrain-progress'))console.log(m.text());});
  await page.goto((process.env.TERRAIN_BASELINE_URL||'')+'/?intro=0&seed=7291&debug');
  await page.waitForFunction(()=>window.starAgent?.state.ready);
  await page.evaluate(()=>{
    window.starAgent.setRenderScale(.55);
    window.terrainProgress=setInterval(()=>{const s=window.starAgent.state;console.log('terrain-progress',JSON.stringify({lod:s.lod,pending:s.pending,morph:s.terrainLod?.morphing,fps:s.fps}));},10000);
    window.terrainSamples=[];
    const sample=()=>{window.terrainSamples.push(window.starAgent.state.terrainLod?.morphing||0);requestAnimationFrame(sample);};sample();
  });
  await page.keyboard.press('Shift+Tab');
  await mkdir('/tmp/star-agent-terrain',{recursive:true});
  const destinations=findDestinations();
  // Find actual shallow water near the coast destination, rather than calling
  // an inland ground screenshot a shoreline inspection.
  const coast=new THREE.Vector3(...destinations.coast),east=new THREE.Vector3(0,1,0).cross(coast).normalize(),north=coast.clone().cross(east).normalize();
  let best=Infinity;
  for(let x=-40;x<=40;x++)for(let y=-40;y<=40;y++){
    const direction=coast.clone().multiplyScalar(RADIUS).addScaledVector(east,x*1000).addScaledVector(north,y*1000).normalize();
    const height=terrainHeight(...direction),score=Math.abs(height+2)+Math.hypot(x,y)*.001;
    if(score<best){best=score;destinations.shore=direction.toArray();}
  }
  expect(terrainHeight(...destinations.shore)).toBeLessThan(0);
  const pose=async(name,altitude)=>{
    await page.evaluate(async({direction,altitude})=>{
      const nav=window.starAgent.navigation;nav.transit(direction,altitude);
      const up=nav.normal,east=up.clone().set(0,1,0).cross(up).normalize(),north=up.clone().cross(east).normalize();
      nav.orientToward(nav.position.clone().addScaledVector(north,100).addScaledVector(east,80).addScaledVector(up,-45),up);
      // Let the renderer consume the new pose before reading its streaming
      // state; wall-clock sleeps can expire while SwiftShader is still drawing
      // the previous location and falsely report that old location as settled.
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    },{direction:destinations[name],altitude});
    await page.waitForTimeout(1500);
    await page.waitForFunction(({baseline,altitude})=>{
      const s=window.starAgent.state;
      return s.pending<5&&s.lod>=(altitude<10?16:13)&&(baseline||s.terrainLod.settled);
    },{baseline,altitude});
    await page.waitForTimeout(1200);
  };
  const capture=async name=>{
    await page.evaluate(async()=>{window.starAgent.setRenderScale(1);await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
    await page.screenshot({path:`/tmp/star-agent-terrain/${label}-${name}.png`});
    captures.push({name,state:await page.evaluate(()=>window.starAgent.state)});
    console.log(name,captures.at(-1).state.terrainLod,captures.at(-1).state.lod);
    expect(errors).toEqual([]);
    await page.evaluate(()=>window.starAgent.setRenderScale(.55));
  };
  if(!shoreOnly){
  await pose('forest',180);await capture('groves');
  await pose('forest',3.5);await capture('ground');
  if(!baseline){
    expect(await page.evaluate(()=>Math.max(...window.terrainSamples))).toBeGreaterThan(0);
    // Every visible land and sea patch, including its shadow pass, uses the
    // same per-patch morph factor and bounds both ends of the transition.
    const consistency=await page.evaluate(()=>{
      const p=window.starAgent.planet;let land=0,water=0;
      for(const n of p.nodes.values())if(n.mesh?.visible)for(const mesh of n.mesh.children){
        if(!mesh.geometry.attributes.parentPosition||!mesh.geometry.boundingSphere)return false;
        if(mesh.material.isShaderMaterial){water++;if(mesh.material.uniforms.terrainMorph!==n.morph)return false;}
        else {land++;if(!mesh.customDepthMaterial)return false;}
        if(n.morph.value<0||n.morph.value>1)return false;
      }
      return land>0&&water>0;
    });
    expect(consistency).toBe(true);
  }
  }
  await pose('shore',25);await capture('shore');
  const renderer=await page.evaluate(()=>{
    const gl=document.querySelector('canvas').getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');
    return ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);
  });
  await writeFile(`/tmp/star-agent-terrain/${label}${shoreOnly?'-shore':''}-environment.json`,JSON.stringify({browser:browser.version(),renderer,resolution:[1440,900],captures,errors},null,2));
  expect(errors).toEqual([]);
  await page.evaluate(()=>clearInterval(window.terrainProgress));
});
