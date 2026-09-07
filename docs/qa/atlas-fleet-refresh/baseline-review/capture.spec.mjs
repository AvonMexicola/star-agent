import {test,expect} from '/tmp/star-agent-kestrel/node_modules/@playwright/test/index.mjs';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const OUT='/tmp/star-agent-atlas-refresh/docs/qa/atlas-fleet-refresh/baseline-review';
const EXPECTED='a3b6e095060b965fbc51bb7e87dea4f985521d114efeaf5493d18bfe9ea434aa';
test('independent Atlas baseline views',async({browser,page})=>{
 const notes={browser:browser.version(),console:[],captures:[],scope:'Inspector/camera fixtures; no full physical journey or frame-time gate'};
 function listen(p){p.on('pageerror',e=>notes.console.push({type:'pageerror',text:String(e)}));p.on('console',m=>{if(['warning','error'].includes(m.type()))notes.console.push({type:m.type(),text:m.text()});});}
 async function open(p){listen(p);await p.goto('/dev/atlas-mark-ii.html');await p.evaluate(()=>window.atlasMarkIIStudio.ready);await expect(p.locator('#asset-state')).toHaveText('READY');await p.waitForTimeout(250);}
 async function shot(p,name){
  await p.waitForTimeout(200);const state=await p.evaluate(()=>{
   const s=window.atlasMarkIIStudio,gl=document.querySelector('#viewport').getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');
   return {stats:s.stats,mode:s.mode,view:s.activeView,camera:{position:s.camera.position.toArray(),quaternion:s.camera.quaternion.toArray(),fov:s.camera.fov},systems:s.systems.snapshot,viewport:{width:innerWidth,height:innerHeight},backend:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),seated:s.seated,mfds:s.mfds.snapshot()};
  });await p.screenshot({path:`${OUT}/${name}.png`,fullPage:true});notes.captures.push({name,state});
 }
 async function preset(p,name){await p.evaluate(n=>window.atlasMarkIIStudio.view(n,true),name);}
 async function custom(p,name,position){await preset(p,'exterior');await p.evaluate(pos=>{const s=window.atlasMarkIIStudio;s.camera.position.fromArray(pos);s.camera.lookAt(0,7.2,0);document.body.classList.add('details-hidden');},position);await shot(p,name);}
 try{
  await fs.mkdir(OUT,{recursive:true});await open(page);
  const response=await page.request.get('/models/atlas-mark-ii/atlas-mark-ii.glb');const bytes=await response.body();notes.servedSha256=crypto.createHash('sha256').update(bytes).digest('hex');notes.servedBytes=bytes.length;expect(notes.servedSha256).toBe(EXPECTED);
  await shot(page,'desktop-exterior');
  await custom(page,'desktop-low-quarter',[-60,12,-68]);
  await custom(page,'desktop-bow',[0,12,-105]);
  await custom(page,'desktop-stern',[0,12,105]);
  await custom(page,'desktop-side',[-110,14,0]);
  await custom(page,'desktop-plan',[0,125,.001]);
  for(const name of ['aft','cargo','bridge','crew','galley','elevator','mounts']){await preset(page,name);await shot(page,'desktop-'+name);}
  await preset(page,'aft');await page.evaluate(()=>window.atlasMarkIIStudio.systems.toggleRamp('aft'));
  await page.waitForFunction(()=>window.atlasMarkIIStudio.systems.snapshot.ramps.find(r=>r.id==='aft').progress>.995,null,{timeout:25000});await shot(page,'desktop-boarding');
  await page.evaluate(()=>{const s=window.atlasMarkIIStudio;s.enterWalk();s.walker.position.set(-2.1,11.25,-20.5);s.interact('seat');});await page.waitForFunction(()=>window.atlasMarkIIStudio.seated);await shot(page,'desktop-seated');
  const mobile=await browser.newContext({viewport:{width:390,height:844},hasTouch:true});const phone=await mobile.newPage();await open(phone);await shot(phone,'phone-exterior');await preset(phone,'crew');await shot(phone,'phone-crew');
  await phone.evaluate(()=>{const s=window.atlasMarkIIStudio;s.enterWalk();s.walker.position.set(-2.1,11.25,-20.5);s.interact('seat');});await phone.waitForFunction(()=>window.atlasMarkIIStudio.seated);await shot(phone,'phone-seated');await mobile.close();
 }finally{await fs.writeFile(`${OUT}/browser-evidence.json`,JSON.stringify(notes,null,2)+'\n');}
 expect(notes.console).toEqual([]);
});
