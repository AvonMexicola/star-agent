import {chromium} from '/home/cees/projects/star-agent-base-power/node_modules/playwright/index.mjs';
import {writeFile} from 'node:fs/promises';
const out='/home/cees/.cache/star-agent-pad-review/final';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=gl','--enable-webgl','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:out,size:{width:1440,height:900}}});
const page=await context.newPage(),errors=[],diagnostics=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(['error','warning'].includes(m.type()))errors.push(`${m.type()}: ${m.text()}`);});
const timer=setTimeout(()=>browser.close(),43000);
try{
 for(const size of ['small','large']){
  await page.goto(`http://127.0.0.1:5557/dev/build.html?only=foundation-pad-${size}`);
  await page.waitForFunction(()=>window.__buildStudio?.ready,null,{timeout:10000});
  await page.waitForTimeout(200);
  diagnostics.push(await page.evaluate(size=>{const {renderer:r,scene,camera}=window.__buildStudio,gl=r.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info'),pad=scene.children.find(x=>x.userData.pieceType?.startsWith('foundation-pad-'));return {size,backend:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):null,draws:r.info.render.calls,triangles:r.info.render.triangles,geometries:r.info.memory.geometries,textures:r.info.memory.textures,camera:camera.position.toArray(),markingY:pad.getObjectByName('LandingPadMarkings').position.y};},size));
  await page.screenshot({path:`${out}/${size}-baseline.png`});
  for(const enabled of [false,true]){await page.evaluate(async enabled=>{const {setLandingPadVisual}=await import('/src/build/visuals.js');const pad=window.__buildStudio.scene.children.find(o=>o.userData.pieceType?.startsWith('foundation-pad-'));setLandingPadVisual(pad,enabled,true);},enabled);await page.waitForTimeout(100);await page.screenshot({path:`${out}/${size}-designated-${enabled}.png`});}

  await page.evaluate(()=>{const {scene}=window.__buildStudio;scene.getObjectByName('LandingPadMarkings').receiveShadow=false;});
  await page.waitForTimeout(100);await page.screenshot({path:`${out}/${size}-no-shadow.png`});
  await page.evaluate(size=>{const {scene,camera}=window.__buildStudio;scene.getObjectByName('LandingPadMarkings').receiveShadow=true;camera.position.set(...(size==='small'?[11,1.6,12]:[33,3,45]));camera.lookAt(0,0,0);},size);
  await page.waitForTimeout(100);await page.screenshot({path:`${out}/${size}-grazing.png`});
  for(let i=0;i<3;i++){
   await page.evaluate(async i=>{const {camera}=window.__buildStudio,initial=camera.position.clone();await new Promise(resolve=>{let start;function step(t){start??=t;const u=Math.min(1,(t-start)/700),a=u*.06;camera.position.set(initial.x*Math.cos(a)+initial.z*Math.sin(a),initial.y,initial.z*Math.cos(a)-initial.x*Math.sin(a));camera.lookAt(0,0,0);if(u<1)requestAnimationFrame(step);else resolve();}requestAnimationFrame(step);});},i);
   await page.screenshot({path:`${out}/${size}-motion-${i}.png`});
  }
  await page.evaluate(()=>window.__buildStudio.scene.getObjectByName('LandingPadMarkings').receiveShadow=false);
  await page.waitForTimeout(100);await page.screenshot({path:`${out}/${size}-grazing-no-shadow.png`});
 }
 await writeFile(`${out}/diagnostics.json`,JSON.stringify({date:new Date().toISOString(),browser:browser.version(),viewport:[1440,900],diagnostics,errors},null,2));
}finally{clearTimeout(timer);await context.close();await browser.close();}
