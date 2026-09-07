import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const output=process.env.ATLAS_SHAPE_OUT||'/tmp/atlas-refresh-shape-01';
test('actual Atlas renderer captures the current silhouette candidate',async({page,browser})=>{
  const errors=[],captures=[];await fs.mkdir(output,{recursive:true});
  page.on('pageerror',e=>errors.push(String(e)));
  page.on('console',m=>{if(['warning','error'].includes(m.type()))errors.push(m.text());});
  await page.goto('/dev/atlas-mark-ii.html');
  await page.evaluate(()=>window.atlasMarkIIStudio.ready);
  await expect(page.locator('#asset-state')).toHaveText('READY');
  const bytes=await(await page.request.get('/models/atlas-mark-ii/atlas-mark-ii.glb')).body();
  for(const [name,position] of [['exterior',null],['bow',[0,13,-62]],['side',[-80,15,0]],['plan',[0,110,.001]],['aft',[45,22,60]]]){
    await page.evaluate(p=>{
      const s=window.atlasMarkIIStudio;s.view('exterior',true);
      document.body.classList.add('details-hidden');
      if(p){s.camera.position.fromArray(p);s.camera.lookAt(0,7.2,0);}
    },position);
    await page.waitForTimeout(200);
    const state=await page.evaluate(()=>{
      const s=window.atlasMarkIIStudio,gl=document.querySelector('#viewport').getContext('webgl2'),e=gl.getExtension('WEBGL_debug_renderer_info');
      return {stats:s.stats,camera:{position:s.camera.position.toArray(),quaternion:s.camera.quaternion.toArray(),fov:s.camera.fov},backend:e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)};
    });
    await page.screenshot({path:`${output}/${name}.png`});captures.push({name,...state});
  }
  await page.evaluate(()=>{
    const s=window.atlasMarkIIStudio;s.view('exterior',true);
    document.body.classList.add('details-hidden');
    s.inspectCamera([-24,3,-25],[-9.6,2.4,-19]);
  });
  await page.waitForTimeout(200);
  await page.screenshot({path:`${output}/gear-down.png`});
  expect(await page.evaluate(()=>window.atlasMarkIIStudio.systems.toggleGear())).toBe(true);
  await page.waitForFunction(()=>window.atlasMarkIIStudio.systems.gear.progress<.55);
  await page.screenshot({path:`${output}/gear-moving.png`});
  await page.waitForFunction(()=>!window.atlasMarkIIStudio.systems.gear.moving);
  expect(await page.evaluate(()=>window.atlasMarkIIStudio.systems.gear.progress)).toBe(0);
  await page.screenshot({path:`${output}/gear-stowed.png`});
  expect(await page.evaluate(()=>window.atlasMarkIIStudio.systems.toggleGear())).toBe(true);
  await page.waitForFunction(()=>!window.atlasMarkIIStudio.systems.gear.moving);
  expect(await page.evaluate(()=>window.atlasMarkIIStudio.systems.gear.progress)).toBe(1);
  await page.evaluate(()=>{
    const s=window.atlasMarkIIStudio;
    s.systems.toggleRamp('front');s.systems.toggleRamp('aft');
  });
  await page.waitForFunction(()=>window.atlasMarkIIStudio.systems.ramps.every(r=>!r.moving));
  expect(await page.evaluate(()=>window.atlasMarkIIStudio.systems.ramps.map(r=>r.sealNodeObject.position.y))).toEqual([9,9]);
  await page.evaluate(()=>{
    window.atlasMarkIIStudio.view('cargo',true);document.body.classList.add('details-hidden');
  });
  await page.waitForTimeout(200);
  await page.screenshot({path:`${output}/cargo-open.png`});
  await page.evaluate(()=>{
    window.atlasMarkIIStudio.view('aft',true);document.body.classList.add('details-hidden');
  });
  await page.waitForTimeout(200);
  await page.screenshot({path:`${output}/aft-open.png`});
  await fs.writeFile(`${output}/evidence.json`,JSON.stringify({browser:browser.version(),viewport:page.viewportSize(),assetSha256:crypto.createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,errors,captures,scope:'Builder silhouette iteration in the actual renderer. No art-score, physical-journey or performance acceptance is inferred.'},null,2));
  expect(errors).toEqual([]);
});
