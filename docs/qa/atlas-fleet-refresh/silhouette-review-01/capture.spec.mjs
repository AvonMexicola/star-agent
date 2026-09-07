import {test,expect} from '/tmp/star-agent-kestrel/node_modules/@playwright/test/index.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import crypto from 'node:crypto';
const OUT=path.dirname(fileURLToPath(import.meta.url));
const EXPECTED='f61dfd26570635436ffd05a4243b38be11a891a28dada35f758ae789ed2b396e';
test('independent frozen Atlas silhouette and gear views',async({browser,page})=>{
 const report={scope:'Independent silhouette/scale and visible gear inspection. Camera fixtures; no full journey, materials, controller/touch, flight or performance acceptance.',browser:browser.version(),console:[],captures:[]};
 function listen(p){p.on('pageerror',e=>report.console.push({type:'pageerror',text:String(e)}));p.on('console',m=>{if(['warning','error'].includes(m.type()))report.console.push({type:m.type(),text:m.text()});});}
 async function open(p){listen(p);await p.goto('/dev/atlas-mark-ii.html');await p.evaluate(()=>window.atlasMarkIIStudio.ready);await expect(p.locator('#asset-state')).toHaveText('READY');}
 async function pose(p,position,target=[0,7.2,0],fit=true){
  await p.evaluate(({position,target,fit})=>{
   const s=window.atlasMarkIIStudio;s.view('exterior',true);document.body.classList.add('details-hidden');
   s.inspectCamera(position,target);s.camera.updateMatrixWorld(true);s.model.updateMatrixWorld(true);
   if(fit){const top=document.querySelector('.studio-header').getBoundingClientRect().bottom+18,bottom=document.querySelector('.view-dock').getBoundingClientRect().top-18;
    for(let attempt=0;attempt<15;attempt++){let okay=true;const v=s.camera.position.clone();s.model.traverse(o=>{if(!o.isMesh)return;const p=o.geometry.attributes.position;for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld).project(s.camera);const x=(v.x*.5+.5)*innerWidth,y=(-v.y*.5+.5)*innerHeight;if(x<24||x>innerWidth-24||y<top||y>bottom)okay=false;}});if(okay)break;s.camera.fov*=1.075;s.camera.updateProjectionMatrix();}
   }
  },{position,target,fit});
 }
 async function shot(p,name,wholeModel=false){await p.waitForTimeout(180);const state=await p.evaluate(()=>{
  const s=window.atlasMarkIIStudio,gl=document.querySelector('#viewport').getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');
  const v=s.camera.position.clone(),bounds={minX:Infinity,minY:Infinity,maxX:-Infinity,maxY:-Infinity};s.model.updateMatrixWorld(true);s.camera.updateMatrixWorld(true);s.model.traverse(o=>{if(!o.isMesh)return;const p=o.geometry.attributes.position;for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld).project(s.camera);const x=(v.x*.5+.5)*innerWidth,y=(-v.y*.5+.5)*innerHeight;bounds.minX=Math.min(bounds.minX,x);bounds.minY=Math.min(bounds.minY,y);bounds.maxX=Math.max(bounds.maxX,x);bounds.maxY=Math.max(bounds.maxY,y);}});
  return {stats:s.stats,systems:s.systems.snapshot,camera:{position:s.camera.position.toArray(),quaternion:s.camera.quaternion.toArray(),fov:s.camera.fov},viewport:{width:innerWidth,height:innerHeight},backend:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),bounds,available:{minX:24,maxX:innerWidth-24,minY:document.querySelector('.studio-header').getBoundingClientRect().bottom+18,maxY:document.querySelector('.view-dock').getBoundingClientRect().top-18}};
 });await p.screenshot({path:path.join(OUT,name+'.png')});report.captures.push({name,wholeModel,...state});if(wholeModel){expect(state.bounds.minX).toBeGreaterThanOrEqual(state.available.minX-1);expect(state.bounds.maxX).toBeLessThanOrEqual(state.available.maxX+1);expect(state.bounds.minY).toBeGreaterThanOrEqual(state.available.minY-1);expect(state.bounds.maxY).toBeLessThanOrEqual(state.available.maxY+1);}}
 try{
  const response=await page.request.get('/models/atlas-mark-ii/atlas-mark-ii.glb');expect(response.ok()).toBe(true);const bytes=await response.body();report.servedSha256=crypto.createHash('sha256').update(bytes).digest('hex');report.servedBytes=bytes.length;expect(report.servedSha256).toBe(EXPECTED);
  await open(page);
  for(const [name,pos] of [['exterior',[-57,25,-62]],['side',[-90,9,0]],['plan',[0,125,.001]],['bow',[0,13,-62]],['aft',[48,23,62]],['stern',[0,12,67]]]){await pose(page,pos);await shot(page,'desktop-'+name,true);}
  await pose(page,[-25,3.4,-28],[-9.6,2.8,-18.9],false);await shot(page,'desktop-gear-down');
  expect(await page.evaluate(()=>window.atlasMarkIIStudio.systems.toggleGear())).toBe(true);
  await page.waitForFunction(()=>{const g=window.atlasMarkIIStudio.systems.gear;return g.progress<.55&&g.progress>.25;});await shot(page,'desktop-gear-folding');
  await page.waitForFunction(()=>!window.atlasMarkIIStudio.systems.gear.moving);expect(await page.evaluate(()=>window.atlasMarkIIStudio.systems.gear.progress)).toBe(0);await shot(page,'desktop-gear-stowed');
  await pose(page,[-57,25,-62]);await shot(page,'desktop-exterior-stowed',true);
  await pose(page,[-90,9,0]);await shot(page,'desktop-side-stowed',true);
  await pose(page,[-21,15,-16],[-11.2,9.6,-9],false);await shot(page,'desktop-s3-forward-support');
  await pose(page,[10,21,30],[0,14,19.5],false);await shot(page,'desktop-s3-aft-support');
  expect(await page.evaluate(()=>window.atlasMarkIIStudio.systems.toggleGear())).toBe(true);await page.waitForFunction(()=>!window.atlasMarkIIStudio.systems.gear.moving);expect(await page.evaluate(()=>window.atlasMarkIIStudio.systems.gear.progress)).toBe(1);
  await page.evaluate(()=>window.atlasMarkIIStudio.view('cargo',true));await shot(page,'desktop-cargo-scale');
  const mobile=await browser.newContext({viewport:{width:390,height:844},hasTouch:true});const phone=await mobile.newPage();await open(phone);await shot(phone,'phone-exterior-default');await pose(phone,[-57,25,-62]);await shot(phone,'phone-exterior-review-framing',true);await mobile.close();
 } finally {await fs.writeFile(path.join(OUT,'browser-evidence.json'),JSON.stringify(report,null,2)+'\n');}
 expect(report.console).toEqual([]);
});
