import {test,expect} from '/home/cees/projects/star-agent-station-exterior/node_modules/@playwright/test/index.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import crypto from 'node:crypto';
const OUT=path.dirname(fileURLToPath(import.meta.url));
test('independent full station exterior baseline',async({page,browser})=>{
 const report={browser:browser.version(),timestampUTC:new Date().toISOString(),console:[],captures:[],served:{},scope:'Independent baseline overview and bay-scale camera fixtures on the current dev preview. No gameplay, performance, material or final acceptance gate.'};
 page.on('pageerror',e=>report.console.push({type:'pageerror',text:String(e)}));page.on('console',m=>{if(['error','warning'].includes(m.type()))report.console.push({type:m.type(),text:m.text()});});
 try{
  for(const url of ['/models/station.glb','/models/station_lod1.glb']){const r=await page.request.get(url);expect(r.ok()).toBe(true);const bytes=await r.body();report.served[url]={bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')};}
  await page.goto('/?dev=1&start=orbit&ship=nomad&intro=0&debug=1&seed=7291');await page.waitForFunction(()=>window.starAgent?.state.ready&&window.starAgent.state.station.ready&&window.starAgent.state.station.finish==='ready',null,{timeout:90000});
  await page.evaluate(()=>{const a=window.starAgent,n=a.navigation,s=n.station;a.openingSequence?.leave();a.setRenderScale(1);n.enabled=false;n.keys.clear();n.velocity.set(0,0,0);n.angularVelocity.set(0,0,0);n.mode='walk';n.insideShip=false;n.dockedAtStation=false;document.querySelectorAll('body > :not(canvas):not(script)').forEach(e=>e.style.visibility='hidden');const m=s.exterior.rings[0].children[0],old=m.onBeforeRender;m.onBeforeRender=function(...args){window.__stationBaselineCamera=args[2];return old.apply(this,args);};});
  async function pose(eye,target){await page.evaluate(({eye,target})=>{const n=window.starAgent.navigation,s=n.station;n.position.fromArray(eye).applyQuaternion(s.baseQuaternion).add(s.centre);const t=n.position.clone().fromArray(target).applyQuaternion(s.baseQuaternion).add(s.centre);n.orientToward(t,s.up);}, {eye,target});await page.waitForTimeout(400);}
  async function capture(name,eye,target,overview){
   await pose(eye,target);if(overview){for(let i=0;i<4;i++){const fits=await page.evaluate(()=>{const s=window.starAgent.navigation.station,c=window.__stationBaselineCamera;if(!c)return false;const v=s.centre.clone();for(const x of [-1152,1152])for(const y of [-1477,1477])for(const z of [-1477,1477]){v.set(x,y,z).applyMatrix4(s.exterior.group.matrixWorld).project(c);if(Math.abs(v.x)>.90||Math.abs(v.y)>.90)return false;}return true;});if(fits)break;eye=eye.map((v,i)=>target[i]+(v-target[i])*1.18);await pose(eye,target);}}
   if(!overview)await page.waitForTimeout(2500);
   await page.screenshot({path:path.join(OUT,name+'.png')});
   const state=await page.evaluate(()=>{const a=window.starAgent,n=a.navigation,s=n.station,c=window.__stationBaselineCamera,gl=document.querySelector('canvas').getContext('webgl2'),e=gl.getExtension('WEBGL_debug_renderer_info'),st=a.state;const inv=s.baseQuaternion.clone().invert(),actualLocal=n.position.clone().fromArray(st.camera.position).sub(s.centre).applyQuaternion(inv);const projected=[];for(const x of [-1152,1152])for(const y of [-1477,1477])for(const z of [-1477,1477]){const v=s.centre.clone().set(x,y,z).applyMatrix4(s.exterior.group.matrixWorld).project(c);projected.push(v.toArray());}return {camera:{world:st.camera.position,complexLocal:actualLocal.toArray(),quaternion:c.quaternion.toArray(),navigationQuaternion:n.orientation.toArray(),fov:c.fov,aspect:c.aspect,mode:st.camera.mode},complex:{centre:s.centre.toArray(),quaternion:s.baseQuaternion.toArray(),ringRotationX:s.exterior.rings.map(r=>r.rotation.x)},backend:e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),renderScale:st.renderScale,drawingBuffer:[gl.drawingBufferWidth,gl.drawingBufferHeight],drawCalls:st.drawCalls,triangles:st.triangles,station:st.station,heroPods:s.pods.filter(p=>p.model.visible).map(p=>p.id),lodBatches:s.lodBatches.length,projectedConservativeStationEnvelope:projected};});
   report.captures.push({name,eyeComplexLocal:eye,targetComplexLocal:target,wholeStation:overview,...state});
   if(overview)expect(state.projectedConservativeStationEnvelope.every(p=>Math.abs(p[0])<=.90&&Math.abs(p[1])<=.90&&p[2]>-1&&p[2]<1)).toBe(true);
  }
  await capture('overview-quarter',[-3800,2100,-4200],[0,-35,0],true);
  await capture('overview-broadside',[0,900,-6000],[0,-35,0],true);
  await capture('overview-ring-face',[-5600,1100,-1800],[0,-35,0],true);
  await capture('berth-05-scale',[-5,35,-630],[-95,-4,-520],false);
 }finally{await fs.writeFile(path.join(OUT,'evidence.json'),JSON.stringify(report,null,2)+'\n');}
 expect(report.console).toEqual([]);
});
