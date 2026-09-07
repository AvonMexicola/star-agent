import {test,expect} from '/tmp/star-agent-kestrel/node_modules/@playwright/test/index.mjs';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const OUT='/tmp/star-agent-atlas-refresh/docs/qa/atlas-fleet-refresh/baseline-review';
test('independent bow view verified in front of actual backdrop',async({browser,page})=>{
 const evidence={browser:browser.version(),console:[],invalidPredecessors:['desktop-bow.png','desktop-bow-replacement.png'],reason:'Actual backdrop spans z=-68.225..-67.775; reviewer camera now z=-62.',scope:'One actual renderer bow fixture; no runtime/source changes.'};
 page.on('pageerror',e=>evidence.console.push({type:'pageerror',text:String(e)}));
 page.on('console',m=>{if(['warning','error'].includes(m.type()))evidence.console.push({type:m.type(),text:m.text()});});
 try{
  await page.goto('/dev/atlas-mark-ii.html');await page.evaluate(()=>window.atlasMarkIIStudio.ready);await expect(page.locator('#asset-state')).toHaveText('READY');
  const response=await page.request.get('/models/atlas-mark-ii/atlas-mark-ii.glb');const bytes=await response.body();
  evidence.servedSha256=crypto.createHash('sha256').update(bytes).digest('hex');evidence.servedBytes=bytes.length;
  expect(evidence.servedSha256).toBe('a3b6e095060b965fbc51bb7e87dea4f985521d114efeaf5493d18bfe9ea434aa');
  await page.evaluate(()=>{const s=window.atlasMarkIIStudio;s.view('exterior',true);s.camera.position.set(0,12,-62);s.camera.lookAt(0,7.2,0);document.body.classList.add('details-hidden');});
  await page.waitForTimeout(400);
  evidence.state=await page.evaluate(()=>{
   const s=window.atlasMarkIIStudio,gl=document.querySelector('#viewport').getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');
   s.camera.updateMatrixWorld(true);s.model.updateMatrixWorld(true);
   const v=s.camera.position.clone(),bounds={min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity],vertices:0},backdrops=[];
   s.model.parent.traverse(o=>{const p=o.geometry?.parameters;if(p?.width===92&&p?.height===23&&p?.depth===.45)backdrops.push({position:o.getWorldPosition(v).toArray(),halfDepth:p.depth/2});});
   s.model.traverse(o=>{if(!o.isMesh)return;const p=o.geometry.attributes.position;
    for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld).project(s.camera);const a=v.toArray();for(let j=0;j<3;j++){bounds.min[j]=Math.min(bounds.min[j],a[j]);bounds.max[j]=Math.max(bounds.max[j],a[j]);}bounds.vertices++;}
   });
   return {stats:s.stats,camera:{position:s.camera.position.toArray(),quaternion:s.camera.quaternion.toArray(),fov:s.camera.fov},modelNdcBounds:bounds,backdrops,viewport:{width:innerWidth,height:innerHeight},backend:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),systems:s.systems.snapshot};
  });
  expect(evidence.state.backdrops).toHaveLength(1);expect(evidence.state.camera.position[2]).toBeGreaterThan(evidence.state.backdrops[0].position[2]+evidence.state.backdrops[0].halfDepth);
  expect(evidence.state.modelNdcBounds.min[0]).toBeGreaterThan(-.95);expect(evidence.state.modelNdcBounds.max[0]).toBeLessThan(.95);
  expect(evidence.state.modelNdcBounds.min[1]).toBeGreaterThan(-.75);expect(evidence.state.modelNdcBounds.max[1]).toBeLessThan(.8);
  await page.screenshot({path:OUT+'/desktop-bow-verified.png',fullPage:true});
 }finally{await fs.writeFile(OUT+'/bow-verified-evidence.json',JSON.stringify(evidence,null,2)+'\n');}
 expect(evidence.console).toEqual([]);
});
