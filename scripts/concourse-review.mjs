import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
// Controlled production camera fixtures for independent visual review.
// node scripts/concourse-review.mjs --url http://127.0.0.1:5260 --out /tmp/aeon-concourse-review
const options={url:'http://127.0.0.1:5260',out:'/tmp/star-agent-concourse-views'};
for(let i=2;i<process.argv.length;i++){
 const flag=process.argv[i];
 if(!['--url','--out'].includes(flag)||!process.argv[i+1])throw new Error('Expected --url URL or --out DIRECTORY');
 options[flag.slice(2)]=process.argv[++i];
}
const out=options.out;await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--enable-gpu','--ignore-gpu-blocklist','--disable-dev-shm-usage','--use-gl=angle','--use-angle=gl']});
const page=await browser.newPage({viewport:{width:1440,height:900}});const errors=[],warnings=[],views=[];
page.on('pageerror',error=>errors.push(error.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());if(m.type()==='warning')warnings.push(m.text());});
try{
 await page.goto(new URL('/?intro=0&debug=1&seed=7291',options.url).href);
 await page.waitForFunction(()=>window.starAgent?.state.ready&&starAgent.state.station.ready&&starAgent.state.station.finish==='ready');
 await page.evaluate(()=>{
  const n=starAgent.navigation,s=n.station;starAgent.setRenderScale(1);
  const p=n.position.clone().set(0,s.interiorBox.min.y+4,2);n.orbit();s.toWorld(p,n.position);n.orientation.copy(s.quaternion);n.landOrLaunch();
  s.location='hub';n.mode='walk';n.insideShip=false;n.enabled=false;n.velocity.set(0,0,0);
  document.body.classList.add('photo-mode');
 });
 for(const [name,position,target,open,location='hub'] of [
  ['overview',[0,-6.25,10],[0,-4.5,-10]],
  ['armory',[-6,-6.25,0],[-16,-5.6,0]],
  ['components',[6,-6.25,0],[16,-5.6,0]],
  ['elevator-closed',[0,-6.25,10],[0,-5.6,14.3],false],
  ['elevator-open',[0,-6.25,10],[0,-5.6,14.3],true],
  ['seating',[3,-6.25,7.5],[6,-7.3,10.5]],
  ['hangar-elevator-closed',[0,-6.25,17],[0,-5.6,22.3],false,'hangar'],
  ['hangar-elevator-open',[0,-6.25,17],[0,-5.6,22.3],true,'hangar'],
 ]){
  await page.evaluate(({position,target,open,location})=>{
   const n=starAgent.navigation,s=n.station;s.location=location;
   s.toWorld(n.position.clone().fromArray(position),n.position);
   const t=s.toWorld(n.position.clone().fromArray(target),n.position.clone());n.orientToward(t,s.up);s.rebase(n.position);
   if(open!==undefined)s.lift.open=open;
  },{position,target,open,location});
  if(open!==undefined)await page.waitForFunction(open=>open?starAgent.state.station.elevator>.99:starAgent.state.station.elevator<.01,open);
  await page.waitForTimeout(650);await page.screenshot({path:`${out}/${name}.png`});
  views.push({name,fixture:{position,target,open,location},state:await page.evaluate(()=>({station:starAgent.state.station,drawCalls:starAgent.state.drawCalls,triangles:starAgent.state.triangles,renderScale:starAgent.state.renderScale}))});
 }
 const environment=await page.evaluate(()=>{const canvas=document.querySelector('canvas'),gl=canvas.getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');return {renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):null,viewport:[innerWidth,innerHeight]};});
 await writeFile(`${out}/evidence.json`,JSON.stringify({classification:'Controlled actual-game hub camera fixtures; no claim of physical journey',generatedAt:new Date().toISOString(),url:page.url(),environment,errors,warnings,views},null,2));
 if(/swiftshader|llvmpipe|software/i.test(environment.renderer)||errors.length||warnings.length)process.exitCode=1;
 console.log(JSON.stringify({out,environment,errors,warnings,views:views.map(v=>({name:v.name,draws:v.state.drawCalls,triangles:v.state.triangles}))}));
}finally{await browser.close();}
