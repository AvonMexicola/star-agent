import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const out='/home/cees/.cache/star-agent-pad-evidence';
test('landing pad finish shows white paint, four approaches and powered perimeter beacons',async({page,browser})=>{
 test.setTimeout(30000);await mkdir(out,{recursive:true});const errors=[],views=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 for(const [name,query]of [['small','only=foundation-pad-small'],['small-night','only=foundation-pad-small&night=1'],['small-off','only=foundation-pad-small&night=1&unpowered=1'],['medium','only=foundation-pad-medium'],['large','only=foundation-pad-large']]){
  await page.goto(`/dev/build.html?${query}`);await page.waitForFunction(()=>window.__buildStudio?.ready,null,{timeout:10000});await page.waitForTimeout(300);
  const stats=await page.evaluate(()=>{const {scene,renderer:r}=window.__buildStudio,gl=r.getContext(),e=gl.getExtension('WEBGL_debug_renderer_info'),pad=scene.children.find(o=>o.userData.pieceType?.startsWith('foundation-pad-')),mark=pad.getObjectByName('LandingPadMarkings'),lens=[...pad.userData.buildFinish.materials.values()].find(m=>m.name==='LandingLens');return {paintMask:pad.userData.buildFinish.padPaint.value,ramps:scene.children.filter(o=>o.userData.pieceType==='foundation-ramp').length,paint:mark.visible,paintEmission:mark.material.emissiveIntensity,paintColor:mark.material.emissive.getHex(),beaconEmission:lens.emissiveIntensity,draws:r.info.render.calls,triangles:r.info.render.triangles,backend:e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):null};});
  expect(stats.paintMask).toBe(1);expect(stats.ramps).toBe(4);expect(stats.paint).toBe(true);expect(stats.paintColor).toBe(0);expect(stats.beaconEmission).toBe(name==='small-off'?0:1.2);views.push({name,...stats});await page.screenshot({path:`${out}/${name}.png`});
 }
 expect(errors).toEqual([]);await writeFile(`${out}/assets.json`,JSON.stringify({browser:browser.version(),viewport:'1440x900',views,errors},null,2));
});
