import {test,expect} from '/tmp/star-agent-kestrel/node_modules/@playwright/test/index.mjs';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const OUT='/tmp/star-agent-atlas-refresh/docs/qa/atlas-fleet-refresh/baseline-review';
test('independent replacement bow camera inside studio backdrop',async({browser,page})=>{
 const evidence={browser:browser.version(),console:[],replaces:'desktop-bow.png',reason:'Original reviewer camera at z=-105 was behind the studio backdrop. It is invalid shape evidence and remains preserved.',scope:'One fresh desktop bow fixture; no runtime/source changes.'};
 page.on('pageerror',e=>evidence.console.push({type:'pageerror',text:String(e)}));
 page.on('console',m=>{if(['warning','error'].includes(m.type()))evidence.console.push({type:m.type(),text:m.text()});});
 try{
  await page.goto('/dev/atlas-mark-ii.html');await page.evaluate(()=>window.atlasMarkIIStudio.ready);
  await expect(page.locator('#asset-state')).toHaveText('READY');
  const response=await page.request.get('/models/atlas-mark-ii/atlas-mark-ii.glb');const bytes=await response.body();
  evidence.servedSha256=crypto.createHash('sha256').update(bytes).digest('hex');evidence.servedBytes=bytes.length;
  expect(evidence.servedSha256).toBe('a3b6e095060b965fbc51bb7e87dea4f985521d114efeaf5493d18bfe9ea434aa');
  await page.evaluate(()=>{const s=window.atlasMarkIIStudio;s.view('exterior',true);s.camera.position.set(0,12,-72);s.camera.lookAt(0,7.2,0);document.body.classList.add('details-hidden');});
  await page.waitForTimeout(400);
  evidence.state=await page.evaluate(()=>{const s=window.atlasMarkIIStudio,gl=document.querySelector('#viewport').getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');return {stats:s.stats,camera:{position:s.camera.position.toArray(),quaternion:s.camera.quaternion.toArray(),fov:s.camera.fov},viewport:{width:innerWidth,height:innerHeight},backend:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),systems:s.systems.snapshot};});
  await page.screenshot({path:OUT+'/desktop-bow-replacement.png',fullPage:true});
 }finally{await fs.writeFile(OUT+'/bow-replacement-evidence.json',JSON.stringify(evidence,null,2)+'\n');}
 expect(evidence.console).toEqual([]);
});
